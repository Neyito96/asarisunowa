/** Phase 14. Independent, disabled by default. No Pages or Spotify writes.
 * Uses Sheets REST atomic batches (ledger + state + history + audit).
 * Install ONLY alongside the inspected live V3 files, never replace that project.
 */
var LibraryOfficialEngine = (function () {
 const PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const blank=x=>x===undefined||x===null||x==='';
 const value=c=>c&&c.userEnteredValue ? (c.userEnteredValue.stringValue??c.userEnteredValue.numberValue??c.userEnteredValue.boolValue??'') : '';
 function must(ok,msg){if(!ok)throw Error(msg);}
 function hash(x){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
 function utc(x){if(typeof x==='number')return new Date(Math.round((x-25569)*86400000)-32400000).toISOString();if(x instanceof Date)return x.toISOString();return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(String(x))?x:String(x).replace(/\//g,'-').replace(' ','T')+'+09:00').toISOString();}
 // Exact V3 contract: native getValues() row, entire data-range width.
 // Do not pass REST serial dates, truncate columns, or normalize blanks/types.
 function rowHash(row){return hash(row);}
 function v3RowHash(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
 function verifyRowProof(row,state){
  must(state.identity?.[0]==='VERIFIED','STATE_NOT_VERIFIED');
  const actual=rowHash(row),baseline=state.identity[2],packed=state.officialBackfill;
  const receipt=Array.isArray(packed)&&packed.length===8&&packed[0]==='VERIFIED'?JSON.parse(packed[7]||'{}'):null;
  if(packed){
   must(receipt?.schema==='official-native-row-v1'&&receipt.baselineHash===baseline&&receipt.afterHash===actual,'STATE_HASH_CONFLICT');
   return actual;
  }
  if(actual===baseline||v3RowHash(row)===baseline)return actual;
  // Proven online for EP-00141..150: V3 baseline predates AZ:BC extension.
  must(state.identity[5]==='baseline'&&row.length===55&&v3RowHash(row.slice(0,51))===baseline,'STATE_HASH_CONFLICT');
  return actual;
 }
 function jst(x){return new Date(Date.parse(x)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' ');}
 function clipUuid(audio){return (String(audio).match(/\/clips\/[^/]+\/[^/]+\/([0-9a-f-]{36})\//i)||[])[1]||'';}
 function verify(item,clip){
  must(UUID.test(item.guid),'GUID_INVALID');
  must(clip.Id===item.guid&&clip.Title===item.title&&Date.parse(clip.PublishedUtc)===Date.parse(item.pubDate)&&clip.PublishedUrl===item.link,'RSS_JSON_CONFLICT');
  must(clipUuid(item.audio)===item.guid&&/^https:\/\/(?:traffic\.omny\.fm|www\.omnycontent\.com)\//.test(item.audio),'AUDIO_UUID_CONFLICT');
  must(/^https:\/\/(?:www\.)?omny\.fm\//.test(item.link),'PAGE_HOST');
  const seconds=String(item.duration||'').split(':').reduce((s,x)=>s*60+Number(x),0);
  must(Number.isFinite(seconds)&&seconds>0,'DURATION_INVALID');return seconds;
 }
 function materialMegaphone(item){
  must(/^https:\/\/feeds\.megaphone\.fm\/TASC/.test(item.feedUrl),'MEGAPHONE_FEED');
  must(UUID.test(item.guid)&&item.title&&Number.isFinite(Date.parse(item.pubDate)),'MEGAPHONE_IDENTITY');
  must(/^https:\/\/pdst\.fm\/e\/traffic\.megaphone\.fm\/TASC\d+\.mp3(?:\?.*)?$/.test(item.audio||''),'MEGAPHONE_AUDIO_HOST');
  must(!item.link||/^https:\/\//.test(item.link),'MEGAPHONE_LINK_INVALID');
  const parsed=LibraryOfficialParser.parse(item.description||'');
  const raw=String(item.description||'');
  const clean=raw.replace(/&nbsp;/g,' ').replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim();
  const articleUrls=[...new Set(Array.from(raw.matchAll(/https?:\\/\\/(?:www\\.|digital\\.)?asahi\\.com\\/articles\\/[A-Za-z0-9]+(?:\\?[^\\s<>"']*)?/g),m=>m[0].replace(/&(?:amp|nbsp);.*$/,'').split('?')[0]))];
  const parsedText=String(parsed.description||'').trim();
  const r={9:item.link||'',14:item.audio,17:'記載あり',18:'未確認（未再生）',21:raw,22:parsedText||clean,27:'ja',28:articleUrls.join('\\n'),32:item.feedUrl,35:'公式Megaphone RSSのGUID・タイトル・公開日時・音声URLを確認。音声実再生・出演者は未確認。',36:'未確認',38:'未指定',39:'出演者・スタッフは公式RSS概要に明示がない限り未確認。V3検証前の登録。',44:item.feedUrl,50:'公式Megaphone RSS概要に出演者の明示なし（未確認）'};
  return {values:r,people:[],links:articleUrls,warnings:parsed.holds||[]};
 }
 function material(item,clip,apiUrl){
  const duration=verify(item,clip),parsed=LibraryOfficialParser.parse(item.description||'');
  const stop=parsed.staff.findIndex(s=>/^【/.test(s));const staff=parsed.staff.slice(0,stop<0?undefined:stop);
  const people=staff.map(s=>s.replace(/https?:\/\/\S+/g,'').trim()).filter(Boolean);
  const names=people.map(s=>s.replace(/^(?:MC(?:・音源編集)?|音源編集|出演|司会)\s+/,'').replace(/（[^）]*）$/,''));
  // Only official article URLs from explicit description sections; omit promotional links.
  const embedded=Array.from(String(item.description||'').matchAll(/https?:\/\/[^\s<>"']+/g),m=>LibraryOfficialParser.url(m[0]));
  const links=parsed.relatedArticles.map(x=>x.url).concat(embedded).filter(u=>/^https:\/\/(?:www\.|digital\.)?asahi\.com\/articles\//.test(u));
  const r={9:item.link,13:item.image||clip.ImageUrl||'',14:item.audio,15:duration,21:item.description||'',22:parsed.description.replace(/(https?:\/\/[^\s]+)\s+\1/g,'$1'),23:staff.join('\n'),28:[...new Set(links)].join('\n'),32:item.sourceUrl||item.feedUrl,44:item.feedUrl,51:clip.Id,52:clip.PublishedUrl,53:clip.EmbedUrl||'',54:apiUrl};
  names.slice(0,5).forEach((s,i)=>r[45+i]=s);
  if(staff.length)r[50]='公式RSSの出演・スタッフ欄。所属・役割・全員分はX列とV列に保持。';
  for(const proof of item.platformEvidence||[]){const col={apple:12,listen:10,spotify:11,pocket:41,pody:42}[proof.platform];const hosts={apple:'podcasts.apple.com',listen:'listen.style',spotify:'open.spotify.com',pocket:'pca.st',pody:'pody.fm'};const host=(String(proof.url).match(/^https:\/\/([^/]+)\//)||[])[1];if(col!==undefined&&proof.guid===item.guid&&proof.verified===true&&host===hosts[proof.platform])r[col]=proof.url;}
  return {values:r,people,links:[...new Set(links)],warnings:parsed.holds};
 }
 function fromJson(row,clip,apiUrl){
  must(clip.Id===row[6]&&clip.Title===row[2],'HISTORICAL_JSON_IDENTITY');
  must(utc(row[3])===utc(clip.PublishedUtc),'HISTORICAL_JSON_DATE');
  return {guid:clip.Id,title:clip.Title,pubDate:clip.PublishedUtc,description:clip.DescriptionHtml||clip.Description||'',link:clip.PublishedUrl,audio:clip.AudioUrl,duration:clip.DurationSeconds,image:clip.ImageUrl,feedUrl:row[44]||row[32]||'',sourceUrl:apiUrl,sourceType:'official-json'};
 }
 function articleLinkRuns(links){
  const runs=[];let offset=0;
  for(const url of links){
   runs.push({startIndex:offset,format:{link:{uri:url}}});
   offset+=url.length;
   runs.push({startIndex:offset,format:{}});
   offset++;
  }
  return runs;
 }
 function cell(v){return {userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}};}
 function plan(cells,item,clip,apiUrl){
  must(value(cells[6])===item.guid,'ROW_GUID_CONFLICT');
  must(blank(value(cells[51]))||value(cells[51])===item.guid,'ROW_UUID_CONFLICT');
  must(value(cells[2])===item.title,'ROW_TITLE_CONFLICT');
  const m=material(item,clip,apiUrl),changes=[],conflicts=[];
  for(const key of Object.keys(m.values)){
   const col=Number(key),old=value(cells[col]),next=m.values[col],c=cells[col]||{};
   if(blank(next))continue;
   if(c.userEnteredValue?.formulaValue||c.chipRuns?.length||c.dataValidation){conflicts.push({col,reason:'STRUCTURE_PROTECTED'});continue;}
   if(!blank(old)){if(String(old)!==String(next))conflicts.push({col,reason:'NONEMPTY_PRESERVED'});continue;}
   const out=cell(next);out.note=JSON.stringify({engine:'official-rss-v1',guid:item.guid,source:item.sourceUrl||item.feedUrl,sourceType:item.sourceType||'official-rss',json:apiUrl,old:'',new:next});
   if(col===28)out.textFormatRuns=articleLinkRuns(m.links);
   changes.push({col,old:'',next,cell:out});
  }
  return {id:value(cells[0]),guid:item.guid,changes,conflicts,warnings:m.warnings};
 }
 function identityTokens(row){return [row[6],row[51],clipUuid(row[14])].filter(x=>UUID.test(String(x))).map(x=>x.toLowerCase());}
 function newDecision(item,rows,history,excluded,decisions,config,baseline,lastId){
  must(baseline.complete===true,'BASELINE_NOT_READY');
  must(config.allowNew===true&&Number.isFinite(Date.parse(config.newAfter)),'NEW_DISABLED');
  must(Date.parse(item.pubDate)>Date.parse(config.newAfter)&&Date.parse(item.pubDate)<=Date.now(),'NOT_FRESH');
  must(UUID.test(item.guid),'GUID_INVALID');const guid=item.guid.toLowerCase();
  const ids=rows.map(r=>r[0]);must(ids.every(x=>/^EP-\d{5}$/.test(x))&&new Set(ids).size===ids.length,'LEDGER_ID_INTEGRITY');
  must(!rows.some(r=>identityTokens(r).includes(guid))&&!history.some(r=>String(r[0]).toLowerCase()===guid)&&!excluded.some(r=>r.some(x=>String(x).toLowerCase()===guid)),'SEEN_OR_EXCLUDED');
  must(!rows.some(r=>r[14]===item.audio||(r[2]===item.title&&utc(r[3])===utc(item.pubDate))),'POSSIBLE_REISSUE');
  // All decisions, including held and excluded, remain reserved even if absent from ledger.
  const reserved=[...ids,...history.map(r=>r[1]),...excluded.map(r=>r[1]),...decisions.map(r=>r[0])].filter(x=>/^EP-\d{5}$/.test(x));
  const counter=String(lastId||'0').replace(/^EP-/,'');must(/^\d+$/.test(counter),'COUNTER_INVALID');
  const max=Math.max(Number(counter),...reserved.map(x=>Number(x.slice(3))));must(max<99999,'ID_EXHAUSTED');
  return 'EP-'+String(max+1).padStart(5,'0');
 }
 function config(){const c=JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_OFFICIAL_CONFIG')||'{}');must(c.sheetId&&Array.isArray(c.feeds)&&c.feeds.length,'CONFIG_REQUIRED');return c;}
 function inspect(){
  const p=PropertiesService.getScriptProperties();return {scriptId:ScriptApp.getScriptId(),sheetId:typeof LIB_V2_SHEET_ID==='undefined'?null:LIB_V2_SHEET_ID,triggers:ScriptApp.getProjectTriggers().map(t=>({handler:t.getHandlerFunction(),type:String(t.getEventType()),id:t.getUniqueId()})),v3Config:JSON.parse(p.getProperty('LIB_V3_CONFIG')||'null'),baseline:JSON.parse(p.getProperty('LIB_V3_BASELINE')||'null'),lastId:p.getProperty('LIB_V3_LAST_ID'),officialConfig:JSON.parse(p.getProperty('LIB_OFFICIAL_CONFIG')||'null'),checkpoint:JSON.parse(p.getProperty('LIB_OFFICIAL_CHECKPOINT')||'null')};
 }
 function readJson(url,options){const r=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true,followRedirects:false},options||{}));must(r.getResponseCode()===200,'HTTP_'+r.getResponseCode());return JSON.parse(r.getContentText());}
 function api(c,path,body){return readJson('https://sheets.googleapis.com/v4/spreadsheets/'+c.sheetId+path,{method:body?'post':'get',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},...(body?{payload:JSON.stringify(body)}:{})});}
 function table(c,name){return api(c,'/values/'+encodeURIComponent("'"+name+"'!A1:BC10000")+'?valueRenderOption=UNFORMATTED_VALUE').values||[];}
 function context(c){
  const meta=api(c,'?fields=sheets.properties'),tabs={};meta.sheets.forEach(s=>tabs[s.properties.title]=s.properties);
  const rows=table(c,'エピソード台帳'),history=table(c,'固定ID採番履歴'),excluded=table(c,'削除・除外履歴'),decisions=table(c,'図書館・宇宙 検索対象判定'),states=table(c,'図書館V3・項目状態');
  must(rows[0][0]==='台帳ID'&&rows[0][21]==='概要原文'&&rows[0].length>=55,'HEADER_CONFLICT');
  return {tabs,rows:rows.slice(1),history:history.slice(1),excluded:excluded.slice(1),decisions:decisions.slice(1),states:states.slice(1),stateLength:states.length};
 }
 function rss(feed){
  must(/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/.test(feed.url),'FEED_NOT_OFFICIAL');
  const r=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});must(r.getResponseCode()===200,'RSS_HTTP');
  const root=XmlService.parse(r.getContentText()).getRootElement().getChild('channel');must(root,'RSS_CHANNEL');
  const ns=XmlService.getNamespace('http://www.itunes.com/dtds/podcast-1.0.dtd');
  return root.getChildren('item').map(x=>({guid:x.getChildText('guid'),title:x.getChildText('title'),pubDate:x.getChildText('pubDate'),description:x.getChildText('description')||'',link:x.getChildText('link'),audio:x.getChild('enclosure')?.getAttribute('url')?.getValue(),duration:x.getChildText('duration',ns),image:x.getChild('image',ns)?.getAttribute('href')?.getValue()||'',feedUrl:feed.url,show:feed.show}));
 }
 function official(item){must(UUID.test(item.guid),'GUID_INVALID');if(/^https:\/\/feeds\.megaphone\.fm\/TASC/.test(item.feedUrl)){must(/^https:\/\/pdst\.fm\/e\/traffic\.megaphone\.fm\/TASC\d+\.mp3(?:\?.*)?$/.test(item.audio||''),'MEGAPHONE_AUDIO_HOST');must(Number.isFinite(Date.parse(item.pubDate))&&Date.parse(item.pubDate)<=Date.now(),'MEGAPHONE_DATE');must(item.title&&item.guid,'MEGAPHONE_IDENTITY');return {clip:null,url:item.feedUrl,provider:'MEGAPHONE'};}const url='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/'+item.guid;return {clip:readJson(url),url};}
 function platforms(item,feed){
  const out=[];
  // Reuses Phase 13 exact episodeGuid + feedUrl evidence. No guessed platform URLs.
  if(feed.applePodcastId&&/^\d+$/.test(String(feed.applePodcastId))){try{
   const result=readJson('https://itunes.apple.com/lookup?id='+feed.applePodcastId+'&entity=podcastEpisode&limit=200&country=JP');
   const matches=(result.results||[]).filter(r=>r.episodeGuid===item.guid&&r.feedUrl===item.feedUrl&&/^https:\/\/podcasts\.apple\.com\//.test(r.trackViewUrl||'')&&/[?&]i=\d+/.test(r.trackViewUrl||''));
   if(matches.length===1)out.push({platform:'apple',guid:item.guid,url:matches[0].trackViewUrl,verified:true});
  }catch(e){/* Optional enrichment failure never blocks official ingestion. */}}
  return out;
 }
 function update(sheetId,row,col,cellData){return {updateCells:{range:{sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[cellData]}],fields:'userEnteredValue,note,textFormatRuns'}};}
 function writePlan(c,ctx,rowIndex,original,plan){
  if(!plan.changes.length)return 0;
  const ledger=ctx.tabs['エピソード台帳'],stateTab=ctx.tabs['図書館V3・項目状態'];
  const range="'エピソード台帳'!A"+(rowIndex+1)+':BC'+(rowIndex+1);
  const current=api(c,'?includeGridData=true&ranges='+encodeURIComponent(range)).sheets[0].data[0].rowData[0].values;
  must(JSON.stringify(current.map(value))===JSON.stringify(original.map(value)),'CONCURRENT_ROW_CHANGE');
  must(plan.changes.every(ch=>blank(value(current[ch.col]))&&!current[ch.col]?.userEnteredValue?.formulaValue&&!current[ch.col]?.dataValidation&&!current[ch.col]?.chipRuns?.length),'TARGET_STRUCTURE_CHANGED');
  const stateIndex=ctx.states.findIndex(r=>r[0]===plan.id);must(stateIndex>=0,'STATE_MISSING');
  const state=JSON.parse(ctx.states[stateIndex][1]);must(state.identity?.[0]==='VERIFIED','STATE_NOT_VERIFIED');
  const sheet=SpreadsheetApp.openById(c.sheetId).getSheetByName('エピソード台帳');
  const before=sheet.getRange(rowIndex+1,1,1,sheet.getLastColumn()).getValues()[0];
  must(before[0]===plan.id&&before[6]===plan.guid,'NATIVE_IDENTITY_CONFLICT');
  verifyRowProof(before,state);
  must(plan.changes.every(ch=>blank(before[ch.col])),'NATIVE_TARGET_NOT_BLANK');
  const after=before.slice(),requests=plan.changes.map(ch=>{after[ch.col]=ch.next;return update(ledger.sheetId,rowIndex,ch.col,ch.cell);});
  // Preserve the original V3 identity proof. A separate receipt records this transition.
  state.officialBackfill=['VERIFIED',plan.guid,rowHash(before),'',rowHash(after),'official_blank_fill',new Date().toISOString(),JSON.stringify({schema:'official-native-row-v1',baselineHash:state.identity[2],beforeHash:rowHash(before),afterHash:rowHash(after),columns:plan.changes.map(x=>x.col)})];
  requests.push(update(stateTab.sheetId,stateIndex+1,1,cell(JSON.stringify(state))));
  requests.push(update(stateTab.sheetId,stateIndex+1,2,cell(new Date().toISOString())));
  // Notes retain per-cell old/new/evidence; state transition and fills commit atomically.
  api(c,':batchUpdate',{requests});
  const reread=api(c,'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE').values[0];
  must(plan.changes.every(ch=>String(reread[ch.col])===String(ch.next)),'READBACK_FAILED');return plan.changes.length;
 }
 function runBackfill(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};
  try{
   const c=config();must(c.engineValidation==='P14_RUNTIME_VERIFIED','ENGINE_NOT_VALIDATED');must(c.enabled===true&&c.allowBackfill===true,'BACKFILL_DISABLED');
   must(c.otherWritersPaused===true,'WRITERS_NOT_CONFIRMED');
   must(!ScriptApp.getProjectTriggers().some(t=>!/^scheduledLibraryOfficial/.test(t.getHandlerFunction())&&/library|backfill/i.test(t.getHandlerFunction())),'TRIGGER_CONFLICT');
   const props=PropertiesService.getScriptProperties(),last=Number(props.getProperty('LIB_OFFICIAL_NEW_LAST_SUCCESS')||0);
   if(c.sheetId===PROD)must(Date.now()-last<2*3600000,'NEW_INGESTION_PRIORITY');
   const ctx=context(c),cp=JSON.parse(props.getProperty('LIB_OFFICIAL_CHECKPOINT')||'{}');must(!cp.sheetId||cp.sheetId===c.sheetId,'CHECKPOINT_TARGET_CONFLICT');
   const deadline=Date.now()+180000,items=[];c.feeds.forEach(f=>items.push(...rss(f)));const index=new Map();for(const i of items){if(index.has(i.guid))index.set(i.guid,null);else index.set(i.guid,i);}
   const stage=cp.stage||0,priority=[[21],[15],[28],[23,45,50],[9,13,14],[10,11,12,40,41,42]];
   const excluded=new Set(['アルキキ','AJW','朝ポキTV']);
   const retryKey='LIB_OFFICIAL_BACKFILL_RETRY';
   const retry=JSON.parse(props.getProperty(retryKey)||'[]');
   must(Array.isArray(retry)&&retry.length<=1000,'RETRY_QUEUE_INVALID');
   const batchLimit=Math.min(c.batchSize||10,10);
   let next=cp.offset||0,processed=0,changed=0;const holds=[];
   function saveRetry(){props.setProperty(retryKey,JSON.stringify(retry));}
   function attempt(rowIndex,pass){
    const row=ctx.rows[rowIndex];
    if(!row||excluded.has(String(row[1]||'').trim()))return true;
    if(!priority[pass].some(col=>blank(row[col])))return true;
    processed++;
    try{
     const range="'エピソード台帳'!A"+(rowIndex+2)+':BC'+(rowIndex+2);
     const cells=api(c,'?includeGridData=true&ranges='+encodeURIComponent(range)).sheets[0].data[0].rowData[0].values;
     let item=index.get(row[6]);
     const evidence=official(item||{guid:row[6]});
     if(!item)item=fromJson(row,evidence.clip,evidence.url);
     item.platformEvidence=platforms(item,c.feeds.find(f=>f.url===item.feedUrl)||{});
     const p=plan(cells,item,evidence.clip,evidence.url);
     changed+=writePlan(c,ctx,rowIndex+1,cells,p);
     return true;
    }catch(e){
     holds.push({id:row[0],stage:pass,reason:String(e.message)});
     return false;
    }
   }
   // Retry previously failed identities first, without blocking unrelated rows.
   // Keep failures durable across runs, and never use the read-only v0.7 cursor here.
   for(let i=0;i<retry.length&&processed<batchLimit&&Date.now()<deadline;){
    const job=retry[i],idx=ctx.rows.findIndex(r=>r[0]===job.id);
    if(idx<0){holds.push({id:job.id,stage:job.stage,reason:'RETRY_ID_MISSING'});i++;continue;}
    if(attempt(idx,job.stage)){retry.splice(i,1);saveRetry();}else{i++;}
   }
   for(;next<ctx.rows.length&&processed<batchLimit&&Date.now()<deadline;next++){
    const row=ctx.rows[next];
    if(excluded.has(String(row[1]||'').trim()))continue;
    if(!priority[stage].some(col=>blank(row[col])))continue;
    if(retry.some(j=>j.id===row[0]&&j.stage===stage))continue;
    if(retry.length>=1000)throw Error('RETRY_QUEUE_FULL_HOLD_CURSOR');
    if(!attempt(next,stage)){
     retry.push({id:row[0],stage:stage});
     saveRetry();
    }
    props.setProperty('LIB_OFFICIAL_CHECKPOINT',JSON.stringify({sheetId:c.sheetId,stage,offset:next+1,updatedAt:new Date().toISOString()}));
   }
   props.setProperty('LIB_OFFICIAL_CHECKPOINT',JSON.stringify({sheetId:c.sheetId,stage:next>=ctx.rows.length?(stage+1)%priority.length:stage,offset:next>=ctx.rows.length?0:next,updatedAt:new Date().toISOString()}));
   props.setProperty('LIB_OFFICIAL_LAST_REPORT',JSON.stringify({processed,changed,holds:holds.slice(0,20),held:holds.length,retryPending:retry.length}));
   return {processed,changed,holds,retryPending:retry.length};
  }finally{lock.releaseLock();}
 }
 return {inspect,plan,material,materialMegaphone,articleLinkRuns,verify,fromJson,newDecision,identityTokens,rowHash,v3RowHash,verifyRowProof,runBackfill,readJson,rss,official,platforms,config,context,cell,update,api,PROD};
})();
function inspectLibraryOfficialReadOnly(){const report=LibraryOfficialEngine.inspect();console.log(JSON.stringify(report));return report;}
function scheduledLibraryOfficialBackfill(){return LibraryOfficialEngine.runBackfill();}
/** New records have an atomic history reservation, so an interrupted retry cannot allocate again. */
function scheduledLibraryOfficialNew(){
 const E=LibraryOfficialEngine,lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};
 try{
  const c=E.config(),inspection=E.inspect(),props=PropertiesService.getScriptProperties();
  if(c.engineValidation!=='P14_RUNTIME_VERIFIED')throw Error('ENGINE_NOT_VALIDATED');
  if(c.enabled!==true||c.allowNew!==true||c.otherWritersPaused!==true)throw Error('NEW_DISABLED_OR_WRITERS_UNCONFIRMED');
  if(inspection.triggers.some(t=>!/^scheduledLibraryOfficial/.test(t.handler)&&/library|backfill/i.test(t.handler)))throw Error('TRIGGER_CONFLICT');
  if(inspection.v3Config&&(inspection.v3Config.enabled||inspection.v3Config.allowNew||inspection.v3Config.allowEnrich))throw Error('V3_WRITER_ENABLED');
  if(!inspection.baseline?.complete)throw Error('BASELINE_NOT_READY');
  if(c.sheetId===E.PROD&&inspection.sheetId!==E.PROD)throw Error('V3_TARGET_CONFLICT');
  const all=[];for(const feed of c.feeds){if(['アルキキ','AJW','朝ポキTV'].includes(String(feed.show||'').trim()))continue;all.push(...E.rss(feed));}
  const frequencies=new Map();all.forEach(it=>frequencies.set(it.guid,(frequencies.get(it.guid)||0)+1));
  const candidates=all.filter(it=>!['アルキキ','AJW','朝ポキTV'].includes(String(it.show||'').trim())&&frequencies.get(it.guid)===1&&Date.parse(it.pubDate)>Date.parse(c.newAfter)).sort((a,b)=>Date.parse(a.pubDate)-Date.parse(b.pubDate));
  const report={added:[],held:[...frequencies].filter(([,n])=>n>1).map(([guid])=>({guid,reason:'AMBIGUOUS_FEED_IDENTITY'})),existing:0},deadline=Date.now()+180000;
  for(const item of candidates){
   if(Date.now()>deadline||report.added.length>=Math.min(c.newBatchSize||1,10))break;
   try{
    let ctx=E.context(c);
    if(ctx.rows.some(r=>E.identityTokens(r).includes(item.guid.toLowerCase()))||ctx.history.some(r=>r[0]===item.guid)){report.existing++;continue;}
    if(c.onlyGuid&&c.onlyGuid!==item.guid)continue;
    const evidence=E.official(item);item.platformEvidence=E.platforms(item,c.feeds.find(f=>f.url===item.feedUrl)||{});const m=evidence.provider==='MEGAPHONE'?E.materialMegaphone(item):E.material(item,evidence.clip,evidence.url);
    // Re-read all identity stores after the network fetch, before reserving any ID.
    ctx=E.context(c);
    const reservations=ctx.states.map(r=>{const identity=JSON.parse(r[1]||'{}').identity;return [identity?.[1]||'',r[0]];});
    const id=E.newDecision(item,ctx.rows,ctx.history.concat(reservations),ctx.excluded,ctx.decisions,c,inspection.baseline,props.getProperty('LIB_V3_LAST_ID'));
    const row=Array(55).fill('');Object.entries(m.values).forEach(([k,v])=>row[Number(k)]=v);
    Object.assign(row,{0:id,1:item.show,2:item.title,3:new Date(Date.parse(item.pubDate)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' '),4:'音声',5:evidence.provider==='MEGAPHONE'?'朝日新聞ポッドキャスト公式RSS（Megaphone）':'朝日新聞ポッドキャスト公式RSS（Omny Studio）',6:item.guid,8:item.link,18:'未確認（未再生）',38:'未指定'});
    const now=new Date().toISOString(),state={identity:['VERIFIED',item.guid,E.rowHash(row),'','','RSS_registered',now,item.guid],registrationEvidence:['VERIFIED',item.guid,E.rowHash(row),'','',evidence.provider==='MEGAPHONE'?'official_megaphone_rss':'official_rss_plus_json',now,JSON.stringify({source:item.feedUrl,json:evidence.provider==='MEGAPHONE'?null:evidence.url,pubDate:item.pubDate})]};
    const ledger=ctx.tabs['エピソード台帳'],history=ctx.tabs['固定ID採番履歴'],states=ctx.tabs['図書館V3・項目状態'],requests=[];
    const positions=[[ledger,ctx.rows.length+1],[history,ctx.history.length+1],[states,ctx.stateLength]];
    for(const [tab,index]of positions)if(index>=tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:index-tab.gridProperties.rowCount+1}});
    // Copy only format and validation; no values, hyperlinks or row-specific chips.
    for(const pasteType of ['PASTE_FORMAT','PASTE_DATA_VALIDATION'])requests.push({copyPaste:{source:{sheetId:ledger.sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:55},destination:{sheetId:ledger.sheetId,startRowIndex:ctx.rows.length+1,endRowIndex:ctx.rows.length+2,startColumnIndex:0,endColumnIndex:55},pasteType}});
    row.forEach((v,col)=>{const data=E.cell(v);if(col===28&&v)data.textFormatRuns=E.articleLinkRuns(m.links);if(col===21)data.note=JSON.stringify({source:item.feedUrl,guid:item.guid,raw:true});requests.push(E.update(ledger.sheetId,ctx.rows.length+1,col,data));});
    [item.guid,id,item.show,item.title,'登録完了',now].forEach((v,col)=>requests.push(E.update(history.sheetId,ctx.history.length+1,col,E.cell(v))));
    [id,JSON.stringify(state),now].forEach((v,col)=>requests.push(E.update(states.sheetId,ctx.stateLength,col,E.cell(v))));
    E.api(c,':batchUpdate',{requests});
    const check=E.context(c);if(check.rows.filter(r=>r[0]===id&&r[6]===item.guid).length!==1||check.history.filter(r=>r[0]===item.guid&&r[1]===id).length!==1)throw Error('REGISTRATION_READBACK_FAILED');
    props.setProperty('LIB_V3_LAST_ID',String(Number(id.slice(3))));report.added.push(id);
   }catch(e){report.held.push({guid:item.guid,reason:String(e.message)});}
  }
  props.setProperty('LIB_OFFICIAL_NEW_LAST_SUCCESS',String(Date.now()));props.setProperty('LIB_OFFICIAL_NEW_REPORT',JSON.stringify(report));return report;
 }finally{lock.releaseLock();}
}
/** Run only after online source review, copy test and production smoke evidence are recorded. */
function installLibraryOfficialTriggersAfterValidation(){
 const E=LibraryOfficialEngine,c=E.config(),s=E.inspect();
 if(c.engineValidation!=='P14_RUNTIME_VERIFIED')throw Error('ENGINE_NOT_VALIDATED');
 if(c.enabled!==true||c.copyVerified!==true||c.productionSmokeVerified!==true||c.otherWritersPaused!==true||!s.baseline?.complete)throw Error('VALIDATION_REQUIRED');
 if(s.triggers.length)throw Error('EXISTING_TRIGGERS_REVIEW_REQUIRED');
 if(s.v3Config&&(s.v3Config.enabled||s.v3Config.allowNew||s.v3Config.allowEnrich))throw Error('V3_WRITER_ENABLED');
 // Hourly also covers 06:35 releases; GAS time triggers have a scheduling window.
 const added=[];try{
  added.push(ScriptApp.newTrigger('scheduledLibraryOfficialNew').timeBased().everyHours(1).create());
  added.push(ScriptApp.newTrigger('scheduledLibraryOfficialBackfill').timeBased().everyHours(2).create());
 }catch(e){added.forEach(t=>ScriptApp.deleteTrigger(t));throw e;}
 return E.inspect();
}
/** READ_ONLY native GAS diagnosis. Does not change any saved proof or cell. */
function inspectLibraryOfficialCopyHashesReadOnly(){
 const ids=['1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY',LibraryOfficialEngine.PROD];
 const out={mode:'READ_ONLY',scriptId:ScriptApp.getScriptId(),books:[]};
 ids.forEach(id=>{
  const ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName('エピソード台帳');
  const rows=sh.getRange(142,1,10,sh.getLastColumn()).getValues();
  const states=ss.getSheetByName('図書館V3・項目状態').getDataRange().getValues();
  const book={id,timezone:ss.getSpreadsheetTimeZone(),width:sh.getLastColumn(),rows:[]};
  rows.forEach(row=>{
   const savedRow=states.find(r=>r[0]===row[0]);if(!savedRow)throw Error('STATE_MISSING');
   const state=JSON.parse(savedRow[1]),saved=state.identity[2],matchingWidths=[];
   for(let w=1;w<=row.length;w++)if(LibraryOfficialEngine.v3RowHash(row.slice(0,w))===saved)matchingWidths.push(w);
   book.rows.push({id:row[0],saved,full:LibraryOfficialEngine.v3RowHash(row),first51:LibraryOfficialEngine.v3RowHash(row.slice(0,51)),utf8:LibraryOfficialEngine.rowHash(row.slice(0,51)),matchingWidths,types:row.map(v=>v instanceof Date?'Date':typeof v),dates:row.map((v,i)=>v instanceof Date?{col:i+1,iso:v.toISOString()}:null).filter(Boolean)});
  });out.books.push(book);
 });out.books.forEach(b=>{console.log(JSON.stringify({id:b.id,width:b.width,timezone:b.timezone}));b.rows.forEach(r=>console.log(JSON.stringify(r)));});return out;
}

/** Copy-only network/parser probe. No cell, property or trigger writes. */
function inspectLibraryOfficialCopyNetworkReadOnly(){
 const E=LibraryOfficialEngine,c={sheetId:'1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY'};
 const ss=SpreadsheetApp.openById(c.sheetId),rows=ss.getSheetByName('エピソード台帳').getRange(142,1,10,55).getValues();
 const feed={url:rows[0][44],show:rows[0][1]},items=E.rss(feed);
 const report={mode:'COPY_READ_ONLY',rssItems:items.length,rssParsed:0,jsonVerified:0,copyPlannedCells:0,writes:0,rows:[]};
 if(items.length){const ev=E.official(items[0]);E.material(items[0],ev.clip,ev.url);report.rssParsed=1;}
 for(let i=0;i<rows.length;i++){
  const r=rows[i],ev=E.official({guid:r[6]}),item=E.fromJson(r,ev.clip,ev.url);
  const range="'エピソード台帳'!A"+(142+i)+':BC'+(142+i);
  const cells=E.api(c,'?includeGridData=true&ranges='+encodeURIComponent(range)).sheets[0].data[0].rowData[0].values;
  const p=E.plan(cells,item,ev.clip,ev.url);report.jsonVerified++;report.copyPlannedCells+=p.changes.length;
  report.rows.push({id:r[0],guid:r[6],rawLength:item.description.length,changes:p.changes.map(x=>x.col+1),preserved:p.conflicts.length});
 }
 console.log(JSON.stringify(report));return report;
}


/** RSS inventory parser only; Megaphone IDs are not assumed to be Omny UUIDs. */
function libraryOfficialAuditFeedReadOnly(feed){
 const url=String(feed.url||'');
 if(!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/.test(url))throw Error('UNAPPROVED_RSS_HOST');
 const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw Error('RSS_HTTP_'+response.getResponseCode());
 const channel=XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
 if(!channel)throw Error('RSS_CHANNEL_MISSING');
 return channel.getChildren('item').map(x=>({
  guid:String(x.getChildText('guid')||'').trim(),title:x.getChildText('title')||'',
  pubDate:x.getChildText('pubDate')||'',link:x.getChildText('link')||'',
  show:feed.show,feedUrl:url
 }));
}

/** Phase 14: last-seven-days official RSS inventory; strictly READ_ONLY.
 * Execute manually in the approved GAS copy project after UrlFetch OAuth approval.
 * Never registers IDs, writes Sheets, properties, triggers, Pages, or Spotify.
 */
function inspectLibraryOfficialLastSevenDaysReadOnly(){
 const now=new Date(),since=new Date(now.getTime()-7*86400000);
 const ss=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY');
 const ledger=ss.getSheetByName('エピソード台帳'),history=ss.getSheetByName('固定ID採番履歴');
 if(!ledger||!history)throw Error('COPY_LEDGER_OR_HISTORY_MISSING');
 const rows=ledger.getDataRange().getValues().slice(1),historyRows=history.getDataRange().getValues().slice(1),known=new Set();
 const sourceSheet=ss.getSheetByName('取得元一覧');
 if(!sourceSheet)throw Error('SOURCE_LIST_MISSING');
 const feeds=sourceSheet.getRange(2,1,7,8).getValues().map(r=>({show:String(r[0]||''),url:String(r[7]||'')}));
 if(feeds.length!==7||feeds.some(f=>!f.show||!f.url)||new Set(feeds.map(f=>f.show)).size!==7)throw Error('SEVEN_FEEDS_INCOMPLETE');
 const canonical=x=>String(x||'').trim().toLowerCase();
 rows.forEach(r=>{for(const col of [6,8,9,10,11,12,44,45,46,47,48,49,50]){const v=r[col];if(v)known.add(canonical(v));}});
 historyRows.forEach(r=>{if(r[0])known.add(canonical(r[0]));});
 const report={mode:'READ_ONLY',since:since.toISOString(),until:now.toISOString(),ledgerRows:rows.length,feeds:[],missing:[],existing:[],held:[],writes:0,triggerChanges:0};
 const found=new Map();
 for(const feed of feeds){
  try{
   const items=libraryOfficialAuditFeedReadOnly(feed),dates=items.map(i=>Date.parse(i.pubDate)).filter(Number.isFinite);
   const oldest=dates.length?new Date(Math.min(...dates)).toISOString():null;
   const coverage=oldest&&Date.parse(oldest)<=since.getTime()?'SEVEN_DAYS_COVERED':'POSSIBLY_TRUNCATED';
   let recent=0;
   for(const item of items){
    const time=Date.parse(item.pubDate);
    if(!Number.isFinite(time)){report.held.push({show:feed.show,title:item.title,guid:item.guid,reason:'INVALID_PUBLISHED_DATE'});continue;}
    if(time<since.getTime()||time>now.getTime())continue;
    recent++;
    const guid=canonical(item.guid),entry={show:item.show,guid,title:item.title,published:item.pubDate,feed:feed.url};
    if(!guid){report.held.push({...entry,reason:'MISSING_GUID'});continue;}
    // Distinct shows may share identifiers during migrations; never silently deduplicate.
    if(found.has(guid)){report.held.push({...entry,reason:'DUPLICATE_IN_FEEDS'});found.get(guid).duplicate=true;continue;}
    found.set(guid,{entry,duplicate:false});
   }
   report.feeds.push({show:feed.show,recent,returned:items.length,oldest,coverage,status:'OK'});
  }catch(err){report.feeds.push({show:feed.show,status:'ERROR',reason:String(err.message)});}
 }
 for(const {entry,duplicate} of found.values()){
  if(duplicate)continue;
  (known.has(entry.guid)?report.existing:report.missing).push(entry);
 }
 report.complete=report.feeds.every(f=>f.status==='OK'&&f.coverage==='SEVEN_DAYS_COVERED');
 report.summary={feeds:report.feeds.length,missing:report.missing.length,existing:report.existing.length,held:report.held.length,complete:report.complete};
 console.log(JSON.stringify(report));return report;
}


/** Copy-only, read-only: audit whether new RSS items have registration metadata.
 * This is a registration DRY RUN, NOT an EP-ID reservation or sheet write.
 */
function inspectSevenFeedRegistrationReadinessReadOnly(){
 const id='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const ss=SpreadsheetApp.openById(id),source=ss.getSheetByName('取得元一覧'),ledger=ss.getSheetByName('エピソード台帳');
 if(!source||!ledger)throw Error('COPY_SHEETS_MISSING');
 const feeds=source.getRange(2,1,7,8).getValues().map(r=>({show:String(r[0]||''),url:String(r[7]||'')}));
 if(feeds.length!==7||new Set(feeds.map(f=>f.show)).size!==7)throw Error('FEED_LIST_INVALID');
 const rows=ledger.getDataRange().getValues().slice(1),known=new Set();
 rows.forEach(r=>{[6,8,9,10,11,12,44,45,46,47,48,49,50].forEach(i=>{if(r[i])known.add(String(r[i]).trim().toLowerCase());});});
 const since=Date.now()-7*86400000,items=[],errors=[],seen=new Set();
 for(const feed of feeds){
  try{
   if(!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/.test(feed.url))throw Error('RSS_HOST_REJECTED');
   const res=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});
   if(res.getResponseCode()!==200)throw Error('RSS_HTTP_'+res.getResponseCode());
   const channel=XmlService.parse(res.getContentText()).getRootElement().getChild('channel');
   if(!channel)throw Error('CHANNEL_MISSING');
   for(const node of channel.getChildren('item')){
    const guid=String(node.getChildText('guid')||'').trim(),title=node.getChildText('title')||'',date=node.getChildText('pubDate')||'';
    const time=Date.parse(date);if(!Number.isFinite(time)||time<since||time>Date.now())continue;
    const key=guid.toLowerCase();
    if(known.has(key))continue;
    const enclosure=node.getChild('enclosure'),audio=enclosure?.getAttribute('url')?.getValue()||'';
    const link=node.getChildText('link')||'';
    const platform=feed.url.includes('megaphone.fm')?'Megaphone':'Omny';
    const issues=[];
    if(!guid)issues.push('GUID_MISSING');
    if(!title)issues.push('TITLE_MISSING');
    if(!audio)issues.push('AUDIO_MISSING');
    if(!link)issues.push('LINK_MISSING');
    if(seen.has(key))issues.push('GUID_DUPLICATE_IN_FEEDS');
    seen.add(key);
    items.push({show:feed.show,platform,guid,title,published:new Date(time).toISOString(),audio:!!audio,link:!!link,issues});
   }
  }catch(e){errors.push({show:feed.show,error:String(e.message)});}
 }
 items.sort((a,b)=>a.published.localeCompare(b.published)||a.show.localeCompare(b.show)||a.guid.localeCompare(b.guid));
 const summary={mode:'COPY_READ_ONLY',feedCount:feeds.length,feedErrors:errors.length,candidates:items.length,metadataReady:items.filter(x=>!x.issues.length).length,held:items.filter(x=>x.issues.length).length,omny:items.filter(x=>x.platform==='Omny').length,megaphone:items.filter(x=>x.platform==='Megaphone').length,writes:0,triggerChanges:0};
 console.log('READINESS_SUMMARY '+JSON.stringify(summary));
 errors.forEach(e=>console.log('FEED_ERROR '+JSON.stringify(e)));
 items.forEach((item,i)=>console.log('CANDIDATE '+JSON.stringify({order:i+1,...item})));
 return summary;
}


/** Phase14 v0.9: inspect official RSS provider compatibility on COPY, no writes. */
function inspectLibraryOfficialProviderReadinessV09ReadOnly(){
 const ss=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY');
 const source=ss.getSheetByName('取得元一覧');
 if(!source)throw Error('COPY_SOURCE_LIST_MISSING');
 const rows=source.getRange(2,1,source.getLastRow()-1,8).getValues();
 const excluded=new Set(['アルキキ','AJW','朝ポキTV']);
 const report={mode:'COPY_READ_ONLY',version:'0.9',feeds:[],writes:0,propertyWrites:0,triggerChanges:0};
 for(const row of rows){
  const show=String(row[0]||'').trim(),url=String(row[7]||'').trim();
  if(!show||!url||excluded.has(show))continue;
  const provider=/^https:\/\/www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\//.test(url)?'OMNY':
   /^https:\/\/feeds\.megaphone\.fm\/TASC/.test(url)?'MEGAPHONE':'UNAPPROVED';
  const engineACompatible=provider==='OMNY';
  report.feeds.push({show,provider,engineACompatible,
   status:engineACompatible?'RSS_AND_OMNY_JSON_PATH_AVAILABLE':'REGISTRATION_ADAPTER_REQUIRED'});
 }
 report.summary={feeds:report.feeds.length,compatible:report.feeds.filter(x=>x.engineACompatible).length,
  blocked:report.feeds.filter(x=>!x.engineACompatible).length};
 console.log('PHASE14_PROVIDER_V09 '+JSON.stringify(report));
 return report;
}
