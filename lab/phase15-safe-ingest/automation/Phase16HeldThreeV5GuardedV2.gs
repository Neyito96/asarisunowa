/** Phase16 V5 held three guarded W backfill. Requires P16_NEWS_V5.
 * AC: one URL only when there is exactly one article; multi-article AC untouched.
 * V untouched. Explicit approval property required.
 */
const P16_HELD3_IDS=['EP-00747','EP-00763','EP-00764'];
function p16Held3ReviewedV2(mode){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const sh=ss.getSheetByName('エピソード台帳');
 function prepare(id){
  const rn=Number(id.slice(3))+1, r=sh.getRange(rn,1,1,55).getValues()[0];
  if(String(r[0])!==id||String(r[1])!=='ニュースの学校')throw Error('IDENTITY_'+id);
  if(!String(r[21]||'').trim()||String(r[22]||'').trim())throw Error('SOURCE_OR_W_NOT_EMPTY_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  const p=P16_NEWS_V5.parse(r[21]);
  const expected=id==='EP-00764'?2:1;
  if(p.holds.length||!p.w||p.articles.length!==expected)throw Error('PARSER_HOLD_'+id);
  const normalizedSource=String(r[21]).replace(/&nbsp;|&#160;/gi,' ');\n  const rawUrls=[...normalizedSource.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(rawUrls.length!==expected||rawUrls.some((url,i)=>p.articles[i].url!==url||!normalizedSource.includes(p.articles[i].title)))throw Error('ARTICLE_PAIR_MISMATCH_'+id);
  const ac=String(r[28]||'').trim();
  if(expected===1&&ac&&ac!==p.articles[0].url)throw Error('AC_CONFLICT_'+id);
  if(expected===2&&ac)throw Error('MULTI_AC_REVIEW_'+id);
  return {id,rn,r,w:p.w,articleCount:expected,acWrite:expected===1&&!ac?p.articles[0].url:null};
 }
 if(mode!=='WRITE'){
  const items=P16_HELD3_IDS.map(prepare);
  const o={mode:'READ_ONLY',episodes:items.length,cells:items.reduce((n,x)=>n+1+(x.acWrite?1:0),0),items:items.map(x=>({id:x.id,row:x.rn,articles:x.articleCount,wLength:x.w.length,acWrite:!!x.acWrite})),writes:0};
  console.log(JSON.stringify(o));return o;
 }
 if(PropertiesService.getScriptProperties().getProperty('P16_HELD3_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const items=P16_HELD3_IDS.map(prepare),updated=[];
  for(const item of items){
   const live=prepare(item.id);
   if(String(live.r[21])!==String(item.r[21])||String(live.r[22])!==String(item.r[22]))throw Error('CONCURRENT_ROW_CHANGE_'+item.id);
   const changes=[{col:23,value:item.w,why:'PHASE16_HELD3_V5_W'}];
   if(item.acWrite)changes.push({col:29,value:item.acWrite,why:'PHASE16_HELD3_V5_AC'});
   const z=PHASE15_INTEGRATED.writeRow(ss,sh,item.rn,live.r,changes,'P16_HELD3_V5');
   if(!z.ok)throw Error('WRITE_FAILED_'+item.id);
   updated.push(item.id);
  }
  const out={mode:'WRITE',updated,episodes:updated.length,cells:items.reduce((n,x)=>n+1+(x.acWrite?1:0),0)};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}
function p16PreviewHeld3ReviewedV2(){return p16Held3ReviewedV2('READ_ONLY');}
function p16WriteHeld3ReviewedV2(){return p16Held3ReviewedV2('WRITE');}