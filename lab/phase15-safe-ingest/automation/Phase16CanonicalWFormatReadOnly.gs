/**
 * Phase16 W format v2: pure formatter + read-only regression.
 * Canonical form: body\n【関連記事】\ntitle+URL (one article per line).
 * Never rewrite original V, existing W, or AC in this test.
 */
var P16_W_FORMAT_V2=(function(){
 function format(body,articles){
  const b=String(body||'').trim();
  if(!b)throw Error('EMPTY_BODY');
  const arr=articles||[];
  for(const a of arr){
   if(!a.title||!a.url||!/^https:\/\//i.test(a.url)||/\n|\r/.test(a.title+a.url))throw Error('INVALID_ARTICLE');
  }
  return b+(arr.length?'\n【関連記事】\n'+arr.map(a=>a.title.trim()+a.url.trim()).join('\n'):'');
 }
 return {format:format};
})();
function p16PreviewCanonicalWReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=['EP-00571','EP-00574','EP-00631','EP-01069','EP-06642'];
 const rows=sh.getRange(2,1,sh.getLastRow()-1,29).getValues();
 const results=rows.filter(r=>ids.includes(String(r[0]))).map(r=>{
   const id=r[0],v2=P16_HYBRID_V2.parse(r[21]);
   const safe=v2.holds.length===0&&v2.body.trim()&&v2.articles.every(a=>/^https:\/\//.test(a.url));
   return {id,existingW:!!r[22],holds:v2.holds,articleCount:v2.articles.length,
     proposedW:safe?P16_W_FORMAT_V2.format(v2.body,v2.articles):null,
     currentW:String(r[22]||''),writeEligible:safe&&!r[22]};
 });
 console.log(JSON.stringify({mode:'READ_ONLY_CANONICAL_W',results,writes:0},null,2));
 return results;
}
