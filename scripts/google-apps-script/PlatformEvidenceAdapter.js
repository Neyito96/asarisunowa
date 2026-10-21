var PLATFORM_EVIDENCE_APPLE_LAST_AT_ = 0;
/** Network adapter reuses the original ポすすめ structured RSS readers.
 * Pure decisions live in PlatformEvidence; no writes, properties or triggers here.
 * Callers may provide a rate-limited request function for Apple.
 */
function resolvePodcastPlatformsByEvidence_(title, sourceUrl, explicitRss, requestApple) {
  const E=PodcastPlatformEvidence, rss=E.publicUrl(explicitRss);
  const source=E.classifyPlatformUrl(sourceUrl);
  const resolved={rss:rss,artwork:'',genre:'',host:''};
  const urls=[];
  if(source.level==='programme'||source.level==='website')urls.push(sourceUrl);
  if(rss) readPodcastFeedLinks_(rss).forEach(function(url){if(E.publicUrl(url)!==rss)urls.push(url);});
  const channel=E.confirmedProgrammeLinks(urls);
  Object.keys(channel.links).forEach(function(k){resolved[k]=channel.links[k];});
  const metadata=rss?readPodcastFeedMetadata_(rss):null;
  if(metadata){resolved.artwork=E.publicUrl(metadata.artwork);resolved.genre=String(metadata.genre||'');resolved.host=String(metadata.maker||'');}
  const appleId=source.provider==='apple'&&source.level==='programme'?source.id:'';
  const evidence={state:'HOLD',reason:'NO_IDENTITY',held:channel.held};
  if(!rss&&!appleId)return {resolved:resolved,evidence:evidence};
  const endpoint=appleId?'https://itunes.apple.com/lookup?entity=podcast&id='+encodeURIComponent(appleId):
    'https://itunes.apple.com/search?media=podcast&entity=podcast&country=JP&limit=25&term='+encodeURIComponent(String(title||''));
  const request=requestApple||function(url){
    const wait=Math.max(0,3100-(Date.now()-PLATFORM_EVIDENCE_APPLE_LAST_AT_));
    if(wait)Utilities.sleep(wait);
    PLATFORM_EVIDENCE_APPLE_LAST_AT_=Date.now();
    const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
    if(res.getResponseCode()!==200)throw Error('APPLE_HTTP_'+res.getResponseCode());
    return JSON.parse(res.getContentText());
  };
  try {
    const data=request(endpoint), match=E.matchAppleProgramme({rss:rss,url:sourceUrl},data.results||[]);
    evidence.state=match.state;evidence.reason=match.reason;
    if(match.state==='MATCH'){
      const item=match.item;
      resolved.apple=E.classifyPlatformUrl(item.collectionViewUrl||item.trackViewUrl).url;
      resolved.rss=rss||E.publicUrl(item.feedUrl);
      resolved.artwork=resolved.artwork||E.publicUrl(item.artworkUrl600||item.artworkUrl100);
      resolved.genre=resolved.genre||String(item.primaryGenreName||'');
      resolved.host=resolved.host||String(item.artistName||'');
    }
  }catch(error){evidence.state=/RUN_DEFERRED/.test(String(error))?'DEFERRED':'FAILED';evidence.reason=/RUN_DEFERRED/.test(String(error))?'RUN_BUDGET':/APPLE_HTTP_429/.test(String(error))?'RATE_LIMIT':'APPLE_FETCH_FAILED';}
  return {resolved:resolved,evidence:evidence};
}

/** Library adapter: no Spotify lookup or writes. Feed + GUID/audio evidence required. */
function LIBRARY_matchPlatformEpisodeReadOnly(anchor, candidates) {
  return PodcastPlatformEvidence.matchEpisode(anchor,candidates);
}
