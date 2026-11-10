// Spotify show resolution for podcasts (Issue #274). READ-ONLY toward Spotify (search / GET only).
// Replaces the old "single search, limit 10, exact normalized match, null on any failure" behaviour:
//  - NFKC normalization and a few search-term variants (brackets / separators / spaces)
//  - every failure is classified (never a silent null): AUTH, RATE_LIMIT, HTTP_ERROR, NETWORK, NO_RESULTS, TITLE_MISMATCH, AMBIGUOUS
//  - 429 is honoured (one short retry only when Retry-After is small, otherwise the row is HELD)
//  - an ambiguous or merely similar candidate is NEVER confirmed automatically
// The only sheet write in this file is fillRecommendedPodcastSpotifyOne (one cell, blank only, explicit apply flag).

// Admin-maintained alias table: normalized sheet title -> exact Spotify show names that are the same show.
// Empty by default. An alias only matters when the Spotify name differs from the sheet title.
const PODSP_TITLE_ALIASES_ = {};
const PODSP_SPOTIFY_SHOW_URL_ = /^https:\/\/open\.spotify\.com\/show\/([A-Za-z0-9]{22})(?:[?#].*)?$/;
const PODSP_MAX_SHORT_RETRY_SECONDS_ = 10;

function podSpNormalize_(value) {
  let text = String(value == null ? "" : value);
  try { text = text.normalize("NFKC"); } catch (_) {}
  return text
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[・･·•\-‐‑–—―_~〜～"'`´‘’“”「」『』【】\[\]()（）<>＜＞.,、。!！?？:：;；|｜\/\\&＆+＋*＊#＃@＠$＄%％^＾=＝]/g, "");
}

function podSpTitleVariants_(title) {
  const out = [];
  const add = function(value) {
    const text = String(value || "").trim();
    if (text.length >= 2 && out.indexOf(text) < 0) out.push(text);
  };
  const base = String(title || "").trim();
  let nfkc = base;
  try { nfkc = base.normalize("NFKC"); } catch (_) {}
  add(base);
  add(nfkc);
  const stripped = nfkc.replace(/[【\[（(][^】\]）)]*[】\]）)]/g, " ").replace(/\s+/g, " ").trim();
  add(stripped);
  const parts = stripped.split(/\s*[|｜\/／:：–—〜~]\s*|\s+-\s+/).map(function(part) { return part.trim(); }).filter(Boolean);
  if (parts.length > 1) { add(parts[0]); add(parts[parts.length - 1]); }
  add(nfkc.replace(/[\s　]+/g, ""));
  return out.slice(0, 5);
}

function podSpDefaultDeps_() {
  return {
    token: function() { return typeof getSpotifyAccessToken === "function" ? getSpotifyAccessToken() : ""; },
    fetch: function(url, token) {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      let headers = {};
      try { headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders(); } catch (_) {}
      return { status: response.getResponseCode(), body: response.getContentText(), headers: headers || {} };
    },
    sleep: function(ms) { Utilities.sleep(ms); }
  };
}

function podSpReasonForStatus_(status) {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "RATE_LIMIT";
  return "HTTP_ERROR";
}

// One classified GET. At most one retry: 429 with a short Retry-After, or a 5xx / network error.
function podSpGet_(deps, token, path) {
  let attempt = 0;
  for (;;) {
    let r;
    try { r = deps.fetch("https://api.spotify.com/v1/" + path, token); }
    catch (_) {
      if (attempt++ < 1) { deps.sleep(1000); continue; }
      return { ok: false, reason: "NETWORK", status: 0 };
    }
    if (r.status >= 200 && r.status < 300) {
      try { return { ok: true, data: JSON.parse(r.body || "{}") }; }
      catch (_) { return { ok: false, reason: "HTTP_ERROR", status: r.status }; }
    }
    const reason = podSpReasonForStatus_(r.status);
    const retry = Number(r.headers["Retry-After"] || r.headers["retry-after"] || 0);
    if (r.status === 429) {
      if (attempt++ < 1 && retry > 0 && retry <= PODSP_MAX_SHORT_RETRY_SECONDS_) { deps.sleep(retry * 1000); continue; }
      return { ok: false, reason: "RATE_LIMIT", status: 429, retryAfterSeconds: retry || 60 };
    }
    if (r.status >= 500 && attempt++ < 1) { deps.sleep(1000); continue; }
    return { ok: false, reason: reason, status: r.status };
  }
}

function podSpItem_(item) {
  const id = String(item && item.id || "");
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return null;
  return { id: id, name: String(item.name || ""), publisher: String(item.publisher || ""), url: "https://open.spotify.com/show/" + id };
}

// items: [{id,name,publisher,url}] already collected. Pure: no network.
function podSpClassify_(items, title, maker) {
  const wanted = podSpNormalize_(title);
  const names = [wanted].concat((PODSP_TITLE_ALIASES_[wanted] || []).map(podSpNormalize_));
  const exact = items.filter(function(item) { return names.indexOf(podSpNormalize_(item.name)) >= 0; });
  const top = items.slice(0, 3).map(function(item) { return { id: item.id, name: item.name, publisher: item.publisher }; });
  if (exact.length === 1) return { status: "MATCH", url: exact[0].url, id: exact[0].id, candidates: top };
  if (exact.length > 1) {
    const publisher = podSpNormalize_(maker);
    const same = publisher.length >= 2 ? exact.filter(function(item) { return podSpNormalize_(item.publisher) === publisher; }) : [];
    if (same.length === 1) return { status: "MATCH", url: same[0].url, id: same[0].id, candidates: top };
    return { status: "AMBIGUOUS", url: "", id: "", candidates: exact.slice(0, 3).map(function(item) { return { id: item.id, name: item.name, publisher: item.publisher }; }) };
  }
  if (items.length) return { status: "TITLE_MISMATCH", url: "", id: "", candidates: top };
  return { status: "NO_RESULTS", url: "", id: "", candidates: [] };
}

// Searches show candidates for a title. options: {maxCalls (default 6)}.
function podSpFindShow_(title, maker, deps, options) {
  deps = deps || podSpDefaultDeps_();
  const maxCalls = Number(options && options.maxCalls) > 0 ? Number(options.maxCalls) : 6;
  const term = String(title || "").trim();
  if (!term) return { status: "NO_RESULTS", url: "", id: "", candidates: [], calls: 0 };
  const token = deps.token();
  if (!token) return { status: "AUTH", url: "", id: "", candidates: [], calls: 0, detail: "no token" };
  const seen = {}, items = [];
  let calls = 0, failure = null;
  const variants = podSpTitleVariants_(term);
  for (let v = 0; v < variants.length && !failure; v++) {
    for (let page = 0; page < 2 && !failure; page++) {
      if (calls >= maxCalls) { failure = { reason: "BUDGET" }; break; }
      calls++;
      const res = podSpGet_(deps, token, "search?q=" + encodeURIComponent(variants[v]) + "&type=show&market=JP&limit=10&offset=" + (page * 10));
      if (!res.ok) { failure = res; break; }
      const raw = res.data && res.data.shows && Array.isArray(res.data.shows.items) ? res.data.shows.items : [];
      raw.forEach(function(entry) { const it = podSpItem_(entry); if (it && !seen[it.id]) { seen[it.id] = true; items.push(it); } });
      const decided = podSpClassify_(items, term, maker);
      if (decided.status === "MATCH") return { status: "MATCH", url: decided.url, id: decided.id, candidates: decided.candidates, calls: calls };
      if (raw.length < 10) break;                       // no further page for this variant
    }
  }
  const verdict = podSpClassify_(items, term, maker);
  // An ambiguous/mismatching pool is reported as such even if a later call failed; a failure with nothing found is the failure.
  if (failure && failure.reason !== "BUDGET" && verdict.status === "NO_RESULTS") {
    return { status: failure.reason, url: "", id: "", candidates: [], calls: calls, httpStatus: failure.status || 0, retryAfterSeconds: failure.retryAfterSeconds || 0 };
  }
  return { status: verdict.status, url: "", id: "", candidates: verdict.candidates, calls: calls, partial: failure ? failure.reason : "" };
}

// Called after the official links (source URL, RSS) were applied: a known official Spotify link always wins over search.
function podSpCompleteResolved_(resolved, title, maker, deps) {
  if (resolved.spotify) { resolved.spotifyStatus = "KNOWN_LINK"; return resolved; }
  const found = podSpFindShow_(title, maker, deps);
  resolved.spotifyStatus = found.status;
  resolved.spotifyDetail = found.status === "MATCH" ? "" : JSON.stringify({ candidates: found.candidates, calls: found.calls, retryAfterSeconds: found.retryAfterSeconds || 0 });
  if (found.status === "MATCH") resolved.spotify = found.url;
  return resolved;
}

// ---------------------------------------------------------------- read-only audit

function podSpShowIdOf_(url) {
  const match = String(url || "").trim().match(PODSP_SPOTIFY_SHOW_URL_);
  return match ? match[1] : "";
}

// Does this Spotify SHOW URL belong to the sheet's show? (GET /shows/{id}). Episode URLs are rejected.
function podSpVerifyShowIdentity_(title, maker, showUrl, options, deps) {
  deps = deps || podSpDefaultDeps_();
  const url = String(showUrl || "").trim();
  if (/open\.spotify\.com\/episode\//i.test(url)) return { identity: "EPISODE_URL_NOT_SHOW", url: url };
  const id = podSpShowIdOf_(url);
  if (!id) return { identity: "NOT_A_SHOW_URL", url: url };
  const token = deps.token();
  if (!token) return { identity: "AUTH", id: id };
  const res = podSpGet_(deps, token, "shows/" + id + "?market=JP");
  if (!res.ok) return { identity: res.reason, id: id, httpStatus: res.status || 0, retryAfterSeconds: res.retryAfterSeconds || 0 };
  const show = podSpItem_(res.data);
  if (!show || show.id !== id) return { identity: "NO_RESULTS", id: id };
  const verdict = podSpClassify_([show], title, maker);
  const accepted = options && options.acceptAlias ? podSpNormalize_(options.acceptAlias) === podSpNormalize_(show.name) : false;
  const identity = verdict.status === "MATCH" ? "MATCH" : (accepted ? "MATCH_ALIAS" : verdict.status);
  return { identity: identity, id: id, spotifyName: show.name, publisher: show.publisher, sheetTitle: String(title || "") };
}

function podSpRecommendedSheet_() {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), PODCAST_SHEET_NAME);
  if (!sheet) throw new Error("おすすめPodcastシートが見つかりません");
  return sheet;
}

