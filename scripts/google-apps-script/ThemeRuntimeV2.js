// Runtime themes use their own ledger and never enter the fixed theme writer.
// The shared corpus holds full title/description once per source episode.
const THEME_V2_HEADERS_ = THEME_REVIEW_HEADERS_.concat(["theme名", "playlistId", "判定理由", "処理状態"]);
const THEME_V2_CORPUS_HEADERS_ = ["showId", "episodeId", "公開日", "タイトル", "概要", "番組名", "取得日時", "再生可能"];
const THEME_V2_PLAYLIST_HEADERS_ = ["playlistId", "snapshotId", "episodeId", "公開日"];
const THEME_V2_STATE_PREFIX_ = "THEME_V2_STATE_";
const THEME_V2_FEED_PREFIX_ = "THEME_V2_FEED_";
const THEME_V2_MAX_CALLS_ = 12;

function isSubmittedThemeV2_(rule) {
  return Boolean(rule && rule.themeEngineVersion === 2 && rule.ruleType === "theme" &&
    rule.key === "request-" + rule.playlistId && !getAutoPlaylistRuleByKey_(rule.key) &&
    !AUTO_PLAYLIST_RULES.some(function(r) { return r.playlistId === rule.playlistId; }));
}
function themeJsonGetV2_(key, fallback) {
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  return raw ? JSON.parse(raw) : fallback;
}
function themeJsonPutV2_(key, value) {
  const raw = JSON.stringify(value);
  if (Utilities.newBlob(raw).getBytes().length > 8500) throw new Error("THEME_STATE_TOO_LARGE");
  PropertiesService.getScriptProperties().setProperty(key, raw);
}
function splitThemeKeywordsV2_(value) {
  return Array.from(new Set(String(value || "").normalize("NFKC")
    .split(/[\n,、;；]+|\s{2,}|(?<=[\u3000-\u9fff])\s+(?=[A-Za-z])|(?<=[A-Za-z])\s+(?=[\u3000-\u9fff])/)
    .map(function(v) { return v.trim(); }).filter(Boolean)));
}
function parseThemeNoteV2_(value) {
  const note = String(value || "").normalize("NFKC").trim();
  const exclude = [], unknown = [];
  let seedDate = "";
  note.split(/\n/).filter(Boolean).forEach(function(line) {
    let match;
    if ((match = line.match(/^(?:除外|除外キーワード)\s*[:：]\s*(.+)$/))) exclude.push.apply(exclude, splitThemeKeywordsV2_(match[1]));
    else if ((match = line.match(/^(?:起点日|seedDate)\s*[:：]\s*(\d{4}-\d{2}-\d{2})$/))) seedDate = match[1];
    else if (/^(?:イベント告知を除外|イベント告知除外)$/.test(line)) exclude.push("イベント", "告知", "公開収録のお知らせ");
    else unknown.push(line);
  });
  return { excludeKeywords: Array.from(new Set(exclude)), seedDate: seedDate, unresolved: unknown };
}
function makeThemeRuleV2_(request, playlistId, row, prior) {
  if (!/^[A-Za-z0-9]{22}$/.test(playlistId)) throw new Error("INVALID_THEME_PLAYLIST_ID");
  if (AUTO_PLAYLIST_RULES.some(function(r) { return r.playlistId === playlistId; })) throw new Error("FIXED_PLAYLIST_RESERVED");
  const parsed = parseThemeNoteV2_(request.ruleNote), keywords = splitThemeKeywordsV2_(request.keywords);
  if (!keywords.length) throw new Error("THEME_KEYWORDS_REQUIRED");
  const rule = Object.assign({}, prior || {}, { key: "request-" + playlistId, playlistId: playlistId,
    name: String(request.title || "").trim(), keywords: keywords, ruleNote: String(request.ruleNote || ""),
    excludeKeywords: parsed.excludeKeywords, unresolvedConditions: parsed.unresolved, seedDateOverride: parsed.seedDate,
    showIds: ASAHI_PRIMARY_SHOW_IDS.slice(), ruleType: "theme", updateType: "theme", themeEngineVersion: 2,
    requestSheetRow: row, reviewRequired: true, requireSheetLinkBeforeWrite: true,
    fields: ["name", "description"], bootstrapPending: prior && prior.themeEngineVersion === 2 ? prior.bootstrapPending : true,
    lifecycleStatus: prior && prior.themeEngineVersion === 2 ? prior.lifecycleStatus : "bootstrap",
    enabled: parsed.unresolved.length === 0, productionWriteAllowed: parsed.unresolved.length === 0,
    introducedDate: prior && prior.introducedDate || Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd") });
  return rule;
}
function themeSheetV2_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  else {
    const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    if (current.slice(0,12).join("|") === THEME_REVIEW_HEADERS_.join("|") && headers.length === 16 &&
        current.slice(12).every(function(x) { return !x; })) sheet.getRange(1,13,1,4).setValues([headers.slice(12)]);
    else if (current.join("|") !== headers.join("|")) throw new Error("THEME_HEADER_MISMATCH: " + name);
  }
  sheet.setFrozenRows(1);
  return sheet;
}
function themePairV2_(rule, provision) {
  if (!isSubmittedThemeV2_(rule)) throw new Error("THEME_V2_SCOPE_DENIED");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const names = ["テーマ候補_" + rule.playlistId, "テーマ履歴_" + rule.playlistId];
  const sheets = names.map(function(name) {
    const sheet = provision ? themeSheetV2_(ss,name,THEME_V2_HEADERS_) : ss.getSheetByName(name);
    if (!sheet || sheet.getRange(1,1,1,16).getDisplayValues()[0].join("|") !== THEME_V2_HEADERS_.join("|")) throw new Error("THEME_LEDGER_MISSING");
    return sheet;
  });
  if (provision) sheets.forEach(function(sheet) {
    sheet.getRange(2,9,Math.max(1,sheet.getMaxRows()-1),1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(["未確認","採用","除外","削除","保留"],true).setAllowInvalid(false).build());
  });
  return { queue:sheets[0], history:sheets[1] };
}
function registerSubmittedThemeV2_(request, playlistId, row) {
  const existing = loadAutoUpdateRuntimeRulesV1_().filter(function(r) { return r.playlistId === playlistId; });
  if (existing.length > 1) throw new Error("DUPLICATE_THEME_OWNER");
  const prior = existing[0];
  if (prior && prior.themeEngineVersion !== 2 && (prior.enabled || prior.productionWriteAllowed)) throw new Error("ACTIVE_LEGACY_THEME_REQUIRES_MIGRATION");
  const rule = makeThemeRuleV2_(request, playlistId, row, prior);
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID),work=getSheetLoose(ss,"作業台");
  if(!work)throw new Error("THEME_WORK_SHEET_MISSING");
  const link=inspectAutoPlaylistSheetLink_(playlistId);
  if(link.duplicate)throw new Error("DUPLICATE_THEME_WORK_ROW");
  if(!link.found)appendPostRow_(work,"playlist",request.url,request.title,request.maker,"","","","","",request.inviteUrl||"");
  const confirmed=assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const introduced=work.getRange(confirmed.row,8).getValue();
  if(introduced)rule.introducedDate=introduced instanceof Date?Utilities.formatDate(introduced,"Asia/Tokyo","yyyy-MM-dd"):String(introduced).slice(0,10);
  themePairV2_(rule,true);
  saveAutoUpdateRuntimeRuleV1_(rule);
  setAutoUpdateRuleSheetStatusV1_(rule,rule.enabled ? "初回補完中" : "確認待ち",
    rule.enabled ? "汎用theme V2: 共通取得・自動追加・人間後判定" : "未解釈の補足条件: " + rule.unresolvedConditions.join(" / "));
  return rule;
}
function themeRowsV2_(sheet,width) {
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues();
}
function themeRowsByIdV2_(sheet,rule) {
  const result = {};
  themeRowsV2_(sheet,16).forEach(function(row,index) {
    if (row[0] !== rule.key || row[13] !== rule.playlistId || row[12] !== rule.name) throw new Error("THEME_LEDGER_SCOPE_MISMATCH");
    if (result[row[1]]) throw new Error("DUPLICATE_THEME_LEDGER_ID");
    result[row[1]]={row:row,index:index+2};
  });
  return result;
}
function themeTextV2_(value) { return String(value || "").normalize("NFKC").replace(/<[^>]*>/g," ").toLowerCase(); }
function themeContainsV2_(text,keyword) {
  const k=themeTextV2_(keyword);
  if (/^[a-z0-9 ]+$/.test(k)) return new RegExp("(^|[^a-z0-9])"+k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z0-9]|$)").test(text);
  return text.indexOf(k)>=0;
}
function classifyThemeEpisodeV2_(episode,rule) {
  const text=themeTextV2_(episode.name+"\n"+episode.description);
  const matched=rule.keywords.filter(function(k) { return themeContainsV2_(text,k); });
  if (!matched.length) return {kind:"no-match",matched:[]};
  const exclusions=rule.excludeKeywords.filter(function(k) { return themeContainsV2_(text,k); });
  if (exclusions.length) return {kind:"excluded",matched:matched,reason:"除外条件: "+exclusions.join(" / ")};
  if (rule.seedDateOverride && episode.release_date < rule.seedDateOverride) return {kind:"no-match",matched:[]};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(episode.release_date) || episode.playable === false ||
      !episode.name || !episode.description || rule.unresolvedConditions.length) return {kind:"hold",matched:matched,reason:"情報不足・再生不可・補足条件未確定"};
  return {kind:"confirmed",matched:matched,reason:"タイトル/概要の一致: "+matched.join(" / ")};
}
function themeCorpusV2_() {
  return themeSheetV2_(SpreadsheetApp.openById(SPREADSHEET_ID),"テーマ共通EP_V2",THEME_V2_CORPUS_HEADERS_);
}
function themeFeedStepV2_(showId,token,ctx) {
  const key=THEME_V2_FEED_PREFIX_+showId;
  const state=themeJsonGetV2_(key,{offset:0,complete:false,headAt:0});
  if (state.complete && Date.now()-state.headAt<86400000 && !state.catchupNext) return false;
  const corpus=themeCorpusV2_(), rows=themeRowsV2_(corpus,8);
  const existing=new Set(rows.filter(function(r){return r[0]===showId;}).map(function(r){return r[1];}));
  const refreshing=state.complete;
  const url=refreshing ? state.catchupNext || "shows/"+showId+"/episodes?market=JP&limit=50&offset=0"
    : "shows/"+showId+"/episodes?market=JP&limit=50&offset="+state.offset;
  ctx.target="show:"+showId+" offset:"+state.offset;
  const data=spotifyJsonV2_(url,token,ctx);
  const items=Array.isArray(data.items)?data.items:[];
  const fresh=items.filter(function(ep){return ep && ep.id && !existing.has(ep.id);});
  if(fresh.length) corpus.getRange(corpus.getLastRow()+1,1,fresh.length,8).setValues(fresh.map(function(ep){
    return [showId,ep.id,String(ep.release_date||""),String(ep.name||""),String(ep.description||ep.html_description||""),
      String(ep.show&&ep.show.name||showId),new Date(),ep.is_playable===false?false:true];
  }));
  SpreadsheetApp.flush(); // Cursor advances only after durable corpus insertion.
  if(refreshing){
    const encountered=items.some(function(ep){return ep&&existing.has(ep.id);});
    state.catchupNext=!encountered&&data.next?String(data.next):"";
    if(!state.catchupNext) state.headAt=Date.now();
  } else {
    state.offset+=items.length;
    state.complete=!data.next;
    if(state.complete) state.headAt=Date.now();
  }
  themeJsonPutV2_(key,state);
  return true;
}
function themeRefreshSharedFeedV2_(rules,token,ctx) {
  const ids=Array.from(new Set(rules.reduce(function(a,r){return a.concat(r.showIds);},[])));
  if(!ids.length) return;
  const cursor=Number(themeJsonGetV2_("THEME_V2_SHOW_CURSOR",0));
  let pages=0;
  for(let i=0;i<ids.length && pages<4;i++){
    const index=(cursor+i)%ids.length;
    if(themeFeedStepV2_(ids[index],token,ctx)) pages++;
    themeJsonPutV2_("THEME_V2_SHOW_CURSOR",(index+1)%ids.length);
  }
}
function themeMembershipV2_(rule,state,token,ctx) {
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const table=themeSheetV2_(ss,"テーマPLキャッシュ_V2",THEME_V2_PLAYLIST_HEADERS_);
  ctx.target="playlist:"+rule.playlistId;
  const meta=spotifyJsonV2_("playlists/"+rule.playlistId+"?fields=id,snapshot_id,owner(id),collaborative",token,ctx);
  if(meta.id!==rule.playlistId || !meta.snapshot_id) throw new Error("PLAYLIST_SNAPSHOT_MISSING");
  const snapshot=String(meta.snapshot_id), cacheRows=themeRowsV2_(table,4);
  if(state.snapshot===snapshot && state.membershipComplete){
    return {meta:meta,ids:new Set(cacheRows.filter(function(r){return r[0]===rule.playlistId&&r[1]===snapshot;}).map(function(r){return r[2];})),complete:true};
  }
  if(state.buildSnapshot!==snapshot){state.buildSnapshot=snapshot;state.membershipOffset=0;state.membershipComplete=false;}
  const data=spotifyJsonV2_("playlists/"+rule.playlistId+"/items?market=JP&limit=100&offset="+state.membershipOffset,token,ctx);
  const items=Array.isArray(data.items)?data.items:[];
  const known=new Set(cacheRows.filter(function(r){return r[0]===rule.playlistId&&r[1]===snapshot;}).map(function(r){return r[2];}));
  const append=items.map(function(r){const ep=r.item||r.track;return ep&&ep.type==="episode"&&ep.id&&!known.has(ep.id)?
    [rule.playlistId,snapshot,ep.id,String(ep.release_date||"")]:null;}).filter(Boolean);
  if(append.length)table.getRange(table.getLastRow()+1,1,append.length,4).setValues(append);
  SpreadsheetApp.flush();
  state.membershipOffset+=items.length;
  if(data.next){themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);return {meta:meta,complete:false};}
  // Bypass the execution cache for the stability check, then retain the fresh response.
  const url="https://api.spotify.com/v1/playlists/"+rule.playlistId+"?fields=id,snapshot_id,owner(id),collaborative";
  delete spotifyReadCacheV2_["Bearer "+token+"|"+url];
  const end=spotifyJsonV2_(url,token,ctx);
  if(end.snapshot_id!==snapshot){state.buildSnapshot="";themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);return {meta:end,complete:false};}
  state.snapshot=snapshot;state.membershipComplete=true;
  themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);
  return {meta:meta,ids:new Set(themeRowsV2_(table,4).filter(function(r){return r[0]===rule.playlistId&&r[1]===snapshot;}).map(function(r){return r[2];})),complete:true};
}
function themeDecisionV2_(queueRow,historyRow) {
  const rows=[queueRow,historyRow].filter(Boolean);
  if(rows.some(function(r){return ["除外","削除"].includes(String(r[8]));}))return "blocked";
  if(rows.some(function(r){return r[8]==="保留";}))return "hold";
  return rows.some(function(r){return r[8]==="採用";})?"採用":"未確認";
}
function themeRowV2_(rule,ep,result) {
  return [rule.key,ep.id,ep.release_date,ep.show.name,ep.name,result.matched.join(" / "),
    ep.description.slice(0,220),"https://open.spotify.com/episode/"+ep.id,
    result.kind==="excluded"?"除外":result.kind==="hold"?"保留":"未確認","","","",rule.name,rule.playlistId,result.reason,
    result.kind==="confirmed"?"候補":"保留"];
}
function themeAppendRowV2_(sheet,row) {
  const index=sheet.getLastRow()+1; sheet.getRange(index,1,1,16).setValues([row]);return index;
}
function themeWriteRowV2_(sheet,item) {sheet.getRange(item.index,1,1,16).setValues([item.row]);}
function themeCopyMembershipSnapshotV2_(rule,oldSnapshot,newSnapshot,ids) {
  const sheet=themeSheetV2_(SpreadsheetApp.openById(SPREADSHEET_ID),"テーマPLキャッシュ_V2",THEME_V2_PLAYLIST_HEADERS_);
  const dateById={};themeRowsV2_(sheet,4).forEach(function(r){if(r[0]===rule.playlistId&&r[1]===oldSnapshot)dateById[r[2]]=r[3];});
  const rows=Array.from(ids).map(function(id){return [rule.playlistId,newSnapshot,id,dateById[id]||""];});
  if(rows.length)sheet.getRange(sheet.getLastRow()+1,1,rows.length,4).setValues(rows);
}
function themeApplyHumanV2_(rule,pair,state,membership,token,ctx) {
  const history=themeRowsByIdV2_(pair.history,rule), queue=themeRowsByIdV2_(pair.queue,rule);
  Object.keys(history).forEach(function(id){
    const item=history[id], decision=themeDecisionV2_(queue[id]&&queue[id].row,item.row);
    if(item.row[10]&&!membership.ids.has(id)&&item.row[15]==="追加済み"){
      item.row[8]="削除";item.row[9]=new Date();item.row[15]="人間削除検知";
      item.row[14]+=" / 完全なsnapshot照合で不在を確認";themeWriteRowV2_(pair.history,item);
    }
    if(decision==="blocked"&&membership.ids.has(id)){
      // Both 除外 and 削除 explicitly remove a previously auto-added episode.
      if(!item.row[10]||item.row[15]==="既存登録確認")return; // Never remove a pre-existing item merely observed by this engine.
      ctx.target=rule.key+" removal:"+id;
      item.row[15]="削除準備";themeWriteRowV2_(pair.history,item);SpreadsheetApp.flush();
      const response=spotifyJsonV2_("playlists/"+rule.playlistId+"/items",token,ctx,"delete",{items:[{uri:"spotify:episode:"+id}],snapshot_id:state.snapshot});
      membership.ids.delete(id);const next=String(response.snapshot_id||"");
      if(next){themeCopyMembershipSnapshotV2_(rule,state.snapshot,next,membership.ids);state.snapshot=next;}
      else {state.membershipComplete=false;}
      item.row[15]="人間削除済み";item.row[9]=item.row[9]||new Date();themeWriteRowV2_(pair.history,item);
      themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);
    }
  });
}
function themeEnsureAccessV2_(rule,meta,token,ctx,state) {
  if(state.accessVerified)return;
  const me=spotifyJsonV2_("me",token,ctx);
  const owned=String(meta.owner&&meta.owner.id)===String(me.id);
  if(!owned){
    const req=getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID),AUTO_UPDATE_REQUEST_SHEET_NAME);
    const invite=String(req.getRange(rule.requestSheetRow,5).getDisplayValue()||"");
    if(!invite)throw new Error("THEME_COLLABORATION_REQUIRES_VERIFICATION");
    let found=false;
    let url=state.libraryNext||"me/playlists?limit=50";
    const data=spotifyJsonV2_(url,token,ctx);
    found=(data.items||[]).some(function(p){return p.id===rule.playlistId;});
    if(!found&&data.next){state.libraryNext=String(data.next);throw new Error("THEME_ACCESS_YIELD");}
    if(!found)throw new Error("THEME_COLLABORATION_REQUIRES_VERIFICATION");
  }
  state.accessVerified=true;state.libraryNext="";
}
function themeScanCorpusV2_(rule,pair,state) {
  const corpus=themeCorpusV2_(),rows=themeRowsV2_(corpus,8);
  const queue=themeRowsByIdV2_(pair.queue,rule),history=themeRowsByIdV2_(pair.history,rule);
  const start=Number(state.corpusCursor||0),end=Math.min(rows.length,start+200);
  for(let i=start;i<end;i++){
    const r=rows[i];if(!rule.showIds.includes(r[0])||queue[r[1]]||history[r[1]])continue;
    const ep={id:String(r[1]),release_date:String(r[2]),name:String(r[3]),description:String(r[4]),show:{name:String(r[5])},playable:r[7]!==false};
    const result=classifyThemeEpisodeV2_(ep,rule);if(result.kind==="no-match")continue;
    const row=themeRowV2_(rule,ep,result),index=themeAppendRowV2_(pair.queue,row);queue[ep.id]={row:row,index:index};
  }
  SpreadsheetApp.flush();state.corpusCursor=end;themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);
  return {scanned:end-start,remaining:rows.length-end};
}
function themeAddCandidatesV2_(rule,pair,state,membership,token,ctx) {
  const queue=themeRowsByIdV2_(pair.queue,rule),history=themeRowsByIdV2_(pair.history,rule);
  const corpus=themeRowsV2_(themeCorpusV2_(),8),byId={};
  corpus.forEach(function(r){byId[r[1]]=r;});
  let added=0;
  const pending=Object.keys(queue).filter(function(id){
    return !queue[id].row[10]&&themeDecisionV2_(queue[id].row,history[id]&&history[id].row)!=="blocked"&&
      themeDecisionV2_(queue[id].row,history[id]&&history[id].row)!=="hold";
  }).sort(function(a,b){return String(queue[a].row[2]).localeCompare(String(queue[b].row[2]));}).slice(0,5);
  for(let id of pending){
    const item=queue[id],saved=byId[id];if(!saved)continue;
    const ep={id:id,name:String(saved[3]),description:String(saved[4]),release_date:String(saved[2]),playable:saved[7]!==false};
    const classified=classifyThemeEpisodeV2_(ep,rule);
    if(classified.kind!=="confirmed"){item.row[8]=classified.kind==="excluded"?"除外":"保留";item.row[14]=classified.reason;themeWriteRowV2_(pair.queue,item);continue;}
    // Re-read both decisions immediately before committing a write.
    const currentQueue=pair.queue.getRange(item.index,1,1,16).getValues()[0];
    let receipt=history[id];
    const currentHistory=receipt?pair.history.getRange(receipt.index,1,1,16).getValues()[0]:null;
    if(["blocked","hold"].includes(themeDecisionV2_(currentQueue,currentHistory)))continue;
    if(receipt&&receipt.row[10])continue; // Reflected receipts are never re-added.
    if(!receipt){const row=item.row.slice();row[15]="追加準備";receipt={row:row,index:themeAppendRowV2_(pair.history,row)};history[id]=receipt;}
    if(membership.ids.has(id)){
      receipt.row[10]=new Date();receipt.row[15]=receipt.row[15]==="応答不明"?"追加確認済み":"既存登録確認";
      themeWriteRowV2_(pair.history,receipt);item.row[10]=receipt.row[10];item.row[15]=receipt.row[15];themeWriteRowV2_(pair.queue,item);continue;
    }
    if(ctx.calls>=ctx.maxCalls||Date.now()>=ctx.deadline)throw new Error("THEME_BUDGET_YIELD");
    receipt.row[15]="追加準備";themeWriteRowV2_(pair.history,receipt);SpreadsheetApp.flush();
    ctx.target=rule.key+" add:"+id;
    try {
      const response=spotifyJsonV2_("playlists/"+rule.playlistId+"/items",token,ctx,"post",{uris:["spotify:episode:"+id]});
      receipt.row[10]=new Date();receipt.row[15]="追加済み";receipt.row[11]="";
      themeWriteRowV2_(pair.history,receipt);SpreadsheetApp.flush();
      item.row[10]=receipt.row[10];item.row[15]="追加済み";themeWriteRowV2_(pair.queue,item);
      membership.ids.add(id);
      const next=String(response.snapshot_id||"");
      if(next){themeCopyMembershipSnapshotV2_(rule,state.snapshot,next,membership.ids);state.snapshot=next;}
      else state.membershipComplete=false;
      themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);added++;
    } catch(error){
      receipt.row[11]=String(error.message||error);
      receipt.row[15]=/SPOTIFY_429|THEME_BUDGET|SPOTIFY_HTTP_4/.test(receipt.row[11])?"再開待ち":"応答不明";
      state.membershipComplete=false;
      themeWriteRowV2_(pair.history,receipt);themeJsonPutV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,state);throw error;
    }
  }
  return added;
}
function themeReflectStatusV2_(rule,state,pair) {
  const link=assertAutoPlaylistSheetLinkBeforeWrite_(rule),ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const work=getSheetLoose(ss,"作業台");
  const receipts=themeRowsV2_(pair.history,16);
  const latest=receipts.filter(function(r){return r[10]&&!['削除','除外'].includes(String(r[8]))&&!/人間削除/.test(String(r[15]));})
    .map(function(r){return String(r[2]);}).filter(function(d){return /^\d{4}-\d{2}-\d{2}$/.test(d);}).sort().pop();
  // Full membership cache includes pre-existing release dates where available.
  const cached=themeRowsV2_(themeSheetV2_(ss,"テーマPLキャッシュ_V2",THEME_V2_PLAYLIST_HEADERS_),4)
    .filter(function(r){return r[0]===rule.playlistId&&r[1]===state.snapshot;}).map(function(r){return String(r[3]);})
    .filter(function(d){return /^\d{4}-\d{2}-\d{2}$/.test(d);}).sort().pop();
  const date=[latest,cached].filter(Boolean).sort().pop();
  if(date)work.getRange(link.row,6).setValue(date);
  const corpusDone=Number(state.corpusCursor||0)>=Math.max(0,themeCorpusV2_().getLastRow()-1);
  const feedsDone=rule.showIds.every(function(id){return themeJsonGetV2_(THEME_V2_FEED_PREFIX_+id,{}).complete===true;});
  const queue=themeRowsV2_(pair.queue,16);
  const undecidedAdds=queue.some(function(r){return ["未確認","採用"].includes(String(r[8]))&&!r[10]&&r[15]==="候補";});
  const pendingReceipts=receipts.some(function(r){return ["追加準備","再開待ち","応答不明","削除準備"].includes(String(r[15]));});
  if(feedsDone&&corpusDone&&!undecidedAdds&&!pendingReceipts&&state.membershipComplete&&state.accessVerified){
    rule.bootstrapPending=false;rule.lifecycleStatus="incremental";
    work.getRange(link.row,7).setValue("AUTO");
  }
  rule.latestDate=date||rule.latestDate||"";saveAutoUpdateRuntimeRuleV1_(rule);
  setAutoUpdateRuleSheetStatusV1_(rule,rule.bootstrapPending?"初回補完中":"増分自動更新",
    "汎用theme V2 / 保存済み候補位置 "+Number(state.corpusCursor||0)+" / 人間後判定を優先");
  // Added episodes are edited in history only; remove their redundant queue row.
  const remaining=themeRowsV2_(pair.queue,16).filter(function(r){return !r[10];});
  const oldLast=pair.queue.getLastRow();
  if(remaining.length)pair.queue.getRange(2,1,remaining.length,16).setValues(remaining);
  if(oldLast>remaining.length+1)pair.queue.getRange(remaining.length+2,1,oldLast-remaining.length-1,16).clearContent();
  SpreadsheetApp.flush();
}
function themeRunOneV2_(rule,token,ctx) {
  const pair=themePairV2_(rule,false),key=THEME_V2_STATE_PREFIX_+rule.playlistId;
  const state=themeJsonGetV2_(key,{corpusCursor:0});
  if(Number(state.nextAttemptAt||0)>Date.now())return {playlistId:rule.playlistId,waiting:true,nextAttemptAt:state.nextAttemptAt};
  try {
    assertAutoPlaylistSheetLinkBeforeWrite_(rule);
    themeScanCorpusV2_(rule,pair,state);
    const membership=themeMembershipV2_(rule,state,token,ctx);
    if(!membership.complete)return {playlistId:rule.playlistId,waiting:true,reason:"membership-paging",offset:state.membershipOffset};
    themeEnsureAccessV2_(rule,membership.meta,token,ctx,state);
    themeApplyHumanV2_(rule,pair,state,membership,token,ctx);
    const added=themeAddCandidatesV2_(rule,pair,state,membership,token,ctx);
    state.nextAttemptAt=0;state.attempt=0;state.error="";themeJsonPutV2_(key,state);
    themeReflectStatusV2_(rule,state,pair);
    state.nextRunAt=rule.bootstrapPending ? 0 : Date.now()+86400000;
    state.humanDigest=themeHumanDigestV2_(pair);
    themeJsonPutV2_(key,state);
    return {playlistId:rule.playlistId,added:added,bootstrapPending:rule.bootstrapPending,corpusCursor:state.corpusCursor,snapshotId:state.snapshot};
  } catch(error){
    const reason=String(error.message||error);
    state.error=reason;
    if(/429/.test(reason)){
      state.attempt=Number(state.attempt||0)+1;
      state.nextAttemptAt=Math.max(spotifyCooldownV2_(),Date.now()+(state.attempt>=3?86400000:0));
      if(state.attempt>=3)state.attempt=0; // Three-attempt cycle; one recovery probe next day.
    } else if(/THEME_BUDGET|THEME_ACCESS_YIELD/.test(reason))state.nextAttemptAt=0;
    else state.nextAttemptAt=Date.now()+3600000;
    themeJsonPutV2_(key,state);
    return {playlistId:rule.playlistId,waiting:true,reason:reason,nextAttemptAt:state.nextAttemptAt,
      resume:{corpusCursor:state.corpusCursor,membershipOffset:state.membershipOffset}};
  }
}
function themeHumanDigestV2_(pair) {
  const raw=JSON.stringify([pair.queue,pair.history].map(function(sheet){
    return themeRowsV2_(sheet,16).map(function(r){return [r[1],r[8],String(r[9]||"")];});
  }));
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw).map(function(b){return (b+256)%256;}).join(",");
}
function themeDueV2_(rule) {
  const state=themeJsonGetV2_(THEME_V2_STATE_PREFIX_+rule.playlistId,{});
  if(Number(state.nextRunAt||0)<=Date.now()||rule.bootstrapPending)return true;
  // Human changes are detected in Sheets without a Spotify GET.
  return themeHumanDigestV2_(themePairV2_(rule,false))!==state.humanDigest;
}
function runSubmittedThemesV2() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {waiting:true,reason:"locked"};
  const ctx={calls:0,cacheHits:0,rateLimits:0,maxCalls:THEME_V2_MAX_CALLS_,deadline:Date.now()+210000,target:"theme-shared-feed"};
  const report={results:[],api:ctx};
  try {
    if(spotifyCooldownV2_()>Date.now())return spotifyWaitingReportV2_();
    const all=loadAutoUpdateRuntimeRulesV1_().filter(function(r){return isSubmittedThemeV2_(r)&&r.enabled===true&&r.productionWriteAllowed===true &&
      Number(themeJsonGetV2_(THEME_V2_STATE_PREFIX_+r.playlistId,{}).nextAttemptAt||0)<=Date.now() && themeDueV2_(r);});
    if(!all.length)return {skipped:true,reason:"no-submitted-theme"};
    const cursor=Number(themeJsonGetV2_("THEME_V2_RULE_CURSOR",0));
    const selected=all.slice(cursor).concat(all.slice(0,cursor)).slice(0,2);
    const token=getSpotifyUserAccessToken();if(!token)throw new Error("SPOTIFY_AUTH_REQUIRED");
    // Synchronize shared feeds once, regardless of how many themes are active.
    try {themeRefreshSharedFeedV2_(all,token,ctx);}catch(error){
      report.feedError=String(error.message||error);
      if(/429/.test(report.feedError))selected.forEach(function(r){
        const key=THEME_V2_STATE_PREFIX_+r.playlistId,state=themeJsonGetV2_(key,{});
        state.attempt=Number(state.attempt||0)+1;
        state.nextAttemptAt=Math.max(spotifyCooldownV2_(),Date.now()+(state.attempt>=3?86400000:0));
        if(state.attempt>=3)state.attempt=0;
        state.error=report.feedError;themeJsonPutV2_(key,state);
      });
    }
    for(let rule of selected){
      if(spotifyCooldownV2_()>Date.now()||ctx.calls>=ctx.maxCalls)break;
      report.results.push(themeRunOneV2_(rule,token,ctx));
    }
    themeJsonPutV2_("THEME_V2_RULE_CURSOR",(cursor+selected.length)%all.length);
    report.nextAttemptAt=spotifyCooldownV2_();Logger.log(JSON.stringify(report));return report;
  } finally {lock.releaseLock();}
}
// Read-only live preflight: no Sheets, Properties, Spotify POST or DELETE.
function previewNordicThemeV2() {
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID),sheet=getSheetLoose(ss,AUTO_UPDATE_REQUEST_SHEET_NAME);
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,9).getDisplayValues();
  const matches=rows.map(function(r,i){return {row:r,index:i+2};}).filter(function(x){return extractAutoUpdateSpotifyPlaylistId_(x.row[1])==="5OwJ6qphlx7kSlpdnk3AXJ"&&!isInactiveAutoUpdateRequestStatus_(x.row[7]);});
  if(matches.length!==1)throw new Error("NORDIC_REQUEST_NOT_UNIQUE");
  const match=matches[0],rule=makeThemeRuleV2_(autoUpdateRequestFromSheetRowV1_(match.row),"5OwJ6qphlx7kSlpdnk3AXJ",match.index,null);
  const report={dryRun:true,rule:rule,sheetLink:inspectAutoPlaylistSheetLink_(rule.playlistId),
    cooldown:spotifyCooldownStateV2_(),apiBudget:12,sourcePages:4,corpusRowsPerTheme:200,themesPerRun:2,addsPerTheme:5,
    currentRuntime:loadAutoUpdateRuntimeRulesV1_().filter(function(r){return r.playlistId===rule.playlistId;}).map(function(r){return {key:r.key,enabled:r.enabled,lifecycleStatus:r.lifecycleStatus,themeEngineVersion:r.themeEngineVersion};})};
  Logger.log(JSON.stringify(report));return report;
}
function restartNordicThemeV2() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error("locked");
  try {
    const report=previewNordicThemeV2();
    if(!report.sheetLink.found||report.sheetLink.duplicate)throw new Error("NORDIC_WORK_ROW_NOT_UNIQUE");
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID),sheet=getSheetLoose(ss,AUTO_UPDATE_REQUEST_SHEET_NAME);
    const old=report.rule.requestSheetRow,row=sheet.getRange(old,1,1,9).getValues()[0];
    const saved=loadAutoUpdateRuntimeRulesV1_().find(function(r){return r.playlistId===report.rule.playlistId;});
    if(saved&&saved.themeEngineVersion===2)return {alreadyStarted:true,requestRow:saved.requestSheetRow};
    // Retain the old application and both ledgers; resubmit with a new row.
    row[0]=new Date();row[5]=report.rule.keywords.join("\n");row[7]="申請受付";row[8]="方式: theme / 汎用theme V2 再申請";
    sheet.appendRow(row);const number=sheet.getLastRow();
    const rule=registerSubmittedThemeV2_(autoUpdateRequestFromSheetRowV1_(sheet.getRange(number,1,1,9).getDisplayValues()[0]),report.rule.playlistId,number);
    setAutoUpdateRequestStatusV1_(sheet,old,"取消","汎用theme V2 再申請へ引継ぎ: "+number+"行");
    Logger.log(JSON.stringify({registered:true,playlistId:rule.playlistId,requestRow:number}));
    return {registered:true,playlistId:rule.playlistId,requestRow:number};
  }finally{lock.releaseLock();}
}
