/** Phase14 native fallback. Copy sandbox only; no REST, no production writes.
 * Existing sheets are READ_ONLY: SpreadsheetApp cannot prove absence of chipRuns.
 * Native new registration deliberately fails closed: no cross-sheet transaction.
 */
var LibraryOfficialNative = (function(){
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const KEY='LIB_OFFICIAL_NATIVE_CONFIG',CP='LIB_OFFICIAL_NATIVE_CURSOR';
 function must(x,s){if(!x)throw Error(s);}
 function properties(){return PropertiesService.getScriptProperties();}
 function config(){const c=JSON.parse(properties().getProperty(KEY)||'{}');must(c.sheetId===COPY,'COPY_ONLY');return c;}
 function cells(range){
  const v=range.getValues()[0],f=range.getFormulas()[0],d=range.getDataValidations()[0];
  return v.map((x,i)=>({...LibraryOfficialEngine.cell(x),...(f[i]?{userEnteredValue:{formulaValue:f[i]}}:{}),...(d[i]?{dataValidation:{protected:true}}:{})}));
 }
 // Budget is based on elapsed time as well as a bounded call count. Errors still advance.
 function sweep(total,cp,limit,deadline,now,visit,save){
  must(Number.isInteger(cp)&&cp>=0&&cp<=total,'CURSOR_INVALID');
  let n=cp,scanned=0,changed=0,held=0;
  while(n<total&&scanned<limit&&now()<deadline){
   try{changed+=visit(n)||0;}catch(e){
    held++;save({failure:{offset:n,reason:String(e.message)}});
    // Do not advance past a failed row: it must be resolved or explicitly held.
    break;
   }
   n++;scanned++;save({offset:n});
  }
  return {scanned,changed,held,remaining:total-n,offset:n,complete:n===total};
 }
 function guardedCell(cell){
  must(cell.isBlank()&&!cell.getFormula()&&!cell.getDataValidation()&&!cell.isPartOfMerge(),'TARGET_STRUCTURE_PROTECTED');
  must(!cell.getNote(),'NOTE_PROTECTED');
 }
 // Durable per-cell journal. Recover only a value matching the exact pending plan.
 function fill(sheet,stateSheet,rowNumber,stateRow,state,plan){
  const E=LibraryOfficialEngine,range=sheet.getRange(rowNumber,1,1,55),before=range.getValues()[0];
  must(before[0]===plan.id&&before[6]===plan.guid,'IDENTITY_CONFLICT');
  E.verifyRowProof(before,state);
  let changed=0;
  for(const ch of plan.changes){
   const target=sheet.getRange(rowNumber,ch.col+1);guardedCell(target);
   const current=range.getValues()[0];E.verifyRowProof(current,state);
   const after=current.slice();after[ch.col]=ch.next;
   const pending={schema:'native-cell-v1',id:plan.id,row:rowNumber,col:ch.col,beforeHash:E.rowHash(current),afterHash:E.rowHash(after),next:ch.next,cell:ch.cell,baseline:state.identity[2]};
   // Journal and receipt are stored in the isolated sandbox state, never V3 identity.
   state.nativePending=pending;stateSheet.getRange(stateRow,2).setValue(JSON.stringify(state));SpreadsheetApp.flush();
   if(ch.col===28){let builder=SpreadsheetApp.newRichTextValue().setText(String(ch.next));for(const run of ch.cell.textFormatRuns||[]){const uri=run.format&&run.format.link&&run.format.link.uri;if(!uri)continue;builder=builder.setLinkUrl(run.startIndex,run.startIndex+uri.length,uri);}target.setRichTextValue(builder.build());}
   else {must(typeof ch.next!=='string'||!ch.next.startsWith('='),'FORMULA_INPUT');target.setValue(ch.next);}
   target.setNote(ch.cell.note||'');SpreadsheetApp.flush();
   must(E.rowHash(range.getValues()[0])===pending.afterHash,'READBACK_CONFLICT');
   finish(state,pending);stateSheet.getRange(stateRow,2).setValue(JSON.stringify(state));SpreadsheetApp.flush();changed++;
  }
  return changed;
 }
 function finish(state,p){state.officialBackfill=['VERIFIED',state.identity[1],p.beforeHash,'',p.afterHash,'native_blank_fill',new Date().toISOString(),JSON.stringify({schema:'official-native-row-v1',baselineHash:p.baseline,beforeHash:p.beforeHash,afterHash:p.afterHash,columns:[p.col]})];delete state.nativePending;}
 function recover(sheet,stateSheet,rowNumber,stateRow,state){
  const p=state.nativePending;if(!p)return;
  const row=sheet.getRange(rowNumber,1,1,55).getValues()[0],hash=LibraryOfficialEngine.rowHash(row);
  must(p.schema==='native-cell-v1'&&p.row===rowNumber&&p.id===row[0]&&p.baseline===state.identity[2],'JOURNAL_CONFLICT');
  if(hash===p.afterHash){const cell=sheet.getRange(rowNumber,p.col+1);must(!cell.getFormula()&&!cell.getDataValidation(),'RECOVERY_STRUCTURE_CONFLICT');cell.setNote(p.cell.note||'');finish(state,p);}
  else {must(hash===p.beforeHash,'PARTIAL_WRITE_CONFLICT');delete state.nativePending;}
  stateSheet.getRange(stateRow,2).setValue(JSON.stringify(state));SpreadsheetApp.flush();
 }
 // Scope sheet is a verified EP-ID decision table (A=EP-ID, D=publication decision).
 // Never infer eligibility from a playlist or an approximate count.
 function scopeMap(ss,c,ledger){
  if(!c.scopeSheet){
   must(ledger==='P14_NATIVE_FIXTURE','SCOPE_SHEET_REQUIRED_FOR_LEDGER');
   return null;
  }
  // A verified decision sheet may be read directly from the production workbook; never written.
  const scopeBook=c.scopeSourceSheetId?(must(c.scopeSourceSheetId==='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4','SCOPE_SOURCE_NOT_APPROVED'),SpreadsheetApp.openById(c.scopeSourceSheetId)):ss;
  const sh=scopeBook.getSheetByName(c.scopeSheet);
  must(sh&&sh.getLastColumn()>=4,'SCOPE_SHEET_MISSING');
  const headers=sh.getRange(1,1,1,4).getValues()[0];
  must(headers[0]==='EP-ID'&&headers[3]==='宇宙検索対象','SCOPE_HEADERS_MISMATCH');
  must(sh.getLastRow()===6592,'SCOPE_LAST_ROW_MISMATCH');
  const data=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),4).getValues(),out=new Map();
  for(const r of data){
   const id=String(r[0]||'').trim(),decision=String(r[3]||'').trim();
   must(/^EP-\d{5}$/.test(id)&&!out.has(id),'SCOPE_ID_INVALID_OR_DUPLICATE');
   must(['対象','対象外','保留'].includes(decision),'SCOPE_DECISION_INVALID');
   out.set(id,decision);
  }
  must(out.size===6591,'SCOPE_COUNT_NOT_6591');
  const counts={};for(const v of out.values())counts[v]=(counts[v]||0)+1;
  must(counts['対象']===5848&&counts['対象外']===377&&counts['保留']===366,'SCOPE_TOTALS_MISMATCH');
  return out;
 }
 // Fast, no-JSON preflight. Verifies all 6591 ledger IDs and decisions before any sweep.
 function preflight(){
  const c=config(),ss=SpreadsheetApp.openById(c.sheetId),sh=ss.getSheetByName(c.ledger||'エピソード台帳');
  must(sh,'LEDGER_MISSING');
  must(sh.getRange(1,1).getValue()==='台帳ID','LEDGER_HEADER_MISMATCH');
  const scope=scopeMap(ss,c,c.ledger||'エピソード台帳');
  must(scope,'SCOPE_REQUIRED');
  must(sh.getLastRow()-1>=6591,'LEDGER_BASELINE_TRUNCATED');
  const ids=sh.getRange(2,1,6591,1).getValues(),seen=new Set(),counts={adopted:0,excluded:0,held:0};
  for(const [raw] of ids){
   const id=String(raw||'').trim();
   must(!seen.has(id)&&scope.has(id),'LEDGER_SCOPE_MISMATCH');
   seen.add(id);
   const d=scope.get(id);
   if(d==='対象')counts.adopted++;
   else if(d==='対象外')counts.excluded++;
   else counts.held++;
  }
  must(seen.size===scope.size,'LEDGER_SCOPE_COUNT_MISMATCH');
  must(counts.adopted===5848&&counts.excluded===377&&counts.held===366,'LEDGER_SCOPE_TOTALS_MISMATCH');
  const stateSheet=ss.getSheetByName(c.states||'図書館V3・項目状態');
  must(stateSheet,'STATE_SHEET_MISSING');
  const stateRows=stateSheet.getRange(2,1,Math.max(1,stateSheet.getLastRow()-1),2).getValues();
  const stateIds=new Set();
  for(const row of stateRows){
   const id=String(row[0]||'').trim();
   must(id&&!stateIds.has(id),'STATE_ID_MISMATCH_OR_DUPLICATE');
   const state=JSON.parse(row[1]);
   must(state.identity&&state.identity[0]==='VERIFIED','STATE_IDENTITY_NOT_VERIFIED');
   stateIds.add(id);
  }
  must([...seen].every(id=>stateIds.has(id)),'STATE_BASELINE_MISSING');
  const result={mode:'SCOPE_PREFLIGHT_READ_ONLY',rows:seen.size,stateRows:stateIds.size,...counts,writes:0,officialFetches:0};
  console.log(JSON.stringify(result));return result;
 }
 function backfill(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};
  try{
   const c=config(),p=properties(),ss=SpreadsheetApp.openById(c.sheetId),E=LibraryOfficialEngine;
   must(c.enabled===true,'DISABLED');
   const write=c.write===true;
   // Only new values-only sandbox tabs created by the explicit fixture initializer qualify.
   if(write)must(c.sandboxToken===p.getProperty('LIB_OFFICIAL_NATIVE_SANDBOX')&&c.sandboxToken&&c.ledger==='P14_NATIVE_FIXTURE'&&c.states==='P14_NATIVE_STATE'&&c.otherWritersPaused===true,'STRUCTURE_PROOF_REQUIRED');
   const sh=ss.getSheetByName(c.ledger||'エピソード台帳'),st=ss.getSheetByName(c.states||'図書館V3・項目状態');
   must(sh&&st&&sh.getLastColumn()===55,'SCHEMA_CONFLICT');
   must(sh.getRange(1,1).getValue()==='台帳ID','LEDGER_HEADER_MISMATCH');
   const scope=scopeMap(ss,c,c.ledger||'エピソード台帳');
   const states=st.getDataRange().getValues(),map=new Map();states.slice(1).forEach((r,i)=>{must(!map.has(r[0]),'DUPLICATE_STATE');map.set(r[0],{state:JSON.parse(r[1]),row:i+2});});
   // Keep the legacy fixture cursor untouched. A real-ledger read-only sweep
   // has its own cursor, and a different target can never inherit its offset.
   const target=c.sheetId+'/'+sh.getSheetId();
   const cursorKey=(c.ledger==='P14_NATIVE_FIXTURE'?CP:CP+'_LEDGER_'+sh.getSheetId())+(write?'_WRITE':'_READ_ONLY');
   const cp=JSON.parse(p.getProperty(cursorKey)||'{}');
   must(!cp.target||cp.target===target,'CURSOR_TARGET_CONFLICT');
   const total=sh.getLastRow()-1;
   if(scope){must(sh.getLastRow()-1>=6591,'LEDGER_BASELINE_TRUNCATED');const ids=sh.getRange(2,1,total,1).getValues().map(r=>String(r[0]||'').trim()),seen=new Set();for(const id of ids){must(!seen.has(id),'LEDGER_ID_DUPLICATE');if(seen.size<6591)must(scope.has(id),'LEDGER_BASELINE_SCOPE_MISMATCH');else must(!scope.has(id),'LEDGER_NEW_ID_IN_FROZEN_SCOPE');seen.add(id);}must([...scope.keys()].every(id=>seen.has(id)),'LEDGER_SCOPE_COUNT_MISMATCH');}
   const start=Date.now(),deadline=start+Math.max(5000,Math.min(c.budgetMs||120000,240000));
   const failures=[],metrics={jsonFetched:0,planned:0,writes:0,scopeAdopted:0,scopeExcluded:0,scopeHeld:0,scopeNewUnclassified:0,mode:write?'COPY_SANDBOX_WRITE':'READ_ONLY'};
   const report=sweep(total,cp.offset||0,Math.max(1,Math.min(c.batchSize||50,200)),deadline,Date.now,i=>{
    const range=sh.getRange(i+2,1,1,55),row=range.getValues()[0];
    // Publication eligibility is NOT an archival backfill filter. Preserve all 6591 baseline EPs.
    if(scope){const decision=scope.get(row[0]);if(i<6591)must(decision,'SCOPE_BASELINE_EP_ID_MISSING');else must(!decision,'SCOPE_NEW_EP_UNEXPECTEDLY_CLASSIFIED');if(!decision)metrics.scopeNewUnclassified++;else if(decision==='対象外')metrics.scopeExcluded++;else if(decision==='保留')metrics.scopeHeld++;else metrics.scopeAdopted++;}
    const entry=map.get(row[0]);must(entry,'STATE_MISSING');
    if(write)recover(sh,st,i+2,entry.row,entry.state);
    E.verifyRowProof(range.getValues()[0],entry.state);
    const ev=E.official({guid:row[6]});metrics.jsonFetched++;
    const item=E.fromJson(row,ev.clip,ev.url),plan=E.plan(cells(range),item,ev.clip,ev.url);metrics.planned+=plan.changes.length;
    if(!write)return 0;
    const count=fill(sh,st,i+2,entry.row,entry.state,plan);metrics.writes+=count;return count;
   },event=>{
    if(event.failure){failures.push(event.failure);console.log(JSON.stringify({engine:'native-backfill',...event.failure}));}
    else p.setProperty(cursorKey,JSON.stringify({target,offset:event.offset,total,at:new Date().toISOString()}));
   });
   if(report.complete)p.setProperty(cursorKey,JSON.stringify({target,offset:0,total,completedAt:new Date().toISOString()}));
   const out={...report,...metrics,failures:failures.slice(0,10),elapsedMs:Date.now()-start};p.setProperty('LIB_OFFICIAL_NATIVE_REPORT',JSON.stringify(out));console.log(JSON.stringify(out));return out;
  }finally{lock.releaseLock();}
 }
 function newScan(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};
  try{
   const c=config();must(c.enabled===true,'DISABLED');const report={engine:'native-new',status:'REGISTRATION_BLOCKED_NONATOMIC',rssItems:0,jsonFetched:0,held:0,added:0};
   const deadline=Date.now()+120000;
   const allowedShows=new Set(['ニュースの現場から','MEDIA TALK','スポンジ','ドーナツ','報談','ニュースの学校','こどもそうだんしつ']);
   for(const feed of c.feeds||[]){
    must(allowedShows.has(String(feed.show||'').trim()),'NEW_FEED_NOT_APPROVED:'+String(feed.show||''));
    must(/^https:\/\//.test(String(feed.url||'')),'NEW_FEED_URL_INVALID');
    try{const items=LibraryOfficialEngine.rss(feed);report.rssItems+=items.length;for(const item of items){if(Date.now()>=deadline||report.jsonFetched>=20)break;if(c.newAfter){const since=Date.parse(c.newAfter),published=Date.parse(item.pubDate);must(Number.isFinite(since),'NEW_AFTER_INVALID');if(!Number.isFinite(published)||published<=since)continue;}try{const ev=LibraryOfficialEngine.official(item);report.jsonFetched++;LibraryOfficialEngine.material(item,ev.clip,ev.url);}catch(e){report.held++;console.log(JSON.stringify({guid:item.guid,reason:String(e.message)}));}}}catch(e){report.held++;console.log(JSON.stringify({reason:String(e.message)}));}if(Date.now()>=deadline)break;}
   // No allocation, history or ledger writes until a cross-sheet protocol is validated.
   console.log(JSON.stringify(report));return report;
  }finally{lock.releaseLock();}
 }
 return {backfill,newScan,preflight,sweep,guardedCell,fill,recover,finish,cells,COPY};
})();
function verifyLibraryOfficialNativeScopeReadOnly(){return LibraryOfficialNative.preflight();}
function scheduledLibraryOfficialNativeBackfill(){return LibraryOfficialNative.backfill();}
function scheduledLibraryOfficialNativeNew(){return LibraryOfficialNative.newScan();}
/** Explicit operator action: fresh tabs only; original copy tabs never modified.
 * Read 10 production rows and immutable states, validate before creating anything.
 */
