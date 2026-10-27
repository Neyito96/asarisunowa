/** Phase15 Lite LAB ONLY. Dependency injection permits pure fake-GAS tests.
 * No writes, allocation, property access or trigger installation.
 * Requires LiteCore.js loaded in the same project; NOT installed in production.
 */
function phase15LiteReadOnly(){
  return phase15LiteRunWithDeps({
    SpreadsheetApp:SpreadsheetApp,UrlFetchApp:UrlFetchApp,
    XmlService:XmlService,console:console,liteScan:liteScan
  });
}
function phase15LiteRunWithDeps(deps){
  var ss=deps.SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  var ledger=ss.getSheetByName('エピソード台帳');
  var source=ss.getSheetByName('取得元一覧');
  if(!ledger||!source)throw Error('STOP_REQUIRED_SHEET_MISSING');
  if(source.getLastRow()<1||ledger.getLastRow()<1)throw Error('STOP_EMPTY_SHEET');
  var header=source.getRange(1,1,1,8).getValues()[0];
  if(header[0]!=='番組・取得先'||header[7]!=='RSS・取得URL')throw Error('STOP_SOURCE_SCHEMA_UNVERIFIED');
  var ledgerHeader=ledger.getRange(1,1,1,7).getValues()[0];
  if(ledgerHeader[6]!=='外部ID')throw Error('STOP_LEDGER_GUID_SCHEMA_UNVERIFIED');
  var rows=source.getLastRow()>1?source.getRange(2,1,source.getLastRow()-1,8).getValues():[];
  var sources=rows.map(function(r){return {show:String(r[0]||'').trim(),url:String(r[7]||'').trim()};});
  var guids=ledger.getLastRow()>1?ledger.getRange(2,7,ledger.getLastRow()-1,1).getValues().map(function(r){return String(r[0]||'');}):[];
  var result=deps.liteScan({sources:sources,ledgerGuids:guids,fetchFeed:function(feed){
    return phase15LiteFetchWithDeps(feed,deps);
  }});
  // No V text, person details, tokens or candidate titles/URLs in execution logs.
  deps.console.log(JSON.stringify({mode:result.mode,sourceCompleteness:result.sourceCompleteness,ledgerIntegrity:result.ledgerIntegrity,
    rows:result.rows.map(function(x){return {show:x.show,status:x.status,fetched:x.fetched,unregistered:x.unregistered,existing:x.existing,duplicates:x.duplicates,invalid:x.invalid,errors:x.errors};}),totals:result.totals}));
  return result;
}
function phase15LiteFetchWithDeps(feed,deps){
  var response=deps.UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true,followRedirects:false});
  var status=response.getResponseCode();
  if(status!==200)throw Error('RSS_HTTP_'+status); // 3xx is SOURCE_PENDING, not redirected to unknown host
  var raw=response.getContentText();
  if(!/^\s*(?:<\?xml[^>]*>\s*)?<rss(?:\s|>)/i.test(raw))throw Error('RSS_NOT_XML');
  var root=deps.XmlService.parse(raw).getRootElement();
  if(root.getName()!=='rss')throw Error('RSS_ROOT');
  var channel=root.getChild('channel');
  if(!channel)throw Error('RSS_CHANNEL');
  return channel.getChildren('item').map(function(x){
    return {guid:x.getChildText('guid')||'',title:x.getChildText('title')||'',
      pubDate:x.getChildText('pubDate')||'',link:x.getChildText('link')||''};
  });
}
