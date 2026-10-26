/**
 * 朝ポキ｜公式RSS高速シャドー V2
 * 7公式フィード最新3件。GUID索引はScriptPropertiesにキャッシュし、
 * 本番台帳に増えた行だけを増分読込。初回のみ全GUID列走査。
 * READ_ONLY: 台帳/採番/COPYトリガー変更なし。
 */
function phase14ProductionRssFastShadowV2(){
 const CFG={prod:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',
 copy:'1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY',
 script:'1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV',
 perFeed:3,prefix:'P14_FAST_SHADOW_V2'};
 if(ScriptApp.getScriptId()!==CFG.script)throw Error('WRONG_PROJECT');
 if(typeof P14NewEpisodeFormatterV4==='undefined')throw Error('V4_REQUIRED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1500))return {status:'BUSY'};
 try{
  const sh=SpreadsheetApp.openById(CFG.prod).getSheetByName('エピソード台帳');
  const props=PropertiesService.getScriptProperties(),last=sh.getLastRow();
  const countKey=CFG.prefix+'_LAST_ROW',setKey=CFG.prefix+'_KNOWN_GUIDS';
  let cached=props.getProperty(setKey),previous=Number(props.getProperty(countKey)||0),known=new Set();
  if(cached){
   try{known=new Set(JSON.parse(cached));}catch(e){cached=null;}
  }
  if(!cached||previous<2||previous>last){
   previous=1;known.clear();
  }
  const begin=Math.max(2,previous+1),delta=Math.max(0,last-begin+1);
  if(delta){
   sh.getRange(begin,7,delta,1).getDisplayValues().forEach(a=>{if(a[0])known.add(String(a[0]).trim().toLowerCase());});
  }
  // Do not persist a truncated cache: if property limit is exceeded, rebuild on next run.
  const packed=JSON.stringify([...known]);
  if(packed.length<8500){props.setProperties({[setKey]:packed,[countKey]:String(last)});}
  else {props.deleteProperty(setKey);props.deleteProperty(countKey);}
  const feeds=SpreadsheetApp.openById(CFG.copy).getSheetByName('取得元一覧').getRange('A2:H8').getDisplayValues();
  const output=[],errors=[];let checked=0,available=0;
  const normalizedFeeds=feeds.filter(x=>x[0]&&x[7]);
  const responses=UrlFetchApp.fetchAll(normalizedFeeds.map(x=>({url:x[7],muteHttpExceptions:true,followRedirects:true})));
  normalizedFeeds.forEach((feed,i)=>{
   try{
    const response=responses[i];if(response.getResponseCode()!==200)throw Error('HTTP_'+response.getResponseCode());
    const root=XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
    if(!root)throw Error('NO_CHANNEL');
    const items=root.getChildren('item');available+=items.length;
    const recent=items.map(x=>({x,t:Date.parse(x.getChildText('pubDate')||'')}))
      .filter(v=>Number.isFinite(v.t)&&v.t<=Date.now()).sort((a,b)=>b.t-a.t).slice(0,CFG.perFeed);
    checked+=recent.length;
    for(const {x} of recent){
     const guid=String(x.getChildText('guid')||'').toLowerCase().trim();
     if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(guid)||known.has(guid))continue;
     const raw=x.getChildText('description')||'',clean=P14NewEpisodeFormatterV4.clean(raw),cast=P14NewEpisodeFormatterV4.cast(raw);
     const row={program:feed[0],guid,title:x.getChildText('title'),published:x.getChildText('pubDate'),
      overview:clean.status,cast:cast.status,names:cast.names,status:'CANDIDATE_ONLY'};
     output.push(row);console.log(JSON.stringify({mode:'FAST_RSS_CANDIDATE',...row}));
    }
   }catch(e){errors.push({program:feed[0],error:String(e)});}
  });
  const summary={mode:'FAST_RSS_SHADOW_V2',feeds:normalizedFeeds.length,checked,available,candidates:output.length,
   guidCacheCount:known.size,rowsRead:delta,errors,writes:0,idsAllocated:0,triggerChanges:0};
  console.log(JSON.stringify(summary));return summary;
 }finally{lock.releaseLock();}
}
