/** Phase15 isolated READ_ONLY GAS — add ONLY, never replace LiteGas.gs/LiteCore.gs.
 * Dependencies: phase15Latest3Scan_ (LiteLatestThree.gs), phase15LiteFetchRss_ (existing live LiteGas.gs).
 * GAS installation and execution require separate user approvals. No writes/triggers.
 */
function phase15Latest3ReadOnlyTrial() {
  if (typeof phase15Latest3Scan_ !== 'function') throw Error('STOP_LATEST3_LOGIC_MISSING');
  if (typeof phase15LiteFetchRss_ !== 'function') throw Error('STOP_EXISTING_RSS_FUNCTION_MISSING');
  var sheetId='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
  var accessToken=ScriptApp.getOAuthToken();
  var root='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sheetId)+'/values/';
  function read(range) {
    var url=root+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE';
    var response=UrlFetchApp.fetch(url,{method:'get',headers:{Authorization:'Bearer '+accessToken},
      followRedirects:false,muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw Error('STOP_SHEETS_READ_HTTP_'+response.getResponseCode());
    var parsed=JSON.parse(response.getContentText());
    if(!Array.isArray(parsed.values))throw Error('STOP_SHEETS_VALUES_MISSING');
    return parsed.values;
  }
  var source=read("'取得元一覧'!A1:H");
  var ledger=read("'エピソード台帳'!A1:J");
  if(!source.length||!ledger.length||source[0][0]!=='番組・取得先'||
      source[0][7]!=='RSS・取得URL'||ledger[0][0]!=='台帳ID'||
      ledger[0][6]!=='外部ID'||ledger[0][8]!=='元ページURL'||
      ledger[0][9]!=='公式個別URL')throw Error('STOP_SCHEMA_UNVERIFIED');
  var sources=source.slice(1).map(function(r){return {show:String(r[0]||'').trim(),url:String(r[7]||'').trim()};});
  var rows=ledger.slice(1).map(function(r){return {id:String(r[0]||''),guid:String(r[6]||''),
    url:String(r[8]||''),officialUrl:String(r[9]||'')};});
  var start=Date.now();
  var result=phase15Latest3Scan_(sources,rows,function(feed){
    // Reuse the live proven RSS function. Do NOT import LAB phase15LiteFetchWithDeps.
    return phase15LiteFetchRss_(feed);
  });
  console.log(JSON.stringify({mode:result.mode,elapsedMs:Date.now()-start,totals:result.totals,
    sourceCompleteness:result.sourceCompleteness,rows:result.rows}));
  return result;
}
