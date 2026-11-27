// プレイリスト自動更新向けの汎用増分取得 dry-run v1
// Spotifyプレイリスト・スプレッドシートへの書き込みは行わない。
// UserPropertiesには AUTO_INCREMENTAL_V1_ 接頭辞の軽量な進捗状態だけを保存する。

const AUTO_INCREMENTAL_V1_PREFIX_ = "AUTO_INCREMENTAL_V1_";
const AUTO_INCREMENTAL_V1_PAGES_PER_RUN_ = 1;
const AUTO_INCREMENTAL_V1_COOLDOWN_FALLBACK_SECONDS_ = 3600;
const AUTO_INCREMENTAL_V1_COOLDOWN_BUFFER_SECONDS_ = 60;

function dryRunAutoPlaylistIncrementalStep() {
  const props = PropertiesService.getUserProperties();
  let state = loadAutoPlaylistIncrementalV1State_(props);
  const showIds = ASAHI_PRIMARY_SHOW_IDS.slice();

  if (!state) {
    state = {
      version: 1,
      mode: "bootstrap",
      showIds: showIds,
      showIndex: 0,
      nextUrl: "",
      pagesFetched: 0,
      episodeCount: 0,
      pendingBoundaries: {},
      boundaries: {},
      retryNotBeforeMs: 0,
      complete: false
    };
    saveAutoPlaylistIncrementalV1State_(props, state);
  }

  if (state.complete) {
    Logger.log("増分dry-runは完了済みです。dryRunAutoPlaylistIncrementalReport を実行してください。");
    return state;
  }

  const now = Date.now();
  const retryNotBeforeMs = Number(state.retryNotBeforeMs || 0);
  if (retryNotBeforeMs > now) {
    const remainingSeconds = Math.ceil((retryNotBeforeMs - now) / 1000);
    Logger.log(
      "Spotify cooldown中のためAPIアクセスせず停止しました | 残り約" +
      remainingSeconds + "秒 | 再開目安=" + new Date(retryNotBeforeMs).toISOString()
    );
    return state;
  }

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  let pagesThisRun = 0;

  while (pagesThisRun < AUTO_INCREMENTAL_V1_PAGES_PER_RUN_ && !state.complete) {
    if (state.showIndex >= state.showIds.length) {
      finishAutoPlaylistIncrementalV1Run_(state);
      break;
    }

    const showId = state.showIds[state.showIndex];
    const previousBoundary = String((state.boundaries || {})[showId] || "");
    const url = state.nextUrl || (
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(showId) +
      "/episodes?market=JP&limit=50"
    );

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    });
    const status = response.getResponseCode();

    if (status === 429) {
      const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
      const retryAfter = headers["Retry-After"] || headers["retry-after"] || "";
      const retryAfterSeconds = Math.max(0, Number(retryAfter) || 0);
      const waitSeconds = retryAfterSeconds || AUTO_INCREMENTAL_V1_COOLDOWN_FALLBACK_SECONDS_;
      state.retryNotBeforeMs = Date.now() +
        (waitSeconds + AUTO_INCREMENTAL_V1_COOLDOWN_BUFFER_SECONDS_) * 1000;
      saveAutoPlaylistIncrementalV1State_(props, state);
      Logger.log(
        "Spotify 429: Show " + showId +
        " | 状態とcooldownを保存して停止しました" +
        (retryAfter ? " | Retry-After=" + retryAfter + "秒" : " | Retry-Afterなし")
      );
      Logger.log("cooldown終了までは同じdry-run Stepを実行してもSpotify APIへアクセスしません。");
      return state;
    }

    if (status !== 200) {
      saveAutoPlaylistIncrementalV1State_(props, state);
      throw new Error(
        "Show取得に失敗しました: " + showId +
        " | status=" + status +
        " | " + response.getContentText()
      );
    }

    state.retryNotBeforeMs = 0;

    const data = JSON.parse(response.getContentText());
    const episodes = Array.isArray(data.items) ? data.items : [];

    if (!state.nextUrl && episodes.length) {
      const headBoundaryId = String(episodes[0] && episodes[0].id ? episodes[0].id : "").trim();
      if (headBoundaryId) state.pendingBoundaries[showId] = headBoundaryId;
    }

    let reachedBoundary = false;
    let pageEpisodeCount = 0;
    episodes.forEach(function(ep) {
      if (reachedBoundary) return;
      const id = String(ep && ep.id ? ep.id : "").trim();
      if (!id) return;

      if (previousBoundary && id === previousBoundary) {
        reachedBoundary = true;
        return;
      }

      pageEpisodeCount += 1;
    });

    state.episodeCount = Number(state.episodeCount || 0) + pageEpisodeCount;
    state.pagesFetched += 1;
    pagesThisRun += 1;

    if (previousBoundary && !reachedBoundary && !data.next) {
      saveAutoPlaylistIncrementalV1State_(props, state);
      throw new Error(
        "前回境界を最後まで発見できなかったため安全停止しました: Show " + showId +
        " | boundary=" + previousBoundary
      );
    }

    if (reachedBoundary || !data.next) {
      state.showIndex += 1;
      state.nextUrl = "";
    } else {
      state.nextUrl = String(data.next);
    }

    if (state.showIndex >= state.showIds.length) {
      finishAutoPlaylistIncrementalV1Run_(state);
    }

    saveAutoPlaylistIncrementalV1State_(props, state);
    Logger.log(
      "Incremental V1 progress | mode=" + state.mode +
      " | show=" + Math.min(state.showIndex + 1, state.showIds.length) +
      "/" + state.showIds.length +
      " | pages=" + state.pagesFetched +
      " | episodes=" + state.episodeCount +
      (state.complete ? " | complete" : "")
    );
  }

  if (!state.complete) {
    Logger.log("安全のためここで停止。続きは同じdry-run Stepを再実行してください。");
  }
  return state;
}

