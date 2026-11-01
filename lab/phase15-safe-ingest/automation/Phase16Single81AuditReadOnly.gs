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


/** Phase16 V6 61 held cases: read-only rerun; strip only recognized promotional lines. */
function p16AuditHeld61PromoReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=["EP-00748","EP-00775","EP-00791","EP-00799","EP-00800","EP-00801","EP-00803","EP-00804","EP-00805","EP-00807","EP-00810","EP-00811","EP-00813","EP-00814","EP-00816","EP-00817","EP-00818","EP-00819","EP-00820","EP-00821","EP-00822","EP-00823","EP-00824","EP-00826","EP-00827","EP-00828","EP-00829","EP-00830","EP-00831","EP-00832","EP-00833","EP-00834","EP-00835","EP-00836","EP-00837","EP-00838","EP-00840","EP-00842","EP-00845","EP-00846","EP-00848","EP-00849","EP-00850","EP-00851","EP-00852","EP-00855","EP-00856","EP-00857","EP-00859","EP-00860","EP-00861","EP-00862","EP-00863","EP-00864","EP-00865","EP-00866","EP-00867","EP-00868","EP-00869","EP-00870","EP-00871"];
 const results=ids.map(id=>{
  const n=Number(id.slice(3))+1,r=sh.getRange(n,1,1,55).getValues()[0],flags=[];
  const raw=String(r[21]||'');
  if(r[0]!==id||r[1]!=='ニュースの学校'||!raw.trim()||String(r[22]||'').trim())flags.push('ROW_SOURCE_OR_W');
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))flags.push('EXCLUDED');
  const lines=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').split('\n');
  const kept=lines.filter(line=>{
   const t=line.trim();
   return !/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(t);
  });
  const p=P16_NEWS_V5.parse(kept.join('\n'));
  if(p.holds.length)flags.push(...p.holds);
  if(p.articles.length!==1)flags.push('ARTICLE_COUNT');
  const urls=[...raw.replace(/&nbsp;|&#160;/gi,' ').matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(urls.length!==1||!p.articles[0]||p.articles[0].url!==urls[0]||!raw.includes(p.articles[0].title))flags.push('ARTICLE_PAIR');
  if(r[28]&&p.articles[0]&&String(r[28])!==p.articles[0].url)flags.push('AC_CONFLICT');
  if(p.w&&(!p.w.includes('\n【関連記事】\n')||!p.w.includes(p.articles[0].title+p.articles[0].url)))flags.push('W_FORMAT');
  return {id,flags,previewLength:p.w?p.w.length:0};
 });
 const passed=results.filter(x=>!x.flags.length),held=results.filter(x=>x.flags.length);
 const out={mode:'READ_ONLY_HELD61_V6',total:ids.length,passed:passed.length,held:held.length,passedIds:passed.map(x=>x.id),heldItems:held,writes:0};
 console.log(JSON.stringify(out));return out;
}


