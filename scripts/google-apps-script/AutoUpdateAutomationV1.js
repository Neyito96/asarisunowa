// 「今あるリストを育てる」申請の安全な自動運用 v1。
// プレイリスト内の最古の対象回から初回補完し、完了後は新着差分だけを追加する。

const AUTO_UPDATE_V1_RULE_IDS_KEY_ = "AUTO_UPDATE_V1_RULE_IDS";
const AUTO_UPDATE_V1_RULE_PREFIX_ = "AUTO_UPDATE_V1_RULE_";
const AUTO_UPDATE_V1_BOUNDARY_PREFIX_ = "AUTO_UPDATE_V1_BOUNDARY_";
const AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_ = 10;
const AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_ = 20;
const AUTO_UPDATE_V1_BOOTSTRAP_MAX_PAGES_PER_RUN_ = 5;
const AUTO_UPDATE_V1_BOOTSTRAP_MAX_CANDIDATES_PER_SHOW_ = 250;
const AUTO_UPDATE_V1_IMMEDIATE_HANDLER_ = "runAutoUpdateAutomationSoonV1";
const AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_ = 60 * 1000;
const AUTO_UPDATE_V1_WAITING_RETRY_DELAY_MS_ = 15 * 60 * 1000;
const AUTO_UPDATE_V1_WAITING_RETRY_WINDOW_MS_ = 6 * 60 * 60 * 1000;
const AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_ = "AUTO_UPDATE_V1_WAITING_RETRY_STARTED";

// フォーム受付直後の1回だけを予約する。同じ予約があれば新規作成しない。
function scheduleImmediateAutoUpdateAutomationV1_() {
  PropertiesService.getScriptProperties().setProperty(
    AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_,
    String(Date.now())
  );
  return scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_);
}

function scheduleAutoUpdateAutomationV1_(delayMs) {
  const triggers = ScriptApp.getProjectTriggers();
  const alreadyScheduled = triggers.some(function(trigger) {
    return trigger.getHandlerFunction() === AUTO_UPDATE_V1_IMMEDIATE_HANDLER_;
  });
  if (alreadyScheduled) return { scheduled: true, reason: "already-scheduled" };

  ScriptApp.newTrigger(AUTO_UPDATE_V1_IMMEDIATE_HANDLER_)
    .timeBased()
    .after(Math.max(60 * 1000, Number(delayMs) || AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_))
    .create();
  return { scheduled: true, reason: "created" };
}

function scheduleWaitingAutoUpdateRetryV1_() {
  const props = PropertiesService.getScriptProperties();
  const started = Number(props.getProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_) || 0) || Date.now();
  if (Date.now() - started >= AUTO_UPDATE_V1_WAITING_RETRY_WINDOW_MS_) {
    props.deleteProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_);
    return { scheduled: false, reason: "retry-window-ended" };
  }
  props.setProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_, String(started));
  return scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_WAITING_RETRY_DELAY_MS_);
}

// 1回限りの時間主導トリガーから呼ばれる公開関数。
function runAutoUpdateAutomationSoonV1() {
  return runAutoUpdateAutomationV1();
}

// 初回だけGASエディタから実行し、時間主導トリガー権限を承認するための管理用関数。
function authorizeAutoUpdateAutomationV1() {
  return scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_);
}

// 時間主導トリガーはこの関数1本だけを登録する。
function runAutoUpdateAutomationV1() {
  const activation = processPendingAutoUpdateRequestsV1();
  const sync = syncApprovedAutoUpdateRequestsV1();
  if (sync.some(function(result) { return result && result.bootstrapPending === true; })) {
    scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_);
  } else if (activation.waiting > 0) {
    scheduleWaitingAutoUpdateRetryV1_();
  } else {
    PropertiesService.getScriptProperties().deleteProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_);
  }
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
      const seed = findAutoUpdateSeedEpisodeV1_(
        getAllSpotifyPlaylistItems_(rule.playlistId, token),
        rule,
        token
      );
      if (!seed) {
        setAutoUpdateRequestStatusV1_(
          sheet,
          rowNumber,
          "確認待ち",
          "条件に合う起点エピソードがプレイリスト内にありません"
        );
        result.review += 1;
        return;
      }
      prepareAutoUpdateSeedBootstrapV1_(rule, seed);
      saveAutoUpdateRuntimeRuleV1_(rule);

      // 招待リンクは権限確認後にシートから消し、不要な露出を残さない。
      sheet.getRange(rowNumber, 5).clearContent();
      setAutoUpdateRequestStatusV1_(
        sheet,
        rowNumber,
        "初回補完中",
        "起点 " + seed.releaseDate + " から不足回を古い順に補完します"
      );
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

  if (rule.bootstrapPending === true) {
    return syncAutoUpdateSeedBootstrapV1_(rule, token);
  }

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
    if (boundaryIndex < 0) {
      return pauseAutoUpdateRuleV1_(
        rule,
        "最新" + AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_ + "件内に前回境界が見つかりません: " + showId
      );
    }

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

