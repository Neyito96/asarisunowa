// Nordic adapter: reuses the existing V2 matcher, ledgers and field semantics.
function spotifyThemeOwnedV3_(id) { return id===SP3_.nordic&&sp3Prop_('NORDIC',{}).enabled===true; }
function sp3NordicRule_() {
  const matches=loadAutoUpdateRuntimeRulesV1_().filter(function(r){return r.playlistId===SP3_.nordic;});
  if(matches.length!==1||!isSubmittedThemeV2_(matches[0]))throw new Error('SP3_NORDIC_OWNER_MISMATCH');
  return matches[0];
}
function sp3ReceiptPatch_(sheet,item,patch) {
  // Never write a stale whole row over the human I/J decision columns.
  Object.keys(patch).forEach(function(column){sheet.getRange(item.index,Number(column)+1).setValue(patch[column]);item.row[column]=patch[column];});
  SpreadsheetApp.flush();
}
function sp3Tombstone_(id,episodeId,reason) {
  const key=id+'|'+episodeId;
  if(!sp3Get_('Tombstones',key))sp3Put_('Tombstones',key,{playlistId:id,episodeId:episodeId,reason:reason,at:Date.now()});
}
function sp3LocalNordic_(rule) {
  const adapter=sp3RequireAdapterForPlaylist_(rule.playlistId);
  if(!adapter.isOwned(rule))throw new Error('SP3_DOMAIN_OWNER_MISMATCH');
  const scan=adapter.scan(rule),state=adapter.getState(),queue=scan.queue,history=scan.history;
  const pool=sp3All_('EpisodePool').filter(function(ep){return rule.showIds.includes(ep.showId);});
  let scanned=0,added=0;
  // Resume physical scan position; revisit pool updates on the next complete pass.
  let start=Number(state.poolCursor||0);if(start>=pool.length)start=0;
  const end=Math.min(pool.length,start+200);
  for(let i=start;i<end;i++){
    const ep=pool[i],id=ep.episodeId;scanned++;
    if(queue[id]||history[id]||sp3Get_('Tombstones',rule.playlistId+'|'+id))continue;
    const episode=sp3Episode_(ep),result=adapter.classifyEpisode(episode,rule);
    if(result.kind==='no-match')continue;
    const row=adapter.buildRow(rule,episode,result);
    queue[id]=adapter.appendQueue(scan,row);added++;
  }
  state.poolCursor=end;adapter.saveState(state);
  const membership=sp3Membership_(rule.playlistId);
  Array.from(new Set(Object.keys(queue).concat(Object.keys(history)))).forEach(function(id){
    const q=queue[id],h=history[id],decision=adapter.decision(q,h),d={pair:scan.pair,q:q,h:h,decision:decision};
    if(decision==='blocked')sp3Tombstone_(rule.playlistId,id,'human');
    // Only a stable complete fresh generation is evidence of a human Spotify deletion.
    if(h&&h.row[10]&&h.row[15]==='追加済み'&&membership&&membership.value.lastFreshFetchedAt>new Date(h.row[10]).getTime()&&
       !membership.ids.has(id)&&!sp3PendingWrite_(rule.playlistId,id)){
      sp3Tombstone_(rule.playlistId,id,'external-removal');
      const live=scan.pair.history.getRange(h.index,1,1,16).getValues()[0];
      if(!['除外','削除','保留'].includes(String(live[8])))adapter.patchReceipt(d,'history',{8:'削除',9:new Date()});
      adapter.patchReceipt(d,'history',{15:'人間削除検知'});
    }
    if(decision==='blocked'&&h&&h.row[10]&&h.row[15]!=='既存登録確認'&&!/人間削除/.test(h.row[15]))
      sp3Enqueue_('remove',rule.playlistId+'|'+id,{playlistId:rule.playlistId,episodeId:id},1);
    if(!q||q.row[10]||h&&h.row[10]||['blocked','hold'].includes(decision)||sp3Get_('Tombstones',rule.playlistId+'|'+id))return;
    const ep=spotifyPoolRequireV3_([id])[0];if(!ep)return;
    if(adapter.classifyEpisode(sp3Episode_(ep),rule).kind==='confirmed')
      sp3Enqueue_('add',rule.playlistId+'|'+id,{playlistId:rule.playlistId,episodeId:id},2);
  });
  rule.showIds.forEach(function(id){
    const show=sp3Get_('ShowState',id)||{offset:0,complete:false,headAt:0};
    if(!show.complete)sp3Enqueue_('backfill',id,{},9);
    if((show.offset>0||show.complete)&&Date.now()-show.headAt>=SP3_.headTtl)sp3Enqueue_('head',id,{},5);
  });
  const pl=spotifyPlaylistCachedV3_(rule.playlistId);
  if(!pl||!pl.complete||pl.dirty||Date.now()-pl.lastFreshFetchedAt>=SP3_.playlistTtl)sp3RefreshJob_(rule.playlistId,'scheduled');
  if(pl&&pl.meta&&!state.accessVerified)sp3Enqueue_('access',rule.playlistId,{playlistId:rule.playlistId},4);
  return {scanned:scanned,candidatesAdded:added,poolRows:pool.length,poolCursor:end};
}
function sp3PendingWrite_(id,ep) {
  return ['add','remove'].some(function(kind){const j=sp3Get_('Jobs',SP3_.scope+'|'+kind+'|'+id+'|'+ep);
    return j&&['sending','verify','review'].includes(j.status);});
}
function sp3AccessStep_(ctx,job,rule,meta,adapter) {
  adapter=adapter||sp3RequireAdapterForPlaylist_(rule.playlistId);
  if(!adapter.isOwned(rule))throw new Error('SP3_DOMAIN_OWNER_MISMATCH');
  const state=adapter.getState();
  if(state.accessVerified)return true;
  const me=sp3Gateway_(ctx,job,'me',{mode:'prefer',ttl:86400000});
  if(!me.id)throw new Error('SP3_PROFILE_MISSING');
  if(String(meta.owner&&meta.owner.id)===String(me.id)){state.accessVerified=true;adapter.saveState(state);return true;}
  const req=getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID),AUTO_UPDATE_REQUEST_SHEET_NAME);
  if(!req.getRange(rule.requestSheetRow,5).getDisplayValue())throw new Error('SP3_INVITATION_REQUIRED');
  const data=sp3Gateway_(ctx,job,state.libraryNext||'me/playlists?limit=50',{mode:'fresh'});
  if((data.items||[]).some(function(p){return p.id===rule.playlistId;})){
    state.accessVerified=true;state.libraryNext='';adapter.saveState(state);return true;
  }
  state.libraryNext=data.next||'';adapter.saveState(state);
  if(!data.next)throw new Error('SP3_COLLABORATION_UNVERIFIED');
  throw sp3Yield_('SP3_ACCESS_PAGING');
}
function sp3ReadDecision_(rule,id,adapter) {
  adapter=adapter||sp3RequireAdapterForPlaylist_(rule.playlistId);
  return adapter.readDecision(rule,id);
}
function sp3FinishWrite_(job,rule,d,status,addedAt,adapter) {
  adapter=adapter||sp3RequireAdapterForPlaylist_(rule.playlistId);
  adapter.ensureHistory(d);
  const patch={11:'',15:status};if(addedAt)patch[10]=addedAt;
  adapter.patchReceipt(d,'history',patch);
  adapter.patchReceipt(d,'queue',patch);
  job.status='done';job.completedAt=Date.now();sp3SaveJob_(job);
}
function sp3WriteStep_(ctx,job) {
  const adapter=sp3RequireAdapterForJob_(job);
  let rule=adapter.getRule();
  if(!adapter.isOwned(rule)||job.payload.playlistId!==rule.playlistId)throw new Error('SP3_WRITE_SCOPE_DENIED');
  const id=job.payload.episodeId, add=job.kind==='add';
  let d=sp3ReadDecision_(rule,id,adapter),membership=sp3Membership_(rule.playlistId);
  // Crash/timeout after journal persistence always reconciles before any retry.
  if(job.status==='sending')job.status='verify';
  if(job.status==='verify'){
    if(!membership||membership.value.lastFreshFetchedAt<=Number(job.sentAt||0)){
      sp3RefreshJob_(rule.playlistId,'verify');throw sp3Yield_('SP3_VERIFY_PENDING',Date.now()+1000);
    }
    if(membership.ids.has(id)===add){
      sp3FinishWrite_(job,rule,d,add?'追加済み':'人間削除済み',add?new Date(job.sentAt):null,adapter);return;
    }
    // Never blindly retry an ambiguous POST; an external deletion may already have happened.
    job.status='review';job.error='SP3_WRITE_OUTCOME_UNRESOLVED';sp3SaveJob_(job);
    if(d.h)sp3ReceiptPatch_(d.pair.history,d.h,{11:job.error,15:'応答不明'});return;
  }
  if(!rule.enabled||!rule.productionWriteAllowed||d.decision==='hold'){
    job.status='cancelled';sp3SaveJob_(job);return;
  }
  if(add&&(d.decision==='blocked'||sp3Get_('Tombstones',rule.playlistId+'|'+id)||d.h&&d.h.row[10])){
    job.status='cancelled';sp3SaveJob_(job);return;
  }
  if(!add&&(d.decision!=='blocked'||!d.h||!d.h.row[10]||d.h.row[15]==='既存登録確認')){
    job.status='cancelled';sp3SaveJob_(job);return;
  }
  if(!membership||Date.now()-membership.value.lastFreshFetchedAt>SP3_.writeFreshMs){
    sp3RefreshJob_(rule.playlistId,'before-write');throw sp3Yield_('SP3_MEMBERSHIP_PENDING',Date.now()+1000);
  }
  if(membership.ids.has(id)===add){sp3FinishWrite_(job,rule,d,add?'既存登録確認':'人間削除済み',add?new Date():null,adapter);return;}
  if(add){
    const ep=spotifyPoolRequireV3_([id])[0];
    if(!ep||adapter.classifyEpisode(sp3Episode_(ep),rule).kind!=='confirmed'){
      job.status='cancelled';sp3SaveJob_(job);return;
    }
  }
  assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  if(!sp3AccessStep_(ctx,job,rule,membership.value.meta,adapter))return;
  try {
    const response=sp3Gateway_(ctx,job,'playlists/'+rule.playlistId+'/items',{
      method:add?'post':'delete',body:add?{uris:['spotify:episode:'+id]}:{items:[{uri:'spotify:episode:'+id}],snapshot_id:membership.value.snapshotId},
      beforeSend:function(){
        // Re-read authoritative rule and human columns after budget and access checks.
        rule=adapter.getRule();d=sp3ReadDecision_(rule,id,adapter);
        if(!rule.enabled||!rule.productionWriteAllowed||d.decision==='hold'||
          add&&(d.decision==='blocked'||d.h&&d.h.row[10]||sp3Get_('Tombstones',rule.playlistId+'|'+id))||
          !add&&d.decision!=='blocked')throw sp3Yield_('SP3_HUMAN_CHANGED');
        if(add&&adapter.classifyEpisode(sp3Episode_(spotifyPoolReadV3_(id)),rule).kind!=='confirmed')throw sp3Yield_('SP3_RULE_CHANGED');
        adapter.ensureHistory(d);
        adapter.patchReceipt(d,'history',{15:add?'追加準備':'削除準備'});
        job.status='sending';job.sentAt=Date.now();sp3SaveJob_(job);
        const pl=spotifyPlaylistCachedV3_(rule.playlistId);pl.dirty=true;sp3Put_('Playlist',SP3_.scope+'|'+rule.playlistId,pl);
      }
    });
    job.responseSnapshot=response.snapshot_id||'';job.status='verify';job.notBefore=0;sp3SaveJob_(job);
    sp3RefreshJob_(rule.playlistId,'verify');
  }catch(error){
    if(job.status==='sending'){
      const rejected=error.deferred||error.http>=400&&error.http<500;
      job.status=rejected?'pending':'verify';
      if(!rejected)sp3RefreshJob_(rule.playlistId,'verify');
      sp3SaveJob_(job);
    }
    throw error;
  }
}
function sp3JobStep_(ctx,job) {
  if(['backfill','head'].includes(job.kind))return sp3ShowStep_(ctx,job);
  if(job.kind==='playlist')return sp3PlaylistStep_(ctx,job);
  if(['add','remove'].includes(job.kind))return sp3WriteStep_(ctx,job);
  if(job.kind==='access'){
    const adapter=sp3RequireAdapterForJob_(job),rule=adapter.getRule(),pl=spotifyPlaylistCachedV3_(rule.playlistId);
    if(!adapter.isOwned(rule)||job.payload.playlistId!==rule.playlistId)throw new Error('SP3_WRITE_SCOPE_DENIED');
    if(!pl||!pl.meta)throw sp3Yield_('SP3_MEMBERSHIP_PENDING');
    sp3AccessStep_(ctx,job,rule,pl.meta,adapter);job.status='done';sp3SaveJob_(job);return;
  }
  if(job.kind==='episode'){
    const data=sp3Gateway_(ctx,job,'episodes/'+job.resource+'?market=JP',{mode:'fresh'});
    if(data.id!==job.resource)throw new Error('SP3_EPISODE_ID_MISMATCH');
    sp3PoolPut_(data,null,'episode');job.status='done';sp3SaveJob_(job);return;
  }
  throw new Error('SP3_UNKNOWN_JOB');
}
function sp3RunJobs_(ctx) {
  // One job step per round, with an execution-local exclusion set for deferred jobs.
  const excluded=new Set();let steps=0;
  while(steps++<30&&Date.now()<ctx.deadline){
    const jobs=sp3All_('Jobs').filter(function(j){return ['pending','verify','sending'].includes(j.status)&&
      j.notBefore<=Date.now()&&!excluded.has(j.key);}).sort(function(a,b){return a.priority-b.priority||a.updatedAt-b.updatedAt;});
    if(!jobs.length)break;
    const job=jobs[0];
    try{
      sp3JobStep_(ctx,job);
      if(job.kind==='playlist'&&job.status==='done'){
        sp3All_('Jobs').filter(function(j){return j.payload.playlistId===job.resource&&['pending','verify','sending'].includes(j.status)&&
          ['SP3_MEMBERSHIP_PENDING','SP3_VERIFY_PENDING'].includes(j.error);}).forEach(function(j){j.notBefore=0;sp3SaveJob_(j);excluded.delete(j.key);});
      }
    }
    catch(error){
      job.error=String(error.message||error);
      if(error.deferred){
        job.notBefore=error.until;
        if(/^SP3_429_/.test(job.error)){
          job.rateLimitAttempts=Number(job.rateLimitAttempts||0)+1;
          if(job.rateLimitAttempts>=3){job.notBefore=Math.max(job.notBefore,Date.now()+86400000);job.rateLimitAttempts=0;}
        }
      }
      else {
        job.attempts++;job.notBefore=Date.now()+Math.min(3600000,30000*Math.pow(2,job.attempts));
        if(job.attempts>=3&&job.status!=='verify')job.status='review';
      }
      sp3SaveJob_(job);excluded.add(job.key);
      Logger.log(JSON.stringify({event:'sp3Deferred',job:job.key,cursor:job.cursor,reason:job.error,nextAttemptAt:job.notBefore}));
    }
    if(ctx.calls>=SP3_.run)break;
  }
}
function sp3ReflectNordic_(rule) {
  const pair=themePairV2_(rule,false),history=themeRowsV2_(pair.history,16),membership=sp3Membership_(rule.playlistId);
  const jobs=sp3All_('Jobs'),pending=jobs.some(function(j){return ['add','remove'].includes(j.kind)&&!['done','cancelled'].includes(j.status);});
  const feedsDone=rule.showIds.every(function(id){return (sp3Get_('ShowState',id)||{}).complete===true;});
  const state=sp3Prop_('NORDIC',{}),pool=sp3All_('EpisodePool').filter(function(ep){return rule.showIds.includes(ep.showId);});
  const candidates=themeRowsV2_(pair.queue,16).some(function(r){return !r[10]&&['未確認','採用'].includes(r[8])&&r[15]==='候補';});
  if(!membership)return;
  const dates=membership.entries.map(function(e){return e.date;}).concat(history.filter(function(r){return r[10]&&membership.ids.has(r[1])&&!['除外','削除'].includes(r[8]);}).map(function(r){return String(r[2]);}));
  const latest=dates.filter(function(d){return /^\d{4}-\d{2}-\d{2}$/.test(d);}).sort().pop();
  const link=assertAutoPlaylistSheetLinkBeforeWrite_(rule),work=getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID),'作業台');
  if(latest){work.getRange(link.row,6).setValue(latest);rule.latestDate=latest;}
  if(feedsDone&&state.poolCursor>=pool.length&&!pending&&!candidates&&state.accessVerified){
    rule.bootstrapPending=false;rule.lifecycleStatus='incremental';work.getRange(link.row,7).setValue('AUTO');
  }
  saveAutoUpdateRuntimeRuleV1_(rule);
  setAutoUpdateRuleSheetStatusV1_(rule,rule.bootstrapPending?'初回補完中':'増分自動更新','共通pool V3 / 人間後判定優先');
}
function runSpotifyNordicPoolV3() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {waiting:true,reason:'locked'};
  const ctx=sp3Context_();sp3Tables_={};
  try {
    if(!spotifyThemeOwnedV3_(SP3_.nordic))return {skipped:true,reason:'not-enabled'};
    const rule=sp3NordicRule_();if(!rule.enabled)return {skipped:true,reason:'rule-disabled'};
    const local=sp3LocalNordic_(rule);
    // Local classification and human tombstones are always evaluated before network cooldown.
    if(!sp3Prop_('NORDIC',{}).networkPaused)sp3RunJobs_(ctx);sp3ReflectNordic_(rule);
    const jobs=sp3All_('Jobs');
    const report={event:'sp3Run',local:local,api:{GET:ctx.GET,POST:ctx.POST,DELETE:ctx.DELETE,reserved:ctx.calls,cacheHits:ctx.cacheHits,rateLimits:ctx.rateLimits},
      cooldown:spotifyCooldownStateV2_(),pendingJobs:jobs.filter(function(j){return !['done','cancelled'].includes(j.status);}).length,resume:jobs.filter(function(j){return !['done','cancelled'].includes(j.status);}).slice(0,20).map(function(j){return {key:j.key,status:j.status,cursor:j.cursor,nextAttemptAt:j.notBefore};})};
    sp3Save_('LAST_RUN',report);Logger.log(JSON.stringify(report));return report;
  }finally{lock.releaseLock();}
}
function previewSpotifyNordicPoolV3() {
  const rule=sp3NordicRule_();themePairV2_(rule,false);assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const report={playlistId:rule.playlistId,enabled:spotifyThemeOwnedV3_(rule.playlistId),cooldown:spotifyCooldownStateV2_(),budget:SP3_,
    nordicState:sp3Prop_('NORDIC',{}),lastRun:sp3Prop_('LAST_RUN',{}),legacyUnchanged:true};
  Logger.log(JSON.stringify(report));return report;
}
function installSpotifyNordicPoolV3() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('locked');
  sp3Tables_={};
  try {
    if(String(runSubmittedThemesV2).indexOf('spotifyThemeOwnedV3_')<0)throw new Error('SP3_V2_OWNERSHIP_HOOK_MISSING');
    const rule=sp3NordicRule_();themePairV2_(rule,false);assertAutoPlaylistSheetLinkBeforeWrite_(rule);
    const old=sp3Prop_('NORDIC',{});if(old.enabled)return previewSpotifyNordicPoolV3();
    ['EpisodePool','HttpCache','Playlist','PlaylistPages','ShowState','Jobs','Tombstones'].forEach(sp3Table_);
    // Import legacy data without moving or deleting its source and without API calls.
    themeRowsV2_(themeCorpusV2_(),8).forEach(function(r){if(spotifyPoolReadV3_(r[1]))return;
      sp3PoolPut_({id:r[1],name:r[3],description:r[4],release_date:r[2],show:{name:r[5]},is_playable:r[7]},r[0],'v2-import');
      const ep=spotifyPoolReadV3_(r[1]);ep.fetchedAt=new Date(r[6]).getTime()||0;sp3Put_('EpisodePool',SP3_.scope+'|'+r[1],ep);
    });
    rule.showIds.forEach(function(id){if(!sp3Get_('ShowState',id)){
      const v2=themeJsonGetV2_(THEME_V2_FEED_PREFIX_+id,{offset:0,complete:false,headAt:0});
      // Resume bootstrap offset; restarting the cheap head scan is safe if V2 had an unfinished catchup.
      sp3Put_('ShowState',id,{offset:Number(v2.offset||0),complete:!!v2.complete,headAt:v2.catchupNext?0:Number(v2.headAt||0)});
    }});
    sp3Save_('ROLLBACK',sp3Prop_('ROLLBACK',{rule:rule,v2State:themeJsonGetV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,{}),at:Date.now()}));
    // Install before enabling: any interrupted preparation leaves V2 ownership intact.
    if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='runSpotifyNordicPoolV3';}))
      ScriptApp.newTrigger('runSpotifyNordicPoolV3').timeBased().everyMinutes(15).create();
    sp3Save_('NORDIC',Object.assign({},old,{enabled:true,poolCursor:Number(old.poolCursor||0),migratedAt:Date.now()}));
    return previewSpotifyNordicPoolV3();
  }finally{lock.releaseLock();}
}
function rollbackSpotifyNordicPoolV3() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('locked');
  sp3Tables_={};
  try {
    const state=sp3Prop_('NORDIC',{});
    const unsafe=sp3All_('Jobs').filter(function(j){return ['add','remove'].includes(j.kind)&&['sending','verify','review'].includes(j.status);});
    // Keep V2 excluded while unresolved outcomes exist. Explicit reconciliation is required.
    if(unsafe.length){state.enabled=true;state.networkPaused=true;sp3Save_('NORDIC',state);throw new Error('SP3_ROLLBACK_RECONCILE_REQUIRED');}
    const rule=sp3NordicRule_(),corpus=themeCorpusV2_(),known=new Set(themeRowsV2_(corpus,8).map(function(r){return r[1];}));
    const rows=sp3All_('EpisodePool').filter(function(ep){return rule.showIds.includes(ep.showId)&&!known.has(ep.episodeId);}).map(function(ep){
      return [ep.showId,ep.episodeId,ep.releaseDate,ep.title,ep.description||ep.htmlDescription,ep.showName,new Date(ep.fetchedAt),ep.playable!==false];
    });
    if(rows.length)corpus.getRange(corpus.getLastRow()+1,1,rows.length,8).setValues(rows);
    rule.showIds.forEach(function(id){const show=sp3Get_('ShowState',id);if(show)themeJsonPutV2_(THEME_V2_FEED_PREFIX_+id,show);});
    const v2=themeJsonGetV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,{});v2.corpusCursor=0;v2.membershipComplete=false;
    v2.nextAttemptAt=Math.max(Number(v2.nextAttemptAt||0),spotifyCooldownV2_());themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,v2);
    state.enabled=false;state.networkPaused=false;sp3Save_('NORDIC',state);
    // Receipts and human I/J columns already live in the same unchanged ledgers.
    Logger.log(JSON.stringify({rolledBack:true,cooldown:spotifyCooldownStateV2_(),budgetPreserved:true}));
    return {rolledBack:true};
  }finally{lock.releaseLock();}
}

function resumeSpotifyNordicNetworkV3() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('locked');
  try {const state=sp3Prop_('NORDIC',{});if(!state.enabled)throw new Error('SP3_NOT_INSTALLED');
    state.networkPaused=false;sp3Save_('NORDIC',state);return previewSpotifyNordicPoolV3();
  }finally{lock.releaseLock();}
}