/** Phase16 V6 passed batch 1/3: guarded 20-row writer. */
function p16V6Batch1Prepare_(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
 const ids=["EP-00748","EP-00791","EP-00799","EP-00801","EP-00803","EP-00804","EP-00805","EP-00807","EP-00810","EP-00811","EP-00813","EP-00814","EP-00816","EP-00817","EP-00818","EP-00819","EP-00820","EP-00821","EP-00822","EP-00823"];
 const rows=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0],raw=String(r[21]||'');
  if(String(r[0])!==id||r[1]!=='ニュースの学校'||!raw.trim()||String(r[22]||'').trim())throw Error('ROW_SOURCE_OR_W_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  const lines=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').split('\n');
  const kept=lines.filter(line=>!/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(line.trim()));
  const p=P16_NEWS_V5.parse(kept.join('\n'));
  if(p.holds.length||!p.w||p.articles.length!==1)throw Error('PARSER_HOLD_'+id);
  const src=raw.replace(/&nbsp;|&#160;/gi,' ');
  const urls=[...src.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(urls.length!==1||p.articles[0].url!==urls[0]||!src.includes(p.articles[0].title))throw Error('ARTICLE_PAIR_'+id);
  if(!p.w.includes('\n【関連記事】\n')||!p.w.includes(p.articles[0].title+p.articles[0].url))throw Error('W_FORMAT_'+id);
  const ac=String(r[28]||'').trim();
  if(ac&&ac!==urls[0])throw Error('AC_CONFLICT_'+id);
  return {id,rn,r,w:p.w,ac:ac?'':urls[0]};
 });
 return {ss,sh,rows};
}
function p16PreviewV6Batch1(){
 const x=p16V6Batch1Prepare_();
 const out={mode:'READ_ONLY_V6_BATCH1',episodes:x.rows.length,cells:x.rows.reduce((n,a)=>n+1+(a.ac?1:0),0),writes:0,ids:x.rows.map(a=>a.id)};
 console.log(JSON.stringify(out));return out;
}
function p16WriteV6Batch1(){
 if(PropertiesService.getScriptProperties().getProperty('P16_V6_BATCH1_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const {ss,sh,rows}=p16V6Batch1Prepare_(),updated=[];
  for(const a of rows){
   const live=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(String(live[0])!==a.id||String(live[21])!==String(a.r[21])||String(live[22]||'')!==String(a.r[22]||'')||String(live[28]||'')!==String(a.r[28]||''))throw Error('CONCURRENT_ROW_CHANGE_'+a.id);
   const changes=[{col:23,value:a.w,why:'P16_V6_BATCH1_W'}];
   if(a.ac)changes.push({col:29,value:a.ac,why:'P16_V6_BATCH1_AC'});
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,live,changes,'P16_V6_BATCH1');
   if(!result.ok)throw Error('WRITE_FAILED_'+a.id);
   updated.push(a.id);
  }
  const out={mode:'WRITE_V6_BATCH1',updated,episodes:updated.length,cells:rows.reduce((n,a)=>n+1+(a.ac?1:0),0)};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}

/** Phase16 V6 passed batch 2/3: guarded 20-row writer. */
function p16V6Batch2Prepare_(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
 const ids=["EP-00824","EP-00826","EP-00827","EP-00828","EP-00829","EP-00830","EP-00831","EP-00832","EP-00833","EP-00834","EP-00835","EP-00836","EP-00837","EP-00838","EP-00840","EP-00842","EP-00845","EP-00846","EP-00848","EP-00849"];
 const rows=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0],raw=String(r[21]||'');
  if(String(r[0])!==id||r[1]!=='ニュースの学校'||!raw.trim()||String(r[22]||'').trim())throw Error('ROW_SOURCE_OR_W_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  const lines=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').split('\n');
  const kept=lines.filter(line=>!/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(line.trim()));
  const p=P16_NEWS_V5.parse(kept.join('\n'));
  if(p.holds.length||!p.w||p.articles.length!==1)throw Error('PARSER_HOLD_'+id);
  const src=raw.replace(/&nbsp;|&#160;/gi,' ');
  const urls=[...src.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(urls.length!==1||p.articles[0].url!==urls[0]||!src.includes(p.articles[0].title))throw Error('ARTICLE_PAIR_'+id);
  if(!p.w.includes('\n【関連記事】\n')||!p.w.includes(p.articles[0].title+p.articles[0].url))throw Error('W_FORMAT_'+id);
  const ac=String(r[28]||'').trim();
  if(ac&&ac!==urls[0])throw Error('AC_CONFLICT_'+id);
  return {id,rn,r,w:p.w,ac:ac?'':urls[0]};
 });
 return {ss,sh,rows};
}
function p16PreviewV6Batch2(){
 const x=p16V6Batch2Prepare_();
 const out={mode:'READ_ONLY_V6_BATCH2',episodes:x.rows.length,cells:x.rows.reduce((n,a)=>n+1+(a.ac?1:0),0),writes:0,ids:x.rows.map(a=>a.id)};
 console.log(JSON.stringify(out));return out;
}
function p16WriteV6Batch2(){
 if(PropertiesService.getScriptProperties().getProperty('P16_V6_BATCH2_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const {ss,sh,rows}=p16V6Batch2Prepare_(),updated=[];
  for(const a of rows){
   const live=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(String(live[0])!==a.id||String(live[21])!==String(a.r[21])||String(live[22]||'')!==String(a.r[22]||'')||String(live[28]||'')!==String(a.r[28]||''))throw Error('CONCURRENT_ROW_CHANGE_'+a.id);
   const changes=[{col:23,value:a.w,why:'P16_V6_BATCH2_W'}];
   if(a.ac)changes.push({col:29,value:a.ac,why:'P16_V6_BATCH2_AC'});
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,live,changes,'P16_V6_BATCH2');
   if(!result.ok)throw Error('WRITE_FAILED_'+a.id);
   updated.push(a.id);
  }
  const out={mode:'WRITE_V6_BATCH2',updated,episodes:updated.length,cells:rows.reduce((n,a)=>n+1+(a.ac?1:0),0)};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}

/** Phase16 V6 passed batch 3/3: guarded 20-row writer. */
function p16V6Batch3Prepare_(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
 const ids=["EP-00850","EP-00851","EP-00852","EP-00855","EP-00856","EP-00857","EP-00859","EP-00860","EP-00861","EP-00862","EP-00863","EP-00864","EP-00866","EP-00867","EP-00868","EP-00869","EP-00870","EP-00871"];
 const rows=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0],raw=String(r[21]||'');
  if(String(r[0])!==id||r[1]!=='ニュースの学校'||!raw.trim()||String(r[22]||'').trim())throw Error('ROW_SOURCE_OR_W_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  const lines=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').split('\n');
  const kept=lines.filter(line=>!/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(line.trim()));
  const p=P16_NEWS_V5.parse(kept.join('\n'));
  if(p.holds.length||!p.w||p.articles.length!==1)throw Error('PARSER_HOLD_'+id);
  const src=raw.replace(/&nbsp;|&#160;/gi,' ');
  const urls=[...src.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(urls.length!==1||p.articles[0].url!==urls[0]||!src.includes(p.articles[0].title))throw Error('ARTICLE_PAIR_'+id);
  if(!p.w.includes('\n【関連記事】\n')||!p.w.includes(p.articles[0].title+p.articles[0].url))throw Error('W_FORMAT_'+id);
  const ac=String(r[28]||'').trim();
  if(ac&&ac!==urls[0])throw Error('AC_CONFLICT_'+id);
  return {id,rn,r,w:p.w,ac:ac?'':urls[0]};
 });
 return {ss,sh,rows};
}
function p16PreviewV6Batch3(){
 const x=p16V6Batch3Prepare_();
 const out={mode:'READ_ONLY_V6_BATCH3',episodes:x.rows.length,cells:x.rows.reduce((n,a)=>n+1+(a.ac?1:0),0),writes:0,ids:x.rows.map(a=>a.id)};
 console.log(JSON.stringify(out));return out;
}
function p16WriteV6Batch3(){
 if(PropertiesService.getScriptProperties().getProperty('P16_V6_BATCH3_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const {ss,sh,rows}=p16V6Batch3Prepare_(),updated=[];
  for(const a of rows){
   const live=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(String(live[0])!==a.id||String(live[21])!==String(a.r[21])||String(live[22]||'')!==String(a.r[22]||'')||String(live[28]||'')!==String(a.r[28]||''))throw Error('CONCURRENT_ROW_CHANGE_'+a.id);
   const changes=[{col:23,value:a.w,why:'P16_V6_BATCH3_W'}];
   if(a.ac)changes.push({col:29,value:a.ac,why:'P16_V6_BATCH3_AC'});
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,live,changes,'P16_V6_BATCH3');
   if(!result.ok)throw Error('WRITE_FAILED_'+a.id);
   updated.push(a.id);
  }
  const out={mode:'WRITE_V6_BATCH3',updated,episodes:updated.length,cells:rows.reduce((n,a)=>n+1+(a.ac?1:0),0)};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}



/** Multi-article Phase16: strict READ_ONLY audit for 27 remaining News School IDs. */
function p16AuditRemainingMulti27(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=["EP-00741","EP-00759","EP-00762","EP-00774","EP-00776","EP-00781","EP-00786","EP-00787","EP-00789","EP-00792","EP-00793","EP-00795","EP-00798","EP-00802","EP-00806","EP-00808","EP-00809","EP-00812","EP-00815","EP-00825","EP-00839","EP-00841","EP-00843","EP-00844","EP-00847","EP-00853","EP-00854"];
 const result=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0],raw=String(r[21]||'');
  const flags=[];
  if(r[0]!==id||r[1]!=='ニュースの学校'||!raw||String(r[22]||'').trim())flags.push('IDENTITY_OR_W');
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))flags.push('EXCLUDED');
  const lines=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').split('\n');
  const clean=lines.filter(line=>!/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(line.trim())).join('\n');
  const p=P16_NEWS_V5.parse(clean);
  flags.push(...p.holds);
  const urls=[...raw.replace(/&nbsp;|&#160;/gi,' ').matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(urls.length<2||urls.length!==p.articles.length||urls.some((u,i)=>p.articles[i].url!==u||!raw.includes(p.articles[i].title)))flags.push('ARTICLE_PAIR');
  if(String(r[28]||'').trim())flags.push('AC_PRESENT_MULTI');
  if(p.w&&(!p.w.includes('\n【関連記事】\n')||p.articles.some(a=>!p.w.includes(a.title+a.url))))flags.push('W_FORMAT');
  return {id,links:urls.length,flags:[...new Set(flags)],wLength:p.w?p.w.length:0};
 });
 const passed=result.filter(x=>!x.flags.length),held=result.filter(x=>x.flags.length);
 const out={mode:'READ_ONLY_MULTI27',total:result.length,passed:passed.length,held:held.length,passedItems:passed,heldItems:held,writes:0};
 console.log(JSON.stringify(out));return out;
}

