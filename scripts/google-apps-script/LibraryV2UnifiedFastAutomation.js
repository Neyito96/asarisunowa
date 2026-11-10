/**
 * Fast V2 checkpoint controller (2026-10-16).
 * No global constants: avoids redeclaration collisions across GAS .gs files.
 * One expensive RSS stage per invocation, not GUID+metadata+GUID previews.
 * Uses a separate lease property to avoid nested ScriptLock deadlock.
 * Existing writers retain their own ScriptLock and row-level safeguards.
 * Fetches at most one feed, then handles cached items in later invocations.
 * A completed run taking >=150 seconds disables its own trigger.
 * NOTE: GAS cannot preempt a blocking RSS fetch; this is a post-run guard.
 * Opt-in only. Do not install until prior executions have ended.
 */
function previewLibraryV2UnifiedFast(){
 const props=PropertiesService.getScriptProperties();
 const ts=ScriptApp.getProjectTriggers();
 const conflicts=['scheduledLibraryV2FastAutomation','scheduledLibraryMetadataBackfillV2Hourly','scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10','writeLibraryV2OmnyClipGuidPilot10'];
 const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳');
 if(!sh)throw Error('Ledger missing');
 const rows=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),39).getValues();
 const blank=i=>rows.reduce((n,r)=>n+(String(r[i]||'').trim()?0:1),0);
 const result={mode:'READ_ONLY_UNIFIED_FAST',enabled:props.getProperty('LIB_V2_UNIFIED_ENABLED')==='true',
 triggers:ts.filter(t=>t.getHandlerFunction()==='scheduledLibraryV2UnifiedFast').length,
 conflictingTriggers:ts.filter(t=>conflicts.includes(t.getHandlerFunction())).map(t=>t.getHandlerFunction()),
 rows:rows.length,missing:{guid:blank(6),spotify:blank(11),audio:blank(14),description:blank(21),cast:blank(23)},
 stage:'CHECKPOINT',
 checkpoint:JSON.parse(props.getProperty('LIB_V2_CHECKPOINT_V1')||'null'),
 lease:props.getProperty('LIB_V2_UNIFIED_LEASE')||null,
 failures:Number(props.getProperty('LIB_V2_UNIFIED_FAILURES')||0),writes:0};
 Logger.log(JSON.stringify(result));return result;
}
function installLibraryV2UnifiedFast(){
 const state=previewLibraryV2UnifiedFast();
 if(state.conflictingTriggers.length||state.triggers>1||state.lease)throw Error('Conflict or active lease: '+JSON.stringify(state));
 if(!state.triggers)ScriptApp.newTrigger('scheduledLibraryV2UnifiedFast').timeBased().everyMinutes(5).create();
 const p=PropertiesService.getScriptProperties();
 p.setProperty('LIB_V2_UNIFIED_ENABLED','true');p.setProperty('LIB_V2_UNIFIED_FAILURES','0');
 return previewLibraryV2UnifiedFast();
}
function stopLibraryV2UnifiedFast(){
 const p=PropertiesService.getScriptProperties();
 p.setProperty('LIB_V2_UNIFIED_ENABLED','false');
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledLibraryV2UnifiedFast').forEach(t=>ScriptApp.deleteTrigger(t));
 return previewLibraryV2UnifiedFast();
}
function libV2AcquireLease_(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1000))return null;
 try{
  const p=PropertiesService.getScriptProperties(),now=Date.now();
  const old=Number(p.getProperty('LIB_V2_UNIFIED_LEASE')||0);
  // A GAS execution can run up to about six minutes. Keep lease 8 minutes.
  if(old&&now-old<8*60*1000)return null;
  p.setProperty('LIB_V2_UNIFIED_LEASE',String(now));
  return String(now);
 }finally{lock.releaseLock();}
}
function libV2ReleaseLease_(token){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(3000))return;
 try{
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('LIB_V2_UNIFIED_LEASE')===token)p.deleteProperty('LIB_V2_UNIFIED_LEASE');
 }finally{lock.releaseLock();}
}
function scheduledLibraryV2UnifiedFast(){
 const p=PropertiesService.getScriptProperties();
 if(p.getProperty('LIB_V2_UNIFIED_ENABLED')!=='true')return {status:'DISABLED',writes:0};
 const token=libV2AcquireLease_();
 if(!token){const r={status:'SKIPPED_ALREADY_RUNNING',writes:0};Logger.log(JSON.stringify(r));return r;}
 const stage='CHECKPOINT';
 const started=Date.now();
 try{
  // One feed snapshot or bounded cached continuation; writer owns ScriptLock.
  const result=writeLibraryV2CheckpointPilot10();
  if(result.status==='STOPPED_HTTP')p.setProperty('LIB_V2_UNIFIED_ENABLED','false');
  const elapsedSeconds=Math.round((Date.now()-started)/1000);
  // A completed but unusually slow RSS stage is not safe to repeat unattended.
  // Stop future triggers before another 5-minute invocation can pile up.
  const slow=elapsedSeconds>=150;
  if(slow){
   p.setProperty('LIB_V2_UNIFIED_ENABLED','false');
   ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledLibraryV2UnifiedFast').forEach(t=>ScriptApp.deleteTrigger(t));
  }
  p.setProperty('LIB_V2_UNIFIED_FAILURES','0');
  const r={status:result.status,stage,result,elapsedSeconds,autoStopped:slow||result.status==='STOPPED_HTTP'};
  Logger.log(JSON.stringify(r));return r;
 }catch(e){
  const failures=Number(p.getProperty('LIB_V2_UNIFIED_FAILURES')||0)+1;
  p.setProperty('LIB_V2_UNIFIED_FAILURES',String(failures));
  if(failures>=2)stopLibraryV2UnifiedFast();
  const r={status:'FAILED',stage,failures,stopped:failures>=2,error:String(e)};
  Logger.log(JSON.stringify(r));throw e;
 }finally{libV2ReleaseLease_(token);}
}
