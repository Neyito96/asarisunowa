/** Opt-in morning bridge; no startup side effects. Same GAS project as V3 + V1
 * authentication/rules/sheet-link helpers. No changes to existing V1 schedulers.
 * Old description cleaning and historical enrichment stay in separate V3 jobs.
 */
function libV3MorningConfig_(){return JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_MORNING_CONFIG')||'{}');}
function libV3MorningState_(){return JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_MORNING_STATE')||'{}');}
function libV3MorningSave_(s){const v=JSON.stringify(s);if(v.length>8000)throw Error('Morning checkpoint budget');PropertiesService.getScriptProperties().setProperty('LIB_V3_MORNING_STATE',v);}
function libV3MorningDependencies_(){return typeof getAutoPlaylistRuleByKey_==='function'&&typeof matchesAutoPlaylistRule_==='function'&&typeof getSpotifyUserAccessToken==='function'&&typeof assertAutoPlaylistSheetLinkBeforeWrite_==='function'&&typeof isAutoUpdatePlaylistHumanDeletedV1_==='function';}
function previewLibraryV3Morning(){const r={mode:'READ_ONLY_MORNING',config:libV3MorningConfig_(),state:libV3MorningState_(),baseline:JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_BASELINE')||'{}'),spotifyDependencies:libV3MorningDependencies_(),triggers:ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction()),writes:0};Logger.log(JSON.stringify(r));return r;}
/** Configuration and trigger functions are only for a separately approved rollout. */
function configureLibraryV3MorningAfterApproval(options){
 if(!options||typeof options.enabled!=='boolean'||typeof options.spotify!=='boolean'||!Array.isArray(options.ruleKeys)||options.ruleKeys.length>10||new Set(options.ruleKeys).size!==options.ruleKeys.length||!Number.isFinite(Date.parse(options.since)))throw Error('Explicit flags, unique rule keys and cutover ISO time required');
 if(options.enabled&&Date.parse(options.since)<Date.now()-1000)throw Error('Choose current/future cutover; never backfill old deleted playlist items');
 if(options.spotify&&!libV3MorningDependencies_())throw Error('V1 dependencies missing in this GAS project');
 for(const key of options.ruleKeys){const r=getAutoPlaylistRuleByKey_(key);if(!r||r.enabled===false||r.productionWriteAllowed===false||r.reviewRequired===true||!/^[A-Za-z0-9]{22}$/.test(r.playlistId))throw Error('Rule not approved for unattended updates');}
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{if(libV3MorningState_().lease)throw Error('Reconcile active lease first');if(options.enabled){const p=PropertiesService.getScriptProperties();if(!JSON.parse(p.getProperty('LIB_V3_BASELINE')||'{}').complete||ScriptApp.getProjectTriggers().some(t=>['scheduledLibraryV3','scheduledLibraryV3BaselineOnly'].includes(t.getHandlerFunction())))throw Error('Baseline must be complete and other V3 schedulers stopped');const v=JSON.parse(p.getProperty('LIB_V3_CONFIG')||'{}');Object.assign(v,{enabled:true,autonomous:false,allowEnrich:false,allowNew:true,newAfter:new Date(options.since).toISOString()});p.setProperty('LIB_V3_CONFIG',JSON.stringify(v));}PropertiesService.getScriptProperties().setProperty('LIB_V3_MORNING_CONFIG',JSON.stringify({enabled:options.enabled,spotify:options.spotify,ruleKeys:options.ruleKeys,since:new Date(options.since).toISOString()}));}finally{lock.releaseLock();}
 return {status:'CONFIGURED_NO_TRIGGER'};
}
function installLibraryV3MorningTriggerAfterApproval(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{
 const all=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
 if(all.some(n=>['scheduledLibraryV3','scheduledLibraryV3BaselineOnly'].includes(n)))throw Error('Stop/reconcile other V3 schedulers first');
 const own=all.filter(n=>n==='scheduledLibraryV3Morning');if(own.length>1)throw Error('Duplicate morning triggers');if(own.length)return {status:'ALREADY_INSTALLED'};
 ScriptApp.newTrigger('scheduledLibraryV3Morning').timeBased().everyMinutes(1).create();return {status:'INSTALLED_DISABLED_UNLESS_CONFIGURED',window:'06:00-06:59 Asia/Tokyo'};
 }finally{lock.releaseLock();}
}
function stopLibraryV3MorningAfterApproval(){const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{const c=libV3MorningConfig_();c.enabled=false;PropertiesService.getScriptProperties().setProperty('LIB_V3_MORNING_CONFIG',JSON.stringify(c));return {status:'STOPPED',triggersChanged:0};}finally{lock.releaseLock();}}
function scheduledLibraryV3Morning(){
 const cfg=libV3MorningConfig_(),now=Date.now();if(cfg.enabled!==true)return {status:'DISABLED'};
 if(Utilities.formatDate(new Date(now),'Asia/Tokyo','HH')!=='06')return {status:'OUTSIDE_MORNING_WINDOW'};
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};let s,token;
 try{s=libV3MorningState_();if(s.lease&&now-s.lease.at<8*60000)return {status:'BUSY'};token=String(now)+'-'+String(Math.random());s.lease={token,at:now};libV3MorningSave_(s);}finally{lock.releaseLock();}
 let result;
 try{
  const all=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());if(all.filter(n=>n==='scheduledLibraryV3Morning').length>1||all.some(n=>['scheduledLibraryV3','scheduledLibraryV3BaselineOnly'].includes(n)))throw Error('Conflicting V3 schedulers');
  const base=JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_BASELINE')||'{}');if(base.complete!==true)return {status:'BASELINE_REQUIRED'};
  const v3=libV3Config_();if(!v3.enabled||v3.autonomous)throw Error('V3 must be enabled in morning-only mode (autonomous=false)');
  const day=Utilities.formatDate(new Date(now),'Asia/Tokyo','yyyy-MM-dd');if(s.day!==day){s.day=day;s.feeds={};s.tick=0;s.roundStartedAt=now;/* retain playlist paging/retry across midnight */}
  const c=libV3Context_(false),since=Math.max(Date.parse(cfg.since)||Infinity,now-72*3600000);
  let feedDone=c.feeds.length>0&&c.feeds.every(f=>s.feeds?.[f.url]);if(feedDone&&now-(s.roundStartedAt||now)>=30*60000){s.feeds={};s.roundStartedAt=now;feedDone=false;}
  if(!feedDone&&(!cfg.spotify||s.spotifyPaused||(s.tick||0)%2===0)){
   const cur=JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_MORNING_CURSOR')||'{}');
   const next=c.feeds.find(f=>!s.feeds?.[f.url]);if(!next)return {status:'NO_FEEDS'};
   if(!cur.url||s.feeds?.[cur.url]){cur.url=next.url;PropertiesService.getScriptProperties().setProperty('LIB_V3_MORNING_CURSOR',JSON.stringify(cur));}
   result=libV3Run_(true,{morning:true,since});if(result.completeFeed)s.feeds[result.feed]=true;
  }else if(cfg.spotify&&!s.spotifyPaused){try{result=libV3MorningSpotify_(cfg,s,since);s.spotifyFailures=0;}catch(e){s.spotifyFailures=(s.spotifyFailures||0)+1;if(s.spotifyFailures>=2)s.spotifyPaused=true;result={job:'SPOTIFY',status:'SPOTIFY_FAILED_RSS_CONTINUES',errorType:e.name||'Error'};}}else result={status:'RSS_ROUND_COMPLETE'};
  if(result.job==='SPOTIFY'&&typeof libV3AutoHistory_==='function')libV3AutoHistory_('MORNING_SPOTIFY',{...result,writtenCells:result.ledgerWrites||0},now);
  s.tick=(s.tick||0)+1;s.failures=result.status==='FAILED'?(s.failures||0)+1:0;
  s.last={at:new Date().toISOString(),status:result.status,feed:result.feed||'',job:result.job||'RSS'};
  if(s.failures>=2){cfg.enabled=false;PropertiesService.getScriptProperties().setProperty('LIB_V3_MORNING_CONFIG',JSON.stringify(cfg));}
  Logger.log(JSON.stringify(result));return result;
 }catch(e){s.failures=(s.failures||0)+1;s.last={status:'FAILED',errorType:e.name||'Error',at:new Date().toISOString()};if(s.failures>=2){cfg.enabled=false;PropertiesService.getScriptProperties().setProperty('LIB_V3_MORNING_CONFIG',JSON.stringify(cfg));}return {status:'FAILED',errorType:e.name||'Error'};
 }finally{const l=LockService.getScriptLock();if(l.tryLock(1000)){try{const fresh=libV3MorningState_();if(fresh.lease?.token===token){delete s.lease;libV3MorningSave_(s);}}finally{l.releaseLock();}}}
}
function libV3MorningEpisode_(r,c,rule,since){
 const id=String(r[0]),guid=libV2CpGuid_(r[6]),date=r[3] instanceof Date?r[3].getTime():Date.parse(String(r[3]));
 if(libV3Identity_(r).some(g=>g!==guid)||(r[11]&&(c.index.spotify.get(String(r[11]))||[]).length!==1))return null;
 if(libV2CpMatches_(guid,c.index.guid,c.index.anchor).length!==1)return null;
 if(!guid||!Number.isFinite(date)||date<since||date>Date.now()+60000||(c.index.ids.get(id)||[]).length!==1||libV2CpBlocked_(r[38])||c.index.tomb.is.has(id)||libV3Identity_(r).some(g=>c.index.tomb.gs.has(g)))return null;
 if(c.index.states.has(id+'|playlist:'+rule.playlistId))return null; // observed/added/reserved/held: never resurrect a human removal
 const source=c.ss.getSheetByName('取得元一覧').getDataRange().getValues().slice(1).find(x=>libV2CpNorm_(x[0])===libV2CpNorm_(r[1]));
 const show=String(source?.[9]||'').match(/^https:\/\/open\.spotify\.com\/show\/([A-Za-z0-9]{22})(?:[?#]|$)/)?.[1];
 if(!show||!getAutoPlaylistShowIds_(rule).includes(show))return null;
 const sid=String(r[11]).match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#]|$)/)?.[1]||'';
 const ep={id:sid,uri:sid?'spotify:episode:'+sid:'',name:String(r[2]),description:String(r[23]||'')+'\n'+String(r[21]||''),html_description:String(r[21]||''),release_date:libV2CpDate_(r[3])};
 if(!matchesAutoPlaylistRule_(ep,rule))return null;return {epId:id,guid,show,hash:libV3Hash_(r),ep};
}
function libV3MorningGet_(path,token,s,deadline){if(deadline&&Date.now()>deadline)return {status:'TIME_BUDGET_DEFERRED'};const r=libV2CpHttp_('https://api.spotify.com/v1/'+path,{Authorization:'Bearer '+token,Accept:'application/json'},s.retry,Date.now());if(r.status!=='OK'){s.retry=r.retry;return {status:r.status};}delete s.retry;return {data:JSON.parse(r.res.getContentText()),status:'OK'};}
function libV3MorningSpotify_(cfg,s,since){
 const started=Date.now();const m={job:'SPOTIFY',status:'IDLE',spotifyPosts:0,ledgerWrites:0};
 if(!libV3MorningDependencies_())return {...m,status:'SPOTIFY_DEPENDENCIES_MISSING_RSS_CONTINUES'};
 if(s.retry?.stopped||s.retry?.at>Date.now())return {...m,status:s.retry.stopped?'SPOTIFY_STOPPED_RSS_CONTINUES':'SPOTIFY_RETRY_WAIT'};
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {...m,status:'BUSY'};try{
 const c=libV3Context_(true),keys=cfg.ruleKeys||[];if(!keys.length)return m;
 const key=s.playlist?.key||keys[(s.ruleIndex||0)%keys.length],rule=getAutoPlaylistRuleByKey_(key);
 if(!keys.includes(key)||!rule||!/^[A-Za-z0-9]{22}$/.test(rule.playlistId)||rule.enabled===false||rule.productionWriteAllowed===false||rule.reviewRequired===true||isAutoUpdatePlaylistHumanDeletedV1_(rule.playlistId)) {delete s.playlist;s.ruleIndex=(s.ruleIndex||0)+1;return {...m,status:'RULE_DISABLED_OR_DELETED'};}
 let candidate=s.playlist&&c.rows.map(r=>libV3MorningEpisode_(r,c,rule,since)).find(x=>x?.epId===s.playlist.epId);
 if(!s.playlist){candidate=c.rows.map(r=>libV3MorningEpisode_(r,c,rule,since)).filter(Boolean).sort((a,b)=>a.ep.release_date.localeCompare(b.ep.release_date)||a.epId.localeCompare(b.epId))[0];if(candidate)s.playlist={key,epId:candidate.epId,hash:candidate.hash,offset:0,found:false};}
 if(!candidate){delete s.playlist;s.ruleIndex=(s.ruleIndex||0)+1;return {...m,status:'NO_RECENT_CANDIDATE'};}
 const q=s.playlist,field='playlist:'+rule.playlistId;
 const record=(state,reason)=>libV3StatePut_(c,[candidate.epId,field,state,candidate.guid,candidate.hash,'',libV3Hash_(candidate.ep.uri),reason,new Date().toISOString(),'']);
 const done=(status)=>{delete s.playlist;s.ruleIndex=(s.ruleIndex||0)+1;return {...m,status,epId:candidate.epId};};
 if(q.hash!==candidate.hash){record('HOLD','source_changed_during_playlist_paging');return done('HOLD');}
 const token=getSpotifyUserAccessToken();if(!token)return {...m,status:'SPOTIFY_AUTH_UNAVAILABLE_RSS_CONTINUES'};
 if(!candidate.ep.id){
  const page=libV3MorningGet_('shows/'+candidate.show+'/episodes?market=JP&limit=20',token,s,started+90000);if(!page.data)return {...m,status:page.status};
  const found=(page.data.items||[]).filter(e=>libV2CpNorm_(e.name)===libV2CpNorm_(candidate.ep.name)&&e.release_date_precision==='day'&&e.release_date===candidate.ep.release_date&&/^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}$/.test(e.external_urls?.spotify||'')&&e.external_urls.spotify.endsWith('/'+e.id));
  if(found.length!==1){record('HOLD',found.length?'ambiguous_spotify_latest_page':'not_in_spotify_latest_page');return done('HOLD');}
  const fresh=libV3Context_(true);if(!fresh.rows.some(r=>r[0]===candidate.epId&&libV3Hash_(r)===candidate.hash&&libV3MorningEpisode_(r,fresh,rule,since))||(fresh.index.spotify.get(found[0].external_urls.spotify)||[]).length){record('HOLD','spotify_collision_or_exclusion_changed');return done('HOLD');}
  const i=c.rows.findIndex(r=>r[0]===candidate.epId),cell=c.sh.getRange(i+2,12),live=c.sh.getRange(i+2,1,1,51).getValues()[0],prior=c.index.states.get(candidate.epId+'|spotify');
  if(cell.getFormula()||cell.getValue()||libV3Hash_(live)!==candidate.hash||(prior&&(['HOLD','RECHECK_REQUIRED','VERIFIED'].includes(prior[2])||prior[6]!==libV3Hash_('')))){record('HOLD','spotify_destination_or_prior_state_protected');return done('HOLD');}
  libV3StatePut_(c,[candidate.epId,'spotify','HOLD',candidate.guid,candidate.hash,'',libV3Hash_(''),'reserved_spotify_write',new Date().toISOString(),JSON.stringify({targetHash:libV3Hash_(found[0].external_urls.spotify)})]);
  cell.setValue(found[0].external_urls.spotify);SpreadsheetApp.flush();if(cell.getValue()!==found[0].external_urls.spotify)throw Error('Spotify URL verification failed');
  live[11]=found[0].external_urls.spotify;libV3StatePut_(c,[candidate.epId,'spotify','VERIFIED',candidate.guid,libV3Hash_(live),'',libV3Hash_(live[11]),'exact_show_title_day_api',new Date().toISOString(),'']);delete s.playlist;return {...m,status:'SPOTIFY_URL_RESOLVED',ledgerWrites:1};
 }
 const meta=libV3MorningGet_('playlists/'+rule.playlistId+'?fields=id,snapshot_id',token,s,started+90000);if(!meta.data)return {...m,status:meta.status};if(!meta.data.snapshot_id)throw Error('Playlist snapshot missing');
 if(q.snapshot&&q.snapshot!==meta.data.snapshot_id){q.offset=0;q.found=false;}q.snapshot=meta.data.snapshot_id;
 const page=libV3MorningGet_('playlists/'+rule.playlistId+'/items?market=JP&limit=100&offset='+q.offset,token,s,started+90000);if(!page.data)return {...m,status:page.status};
 if(!Array.isArray(page.data.items))throw Error('Playlist items missing');q.found=q.found||page.data.items.some(x=>(x.item||x.track)?.uri===candidate.ep.uri);
 if(q.found){record('VERIFIED','observed_playlist_membership_never_readd');return done('ALREADY_PRESENT');}
 if(page.data.next){q.offset+=page.data.items.length;if(!page.data.items.length)throw Error('Empty continuation page');return {...m,status:'PAGING',offset:q.offset};}
 const check=libV3MorningGet_('episodes/'+candidate.ep.id+'?market=JP',token,s,started+90000);if(!check.data)return {...m,status:check.status};
 const e=check.data;if(e.id!==candidate.ep.id||e.show?.id!==candidate.show||libV2CpNorm_(e.name)!==libV2CpNorm_(candidate.ep.name)||e.release_date_precision!=='day'||e.release_date!==candidate.ep.release_date||e.is_playable!==true){record('HOLD','spotify_identity_or_playability_unverified');return done('HOLD');}
 if(Date.now()-started>90000)return {...m,status:'TIME_BUDGET_DEFERRED'};
 const latestMeta=libV3MorningGet_('playlists/'+rule.playlistId+'?fields=id,snapshot_id',token,s,started+90000);if(!latestMeta.data)return {...m,status:latestMeta.status};if(latestMeta.data.snapshot_id!==q.snapshot){q.offset=0;q.found=false;return {...m,status:'PLAYLIST_CHANGED_RESCAN'};}
 assertAutoPlaylistSheetLinkBeforeWrite_(rule);
 const fresh=libV3Context_(true),r=fresh.rows.find(r=>r[0]===candidate.epId);if(!r||!libV3MorningEpisode_(r,fresh,rule,since)||libV3Hash_(r)!==candidate.hash||isAutoUpdatePlaylistHumanDeletedV1_(rule.playlistId))throw Error('Source/exclusion changed before post');
 if(Date.now()-started>90000)return {...m,status:'TIME_BUDGET_DEFERRED'};
 // Durable reservation BEFORE one POST. Any uncertainty is held for review; no blind retry.
 record('HOLD','reserved_playlist_post');libV3MorningSave_(s);
 let res;try{res=UrlFetchApp.fetch('https://api.spotify.com/v1/playlists/'+rule.playlistId+'/items',{method:'post',muteHttpExceptions:true,contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify({uris:[candidate.ep.uri]})});}catch(e){return done('POST_UNCERTAIN_HELD');}
 const code=res.getResponseCode();if(code!==200&&code!==201){if([403,429,503].includes(code))s.retry={stopped:code===403,http:code,at:Date.now()+libV3MorningRetryDelay_(res)};return done('POST_REJECTED_HELD');}
 record('VERIFIED','playlist_added_never_readd');m.spotifyPosts=1;return done('ADDED');
 }finally{lock.releaseLock();}
}
function libV3MorningRetryDelay_(res){const h=res.getAllHeaders(),k=Object.keys(h).find(k=>k.toLowerCase()==='retry-after'),raw=k?String(h[k]):'';return Math.max(60000,/^\d+$/.test(raw)?Number(raw)*1000:Date.parse(raw)-Date.now()||0);}

/** Explicit delegation persists while the morning runner is paused. Legacy
 * writers must not backfill/resurrect the delegated playlists in the meantime. */
function libV3MorningOwnsPlaylist_(playlistId){
 const c=libV3MorningConfig_();return c.spotify===true&&typeof getAutoPlaylistRuleByKey_==='function'&&(c.ruleKeys||[]).some(k=>getAutoPlaylistRuleByKey_(k)?.playlistId===playlistId);
}

function resumeLibraryV3MorningSpotifyAfterApproval(){const l=LockService.getScriptLock();if(!l.tryLock(1000))throw Error('Busy');try{const s=libV3MorningState_();if(s.lease)throw Error('Reconcile lease first');delete s.retry;s.spotifyPaused=false;s.spotifyFailures=0;libV3MorningSave_(s);return {status:'SPOTIFY_RETRY_RESET_RESERVED_POSTS_STILL_HELD'};}finally{l.releaseLock();}}