/** Multi-article W-only 1 writer. Requires P16_NEWS_V5 and PHASE15_INTEGRATED. */
function p16MultiBatch1Prepare_(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
 const ids=["EP-00741","EP-00759","EP-00762","EP-00774","EP-00776","EP-00781","EP-00786","EP-00787","EP-00789","EP-00792","EP-00793","EP-00795","EP-00798","EP-00802"];
 const items=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0],raw=String(r[21]||'');
  if(r[0]!==id||r[1]!=='ニュースの学校'||!raw.trim()||String(r[22]||'').trim())throw Error('IDENTITY_OR_W_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  if(String(r[28]||'').trim())throw Error('AC_PRESENT_MULTI_'+id);
  const src=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ');
  const clean=src.split('\n').filter(line=>!/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(line.trim())).join('\n');
  const p=P16_NEWS_V5.parse(clean);
  const urls=[...src.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(p.holds.length||!p.w||urls.length<2||urls.length!==p.articles.length)throw Error('PARSER_HOLD_'+id);
  if(urls.some((u,k)=>p.articles[k].url!==u||!src.includes(p.articles[k].title)))throw Error('ARTICLE_PAIR_'+id);
  if(!p.w.includes('\n【関連記事】\n')||p.articles.some(a=>!p.w.includes(a.title+a.url)))throw Error('W_FORMAT_'+id);
  return {id,rn,r,w:p.w,articles:urls.length};
 });
 return {ss,sh,items};
}
function p16PreviewMultiBatch1(){
 const {items}=p16MultiBatch1Prepare_();
 const out={mode:'READ_ONLY_MULTI_BATCH1',episodes:items.length,cells:items.length,ids:items.map(a=>a.id),writes:0};
 console.log(JSON.stringify(out));return out;
}
function p16WriteMultiBatch1(){
 if(PropertiesService.getScriptProperties().getProperty('P16_MULTI_BATCH1_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const {ss,sh,items}=p16MultiBatch1Prepare_(),updated=[];
  for(const a of items){
   const live=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(String(live[0])!==a.id||String(live[21])!==String(a.r[21])||String(live[22]||'')!==String(a.r[22]||'')||String(live[28]||'')!==String(a.r[28]||''))throw Error('CONCURRENT_ROW_CHANGE_'+a.id);
   const z=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,live,[{col:23,value:a.w,why:'P16_MULTI_BATCH1_W'}],'P16_MULTI_BATCH1');
   if(!z.ok)throw Error('WRITE_FAILED_'+a.id);
   updated.push(a.id);
  }
  const out={mode:'WRITE_MULTI_BATCH1',episodes:updated.length,cells:updated.length,updated};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}

/** Multi-article W-only 2 writer. Requires P16_NEWS_V5 and PHASE15_INTEGRATED. */
function p16MultiBatch2Prepare_(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
 const ids=["EP-00806","EP-00808","EP-00809","EP-00812","EP-00815","EP-00825","EP-00839","EP-00841","EP-00843","EP-00844","EP-00847","EP-00853","EP-00854"];
 const items=ids.map(id=>{
  const rn=Number(id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0],raw=String(r[21]||'');
  if(r[0]!==id||r[1]!=='ニュースの学校'||!raw.trim()||String(r[22]||'').trim())throw Error('IDENTITY_OR_W_'+id);
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+id);
  if(String(r[28]||'').trim())throw Error('AC_PRESENT_MULTI_'+id);
  const src=raw.replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ');
  const clean=src.split('\n').filter(line=>!/^(ご意見[・、]?|ほかにも多彩な番組を配信中！|See omnystudio|Learn more about your ad choices)/i.test(line.trim())).join('\n');
  const p=P16_NEWS_V5.parse(clean);
  const urls=[...src.matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(m=>m[0]);
  if(p.holds.length||!p.w||urls.length<2||urls.length!==p.articles.length)throw Error('PARSER_HOLD_'+id);
  if(urls.some((u,k)=>p.articles[k].url!==u||!src.includes(p.articles[k].title)))throw Error('ARTICLE_PAIR_'+id);
  if(!p.w.includes('\n【関連記事】\n')||p.articles.some(a=>!p.w.includes(a.title+a.url)))throw Error('W_FORMAT_'+id);
  return {id,rn,r,w:p.w,articles:urls.length};
 });
 return {ss,sh,items};
}
function p16PreviewMultiBatch2(){
 const {items}=p16MultiBatch2Prepare_();
 const out={mode:'READ_ONLY_MULTI_BATCH2',episodes:items.length,cells:items.length,ids:items.map(a=>a.id),writes:0};
 console.log(JSON.stringify(out));return out;
}
function p16WriteMultiBatch2(){
 if(PropertiesService.getScriptProperties().getProperty('P16_MULTI_BATCH2_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const {ss,sh,items}=p16MultiBatch2Prepare_(),updated=[];
  for(const a of items){
   const live=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(String(live[0])!==a.id||String(live[21])!==String(a.r[21])||String(live[22]||'')!==String(a.r[22]||'')||String(live[28]||'')!==String(a.r[28]||''))throw Error('CONCURRENT_ROW_CHANGE_'+a.id);
   const z=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,live,[{col:23,value:a.w,why:'P16_MULTI_BATCH2_W'}],'P16_MULTI_BATCH2');
   if(!z.ok)throw Error('WRITE_FAILED_'+a.id);
   updated.push(a.id);
  }
  const out={mode:'WRITE_MULTI_BATCH2',episodes:updated.length,cells:updated.length,updated};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}


/** Final five: editorially reviewed literal W values; audit-only, NO writer. */
function p16PreviewFinalFiveReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const cases=[{"id":"EP-00782","show":"ニュースの学校","w":"国は公立高校にも私立高校にも授業料の支援をしていますが、世帯年収に制限をつけています。公立の授業料の場合は世帯年収が910万円未満なら年11万8800円を支援し、私立の授業料の場合は世帯年収が590万円以上910万円未満では公立と同じ11万8800円を支援し、世帯年収が590万円未満なら39万6千円の支援をしています。\n【関連記事】\n高校授業料無償化が国会で議論に → 無償化はいいの？ 悪いの？https://www.asahi.com/edua/article/15612560","ac":"https://www.asahi.com/edua/article/15612560"},{"id":"EP-00800","show":"ニュースの学校","w":"ファクトチェックは、偽情報の疑いがある文章や写真などについて、情報源への聞き取りや、写真・動画を分析することで真偽や正確さを審査する作業のことです。アメリカのメタ社は2016年から外部のファクトチェック団体に依頼し、60以上の言語で約100団体が参加していました。\n【関連記事】\n【そもそも解説】メタがやめるファクトチェックとは　新機能を導入へhttps://www.asahi.com/articles/AST183VZRT18ULFA01GM.html?iref=omny\n熊本地震のライオンデマ、画像をたどったら南アフリカに撮影者がいたhttps://withnews.jp/article/f0181108000qq000000000000000W0al10101qq000018248A","ac":""},{"id":"EP-00865","show":"ニュースの学校","w":"アメリカ大統領選は、各州と首都ワシントンに割り当てられた538人の「選挙人」の過半数を取った候補が勝利します。まず有権者が投票し、大半の州で、1票でも多く得た候補がその州の選挙人を総取りする方式です。\n【関連記事】\nアメリカ大統領の決め方（イラストで解説）https://www.asahi.com/special/visual/us-election1/?iref=omny\n（いちからわかる！）アメリカ大統領選、どんな仕組み？https://www.asahi.com/articles/DA3S14683886.html?iref=omny","ac":""},{"id":"EP-00884","show":"報談","w":"アメリカのトランプ政権は、国際法を無視し、イスラエルとともにイランを攻撃しました。ところで「国際法」とは、いったい何なのか。リスナーさんの質問に答えます。\n※2026年5月20日に収録しました。","ac":""},{"id":"EP-01223","show":"ドーナツ","w":"発達障害、うつ病などの精神障害、知的障害、身体障害など、障害がある人向けのマッチングアプリがあります。互いに障害があった方がわかり合える、安心感があると好評で、当事者にとっては良いことである一方、サポートする側に回ったときどうなってしまうのか。そんな話題です。\n※2026年10月7日に収録しました\n【関連記事】\n発達障害打ち明けたら…音信不通に　「もう隠さない」恋愛、アプリでhttps://www.asahi.com/articles/ASVB50H3YVB5ULLI004M.html","ac":"https://www.asahi.com/articles/ASVB50H3YVB5ULLI004M.html"}];
 const results=cases.map(c=>{
  const row=Number(c.id.slice(3))+1,r=sh.getRange(row,1,1,55).getValues()[0],raw=String(r[21]||'').replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').replace(/&hellip;/gi,'…');
  const flags=[];
  if(r[0]!==c.id||r[1]!==c.show||String(r[22]||'').trim())flags.push('IDENTITY_OR_W');
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))flags.push('EXCLUDED');
  const parts=c.w.split('\n【関連記事】\n'),body=parts[0].split('\n');
  for(const text of body){if(text.trim()&&!raw.includes(text.trim()))flags.push('BODY_NOT_IN_RAW');}
  if(parts[1])for(const line of parts[1].split('\n')){
   const link=line.match(/https?:\/\/\S+/);
   if(!link||!raw.includes(link[0])||!raw.includes(line.slice(0,link.index)))flags.push('ARTICLE_NOT_IN_RAW');
  }
  if(c.ac&&String(r[28]||'').trim()&&String(r[28])!==c.ac)flags.push('AC_CONFLICT');
  if(!c.ac&&String(r[28]||'').trim())flags.push('AC_PRESENT_REVIEW');
  return {id:c.id,row,flags:[...new Set(flags)],w:c.w,acWrite:!!c.ac&&!r[28]};
 });
 const out={mode:'READ_ONLY_FINAL5',episodes:results.length,passed:results.filter(r=>!r.flags.length).length,items:results,writes:0};
 console.log(JSON.stringify(out));return out;
}