function finishAutoPlaylistIncrementalV1Run_(state) {
  state.boundaries = Object.assign({}, state.boundaries || {}, state.pendingBoundaries || {});
  state.pendingBoundaries = {};
  state.retryNotBeforeMs = 0;
  state.complete = true;
}

function dryRunAutoPlaylistIncrementalReport() {
  const props = PropertiesService.getUserProperties();
  const state = loadAutoPlaylistIncrementalV1State_(props);
  if (!state) {
    throw new Error("増分dry-run状態がありません。先に dryRunAutoPlaylistIncrementalStep を実行してください。");
  }

  const retryNotBeforeMs = Number(state.retryNotBeforeMs || 0);
  const cooldownRemainingSeconds = retryNotBeforeMs > Date.now()
    ? Math.ceil((retryNotBeforeMs - Date.now()) / 1000)
    : 0;

  Logger.log("=== AUTO PLAYLIST INCREMENTAL DRY RUN V1 ===");
  Logger.log("mode: " + state.mode);
  Logger.log("complete: " + state.complete);
  Logger.log("pagesFetched: " + state.pagesFetched);
  Logger.log("取得エピソード数: " + Number(state.episodeCount || 0));
  Logger.log("cooldown残り秒: " + cooldownRemainingSeconds);
  Logger.log("境界Show数: " + Object.keys(state.boundaries || {}).length + "/" + (state.showIds || []).length);
  Object.keys(state.boundaries || {}).forEach(function(showId) {
    Logger.log("boundary | " + showId + " | " + state.boundaries[showId]);
  });

  return {
    dryRun: true,
    version: 1,
    mode: state.mode,
    complete: state.complete,
    pagesFetched: state.pagesFetched,
    episodeCount: Number(state.episodeCount || 0),
    cooldownRemainingSeconds: cooldownRemainingSeconds,
    boundaries: state.boundaries || {}
  };
}

function startNextAutoPlaylistIncrementalDryRun() {
  const props = PropertiesService.getUserProperties();
  const previous = loadAutoPlaylistIncrementalV1State_(props);
  if (!previous || !previous.complete) {
    throw new Error("初回または前回のdry-runが完了していません。");
  }

  const next = {
    version: 1,
    mode: "incremental",
    showIds: (previous.showIds || ASAHI_PRIMARY_SHOW_IDS).slice(),
    showIndex: 0,
    nextUrl: "",
    pagesFetched: 0,
    episodeCount: 0,
    pendingBoundaries: {},
    boundaries: Object.assign({}, previous.boundaries || {}),
    retryNotBeforeMs: 0,
    complete: false
  };
  saveAutoPlaylistIncrementalV1State_(props, next);
  Logger.log("次回増分dry-runを開始しました。dryRunAutoPlaylistIncrementalStep を実行してください。");
  return next;
}

function resetAutoPlaylistIncrementalDryRun() {
  const props = PropertiesService.getUserProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(AUTO_INCREMENTAL_V1_PREFIX_) === 0) {
      props.deleteProperty(key);
    }
  });
  Logger.log("AUTO_INCREMENTAL_V1_ 一時状態をリセットしました。");
}

function loadAutoPlaylistIncrementalV1State_(props) {
  const raw = props.getProperty(AUTO_INCREMENTAL_V1_PREFIX_ + "STATE");
  return raw ? JSON.parse(raw) : null;
}

function saveAutoPlaylistIncrementalV1State_(props, state) {
  props.setProperty(AUTO_INCREMENTAL_V1_PREFIX_ + "STATE", JSON.stringify(state));
}
