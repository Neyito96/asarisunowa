// Phase25 production wiring: connects the platform-neutral pipeline (P25LibraryPipeline.js) to the
// real ledger, the existing request form, durable state and the Spotify target adapter.
//
// Safe by default:
//  - No playlist is P25-owned until an administrator runs P25_SET_OWNER with a confirmation.
//  - With no P25-owned playlist, p25RunProductionSafe_ returns immediately (no ledger / Spotify access).
//  - Writes additionally require the Script Property P25_PROD_WRITE_ENABLED = "1" (kill switch, off by default).
//  - Every Spotify write runs inside p25WithOwnerGate_ (User lock + owner/generation re-check).
// Lock order everywhere is Script lock -> User lock, so the two never deadlock.
const P25_PROD_LEDGER_SHEET_ID_ = "1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4";
const P25_PROD_WRITE_FLAG_ = "P25_PROD_WRITE_ENABLED";
const P25_STATE_PREFIX_ = "P25_STATE_";
const P25_STATE_CHUNK_ = 8000;
const P25_REQUEST_STATUSES_ = ["確認待ち", "招待承認待ち", "増分自動更新", "初回補完中", "申請受付", "受付"];

function p25OwnerIds_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props).filter(function(key) { return key.indexOf(P25_OWNER_PREFIX_) === 0; })
    .map(function(key) { return key.slice(P25_OWNER_PREFIX_.length); });
}

const P25_EMERGENCY_STOP_KEY_ = "P25_EMERGENCY_STOP";
// After an ownership switch, P25 waits this long before its first write, so a legacy write that
// another execution user started just before the switch (User locks do not exclude across users)
// has finished. Must exceed the longest single Spotify request.
const P25_SETTLE_MS_ = 120000;

// The one user allowed to write as P25 (recorded at switch time). Because User locks only
// exclude executions of the SAME user, P25 writes are pinned to one user.
function p25EffectiveUser_() {
  try { return String(Session.getEffectiveUser().getEmail() || ""); } catch (_) { return ""; }
}
function p25ProdWriteEnabled_() {
  return PropertiesService.getScriptProperties().getProperty(P25_PROD_WRITE_FLAG_) === "1";
}

// Fail closed: ANY value in the stop property means stopped.
function p25EmergencyStopped_() {
  return PropertiesService.getScriptProperties().getProperty(P25_EMERGENCY_STOP_KEY_) !== null;
}

// A write is allowed only while the switch is ON and no emergency stop exists. Read fresh every time.
function p25ProdMayWriteNow_() {
  return p25ProdWriteEnabled_() && !p25EmergencyStopped_();
}

// Emergency stop: sets the flag FIRST (so no new write can start), clears the write switch,
// then waits for the gate lock to confirm that no write is still in flight.
// It does not change owners: P25-owned playlists stay blocked for legacy writers too.
function P25_EMERGENCY_STOP(reason) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(P25_EMERGENCY_STOP_KEY_, JSON.stringify({ at: new Date().toISOString(), reason: String(reason || "").slice(0, 200) }));
  props.deleteProperty(P25_PROD_WRITE_FLAG_);
  const lock = LockService.getUserLock();
  const drained = lock.tryLock(P25_GATE_WAIT_MS_);
  if (drained) lock.releaseLock();
  // The User lock only covers executions of this user: a write started by another execution user
  // may still finish for up to P25_SETTLE_MS_ (nothing new can start: the flag is read before every POST).
  return { stopped: true, writeSwitchCleared: true, inFlightWriteConfirmedFinished: drained, otherUsersMayFinishWithinSeconds: P25_SETTLE_MS_ / 1000 };
}

// Releases the stop only. Writes stay OFF until P25_PROD_WRITE_ENABLED is set again on purpose.
function P25_EMERGENCY_STOP_RELEASE(options) {
  if (!options || options.confirm !== "RELEASE") throw new Error("CONFIRM_REQUIRED: options.confirm に \"RELEASE\" を指定してください");
  PropertiesService.getScriptProperties().deleteProperty(P25_EMERGENCY_STOP_KEY_);
  return { stopped: false, writeEnabled: p25ProdWriteEnabled_() };
}

// ---- durable state: versioned chunks in Script Properties, committed by a final meta write ----
function p25StateKey_(key) { return P25_STATE_PREFIX_ + String(key).replace(/[^A-Za-z0-9:_-]/g, "_"); }

