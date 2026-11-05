// Phase24 — Library-ledger first, Spotify playlist membership-only comparison.
// Pure comparator is self-testable without external services. No Spotify writes.
const P24_POLIREBI_PLAYLIST_ID_ = "6hNrobOVHmYaQT5C7hPkNa";
function P24_POLIREBI_MEMBERSHIP_READ_ONLY() {
  // Never treat HTTP errors, 404, or 429 as "playlist has zero items".
  const proposals = P24_LIBRARY_PLAYLIST_PROPOSE("polirebi");
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証情報なし。差分未確定。");
  // The existing helper fetches ONLY playlist members; no /shows/{id}/episodes scans.
  const items = P24_FETCH_SPOTIFY_PLAYLIST_ITEMS_READ_ONLY_(P24_POLIREBI_PLAYLIST_ID_, token);
  if (!Array.isArray(items)) throw new Error("Spotify membershipの形式不明。差分未確定。");
  const result = P24_POLIREBI_COMPARE_(proposals,items);
  Logger.log(JSON.stringify({phase:"24",mode:"READ_ONLY",playlistId:P24_POLIREBI_PLAYLIST_ID_,
    counts:result.counts,missing:result.missing,uncertain:result.uncertain}));
  return result;
}
function P24_POLIREBI_COMPARE_(proposals,items) {
  if (!proposals || !Array.isArray(proposals.candidates) || !Array.isArray(items)) {
    throw new Error("候補またはmembershipデータが不正。");
  }
  const ids=new Set(), uncertain=[];
  items.forEach(function(entry,index) {
    // Spotify playlist API items can have item (current) or track (legacy).
    const ep=entry && (entry.item || entry.track);
    const uri=String(ep && ep.uri || "");
    const id=String(ep && ep.id || "");
    const url=String(ep && ep.external_urls && ep.external_urls.spotify || "");
    const isEpisode=(ep && ep.type==="episode") || uri.indexOf("spotify:episode:")===0 ||
      /^https:\/\/open\.spotify\.com\/episode\//.test(url);
    const valid=/^[A-Za-z0-9]{22}$/.test(id) ? id :
      (uri.match(/^spotify:episode:([A-Za-z0-9]{22})$/)||[])[1] ||
      (url.match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/)||[])[1];
    if (isEpisode && valid) ids.add(valid);
    else uncertain.push({position:index+1,reason:"UNRESOLVED_MEMBERSHIP_ITEM",itemType:ep && ep.type || null});
  });
  const seen=new Set(), present=[], missing=[], held=[];
  proposals.candidates.forEach(function(candidate) {
    const url=String(candidate.spotifyUrl||"");
    const id=(url.match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})$/)||[])[1];
    if (!id || seen.has(id)) {held.push({epId:candidate.id,reason:id?"DUPLICATE_SPOTIFY_ID":"INVALID_SPOTIFY_URL"});return;}
    seen.add(id);
    (ids.has(id)?present:missing).push({epId:candidate.id,title:candidate.title,spotifyUrl:url,
      date:candidate.date,reviewRequired:candidate.reviewRequired});
  });
  // Unresolved entries can hide a matching episode; cannot propose write in that state.
  const safeToSuggestAdds=uncertain.length===0 && held.length===0;
  return {dryRun:true,playlistId:P24_POLIREBI_PLAYLIST_ID_,
    counts:{ledgerCandidates:proposals.candidates.length,playlistItems:items.length,
      uniqueExistingEpisodeIds:ids.size,present:present.length,missing:missing.length,held:held.length,uncertain:uncertain.length},
    present:present,missing:missing,held:held,uncertain:uncertain,
    safeToSuggestAdds:safeToSuggestAdds,writeAllowed:false,
    note:"HTTP等でplaylist取得に失敗すれば例外停止。欠番は自動追加禁止。過去の手動削除は別台帳で確認する。"};
}
function P24_POLIREBI_COMPARE_SELF_TEST() {
  const one="ABCDEFGHIJKLMNOPQRSTUV",two="abcdefghijklmnopqrstuv";
  const candidates={candidates:[
    {id:"EP-00001",title:"ポリレビ1",date:"2026/10/01",spotifyUrl:"https://open.spotify.com/episode/"+one},
    {id:"EP-00002",title:"ポリレビ2",date:"2026/10/02",spotifyUrl:"https://open.spotify.com/episode/"+two}]};
  const r=P24_POLIREBI_COMPARE_(candidates,[{item:{type:"episode",id:one,uri:"spotify:episode:"+one}}]);
  if (r.counts.present!==1 || r.counts.missing!==1 || r.missing[0].epId!=="EP-00002" || !r.safeToSuggestAdds)throw new Error("DIFF_TEST_FAIL");
  const h=P24_POLIREBI_COMPARE_(candidates,[{item:null}]);
  if (h.safeToSuggestAdds || h.counts.uncertain!==1) throw new Error("UNKNOWN_MEMBER_GUARD_FAIL");
  return {ok:true,tests:["present/missing","unresolved-member-hold"]};
}

// Spotify Feb 2026: /items GET max limit=50, owner/collaborator only.
// This is a dedicated read-only helper. Existing production helper remains untouched.
function P24_FETCH_SPOTIFY_PLAYLIST_ITEMS_READ_ONLY_(playlistId, token) {
  const all=[], seenPages=new Set();
  let url="https://api.spotify.com/v1/playlists/"+encodeURIComponent(playlistId)+
    "/items?market=JP&additional_types=episode&limit=50";
  for (let page=0;url && page<50;page++) {
    if (seenPages.has(url)) throw new Error("Spotify pagination loop。差分未確定。");
    seenPages.add(url);
    const response=fetchSpotifyReadWithRetry_(url,{
      muteHttpExceptions:true,
      headers:{Authorization:"Bearer "+token,Accept:"application/json"}
    },"P24 playlist membership (read only)");
    const status=response.getResponseCode();
    if (status!==200) {
      // No response body or token in logs. Separate errors explicitly.
      throw new Error("Spotify playlist membership HTTP "+status+
        (status===403?" (owner/collaborator access required)":
         status===404?" (playlist ID/access/endpoint needs review)":
         status===429?" (rate limit; stop)": "")+
        "。候補比較未実施、Spotify更新0。");
    }
    const body=JSON.parse(response.getContentText());
    if (!Array.isArray(body.items))throw new Error("Spotify membership items missing。差分未確定。");
    all.push.apply(all,body.items);
    url=body.next?String(body.next):"";
    if (url && !/^https:\/\/api\.spotify\.com\/v1\/playlists\/[A-Za-z0-9]+\/items\?/.test(url)) {
      throw new Error("Spotify pagination URL invalid。差分未確定。");
    }
    if (!url && typeof body.total==="number" && all.length!==body.total)
      throw new Error("Spotify membership total mismatch。差分未確定。");
  }
  if (url)throw new Error("Spotify playlist page cap reached。差分未確定。");
  return all;
}