function findAutoUpdateSeedEpisodeV1_(playlistItems, rule, token) {
  const episodes = (Array.isArray(playlistItems) ? playlistItems : []).map(function(row) {
    const episode = row && (row.item || row.track) ? (row.item || row.track) : null;
    if (!episode || !episode.id) return null;
    const releaseDate = String(episode.release_date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return episode;
    return fetchAutoUpdateEpisodeDetailV1_(episode.id, token);
  }).filter(Boolean);
  return selectAutoUpdateSeedEpisodeV1_(episodes, rule);
}

function fetchAutoUpdateEpisodeDetailV1_(episodeId, token) {
  const response = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/episodes/" + encodeURIComponent(String(episodeId || "")) + "?market=JP",
    {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    }
  );
  if (response.getResponseCode() !== 200) return null;
  return JSON.parse(response.getContentText());
}

function selectAutoUpdateSeedEpisodeV1_(episodes, rule) {
  const seeds = (Array.isArray(episodes) ? episodes : []).map(function(episode) {
    const releaseDate = String(episode && episode.release_date ? episode.release_date : "").trim();
    if (!episode || !episode.id || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return null;
    if (!matchesAutoPlaylistRule_(episode, rule)) return null;
    return {
      id: String(episode.id),
      releaseDate: releaseDate,
      name: String(episode.name || episode.id)
    };
  }).filter(Boolean);

  seeds.sort(function(a, b) {
    if (a.releaseDate !== b.releaseDate) return a.releaseDate < b.releaseDate ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  return seeds.length ? seeds[0] : null;
}

function prepareAutoUpdateSeedBootstrapV1_(rule, seed) {
  rule.bootstrapPending = true;
  rule.bootstrapSeedEpisodeId = String(seed.id || "");
  rule.bootstrapSeedDate = String(seed.releaseDate || "");

  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const state = createAutoPlaylistScopedShowState_(rule, showId, "seed-bootstrap", "");
    state.bootstrapSeedDate = rule.bootstrapSeedDate;
    saveAutoPlaylistScopedState_(state);
  });
}

function applyAutoUpdateSeedBootstrapPageV1_(state, episodes, rule, nextUrl) {
  const current = Object.assign({}, state || {});
  const seedDate = String(current.bootstrapSeedDate || rule.bootstrapSeedDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) throw new Error("初回補完の起点日が不正です");

  const source = Array.isArray(episodes) ? episodes : [];
  if (!current.nextUrl && !current.pendingBoundaryId && source.length) {
    current.pendingBoundaryId = String(source[0] && source[0].id ? source[0].id : "").trim();
  }

  let reachedSeedDate = false;
  const pageCandidateIds = [];
  source.forEach(function(episode) {
    if (reachedSeedDate) return;
    const releaseDate = String(episode && episode.release_date ? episode.release_date : "").trim();
    if (releaseDate && releaseDate < seedDate) {
      reachedSeedDate = true;
      return;
    }
    if (releaseDate && releaseDate >= seedDate && episode && episode.id && matchesAutoPlaylistRule_(episode, rule)) {
      pageCandidateIds.push(String(episode.id));
    }
  });

  current.pagesFetched = Number(current.pagesFetched || 0) + 1;
  current.inspectedCount = Number(current.inspectedCount || 0) + source.length;
  current.candidateIds = mergeAutoPlaylistCandidateIds_(
    current.candidateIds || [],
    pageCandidateIds,
    AUTO_UPDATE_V1_BOOTSTRAP_MAX_CANDIDATES_PER_SHOW_
  );
  current.candidateCount = current.candidateIds.length;
  current.reachedBoundary = reachedSeedDate;
  current.committed = false;

  const hasNext = Boolean(String(nextUrl || "").trim());
  current.complete = reachedSeedDate || !hasNext;
  current.nextUrl = current.complete ? "" : String(nextUrl);
  return current;
}

function fetchAutoUpdateSeedBootstrapPageV1_(rule, state, token) {
  const url = String(state.nextUrl || "") || buildAutoPlaylistV2InitialUrl_(state.showId);
  const response = fetchSpotifyReadWithRetry_(
    url,
    {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    },
    "Seed bootstrap " + state.showId
  );
  const status = response.getResponseCode();
  if (status !== 200) throw new Error("初回補完のShow取得に失敗しました: " + state.showId + " status=" + status);
  const data = JSON.parse(response.getContentText());
  const nextState = applyAutoUpdateSeedBootstrapPageV1_(
    state,
    Array.isArray(data.items) ? data.items : [],
    rule,
    data.next || ""
  );
  saveAutoPlaylistScopedState_(nextState);
  return nextState;
}

function syncAutoUpdateSeedBootstrapV1_(rule, token) {
  const showIds = getAutoPlaylistShowIds_(rule);
  let pagesFetched = 0;

  for (let i = 0; i < showIds.length && pagesFetched < AUTO_UPDATE_V1_BOOTSTRAP_MAX_PAGES_PER_RUN_; i += 1) {
    let state = loadAutoPlaylistScopedState_(rule.key, showIds[i]);
    if (!state) {
      return pauseAutoUpdateRuleV1_(rule, "初回補完の進捗がありません: " + showIds[i]);
    }
    while (!state.complete && pagesFetched < AUTO_UPDATE_V1_BOOTSTRAP_MAX_PAGES_PER_RUN_) {
      state = fetchAutoUpdateSeedBootstrapPageV1_(rule, state, token);
      pagesFetched += 1;
    }
  }

  const states = showIds.map(function(showId) {
    return loadAutoPlaylistScopedState_(rule.key, showId);
  });
  if (states.some(function(state) { return !state || state.complete !== true; })) {
    setAutoUpdateRuleSheetStatusV1_(rule, "初回補完中", "対象回を確認中（今回 " + pagesFetched + "ページ）");
    return { playlistId: rule.playlistId, ok: true, bootstrapPending: true, pagesFetched: pagesFetched, addedCount: 0 };
  }

  const existingUris = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const allCandidateIds = mergeAutoPlaylistCandidateIds_([], states.reduce(function(all, state) {
    return all.concat(state.candidateIds || []);
  }, []), AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_);
  const candidateIds = allCandidateIds.filter(function(id) {
    return !existingUris.has("spotify:episode:" + id);
  });
  const candidateEpisodes = fetchPlayableAutoUpdateEpisodesV1_(candidateIds, token).sort(function(a, b) {
    const left = String(a.release_date || "");
    const right = String(b.release_date || "");
    if (left !== right) return left < right ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  if (candidateEpisodes.length !== candidateIds.length) {
    return pauseAutoUpdateRuleV1_(rule, "取得できない候補回があるため初回補完を停止しました");
  }
  const episodesToAdd = candidateEpisodes.slice(0, AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_);

  if (episodesToAdd.length) assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const addResult = episodesToAdd.length
    ? addAutoPlaylistEpisodesIndividually_(rule, token, episodesToAdd)
    : { addedCount: 0, failedCount: 0, addedEpisodes: [] };
  if (addResult.failedCount > 0) return pauseAutoUpdateRuleV1_(rule, "初回補完のSpotify追加に一部失敗しました");

  const resolvedIds = new Set(allCandidateIds.filter(function(id) {
    return existingUris.has("spotify:episode:" + id);
  }).concat(addResult.addedEpisodes.map(function(episode) { return String(episode.id); })));
  states.forEach(function(state) {
    state.candidateIds = (state.candidateIds || []).filter(function(id) { return !resolvedIds.has(String(id)); });
    state.candidateCount = state.candidateIds.length;
    saveAutoPlaylistScopedState_(state);
  });

  const remainingCount = states.reduce(function(sum, state) {
    return sum + Number(state.candidateCount || 0);
  }, 0);
  if (remainingCount > 0) {
    setAutoUpdateRuleSheetStatusV1_(rule, "初回補完中", "前回追加 " + addResult.addedCount + "件・残り " + remainingCount + "件");
    return { playlistId: rule.playlistId, ok: true, bootstrapPending: true, addedCount: addResult.addedCount, remainingCount: remainingCount };
  }

  states.forEach(function(state) {
    const boundary = String(state.pendingBoundaryId || "").trim();
    if (!boundary) throw new Error("初回補完後の新着境界を確定できません: " + state.showId);
    saveAutoUpdateBoundaryV1_(rule.playlistId, state.showId, boundary);
    deleteAutoPlaylistScopedState_(rule.key, state.showId);
  });
  rule.bootstrapPending = false;
  saveAutoUpdateRuntimeRuleV1_(rule);
  if (addResult.addedCount > 0) {
    updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(addResult.addedEpisodes));
  }
  setAutoUpdateRuleSheetStatusV1_(rule, "増分自動更新", "初回補完完了。以後は新着回を巡回します");
  return { playlistId: rule.playlistId, ok: true, bootstrapPending: false, addedCount: addResult.addedCount, complete: true };
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
  const url = "https://api.spotify.com/v1/shows/" + encodeURIComponent(String(showId || "")) +
    "/episodes?market=JP&limit=" + AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_;
  const response = UrlFetchApp.fetch(url, {
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
  const noteCell = sheet.getRange(rowNumber, 9);
  const existingNote = String(noteCell.getDisplayValue() || "");
  sheet.getRange(rowNumber, 8, 1, 2).setValues([[
    status,
    mergeAutoUpdateStatusNoteV1_(existingNote, note)
  ]]);
}

function mergeAutoUpdateStatusNoteV1_(existingNote, note) {
  const typeMatch = String(existingNote || "").match(/方式:\s*([^/\s]+)/);
  const detail = String(note || "").trim();
  return typeMatch
    ? "方式: " + String(typeMatch[1] || "") + (detail ? " / " + detail : "")
    : detail;
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