// READ-ONLY. Lists rows that have LISTEN but no Spotify (column J). options: {lookup:false, maxLookups:15, start:0}
// lookup:false => no Spotify call at all (counts only). lookup:true => classify the next maxLookups rows (search only).
function auditRecommendedPodcastSpotifyGaps(options) {
  options = options || {};
  const sheet = podSpRecommendedSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return { total: 0, withListen: 0, missingSpotify: 0, byStatus: {}, rows: [] };
  const values = sheet.getRange(2, 1, last - 1, 18).getDisplayValues();
  const missing = [];
  let withListen = 0, total = 0;
  values.forEach(function(row, i) {
    if (!String(row[1] || "").trim()) return;
    total++;
    const hasListen = /listen\.style\//i.test(String(row[0] || "")) || /listen\.style\//i.test(String(row[13] || ""));
    if (!hasListen) return;
    withListen++;
    if (!String(row[9] || "").trim()) missing.push({ row: i + 2, title: String(row[1]).trim(), maker: String(row[6] || "").trim(), source: String(row[0] || "").trim() });
  });
  const byStatus = {};
  if (options.lookup === true) {
    const start = Math.max(0, Number(options.start) || 0), limit = Math.max(1, Number(options.maxLookups) || 15);
    const deps = options.deps || podSpDefaultDeps_();
    for (let i = start; i < Math.min(missing.length, start + limit); i++) {
      const found = podSpFindShow_(missing[i].title, missing[i].maker, deps, { maxCalls: 3 });
      missing[i].status = found.status; missing[i].candidates = found.candidates; missing[i].proposedUrl = found.status === "MATCH" ? found.url : "";
      byStatus[found.status] = (byStatus[found.status] || 0) + 1;
      if (found.status === "RATE_LIMIT" || found.status === "AUTH") break;       // stop the whole audit; do not hammer
    }
  }
  const result = { total: total, withListen: withListen, missingSpotify: missing.length, lookedUp: Object.keys(byStatus).reduce(function(s, k) { return s + byStatus[k]; }, 0), byStatus: byStatus, rows: missing };
  console.log("おすすめPodcast LISTENあり・Spotify欠落: " + missing.length + " / LISTENあり " + withListen + " / 全体 " + total + " " + JSON.stringify(byStatus));
  return result;
}

