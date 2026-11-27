// Daily raise-only sampling. No automatic runner or trigger is changed here.
// AUTO normally appends at the end; the last three positions are a sample,
// never evidence for a whole-playlist maximum or for lowering the date.
// Do not save this sample under AUTO_LATEST_DATE_STATE_PREFIX_V1_: baseline
// and full reconciliation require evidence about the entire playlist.
const AUTO_LATEST_DATE_LIGHT_SAMPLE_SIZE_V1_ = 3;

function fetchAutoLatestDateLightJsonV1_(url, token) {
  // Deliberately bypass the full-audit retry helper: one GET, no sleep/retry.
  const response = UrlFetchApp.fetch(url, {
    method: "get", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const status = response.getResponseCode();
  if (status !== 200) throw new Error(status === 429 ? "SPOTIFY_429" : "SPOTIFY_HTTP_" + status);
  return JSON.parse(response.getContentText());
}

function fetchAutoLatestDateLightMetadataV1_(id, token) {
  const data = fetchAutoLatestDateLightJsonV1_(
    "https://api.spotify.com/v1/playlists/" + encodeURIComponent(id) +
    "?fields=" + encodeURIComponent("snapshot_id,items(total)"), token);
  const count = data.items && data.items.total;
  if (typeof data.snapshot_id !== "string" || !data.snapshot_id ||
      !Number.isSafeInteger(count) || count < 0) throw new Error("INCOMPLETE_METADATA");
  return { snapshotId: data.snapshot_id, itemCount: count };
}

function reconcileOneAutoPlaylistLatestDateLightV1_(playlistId, options) {
  const opts = options || {};
  const id = String(playlistId || "").trim();
  const result = { playlistId: id, status: "READ_FAILED", dryRun: opts.write !== true,
    scope: "TAIL_SAMPLE", sampleSize: AUTO_LATEST_DATE_LIGHT_SAMPLE_SIZE_V1_ };
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return Object.assign(result, { status: "INVALID_PLAYLIST_ID" });
  // Both entry points use an existing cache only. No refresh/cache/Properties writes.
  const token = opts.token || String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
  if (!token) return Object.assign(result, { status: "NO_VALID_CACHED_TOKEN" });
  const lock = opts.write === true ? LockService.getScriptLock() : null;
  if (lock && !lock.tryLock(5000)) return Object.assign(result, { status: "LOCK_BUSY" });
  try {
    const row = findAutoLatestDateSheetRowV1_(id);
    if (row.status !== "OK") return Object.assign(result, { status: row.status });
    result.sheetDate = row.latestDate;
    const before = fetchAutoLatestDateLightMetadataV1_(id, token);
    result.snapshotId = before.snapshotId;
    result.itemCount = before.itemCount;
    if (!before.itemCount) return Object.assign(result, { status: "EMPTY_PLAYLIST" });
    const offset = Math.max(0, before.itemCount - AUTO_LATEST_DATE_LIGHT_SAMPLE_SIZE_V1_);
    const count = before.itemCount - offset;
    const page = fetchAutoLatestDateLightJsonV1_(
      "https://api.spotify.com/v1/playlists/" + encodeURIComponent(id) +
      "/items?market=JP&limit=" + AUTO_LATEST_DATE_LIGHT_SAMPLE_SIZE_V1_ +
      "&offset=" + offset + "&fields=" + encodeURIComponent("items(is_local,item(id,type)),offset,total"), token);
    if (!Array.isArray(page.items) || page.total !== before.itemCount ||
        page.offset !== offset || page.items.length !== count) throw new Error("SAMPLE_INCOMPLETE");
    const ids = new Set();
    page.items.forEach(function(entry) {
      const item = entry && entry.item;
      const episodeId = String(item && item.id || "");
      if (!item || entry.is_local === true || item.type !== "episode" ||
          !/^[A-Za-z0-9]{22}$/.test(episodeId)) throw new Error("EPISODE_ID_UNAVAILABLE");
      ids.add(episodeId);
    });
    result.sampleOffset = offset;
    result.sampleIds = Array.from(ids);
    let sampledLatestDate = "";
    ids.forEach(function(episodeId) {
      const episode = fetchAutoLatestDateLightJsonV1_(
        "https://api.spotify.com/v1/episodes/" + encodeURIComponent(episodeId) + "?market=JP", token);
      const date = normalizeAutoLatestDateV1_(episode && episode.release_date);
      if (!episode || episode.id !== episodeId || episode.is_playable === false ||
          episode.release_date_precision !== "day" || !date || episode.release_date !== date) {
        throw new Error("EPISODE_DATE_UNAVAILABLE");
      }
      if (date > sampledLatestDate) sampledLatestDate = date;
    });
    const after = fetchAutoLatestDateLightMetadataV1_(id, token);
    if (after.snapshotId !== before.snapshotId || after.itemCount !== before.itemCount) {
      return Object.assign(result, { status: "SNAPSHOT_CHANGED" });
    }
    const currentRow = findAutoLatestDateSheetRowV1_(id);
    if (currentRow.status !== "OK") return Object.assign(result, { status: currentRow.status });
    if (currentRow.rowNumber !== row.rowNumber || currentRow.latestDate !== row.latestDate) {
      return Object.assign(result, { status: "SHEET_CHANGED" });
    }
    result.sampledLatestDate = sampledLatestDate;
    result.change = !row.latestDate ? "set" : sampledLatestDate > row.latestDate ? "raise" : "none";
    result.updated = false;
    if (opts.write === true && result.change !== "none") {
      currentRow.sheet.getRange(currentRow.rowNumber, 6).setValue(sampledLatestDate);
      result.updated = true;
    }
    return Object.assign(result, { status: "OK" });
  } catch (error) {
    const reason = String(error && error.message || error);
    return Object.assign(result, { status: reason === "SPOTIFY_429" ? "RATE_LIMITED" : "READ_FAILED", reason: reason });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function reconcileAllAutoPlaylistLatestDatesLightV1_(options) {
  const opts = options || {};
  const rules = collectAutoPlaylistLatestDateRulesV1_();
  const token = opts.token || String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
  if (!token) return { count: rules.length, status: "NO_VALID_CACHED_TOKEN", results: [] };
  const results = [];
  let stopped = false;
  rules.forEach(function(rule) {
    if (stopped) {
      results.push({ playlistId: rule.playlistId, status: "SKIPPED_AFTER_RATE_LIMIT", dryRun: opts.write !== true });
      return;
    }
    const result = reconcileOneAutoPlaylistLatestDateLightV1_(rule.playlistId, { token: token, write: opts.write === true });
    results.push(result);
    if (result.status === "RATE_LIMITED") stopped = true;
  });
  return { count: rules.length, stoppedAfterRateLimit: stopped, results: results };
}

// Manual entry points only. Future 05:xx / 14:xx triggers must target the
// light writer explicitly, never change hourly AUTO/backfill or audit runners.
function runAutoLatestDateLightDryRunV1() {
  const report = reconcileAllAutoPlaylistLatestDatesLightV1_({ write: false });
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function runAutoLatestDateLightWriteV1() {
  const report = reconcileAllAutoPlaylistLatestDatesLightV1_({ write: true });
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
