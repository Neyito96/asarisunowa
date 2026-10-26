/**
 * 朝ポキ 本番ロボ：公式RSS独立巡回（READ_ONLY）
 * COPYトリガーはそのまま。明日以降も同じ関数で新着を検出する。
 * 本番書込・EP採番・トリガー作成なし。
 */
function phase14ProductionRssShadowReadOnly(){
 const PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const SCRIPT='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV';
 if(ScriptApp.getScriptId()!==SCRIPT)throw Error('WRONG_SCRIPT');
 if(typeof P14NewEpisodeFormatterV4==='undefined')throw Error('V4_FORMATTER_NOT_FOUND');
 const book=SpreadsheetApp.openById(PROD);
 const sheet=book.getSheetByName('エピソード台帳'),rows=sheet.getDataRange().getValues();
 const known=new Set(rows.slice(1).map(r=>String(r[6]||'').trim().toLowerCase()).filter(Boolean));
 const cbook=SpreadsheetApp.openById(COPY),feeds=cbook.getSheetByName('取得元一覧').getRange('A2:H8').getDisplayValues();
 const results=[],errors=[];let scanned=0,feedItemsReturned=0;const MAX_PER_FEED=3;
 for(const row of feeds){
  const program=row[0],url=row[7];
  if(!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/|feeds\.megaphone\.fm\/TASC)/.test(url)){errors.push({program,reason:'UNAPPROVED_FEED'});continue;}
  try {
   const resp=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
   if(resp.getResponseCode()!==200)throw Error('RSS_HTTP_'+resp.getResponseCode());
   const root=XmlService.parse(resp.getContentText()).getRootElement();
   const channel=root.getChild('channel');if(!channel)throw Error('MISSING_CHANNEL');
   const items=channel.getChildren('item');feedItemsReturned+=items.length;
   const latest=items.map(item=>({item,date:Date.parse(item.getChildText('pubDate')||'')}))
     .filter(x=>Number.isFinite(x.date)&&x.date<=Date.now())
     .sort((a,b)=>b.date-a.date).slice(0,MAX_PER_FEED);
   scanned+=latest.length;
   for(const {item} of latest){
    const guid=String(item.getChildText('guid')||'').trim();
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(guid))continue;
    if(known.has(guid.toLowerCase()))continue;
    const title=item.getChildText('title')||'',raw=item.getChildText('description')||'';
    const published=item.getChildText('pubDate')||'';
    if(!Number.isFinite(Date.parse(published)))continue;
    const w=P14NewEpisodeFormatterV4.clean(raw),people=P14NewEpisodeFormatterV4.cast(raw);
    const report={program,guid,title,published,overview:w.status,
       cast:people.status,names:people.names,
       source:url,status:'CANDIDATE_ONLY',writes:0};
    results.push(report);console.log(JSON.stringify({mode:'RSS_SHADOW_CANDIDATE',...report}));
   }
  } catch(e){errors.push({program,reason:String(e)});}
 }
 const summary={mode:'RSS_SHADOW_READ_ONLY',feeds:feeds.length,maxPerFeed:MAX_PER_FEED,scanned,feedItemsReturned,
   candidates:results.length,errors,prodRows:rows.length-1,
   writes:0,idsAllocated:0,triggerChanges:0};
 console.log(JSON.stringify(summary));return summary;
}
