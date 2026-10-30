/** Phase16 81 single-link candidates; compact read-only gate. Requires P16_NEWS_V5. */
function p16CheckSingle81ReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=["EP-00748","EP-00767","EP-00768","EP-00769","EP-00770","EP-00771","EP-00772","EP-00773","EP-00775","EP-00777","EP-00778","EP-00779","EP-00780","EP-00783","EP-00784","EP-00785","EP-00788","EP-00790","EP-00791","EP-00794","EP-00796","EP-00797","EP-00799","EP-00800","EP-00801","EP-00803","EP-00804","EP-00805","EP-00807","EP-00810","EP-00811","EP-00813","EP-00814","EP-00816","EP-00817","EP-00818","EP-00819","EP-00820","EP-00821","EP-00822","EP-00823","EP-00824","EP-00826","EP-00827","EP-00828","EP-00829","EP-00830","EP-00831","EP-00832","EP-00833","EP-00834","EP-00835","EP-00836","EP-00837","EP-00838","EP-00840","EP-00842","EP-00845","EP-00846","EP-00848","EP-00849","EP-00850","EP-00851","EP-00852","EP-00855","EP-00856","EP-00857","EP-00858","EP-00859","EP-00860","EP-00861","EP-00862","EP-00863","EP-00864","EP-00865","EP-00866","EP-00867","EP-00868","EP-00869","EP-00870","EP-00871"];
 const checks=ids.map(id=>{
  const rn=Number(id.slice(3))+1,row=sh.getRange(rn,1,1,55).getValues()[0];
  const flags=[],raw=String(row[21]||''),w=String(row[22]||''),am=String(row[38]??'').trim();
  if(row[0]!==id||row[1]!=='ニュースの学校')flags.push('IDENTITY');
  if(!raw||w)flags.push('SOURCE_OR_W');
  if(!['','未指定','FALSE','false','0','いいえ'].includes(am))flags.push('EXCLUDED');
  const out=P16_NEWS_V5.parse(raw);
  if(out.holds.length)flags.push(...out.holds);
  if(out.articles.length!==1)flags.push('ARTICLE_COUNT');
  const urls=[...raw.replace(/&nbsp;|&#160;/gi,' ').matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(x=>x[0]);
  if(urls.length!==1||out.articles.length!==1||out.articles[0].url!==urls[0]||!raw.includes(out.articles[0].title))flags.push('ARTICLE_PAIR');
  if(row[28]&&out.articles[0]&&String(row[28])!==out.articles[0].url)flags.push('AC_CONFLICT');
  if(out.w&&out.w.includes('【関連記事】')===false)flags.push('FORMAT');
  return {id,flags,wlen:out.w?out.w.length:0,needAC:!row[28]};
 });
 const pass=checks.filter(x=>x.flags.length===0),held=checks.filter(x=>x.flags.length>0);
 const result={mode:'READ_ONLY_SINGLE81',total:checks.length,passed:pass.length,held:held.length,passedIds:pass.map(x=>x.id),heldItems:held,writes:0};
 console.log(JSON.stringify(result));return result;
}

/** Append-only Phase16 checked 20. Re-run preview before any production write. */
function p16Single20Prepared_(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
 const ids=["EP-00767","EP-00768","EP-00769","EP-00770","EP-00771","EP-00772","EP-00773","EP-00777","EP-00778","EP-00779","EP-00780","EP-00783","EP-00784","EP-00785","EP-00788","EP-00790","EP-00794","EP-00796","EP-00797","EP-00858"];
 const rows=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0];
  if(String(r[0])!==id||r[1]!=='ニュースの学校'||!String(r[21]||'').trim()||String(r[22]||'').trim())throw Error('IDENTITY_OR_W_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  const p=P16_NEWS_V5.parse(r[21]);
  if(p.holds.length||!p.w||p.articles.length!==1)throw Error('PARSER_HOLD_'+id);
  const src=String(r[21]).replace(/&nbsp;|&#160;/gi,' ');
  const urls=[...src.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(urls.length!==1||p.articles[0].url!==urls[0]||!src.includes(p.articles[0].title))throw Error('ARTICLE_PAIR_'+id);
  if(!p.w.includes('\n【関連記事】\n')||!p.w.includes(p.articles[0].title+p.articles[0].url))throw Error('W_FORMAT_'+id);
  const ac=String(r[28]||'').trim();
  if(ac&&ac!==urls[0])throw Error('AC_CONFLICT_'+id);
  return {id,rn,r,w:p.w,ac:ac?'':urls[0]};
 });
 return {ss,sh,rows};
}
function p16PreviewSingle20Write(){
 const x=p16Single20Prepared_(),out={mode:'READ_ONLY_SINGLE20',episodes:x.rows.length,cells:x.rows.reduce((n,a)=>n+1+(a.ac?1:0),0),items:x.rows.map(a=>({id:a.id,row:a.rn,wLength:a.w.length,acWrite:!!a.ac})),writes:0};
 console.log(JSON.stringify(out));return out;
}
function p16WriteSingle20Approved(){
 if(PropertiesService.getScriptProperties().getProperty('P16_SINGLE20_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const {ss,sh,rows}=p16Single20Prepared_(),updated=[];
  for(const a of rows){
   const current=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(current[0]!==a.id||String(current[21])!==String(a.r[21])||String(current[22])!==String(a.r[22])||String(current[28]||'')!==String(a.r[28]||''))throw Error('CONCURRENT_ROW_CHANGE_'+a.id);
   const changes=[{col:23,value:a.w,why:'PHASE16_SINGLE20_W'}];
   if(a.ac)changes.push({col:29,value:a.ac,why:'PHASE16_SINGLE20_AC'});
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,current,changes,'P16_SINGLE20');
   if(!result.ok)throw Error('WRITE_FAILED_'+a.id);
   updated.push(a.id);
  }
  const out={mode:'WRITE_SINGLE20',updated,episodes:updated.length,cells:rows.reduce((n,a)=>n+1+(a.ac?1:0),0)};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}
