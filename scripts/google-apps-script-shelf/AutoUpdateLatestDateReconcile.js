// AUTO管理中のSpotifyプレイリストと作業台F列の最終新着日を照合する。
// 単体関数はdry-runが既定。日次runnerだけが明示的にwriteを指定する。
const AUTO_LATEST_DATE_STATE_PREFIX_V1_ = "AUTO_LATEST_DATE_STATE_V1_";
const AUTO_LATEST_DATE_PAGE_SIZE_V1_ = 50;
const AUTO_LATEST_DATE_MAX_PAGES_V1_ = 100;

function collectAutoPlaylistLatestDateRulesV1_() {
  const byId = {};
  const fixedKeys = typeof AUTO_UPDATE_V1_MANAGED_FIXED_RULE_KEYS_ === "undefined"
    ? [] : AUTO_UPDATE_V1_MANAGED_FIXED_RULE_KEYS_;
  const fixed = (typeof AUTO_PLAYLIST_RULES === "undefined" ? [] : AUTO_PLAYLIST_RULES).filter(function(rule) {
    if (!rule || rule.enabled !== true || rule.productionWriteAllowed === false || rule.bootstrapPending === true) return false;
    // Older fixed rules have no lifecycle/production flags; only the existing daily allowlist may opt in.
    if (rule.lifecycleStatus && rule.lifecycleStatus !== "incremental") return false;
    return rule.productionWriteAllowed === true || fixedKeys.indexOf(rule.key) >= 0;
  });
  const dynamic = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return rule && rule.enabled === true && rule.productionWriteAllowed === true &&
      rule.bootstrapPending === false && rule.lifecycleStatus === "incremental";
  });
  fixed.concat(dynamic).forEach(function(rule) {
    const id = String(rule.playlistId || "").trim();
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return;
    if (!byId[id]) byId[id] = { playlistId: id, keys: [] };
    byId[id].keys.push(String(rule.key || id));
  });
  return Object.keys(byId).map(function(id) { return byId[id]; });
}

function normalizeAutoLatestDateV1_(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return "";
  const date = match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
  const parsed = new Date(date + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

function findAutoLatestDateSheetRowV1_(playlistId) {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), "作業台");
  if (!sheet || sheet.getLastRow() < 2) return { status: "ROW_MISSING" };
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues();
  const matches = [];
  values.forEach(function(row, index) {
    const cell = String(row[0] || "").trim();
    const match = cell.match(/^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})(?:[/?#]|$)/i);
    const id = match ? match[1] : cell;
    if (id === playlistId) matches.push({ rowNumber: index + 2, rawDate: String(row[5] || "").trim() });
  });
  if (matches.length !== 1) return { status: matches.length ? "ROW_DUPLICATE" : "ROW_MISSING" };
  const row = matches[0];
  const date = normalizeAutoLatestDateV1_(row.rawDate);
  if (row.rawDate && !date) return { status: "INVALID_SHEET_DATE" };
  return { status: "OK", sheet: sheet, rowNumber: row.rowNumber, latestDate: date };
}

function loadAutoLatestDateStateV1_(playlistId) {
  const raw = PropertiesService.getScriptProperties().getProperty(AUTO_LATEST_DATE_STATE_PREFIX_V1_ + playlistId);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state && typeof state.snapshotId === "string" && state.snapshotId &&
      normalizeAutoLatestDateV1_(state.latestDate) === state.latestDate &&
      Number.isSafeInteger(state.itemCount) && state.itemCount > 0 ? state : null;
  } catch (error) {
    return null;
  }
}

function fetchAutoLatestDateJsonV1_(url, token) {
  const response = fetchSpotifyReadWithRetry_(url, {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  }, "AUTO最新日付照合");
  const status = response.getResponseCode();
  if (status !== 200) throw new Error(status === 429 ? "SPOTIFY_429" : "SPOTIFY_HTTP_" + status);
  return JSON.parse(response.getContentText());
}

function fetchAutoLatestDateMetadataV1_(playlistId, token) {
  const url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) +
    "?fields=" + encodeURIComponent("snapshot_id,items(total)");
  const data = fetchAutoLatestDateJsonV1_(url, token);
  const snapshotId = String(data.snapshot_id || "");
  const count = data.items && data.items.total;
  if (!snapshotId || !Number.isSafeInteger(count) || count < 0) throw new Error("INCOMPLETE_METADATA");
  return { snapshotId: snapshotId, itemCount: count };
}