function p25StateCompact_(state) {
  const copy = JSON.parse(JSON.stringify(state));
  if (copy.plan) {
    copy.plan = {
      candidateCount: (copy.plan.candidates || []).length,
      additionCount: (copy.plan.additions || []).length,
      existingCount: (copy.plan.existing || []).length,
      holds: (copy.plan.holds || []).slice(0, 50),
      skippedCount: (copy.plan.skipped || []).length,
      skipped: (copy.plan.skipped || []).slice(0, 50)
    };
  }
  return copy;
}

function p25ProdStateLoad_(key) {
  const props = PropertiesService.getScriptProperties();
  const base = p25StateKey_(key);
  const raw = props.getProperty(base + ":meta");
  if (!raw) return null;
  const meta = JSON.parse(raw);
  let json = "";
  for (let i = 0; i < meta.parts; i += 1) {
    const part = props.getProperty(base + ":" + meta.version + ":" + i);
    if (part == null) throw new Error("STATE_INCOMPLETE");
    json += part;
  }
  return JSON.parse(json);
}

function p25ProdStateSave_(key, state) {
  const props = PropertiesService.getScriptProperties();
  const base = p25StateKey_(key);
  const json = JSON.stringify(p25StateCompact_(state));
  const version = Utilities.getUuid();
  const parts = Math.max(1, Math.ceil(json.length / P25_STATE_CHUNK_));
  const previous = props.getProperty(base + ":meta");
  for (let i = 0; i < parts; i += 1) {
    props.setProperty(base + ":" + version + ":" + i, json.slice(i * P25_STATE_CHUNK_, (i + 1) * P25_STATE_CHUNK_));
  }
  props.setProperty(base + ":meta", JSON.stringify({ version: version, parts: parts })); // commit
  if (previous) {
    const old = JSON.parse(previous);
    for (let i = 0; i < old.parts; i += 1) props.deleteProperty(base + ":" + old.version + ":" + i);
  }
}

// ---- request form rows (latest row per playlist) ----
function p25ProdRequestRows_() {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), AUTO_UPDATE_REQUEST_SHEET_NAME);
  const latest = new Map();
  if (!sheet || sheet.getLastRow() < 2) return latest;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getDisplayValues().forEach(function(row) {
    const id = extractAutoUpdateSpotifyPlaylistId_(String(row[1] || ""));
    if (id) latest.set(id, row);
  });
  return latest;
}

function p25ProdRequestFromRow_(row) {
  const type = p25Text_(row[8]).match(/方式:\s*(series|speaker|theme)(?:\s|\/|$)/);
  return { url: row[1], updateType: type ? type[1] : "", keywords: row[5] };
}

function p25ProdReadLedger_() {
  const sheet = SpreadsheetApp.openById(P25_PROD_LEDGER_SHEET_ID_).getSheetByName("エピソード台帳");
  if (!sheet) throw new Error("LEDGER_SHEET_MISSING");
  return sheet.getRange(1, 1, sheet.getLastRow(), 24).getDisplayValues();
}

function p25ProdToken_() {
  const token = getSpotifyUserAccessToken();
  if (!token) { const e = new Error("SPOTIFY_AUTH"); e.status = 401; throw e; }
  return token;
}

