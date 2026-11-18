// One bounded pipeline for both newly saved and existing podcasts. Default: no writes.
const PODCAST_PLATFORMS_V2_ = ["youtube", "spotify", "amazon", "apple", "pocketcasts", "listen", "standfm", "pody"];
var podcastFetchContextV2_ = null;
function podcastPipelineHash_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).replace(/=+$/, "");
}
function podcastPipelineIdentity_(kind, row) {
  return kind + ":" + podcastPipelineHash_(String(row[0]) + "\n" + String(row[1]));
}
function podcastColumnMapV2_(kind) {
  return kind === "podcast" ? { youtube: 9, spotify: 10, amazon: 11, apple: 12, pocketcasts: 13, listen: 14, standfm: 15, pody: 16, artwork: 6, rss: 8, genre: 18 }
    : { youtube: 11, spotify: 6, amazon: 10, apple: 7, pocketcasts: 15, listen: 8, standfm: 9, pody: 16, artwork: 13, rss: 14, genre: 17 };
}
function newPodcastFetchContextV2_() {
  return { remaining: 20, rowRemaining: 6, requests: 0, deadline: Date.now() + 90000, memo: {}, errors: [] };
}
function fetchPodcastPlatformResource_(url, options) {
  const context = podcastFetchContextV2_;
  if (!context) return UrlFetchApp.fetch(url, options || {}); // Legacy helpers unchanged outside V2.
  const key = String(url) + "\n" + JSON.stringify(options || {});
  if (context.memo[key]) {
    if (context.memo[key].error) throw new Error(context.memo[key].error);
    return context.memo[key].response;
  }
  if (context.remaining <= 0 || context.rowRemaining <= 0 || Date.now() >= context.deadline) {
    context.errors.push("Podcast lookup budget exhausted");
    throw new Error("Podcast lookup budget exhausted");
  }
  context.remaining--; context.rowRemaining--; context.requests++;
  try {
    Utilities.sleep(250);
    const response = UrlFetchApp.fetch(url, options || {});
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) throw new Error("HTTP " + code);
    if (response.getContentText().length > 3000000) throw new Error("Response too large");
    context.memo[key] = { response: response };
    return response;
  } catch (error) {
    const message = String(error && error.message || error);
    context.errors.push(message); context.memo[key] = { error: message }; throw error;
  }
}
function podcastSafeFeedV2_(value) {
  return /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/|$)/.test(String(value || "")) &&
    !/[?&](?:token|auth|key|signature|sig|access_token)=/i.test(value);
}
function podcastKnownLinkV2_(url) {
  const match = String(url || "").trim().match(/^https:\/\/([^/?#]+)(\/[^#]*)?$/i);
  if (!match || match[1].indexOf("@") >= 0) return null;
  const host = match[1].toLowerCase(), path = match[2] || "/";
  const rules = [
    ["spotify", host === "open.spotify.com" && /^\/show\/[A-Za-z0-9]+(?:[/?]|$)/.test(path)],
    ["apple", host === "podcasts.apple.com" && /\/id\d+(?:[/?]|$)/.test(path)],
    ["youtube", (host === "youtube.com" || host === "www.youtube.com") && /^\/(?:@|channel\/|playlist\?list=)/.test(path)],
    ["amazon", /^(?:music\.|www\.)?amazon\.[a-z.]+$/.test(host) && /^\/podcasts\//.test(path)],
    ["listen", host === "listen.style" && /^\/p\/[^/?]+/.test(path)],
    ["standfm", host === "stand.fm" && /^\/channels\/[^/?]+/.test(path)],
    ["pocketcasts", /^(?:pca\.st|(?:www\.)?pocketcasts\.com)$/.test(host)],
    ["pody", host === "pody.jp" && /^\/player\/[A-Za-z0-9]+(?:[/?]|$)/.test(path)]
  ];
  const found = rules.find(rule => rule[1]);
  return found ? { platform: found[0], url: String(url).trim() } : null;
}
function podcastTitleMatchesV2_(actual, wanted) {
  const terms = typeof podcastSearchTitleCandidates_ === "function" ? podcastSearchTitleCandidates_(wanted) : [wanted];
  return terms.some(term => normalizeTitle(term) === normalizeTitle(actual));
}
function podcastMakerMatchesV2_(actual, wanted) {
  const a = normalizeTitle(actual || ""), w = normalizeTitle(wanted || "");
  return !a || !w || a === w || a.indexOf(w) >= 0 || w.indexOf(a) >= 0;
}
function readPodcastFeedV2_(url, title, maker) {
  if (!podcastSafeFeedV2_(url)) return { status: "mismatch" };
  try {
    // These existing parsers share a single fetched response through the V2 memo.
    const meta = readPodcastFeedMetadata_(url);
    if (!meta) return { status: "retryableError" };
    if (!podcastTitleMatchesV2_(meta.title, title) || !podcastMakerMatchesV2_(meta.maker, maker)) return { status: "mismatch" };
    return { status: "verified", meta: meta, links: readPodcastFeedLinks_(url),
      audio: extractPodyAudioUrls_(fetchPodcastPlatformResource_(url, { muteHttpExceptions: true, followRedirects: true }).getContentText()) };
  } catch (_) { return { status: "retryableError" }; }
}
function resolveMissingPodcastPlatformsV2_(job, due) {
  const current = {};
  Object.keys(job.columns).forEach(key => { current[key] = String(job.row[job.columns[key] - 1] || "").trim(); });
  const values = {}, statuses = {};
  due.forEach(key => { statuses[key] = "notFound"; });
  const title = String(job.row[1] || "").trim();
  const maker = job.kind === "podcast" ? String(job.row[6] || "").trim() : String(job.row[2] || "").trim();
  const accept = (key, value) => {
    const known = podcastKnownLinkV2_(value);
    if (!current[key] && due.indexOf(key) >= 0 && known && known.platform === key) {
      values[key] = known.url; statuses[key] = "verified";
    }
  };
  const source = podcastKnownLinkV2_(job.row[0]);
  if (source && source.platform !== "pody") accept(source.platform, source.url);
  let rss = current.rss;
  if (!rss && podcastSafeFeedV2_(job.row[0]) && /(?:\/(?:rss|feed)(?:[/?#]|$)|\.(?:rss|xml)(?:[?#]|$))/i.test(job.row[0])) rss = job.row[0];
  if (!rss) {
    const listen = podcastKnownLinkV2_(current.listen || job.row[0]);
    if (listen && listen.platform === "listen") rss = "https://rss.listen.style/p/" + listen.url.match(/\/p\/([^/?]+)/)[1] + "/rss";
  }
  const needsFeed = due.some(key => key !== "spotify" && key !== "apple");
  let apple = null;
  // Existing Apple URL may supply a missing RSS dependency; never search/replace it.
  if (!rss && needsFeed && current.apple) apple = lookupApplePodcastByUrl_(current.apple);
  if (!current.apple && due.indexOf("apple") >= 0 && !values.apple) {
    apple = findUniqueApplePodcastV2_(title, maker);
    if (apple) accept("apple", apple.collectionViewUrl || apple.trackViewUrl || "");
  }
  if (apple && !rss) rss = String(apple.feedUrl || "").trim();
  if (due.indexOf("spotify") >= 0 && !current.spotify && !values.spotify) {
    try { accept("spotify", findMissingSpotifyPodcastV2_(title, maker) || ""); }
    catch (_) { statuses.spotify = "retryableError"; }
  }
  let feed = null;
  if (needsFeed && rss) feed = readPodcastFeedV2_(rss, title, maker);
  if (feed && feed.status === "verified") {
    (feed.links || []).forEach(url => { const known = podcastKnownLinkV2_(url); if (known && known.platform !== "pody") accept(known.platform, known.url); });
    if (!current.artwork && due.indexOf("artwork") >= 0 && /^https:\/\//.test(feed.meta.artwork || "")) { values.artwork = feed.meta.artwork; statuses.artwork = "verified"; }
    if (!current.rss && due.indexOf("rss") >= 0) { values.rss = rss; statuses.rss = "verified"; }
    if (due.indexOf("pody") >= 0 && !current.pody) {
      const result = resolvePodyFromVerifiedFeedV2_(title, feed.audio || [], source && source.platform === "pody" ? source.url : "");
      if (result.url) { values.pody = result.url; statuses.pody = "verified"; }
      else statuses.pody = result.status;
    }
  } else if (needsFeed) {
    due.filter(key => key !== "spotify" && key !== "apple").forEach(key => { if (!values[key]) statuses[key] = feed ? feed.status : "retryableError"; });
  }
  return { values: values, statuses: statuses };
}
function findMissingSpotifyPodcastV2_(title, maker) {
  // Use the existing token accessor but route its HTTP (including auth) through the
  // shared request budget in this candidate's Spotify helper adapter.
  const token = getPodcastLookupTokenV2_();
  if (!token) throw new Error("Spotify lookup credentials unavailable");
  const terms = typeof podcastSearchTitleCandidates_ === "function" ? podcastSearchTitleCandidates_(title) : [title];
  const matches = {};
  const titleOnly = {};
  for (let i = 0; i < Math.min(terms.length, 3); i++) {
    const response = fetchPodcastPlatformResource_("https://api.spotify.com/v1/search?q=" + encodeURIComponent(terms[i]) + "&type=show&market=JP&limit=10",
      { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
    const data = JSON.parse(response.getContentText());
    ((data.shows || {}).items || []).forEach(show => {
      if (!(podcastTitleMatchesV2_(show.name, title) && show.external_urls && show.external_urls.spotify)) return;
      titleOnly[show.external_urls.spotify] = true;
      if (podcastExactMakerV2_(show.publisher, maker)) matches[show.external_urls.spotify] = true;
    });
  }
  const urls = Object.keys(matches);
  if (urls.length === 1) return urls[0];
  // 配信者名が朝リスネームと違っても、番組名が完全一致する番組がSpotifyに1つだけなら採用（2026-11-18）
  const only = Object.keys(titleOnly);
  return urls.length === 0 && only.length === 1 ? only[0] : "";
}
function getPodcastLookupTokenV2_() {
  // No cache write in dry-run, and no token refresh outside the shared HTTP budget.
  const cached = CacheService.getScriptCache().get("spotify_access_token");
  if (cached) return cached;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SPOTIFY_CLIENT_ID"), secret = props.getProperty("SPOTIFY_CLIENT_SECRET");
  if (!id || !secret) return "";
  const response = fetchPodcastPlatformResource_("https://accounts.spotify.com/api/token", {
    method: "post", muteHttpExceptions: true, headers: { Authorization: "Basic " + Utilities.base64Encode(id + ":" + secret) },
    payload: { grant_type: "client_credentials" }
  });
  return String(JSON.parse(response.getContentText()).access_token || "");
}
function podcastPipelineJobsV2_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID), jobs = [];
  ["listenerPodcast", "podcast"].forEach(kind => {
    const sheet = getSheetLoose(ss, kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME);
    if (!sheet) throw new Error("Podcast sheet missing");
    validatePodcastColumnsV2_(sheet, kind);
    if (sheet.getLastRow() < 2) return;
    const columns = podcastColumnMapV2_(kind);
    const projection = kind === "podcast" ? readPodcastSheet(sheet) : readListenerPodcastSheet(sheet);
    if (!projection || !projection.ok || !Array.isArray(projection.items)) throw new Error("Podcast public projection unavailable");
    const width = kind === "podcast" ? 18 : 17;
    sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues().forEach((row, index) => {
      if (String(row[1] || "").trim() && projection.items.some(item => normalizeUrl(item.url) === normalizeUrl(row[0]) && normalizeTitle(item.title) === normalizeTitle(row[1]))) jobs.push({ kind: kind, sheet: sheet, row: row, number: index + 2, columns: columns, identity: podcastPipelineIdentity_(kind, row) });
    });
  });
  return jobs;
}
function commitPodcastPipelineValuesV2_(job, values) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { writes: 0, retry: true };
  try {
    validatePodcastColumnsV2_(job.sheet, job.kind);
    const rows = job.sheet.getRange(2, 1, job.sheet.getLastRow() - 1, job.kind === "podcast" ? 18 : 17).getDisplayValues();
    const matches = rows.map((row, index) => ({ row: row, number: index + 2 })).filter(item => podcastPipelineIdentity_(job.kind, item.row) === job.identity);
    if (matches.length !== 1) return { writes: 0, retry: true };
    const current = matches[0]; let writes = 0;
    Object.keys(values).forEach(key => {
      if (!job.columns[key] || key === "genre" || !values[key]) return;
      // Includes human edits and moved rows; no destructive replacement.
      if (!String(job.sheet.getRange(current.number, job.columns[key]).getDisplayValue() || "").trim()) {
        job.sheet.getRange(current.number, job.columns[key]).setValue(values[key]); writes++;
      }
    });
    return { writes: writes, retry: false };
  } finally { lock.releaseLock(); }
}
function syncPodcastMissingPlatformsV2(dryRun, onlyKind) {
  const preview = dryRun !== false;
  const store = PropertiesService.getScriptProperties();
  const lease = preview ? null : acquirePodcastRunnerLeaseV2_(store);
  if (!preview && !lease) return { dryRun:false, busy:true, scanned:0, processed:0, requests:0, results:[] };
  try {
  const now = Date.now(), all = podcastPipelineJobsV2_().filter(job => !onlyKind || job.kind === onlyKind);
  const cursor = Number(store.getProperty("PODCAST_PIPELINE_CURSOR_V2") || 0) % Math.max(all.length, 1);
  const rotated = all.slice(cursor).concat(all.slice(0, cursor));
  const priorities = newPodcastPriorityIdentities_();
  const isPriority = job => priorities.some(p => p.kind === job.kind && p.url === job.row[0] && p.title === job.row[1]);
  const context = newPodcastFetchContextV2_();
  const results = []; let processed = 0, priorityCount = 0;
  const ordered = rotated.filter(isPriority).concat(rotated.filter(job => !isPriority(job)));
  podcastFetchContextV2_ = context;
  try {
    for (let i = 0; i < ordered.length; i++) {
      const job = ordered[i];
      if (processed >= 8 || context.remaining <= 0 || Date.now() >= context.deadline) break;
      if (isPriority(job) && priorityCount >= 1) continue;
      const reservedForExisting = rotated.some(item => !isPriority(item)) ? 6 : 0;
      if (isPriority(job) && context.remaining <= reservedForExisting) continue;
      const stateKey = "PODCAST_PIPELINE_STATE_V2_" + job.identity;
      let state = {}; try { state = JSON.parse(store.getProperty(stateKey) || "{}"); } catch (_) {}
      const targets = PODCAST_PLATFORMS_V2_.concat(["artwork", "rss"]);
      const due = targets.filter(key => !String(job.row[job.columns[key] - 1] || "").trim() && (!state[key] || state[key].next <= now));
      if (!due.length) continue;
      processed++; if (isPriority(job)) priorityCount++;
      context.errors = [];
      context.rowRemaining = isPriority(job) ? Math.min(6, context.remaining - reservedForExisting) : 6;
      let outcome;
      try { outcome = resolveMissingPodcastPlatformsV2_(job, due); }
      catch (_) { outcome = { values: {}, statuses: Object.fromEntries(due.map(key => [key, "retryableError"])) }; }
      // Swallowed helper failures must not masquerade as confirmed absence.
      due.forEach(key => {
        if (!outcome.values[key] && context.errors.length && outcome.statuses[key] === "notFound") outcome.statuses[key] = "retryableError";
      });
      let commit = { writes: 0, retry: false };
      if (!preview) commit = commitPodcastPipelineValuesV2_(job, outcome.values);
      results.push({ kind: job.kind, title: job.row[1], priority: isPriority(job), missing: due, values: outcome.values, statuses: outcome.statuses, writes: commit.writes });
      if (!preview) {
        due.forEach(key => {
          let status = outcome.statuses[key] || "retryableError";
          if (commit.retry) status = "retryableError";
          state[key] = { status: status, next: now + (status === "retryableError" ? 3600000 : 7 * 86400000) };
        });
        state.updated = now;
        try { podcastSetPropertySafeV2_(store, stateKey, JSON.stringify(state)); } catch (_) { Logger.log("Podcast backoff deferred: Properties unavailable"); }
        // Cursor points AFTER the actual row processed, not after a hypothetical batch.
        podcastSetPropertySafeV2_(store, "PODCAST_PIPELINE_CURSOR_V2", String((all.findIndex(item => item.identity === job.identity) + 1) % Math.max(all.length, 1)));
      }
    }
    if (!preview) prunePodcastPipelineStateV2_(store, now);
    return { dryRun: preview, scanned: all.length, countsByKind: {listenerPodcast: all.filter(j => j.kind === "listenerPodcast").length, podcast: all.filter(j => j.kind === "podcast").length}, processed: processed, requests: context.requests, results: results };
  } finally { podcastFetchContextV2_ = null; }
  } finally { if (lease) releasePodcastRunnerLeaseV2_(store, lease); }
}
function prunePodcastPipelineStateV2_(store, now) {
  const props = store.getProperties();
  const records = Object.keys(props).filter(key => key.indexOf("PODCAST_PIPELINE_STATE_V2_") === 0).map(key => {
    try { return { key: key, updated: JSON.parse(props[key]).updated || 0 }; } catch (_) { return { key: key, updated: 0 }; }
  }).sort((a, b) => a.updated - b.updated);
  records.forEach((record, i) => { if (now - record.updated > 30 * 86400000 || i < records.length - 200) store.deleteProperty(record.key); });
}

function podcastExactMakerV2_(actual, wanted) {
  return !!normalizeTitle(wanted || "") && normalizeTitle(actual || "") === normalizeTitle(wanted);
}
function findUniqueApplePodcastV2_(title, maker) {
  const matches = {};
  const terms = typeof podcastSearchTitleCandidates_ === "function" ? podcastSearchTitleCandidates_(title) : [title];
  for (let i = 0; i < Math.min(terms.length, 3); i++) {
    const data = fetchJson("https://itunes.apple.com/search?media=podcast&entity=podcast&limit=12&country=JP&term=" + encodeURIComponent(terms[i]));
    if (!data || !Array.isArray(data.results)) throw new Error("Apple search unavailable");
    (data.results || []).forEach(item => {
      const url = item.collectionViewUrl || item.trackViewUrl;
      if (url && podcastTitleMatchesV2_(item.collectionName || item.trackName, title) && podcastExactMakerV2_(item.artistName || item.collectionArtistName, maker)) matches[url] = item;
    });
  }
  const urls = Object.keys(matches); return urls.length === 1 ? matches[urls[0]] : null;
}
function validatePodcastColumnsV2_(sheet, kind) {
  const columns = podcastColumnMapV2_(kind);
  const allowed = {youtube:["youtube"],spotify:["spotify"],amazon:["amazon","amazonmusic"],apple:["apple","applepodcasts"],pocketcasts:["pocketcasts"],listen:["listen"],standfm:["standfm"],pody:["pody"],rss:["rss"],artwork:["画像","画像url","アートワーク","artwork","artworkurl"]};
  const headers = sheet.getRange(1, 1, 1, kind === "podcast" ? 18 : 17).getDisplayValues()[0];
  Object.keys(allowed).forEach(key => {
    const clean = String(headers[columns[key] - 1] || "").normalize("NFKC").toLowerCase().replace(/[\s._-]/g, "");
    if (allowed[key].indexOf(clean) < 0) throw new Error("Podcast column header mismatch: " + kind + " / " + key + " / " + columns[key]);
  });
  return {kind:kind, verified:true};
}
function inspectPodcastColumnsV2() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ["listenerPodcast", "podcast"].map(kind => validatePodcastColumnsV2_(getSheetLoose(ss, kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME), kind));
}

function acquirePodcastRunnerLeaseV2_(store) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return null;
  try {
    let previous = {}; try { previous = JSON.parse(store.getProperty("PODCAST_PIPELINE_LEASE_V2") || "{}"); } catch (_) {}
    if (previous.until > Date.now()) return null;
    const lease = {id: Utilities.getUuid(), until: Date.now() + 7 * 60000};
    podcastSetPropertySafeV2_(store, "PODCAST_PIPELINE_LEASE_V2", JSON.stringify(lease));
    return lease;
  } finally { lock.releaseLock(); }
}
function releasePodcastRunnerLeaseV2_(store, lease) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    let current = {}; try { current = JSON.parse(store.getProperty("PODCAST_PIPELINE_LEASE_V2") || "{}"); } catch (_) {}
    if (current.id === lease.id) store.deleteProperty("PODCAST_PIPELINE_LEASE_V2");
  } finally { lock.releaseLock(); }
}

// 確認用（書き込みなし）
function PODCAST_PREVIEW_LOG() { const r = syncPodcastMissingPlatformsV2(true); Logger.log(JSON.stringify(r).slice(0, 8000)); return r; }