// ONE cell, blank only. Default is a dry run. options: {row | title, showUrl, acceptAlias, apply:false, confirmShowId}
// apply:true additionally needs confirmShowId equal to the show ID, identity MATCH/MATCH_ALIAS and an empty J cell.
function fillRecommendedPodcastSpotifyOne(options) {
  options = options || {};
  const sheet = podSpRecommendedSheet_();
  const last = sheet.getLastRow();
  const values = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 18).getDisplayValues();
  let index = -1;
  if (options.row) index = Number(options.row) - 2;
  else values.forEach(function(row, i) { if (index < 0 && podSpNormalize_(row[1]) === podSpNormalize_(options.title)) index = i; });
  if (index < 0 || index >= values.length) return { ok: false, reason: "ROW_NOT_FOUND" };
  const row = values[index], rowNumber = index + 2;
  const title = String(row[1] || "").trim(), current = String(row[9] || "").trim();
  const plan = { ok: false, row: rowNumber, title: title, currentSpotify: current, applied: false };
  if (current) { plan.reason = "ALREADY_FILLED_NOT_OVERWRITTEN"; return plan; }
  const identity = podSpVerifyShowIdentity_(title, String(row[6] || ""), options.showUrl, options, options.deps);
  Object.assign(plan, { identity: identity.identity, spotifyName: identity.spotifyName || "", publisher: identity.publisher || "", showId: identity.id || "" });
  if (identity.identity !== "MATCH" && identity.identity !== "MATCH_ALIAS") { plan.reason = "IDENTITY_NOT_CONFIRMED"; return plan; }
  plan.ok = true;
  plan.value = "https://open.spotify.com/show/" + identity.id;
  if (options.apply !== true) { plan.dryRun = true; return plan; }
  if (options.confirmShowId !== identity.id) { plan.ok = false; plan.reason = "CONFIRM_SHOW_ID_REQUIRED"; return plan; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { plan.ok = false; plan.reason = "LOCK_BUSY"; return plan; }
  try {
    if (String(sheet.getRange(rowNumber, 10).getDisplayValue() || "").trim()) { plan.ok = false; plan.reason = "ALREADY_FILLED_NOT_OVERWRITTEN"; return plan; }   // re-check under lock
    sheet.getRange(rowNumber, 10).setValue(plan.value);
    plan.applied = true;
    return plan;
  } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- editor entry points (read-only; no arguments)
// Count only (no Spotify call). Logs totals and returns the LISTEN rows that have no Spotify cell.
function AUDIT_PODCAST_SPOTIFY_GAPS() { return auditRecommendedPodcastSpotifyGaps({}); }
// Classifies the first 15 missing rows with Spotify search (GET only; stops on 429/auth).
function AUDIT_PODCAST_SPOTIFY_GAPS_LOOKUP() { return auditRecommendedPodcastSpotifyGaps({ lookup: true, maxLookups: 15 }); }
// PODCAST 19 identity check as a DRY RUN: verifies the candidate show on Spotify, writes nothing.
function DRYRUN_PODCAST19_SPOTIFY_FILL() {
  const result = fillRecommendedPodcastSpotifyOne({ title: "ポッドキャスト茶会", showUrl: "https://open.spotify.com/show/7dDe6pPYCdUUDQ2AL40xtE" });
  console.log(JSON.stringify(result));
  return result;
}
