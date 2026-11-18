

function launchSatoYoOnsaEpisodesIndividual(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw new Error("Another update is running");
 try{
  const token=getSpotifyUserAccessToken();
  const plan=buildSatoYoOnsaLaunchPlan_(token);
  if(!plan.safeToRun)throw new Error("Safety stop: "+plan.reason);
  const episodes=plan.missingUris.map(function(uri){return {uri:uri,name:uri};});
  const addResult=addAutoPlaylistEpisodesIndividually_({playlistId:SATOYO_LAUNCH_.playlistId},token,episodes);
  const after=buildSatoYoOnsaLaunchPlan_(token);
  if(after.missingCount!==0||after.unexpectedUris.length||after.duplicateUris.length)throw new Error("Post-check failed: "+JSON.stringify({addResult:addResult,after:after}));
  updatePlaylistLatestDate_(SATOYO_LAUNCH_.playlistId);
  const result={ok:true,spotifyAddedCount:plan.missingCount,expectedCount:14};
  Logger.log(JSON.stringify(result));
  return result;
 }finally{lock.releaseLock();}
}
