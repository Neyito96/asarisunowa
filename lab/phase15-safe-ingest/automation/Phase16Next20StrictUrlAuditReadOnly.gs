/** Phase16 URL multiplicity guard; READ_ONLY, no writes. Requires P16_UNIFIED_V4.
 * Every generated W article URL must match original URL count and canonical URL.
 */
function p16Next20StrictUrlAuditReadOnly(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const sh=ss.getSheetByName('エピソード台帳');
 const ids=['EP-00744','EP-00745','EP-00746','EP-00747','EP-00749','EP-00750','EP-00751','EP-00752','EP-00753','EP-00754','EP-00755','EP-00756','EP-00757','EP-00758','EP-00760','EP-00761','EP-00763','EP-00764','EP-00765','EP-00766'];
 const results=ids.map(id=>{
  const row=Number(id.slice(3))+1,r=sh.getRange(row,1,1,40).getValues()[0],p=P16_UNIFIED_V4.parse(r[21]);
  const raw=String(r[21]||'');
  const urls=[...raw.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  const got=p.related.map(a=>a.url);
  const bad=got.some(u=>!/^https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?$/.test(u));
  const reason=[];
  if(r[0]!==id||r[1]!=='ニュースの学校'||r[22])reason.push('ROW_STATE');
  if(p.holds.length)reason.push(...p.holds);
  if(bad||urls.length!==got.length||urls.join('|')!==got.join('|'))reason.push('ARTICLE_URL_COUNT_OR_MATCH');
  if(!p.w||urls.length<1||urls.length>3)reason.push('MANUAL_REVIEW');
  return {id,urlCountInV:urls.length,parsedCount:got.length,status:reason.length?'HOLD':'CANDIDATE',reasons:reason};
 });
 const result={mode:'READ_ONLY_STRICT',candidate:results.filter(r=>r.status==='CANDIDATE').length,held:results.filter(r=>r.status==='HOLD'),results,writes:0};
 console.log(JSON.stringify(result));return result;
}