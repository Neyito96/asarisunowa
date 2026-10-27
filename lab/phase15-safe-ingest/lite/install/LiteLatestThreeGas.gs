/**
 * Phase15 Lite latest-three READ_ONLY trial add-on. Never run before approval.
 * Depends ONLY on LiteLatestThree.gs's liteLatestThreeScan(), not on old LiteGas.gs.
 * In particular, NO reference to phase15LiteFetchWithDeps or phase15LiteFetchRss_.
 * App scopes must stay spreadsheets.readonly + script.external_request.
 */
function phase15LiteLatestThreeReadOnly() {
  return phase15LiteLatestThreeTrial_({
    UrlFetchApp: UrlFetchApp, ScriptApp: ScriptApp,
    XmlService: XmlService, console: console,
    scan: liteLatestThreeScan
  });
}
function phase15LiteLatestThreeTrial_(d) {
  var spreadsheetId = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
  var token = d.ScriptApp.getOAuthToken();
  function readRange(a1) {
    var u = 'https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(spreadsheetId) + '/values/' +
      encodeURIComponent(a1) + '?valueRenderOption=FORMATTED_VALUE';
    var r = d.UrlFetchApp.fetch(u, {method:'get',headers:{Authorization:'Bearer '+token},
      followRedirects:false,muteHttpExceptions:true});
    if (r.getResponseCode() !== 200) throw Error('STOP_SHEETS_READ_HTTP_'+r.getResponseCode());
    var j = JSON.parse(r.getContentText());
    if (!Array.isArray(j.values)) throw Error('STOP_SHEETS_VALUES_MISSING');
    return j.values;
  }
  var source = readRange("'取得元一覧'!A1:H");
  var ledger = readRange("'エピソード台帳'!A1:J");
  if (!source.length || !ledger.length || source[0][0]!=='番組・取得先' ||
      source[0][7]!=='RSS・取得URL' || ledger[0][0]!=='台帳ID' ||
      ledger[0][6]!=='外部ID' || ledger[0][8]!=='元ページURL' ||
      ledger[0][9]!=='公式個別URL')
    throw Error('STOP_SCHEMA_UNVERIFIED');
  var sources = source.slice(1).map(function(r){return {show:String(r[0]||'').trim(),
    url:String(r[7]||'').trim()};});
  var ledgerRows = ledger.slice(1).map(function(r){return {id:String(r[0]||''),
    guid:String(r[6]||''),url:String(r[8]||''),officialUrl:String(r[9]||'')};});
  var result = d.scan({sources:sources, ledgerRows:ledgerRows,
    fetchFeed:function(feed){return phase15LiteLatestThreeRss_(feed,d);}});
  var safeRows = result.rows.map(function(x){return {show:x.show,status:x.status,
    fetched:x.fetched,selected:x.selected,existing:x.existing,unregistered:x.unregistered,
    duplicates:x.duplicates,unknown:x.unknown,errors:x.errors,
    candidates:x.candidates};});
  d.console.log(JSON.stringify({mode:result.mode,sourceCompleteness:result.sourceCompleteness,
    totals:result.totals,rows:safeRows}));
  return result;
}
/* Independent RSS adapter: does not call either historical RSS function name.
 * Fetch does not follow redirects; no HTTP POST, Sheet mutation or trigger code.
 */
function phase15LiteLatestThreeRss_(feed,d) {
  if (!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/.test(feed.url||''))
    throw Error('RSS_URL_NOT_ALLOWLISTED');
  var r = d.UrlFetchApp.fetch(feed.url,{method:'get',followRedirects:false,muteHttpExceptions:true});
  if(r.getResponseCode()!==200)throw Error('RSS_HTTP_'+r.getResponseCode());
  var xml=r.getContentText();
  if(!/^\s*(?:<\?xml[^>]*>\s*)?<rss(?:\s|>)/i.test(xml))throw Error('RSS_NOT_XML');
  var root=d.XmlService.parse(xml).getRootElement();
  if(root.getName()!=='rss')throw Error('RSS_BAD_ROOT');
  var channel=root.getChild('channel');
  if(!channel)throw Error('RSS_CHANNEL_MISSING');
  return channel.getChildren('item').map(function(item){return {
    guid:item.getChildText('guid')||'',title:item.getChildText('title')||'',
    pubDate:item.getChildText('pubDate')||'',link:item.getChildText('link')||''
  };});
}
