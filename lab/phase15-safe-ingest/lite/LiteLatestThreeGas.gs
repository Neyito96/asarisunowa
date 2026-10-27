/** LAB ONLY, never deployed. LiteLatestThree.js plus existing LiteGas.gs and LiteCore.js required.
 * Separate entrypoint: do NOT edit or execute existing online GAS without approval.
 */
function phase15LiteLatestThreeReadOnly(){
 return phase15LiteLatestThreeWithDeps({SpreadsheetApp:SpreadsheetApp,UrlFetchApp:UrlFetchApp,
   XmlService:XmlService,console:console,latestScan:liteLatestThreeScan});
}
function phase15LiteLatestThreeWithDeps(d){
 var ss=d.SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 var ledger=ss.getSheetByName('エピソード台帳'),source=ss.getSheetByName('取得元一覧');
 if(!ledger||!source||ledger.getLastRow()<1||source.getLastRow()<1)throw Error('STOP_REQUIRED_SHEETS');
 var lh=ledger.getRange(1,1,1,10).getValues()[0],sh=source.getRange(1,1,1,8).getValues()[0];
 if(lh[0]!=='台帳ID'||lh[6]!=='外部ID'||lh[8]!=='元ページURL'||lh[9]!=='公式個別URL'||sh[0]!=='番組・取得先'||sh[7]!=='RSS・取得URL')
   throw Error('STOP_SCHEMA_UNVERIFIED');
 var sourceValues=source.getLastRow()>1?source.getRange(2,1,source.getLastRow()-1,8).getValues():[];
 var sources=sourceValues.map(function(r){return {show:String(r[0]||'').trim(),url:String(r[7]||'').trim()};});
 var values=ledger.getLastRow()>1?ledger.getRange(2,1,ledger.getLastRow()-1,10).getValues():[];
 var ledgerRows=values.map(function(r){return {id:String(r[0]||''),guid:String(r[6]||''),url:String(r[8]||''),officialUrl:String(r[9]||'')};});
 var result=d.latestScan({sources:sources,ledgerRows:ledgerRows,fetchFeed:function(feed){return phase15LiteFetchWithDeps(feed,d);}});
 // Only 21 candidates and aggregate fields in log, not V column; no tokens.
 d.console.log(JSON.stringify({mode:result.mode,sourceCompleteness:result.sourceCompleteness,
   totals:result.totals,rows:result.rows.map(function(r){return {show:r.show,status:r.status,fetched:r.fetched,selected:r.selected,
   existing:r.existing,unregistered:r.unregistered,duplicates:r.duplicates,unknown:r.unknown,errors:r.errors,
   candidates:r.candidates};})}));
 return result;
}