function prepareLibraryOfficialNativeCopyFixture(){
 const E=LibraryOfficialEngine,N=LibraryOfficialNative,lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('BUSY');
 try{
  const p=PropertiesService.getScriptProperties(),dst=SpreadsheetApp.openById(N.COPY);
  if(dst.getSheetByName('P14_NATIVE_FIXTURE')||dst.getSheetByName('P14_NATIVE_STATE'))throw Error('FIXTURE_EXISTS_DO_NOT_OVERWRITE');
  const src=SpreadsheetApp.openById(E.PROD),ledger=src.getSheetByName('エピソード台帳');
  const rows=ledger.getRange(142,1,10,55).getValues(),all=src.getSheetByName('図書館V3・項目状態').getDataRange().getValues();
  const states=rows.map((r,i)=>{if(r[0]!=='EP-'+String(141+i).padStart(5,'0'))throw Error('FIXTURE_ID_CONFLICT');const matches=all.filter(s=>s[0]===r[0]);if(matches.length!==1)throw Error('STATE_AMBIGUOUS');E.verifyRowProof(r,JSON.parse(matches[0][1]));return matches[0].slice(0,3);});
  if(rows.some(r=>r.some(v=>typeof v==='string'&&v.startsWith('='))))throw Error('FORMULA_TEXT_UNSUPPORTED');
  const sh=dst.insertSheet('P14_NATIVE_FIXTURE'),st=dst.insertSheet('P14_NATIVE_STATE');
  if(sh.getMaxColumns()<55)sh.insertColumnsAfter(sh.getMaxColumns(),55-sh.getMaxColumns());
  sh.getRange(1,1,1,55).setValues(ledger.getRange(1,1,1,55).getValues());sh.getRange(2,1,10,55).setValues(rows);
  st.getRange(1,1,1,3).setValues([['EP-ID','immutable baseline + native receipt','created']]);st.getRange(2,1,10,3).setValues(states);SpreadsheetApp.flush();
  const read=sh.getRange(2,1,10,55).getValues();read.forEach((r,i)=>{if(E.rowHash(r)!==E.rowHash(rows[i]))throw Error('FIXTURE_READBACK_FAILED');E.verifyRowProof(r,JSON.parse(states[i][1]));});
  const token=Utilities.getUuid();p.setProperty('LIB_OFFICIAL_NATIVE_SANDBOX',token);
  p.setProperty('LIB_OFFICIAL_NATIVE_CONFIG',JSON.stringify({sheetId:N.COPY,ledger:sh.getName(),states:st.getName(),sandboxToken:token,enabled:true,write:false,otherWritersPaused:true,batchSize:10,feeds:[{url:rows[0][44],show:rows[0][1]}]}));
  console.log(JSON.stringify({status:'FIXTURE_READY_READ_ONLY',rows:10,sourceWrites:0,existingCopyWrites:0}));
 }finally{lock.releaseLock();}
}
/** Explicit operator action after manual validation. Copy triggers only. */
function installLibraryOfficialNativeCopyTriggers(){
 const p=PropertiesService.getScriptProperties(),c=JSON.parse(p.getProperty('LIB_OFFICIAL_NATIVE_CONFIG')||'{}');
 if(c.sheetId!==LibraryOfficialNative.COPY||c.copyManualVerified!==true||!c.sandboxToken||c.sandboxToken!==p.getProperty('LIB_OFFICIAL_NATIVE_SANDBOX')||c.ledger!=='P14_NATIVE_FIXTURE'||c.states!=='P14_NATIVE_STATE')throw Error('COPY_MANUAL_VALIDATION_REQUIRED');
 if(ScriptApp.getProjectTriggers().length)throw Error('EXISTING_TRIGGERS_REVIEW_REQUIRED');
 const added=[];try{added.push(ScriptApp.newTrigger('scheduledLibraryOfficialNativeNew').timeBased().everyHours(1).create());added.push(ScriptApp.newTrigger('scheduledLibraryOfficialNativeBackfill').timeBased().everyHours(2).create());}catch(e){added.forEach(t=>ScriptApp.deleteTrigger(t));throw e;}
 console.log(JSON.stringify({copyOnly:true,triggers:added.map(t=>({id:t.getUniqueId(),handler:t.getHandlerFunction()}))}));
}
function removeLibraryOfficialNativeCopyTriggers(){
 const c=JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_OFFICIAL_NATIVE_CONFIG')||'{}');if(c.sheetId!==LibraryOfficialNative.COPY)throw Error('COPY_ONLY');
 for(const t of ScriptApp.getProjectTriggers())if(['scheduledLibraryOfficialNativeNew','scheduledLibraryOfficialNativeBackfill'].includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t);
}
