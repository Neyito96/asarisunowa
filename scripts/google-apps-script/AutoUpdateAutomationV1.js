// 「今あるリストを育てる」申請の安全な自動運用 v1。
// 招待承認を検知した時点を境界として保存し、それ以後の新着差分だけを追加する。

const AUTO_UPDATE_V1_RULE_IDS_KEY_ = "AUTO_UPDATE_V1_RULE_IDS";
const AUTO_UPDATE_V1_RULE_PREFIX_ = "AUTO_UPDATE_V1_RULE_";
const AUTO_UPDATE_V1_BOUNDARY_PREFIX_ = "AUTO_UPDATE_V1_BOUNDARY_";
const AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_ = 10;

// 時間主導トリガーはこの関数1本だけを登録する。
function runAutoUpdateAutomationV1() {
  const activation = processPendingAutoUpdateRequestsV1();
  const sync = syncApprovedAutoUpdateRequestsV1();
  return { activation: activation, sync: sync };
}

function processPendingAutoUpdateRequestsV1() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別の自動更新処理が実行中です");

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
    if (!sheet) throw new Error("自動更新申請シートが見つかりません");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { checked: 0, activated: 0, waiting: 0, review: 0 };

    const rows = sheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues();
    const result = { checked: 0, activated: 0, waiting: 0, review: 0 };
    const latestPendingRowByPlaylistId = {};
    rows.forEach(function(row, index) {
      const status = String(row[7] || "").trim();
      if (["申請受付", "受付", "招待承認待ち"].indexOf(status) < 0) return;
      const playlistId = extractAutoUpdateSpotifyPlaylistId_(String(row[1] || ""));
      if (playlistId) latestPendingRowByPlaylistId[playlistId] = index + 2;
    });

    rows.forEach(function(row, index) {
      const rowNumber = index + 2;
      const status = String(row[7] || "").trim();
      if (["申請受付", "受付", "招待承認待ち"].indexOf(status) < 0) return;
      result.checked += 1;

      const request = autoUpdateRequestFromSheetRowV1_(row);
      const requestPlaylistId = extractAutoUpdateSpotifyPlaylistId_(request.url);
      if (requestPlaylistId && latestPendingRowByPlaylistId[requestPlaylistId] !== rowNumber) {
        sheet.getRange(rowNumber, 5).clearContent();
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "重複申請", "同じプレイリストの新しい申請を採用しました");
        return;
      }
      const validationError = validateAutoUpdateRequest_(request);
      if (validationError) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "確認待ち", validationError);
        result.review += 1;
        return;
      }

      const plan = buildAutoPlaylistRequestPlan_(request);
      if (!isAutoUpdateV1TypeEligible_(plan.ruleType)) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "確認待ち", "テーマ型・未対応方式は人の確認が必要です");
        result.review += 1;
        return;
      }

      const playlistId = requestPlaylistId;
      const access = inspectAutoUpdatePlaylistAccessV1_(playlistId, token);
      if (!access.editable) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "招待承認待ち", "運用アカウントで共同編集招待を承認してください");
        result.waiting += 1;
        return;
      }

      const rule = buildAutoUpdateRuntimeRuleV1_(request, playlistId, rowNumber);
      const ruleValidation = validateAutoPlaylistRule_(rule);
      if (!ruleValidation.valid) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "確認待ち", ruleValidation.errors.join(" / "));
        result.review += 1;
        return;
      }

      assertAutoPlaylistRuleActivationSafe_(rule);

      assertAutoPlaylistSheetLinkBeforeWrite_(rule);
      captureAutoUpdateBoundariesV1_(rule, token);
      saveAutoUpdateRuntimeRuleV1_(rule);

      // 招待リンクは権限確認後にシートから消し、不要な露出を残さない。
      sheet.getRange(rowNumber, 5).clearContent();
      setAutoUpdateRequestStatusV1_(sheet, rowNumber, "増分自動更新", "招待承認を確認。新着差分のみ自動追加します");
      result.activated += 1;
    });

    SpreadsheetApp.flush();
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function syncApprovedAutoUpdateRequestsV1() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別の自動更新処理が実行中です");

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
    const rules = loadAutoUpdateRuntimeRulesV1_();
    const results = [];
    rules.forEach(function(rule) {
      results.push(syncOneApprovedAutoUpdateRequestV1_(rule, token));
    });
    Logger.log(JSON.stringify(results));
    return results;
  } finally {
    lock.releaseLock();
  }
}

