/**
 * P0-A: audio URL candidate safety audit for EXISTING ledger rows.
 * READ ONLY: no sheet writes, properties, triggers or Spotify calls.
 * The full Omny RSS snapshot may take ~3 minutes. Run one show at a time.
 * Audio-column formulas are fetched in ONE range read, not one call per candidate.
 * No audio URL is logged; only the source host and EP-ID.
 */
function previewLibraryV3ExistingAudioSafety(){
  return libV3ExistingAudioSafety_('ニュースの現場から');
}
function libV3ExistingAudioSafety_(show){
  const permitted=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ'];
  if(!permitted.includes(show))throw Error('Unsupported show');
  const m={mode:'READ_ONLY_V3_EXISTING_AUDIO_SAFETY',show,status:'',writes:0,propertyWrites:0,triggerChanges:0,spotifyPosts:0,playbackVerified:false};
  const start=Date.now(),lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {...m,status:'BUSY'};
  try{
    const c=libV3Context_(false),feeds=c.feeds.filter(f=>f.show===show);
    if(feeds.length!==1){m.status='FEED_CONFIG_HOLD';m.feedCount=feeds.length;return m;}
    const feed=feeds[0],metrics={apiCalls:0};
    const snap=libV2CpSnapshot_(feed.url,false,{offset:0,hash:''},metrics,{prefix:'LV3CP',timeoutSeconds:45,parse:t=>libV2CpParse_(t,true)});
    m.apiCalls=metrics.apiCalls||1;
    if(snap.status){m.status=snap.status;m.retry=snap.retry;return m;}
    // One Spreadsheet service call instead of ~2,162 calls. Header row excluded.
    const audioFormulas=c.sh.getRange(2,15,c.rows.length,1).getFormulas();
    const counts=new Map();
    snap.items.forEach(it=>{if(it.guid)counts.set(it.guid,(counts.get(it.guid)||0)+1);});
    const stats={feedItems:snap.items.length,identityMatched:0,uniqueCandidateEpisodes:0,duplicateEpisodeCandidates:0,
      formulaProtected:0,existingAudio:0,missingSourceAudio:0,identityAmbiguous:0,identityMissing:0,
      metadataHold:0,excludedHold:0,sourceGuidDuplicate:0,nonHttpsAudio:0};
    const samples={safe:[],held:[]},candidates=new Map(),holdReasons={};
    const hold=(reason,id,guid)=>{holdReasons[reason]=(holdReasons[reason]||0)+1;
      if(samples.held.length<15)samples.held.push({reason,id:id||'',guid:guid||''});};
    for(const it of snap.items){
      if(!it.guid||counts.get(it.guid)!==1){stats.sourceGuidDuplicate++;hold('source_guid_blank_or_duplicate','',it.guid);continue;}
      const matches=libV2CpMatches_(it.guid,c.index.guid,c.index.anchor);
      if(matches.length!==1){if(matches.length)stats.identityAmbiguous++;else stats.identityMissing++;
        hold(matches.length?'ledger_identity_ambiguous':'ledger_identity_missing','',it.guid);continue;}
      const i=matches[0],r=c.rows[i],id=String(r[0]);stats.identityMatched++;
      const reasons=libV2CpRowReasons_(it,show,r,c.index.ids,c.index.tomb);
      if(r[1]!==show||reasons.length){stats.metadataHold++;if(reasons.some(x=>/delet|exclu|block/i.test(x)))stats.excludedHold++;
        hold('metadata_or_exclusion_hold:'+reasons.join('|'),id,it.guid);continue;}
      if(libV3Text_(r[14])){stats.existingAudio++;continue;}
      if(!/^https:\/\//.test(it.audio||'')){stats.missingSourceAudio++;hold('source_audio_not_https',id,it.guid);continue;}
      // Spreadsheet row number: header is row 1. audio is r[14] = column 15.
      if(audioFormulas[i][0]){stats.formulaProtected++;hold('formula_protected',id,it.guid);continue;}
      const prior=c.index.states.get(id+'|audio');
      if(prior&&(['HOLD','RECHECK_REQUIRED'].includes(prior[2])||
          (prior[6]&&prior[6]!==libV3Hash_(r[14]||'')))){
        hold('existing_audio_state_requires_review',id,it.guid);continue;
      }
      if(candidates.has(id)){stats.duplicateEpisodeCandidates++;hold('duplicate_ep_candidate',id,it.guid);continue;}
      candidates.set(id,{id,guid:it.guid,host:String(it.audio).split('/')[2]||'',
        rowHash:libV3Hash_(r),sourceHash:libV3Hash_(it)});
    }
    // A candidate EP-ID must occur exactly once across the entire source snapshot.
    // Quarantine every repeated ID, including the first occurrence.
    const candidateOwners=new Map();
    for(const [id,v] of candidates){candidateOwners.set(id,(candidateOwners.get(id)||0)+1);}
    stats.uniqueCandidateEpisodes=candidates.size;
    samples.safe=[...candidates.values()].slice(0,15);
    m.stats=stats;m.holdReasons=holdReasons;m.samples=samples;
    m.sourceSnapshotHash=snap.hash||'';m.formulaReadMode='BULK_ONCE';m.status='READ_ONLY';
    return m;
  }catch(e){m.status='FAILED';m.error=String(e).slice(0,400);return m;}
  finally{m.elapsedMs=Date.now()-start;lock.releaseLock();Logger.log(JSON.stringify(m));}
}
