/**
 * Historical AUDIO URL backfill, isolated COPY only.
 * One manual run processes at most 60 cells; rerun for the next 60.
 * NO trigger installation and NO production writes. Explicit opt-in only.
 */
function runLibraryV3AudioBackfillCopyBatch(){
  return libV3AudioBackfillCopyBatch_({
    copySheetId:'19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc',
    show:'ニュースの現場から',maxWrites:25,approved:true
  });
}
function libV3AudioBackfillCopyBatch_(o){
  if(!o||o.approved!==true||o.show!=='ニュースの現場から'||
     !Number.isInteger(o.maxWrites)||o.maxWrites<1||o.maxWrites>25)
    throw Error('Explicit copy-only approval and maxWrites 1..25 required');
  const started=Date.now(),lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {status:'BUSY',writes:0};
  const m={mode:'COPY_ONLY_AUDIO_BACKFILL_BATCH',status:'',writes:0,
    copySheetId:o.copySheetId,show:o.show,maxWrites:o.maxWrites,
    propertyWrites:0,triggerChanges:0,spotifyPosts:0,sourceWrites:0,
    skipped:{},samples:[]};
  const skip=(reason)=>{m.skipped[reason]=(m.skipped[reason]||0)+1;};
  try{
    // libV3CopyPilotId_ is the established production/copy guard.
    const tContext=Date.now();
    const source=libV3Context_(false),feeds=source.feeds.filter(f=>f.show===o.show);
    m.sourceContextMs=Date.now()-tContext;
    if(feeds.length!==1)throw Error('Official feed not unique');
    const feed=feeds[0];
    libV3CopyPilotId_({copySheetId:o.copySheetId,guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feed.url});
    const tCopy=Date.now();
    const copy=libV3Context_(false,{copySheetId:o.copySheetId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feed.url});
    m.copyContextMs=Date.now()-tCopy;
    if(source.ss.getId()===copy.ss.getId()||copy.ss.getId()!==o.copySheetId)
      throw Error('Copy ID not isolated');
    if(source.rows.length!==copy.rows.length)throw Error('Copy/source row counts differ');
    // Batch-read formulas once (not per candidate).
    const tFormula=Date.now();
    const formulas=copy.sh.getRange(2,15,copy.rows.length,1).getFormulas();
    m.formulaReadMs=Date.now()-tFormula;
    const metrics={apiCalls:0};
    const tRss=Date.now();
    const snap=libV3AudioCachedSnapshot_(feed.url,metrics);
    m.rssMs=Date.now()-tRss;
    m.rssCacheHit=!!snap.cacheHit;
    if(snap.compressedChunks)m.compressedChunks=snap.compressedChunks;
    if(snap.cachePrepared){m.status='RSS_CACHE_PREPARED';return m;}
    if(snap.status)throw Error('RSS unavailable: '+snap.status);
    m.sourceSnapshotHash=snap.hash||'';m.feedItems=snap.items.length;
    const guidCounts=new Map();
    snap.items.forEach(it=>{if(it.guid)guidCounts.set(it.guid,(guidCounts.get(it.guid)||0)+1);});
    const plans=[],seenIds=new Set(),tMatch=Date.now();
    for(const it of snap.items){
      if(Date.now()-started>215000){m.status='TIME_BUDGET';break;}
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
    m.matchMs=Date.now()-tMatch;
    // Revalidate cell contents and ID immediately before each write.
    // No sheet rows are inserted, deleted or reordered.
    for(const p of plans){
      if(Date.now()-started>240000){m.status='TIME_BUDGET';break;}
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
    if(!m.status)m.status=m.writes?'COPY_BATCH_DONE':'NO_ELIGIBLE_CANDIDATES';
    m.remainingEstimate='not_computed';
    return m;
  }catch(e){m.status='FAILED';m.error=String(e).slice(0,500);return m;}
  finally{m.elapsedMs=Date.now()-started;lock.releaseLock();Logger.log(JSON.stringify(m));}
}

/**
 * Short-lived RSS cache, split into chunks because CacheService has a 100KB/item limit.
 * First call on a cold cache ONLY warms cache and returns without any cell writes.
 * This avoids coupling slow 2,650-item Omny retrieval to write time.
 */
function libV3AudioCachedSnapshot_(feedUrl,metrics){
  const cache=CacheService.getScriptCache();
  // New key/version invalidates the oversized uncompressed cache attempt.
  const key='LV3AZ2_'+libV3Hash_(feedUrl).slice(0,28);
  const metaText=cache.get(key+'_meta');
  if(metaText){
    try{
      const meta=JSON.parse(metaText);
      if(meta.v===2&&meta.chunks>0&&meta.chunks<=80){
        const keys=Array.from({length:meta.chunks},(_,i)=>key+'_'+i);
        const blobs=cache.getAll(keys);
        if(keys.every(k=>typeof blobs[k]==='string')){
          const base64=keys.map(k=>blobs[k]).join('');
          const compressed=Utilities.base64Decode(base64);
          const json=Utilities.ungzip(Utilities.newBlob(compressed)).getDataAsString('UTF-8');
          if(libV3Hash_(json)===meta.dataHash){
            const items=JSON.parse(json);
            if(items.length===meta.count)
              return {items,hash:meta.hash,cacheHit:true};
          }
        }
      }
    }catch(e){/* cache eviction or corruption: safely fetch again */}
  }
  const snap=libV2CpSnapshot_(feedUrl,false,{offset:0,hash:''},metrics,
    {prefix:'LV3CP',timeoutSeconds:45,parse:t=>libV2CpParse_(t,true)});
  if(snap.status)return snap;
  // Compress UTF-8 JSON in one operation. The previous per-character
  // encodeURIComponent loop was quadratic-like and hit the time budget.
  const json=JSON.stringify(snap.items);
  const gzip=Utilities.gzip(Utilities.newBlob(json,'application/json','rss.json'));
  const base64=Utilities.base64Encode(gzip.getBytes());
  // Base64 is ASCII: safe fixed-size slicing, well below 100KB per cache item.
  const chunkSize=50000, count=Math.ceil(base64.length/chunkSize);
  if(count<1||count>80)throw Error('Compressed RSS still too large for cache: '+count+' chunks');
  const entries={};
  for(let i=0;i<count;i++)entries[key+'_'+i]=base64.slice(i*chunkSize,(i+1)*chunkSize);
  cache.putAll(entries,21600);
  // Publish metadata last; partial caches are ignored and rebuilt.
  cache.put(key+'_meta',JSON.stringify({
    v:2,chunks:count,count:snap.items.length,
    hash:snap.hash||'',dataHash:libV3Hash_(json)
  }),21600);
  return {cachePrepared:true,items:[],hash:snap.hash||'',cacheHit:false,
    compressedChunks:count};
}
/**
 * Install ONLY this handler in the isolated GAS project.
 * Manual first-batch verification is required before invoking.
 * Never call in production GAS.
 */
function installLibraryV3AudioBackfillEvery10Min(){
  const o={copySheetId:'19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc',
    show:'ニュースの現場から',maxWrites:25,approved:true};
  const source=libV3Context_(false);
  const feeds=source.feeds.filter(f=>f.show===o.show);
  if(feeds.length!==1)throw Error('Feed config invalid');
  libV3CopyPilotId_({copySheetId:o.copySheetId,
    guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
  const copy=libV3Context_(false,{copySheetId:o.copySheetId,
    guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
  if(source.ss.getId()===copy.ss.getId())throw Error('Production target prohibited');
  const handler='runLibraryV3AudioBackfillCopyBatchScheduled';
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler);
  if(existing.length>1)throw Error('Duplicate backfill triggers: stop and review');
  if(existing.length===1)return {status:'ALREADY_INSTALLED',triggers:1};
  PropertiesService.getScriptProperties().setProperty('LV3A_BACKFILL_FAILURES','0');
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(10).create();
  return {status:'INSTALLED_COPY_ONLY',intervalMinutes:10,maxWrites:25,triggers:1};
}
function runLibraryV3AudioBackfillCopyBatchScheduled(){
  const props=PropertiesService.getScriptProperties();
  const r=runLibraryV3AudioBackfillCopyBatch();
  const n=Number(props.getProperty('LV3A_BACKFILL_FAILURES')||0);
  const failed=['FAILED','TIME_BUDGET','NO_ELIGIBLE_CANDIDATES'].includes(r.status);
  const next=failed?n+1:0;
  props.setProperty('LV3A_BACKFILL_FAILURES',String(next));
  if(next>=3){
    stopLibraryV3AudioBackfillTimer();
    r.timerStopped='THREE_CONSECUTIVE_NO_PROGRESS_OR_ERRORS';
  }
  Logger.log(JSON.stringify({scheduled:true,status:r.status,writes:r.writes,
    consecutiveFailures:next,timerStopped:r.timerStopped||false}));
  return r;
}
function stopLibraryV3AudioBackfillTimer(){
  const handler='runLibraryV3AudioBackfillCopyBatchScheduled';
  const ts=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler);
  ts.forEach(t=>ScriptApp.deleteTrigger(t));
  return {status:'STOPPED',deletedTriggers:ts.length};
}
function statusLibraryV3AudioBackfillTimer(){
  const handler='runLibraryV3AudioBackfillCopyBatchScheduled';
  return {mode:'READ_ONLY_TIMER_STATUS',
    triggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler).length,
    failures:Number(PropertiesService.getScriptProperties().getProperty('LV3A_BACKFILL_FAILURES')||0),
    copyOnly:true};
}
