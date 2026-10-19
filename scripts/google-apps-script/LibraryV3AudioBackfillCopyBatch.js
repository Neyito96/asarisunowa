/**
 * Historical AUDIO URL backfill, isolated COPY only.
 * One manual run processes at most 60 cells; rerun for the next 60.
 * NO trigger installation and NO production writes. Explicit opt-in only.
 */
function runLibraryV3AudioBackfillCopyBatch(){
  return libV3AudioBackfillCopyBatch_({
    copySheetId:'19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc',
    show:'ニュースの現場から',maxWrites:60,approved:true
  });
}
function libV3AudioBackfillCopyBatch_(o){
  if(!o||o.approved!==true||o.show!=='ニュースの現場から'||
     !Number.isInteger(o.maxWrites)||o.maxWrites<1||o.maxWrites>60)
    throw Error('Explicit copy-only approval and maxWrites 1..60 required');
  const started=Date.now(),lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {status:'BUSY',writes:0};
  const m={mode:'COPY_ONLY_AUDIO_BACKFILL_BATCH',status:'',writes:0,
    copySheetId:o.copySheetId,show:o.show,maxWrites:o.maxWrites,
    propertyWrites:0,triggerChanges:0,spotifyPosts:0,sourceWrites:0,
    skipped:{},samples:[]};
  const skip=(reason)=>{m.skipped[reason]=(m.skipped[reason]||0)+1;};
  try{
    // libV3CopyPilotId_ is the established production/copy guard.
    const source=libV3Context_(false),feeds=source.feeds.filter(f=>f.show===o.show);
    if(feeds.length!==1)throw Error('Official feed not unique');
    const feed=feeds[0];
    libV3CopyPilotId_({copySheetId:o.copySheetId,guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feed.url});
    const copy=libV3Context_(false,{copySheetId:o.copySheetId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feed.url});
    if(source.ss.getId()===copy.ss.getId()||copy.ss.getId()!==o.copySheetId)
      throw Error('Copy ID not isolated');
    if(source.rows.length!==copy.rows.length)throw Error('Copy/source row counts differ');
    // Batch-read formulas once (not per candidate).
    const formulas=copy.sh.getRange(2,15,copy.rows.length,1).getFormulas();
    const metrics={apiCalls:0};
    const snap=libV2CpSnapshot_(feed.url,false,{offset:0,hash:''},metrics,
      {prefix:'LV3CP',timeoutSeconds:45,parse:t=>libV2CpParse_(t,true)});
    if(snap.status)throw Error('RSS unavailable: '+snap.status);
    m.sourceSnapshotHash=snap.hash||'';m.feedItems=snap.items.length;
    const guidCounts=new Map();
    snap.items.forEach(it=>{if(it.guid)guidCounts.set(it.guid,(guidCounts.get(it.guid)||0)+1);});
    const plans=[],seenIds=new Set();
    for(const it of snap.items){
      if(Date.now()-started>245000){m.status='TIME_BUDGET';break;}
      if(!it.guid||guidCounts.get(it.guid)!==1){skip('rss_guid_duplicate');continue;}
      const src=libV2CpMatches_(it.guid,source.index.guid,source.index.anchor);
      const dst=libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor);
      if(src.length!==1||dst.length!==1){skip('identity_ambiguous_or_missing');continue;}
      const si=src[0],ci=dst[0],sr=source.rows[si],cr=copy.rows[ci],id=String(sr[0]);
      if(si!==ci||id!==String(cr[0])||sr[1]!==o.show||cr[1]!==o.show){
        skip('copy_source_identity_mismatch');continue;
      }
      if(seenIds.has(id)){skip('duplicate_ep_candidate');continue;}
      seenIds.add(id);
      if(libV2CpRowReasons_(it,o.show,sr,source.index.ids,source.index.tomb).length||
         libV2CpRowReasons_(it,o.show,cr,copy.index.ids,copy.index.tomb).length){
        skip('metadata_hold');continue;
      }
      if(libV3Text_(sr[14])){skip('source_audio_exists');continue;}
      if(libV3Text_(cr[14])){skip('copy_audio_exists');continue;}
      if(formulas[ci][0]){skip('formula_protected');continue;}
      if(!/^https:\/\//.test(it.audio||'')){skip('missing_https_audio');continue;}
      if(libV3Hash_(sr.map((v,j)=>j===14?'':v))!==
         libV3Hash_(cr.map((v,j)=>j===14?'':v))){skip('copy_row_diverged');continue;}
      const sp=source.index.states.get(id+'|audio'),cp=copy.index.states.get(id+'|audio');
      if([sp,cp].some(p=>p&&(['HOLD','RECHECK_REQUIRED'].includes(p[2])||
         (p[6]&&p[6]!==libV3Hash_(''))))){skip('state_hold');continue;}
      plans.push({id,ci,si,guid:it.guid,audio:it.audio});
      if(plans.length>=o.maxWrites)break;
    }
    // Revalidate cell contents and ID immediately before each write.
    // No sheet rows are inserted, deleted or reordered.
    for(const p of plans){
      if(Date.now()-started>270000){m.status='TIME_BUDGET';break;}
      const row=p.ci+2,cell=copy.sh.getRange(row,15);
      if(cell.getFormula()||libV3Text_(cell.getValue())||
         String(copy.sh.getRange(row,1).getValue())!==p.id){
        skip('changed_before_write');continue;
      }
      cell.setValue(p.audio);
      if(String(cell.getValue())!==p.audio)throw Error('Post-write verification failed for '+p.id);
      m.writes++;
      if(m.samples.length<10)m.samples.push({id:p.id,row});
    }
    if(!m.status)m.status='COPY_BATCH_DONE';
    m.remainingEstimate='not_computed';
    return m;
  }catch(e){m.status='FAILED';m.error=String(e).slice(0,500);return m;}
  finally{m.elapsedMs=Date.now()-started;lock.releaseLock();Logger.log(JSON.stringify(m));}
}