/** User reviewed six cases 2026-11-01. READ_ONLY; AC multi-URLs separated by newline. */
function p16PreviewUserApprovedSix(){
 const cases=[{"id":"EP-00775","show":"ニュースの学校","body":"毎年1回、1月に開かれる通常国会では、首相が施政方針演説をするのがならわしになっています。これに対して、各党の代表者が首相の考えや政治姿勢を問うのが代表質問です。国会での本格論戦のスタートに位置づけられています。","arts":[["【そもそも解説】与野党の党首がぶつかる「代表質問」って何？","https://www.asahi.com/articles/AST1W1GLCT1WUTFK01KM.html?iref=omny"]],"extra":"【関連エピソード】\n【ニュースの学校】予算委員会https://bit.ly/43idkHk"},{"id":"EP-00782","show":"ニュースの学校","body":"国は公立高校にも私立高校にも授業料の支援をしていますが、世帯年収に制限をつけています。公立の授業料の場合は世帯年収が910万円未満なら年11万8800円を支援し、私立の授業料の場合は世帯年収が590万円以上910万円未満では公立と同じ11万8800円を支援し、世帯年収が590万円未満なら39万6千円の支援をしています。","arts":[["高校授業料無償化が国会で議論に → 無償化はいいの？ 悪いの？","https://www.asahi.com/edua/article/15612560"]]},{"id":"EP-00800","show":"ニュースの学校","body":"ファクトチェックは、偽情報の疑いがある文章や写真などについて、情報源への聞き取りや、写真・動画を分析することで真偽や正確さを審査する作業のことです。アメリカのメタ社は2016年から外部のファクトチェック団体に依頼し、60以上の言語で約100団体が参加していました。","arts":[["【そもそも解説】メタがやめるファクトチェックとは　新機能を導入へ","https://www.asahi.com/articles/AST183VZRT18ULFA01GM.html?iref=omny"],["熊本地震のライオンデマ、画像をたどったら南アフリカに撮影者がいた","https://withnews.jp/article/f0181108000qq000000000000000W0al10101qq000018248A"]]},{"id":"EP-00865","show":"ニュースの学校","body":"アメリカ大統領選は、各州と首都ワシントンに割り当てられた538人の「選挙人」の過半数を取った候補が勝利します。まず有権者が投票し、大半の州で、1票でも多く得た候補がその州の選挙人を総取りする方式です。","arts":[["アメリカ大統領の決め方（イラストで解説）","https://www.asahi.com/special/visual/us-election1/?iref=omny"],["（いちからわかる！）アメリカ大統領選、どんな仕組み？","https://www.asahi.com/articles/DA3S14683886.html?iref=omny"]]},{"id":"EP-00884","show":"報談","body":"アメリカのトランプ政権は、国際法を無視し、イスラエルとともにイランを攻撃しました。ところで「国際法」とは、いったい何なのか。リスナーさんの質問に答えます。","date":"※2026年5月20日に収録しました。","arts":[]},{"id":"EP-01223","show":"ドーナツ","body":"発達障害、うつ病などの精神障害、知的障害、身体障害など、障害がある人向けのマッチングアプリがあります。互いに障害があった方がわかり合える、安心感があると好評で、当事者にとっては良いことである一方、サポートする側に回ったときどうなってしまうのか。そんな話題です。","date":"※2026年10月7日に収録しました","arts":[["発達障害打ち明けたら…音信不通に　「もう隠さない」恋愛、アプリで","https://www.asahi.com/articles/ASVB50H3YVB5ULLI004M.html"]]}];
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const items=cases.map(c=>{
   const n=Number(c.id.slice(3))+1,r=sh.getRange(n,1,1,55).getValues()[0],flags=[];
   const src=String(r[21]||'').replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ').replace(/&hellip;/gi,'…').replace(/<[^>]+>/g,'');
   if(String(r[0])!==c.id||r[1]!==c.show||!src.trim()||String(r[22]||'').trim())flags.push('ID_SOURCE_OR_W');
   if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))flags.push('EXCLUDED');
   if(!src.includes(c.body)&&c.id!=='EP-00775')flags.push('BODY_MISMATCH');
   if(c.id==='EP-00775'&&!src.includes('各党の代表者が首相の考えや政治姿勢を党のが代表質問です'))flags.push('CORRECTION_SOURCE_CHANGED');
   if(c.date&&!src.includes(c.date))flags.push('DATE_MISMATCH');
   for(const a of c.arts){if(!src.includes(a[0])||!src.includes(a[1]))flags.push('ARTICLE_MISMATCH');}
   if(c.extra&&(!src.includes('【ニュースの学校】予算委員会')||!src.includes('https://bit.ly/43idkHk')))flags.push('EXTRA_MISMATCH');
   const w=c.body+(c.date?'\n'+c.date:'')+(c.arts.length?'\n【関連記事】\n'+c.arts.map(a=>a[0]+a[1]).join('\n'):'')+(c.extra?'\n'+c.extra:'');
   const ac=c.arts.map(a=>a[1]).join('\n');
   if(String(r[28]||'').trim()&&String(r[28]).trim()!==ac)flags.push('AC_CONFLICT');
   return {id:c.id,flags:[...new Set(flags)],w,ac,acUrlCount:c.arts.length};
 });
 const out={mode:'READ_ONLY_USER_SIX',total:items.length,passed:items.filter(x=>!x.flags.length).length,plannedCells:items.reduce((n,x)=>n+1+(x.ac?1:0),0),items,writes:0,held:'EP-01222'};
 console.log(JSON.stringify(out));return out;
}


