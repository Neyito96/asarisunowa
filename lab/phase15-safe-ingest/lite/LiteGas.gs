/** Phase15 LAB artifact ONLY. Not installed, executed, or approved for production. Requires LiteCore in same GAS project. */
function phase15LiteReadOnly(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const ledger=ss.getSheetByName('エピソード台帳'),source=ss.getSheetByName('取得元一覧');
 if(!ledger||!source)throw Error('REQUIRED_SHEET_MISSING');
 const ledgerGuids=ledger.getLastRow()>1?ledger.getRange(2,7,ledger.getLastRow()-1,1).getValues().map(r=>String(r[0]||'')):[];
 const sources=source.getLastRow()>1?source.getRange(2,1,source.getLastRow()-1,8).getValues().map(r=>({show:String(r[0]||'').trim(),url:String(r[7]||'').trim()})):[];
 const result=liteScan({sources,ledgerGuids,fetchFeed:phase15LiteFetchRss});
 console.log(JSON.stringify(result));return result;
}
function phase15LiteFetchRss(feed){
 const r=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true,followRedirects:true});
 if(r.getResponseCode()!==200)throw Error('RSS_HTTP_'+r.getResponseCode());
 const channel=XmlService.parse(r.getContentText()).getRootElement().getChild('channel');
 if(!channel)throw Error('RSS_CHANNEL_MISSING');
 return channel.getChildren('item').map(x=>({guid:x.getChildText('guid')||'',title:x.getChildText('title')||'',pubDate:x.getChildText('pubDate')||'',link:x.getChildText('link')||''}));
}
// No ledger writes, history writes, V3 writes, ScriptProperties, trigger installation or ID allocation.
