/**
 * V2 fast automation controller.
 * Install in the SAME GAS project as LibraryMetadataBackfillV2Writer.js.
 * Explicit operator opt-in: run installLibraryV2FastAutomation() once.
 * Does not touch GUID-blank rows; the underlying V2 writer requires verified GUID.
 * 5-minute cadence, up to 80 episodes per execution; no Spotify API calls.
 */
const LIB_V2_FAST_HANDLER = 'scheduledLibraryV2FastAutomation';
const LIB_V2_FAST_KEY = 'LIB_V2_FAST_AUTOMATION_ENABLED';
const LIB_V2_FAST_FAILURES = 'LIB_V2_FAST_CONSECUTIVE_FAILURES';
const LIB_V2_FAST_MAX_FAILURES = 2;

function previewLibraryV2FastAutomation() {
  const triggers=ScriptApp.getProjectTriggers();
  const legacy=['scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10'];
  const conflicts=triggers.filter(t=>legacy.includes(t.getHandlerFunction())).map(t=>t.getHandlerFunction());
  const active=triggers.filter(t=>t.getHandlerFunction()===LIB_V2_FAST_HANDLER).length;
  const props=PropertiesService.getScriptProperties();
  const result={mode:'READ_ONLY_FAST_AUTOMATION_STATUS',enabled:props.getProperty(LIB_V2_FAST_KEY)==='true',installedTriggers:active,v1Conflicts:conflicts,consecutiveFailures:Number(props.getProperty(LIB_V2_FAST_FAILURES)||0),writes:0};
  Logger.log(JSON.stringify(result));return result;
}

function installLibraryV2FastAutomation() {
  const triggers=ScriptApp.getProjectTriggers();
  const legacy=['scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10'];
  const conflicts=triggers.filter(t=>legacy.includes(t.getHandlerFunction()));
  if(conflicts.length)throw Error('V1 triggers active: stop; remove V1 and verify no V1 execution before install');
  const otherV2=triggers.filter(t=>t.getHandlerFunction()==='scheduledLibraryMetadataBackfillV2Hourly');
  if(otherV2.length)throw Error('Old V2 hourly trigger active; stop it first to avoid overlapping writers');
  const installed=triggers.filter(t=>t.getHandlerFunction()===LIB_V2_FAST_HANDLER);
  if(installed.length>1)throw Error('Duplicate fast triggers detected; stop and inspect');
  if(!installed.length)ScriptApp.newTrigger(LIB_V2_FAST_HANDLER).timeBased().everyMinutes(5).create();
  const props=PropertiesService.getScriptProperties();
  props.setProperty(LIB_V2_FAST_FAILURES,'0');
  props.setProperty(LIB_V2_FAST_KEY,'true');
  return previewLibraryV2FastAutomation();
}

function stopLibraryV2FastAutomation() {
  const props=PropertiesService.getScriptProperties();
  props.setProperty(LIB_V2_FAST_KEY,'false');
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===LIB_V2_FAST_HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));
  return previewLibraryV2FastAutomation();
}

function scheduledLibraryV2FastAutomation() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(LIB_V2_FAST_KEY)!=='true')return {status:'DISABLED',writes:0};
  try {
    const result=writeLibraryMetadataV2Batch_(80);
    props.setProperty(LIB_V2_FAST_FAILURES,'0');
    const status={status:result.writtenCells>0?'SUCCESS':'NO_MORE_MATCHED_BLANKS',writtenCells:result.writtenCells,selectedEpisodes:result.selectedEpisodes,history:result.history,seconds:result.seconds};
    if(result.writtenCells===0) {
      // Automatically stop only this controller; do not modify other triggers.
      stopLibraryV2FastAutomation();
      status.automationStopped=true;
    }
    Logger.log(JSON.stringify(status));
    return status;
  } catch(err) {
    const failures=Number(props.getProperty(LIB_V2_FAST_FAILURES)||0)+1;
    props.setProperty(LIB_V2_FAST_FAILURES,String(failures));
    if(failures>=LIB_V2_FAST_MAX_FAILURES)stopLibraryV2FastAutomation();
    Logger.log(JSON.stringify({status:'FAILED',failures,stopped:failures>=LIB_V2_FAST_MAX_FAILURES,error:String(err)}));
    throw err; // GAS execution history must show the failure.
  }
}
