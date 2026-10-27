/** LAB ONLY — Sheets REST v4 read-only; NOT deployed. Requires LiteLatestThree.js,
 * the existing phase15LiteFetchWithDeps RSS parser, and scope spreadsheets.readonly.
 * Uses UrlFetchApp HTTP GET and ScriptApp.getOAuthToken; no SpreadsheetApp.
 */
function phase15LiteLatestThreeReadOnly(){
 return phase15LiteLatestThreeWithDeps({UrlFetchApp:UrlFetchApp,ScriptApp:ScriptApp,console:console,
   latestScan:liteLatestThreeScan,fetchRss:phase15LiteFetchWithDeps,XmlService:XmlService});
}
function phase15LiteLatestThreeWithDeps(d){
 var id='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 var token=d.ScriptApp.getOAuthToken();
 var root='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/';
 function read(a1){
   var uri=root+encodeURIComponent(a1)+'?valueRenderOption=FORMATTED_VALUE';
   var res=d.UrlFetchApp.fetch(uri,{method:'get',headers:{Authorization:'Bearer '+token},followRedirects:false,muteHttpExceptions:true});
   var status=res.getResponseCode();
   if(status!==200)throw Error('STOP_SHEETS_READ_HTTP_'+status);
   var json=JSON.parse(res.getContentText());if(!Array.isArray(json.values))throw Error('STOP_SHEETS_VALUES_MISSING');
   return json.values;
 }
 var sh=read("'取得元一覧'!A1:H"),lh=read("'エピソード台帳'!A1:J");
 if(!sh.length||!lh.length||sh[0][0]!=='番組・取得先'||sh[0][7]!=='RSS・取得URL'||
    lh[0][0]!=='台帳ID'||lh[0][6]!=='外部ID'||lh[0][8]!=='元ページURL'||lh[0][9]!=='公式個別URL')
   throw Error('STOP_SCHEMA_UNVERIFIED');
 var sources=sh.slice(1).map(function(r){return {show:String(r[0]||'').trim(),url:String(r[7]||'').trim()};});
 var ledgerRows=lh.slice(1).map(function(r){return {id:String(r[0]||''),guid:String(r[6]||''),url:String(r[8]||''),officialUrl:String(r[9]||'')};});
 var result=d.latestScan({sources:sources,ledgerRows:ledgerRows,fetchFeed:function(feed){return d.fetchRss(feed,d);}});
 d.console.log(JSON.stringify({mode:result.mode,sourceCompleteness:result.sourceCompleteness,
  totals:result.totals,rows:result.rows.map(function(r){return {show:r.show,status:r.status,fetched:r.fetched,selected:r.selected,
  existing:r.existing,unregistered:r.unregistered,duplicates:r.duplicates,unknown:r.unknown,errors:r.errors,candidates:r.candidates};})}));
 return result;
}
