/** Phase16 canonical W migration, exactly two pre-reviewed episodes.
 * Default READ_ONLY; explicit property P16_CANONICAL_2_APPROVED=YES required for write.
 * Existing W content reformat ONLY; V and AC untouched. One-time migration.
 */
function p16CanonicalTwo(mode) {
 const ids=['EP-00571','EP-00631'];
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const sh=ss.getSheetByName('エピソード台帳');
 const changes=[];
 for(const id of ids) {
  const rn=Number(id.slice(3))+1, row=sh.getRange(rn,1,1,55).getValues()[0];
  if(row[0]!==id||row[1]!=='ニュースの学校'||!String(row[22]||'').trim())throw Error('IDENTITY_OR_W_MISSING_'+id);
  const old=String(row[22]);
  const match=old.match(/^([\s\S]*?)\n\s*\n?【関連記事】\n([\s\S]+)$/);
  if(!match)throw Error('OLD_W_FORMAT_UNEXPECTED_'+id);
  const body=match[1].trim(),tail=match[2].trim();
  const lines=tail.split('\n').map(x=>x.trim()).filter(Boolean);
  if(lines.length!==2||!/^https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[^\s]*)?$/.test(lines[1]))
    throw Error('RELATED_PAIR_UNEXPECTED_'+id);
  if(String(row[28])!==lines[1])throw Error('AC_MISMATCH_'+id);
  const fresh=body+'\n【関連記事】\n'+lines[0]+lines[1];
  const oldWithoutFormat=old.replace(/\s+/g,'');
  const newWithoutFormat=fresh.replace(/\s+/g,'');
  if(oldWithoutFormat!==newWithoutFormat)throw Error('TEXT_CHANGED_'+id);
  changes.push({id,rn,row,old,fresh});
 }
 const output={mode:'READ_ONLY',items:changes.map(x=>({id:x.id,oldW:x.old,newW:x.fresh,changed:x.old!==x.fresh})),writes:0};
 if(mode!=='WRITE'){console.log(JSON.stringify(output));return output;}
 if(PropertiesService.getScriptProperties().getProperty('P16_CANONICAL_2_APPROVED')!=='YES')throw Error('P16_WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  P15_AUTO.assertOwner(ss);
  const written=[];
  for(const c of changes){
   const live=sh.getRange(c.rn,1,1,55).getValues()[0];
   if(live[0]!==c.id||live[6]!==c.row[6]||String(live[22])!==c.old)throw Error('CONCURRENT_CHANGE_'+c.id);
   if(c.old===c.fresh)continue;
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,c.rn,live,[{col:23,value:c.fresh,why:'PHASE16_CANONICAL_FORMAT_ONLY'}],'PHASE16_CANONICAL_2_REVIEWED');
   if(!result.ok)throw Error('WRITE_NOT_VERIFIED_'+c.id);
   written.push(c.id);
  }
  const result={mode:'WRITE',updated:written,writes:written.length};
  console.log(JSON.stringify(result));return result;
 }finally{lock.releaseLock();}
}
function p16PreviewCanonicalTwo(){return p16CanonicalTwo('READ_ONLY');}
function p16WriteCanonicalTwo(){return p16CanonicalTwo('WRITE');}
