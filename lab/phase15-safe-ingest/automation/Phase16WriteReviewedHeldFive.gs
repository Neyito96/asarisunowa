/** Phase16: one-shot audited backfill of five inspected held rows.
 * Requires p16TestCleanerV2HeldFive() from previous read-only script.
 * No trigger, no existing cell overwrite, unchanged V.
 */
function p16WriteReviewedHeldFive() {
 const ids=['EP-00571','EP-00574','EP-00605','EP-00631','EP-00713'];
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  P15_AUTO.assertOwner(ss);
  const sh=ss.getSheetByName('エピソード台帳');
  const previews=p16TestCleanerV2HeldFive();
  const out=[];
  for(const id of ids){
   const p=previews.find(x=>x.id===id);
   if(!p||!p.body||!p.body.trim()||p.articles.length!==(id==='EP-00574'?0:1))
     throw Error('PREVIEW_NOT_APPROVED_'+id);
   if(p.holds.some(x=>x!=='ARTICLE_COUNT_0')||(p.holds.includes('ARTICLE_COUNT_0')&&id!=='EP-00574'))
     throw Error('HOLD_'+id);
   const a=p.articles[0];
   if(a&&(!a.title||!/^https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[^\s]*)?$/.test(a.url)))
     throw Error('ARTICLE_IDENTITY_'+id);
   const rn=Number(id.slice(3))+1;
   const row=sh.getRange(rn,1,1,55).getValues()[0];
   if(row[0]!==id||row[1]!=='ニュースの学校'||!row[6]||!String(row[21]||'').trim())
     throw Error('ROW_IDENTITY_'+id);
   if(String(row[22]||'').trim()||(a&&String(row[28]||'').trim()))
     throw Error('ALREADY_FILLED_'+id);
   if(a&&!String(row[21]).includes(a.url))throw Error('SOURCE_URL_MISSING_'+id);
   const w=p.body+(a?'\n\n【関連記事】\n'+a.title+'\n'+a.url:'');
   const changes=[{col:23,value:w,why:'PHASE16_REVIEWED_HELD_W'}];
   if(a)changes.push({col:29,value:a.url,why:'PHASE16_REVIEWED_HELD_AC'});
   const written=PHASE15_INTEGRATED.writeRow(ss,sh,rn,row,changes,'PHASE16_V2_HELD_FIVE_REVIEWED');
   if(!written.ok)throw Error('WRITE_BLOCKED_'+id+'_'+written.why);
   const check=sh.getRange(rn,1,1,29).getValues()[0];
   if(check[22]!==w||(a&&check[28]!==a.url))throw Error('VERIFY_FAILED_'+id);
   out.push({id,w:true,ac:!!a});
  }
  console.log(JSON.stringify({mode:'P16_HELD_FIVE_WRITE',episodes:out.length,cells:out.reduce((n,x)=>n+1+Number(x.ac),0),results:out}));
  return out;
 }finally{lock.releaseLock();}
}
