/** Phase16 V3 URL hold tracer. READ_ONLY, no write and no trigger. */
function p16TraceHybridV3UnknownUrls() {
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=new Set(['EP-00631','EP-01069','EP-06642']);
 const rows=sh.getRange(2,1,sh.getLastRow()-1,23).getValues();
 const results=rows.filter(r=>ids.has(String(r[0]))).map(r=>{
   const raw=String(r[21]||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n');
   const lines=raw.replace(/<br\s*\/?>|<\/?p[^>]*>/gi,'\n').split('\n').map(s=>s.trim()).filter(Boolean);
   const urlLines=lines.filter(x=>/https?:\/\//i.test(x)).map(s=>({
     sourceLine:s.slice(0,350),
     urls:[...s.matchAll(/https?:\/\/[^\s<>"']+/g)].map(m=>m[0].slice(0,220))
   }));
   return {id:r[0],urlLines,readOnly:true};
 });
 console.log(JSON.stringify({mode:'READ_ONLY_URL_TRACE',results,writes:0},null,2));
 return results;
}
