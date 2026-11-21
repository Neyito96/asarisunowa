// Phase 25 — shared scheduler audit only; zero writes / zero Spotify calls.
// Run P25_AUDIT_TRIGGER_INVENTORY() in the existing Spotify-management GAS.
// This function reads only the triggers visible to the current executing account.
function P25_AUDIT_TRIGGER_INVENTORY() {
  const all=ScriptApp.getProjectTriggers().map(function(t){
    return {
      handler:t.getHandlerFunction(),
      type:String(t.getEventType()),
      source:String(t.getTriggerSource())
    };
  });
  const counts={};
  all.forEach(function(t){counts[t.handler]=(counts[t.handler]||0)+1;});
  const suspectedDuplicateHandlers=Object.keys(counts).filter(function(k){
    return counts[k]>1;
  });
  const result={
    dryRun:true,
    projectName:"current-project",
    visibleTriggers:all.length,
    perHandler:counts,
    suspectedDuplicateHandlers:suspectedDuplicateHandlers,
    triggers:all,
    caveat:"Other users' installable triggers might not be visible. This does not inspect other GAS projects. No trigger was created, removed, or modified."
  };
  Logger.log(JSON.stringify(result));
  return result;
}