function getAutoLatestDateTokenV1_(options) {
  const opts = options || {};
  if (opts.token) return opts.token;
  // A dry-run must not invoke a refresh flow that can update the Spotify token cache.
  return opts.write === true ? getSpotifyUserAccessToken() :
    String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
}

function scanAutoPlaylistLatestDateV1_(playlistId, token, before) {
  let url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) +
    "/items?market=JP&limit=" + AUTO_LATEST_DATE_PAGE_SIZE_V1_ +
    "&fields=" + encodeURIComponent("items(item(id,type,release_date,release_date_precision)),next,total");
  let latestDate = "";
  let count = 0;
  let pages = 0;
  const datesById = {};
  while (url) {
    if (++pages > AUTO_LATEST_DATE_MAX_PAGES_V1_) throw new Error("SCAN_INCOMPLETE");
    const page = fetchAutoLatestDateJsonV1_(url, token);
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) || page.total !== before.itemCount) {
      throw new Error("SCAN_INCOMPLETE");
    }
    if (page.next && page.items.length === 0) throw new Error("SCAN_INCOMPLETE");
    const ids = page.items.map(function(row) {
      const item = row && row.item;
      if (!item || item.type !== "episode" || !item.id) {
        throw new Error("EPISODE_ID_UNAVAILABLE");
      }
      return String(item.id);
    });
    // Playlist items may omit the date. Read each unique episode through the
    // existing Spotify read/retry path; keep precision, which the AUTO helper
    // intentionally omits from its return value.
    ids.forEach(function(id) {
      if (!Object.prototype.hasOwnProperty.call(datesById, id)) {
        const episode = fetchAutoLatestDateJsonV1_(
          "https:" + "//api.spotify.com/v1/episodes/" + encodeURIComponent(id) + "?market=JP", token
        );
        const date = normalizeAutoLatestDateV1_(episode && episode.release_date);
        if (!episode || String(episode.id || "") !== id || episode.is_playable === false ||
            episode.release_date_precision !== "day" ||
            !date || String(episode.release_date) !== date) {
          throw new Error("EPISODE_DATE_UNAVAILABLE");
        }
        datesById[id] = date;
      }
      if (datesById[id] > latestDate) latestDate = datesById[id];
    });
    count += page.items.length;
    url = page.next ? String(page.next) : "";
  }
  if (count !== before.itemCount) throw new Error("SCAN_INCOMPLETE");
  return { latestDate: latestDate, itemCount: count };
}

function reconcileOneAutoPlaylistLatestDateV1_(playlistId, options) {
  const opts = options || {};
  const id = String(playlistId || "").trim();
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return { playlistId: id, status: "INVALID_PLAYLIST_ID" };
  const write = opts.write === true;
  let sheetRow = findAutoLatestDateSheetRowV1_(id);
  if (sheetRow.status !== "OK") return { playlistId: id, status: sheetRow.status };
  let before;
  let confirmed;
  let fromCache = false;
  try {
    const token = getAutoLatestDateTokenV1_(opts);
    if (!token) return { playlistId: id, status: "NO_VALID_CACHED_TOKEN" };
    before = fetchAutoLatestDateMetadataV1_(id, token);
    if (before.itemCount === 0) return { playlistId: id, status: "EMPTY_PLAYLIST", sheetDate: sheetRow.latestDate };
    const state = loadAutoLatestDateStateV1_(id);
    if (state && state.snapshotId === before.snapshotId && state.itemCount === before.itemCount) {
      confirmed = state.latestDate;
      fromCache = true;
      if (write) {
        const after = fetchAutoLatestDateMetadataV1_(id, token);
        if (after.snapshotId !== before.snapshotId || after.itemCount !== before.itemCount) {
          return { playlistId: id, status: "SNAPSHOT_CHANGED" };
        }
      }
    } else {
      confirmed = scanAutoPlaylistLatestDateV1_(id, token, before).latestDate;
      const after = fetchAutoLatestDateMetadataV1_(id, token);
      if (after.snapshotId !== before.snapshotId || after.itemCount !== before.itemCount) {
        return { playlistId: id, status: "SNAPSHOT_CHANGED" };
      }
    }
  } catch (error) {
    const reason = String(error && error.message ? error.message : error);
    return { playlistId: id, status: /429|レート制限/.test(reason) ? "RATE_LIMITED" : "READ_FAILED", reason: reason };
  }
  const result = { playlistId: id, status: "OK", sheetDate: sheetRow.latestDate,
    confirmedLatestDate: confirmed, itemCount: before.itemCount,
    snapshotId: before.snapshotId, fromCache: fromCache,
    change: !sheetRow.latestDate ? "set" : confirmed > sheetRow.latestDate ? "raise" :
      confirmed < sheetRow.latestDate ? "lower" : "none", dryRun: !write };
  if (!write) return result;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return Object.assign(result, { status: "LOCK_BUSY" });
  try {
    // Hourly bootstrap or a human edit may have changed the row during Spotify reads.
    sheetRow = findAutoLatestDateSheetRowV1_(id);
    if (sheetRow.status !== "OK") return Object.assign(result, { status: sheetRow.status });
    if (sheetRow.latestDate !== result.sheetDate) return Object.assign(result, { status: "SHEET_CHANGED" });
    if (result.change !== "none") sheetRow.sheet.getRange(sheetRow.rowNumber, 6).setValue(confirmed);
    if (!fromCache) PropertiesService.getScriptProperties().setProperty(
      AUTO_LATEST_DATE_STATE_PREFIX_V1_ + id,
      JSON.stringify({ snapshotId: before.snapshotId, latestDate: confirmed, itemCount: before.itemCount })
    );
    return result;
  } finally {
    lock.releaseLock();
  }
}