function syncOneApprovedAutoUpdateRequestV1_(rule, token) {
  const validation = validateAutoPlaylistRule_(rule);
  if (!validation.valid) return pauseAutoUpdateRuleV1_(rule, "ルール検証失敗: " + validation.errors.join(" / "));

  const showIds = getAutoPlaylistShowIds_(rule);
  let candidateIds = [];
  const nextBoundaries = {};

  for (let i = 0; i < showIds.length; i += 1) {
    const showId = showIds[i];
    const boundary = loadAutoUpdateBoundaryV1_(rule.playlistId, showId);
    const page = fetchAutoUpdateShowFirstPageV1_(showId, token);
    const episodes = page.items;
    const headId = String(episodes[0] && episodes[0].id ? episodes[0].id : "").trim();
    if (headId) nextBoundaries[showId] = headId;

    if (!boundary) return pauseAutoUpdateRuleV1_(rule, "前回境界がありません: " + showId);
    const boundaryIndex = episodes.findIndex(function(ep) {
      return String(ep && ep.id ? ep.id : "") === boundary;
    });
    if (boundaryIndex < 0) return pauseAutoUpdateRuleV1_(rule, "新着50件内に前回境界が見つかりません: " + showId);

    episodes.slice(0, boundaryIndex).forEach(function(ep) {
      if (matchesAutoPlaylistRule_(ep, rule) && ep && ep.id) candidateIds.push(String(ep.id));
    });
  }

  candidateIds = Array.from(new Set(candidateIds));
  if (candidateIds.length > AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_) {
    return pauseAutoUpdateRuleV1_(rule, "追加候補が上限を超えました: " + candidateIds.length);
  }

  const existingUris = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const missingIds = candidateIds.filter(function(id) {
    return !existingUris.has("spotify:episode:" + id);
  });
  const episodesToAdd = fetchPlayableAutoUpdateEpisodesV1_(missingIds, token);

  if (episodesToAdd.length) assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const addResult = episodesToAdd.length
    ? addAutoPlaylistEpisodesIndividually_(rule, token, episodesToAdd)
    : { addedCount: 0, failedCount: 0, addedEpisodes: [] };
  if (addResult.failedCount > 0) return pauseAutoUpdateRuleV1_(rule, "Spotify追加に一部失敗しました");

  Object.keys(nextBoundaries).forEach(function(showId) {
    saveAutoUpdateBoundaryV1_(rule.playlistId, showId, nextBoundaries[showId]);
  });
  if (addResult.addedCount > 0) {
    updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(addResult.addedEpisodes));
  }
  setAutoUpdateRuleSheetStatusV1_(rule, "増分自動更新", "前回追加 " + addResult.addedCount + "件");
  return { playlistId: rule.playlistId, ok: true, addedCount: addResult.addedCount };
}

function autoUpdateRequestFromSheetRowV1_(row) {
  const typeMatch = String(row[8] || "").match(/方式:\s*([^/\s]+)/);
  return {
    url: String(row[1] || "").trim(),
    title: String(row[2] || "").trim(),
    maker: String(row[3] || "").trim(),
    inviteUrl: String(row[4] || "").trim(),
    keywords: String(row[5] || "").trim(),
    ruleNote: String(row[6] || "").trim(),
    updateType: typeMatch ? String(typeMatch[1] || "") : "",
    securityAnswer: "大介",
    requestId: "request_sheet_row_" + String(Date.now())
  };
}

function isAutoUpdateV1TypeEligible_(ruleType) {
  return ruleType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ || ruleType === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
}

function buildAutoUpdateRuntimeRuleV1_(request, playlistId, rowNumber) {
  const candidate = buildAutoPlaylistRuleCandidateFromRequest_(request);
  candidate.key = "request-" + playlistId;
  candidate.enabled = true;
  candidate.lifecycleStatus = AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL;
  candidate.productionWriteAllowed = true;
  candidate.playlistId = playlistId;
  candidate.requireSheetLinkBeforeWrite = true;
  candidate.requestSheetRow = rowNumber;
  candidate.updateType = String(request.updateType || "");
  return candidate;
}

function inspectAutoUpdatePlaylistAccessV1_(playlistId, token) {
  const meResponse = UrlFetchApp.fetch("https://api.spotify.com/v1/me", {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  if (meResponse.getResponseCode() !== 200) return { editable: false, reason: "profile" };
  const me = JSON.parse(meResponse.getContentText());
  const playlistResponse = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) + "?fields=id,collaborative,owner(id)",
    { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } }
  );
  if (playlistResponse.getResponseCode() !== 200) return { editable: false, reason: "playlist" };
  const playlist = JSON.parse(playlistResponse.getContentText());
  const owned = String(playlist.owner && playlist.owner.id ? playlist.owner.id : "") === String(me.id || "");
  const presentInLibrary = owned || isAutoUpdatePlaylistInCurrentUserLibraryV1_(playlistId, token);
  const collaborative = playlist.collaborative === true;
  return {
    editable: owned || (collaborative && presentInLibrary),
    owned: owned,
    collaborative: collaborative,
    presentInLibrary: presentInLibrary
  };
}

