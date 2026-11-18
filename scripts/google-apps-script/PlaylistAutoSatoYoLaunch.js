const SATOYO_LAUNCH_={playlistId:"73ppqrTcsjVgl1xwIZa4SY",ids:[
"3MPwacUdMc3xdp9AFSAf5B","6nRB54icoj8PieyRl6CQN2","4OiMLEbjxSdIreJ06M0kzR","2qpiFKzeVWLARvYQrV3L8u","3qaWoz8qlcUZDxa4OPdXsT","2flvxQlxyaVtKjuiL6Tlp7","2rfCZS0InpM2khFZDA1cEW","4UKrZ0TQxpNaVZISiEroaN","35jfqWmuiOCgvvB0dsgRoM","18uD3rbjLqIjNJlbX0wHrj","494udjmF1GLJ6LPWQJ11iq","7k1gIouQkeIjUPfyASIYo3","1kQLh01qZUmu65w3a8FCRu","3vCdfqVQcOcM19uukqoEky"]};

function previewSatoYoOnsaLaunch(){
 const token=getSpotifyUserAccessToken();
 if(!token)throw new Error("Spotify user token missing");
 const plan=buildSatoYoOnsaLaunchPlan_(token);
 Logger.log(JSON.stringify(plan,null,2));
 return plan;
}

function launchSatoYoOnsaEpisodes(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw new Error("Another update is running");
 try{
  const token=getSpotifyUserAccessToken();
  if(!token)throw new Error("Spotify user token missing");
  const plan=buildSatoYoOnsaLaunchPlan_(token);
  if(!plan.safeToRun)throw new Error("Safety stop: "+plan.reason);
  if(plan.missingUris.length)addSatoYoOnsaEpisodesAtTop_(token,plan.missingUris);
  const after=buildSatoYoOnsaLaunchPlan_(token);
  if(after.currentCount!==14||after.missingCount!==0||after.unexpectedUris.length||after.duplicateUris.length)throw new Error("Post-check failed: "+JSON.stringify(after));
  updatePlaylistLatestDate_(SATOYO_LAUNCH_.playlistId);
  const result={ok:true,spotifyAddedCount:plan.missingCount,expectedCount:14};
  Logger.log(JSON.stringify(result));
  return result;
 }finally{lock.releaseLock();}
}

function buildSatoYoOnsaLaunchPlan_(token){
 const expectedUris=SATOYO_LAUNCH_.ids.map(function(id){return "spotify:episode:"+id;});
 const expectedSet=new Set(expectedUris);
 const items=getAllSpotifyPlaylistItems_(SATOYO_LAUNCH_.playlistId,token);
 const actualUris=items.map(function(row){return String(row&&row.item&&row.item.uri||"");}).filter(Boolean);
 const unexpectedUris=actualUris.filter(function(uri){return !expectedSet.has(uri);});
 const duplicateUris=actualUris.filter(function(uri,i){return actualUris.indexOf(uri)!==i;});
 const actualSet=new Set(actualUris);
 const missingUris=expectedUris.filter(function(uri){return !actualSet.has(uri);});
 const safeToRun=unexpectedUris.length===0&&duplicateUris.length===0;
 return {dryRun:true,spotifyWrite:false,spreadsheetWrite:false,safeToRun:safeToRun,reason:unexpectedUris.length?"unexpected existing item":duplicateUris.length?"duplicate existing item":"",currentCount:actualUris.length,expectedCount:expectedUris.length,missingCount:missingUris.length,missingUris:missingUris,unexpectedUris:unexpectedUris,duplicateUris:duplicateUris};
}

function addSatoYoOnsaEpisodesAtTop_(token,uris){
 const response=UrlFetchApp.fetch("https://api.spotify.com/v1/playlists/"+encodeURIComponent(SATOYO_LAUNCH_.playlistId)+"/items",{method:"post",muteHttpExceptions:true,contentType:"application/json",headers:{Authorization:"Bearer "+token},payload:JSON.stringify({uris:uris,position:0})});
 const status=response.getResponseCode();
 Logger.log("Sato Yo initial add status: "+status);
 if(status!==200&&status!==201)throw new Error("Spotify add failed status="+status+" body="+response.getContentText());
}