function reconcileAllAutoPlaylistLatestDatesV1_(options) {
  const opts = options || {};
  const rules = collectAutoPlaylistLatestDateRulesV1_();
  if (!rules.length) return { count: 0, results: [] };
  const token = getAutoLatestDateTokenV1_(opts);
  if (!token) return { count: rules.length, status: "NO_VALID_CACHED_TOKEN", results: [] };
  const results = rules.map(function(rule) {
    try {
      return reconcileOneAutoPlaylistLatestDateV1_(rule.playlistId, { token: token, write: opts.write === true });
    } catch (error) {
      return { playlistId: rule.playlistId, status: "ERROR", reason: String(error) };
    }
  });
  return { count: rules.length, results: results };
}

function runAutoLatestDateDryRunV1() {
  const result = reconcileAllAutoPlaylistLatestDatesV1_({ write: false });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function runAutoLatestDateWriteV1() {
  const result = reconcileAllAutoPlaylistLatestDatesV1_({ write: true });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// Manual baseline inventory diagnosis only. Keep the production reconciliation
// and AUTO runner above unchanged; no episode-detail lookup or state save.
function scanAutoLatestDateBaselineIdsV1_(playlistId, token, before) {
  let url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) +
    "/items?market=JP&limit=" + AUTO_LATEST_DATE_PAGE_SIZE_V1_ +
    "&fields=" + encodeURIComponent("items(added_at,item(id,type)),next,total");
  const ids = new Set();
  const nullItems = [];
  let itemCount = 0;
  let pages = 0;
  while (url) {
    if (++pages > AUTO_LATEST_DATE_MAX_PAGES_V1_) throw new Error("SCAN_INCOMPLETE");
    const page = fetchAutoLatestDateJsonV1_(url, token);
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) ||
        page.total !== before.itemCount || page.next && !page.items.length) {
      throw new Error("SCAN_INCOMPLETE");
    }
    page.items.forEach(function(row, index) {
      const item = row && row.item;
      if (row && item === null) {
        nullItems.push({ offset: itemCount + index, addedAt: String(row.added_at || ""),
          snapshotId: before.snapshotId });
        return;
      }
      const id = String(item && item.id || "");
      if (!item || item.type !== "episode" || !/^[A-Za-z0-9]{22}$/.test(id)) {
        throw new Error("EPISODE_ID_UNAVAILABLE");
      }
      ids.add(id);
    });
    itemCount += page.items.length;
    url = page.next ? String(page.next) : "";
  }
  if (itemCount !== before.itemCount) throw new Error("SCAN_INCOMPLETE");
  return { ids: ids, nullItems: nullItems };
}