function p25ProdIo_(options) {
  options = options || {};
  const seen = {};
  const io = {
    now: function() { return Date.now(); },
    load: p25ProdStateLoad_,
    save: p25ProdStateSave_,
    withLock: function(fn) {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(1000)) return { status: "BUSY" };
      try { return fn(); } finally { lock.releaseLock(); }
    },
    readLedger: p25ProdReadLedger_,
    readRequests: function() {
      const owned = new Set(p25OwnerIds_().filter(function(id) { return p25IsP25Owned_(id); }));
      const requests = [];
      p25ProdRequestRows_().forEach(function(row, id) {
        if (!owned.has(id) || P25_REQUEST_STATUSES_.indexOf(String(row[7] || "").trim()) < 0) return;
        requests.push(p25ProdRequestFromRow_(row));
      });
      return requests;
    },
    // Source audit is informational (SOURCE_UNKNOWN). It never blocks adding ledger episodes.
    readSources: function() { return { complete: false, items: [] }; },
    readOwner: function(id) { const record = p25OwnerRead_(id); seen[id] = record; return record; },
    isStopped: function(id) { return isAutoUpdatePlaylistHumanDeletedV1_(id); },
    canWrite: function(id) {
      return options.write === true && p25ProdMayWriteNow_() && p25IsP25Owned_(id) && !isAutoUpdatePlaylistHumanDeletedV1_(id);
    },
    readMembership: function(id) { return p25SpotifyReadMembership_(p25ProdToken_(), id); },
    add: function(id, ids) {
      const record = seen[id];
      if (!record) throw Object.assign(new Error("OWNER_NOT_READ"), { notSent: true });
      const token = p25ProdToken_();
      const gate = p25WithOwnerGate_(id, "P25", record.generation, function() {
        // Last check, inside the gate lock, right before the request: switch and stop are read fresh.
        if (!p25ProdMayWriteNow_() || isAutoUpdatePlaylistHumanDeletedV1_(id)) {
          throw Object.assign(new Error("P25_WRITE_STOPPED"), { notSent: true });
        }
        const fresh = p25OwnerRead_(id);
        if (!fresh.operator || fresh.operator !== p25EffectiveUser_()) {
          throw Object.assign(new Error("P25_OPERATOR_MISMATCH"), { notSent: true });
        }
        const since = Date.parse(fresh.since || "");
        if (isNaN(since) || Date.now() - since < P25_SETTLE_MS_) {
          throw Object.assign(new Error("P25_SETTLING"), { notSent: true });
        }
        return p25SpotifyAdd_(token, id, ids);
      });
      if (!gate.allowed) throw Object.assign(new Error("P25_OWNER_CHANGED"), { notSent: true });
      return gate.value;
    },
    // Publication to the site is verified by the existing site pipeline; unchecked here.
    readPublished: function() { return { visible: false, verified: false, reason: "PUBLICATION_CHECK_NOT_CONFIGURED" }; }
  };
  return io;
}

function p25RunProduction_(options) {
  options = options || {};
  if (p25EmergencyStopped_()) return { status: "EMERGENCY_STOP" };
  const io = p25ProdIo_({ write: p25ProdMayWriteNow_() });
  return p25Run_(io, { write: p25ProdMayWriteNow_(), maxPlaylists: options.maxPlaylists || 5, maxAdditions: options.maxAdditions || 10 });
}

// Called from the existing daily/hourly triggers. Never throws and never logs raw errors.
function p25RunProductionSafe_() {
  try {
    const owned = p25OwnerIds_().filter(function(id) { return p25IsP25Owned_(id); });
    if (!owned.length) return { skipped: "NO_P25_PLAYLISTS" };
    return p25RunProduction_({});
  } catch (error) {
    return { error: String(error && error.message ? error.message : "P25_RUN_FAILED").slice(0, 80) };
  }
}

// ---- owner control (administrator operations; run manually) ----
function p25OwnerWrite_(playlistId, record) {
  PropertiesService.getScriptProperties().setProperty(P25_OWNER_PREFIX_ + playlistId, JSON.stringify(record));
}

// Used by manual stop / human delete: P25 -> PAUSED under the gate lock. Idempotent.
function p25OwnerPause_(playlistId, reason) {
  const id = String(playlistId || "").trim();
  const lock = LockService.getUserLock();
  if (!lock.tryLock(P25_GATE_WAIT_MS_)) throw new Error("P25_GATE_BUSY: 停止を反映できませんでした。再実行してください");
  try {
    const record = p25OwnerRead_(id);
    if (record.owner !== "P25") return { paused: false, owner: record.owner };
    p25OwnerWrite_(id, Object.assign({}, record, {
      owner: "PAUSED", generation: record.generation + 1, revision: (record.revision || 0) + 1,
      since: new Date().toISOString(), pauseReason: String(reason || "")
    }));
    return { paused: true, owner: "PAUSED" };
  } finally { lock.releaseLock(); }
}

