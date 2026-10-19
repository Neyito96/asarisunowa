/**
 * Existing-EP audio URL ONE-CELL copy pilot. No side effects at load.
 * Preview is read-only. Save requires a separately approved planHash.
 * Never writes to source ledger, state, history, properties, triggers, Spotify.
 */
function previewLibraryV3AudioCopyOne(){
  return libV3AudioCopyPlan_({
    copySheetId:'19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc',
    show:'ニュースの現場から',
    id:'EP-03855',
    guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6'
  }).report;
}
function libV3AudioCopyPlan_(o){
  if(!o||o.show!=='ニュースの現場から'||!/^EP-\d{5}$/.test(o.id||'')||
     libV2CpGuid_(o.guid)!==o.guid)throw Error('Explicit show/EP-ID/GUID required');
  const source=libV3Context_(false);
  const feeds=source.feeds.filter(f=>f.show===o.show);
  if(feeds.length!==1)throw Error('Expected one official RSS feed');
  const feed=feeds[0];
  // Reuse production/copy denylist. This does not write.
  libV3CopyPilotId_({copySheetId:o.copySheetId,guid:o.guid,feedUrl:feed.url});
  const copy=libV3Context_(false,{copySheetId:o.copySheetId,guid:o.guid,feedUrl:feed.url});
  if(source.ss.getId()===copy.ss.getId())throw Error('Source and copy are the same');
  const sourceIds=source.index.ids.get(o.id)||[],copyIds=copy.index.ids.get(o.id)||[];
  if(sourceIds.length!==1||copyIds.length!==1)throw Error('EP-ID missing or duplicated');
  const si=sourceIds[0],ci=copyIds[0],sr=source.rows[si],cr=copy.rows[ci];
  if(sr[1]!==o.show||cr[1]!==o.show||String(sr[0])!==String(cr[0]))throw Error('EP/show mismatch');
  if(libV3Text_(sr[14]))throw Error('Source audio is no longer blank');
  // Allow only a previously saved identical URL on copy; reject any other divergence.
  const sameExceptAudio=libV3Hash_(sr.map((v,i)=>i===14?'':v))===
    libV3Hash_(cr.map((v,i)=>i===14?'':v));
  if(!sameExceptAudio)throw Error('Copy row diverged outside audio column');
  const sourceMatches=libV2CpMatches_(o.guid,source.index.guid,source.index.anchor);
  const copyMatches=libV2CpMatches_(o.guid,copy.index.guid,copy.index.anchor);
  if(sourceMatches.length!==1||sourceMatches[0]!==si||
     copyMatches.length!==1||copyMatches[0]!==ci)throw Error('Identity not unique in both ledgers');
  if(source.index.tomb.gs.has(o.guid)||copy.index.tomb.gs.has(o.guid)||
     source.index.tomb.is.has(o.id)||copy.index.tomb.is.has(o.id))throw Error('Excluded identity');
  const sPrior=source.index.states.get(o.id+'|audio');
  const cPrior=copy.index.states.get(o.id+'|audio');
  for(const prior of [sPrior,cPrior]){
    if(prior&&(['HOLD','RECHECK_REQUIRED'].includes(prior[2])||
       (prior[6]&&prior[6]!==libV3Hash_(''))))throw Error('Audio state requires review');
  }
  if(source.sh.getRange(si+2,15).getFormula()||copy.sh.getRange(ci+2,15).getFormula())
    throw Error('Formula protected');
  const metrics={apiCalls:0};
  const snap=libV2CpSnapshot_(feed.url,false,{offset:0,hash:''},metrics,
    {prefix:'LV3CP',timeoutSeconds:45,parse:t=>libV2CpParse_(t,true)});
  if(snap.status)throw Error('RSS unavailable: '+snap.status);
  const hits=snap.items.filter(it=>it.guid===o.guid);
  if(hits.length!==1)throw Error('RSS GUID missing or duplicated');
  const it=hits[0];
  const reasons=libV2CpRowReasons_(it,o.show,sr,source.index.ids,source.index.tomb);
  if(reasons.length)throw Error('Metadata hold: '+reasons.join('|'));
  if(!/^https:\/\//.test(it.audio||''))throw Error('RSS audio URL missing or not HTTPS');
  const copyCurrent=libV3Text_(cr[14]);
  if(copyCurrent&&copyCurrent!==it.audio)throw Error('Copy audio differs from official RSS');
  const status=copyCurrent===''+''?'READY_FOR_APPROVAL':'ALREADY_PRESENT';
  const planHash=libV3Hash_([o.copySheetId,o.id,o.guid,feed.url,
    libV3Hash_(sr),libV3Hash_(cr),libV3Hash_(it),snap.hash||'']);
  const report={mode:'READ_ONLY_AUDIO_COPY_ONE',status,show:o.show,id:o.id,
    copySheetId:o.copySheetId,guid:o.guid,sourceRow:si+2,copyRow:ci+2,
    sourceAudioBlank:true,copyAudioBlank:!copyCurrent,
    sourceHost:String(it.audio).split('/')[2]||'',
    sourceSnapshotHash:snap.hash||'',planHash,
    proposedCells:status==='READY_FOR_APPROVAL'?1:0,
    writes:0,propertyWrites:0,spotifyPosts:0,playbackVerified:false};
  Logger.log(JSON.stringify(report));
  return {source,copy,si,ci,it,report};
}
/** No zero-argument save function: explicit approval must provide the plan hash. */
function saveLibraryV3AudioCopyOneAfterApproval(options){
  if(!options||options.approved!==true||!options.approvedPlanHash||
     !options.copySheetId||!options.id||!options.guid||!options.show)
    throw Error('Explicit approval, copy ID, EP-ID, GUID, and plan hash required');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {status:'BUSY',writes:0};
  try{
    const p=libV3AudioCopyPlan_(options),r=p.report;
    if(r.status==='ALREADY_PRESENT')return {status:'ALREADY_PRESENT',id:r.id,writes:0};
    if(r.status!=='READY_FOR_APPROVAL'||r.planHash!==options.approvedPlanHash)
      throw Error('Approval hash mismatch or stale plan');
    // Recheck the exact cell immediately before the only write.
    const cell=p.copy.sh.getRange(p.ci+2,15);
    if(cell.getFormula()||libV3Text_(cell.getValue()))throw Error('Cell changed since preview');
    if(p.copy.sh.getRange(p.ci+2,1).getValue()!==r.id)throw Error('Row identity changed');
    cell.setValue(p.it.audio);
    SpreadsheetApp.flush();
    if(String(cell.getValue())!==p.it.audio)throw Error('Post-write verification failed');
    const out={status:'COPY_AUDIO_SAVED',id:r.id,copySheetId:r.copySheetId,
      writtenCells:1,writes:1,propertyWrites:0,spotifyPosts:0};
    Logger.log(JSON.stringify(out));return out;
  }finally{lock.releaseLock();}
}
