// プレイリスト自動更新用 Spotify 補助

function getAllSpotifyPlaylistItems_(playlistId, token) {
  const allItems = [];
  let url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) + "/items?market=JP&limit=100";
  while (url) {
    const response = fetchSpotifyReadWithRetry_(url,{muteHttpExceptions:true,headers:{Authorization:"Bearer "+token,Accept:"application/json"}},"Playlist "+playlistId);
    const status=response.getResponseCode(); Logger.log("Playlist page status: "+status);
    if(status!==200){Logger.log(response.getContentText());throw new Error("プレイリスト全件取得に失敗しました");}
    const data=JSON.parse(response.getContentText()); if(Array.isArray(data.items))allItems.push.apply(allItems,data.items);
    url=data.next?String(data.next):"";
  }
  return allItems;
}

// Playlist Items APIではdescription等が省略される場合がある。
// 補完はbest-effort。429等が続いてもdry-run全体を失敗させず元データを返す。
function hydrateSpotifyEpisodeForSpeakerSafeV2_(episode, token) {
  if(!episode)return null;
  if(String(episode.description||episode.html_description||"").trim())return episode;
  const id=String(episode.id||"").trim(); if(!id)return episode;
  const url="https://api.spotify.com/v1/episodes/"+encodeURIComponent(id)+"?market=JP";
  try {
    const response=fetchSpotifyReadWithRetry_(url,{muteHttpExceptions:true,headers:{Authorization:"Bearer "+token,Accept:"application/json"}},"Episode "+id);
    const status=response.getResponseCode(); Logger.log("Episode detail status: "+status+" | "+id);
    if(status!==200)return episode;
    const detail=JSON.parse(response.getContentText());
    return detail&&detail.id?Object.assign({},episode,detail):episode;
  } catch(err) {
    Logger.log("Episode detail hydration skipped: "+id+" | "+String(err&&err.message?err.message:err));
    return episode;
  }
}

function hydrateSpotifyEpisodesForSpeakerSafeV2_(episodes,token){
  const list=Array.isArray(episodes)?episodes:[];
  return list.map(function(episode){return hydrateSpotifyEpisodeForSpeakerSafeV2_(episode,token);});
}
