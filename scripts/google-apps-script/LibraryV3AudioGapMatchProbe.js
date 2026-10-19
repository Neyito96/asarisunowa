/** Phase 6 / P0-A: READ ONLY audio gap matching. No sheets/properties/triggers writes.
 * One show per run to avoid GAS timeouts. Inspects entire feed snapshot,
 * but does NOT verify audio playback or authorize filling cells.
 */
function previewLibraryV3AudioGapMatch(){
  const show='ニュースの現場から'; // change only this show for subsequent runs
  return libV3AudioGapMatchOne_(show);
}
function libV3AudioGapMatchOne_(show){
  const allowed=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ'];
  if(allowed.indexOf(show)<0)throw Error('Show not allowed');
  const started=Date.now(),m={mode:'READ_ONLY_V3_AUDIO_GAP_MATCH',show,writes:0,propertyWrites:0,triggerChanges:0,playbackVerified:false,apiCalls:0};
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {...m,status:'BUSY'};
  try{
    const c=libV3Context_(false),feeds=c.feeds.filter(f=>f.show===show);
    m.feedCount=feeds.length;
    if(feeds.length!==1){m.status='FEED_CONFIG_REVIEW';return m;}
    const feed=feeds[0];m.feedUrl=feed.url;
    const missing=c.rows.filter(r=>r[1]===show&&!libV3Text_(r[14]));
    m.ledgerMissingAudio=missing.length;
    const snap=libV2CpSnapshot_(feed.url,false,{offset:0,hash:''},m,{prefix:'LV3CP',timeoutSeconds:45,parse:t=>libV2CpParse_(t,true)});
    if(snap.status){m.status=snap.status;m.retry=snap.retry;return m;}
    m.feedItems=snap.items.length;
    const guidCounts=new Map();
    snap.items.forEach(it=>{if(it.guid)guidCounts.set(it.guid,(guidCounts.get(it.guid)||0)+1);});
    const stats={exactAudioCandidates:0,alreadyAudio:0,matchedButNoAudio:0,unmatched:0,ambiguous:0,held:0,blankGuid:0};
    const examples={exactAudioCandidates:[],unmatched:[],held:[]};
    for(const it of snap.items){
      if(!it.guid){stats.blankGuid++;continue;}
      if(guidCounts.get(it.guid)!==1){stats.ambiguous++;continue;}
      const matches=libV2CpMatches_(it.guid,c.index.guid,c.index.anchor);
      if(matches.length!==1){if(matches.length>1)stats.ambiguous++;else stats.unmatched++;
        if(examples.unmatched.length<8)examples.unmatched.push({guid:it.guid,title:it.title});continue;}
      const i=matches[0],r=c.rows[i],id=String(r[0]);
      const reasons=libV2CpRowReasons_(it,show,r,c.index.ids,c.index.tomb);
      if(reasons.length||r[1]!==show){stats.held++;if(examples.held.length<8)examples.held.push({id,guid:it.guid,reasons});continue;}
      if(libV3Text_(r[14])){stats.alreadyAudio++;continue;}
      if(!/^https:\/\//.test(it.audio||'')){stats.matchedButNoAudio++;continue;}
      stats.exactAudioCandidates++;
      if(examples.exactAudioCandidates.length<12)examples.exactAudioCandidates.push({id,guid:it.guid,title:it.title,date:it.date,audioHost:String(it.audio).split('/')[2]||''});
    }
    m.stats=stats;m.examples=examples;m.status='READ_ONLY';
    return m;
  }catch(e){m.status='FAILED';m.error=String(e).slice(0,300);return m;}
  finally{m.elapsedMs=Date.now()-started;lock.releaseLock();Logger.log(JSON.stringify(m));}
}
