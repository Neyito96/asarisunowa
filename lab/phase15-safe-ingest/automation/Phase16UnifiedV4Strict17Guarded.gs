/** Phase16 reviewed next 20, isolated and guarded. Requires P16_UNIFIED_V4.
 * Default read-only. Writes only W, AC if empty and one canonical Asahi article.
 * Never changes V, existing W, existing AC, or excluded entries.
 */
var P16_STRICT17_IDS=['EP-00744','EP-00745','EP-00746','EP-00749','EP-00750','EP-00751','EP-00752','EP-00753','EP-00754','EP-00755','EP-00756','EP-00757','EP-00758','EP-00760','EP-00761','EP-00765','EP-00766'];
function p16Strict17Reviewed(mode){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const sh=ss.getSheetByName('エピソード台帳');
 function prepare(id){
  const rowNumber=Number(id.slice(3))+1;
  const row=sh.getRange(rowNumber,1,1,55).getValues()[0];
  if(String(row[0])!==id||String(row[1])!=='ニュースの学校')throw Error('IDENTITY_'+id);
  if(!String(row[21]||'').trim()||String(row[22]||'').trim())throw Error('SOURCE_OR_W_NOT_EMPTY_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(row[38]??'').trim()))throw Error('EXCLUDED_'+id);
  const parsed=P16_UNIFIED_V4.parse(row[21]);
  if(parsed.holds.length||!parsed.w||parsed.related.length!==1)throw Error('PARSER_HOLD_'+id+':'+parsed.holds.join(','));
  const a=parsed.related[0];
  if(!a.title||!/^https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[^\s]*)?$/.test(a.url)||!String(row[21]).includes(a.title)||!String(row[21]).includes(a.url))throw Error('ARTICLE_MISMATCH_'+id);
  const rawUrls=[...String(row[21]).matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(rawUrls.length!==1||rawUrls[0]!==a.url)throw Error('STRICT_URL_MISMATCH_'+id);
  if(String(row[28]||'').trim()&&String(row[28]).trim()!==a.url)throw Error('AC_CONFLICT_'+id);
  return {id,rowNumber,row,w:parsed.w,url:a.url,needAC:!String(row[28]||'').trim()};
 }
 if(mode!=='WRITE'){
  const records=P16_STRICT17_IDS.map(prepare);
  const out={mode:'READ_ONLY',count:records.length,plannedCells:records.reduce((n,r)=>n+1+(r.needAC?1:0),0),items:records.map(r=>({id:r.id,row:r.rowNumber,wLength:r.w.length,needAC:r.needAC,url:r.url})),writes:0};
  console.log(JSON.stringify(out));return out;
 }
 if(PropertiesService.getScriptProperties().getProperty('P16_STRICT17_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  // All 20 checked before the first write. Per-row rechecks before each write.
  const prepared=P16_STRICT17_IDS.map(prepare),written=[];
  for(const item of prepared){
   const live=prepare(item.id);
   if(String(live.row[21])!==String(item.row[21])||String(live.row[22])!==String(item.row[22])||live.needAC!==item.needAC)throw Error('CONCURRENT_ROW_CHANGE_'+item.id);
   const changes=[{col:23,value:item.w,why:'P16_UNIFIED_V4_REVIEWED_W'}];
   if(item.needAC)changes.push({col:29,value:item.url,why:'P16_UNIFIED_V4_REVIEWED_AC'});
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,item.rowNumber,live.row,changes,'P16_UNIFIED_V4_STRICT17');
   if(!result.ok)throw Error('WRITE_FAILED_'+item.id);
   written.push(item.id);
  }
  const out={mode:'WRITE',updated:written,episodes:written.length,cells:prepared.reduce((n,r)=>n+1+(r.needAC?1:0),0)};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}
function p16PreviewStrict17Reviewed(){return p16Strict17Reviewed('READ_ONLY');}
function p16WriteStrict17Reviewed(){return p16Strict17Reviewed('WRITE');}