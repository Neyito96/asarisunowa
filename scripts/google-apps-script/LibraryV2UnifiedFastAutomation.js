/**
 * 朝リスの田 / Fast V2 unified backfill controller (opt-in).
 * Uses existing strict GUID preview/pilot and metadata V2 writer.
 * Does NOT validate Spotify playback, infer cast, or claim those fields complete.
 * Never modifies pre-existing cells. Does not create triggers until explicitly installed.
 * Deploy in same GAS project as LibraryV2FastAutomation.js,
 * LibraryV2OmnyClipGuidVerifiedPreview.js, and LibraryV2OmnyClipGuidPilotWriter.js.
 */
const LIB_V2_UNIFIED_HANDLER='scheduledLibraryV2UnifiedFast';
const LIB_V2_UNIFIED_ENABLED='LIB_V2_UNIFIED_ENABLED';
const LIB_V2_UNIFIED_FAILURES='LIB_V2_UNIFIED_FAILURES';
function previewLibraryV2UnifiedFast() {
 const props=PropertiesService.getScriptProperties();
 const ts=ScriptApp.getProjectTriggers();
 const conflicts=['scheduledLibraryV2FastAutomation','scheduledLibraryMetadataBackfillV2Hourly','scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10','writeLibraryV2OmnyClipGuidPilot10'];
 const existing=ts.filter(t=>t.getHandlerFunction()===LIB_V2_UNIFIED_HANDLER).length;
 const other=ts.filter(t=>conflicts.includes(t.getHandlerFunction())).map(t=>t.getHandlerFunction());
 const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳');
 if(!sh)throw Error('Ledger missing');
 const rows=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),39).getValues();
 const blank=i=>rows.reduce((n,r)=>n+(String(r[i]||'').trim()?0:1),0);
 const report={mode:'READ_ONLY_UNIFIED_FAST',enabled:props.getProperty(LIB_V2_UNIFIED_ENABLED)==='true',
 triggers:existing,conflictingTriggers:other,rows:rows.length,
 missing:{guid:blank(6),spotify:blank(11),audio:blank(14),description:blank(21),cast:blank(23)},
 failures:Number(props.getProperty(LIB_V2_UNIFIED_FAILURES)||0),writes:0};
 Logger.log(JSON.stringify(report));return report;
}
function installLibraryV2UnifiedFast() {
 const state=previewLibraryV2UnifiedFast();
 if(state.conflictingTriggers.length||state.triggers>1)throw Error('Conflicting/duplicate triggers: '+JSON.stringify(state));
 if(!state.triggers)ScriptApp.newTrigger(LIB_V2_UNIFIED_HANDLER).timeBased().everyMinutes(5).create();
 const p=PropertiesService.getScriptProperties();
 p.setProperty(LIB_V2_UNIFIED_ENABLED,'true');p.setProperty(LIB_V2_UNIFIED_FAILURES,'0');
 return previewLibraryV2UnifiedFast();
}
function stopLibraryV2UnifiedFast() {
 PropertiesService.getScriptProperties().setProperty(LIB_V2_UNIFIED_ENABLED,'false');
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===LIB_V2_UNIFIED_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
 return previewLibraryV2UnifiedFast();
}
function scheduledLibraryV2UnifiedFast() {
 const p=PropertiesService.getScriptProperties();
 if(p.getProperty(LIB_V2_UNIFIED_ENABLED)!=='true')return {status:'DISABLED',writes:0};
 try {
  // GUID pilot itself re-fetches RSS and strictly verifies every proposed G write.
  const before=previewLibraryV2OmnyClipGuidVerified();
  let guid={status:'NO_ELIGIBLE',written:0};
  if(before.eligible>0){
   const r=writeLibraryV2OmnyClipGuidPilot10();
   guid={status:'RAN',result:r};
  }
  // Metadata V2 has its own script lock and only fills verified, blank cells.
  const metadata=writeLibraryMetadataV2Batch_(80);
  const count=Number(metadata.writtenCells||0);
  const moreGuid=previewLibraryV2OmnyClipGuidVerified().eligible;
  p.setProperty(LIB_V2_UNIFIED_FAILURES,'0');
  const result={status:'SUCCESS',guid,metadata:{writtenCells:count,selectedEpisodes:metadata.selectedEpisodes},remainingStrictGuidCandidates:moreGuid};
  if(moreGuid===0&&count===0){stopLibraryV2UnifiedFast();result.status='NO_MORE_SAFE_MATCHES';result.automationStopped=true;}
  Logger.log(JSON.stringify(result));return result;
 } catch(e) {
  const failures=Number(p.getProperty(LIB_V2_UNIFIED_FAILURES)||0)+1;
  p.setProperty(LIB_V2_UNIFIED_FAILURES,String(failures));
  if(failures>=2)stopLibraryV2UnifiedFast();
  Logger.log(JSON.stringify({status:'FAILED',failures,stopped:failures>=2,error:String(e)}));
  throw e;
 }
}
