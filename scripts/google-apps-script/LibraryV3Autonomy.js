/** V3 control and independent auxiliary jobs. No top-level service calls.
 * Deploy only after review. Every mutating entry remains approval-only;
 * scheduledLibraryV3 is inert until startLibraryV3AfterApproval is called.
 * No OAuth refresh, API search, media-body download, or legacy trigger deletion.
 */
function libV3AutoState_(){
 const value=JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_AUTO')||'{}');
 return Object.assign({tick:0,failures:0,spotify:{},audio:{offset:0}},value);
}
function libV3AutoSave_(s){
 const value=JSON.stringify(s);if(value.length>8000)throw Error('Auxiliary checkpoint budget exceeded');
 PropertiesService.getScriptProperties().setProperty('LIB_V3_AUTO',value);
}
function libV3AutoConfig_(){return JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_CONFIG')||'{}');}
/** Uses a separate 8-minute lease; child writers retain their ScriptLock. */
function libV3AutoLease_(token){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return null;
 try{
  const s=libV3AutoState_();
  if(token){if(s.lease?.token===token){delete s.lease;libV3AutoSave_(s);}return token;}
  if(s.lease&&Date.now()-s.lease.at<8*60000)return null;
  const next=String(Date.now())+'-'+String(Math.random());s.lease={token:next,at:Date.now()};libV3AutoSave_(s);return next;
 }finally{lock.releaseLock();}
}
function prepareLibraryV3AutonomyAfterApproval(){
 // Creates only the two existing V3 sidecars; never modifies the ledger.
 if(libV3Config_().enabled||libV3AutoState_().lease)throw Error('Stop V3 and reconcile lease before preparing');
 const ready=setupLibraryV3AfterApproval();
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');
 try{
  const s=libV3AutoState_();if(s.lease)throw Error('Active or unreconciled lease');
  const c=libV3AutoConfig_();Object.assign(c,{enabled:false,autonomous:true,allowEnrich:false,allowNew:false,spotifyApi:false});
  PropertiesService.getScriptProperties().setProperty('LIB_V3_CONFIG',JSON.stringify(c));
  libV3AutoSave_(s);
  return {status:'PREPARED_DISABLED',sidecars:ready.status,ledgerWrites:0,triggersChanged:0};
 }finally{lock.releaseLock();}
}
function startLibraryV3AfterApproval(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');
 try{
  if(libV3Conflicts_().length)throw Error('Legacy library triggers still installed');
  libV3Context_(true);if(libV3AutoState_().lease)throw Error('Active or unreconciled lease');
  const c=libV3AutoConfig_();Object.assign(c,{enabled:true,autonomous:true,allowEnrich:true,allowNew:false});
  PropertiesService.getScriptProperties().setProperty('LIB_V3_CONFIG',JSON.stringify(c));
  return {status:'ENABLED_NO_TRIGGER_INSTALLED',newRegistration:false,next:'scheduledLibraryV3',triggersChanged:0};
 }finally{lock.releaseLock();}
}
/** Optional exact-ID API verification. Existing cached token is read only. */
function configureLibraryV3SpotifyAfterApproval(options){
 if(!options||typeof options.api!=='boolean'||!options.showIds||Array.isArray(options.showIds))throw Error('Explicit api flag and show-ID mapping required');
 for(const id of Object.values(options.showIds))if(!/^[A-Za-z0-9]{22}$/.test(id))throw Error('Invalid Spotify show ID');
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');
 try{
  if(libV3AutoState_().lease)throw Error('Busy');
  const c=libV3AutoConfig_();c.spotifyApi=options.api;c.spotifyShowIds=options.showIds;
  PropertiesService.getScriptProperties().setProperty('LIB_V3_CONFIG',JSON.stringify(c));
  const s=libV3AutoState_();if(s.spotify.retry?.stopped)delete s.spotify.retry;if(s.pausedJobs)delete s.pausedJobs.SPOTIFY;if(s.jobFailures)delete s.jobFailures.SPOTIFY;libV3AutoSave_(s);return {status:'SPOTIFY_CONFIGURED',api:options.api,credentialsChanged:false};
 }finally{lock.releaseLock();}
}
function libV3AutoTick_(){
 if(!libV3Config_().enabled)return {status:'DISABLED',writtenCells:0};
 const token=libV3AutoLease_();if(!token)return {status:'SKIPPED_ALREADY_RUNNING',writtenCells:0};
 const started=Date.now();let result,job='CONTROL';
 try{
  if(libV3Conflicts_().length||ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledLibraryV3').length>1)throw Error('Conflicting library triggers');
  const p=PropertiesService.getScriptProperties(),baseline=JSON.parse(p.getProperty('LIB_V3_BASELINE')||'{}'),s=libV3AutoState_();
  if(!baseline.complete){job='BASELINE';result=registerLibraryV3BaselineAfterApproval();}
  else{
   job=['RSS','SPOTIFY','RSS','AUDIO_QUEUE','RSS','DASHBOARD'][s.tick%6];
   if(s.pausedJobs?.[job])result={status:'AUXILIARY_PAUSED'};
   else if(job==='RSS')result=libV3Run_(true);
   else if(job==='SPOTIFY')result=libV3AutoSpotify_(true);
   else if(job==='AUDIO_QUEUE')result=libV3AutoAudio_(true);
   else result=refreshLibraryV3ProgressAfterApproval();
  }
  libV3AutoHistory_(job,result,started);
  // Child jobs may have saved retry/queue state; merge the fresh checkpoint.
  const next=libV3AutoState_();next.tick++;next.failures=0;next.last={job,status:result.status||'OK',at:new Date().toISOString(),elapsedMs:Date.now()-started};libV3AutoSave_(next);
  return {job,...result};
 }catch(e){
  const s=libV3AutoState_();s.failures++;s.last={job,status:'FAILED',errorType:e.name||'Error',at:new Date().toISOString()};libV3AutoSave_(s);
  try{libV3AutoHistory_(job,{status:'FAILED',errorType:e.name||'Error'},started);}catch(auditError){const c=libV3AutoConfig_();c.enabled=false;PropertiesService.getScriptProperties().setProperty('LIB_V3_CONFIG',JSON.stringify(c));return {job,status:'STOPPED_AUDIT_FAILURE'};}
  if(['SPOTIFY','AUDIO_QUEUE','DASHBOARD'].includes(job)){s.jobFailures=s.jobFailures||{};s.jobFailures[job]=(s.jobFailures[job]||0)+1;s.pausedJobs=s.pausedJobs||{};if(s.jobFailures[job]>=2)s.pausedJobs[job]=true;s.tick++;s.failures=0;libV3AutoSave_(s);return {job,status:'AUXILIARY_FAILED_RSS_CONTINUES',errorType:e.name||'Error'};}
  if(s.failures>=2){const c=libV3AutoConfig_();c.enabled=false;PropertiesService.getScriptProperties().setProperty('LIB_V3_CONFIG',JSON.stringify(c));}
  return {job,status:'FAILED',errorType:e.name||'Error',stopped:s.failures>=2};
 }finally{libV3AutoLease_(token);Logger.log(JSON.stringify({job,status:result?.status||'FAILED',elapsedMs:Date.now()-started}));}
}
/** RSS priority pass then due-review pass. Neither reorders a saved offset. */
function libV3AutoInspectDue_(it,feed,c,pass){
 const m=libV2CpMatches_(it.guid,c.index.guid,c.index.anchor),id=m.length===1?String(c.rows[m[0]][0]):'NEW:'+it.guid;
 const prior=c.index.states.get(id+'|rssInspection');
 const row=m.length===1?c.rows[m[0]]:[];
 const sourceHash=libV3Hash_([feed.url,it]);
 if(prior&&prior[5]===sourceHash&&prior[4]===libV3Hash_(row)&&Date.now()<Number(prior[9]||0))return false;
 if(pass==='review')return true;
 if(m.length!==1)return !!it.published&&Date.parse(it.published)>Date.now()-7*86400000;
 const missing=[6,14,21,22,11].some(i=>!libV3Text_(row[i]));
 return missing||libV3Schema_().fields.some(([,field])=>c.index.states.get(id+'|'+field)?.[2]==='RECHECK_REQUIRED');
}
function libV3AutoInspected_(it,feed,c,plan){
 const id=plan.id||'NEW:'+it.guid,row=plan.id?c.rows[plan.i]:[];
 const review=plan.reasons.length>0||plan.fields.some(f=>['HOLD','RECHECK_REQUIRED'].includes(f.state));
 libV3StatePut_(c,[id,'rssInspection',review?'HOLD':'VERIFIED',it.guid,libV3Hash_(row),libV3Hash_([feed.url,it]),'',review?'review_due':'snapshot_inspected',new Date().toISOString(),String(Date.now()+(review?86400000:7*86400000))]);
}
/** Deterministic formatting. Notices stay in the clean text: no semantic deletion. */
function libV3AutoCleanEvidence_(raw){
 const text=String(raw||''),lines=text.replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n').replace(/<br\s*\/?\s*>|<\/(?:p|div)>/gi,'\n');
 const marker=/^\s*【(?:お知らせ|番組からのお知らせ|関連リンク|お問い合わせ)】\s*$/m,match=marker.exec(lines);
 const ambiguous=!match&&/(?:お知らせ|番組からのお知らせ)/.test(lines)||/<(?:script|style)\b/i.test(text);
 const clean=libV3Clean_(text),split=match?match.index:-1;
 return {algorithm:'V3-mechanical-1',hold:ambiguous,reason:ambiguous?'ambiguous_notice_or_markup':'deterministic_format_only',rawHash:libV3Hash_(text),cleanHash:libV3Hash_(clean),changed:text!==clean,noticeState:match?'EXPLICIT_MARKER_PRESERVED':ambiguous?'HOLD':'NONE',markerOffset:split,bodyHash:libV3Hash_(split<0?lines:lines.slice(0,split)),noticeHash:split<0?'':libV3Hash_(lines.slice(split)),rules:['html_to_text','decode_basic_entities','normalize_whitespace','preserve_urls_and_persons','no_notice_text_deleted']};
}
function libV3AutoRecordClean_(c,plan,row){
 libV3StatePut_(c,[plan.id,'cleanEvidence',plan.cleanEvidence.hold?'HOLD':String(row[22])===libV3Clean_(row[21]||'')?'VERIFIED':'RECHECK_REQUIRED',plan.guid,libV3Hash_(row),plan.sourceHash,libV3Hash_(row[22]),plan.cleanEvidence.reason,new Date().toISOString(),JSON.stringify(plan.cleanEvidence)]);
}
function libV3AutoSpotifyUrl_(value){
 const m=String(value||'').trim().match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:\?si=[A-Za-z0-9_-]+)?$/);return m?'https://open.spotify.com/episode/'+m[1]:'';
}
function libV3AutoPage_(value){
 const s=String(value||'').trim();return /^https:\/\/(?:omny\.fm\/shows\/asahi\/|www\.asahi\.com\/special\/podcasts\/item\/)/.test(s)?s.replace(/\/$/,''):'';
}
/** Auto-discovers only exact audited staging/explicit evidence schemas. */
function libV3AutoSourceDate_(v){
 const text=String(v||'').trim();
 if(/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/.test(text)&&Number.isFinite(Date.parse(text)))return Utilities.formatDate(new Date(text),'Asia/Tokyo','yyyy-MM-dd');
 return libV2CpDate_(v);
}
function libV3AutoEvidence_(c){
 const records=[],stage=['取得元シート','朝リスの田・番組名','元ページURL','配信日時UTC原文','タイトル','再生時間秒','Spotify個別URL'],map=['番組名','タイトル','配信日時','GUID','元ページURL','Spotify個別URL','根拠'];
 for(const sh of c.ss.getSheets()){
  const h=sh.getRange(1,1,1,7).getValues()[0],isStage=stage.every((v,i)=>h[i]===v),isMap=map.every((v,i)=>h[i]===v);
  if(!isStage&&!isMap)continue;
  if(sh.getLastRow()>10001)throw Error('Evidence source too large');
  const rows=sh.getDataRange().getValues().slice(1);
  rows.forEach((r,i)=>{
   const e=isStage?{show:r[1],title:r[4],date:libV3AutoSourceDate_(r[3]),guid:'',page:r[2],spotify:r[6]}:{show:r[0],title:r[1],date:libV3AutoSourceDate_(r[2]),guid:libV2CpGuid_(r[3]),page:r[4],spotify:r[5]};
   if(isMap&&!libV3Text_(r[6]))e.spotify='';
   records.push({...e,show:libV2CpNorm_(e.show),title:libV2CpNorm_(e.title),spotify:libV3AutoSpotifyUrl_(e.spotify),source:sh.getName()+':'+(i+2)});
  });
 }
 return records;
}
function libV3AutoSpotifyPlan_(row,c,evidence){
 const reasons=[],ids=c.index.ids.get(String(row[0]))||[];
 if(!c.spotifyPages){c.spotifyPages=new Map();c.rows.forEach((r,i)=>[r[8],r[9]].map(libV3AutoPage_).filter(Boolean).forEach(p=>{if(!c.spotifyPages.has(p))c.spotifyPages.set(p,new Set());c.spotifyPages.get(p).add(i);}));}
 if(libV3Identity_(row).some(g=>libV2CpMatches_(g,c.index.guid,c.index.anchor).length!==1)||[row[8],row[9]].map(libV3AutoPage_).filter(Boolean).some(p=>c.spotifyPages.get(p).size!==1))reasons.push('ambiguous_ledger_identity');
 if(ids.length!==1||libV2CpBlocked_(row[38])||c.index.tomb.is.has(String(row[0]))||libV3Identity_(row).some(g=>c.index.tomb.gs.has(g)))reasons.push('identity_or_exclusion');
 const match=evidence.filter(e=>e.show===libV2CpNorm_(row[1])&&e.title===libV2CpNorm_(row[2])&&e.date&&e.date===libV2CpDate_(row[3])&&e.spotify);
 const exact=match.filter(e=>{
  const identities=libV3Identity_(row);if(e.guid&&identities.length&&!identities.includes(e.guid))return false;
  return e.guid&&identities.includes(e.guid)||libV3AutoPage_(e.page)&&[row[8],row[9]].map(libV3AutoPage_).includes(libV3AutoPage_(e.page));
 });
 const urls=[...new Set(exact.map(e=>e.spotify))];if(urls.length!==1)reasons.push(urls.length?'conflicting_spotify_evidence':match.length?'identity_not_proven':'no_exact_source_evidence');
 const url=urls[0]||'';
 if(url&&(c.index.spotify.get(url)||[]).some(i=>c.rows[i][0]!==row[0]))reasons.push('spotify_owned_by_other_ep');
 const prior=c.index.states.get(row[0]+'|spotify');if(prior&&['reserved_spotify_write','unresolved_write_reservation'].includes(prior[7]))reasons.push('unresolved_write_reservation');if(prior&&(prior[6]!==libV3Hash_(row[11]??'')||prior[7]==='human_or_other_writer_changed_cell'))reasons.push('human_or_other_writer_changed_cell');
 return {url,reasons,sources:exact.map(e=>e.source),evidenceHash:libV3Hash_(exact)};
}
function previewLibraryV3Spotify(){return libV3AutoSpotify_(false);}
function libV3AutoSpotify_(write){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'SKIPPED_ALREADY_RUNNING',writtenCells:0};
 const started=Date.now(),m={status:write?'SPOTIFY_CHECKPOINT':'READ_ONLY_SPOTIFY',inspected:0,proposedCells:0,writtenCells:0,apiCalls:0,holds:0,samples:[]};
 try{
  const c=libV3Context_(write),s=libV3AutoState_(),config=libV3AutoConfig_();
  if(write&&!libV3Config_().enabled)return {...m,status:'DISABLED'};
  if(write&&libV3Conflicts_().length)throw Error('Legacy library triggers still installed');
  const retry=s.spotify.retry;if(config.spotifyApi&&(retry?.stopped||retry?.at>Date.now()))return {...m,status:retry.stopped?'SPOTIFY_API_STOPPED':'SPOTIFY_RETRY_WAIT',retry};
  const evidence=libV3AutoEvidence_(c),evidenceHash=libV3Hash_(evidence);let offset=s.spotify.offset||0;
  for(let count=0;count<Math.min(200,c.rows.length)&&m.inspected<5&&Date.now()-started<70000;count++){
   const i=(offset+count)%c.rows.length,row=c.rows[i];s.spotify.offset=(i+1)%c.rows.length;
   if(libV3Text_(row[11]))continue;
   const prior=c.index.states.get(row[0]+'|spotifyInvestigation'),fingerprint=libV3Hash_([row,evidenceHash,config.allowEnrich===true,config.spotifyApi===true,config.spotifyShowIds||{}]);
   if(prior&&prior[5]===fingerprint&&Number(prior[9])>Date.now())continue;
   m.inspected++;const plan=libV3AutoSpotifyPlan_(row,c,evidence);
   if(!plan.reasons.length&&config.spotifyApi){
    const token=CacheService.getScriptCache().get('SPOTIFY_USER_ACCESS_TOKEN');
    const showId=config.spotifyShowIds?.[row[1]];
    if(!token||!showId)plan.reasons.push('spotify_api_token_or_show_mapping_unavailable');
    else{
     m.apiCalls++;const api=libV2CpSpotifyRead_(plan.url.split('/').pop(),token,retry,15);
     if(api.status!=='VERIFIED'){
      s.spotify.retry=api.retry;s.spotify.offset=i;if(write)libV3AutoSave_(s);
      return {...m,status:api.status==='STOPPED_HTTP'?'SPOTIFY_API_STOPPED':'SPOTIFY_RETRY_WAIT',retry:api.retry};
     }
     if(api.episode.show?.id!==showId||libV2CpNorm_(api.episode.name)!==libV2CpNorm_(row[2])||api.episode.release_date_precision!=='day'||api.episode.release_date!==libV2CpDate_(row[3]))plan.reasons.push('spotify_api_metadata_mismatch');
    }
   }
   const cell=c.sh.getRange(i+2,12);if(cell.getFormula())plan.reasons.push('formula_protected');
   if(plan.reasons.length)m.holds++;else{
    m.proposedCells++;
    if(write&&config.allowEnrich===true){
     const live=libV3Context_(true),fresh=live.rows[i];
     if(!fresh||libV3Hash_(fresh)!==libV3Hash_(row)||libV3AutoSpotifyPlan_(fresh,live,evidence).reasons.length||cell.getFormula()||libV3Text_(cell.getValue()))throw Error('Spotify destination changed');
     libV3StatePut_(c,[row[0],'spotify','HOLD',libV2CpGuid_(row[6]),libV3Hash_(row),plan.evidenceHash,libV3Hash_(row[11]),'reserved_spotify_write',new Date().toISOString(),JSON.stringify({targetHash:libV3Hash_(plan.url)})]);
     cell.setValue(plan.url);SpreadsheetApp.flush();if(cell.getValue()!==plan.url)throw Error('Spotify postwrite mismatch');
     row[11]=plan.url;c.index.spotify.set(plan.url,[i]);m.writtenCells++;
     libV3StatePut_(c,[row[0],'spotify','VERIFIED',libV2CpGuid_(row[6]),libV3Hash_(row),plan.evidenceHash,libV3Hash_(plan.url),'exact_source_blank_only',new Date().toISOString(),JSON.stringify({sources:plan.sources})]);
    }
   }
   if(!plan.reasons.length&&plan.url)c.index.spotify.set(plan.url,[i]);
   m.samples.push({id:row[0],candidate:!plan.reasons.length,reasons:plan.reasons,sources:plan.sources});
   if(write&&plan.reasons.length)libV3StatePut_(c,[row[0],'spotify','HOLD',libV2CpGuid_(row[6]),libV3Hash_(row),plan.evidenceHash,libV3Hash_(row[11]),plan.reasons.join('|'),new Date().toISOString(),JSON.stringify({sources:plan.sources})]);
   if(write)libV3StatePut_(c,[row[0],'spotifyInvestigation',plan.reasons.length?'HOLD':'VERIFIED',libV2CpGuid_(row[6]),libV3Hash_(row),fingerprint,libV3Hash_(row[11]),plan.reasons.join('|')||'source_verified',new Date().toISOString(),String(Date.now()+(plan.reasons.includes('spotify_api_token_or_show_mapping_unavailable')?3600000:7*86400000))]);
  }
  if(write){s.spotify.last={at:new Date().toISOString(),inspected:m.inspected,holds:m.holds,writtenCells:m.writtenCells};libV3AutoSave_(s);c.history.appendRow([new Date(),'V3_SPOTIFY',m.writtenCells,m.writtenCells,m.holds,'','','',Math.round((Date.now()-started)/1000),JSON.stringify({apiCalls:m.apiCalls,offset:s.spotify.offset})]);}
  return m;
 }finally{m.elapsedMs=Date.now()-started;Logger.log(JSON.stringify(m));lock.releaseLock();}
}
function libV3AutoAudioDue_(row,c){
 const prior=c.index.states.get(row[0]+'|audioHttp');
 if(!prior||prior[6]!==libV3Hash_(row[14]??''))return true;
 try{const at=Date.parse(JSON.parse(prior[9]||'{}').nextCheckAt||0);return !Number.isFinite(at)||Date.now()>=at;}catch(e){return true;}
}
function previewLibraryV3AudioQueue(){return libV3AutoAudio_(false);}
function libV3AutoAudio_(write){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'SKIPPED_ALREADY_RUNNING',items:[]};
 try{
  const c=libV3Context_(write),s=libV3AutoState_(),m={status:write?'AUDIO_QUEUE_CHECKPOINT':'READ_ONLY_AUDIO_QUEUE',items:[],inspected:0,ledgerWrites:0,httpCalls:0,externalRequired:true};
  if(write&&!libV3Config_().enabled)return {...m,status:'DISABLED'};
  if(write&&libV3Conflicts_().length)throw Error('Legacy library triggers still installed');
  const start=s.audio.offset||0,deadline=Date.now()+60000;
  for(let count=0;count<Math.min(200,c.rows.length)&&Date.now()<deadline;count++){
   const i=(start+count)%c.rows.length,row=c.rows[i];if(write)s.audio.offset=(i+1)%c.rows.length;m.inspected++;
   if(libV2CpBlocked_(row[38])||c.index.tomb.is.has(row[0])||libV3Identity_(row).some(g=>c.index.tomb.gs.has(g)))continue;
   if((c.index.ids.get(String(row[0]))||[]).length!==1)continue;
   if(libV3Text_(row[14])&&libV3AutoAudioDue_(row,c)&&m.items.length<5)m.items.push({id:row[0],url:row[14]});
   if(write){
    libV3StatePut_(c,[row[0],'audioPresence','VERIFIED',libV2CpGuid_(row[6]),libV3Hash_(row),'',libV3Hash_(row[14]??''),row[14]?'url_recorded_not_reachability':'no_url_not_missing_bibliography',new Date().toISOString(),JSON.stringify({present:!!libV3Text_(row[14]),playbackVerified:false})]);
   }
   if(!write&&m.items.length===5)break;
  }
  if(write){s.audio.last={at:new Date().toISOString(),inspected:m.inspected,externalPendingInBatch:m.items.length};libV3AutoSave_(s);}Logger.log(JSON.stringify(m));return m;
 }finally{lock.releaseLock();}
}
function previewLibraryV3Autonomy(){
 const p=PropertiesService.getScriptProperties(),baseline=JSON.parse(p.getProperty('LIB_V3_BASELINE')||'{}'),cursor=JSON.parse(p.getProperty('LIB_V3_CURSOR')||'{}'),s=libV3AutoState_();
 const r={mode:'READ_ONLY_AUTONOMY',config:libV3Config_(),baseline,control:s,feeds:Object.entries(cursor.feeds||{}).map(([url,v])=>({url,offset:v.offset,pass:v.pass||'priority',nextPollAt:v.nextPollAt||0,completedAt:v.completedAt||0,retry:v.retry||null})),conflictingTriggers:libV3Conflicts_(),triggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledLibraryV3').length,audioExecution:'external choice required; GAS never downloads audio bodies',writes:0};
 Logger.log(JSON.stringify(r));return r;
}

/** Validate imported transport evidence and honor the server's minimum delay. */
function libV3AutoAudioSchedule_(e){
 if(e.verdict==='AUDIO_PREFIX_OBSERVED'&&(e.http!==206||e.bytes<2))throw Error('Inconsistent audio prefix evidence');
 if(e.verdict==='HEAD_REACHABLE'&&![200,206].includes(e.http))throw Error('Inconsistent HEAD evidence');
 const codes={HTTP_FORBIDDEN:403,HTTP_NOT_FOUND:404,HTTP_GONE:410,HTTP_RATE_LIMITED:429,HTTP_UNAVAILABLE:503};
 if(codes[e.verdict]&&codes[e.verdict]!==e.http)throw Error('Inconsistent HTTP classification');
 let minimum=Date.parse(e.checkedAt)+86400000;
 for(const o of e.observations||[]){const r=String(o.retryAfter||'');if(r)minimum=Math.max(minimum,/^\d+$/.test(r)?Date.parse(e.checkedAt)+Number(r)*1000:Date.parse(r)||0);}
 if(e.nextCheckAt&&Date.parse(e.nextCheckAt)<minimum&&[429,503].includes(e.http))throw Error('Retry-After shortened');
 return e.nextCheckAt||new Date(minimum).toISOString();
}

function libV3AutoHistory_(job,result,started){
 const sh=SpreadsheetApp.openById(LIB_V2_SHEET_ID).getSheetByName('自動補完・実行履歴');
 const h=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
 if(!sh||sh.getRange(1,1,1,10).getValues()[0].some((v,i)=>v!==h[i]))throw Error('Audit history schema mismatch');
 sh.appendRow([new Date(),'V3_AUTO_'+job+'_'+(result.status||'OK'),0,0,0,'','','',Math.round((Date.now()-started)/1000),JSON.stringify({job,childWrittenCells:result.writtenCells||0,errorType:result.errorType||'',apiCalls:result.apiCalls||0})]);
}
/** Separate approval for future-only additions; start never grants this permission. */
function enableLibraryV3NewEpisodesAfterApproval(newAfter){
 const boundary=newAfter||new Date().toISOString();if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(boundary)||!Number.isFinite(Date.parse(boundary))||Date.parse(boundary)<Date.now()-1000)throw Error('Choose current/future timezone-qualified boundary');
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');
 try{
  const p=PropertiesService.getScriptProperties();if(!JSON.parse(p.getProperty('LIB_V3_BASELINE')||'{}').complete||!libV3Config_().enabled||libV3AutoState_().lease||libV3Conflicts_().length)throw Error('Baseline/enabled/lease checks required');
  const c=libV3AutoConfig_();c.allowNew=true;c.newAfter=new Date(boundary).toISOString();p.setProperty('LIB_V3_CONFIG',JSON.stringify(c));return {status:'FUTURE_NEW_ENABLED',newAfter:c.newAfter,triggersChanged:0};
 }finally{lock.releaseLock();}
}