// Allowed: LEGACY->P25, LEGACY->PAUSED, P25->PAUSED, PAUSED->P25, PAUSED->LEGACY (acknowledged).
// P25->LEGACY directly is refused: legacy would not know what P25 added or what humans removed.
function p25OwnerSwitch_(playlistId, next, options) {
  options = options || {};
  const id = String(playlistId || "").trim();
  if (!/^[A-Za-z0-9]{22}$/.test(id)) throw new Error("INVALID_PLAYLIST_ID");
  if (P25_OWNER_VALUES_.indexOf(next) < 0) throw new Error("INVALID_OWNER");
  const scriptLock = LockService.getScriptLock();
  // Not acquirable = a legacy or P25 run is in progress: do not switch underneath it.
  if (!scriptLock.tryLock(5000)) throw new Error("RUN_IN_PROGRESS: 実行中の処理が終わってから再実行してください");
  try {
    const userLock = LockService.getUserLock();
    if (!userLock.tryLock(P25_GATE_WAIT_MS_)) throw new Error("P25_GATE_BUSY");
    try {
      const current = p25OwnerRead_(id);
      if (current.corrupt && next !== "PAUSED") throw new Error("OWNER_RECORD_CORRUPT: 管理者が内容を確認してください");
      const allowed = {
        LEGACY: ["P25", "PAUSED"], P25: ["PAUSED"], PAUSED: ["P25", "LEGACY"]
      };
      if (current.owner === next) return { playlistId: id, owner: next, changed: false };
      if ((allowed[current.owner] || []).indexOf(next) < 0) throw new Error("TRANSITION_NOT_ALLOWED: " + current.owner + " -> " + next);
      if (options.confirm !== id) throw new Error("CONFIRM_REQUIRED: options.confirm に playlistId を指定してください");
      const record = { owner: next, generation: current.generation + 1, revision: (current.revision || 0) + 1, since: new Date().toISOString(), shows: current.shows || [] };
      if (next === "P25") {
        if (p25EmergencyStopped_()) throw new Error("EMERGENCY_STOP_ACTIVE: 緊急停止を解除してから切り替えてください");
        const operator = p25EffectiveUser_();
        if (!operator) throw new Error("OPERATOR_IDENTITY_UNAVAILABLE: 実行ユーザーを取得できないためP25書き込みを有効にできません");
        record.operator = operator;
        if (options.exclusionsReviewed !== true) {
          throw new Error("EXCLUSIONS_REVIEW_REQUIRED: 旧方式で人が削除した回を P25_IMPORT_EXCLUSIONS で引き継ぎ、確認後に exclusionsReviewed:true を指定してください");
        }
        const since = String(options.since || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || isNaN(Date.parse(since))) throw new Error("SINCE_REQUIRED: 自動追加の基準日(YYYY-MM-DD)が必要です");
        if (!options.ruleRevision) throw new Error("RULE_REVISION_REQUIRED: P25_ADOPT_PREVIEW の ruleRevision を指定してください");
        record.autoAdd = { since: since, revision: String(options.ruleRevision), shows: (options.shows || []).map(String) };
        record.shows = record.autoAdd.shows;
      }
      if (next === "LEGACY" && options.acknowledgeLegacyBoundaryRefresh !== true) {
        throw new Error("BOUNDARY_REFRESH_REQUIRED: 旧処理の境界を現在の状態に更新してから acknowledgeLegacyBoundaryRefresh:true を指定してください");
      }
      p25OwnerWrite_(id, record);
      return { playlistId: id, owner: next, generation: record.generation, changed: true };
    } finally { userLock.releaseLock(); }
  } finally { scriptLock.releaseLock(); }
}

function P25_SET_OWNER(playlistId, owner, options) { return p25OwnerSwitch_(playlistId, owner, options); }

// Read-only preview (Spotify GET only, no writes): what P25 would do for this playlist and which
// ruleRevision / since to confirm. Does not change ownership or state.
function P25_ADOPT_PREVIEW(playlistId) {
  const id = String(playlistId || "").trim();
  const row = p25ProdRequestRows_().get(id);
  if (!row) throw new Error("REQUEST_NOT_FOUND");
  const rule = p25Request_(Object.assign({ url: row[1] }, p25ProdRequestFromRow_(row)));
  const index = p25Index_(p25ProdReadLedger_());
  const members = p25SpotifyReadMembership_(p25ProdToken_(), id);
  const plan = p25Plan_(index, rule, { excluded: [], approvals: {} }, members);
  const byEp = {};
  index.rows.forEach(function(e) { byEp[e.epId] = e; });
  const missing = plan.holds.filter(function(h) { return h.reason === "REVIEW_REQUIRED"; }).map(function(h) {
    const e = byEp[h.epId]; return { epId: e.epId, show: e.show, day: p25Day_(e.date), title: e.title };
  });
  const shows = Array.from(new Set(missing.map(function(m) { return m.show; })));
  const newest = missing.map(function(m) { return m.day; }).filter(Boolean).sort().pop() || "";
  return {
    playlistId: id, ruleRevision: rule.revision, ledgerRows: index.rows.length,
    inPlaylistCount: plan.existing.length, missingCount: missing.length, missing: missing.slice(0, 100),
    shows: shows, newestMissingDay: newest, currentOwner: p25OwnerOf_(id), note: "since は『この日より後の配信だけ自動追加』する日付です"
  };
}

