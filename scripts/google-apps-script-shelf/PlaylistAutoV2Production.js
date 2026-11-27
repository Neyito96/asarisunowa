// V2 scoped stateを使う本番同期エンジン。
// 初回はShowを最後まで走査し、以後は前回境界までだけ取得する。
// playlistへの書き込みに成功した場合だけ境界を確定する。

// 安全スイッチ。既存syncAllAutoPlaylists()にはまだ接続しない。
const AUTO_PLAYLIST_V2_PRODUCTION_ENABLED_ = false;
const AUTO_PLAYLIST_V2_MAX_PAGES_PER_RULE_RUN_ = 5;

function syncOneAutoPlaylistV2_(rule, token) {
  if (AUTO_PLAYLIST_V2_PRODUCTION_ENABLED_ !== true) {
    throw new Error("V2本番同期はまだ無効です");
  }
  if (!rule || rule.enabled !== true) {
    throw new Error("V2対象ルールが無効です");
  }

  const validation = validateAutoPlaylistRule_(rule);
  if (!validation.valid) {
    throw new Error("ルール検証に失敗しました: " + validation.errors.join(" / "));
  }

  const showIds = getAutoPlaylistShowIds_(rule);
  if (!showIds.length) throw new Error("V2同期対象Showがありません: " + rule.key);

  prepareAutoPlaylistV2ProductionRun_(rule, showIds);
  let pagesThisRun = 0;
  let next = findAutoPlaylistV2NextShow_(rule);

  while (next && pagesThisRun < AUTO_PLAYLIST_V2_MAX_PAGES_PER_RULE_RUN_) {
    const state = fetchOneAutoPlaylistV2ProductionPage_(rule, next.showId, next.state, token);
    pagesThisRun += 1;
    if (Number(state.retryNotBeforeMs || 0) > Date.now()) break;
    next = findAutoPlaylistV2NextShow_(rule);
  }

  const states = showIds.map(function(showId) {
    return loadAutoPlaylistScopedState_(rule.key, showId);
  });
  if (states.some(function(state) { return !state || state.complete !== true; })) {
    Logger.log("V2 progress保存済み。次回syncで続きから再開します: " + rule.name + " | pages=" + pagesThisRun);
    return { complete: false, addedCount: 0, pagesFetched: pagesThisRun };
  }

  return commitAutoPlaylistV2ProductionRun_(rule, states, token);
}

function prepareAutoPlaylistV2ProductionRun_(rule, showIds) {
  showIds.forEach(function(showId) {
    const previous = loadAutoPlaylistScopedState_(rule.key, showId);
    if (!previous) {
      saveAutoPlaylistScopedState_(createAutoPlaylistScopedShowState_(rule, showId, "bootstrap", ""));
      return;
    }
    if (previous.complete === true && previous.committed === true) {
      const boundary = String(previous.committedBoundaryId || previous.pendingBoundaryId || "").trim();
      saveAutoPlaylistScopedState_(createAutoPlaylistScopedShowState_(rule, showId, "incremental", boundary));
    }
  });
}

function fetchOneAutoPlaylistV2ProductionPage_(rule, showId, existingState, token) {
  let state = existingState || loadAutoPlaylistScopedState_(rule.key, showId);
  if (!state) state = createAutoPlaylistScopedShowState_(rule, showId, "bootstrap", "");

  if (Number(state.retryNotBeforeMs || 0) > Date.now()) {
    Logger.log("Spotify cooldown中。V2本番同期を安全停止: " + rule.name);
    return state;
  }

  const url = String(state.nextUrl || "") || buildAutoPlaylistV2InitialUrl_(showId);
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const status = response.getResponseCode();

  if (status === 429) {
    const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
    const retryAfter = headers["Retry-After"] || headers["retry-after"] || "";
    const waitSeconds = Math.max(0, Number(retryAfter) || 0) || AUTO_PLAYLIST_V2_COOLDOWN_FALLBACK_SECONDS_;
    state.retryNotBeforeMs = Date.now() + (waitSeconds + AUTO_PLAYLIST_V2_COOLDOWN_BUFFER_SECONDS_) * 1000;
    saveAutoPlaylistScopedState_(state);
    Logger.log("Spotify 429。V2 stateへcooldownを保存して停止: " + rule.name);
    return state;
  }
  if (status !== 200) {
    saveAutoPlaylistScopedState_(state);
    throw new Error("Show取得に失敗しました: " + showId + " | status=" + status);
  }

  const data = JSON.parse(response.getContentText());
  state.retryNotBeforeMs = 0;
  state = applyAutoPlaylistPageToScopedState_(state, Array.isArray(data.items) ? data.items : [], rule, data.next || "");
  state.committed = false;
  saveAutoPlaylistScopedState_(state);
  Logger.log("V2 page | " + rule.name + " | show=" + showId + " | pages=" + state.pagesFetched + " | candidates=" + state.candidateCount + " | complete=" + state.complete);
  return state;
}

