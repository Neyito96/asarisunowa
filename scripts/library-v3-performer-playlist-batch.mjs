/**
 * Issue #231: one RSS/library change stream -> many performer playlists.
 * READ-ONLY planner. No network, GAS trigger, OAuth, Spotify or sheet writes.
 * Input contract: subscriptions [{personName,playlistId,enabled,showOnSite}],
 * episodes [{epId,publishedAt,people:[{name,role,evidenceStatus,source}],
 * spotifyUrl,spotifyEvidenceStatus,identityStatus,deleted,excluded,
 * artworkUrl,artworkEvidenceStatus}], playlistSnapshots keyed by playlistId.
 * A snapshot must be obtained from Spotify under an authorized account.
 */
const SP_EP=/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/;
const SP_PL=/^[A-Za-z0-9]{22}$/;
const ROLES=new Set(['出演','MC','司会','ゲスト','聞き手','host','guest']);
const idFromUrl=url=>String(url||'').trim().match(SP_EP)?.[1]||null;
const cleanName=name=>String(name||'').normalize('NFKC').trim().replace(/\s+/g,'');
function planPerformerPlaylistBatch({subscriptions=[],episodes=[],playlistSnapshots={},now=''}={}){
 const reference=new Date(now||Date.now());
 if(Number.isNaN(reference.getTime()))throw Error('Invalid now');
 const seenSubscription=new Set(),plans=[],holds=[];
 for(const sub of subscriptions){
  if(!sub.enabled)continue;
  const name=cleanName(sub.personName),playlistId=String(sub.playlistId||'').trim();
  if(!name||!SP_PL.test(playlistId)){holds.push({personName:name,reason:'INVALID_SUBSCRIPTION'});continue;}
  const key=name+'|'+playlistId;
  if(seenSubscription.has(key)){holds.push({personName:name,playlistId,reason:'DUPLICATE_SUBSCRIPTION'});continue;}
  seenSubscription.add(key);
  const snapshot=playlistSnapshots[playlistId];
  if(!snapshot||snapshot.status!=='COMPLETE_VERIFIED'||!Array.isArray(snapshot.episodeUrls)){
   holds.push({personName:name,playlistId,reason:'PLAYLIST_SNAPSHOT_UNAVAILABLE'});
   continue;
  }
  const existing=new Set(snapshot.episodeUrls.map(idFromUrl).filter(Boolean));
  const proposed=new Set(),add=[],episodeHolds=[],matched=[];
  let latestDate=null,latestArtwork=null;
  for(const ep of episodes){
   const people=(ep.people||[]).filter(p=>cleanName(p.name)===name&&
     p.evidenceStatus==='VERIFIED'&&ROLES.has(p.role));
   if(!people.length)continue;
   const epId=String(ep.epId||'');
   if(!/^EP-\d+$/.test(epId)||ep.deleted||ep.excluded||ep.identityStatus!=='EXACT'){
    episodeHolds.push({epId,reason:'EPISODE_PROTECTED_OR_UNVERIFIED'});continue;
   }
   const published=new Date(ep.publishedAt);
   if(Number.isNaN(published.getTime())){
    episodeHolds.push({epId,reason:'INVALID_PUBLISHED_DATE'});continue;
   }
   matched.push(epId);
   if(!latestDate||published>new Date(latestDate)){
    latestDate=published.toISOString();
    latestArtwork=ep.artworkEvidenceStatus==='VERIFIED'?ep.artworkUrl||null:null;
   }
   const id=idFromUrl(ep.spotifyUrl);
   if(!id||ep.spotifyEvidenceStatus!=='VERIFIED'){
    episodeHolds.push({epId,reason:'SPOTIFY_EPISODE_UNVERIFIED'});continue;
   }
   if(existing.has(id))continue;
   if(proposed.has(id)){episodeHolds.push({epId,reason:'DUPLICATE_EPISODE_ID'});continue;}
   proposed.add(id);
   add.push({epId,spotifyId:id,spotifyUrl:'https://open.spotify.com/episode/'+id});
  }
  plans.push({personName:name,playlistId,matchedEpisodeCount:matched.length,
   matchedEpIds:matched,add,holds:episodeHolds,latestPublishedAt:latestDate,
   artworkUrl:latestArtwork,showOnSite:Boolean(sub.showOnSite),
   // New rice: published within the last year. "NEW" is 30 days separately.
   newRice:latestDate?reference-new Date(latestDate)<365*86400000&&reference>=new Date(latestDate):false,
   newBadge:latestDate?reference-new Date(latestDate)<30*86400000&&reference>=new Date(latestDate):false,
   writes:0,status:'READ_ONLY_PLAN'});
 }
 return {status:'READ_ONLY',plans,holds,writes:0,spotifyWrites:0,siteWrites:0};
}
export {planPerformerPlaylistBatch};
