/**
 * Spotify playlist REST adapter — dependency-injected and deny-by-default.
 * Caller must supply an authenticated fetch implementation and an access token
 * with Spotify playlist permissions; do not store/log the token or invite URL.
 * No invocation occurs merely by importing this module.
 */
const SPOTIFY_ID=/^[A-Za-z0-9]{22}$/;
const API='https://api.spotify.com/v1';
function validateId(id){if(!SPOTIFY_ID.test(String(id||'')))throw Error('INVALID_PLAYLIST_ID');return id;}
function makeSpotifyPlaylistClient({fetchImpl,accessToken}={}){
 if(typeof fetchImpl!=='function')throw Error('FETCH_IMPLEMENTATION_REQUIRED');
 if(typeof accessToken!=='string'||!accessToken)throw Error('ACCESS_TOKEN_REQUIRED');
 async function request(path,options={}){
  const response=await fetchImpl(API+path,{...options,headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',...(options.headers||{})}});
  if(response.status===429)return {status:'RETRY_LATER',retryAfter:response.headers?.get?.('Retry-After')||null};
  if(response.status===401)return {status:'AUTH_REQUIRED'};
  if(response.status===403)return {status:'FORBIDDEN'};
  if(response.status===404)return {status:'NOT_FOUND'};
  if(!response.ok)return {status:'HTTP_ERROR',httpStatus:response.status};
  if(response.status===204)return {status:'OK'};
  return {status:'OK',body:await response.json()};
 }
 async function snapshot(playlistId){
  validateId(playlistId);
  const ids=new Set(),episodeUrls=[];let offset=0,limit=100;
  for(let page=0;page<100;page++){
   const result=await request('/playlists/'+playlistId+'/items?limit='+limit+'&offset='+offset+'&additional_types=episode');
   if(result.status!=='OK')return {...result,complete:false,episodeUrls:[]};
   const body=result.body;
   if(!body||!Array.isArray(body.items)||!Number.isInteger(body.total))return {status:'INVALID_RESPONSE',complete:false,episodeUrls:[]};
   for(const item of body.items){
    const obj=item?.item||item?.track;
    if(obj?.type!=='episode'||!SPOTIFY_ID.test(String(obj.id||'')))continue;
    if(!ids.has(obj.id)){ids.add(obj.id);episodeUrls.push('https://open.spotify.com/episode/'+obj.id);}
   }
   offset+=body.items.length;
   if(offset>=body.total)return {status:'COMPLETE_VERIFIED',complete:true,episodeUrls,total:body.total};
   if(body.items.length===0)return {status:'INCOMPLETE_SNAPSHOT',complete:false,episodeUrls:[]};
  }
  return {status:'PAGINATION_LIMIT',complete:false,episodeUrls:[]};
 }
 async function addVerifiedItems({playlistId,spotifyIds,explicitApproval=false,verifiedSnapshot=false}={}){
  validateId(playlistId);
  if(!explicitApproval||!verifiedSnapshot)return {status:'HOLD_NOT_APPROVED',writes:0};
  if(!Array.isArray(spotifyIds)||spotifyIds.length===0)return {status:'NO_ITEMS',writes:0};
  if(spotifyIds.length>100||spotifyIds.some(id=>!SPOTIFY_ID.test(String(id||'')))||new Set(spotifyIds).size!==spotifyIds.length)
   return {status:'HOLD_INVALID_ITEMS',writes:0};
  const result=await request('/playlists/'+playlistId+'/items',{method:'POST',body:JSON.stringify({uris:spotifyIds.map(id=>'spotify:episode:'+id)})});
  return result.status==='OK'?{status:'SUBMITTED',writes:spotifyIds.length,snapshotId:result.body?.snapshot_id||null}:{...result,writes:0};
 }
 return {snapshot,addVerifiedItems};
}
export {makeSpotifyPlaylistClient};