function fetchAutoPlaylistV2EpisodeDetails_(episodeIds, token) {
  return (Array.isArray(episodeIds) ? episodeIds : []).map(function(id) {
    const episodeId = String(id || "").trim();
    if (!episodeId) return null;

    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" + encodeURIComponent(episodeId) + "?market=JP",
      {
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      }
    );
    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error("V2候補エピソード詳細取得に失敗しました: " + episodeId + " | status=" + status);
    }

    const episode = JSON.parse(response.getContentText());
    return {
      id: String(episode.id || episodeId),
      uri: String(episode.uri || ("spotify:episode:" + episodeId)),
      name: String(episode.name || episodeId),
      release_date: String(episode.release_date || "").trim()
    };
  }).filter(Boolean);
}

function commitAutoPlaylistV2ProductionRun_(rule, states, token) {
  const candidateIds = mergeAutoPlaylistCandidateIds_([], states.reduce(function(all, state) {
    return all.concat(state.candidateIds || []);
  }, []), AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_);

  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const existingUris = new Set(playlistItems.map(function(item) {
    return item && item.item && item.item.uri ? String(item.item.uri) : "";
  }).filter(Boolean));

  const missingCandidateIds = candidateIds.filter(function(id) {
    return !existingUris.has("spotify:episode:" + id);
  });
  const episodes = fetchAutoPlaylistV2EpisodeDetails_(missingCandidateIds, token);

  let addedCount = 0;
  let addedEpisodes = [];

  if (episodes.length && rule.requireSheetLinkBeforeWrite === true) {
    assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  }

  if (episodes.length) {
    if (rule.addIndividually === true) {
      const result = addAutoPlaylistEpisodesIndividually_(rule, token, episodes);
      if (result.failedCount > 0) {
        throw new Error("V2追加に一部失敗したため境界を確定しません: " + rule.name);
      }
      addedCount = result.addedCount;
      addedEpisodes = Array.isArray(result.addedEpisodes) ? result.addedEpisodes : [];
    } else {
      addAutoPlaylistEpisodesBatch_(rule, token, episodes);
      addedCount = episodes.length;
      addedEpisodes = episodes.slice();
    }
  }

  states.forEach(function(state) {
    const boundary = finalizeAutoPlaylistScopedBoundary_(state);
    state.committedBoundaryId = boundary;
    state.committed = true;
    state.candidateIds = [];
    state.candidateCount = 0;
    saveAutoPlaylistScopedState_(state);
  });

  if (addedCount > 0 && rule.updateLatestDateOnAdd === true) {
    updatePlaylistLatestDate_(
      rule.playlistId,
      getLatestReleaseDate_(addedEpisodes)
    );
  }
  Logger.log("V2 commit完了 | " + rule.name + " | added=" + addedCount);
  return { complete: true, addedCount: addedCount };
}

// ノーミライ V2 初回本番同期
function syncNoMiraiAutoPlaylistV2() {
  const rule = getAutoPlaylistRuleByKey_("no-mirai");
  if (!rule) throw new Error("ノーミライのルールが見つかりません");
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  return syncOneAutoPlaylistV2_(rule, token);
}