/** Guarded write of six explicitly reviewed cases. Run preview first. Does not touch EP-01222. */
function p16WriteUserApprovedSix(){
 if(PropertiesService.getScriptProperties().getProperty('P16_USER_SIX_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  const preview=p16PreviewUserApprovedSix();
  if(preview.total!==6||preview.passed!==6||preview.plannedCells!==11||preview.items.some(x=>x.flags.length))throw Error('PREVIEW_NOT_ALL_PASSED');
  const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=ss.getSheetByName('エピソード台帳');
  const prepared=preview.items.map(item=>{
   const rn=Number(item.id.slice(3))+1,r=sh.getRange(rn,1,1,55).getValues()[0];
   if(r[0]!==item.id||!String(r[21]||'').trim()||String(r[22]||'').trim()||String(r[28]||'').trim())throw Error('CHANGED_ROW_'+item.id);
   if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))throw Error('EXCLUDED_'+item.id);
   const acUrls=item.ac?item.ac.split('\n'):[];
   if(acUrls.length!==item.acUrlCount||acUrls.some(u=>!/^https:\/\/\S+$/.test(u)||!item.w.includes(u)))throw Error('AC_URL_INVALID_'+item.id);
   return {item,rn,r};
  });
  const updated=[];
  for(const a of prepared){
   const live=sh.getRange(a.rn,1,1,55).getValues()[0];
   if(JSON.stringify(live)!==JSON.stringify(a.r))throw Error('CONCURRENT_ROW_CHANGE_'+a.item.id);
   const changes=[{col:23,value:a.item.w,why:'P16_USER_REVIEWED_W'}];
   if(a.item.ac)changes.push({col:29,value:a.item.ac,why:'P16_USER_REVIEWED_AC'});
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,a.rn,live,changes,'P16_USER_REVIEWED_SIX');
   if(!result.ok)throw Error('WRITE_FAILED_'+a.item.id);
   updated.push(a.item.id);
  }
  const out={mode:'WRITE_USER_SIX',updated,episodes:updated.length,cells:11,held:'EP-01222'};
  console.log(JSON.stringify(out));return out;
 }finally{lock.releaseLock();}
}
