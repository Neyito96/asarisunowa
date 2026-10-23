/** Pure proposal engine. Confirmed performer -> verified episode Spotify URL -> deduped playlist proposal.
 * Never calls Spotify or creates playlists. All identity and permission proofs must come from actual sources.
 */
const sp=/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:\?.*)?$/;
function planPersonPlaylist({personName='',episodes=[],playlistEpisodeUrls=[],playlistId='',approvedPlaylist=false}={}){
 const q=String(personName).trim(),existing=new Set(playlistEpisodeUrls.map(u=>String(u).match(sp)?.[1]).filter(Boolean));
 if(!q)return {status:'HOLD_PERSON',candidates:[],writes:0};
 const found=[],holds=[],seen=new Set();
 for(const e of episodes){
  // A mere mention in a summary is not proof of appearing.
  const attestations=(e.people||[]).filter(p=>String(p.name).trim()===q&&['出演','MC','司会','ゲスト','聞き手','host','guest'].includes(p.role)&&p.evidenceStatus==='VERIFIED');
  if(!attestations.length)continue;
  if(e.deleted||e.excluded||e.identityStatus!=='EXACT'||!/^EP-\d+$/.test(String(e.epId||''))){holds.push({epId:e.epId,reason:'PROTECTED_OR_UNVERIFIED_EPISODE'});continue;}
  const url=String(e.spotifyUrl||'').trim(),match=url.match(sp);
  if(!match||e.spotifyEvidenceStatus!=='VERIFIED'){holds.push({epId:e.epId,reason:'SPOTIFY_URL_NOT_VERIFIED'});continue;}
  const spotifyId=match[1];
  if(seen.has(spotifyId)){holds.push({epId:e.epId,reason:'DUPLICATE_SPOTIFY_ID_IN_LIBRARY'});continue;}
  seen.add(spotifyId);
  if(existing.has(spotifyId)){found.push({epId:e.epId,spotifyId,status:'ALREADY_IN_PLAYLIST'});continue;}
  found.push({epId:e.epId,spotifyId,spotifyUrl:'https://open.spotify.com/episode/'+spotifyId,status:'READY_FOR_APPROVAL',evidence:attestations.map(a=>a.source)});
 }
 return {status:approvedPlaylist&&playlistId?'READ_ONLY_READY_FOR_API_CHECK':'HOLD_PLAYLIST_APPROVAL',
  personName:q,playlistId:playlistId||null,candidates:found,holds,requiresUserAuthorization:true,
  writes:0,spotifyApiCalls:0,spotifyAddCalls:0};
}
export {planPersonPlaylist};