// This public function is intentionally absent from every automatic runner.
// The optional evidence map is accepted only with a date, matching current
// snapshot, and a nonempty human-verifiable source description.
function runAutoLatestDateBaselineDryRunV1(evidenceByPlaylistId) {
  const token = String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
  const rules = collectAutoPlaylistLatestDateRulesV1_();
  const results = rules.map(function(rule) {
    const id = rule.playlistId;
    const evidence = evidenceByPlaylistId && evidenceByPlaylistId[id];
    const result = { playlistId: id, currentSnapshotId: null, itemCount: null,
      uniqueIdCount: null, nullCount: null, nullItems: null, sheetDate: null,
      evidenceDate: evidence && evidence.latestDate || null,
      evidenceSnapshotId: evidence && evidence.snapshotId || null,
      ownerKnown: null, classification: "BASELINE_UNAVAILABLE", reason: "" };
    if (!token) { result.reason = "NO_VALID_CACHED_TOKEN"; return result; }
    try {
      const row = findAutoLatestDateSheetRowV1_(id);
      if (row.status !== "OK") { result.reason = row.status; return result; }
      result.sheetDate = row.latestDate;
      const before = fetchAutoLatestDateMetadataV1_(id, token);
      result.currentSnapshotId = before.snapshotId;
      result.itemCount = before.itemCount;
      if (!before.itemCount) { result.reason = "EMPTY_PLAYLIST"; return result; }
      const scan = scanAutoLatestDateBaselineIdsV1_(id, token, before);
      const after = fetchAutoLatestDateMetadataV1_(id, token);
      if (after.snapshotId !== before.snapshotId || after.itemCount !== before.itemCount) {
        result.reason = "SNAPSHOT_CHANGED"; return result;
      }
      result.uniqueIdCount = scan.ids.size;
      result.nullCount = scan.nullItems.length;
      result.nullItems = scan.nullItems;
      const state = loadAutoLatestDateStateV1_(id);
      result.ownerKnown = Boolean(state && state.ownerKnown === true &&
        Array.isArray(state.ids) && state.snapshotId === before.snapshotId &&
        state.itemCount === before.itemCount && state.latestEpisodeId &&
        scan.ids.has(state.latestEpisodeId));
      result.classification = "HUMAN_CONFIRM";
      const date = String(evidence && evidence.latestDate || "");
      const snapshot = String(evidence && evidence.snapshotId || "");
      const source = String(evidence && evidence.source || "").trim();
      if (date && snapshot && snapshot !== before.snapshotId) {
        result.reason = "EVIDENCE_SNAPSHOT_STALE";
      } else if (!date || normalizeAutoLatestDateV1_(date) !== date ||
                 snapshot !== before.snapshotId || !source) {
        result.reason = "TRUSTED_DATE_REQUIRED";
      } else if (state && state.snapshotId === before.snapshotId &&
                 state.itemCount === before.itemCount && state.latestDate !== date) {
        result.reason = "SAVED_EVIDENCE_CONFLICT";
      } else if (row.latestDate !== date) {
        result.reason = "SHEET_DATE_MISMATCH";
      } else if (state && Array.isArray(state.ids)) {
        result.reason = "ALREADY_BASELINED";
      } else {
        result.classification = "READY";
        result.reason = "EVIDENCE_VERIFIED";
      }
    } catch (error) {
      const reason = String(error && error.message || error);
      result.classification = "BASELINE_UNAVAILABLE";
      result.reason = /429|レート制限/.test(reason) ? "RATE_LIMITED" : reason;
    }
    return result;
  });
  const report = { count: rules.length, results: results };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// Manual, read-only investigation of the three baseline ID failures. A row
// lacking a valid episode ID is never silently removed from the inventory.
function diagnoseAutoLatestDateMissingIdsReadOnlyV1() {
  const playlistIds = [
    "4Ri6rxTGFimTm0KkZtKfBZ",
    "7jLXrZ0JUNOnsSeFEFbw9S",
    "7aKDEfAdCjTxiqiv19Grar"
  ];
  const token = String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
  const results = [];
  let stopped = false;
  playlistIds.forEach(function(playlistId) {
    if (!token || stopped) {
      results.push({ playlistId: playlistId, status: !token ? "NO_VALID_CACHED_TOKEN" :
        "SKIPPED_AFTER_RATE_LIMIT", baselineSafety: "BLOCKED", problems: [] });
      return;
    }
    const result = { playlistId: playlistId, status: "READ_FAILED", baselineSafety: "BLOCKED",
      snapshotIdBefore: null, snapshotIdAfter: null, itemCount: null,
      scannedItemCount: 0, problems: [] };
    try {
      const before = fetchAutoLatestDateMetadataV1_(playlistId, token);
      result.snapshotIdBefore = before.snapshotId;
      result.itemCount = before.itemCount;
      let offset = 0;
      let pages = 0;
      while (offset < before.itemCount) {
        if (++pages > AUTO_LATEST_DATE_MAX_PAGES_V1_) throw new Error("SCAN_INCOMPLETE");
        const url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) +
          "/items?market=JP&limit=" + AUTO_LATEST_DATE_PAGE_SIZE_V1_ +
          "&offset=" + offset + "&fields=" + encodeURIComponent(
            "items(is_local,added_at,item(id,type,name,uri,href,external_urls,linked_from,is_playable,restrictions)),total,offset"
          );
        const page = fetchAutoLatestDateJsonV1_(url, token);
        if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) ||
            page.total !== before.itemCount || page.offset !== offset ||
            !page.items.length || page.items.length > AUTO_LATEST_DATE_PAGE_SIZE_V1_ ||
            offset + page.items.length > before.itemCount) throw new Error("SCAN_INCOMPLETE");
        page.items.forEach(function(row, index) {
          const item = row && row.item;
          const id = String(item && item.id || "");
          const local = Boolean(row && row.is_local === true);
          const type = String(item && item.type || "");
          if (item && !local && type === "episode" && /^[A-Za-z0-9]{22}$/.test(id)) return;
          let category = "EPISODE_ID_MISSING";
          if (local) category = "LOCAL_ITEM";
          else if (!item) category = "ITEM_NULL_UNAVAILABLE_OR_REMOVED";
          else if (type && type !== "episode") category = "NON_EPISODE_ITEM";
          else if (!type) category = "ITEM_TYPE_UNAVAILABLE";
          else if (/^spotify:episode:[A-Za-z0-9]{22}$/.test(String(item.uri || ""))) {
            category = "EPISODE_ID_MISSING_URI_PRESENT";
          }
          result.problems.push({ offset: offset + index, page: pages, category: category,
            itemType: type || null, name: item && item.name || null,
            episodeId: item && item.id || null, uri: item && item.uri || null,
            isLocal: local, addedAt: row && row.added_at || null,
            href: item && item.href || null,
            externalSpotifyUrl: item && item.external_urls && item.external_urls.spotify || null,
            linkedFromId: item && item.linked_from && item.linked_from.id || null,
            linkedFromUri: item && item.linked_from && item.linked_from.uri || null,
            isPlayable: item && typeof item.is_playable === "boolean" ? item.is_playable : null,
            restrictionReason: item && item.restrictions && item.restrictions.reason || null });
        });
        offset += page.items.length;
      }
      result.scannedItemCount = offset;
      const after = fetchAutoLatestDateMetadataV1_(playlistId, token);
      result.snapshotIdAfter = after.snapshotId;
      if (after.snapshotId !== before.snapshotId || after.itemCount !== before.itemCount) {
        result.status = "SNAPSHOT_CHANGED";
      } else {
        result.status = result.problems.length ? "ID_PROBLEMS_FOUND" : "NO_ID_PROBLEMS_NOW";
        result.baselineSafety = result.problems.length ? "BLOCKED" : "ID_INVENTORY_COMPLETE_DATE_EVIDENCE_STILL_REQUIRED";
      }
    } catch (error) {
      const reason = String(error && error.message || error);
      result.status = /429|レート制限/.test(reason) ? "RATE_LIMITED" : "READ_FAILED";
      result.reason = reason;
      if (result.status === "RATE_LIMITED") stopped = true;
    }
    results.push(result);
  });
  const report = { count: playlistIds.length, results: results };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// Compact, manual read-only report for the log-truncated 64-item playlist.
function diagnoseAutoLatestDateNullOffsetsReadOnlyV1() {
  const id = "7aKDEfAdCjTxiqiv19Grar";
  const token = String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
  if (!token) return { playlistId: id, status: "NO_VALID_CACHED_TOKEN" };
  try {
    const before = fetchAutoLatestDateMetadataV1_(id, token);
    const scan = scanAutoLatestDateBaselineIdsV1_(id, token, before);
    const after = fetchAutoLatestDateMetadataV1_(id, token);
    const stable = before.snapshotId === after.snapshotId && before.itemCount === after.itemCount;
    const result = { playlistId: id, status: stable ? "OK" : "SNAPSHOT_CHANGED",
      itemCount: before.itemCount, nullCount: scan.nullItems.length,
      nullOffsets: scan.nullItems.map(function(item) { return item.offset; }), snapshotMatches: stable };
    Logger.log(JSON.stringify(result));
    return result;
  } catch (error) {
    const reason = String(error && error.message || error);
    return { playlistId: id, status: /429|レート制限/.test(reason) ? "RATE_LIMITED" : "READ_FAILED", reason: reason };
  }
}
