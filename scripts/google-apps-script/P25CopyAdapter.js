// Isolated COPY runner. Must be installed in a NEW standalone COPY GAS project.
// Existing production GAS handlers, properties and triggers are never changed here.
function P25_RUN_COPY(config) {
  const io = p25CopyIo_(config);
  return p25Run_(io,{write:config.write === true,maxPlaylists:config.maxPlaylists||5,maxAdditions:config.maxAdditions||1});
}
function p25CopyIo_(config) {
  const productionScripts=["1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9"];
  const productionSheets=["1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ","1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4"];
  if (!config || config.environment!=="COPY" || !config.copyScriptId || ScriptApp.getScriptId()!==config.copyScriptId || productionScripts.indexOf(config.copyScriptId)>=0 || !config.stateSheetId || productionSheets.indexOf(config.stateSheetId)>=0 || !config.requestSheetId || productionSheets.indexOf(config.requestSheetId)>=0) throw new Error("COPY_ISOLATION_REQUIRED");
  // Copy playlists must be explicitly allowlisted, with a confirmed legacy-writer stop.
  const allow=new Set(config.copyPlaylistIds||[]);
  // A writing COPY run is limited to ONE dedicated test playlist and ONE episode per run.
  if (config.write===true && (allow.size!==1 || config.legacyWriterDisabled!==true || config.maxAdditions!==1)) throw new Error("COPY_WRITE_SCOPE_REQUIRED");
  // The test playlist must carry the COPY marker in its name, so a production playlist ID pasted by mistake is refused.
  const namePrefix=config.playlistNamePrefix||"[P25-COPY]", verifiedPlaylists={};
  const ss=SpreadsheetApp.openById(config.stateSheetId);
  const sheet=ss.getSheetByName("P25_STATE");
  if (!sheet || sheet.getRange(1,1,1,4).getDisplayValues()[0].join("|")!=="key|version|part|json") throw new Error("COPY_STATE_SCHEMA_REQUIRED");
  let token="", apiCalls=0;
  const apiBudget=config.apiBudget||50;
  function api(method,path,body) {
    if (++apiCalls>apiBudget) throw new Error("API_BUDGET_EXHAUSTED");
    if (!token) token=PropertiesService.getScriptProperties().getProperty("P25_COPY_SPOTIFY_ACCESS_TOKEN");
    if (!token) throw new Error("COPY_TOKEN_REQUIRED");
    const options={method:method,muteHttpExceptions:true,headers:{Authorization:"Bearer "+token},contentType:"application/json"};
    if(body) options.payload=JSON.stringify(body);
    const response=UrlFetchApp.fetch("https://api.spotify.com/v1/"+path,options),status=response.getResponseCode();
    if(status<200||status>=300) {
      const error=new Error("SPOTIFY_HTTP");error.status=status;
      const headers=response.getAllHeaders();error.retryAfterSeconds=Number(headers["Retry-After"]||headers["retry-after"]||60);throw error;
    }
    return JSON.parse(response.getContentText()||"{}");
  }
  function load(key) {
    if(sheet.getLastRow()<2)return null;
    const rows=sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().filter(function(r){return r[0]===key;});
    // Append-only journal: only versions with a final COMMIT marker are visible.
    const commits=rows.filter(function(r){return r[2]==="COMMIT";});
    if(!commits.length)return null;
    const commit=commits[commits.length-1],parts=rows.filter(function(r){return r[1]===commit[1]&&r[2]!=="COMMIT";}).sort(function(a,b){return Number(a[2])-Number(b[2]);});
    if(parts.length!==Number(commit[3]))throw new Error("STATE_INCOMPLETE");
    return JSON.parse(parts.map(function(r){return r[3];}).join(""));
  }
  function save(key,state) {
    const json=JSON.stringify(state),version=Utilities.getUuid(),rows=[];
    for(let offset=0;offset<json.length;offset+=20000) rows.push([key,version,rows.length,json.slice(offset,offset+20000)]);
    let start=sheet.getLastRow()+1;
    if(start+rows.length>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+100);
    sheet.getRange(start,1,rows.length,4).setValues(rows);SpreadsheetApp.flush();
    sheet.getRange(start+rows.length,1,1,4).setValues([[key,version,"COMMIT",rows.length]]);SpreadsheetApp.flush();
  }
  function assertCopyPlaylist(id) {
    if(!allow.has(id))throw new Error("COPY_TARGET_REQUIRED");
    if(verifiedPlaylists[id])return;
    const info=api("get","playlists/"+id+"?fields=name");
    if(typeof info.name!=="string"||info.name.indexOf(namePrefix)!==0)throw new Error("COPY_PLAYLIST_NAME_MARKER_REQUIRED");
    verifiedPlaylists[id]=true;
  }
  const io={
    now:function(){return Date.now();},load:load,save:save,
    withLock:function(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:"BUSY"};try{return fn();}finally{lock.releaseLock();}},
    readLedger:function(){const s=SpreadsheetApp.openById(config.ledgerSheetId||productionSheets[1]).getSheetByName("エピソード台帳");return s.getRange(1,1,s.getLastRow(),39).getDisplayValues();},
    // READ ONLY: 削除・除外履歴 of the ledger workbook (col A = GUID, col B = EP-ID). Missing sheet = stop.
    readExclusions:function(){const s=SpreadsheetApp.openById(config.ledgerSheetId||productionSheets[1]).getSheetByName("削除・除外履歴");if(!s)throw new Error("EXCLUSION_SHEET_MISSING");const last=s.getLastRow();return last<1?[[]]:s.getRange(1,1,last,Math.max(2,s.getLastColumn())).getDisplayValues();},
    // Synthetic owner record: only when the session config enables rule-level auto-add for the test playlist.
    readOwner:function(id){return config.autoAdd&&allow.has(id)?{owner:"P25",generation:1,autoAdd:{since:config.autoAdd.since,revision:config.autoAdd.revision,shows:config.autoAdd.shows||[]}}:null;},
    // READ ONLY Spotify GET: do the ledger's Spotify episode IDs exist and play in Japan?
    // Spotify (2026-02 Development Mode migration) removed the batch "episodes with ids" endpoint. Each episode is read with
    // GET /episodes/{id}?market=JP. Per-episode: 200 -> ok/unplayable, 404 -> missing. Anything that is not about one
    // episode (401/403/429/5xx, budget, network) STOPS the run: the rest stay notVerifiable and `stopped` says why.
    // Never retries inside the run (a 429 means: wait Retry-After), never writes.
    verifyEpisodes:function(ids){
      const out={ok:[],missing:[],unplayable:[],notVerifiable:[],stopped:null,complete:false};
      const reasonOf={401:"SPOTIFY_AUTH_REQUIRED",403:"SPOTIFY_FORBIDDEN",429:"SPOTIFY_RATE_LIMITED"};
      for(let n=0;n<ids.length;n++){
        const id=ids[n];
        if(!/^[A-Za-z0-9]{22}$/.test(String(id))){out.notVerifiable.push(id);continue;}
        let e;
        try { e=api("get","episodes/"+encodeURIComponent(id)+"?market=JP"); }
        catch(err) {
          if(err&&err.status===404){out.missing.push(id);continue;}
          if(err&&err.status===400){out.notVerifiable.push(id);continue;}
          const status=err&&err.status?err.status:0;
          out.stopped={reason:status?(reasonOf[status]||(status>=500?"SPOTIFY_SERVER_ERROR":"SPOTIFY_HTTP_"+status)):(String(err&&err.message)==="API_BUDGET_EXHAUSTED"?"API_BUDGET_EXHAUSTED":"SPOTIFY_NETWORK_ERROR"),status:status};
          if(status===429)out.stopped.retryAfterSeconds=err.retryAfterSeconds||60;
          if(status===401||status===403)out.stopped.hint="トークン、Spotify Developer の Development Mode(アプリ所有者の Premium、利用者の登録)、権限を確認してください";
          out.notVerifiable.push.apply(out.notVerifiable,ids.slice(n));
          return out;
        }
        if(!e||e.id!==id)out.notVerifiable.push(id);
        else if(e.is_playable===false)out.unplayable.push(id);
        else out.ok.push(id);
      }
      out.complete=true;
      return out;
    },
    apiUsage:function(){return {calls:apiCalls,budget:apiBudget};},
    readRequests:function(){
      const s=SpreadsheetApp.openById(config.requestSheetId).getSheetByName("自動更新申請");
      if(!s||s.getLastRow()<2)return [];
      const latest=new Map();
      s.getRange(2,1,s.getLastRow()-1,9).getDisplayValues().forEach(function(r){const m=p25Text_(r[1]).match(/\/playlist\/([A-Za-z0-9]{22})(?:[?#]|$)/);if(m)latest.set(m[1],r);});
      return Array.from(latest.values()).filter(function(r){return ["確認待ち","招待承認待ち","増分自動更新","初回補完中"].indexOf(r[7])>=0;}).map(function(r){
        const type=p25Text_(r[8]).match(/方式:\s*(series|speaker|theme)(?:\s|\/|$)/);
        return {url:r[1],updateType:type?type[1]:"",keywords:r[5]};
      }).filter(function(r){const m=r.url.match(/\/playlist\/([A-Za-z0-9]{22})(?:[?#]|$)/);return m&&allow.has(m[1]);});
    },
    readSources:function(){
      // Only explicit official feeds from the existing source registry are allowed.
      const items=[];let complete=Boolean(config.officialFeedUrls&&config.officialFeedUrls.length);
      (config.officialFeedUrls||[]).forEach(function(url){
        try {
          if(!/^https:\/\/(?:omny\.fm|www\.omnycontent\.com|feeds\.megaphone\.fm)\//.test(url))throw new Error("UNVERIFIED_FEED_HOST");
          const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true});if(res.getResponseCode()!==200)throw new Error("FEED_FAILED");
          const channel=XmlService.parse(res.getContentText()).getRootElement().getChild("channel");
          if(!channel)throw new Error("FEED_INVALID");
          channel.getChildren("item").forEach(function(item){const guid=item.getChildText("guid");if(guid)items.push({guid:guid,show:channel.getChildText("title")});else complete=false;});
        }catch(_){complete=false;}
      });return {complete:complete,items:items};
    },
    canWrite:function(id){return config.write===true&&allow.has(id)&&config.legacyWriterDisabled===true;},
    readMembership:function(id){
      assertCopyPlaylist(id);
      const before=api("get","playlists/"+id+"?fields=snapshot_id").snapshot_id;
      if(!before)throw new Error("SNAPSHOT_REQUIRED");
      const ids=[];let offset=0;
      while(true){
        const page=api("get","playlists/"+id+"/items?market=JP&limit=50&offset="+offset);
        if(!Array.isArray(page.items))throw new Error("MEMBERSHIP_SCHEMA");
        page.items.forEach(function(row){const item=row.item||row.track;if(!item||!item.id)throw new Error("MEMBERSHIP_UNAVAILABLE_ITEM");if(item.type==="episode")ids.push(item.id);});
        if(!page.next)break;if(!page.items.length)throw new Error("MEMBERSHIP_PAGINATION");offset+=page.items.length;
      }
      const after=api("get","playlists/"+id+"?fields=snapshot_id").snapshot_id;
      if(before!==after)throw new Error("MEMBERSHIP_CHANGED_DURING_READ");
      return Array.from(new Set(ids));
    },
    add:function(id,ids){if(!io.canWrite(id))throw new Error("COPY_WRITE_DISABLED");if(ids.length!==1)throw new Error("COPY_SINGLE_EPISODE_ONLY");assertCopyPlaylist(id);return api("post","playlists/"+id+"/items",{uris:ids.map(function(e){return "spotify:episode:"+e;})});},
    // Existing registration -> site-public sheet -> sync-playlists -> Pages remains
    // the publication transport. Verify the actual deployed anchor independently.
    readPublished:function(id){
      if(!config.previewUrl)return {visible:false,verified:false,reason:"PREVIEW_URL_REQUIRED"};
      if(!/^https:\/\/neyito96\.github\.io\/asarisunowa\//.test(config.previewUrl))throw new Error("PREVIEW_ORIGIN_REQUIRED");
      const response=UrlFetchApp.fetch(config.previewUrl,{muteHttpExceptions:true});
      return p25VerifyPublishedHtml_(response.getResponseCode(),response.getContentText(),id,config.previewUrl,Date.now());
    }
  };
  return io;
}

// Explicit review operation: run only with the exact manifest returned by inspection.
function P25_INSPECT_COPY(config,playlistId) {
  return p25CopyIo_(config).load("playlist:"+playlistId);
}
function P25_APPROVE_COPY(config,playlistId,reviewedCandidates) {
  const io=p25CopyIo_(config);
  if((config.copyPlaylistIds||[]).indexOf(playlistId)<0)throw new Error("COPY_TARGET_REQUIRED");
  return io.withLock(function(){
    const key="playlist:"+playlistId,state=io.load(key);
    if(!state || !state.plan)throw new Error("RUN_COPY_FIRST");
    const index=p25Index_(io.readLedger(),{requireExclusionColumn:true,exclusions:io.readExclusions()});
    (reviewedCandidates||[]).forEach(function(candidate){
      const current=index.rows.find(function(e){return e.epId===candidate.epId;});
      if(!current || current.reason || current.evidence!==candidate.evidence || current.guid!==candidate.guid || current.spotifyId!==candidate.spotifyId || candidate.revision!==state.rule.revision)throw new Error("STALE_APPROVAL");
      state.approvals[current.epId]={evidence:current.evidence,revision:state.rule.revision};
    });
    io.save(key,state);return {approved:reviewedCandidates.length};
  });
}

// ---- COPY read-only trials (no Spotify write path) ----
// Ledger search: reads the ledger workbook only. No Spotify call, no state written.
function P25_SEARCH_COPY(config,query) {
  const io=p25CopyIo_(config);
  return p25Search_(p25Index_(io.readLedger(),{requireExclusionColumn:true,exclusions:io.readExclusions()}),query);
}
// Spotify ID mapping check: Spotify GET only (counts against apiBudget).
function P25_VERIFY_IDS_COPY(config,epIds) {
  if(!Array.isArray(epIds)||!epIds.length||epIds.length>100)throw new Error("EPISODES_REQUIRED");
  const io=p25CopyIo_(config);
  const index=p25Index_(io.readLedger(),{requireExclusionColumn:true,exclusions:io.readExclusions()});
  const byEp={},idToEp={},ids=[],notVerifiable=[];
  index.rows.forEach(function(e){byEp[e.epId]=e;});
  epIds.forEach(function(id){const e=byEp[id];if(!e||e.reason||!e.spotifyId){notVerifiable.push(id);return;}ids.push(e.spotifyId);idToEp[e.spotifyId]=id;});
  const r=ids.length?io.verifyEpisodes(ids):{ok:[],missing:[],unplayable:[],notVerifiable:[],stopped:null,complete:true};
  const toEp=function(l){return l.map(function(i){return idToEp[i]||i;});};
  return {ok:toEp(r.ok),missing:toEp(r.missing),unplayable:toEp(r.unplayable),notVerifiable:notVerifiable.concat(toEp(r.notVerifiable)),complete:r.complete===true,stopped:r.stopped||null,apiUsage:io.apiUsage()};
}
// Dry preview for one COPY playlist: the rule revision to put in config.autoAdd, what the plan would do.
// Never writes (add is not called) and never persists state.
function P25_PREVIEW_COPY(config,playlistId) {
  const io=p25CopyIo_(config);
  if((config.copyPlaylistIds||[]).indexOf(playlistId)<0)throw new Error("COPY_TARGET_REQUIRED");
  const index=p25Index_(io.readLedger(),{requireExclusionColumn:true,exclusions:io.readExclusions()});
  const row=io.readRequests().filter(function(r){return r.url.indexOf(playlistId)>=0;})[0];
  if(!row)throw new Error("REQUEST_NOT_FOUND");
  const rule=p25Request_(row),members=io.readMembership(playlistId);
  const plan=p25Plan_(index,rule,{excluded:[],approvals:{},autoAdd:config.autoAdd||null,today:new Date(Date.now()+9*3600*1000).toISOString().slice(0,10)},members);
  return {ruleRevision:rule.revision,members:members.length,wouldAdd:plan.additions.map(function(a){return a.epId;}),holds:plan.holds.length,skipped:plan.skipped.length,humanExcluded:plan.humanExcluded.length,autoAddActive:Boolean(config.autoAdd)};
}