// Administrator approval of specific past episodes (no Spotify write here; the next run adds them).
// Evidence-bound: any later ledger change to the episode invalidates the approval.
function P25_APPROVE_EPISODES(playlistId, epIds, options) {
  const id = String(playlistId || "").trim();
  if (!options || options.confirm !== id) throw new Error("CONFIRM_REQUIRED");
  if (!Array.isArray(epIds) || !epIds.length || epIds.length > 100) throw new Error("EPISODES_REQUIRED");
  const row = p25ProdRequestRows_().get(id);
  if (!row) throw new Error("REQUEST_NOT_FOUND");
  const rule = p25Request_(Object.assign({ url: row[1] }, p25ProdRequestFromRow_(row)));
  const index = p25Index_(p25ProdReadLedger_());
  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(5000)) throw new Error("RUN_IN_PROGRESS");
  try {
    const key = "playlist:" + id;
    const state = p25ProdStateLoad_(key) || { receipt: "ACCEPTED", spotify: "PENDING", publication: "PENDING", approvals: {}, excluded: [], observed: [], pending: [] };
    const plan = p25Plan_(index, rule, { excluded: state.excluded, approvals: {} }, state.observed || []);
    const eligible = {};
    plan.holds.filter(function(h) { return h.reason === "REVIEW_REQUIRED"; }).forEach(function(h) { eligible[h.epId] = true; });
    plan.skipped.forEach(function(h) { eligible[h.epId] = true; });
    state.approvals = state.approvals || {};
    const approved = [], rejected = [];
    epIds.forEach(function(epId) {
      const e = index.rows.filter(function(r) { return r.epId === epId; })[0];
      if (!e || e.reason || !eligible[epId]) { rejected.push(epId); return; }
      state.approvals[epId] = { revision: rule.revision, evidence: e.evidence };
      approved.push(epId);
    });
    p25ProdStateSave_(key, state);
    return { playlistId: id, approved: approved, rejected: rejected };
  } finally { scriptLock.releaseLock(); }
}

// Carries manual-deletion history from the legacy era into P25. Accepts EP-IDs, GUIDs or Spotify
// episode IDs/URLs. Excluded episodes are never auto-added and cannot be approved (the plan drops
// them first). Additive only; no Spotify access.
function P25_IMPORT_EXCLUSIONS(playlistId, items, options) {
  const id = String(playlistId || "").trim();
  if (!options || options.confirm !== id) throw new Error("CONFIRM_REQUIRED");
  if (!Array.isArray(items) || !items.length || items.length > 500) throw new Error("EXCLUSIONS_REQUIRED");
  const index = p25Index_(p25ProdReadLedger_());
  const known = {};
  index.rows.forEach(function(e) {
    [e.epId, e.guid, e.spotifyId].filter(Boolean).forEach(function(k) { known[k] = e; });
  });
  const scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(5000)) throw new Error("RUN_IN_PROGRESS");
  try {
    const key = "playlist:" + id;
    const state = p25ProdStateLoad_(key) || { receipt: "ACCEPTED", spotify: "PENDING", publication: "PENDING", approvals: {}, excluded: [], observed: [], pending: [] };
    const excluded = new Set(state.excluded || []);
    const added = [], unknown = [];
    items.forEach(function(raw) {
      const text = String(raw || "").trim();
      const fromUrl = p25EpisodeId_(text);
      const k = fromUrl || text;
      const e = known[k];
      if (!e) { unknown.push(text.slice(0, 40)); return; }
      [e.epId, e.guid, e.spotifyId].filter(Boolean).forEach(function(v) { excluded.add(v); });
      // A stored approval must not survive a deliberate exclusion.
      if (state.approvals) delete state.approvals[e.epId];
      added.push(e.epId);
    });
    state.excluded = Array.from(excluded);
    state.exclusionsImportedAt = new Date().toISOString();
    p25ProdStateSave_(key, state);
    return { playlistId: id, excludedEpisodes: Array.from(new Set(added)), unknown: unknown };
  } finally { scriptLock.releaseLock(); }
}