function isAutoUpdatePlaylistInCurrentUserLibraryV1_(playlistId, token) {
  let url = "https://api.spotify.com/v1/me/playlists?limit=50";
  let pages = 0;
  while (url && pages < 10) {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    });
    if (response.getResponseCode() !== 200) return false;
    const data = JSON.parse(response.getContentText());
    const found = (Array.isArray(data.items) ? data.items : []).some(function(item) {
      return String(item && item.id ? item.id : "") === playlistId;
    });
    if (found) return true;
    url = String(data.next || "");
    pages += 1;
  }
  return false;
}

function fetchAutoUpdateShowFirstPageV1_(showId, token) {
  const response = UrlFetchApp.fetch(buildAutoPlaylistV2InitialUrl_(showId), {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const status = response.getResponseCode();
  if (status !== 200) throw new Error("Show取得に失敗しました: " + showId + " status=" + status);
  const data = JSON.parse(response.getContentText());
  return { items: Array.isArray(data.items) ? data.items : [] };
}

function fetchPlayableAutoUpdateEpisodesV1_(episodeIds, token) {
  const episodes = [];
  (episodeIds || []).forEach(function(id) {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" + encodeURIComponent(id) + "?market=JP",
      { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } }
    );
    if (response.getResponseCode() !== 200) return;
    const episode = JSON.parse(response.getContentText());
    if (episode.is_playable === false) return;
    episodes.push({
      id: String(episode.id || id),
      uri: String(episode.uri || ("spotify:episode:" + id)),
      name: String(episode.name || id),
      release_date: String(episode.release_date || "")
    });
  });
  return episodes;
}

function captureAutoUpdateBoundariesV1_(rule, token) {
  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const page = fetchAutoUpdateShowFirstPageV1_(showId, token);
    const headId = String(page.items[0] && page.items[0].id ? page.items[0].id : "").trim();
    if (!headId) throw new Error("開始境界を取得できません: " + showId);
    saveAutoUpdateBoundaryV1_(rule.playlistId, showId, headId);
  });
}

function saveAutoUpdateRuntimeRuleV1_(rule) {
  const props = PropertiesService.getScriptProperties();
  const ids = JSON.parse(props.getProperty(AUTO_UPDATE_V1_RULE_IDS_KEY_) || "[]");
  if (ids.indexOf(rule.playlistId) < 0) ids.push(rule.playlistId);
  props.setProperty(AUTO_UPDATE_V1_RULE_IDS_KEY_, JSON.stringify(ids));
  props.setProperty(AUTO_UPDATE_V1_RULE_PREFIX_ + rule.playlistId, JSON.stringify(rule));
}

function loadAutoUpdateRuntimeRulesV1_() {
  const props = PropertiesService.getScriptProperties();
  const ids = JSON.parse(props.getProperty(AUTO_UPDATE_V1_RULE_IDS_KEY_) || "[]");
  return ids.map(function(id) {
    const raw = props.getProperty(AUTO_UPDATE_V1_RULE_PREFIX_ + id);
    return raw ? JSON.parse(raw) : null;
  }).filter(Boolean);
}

function autoUpdateBoundaryKeyV1_(playlistId, showId) {
  return AUTO_UPDATE_V1_BOUNDARY_PREFIX_ + playlistId + "_" + showId;
}

function saveAutoUpdateBoundaryV1_(playlistId, showId, episodeId) {
  PropertiesService.getScriptProperties().setProperty(autoUpdateBoundaryKeyV1_(playlistId, showId), episodeId);
}

function loadAutoUpdateBoundaryV1_(playlistId, showId) {
  return String(PropertiesService.getScriptProperties().getProperty(autoUpdateBoundaryKeyV1_(playlistId, showId)) || "");
}

function setAutoUpdateRequestStatusV1_(sheet, rowNumber, status, note) {
  sheet.getRange(rowNumber, 8, 1, 2).setValues([[status, note]]);
}

function setAutoUpdateRuleSheetStatusV1_(rule, status, note) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!sheet) throw new Error("自動更新申請シートが見つかりません");
  const row = Number(rule.requestSheetRow || 0);
  if (row >= 2) setAutoUpdateRequestStatusV1_(sheet, row, status, note);
}

function pauseAutoUpdateRuleV1_(rule, reason) {
  setAutoUpdateRuleSheetStatusV1_(rule, "確認待ち", reason);
  return { playlistId: rule.playlistId, ok: false, reviewRequired: true, reason: reason };
}
