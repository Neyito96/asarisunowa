// V2 scoped stateを使うプレイリスト自動更新 dry-run engine。
// 1回の実行でSpotifyは最大1ページだけ取得する。
// playlist・Spreadsheetへの書き込みは一切行わない。

const AUTO_PLAYLIST_V2_COOLDOWN_FALLBACK_SECONDS_ = 3600;
const AUTO_PLAYLIST_V2_COOLDOWN_BUFFER_SECONDS_ = 60;

function buildAutoPlaylistV2InitialUrl_(showId) {
  return "https://api.spotify.com/v1/shows/" + encodeURIComponent(String(showId || "")) +
    "/episodes?market=JP&limit=50";
}

function findAutoPlaylistV2NextShow_(rule) {
  const showIds = getAutoPlaylistShowIds_(rule);
  for (let i = 0; i < showIds.length; i += 1) {
    const state = loadAutoPlaylistScopedState_(rule.key, showIds[i]);
    if (!state || state.complete !== true) {
      return { showId: showIds[i], state: state };
    }
  }
  return null;
}

function dryRunAutoPlaylistV2Step(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);

  const validation = validateAutoPlaylistRule_(rule);
  if (!validation.valid) {
    throw new Error("ルール検証に失敗しました: " + validation.errors.join(" / "));
  }

  const next = findAutoPlaylistV2NextShow_(rule);
  if (!next) {
    Logger.log("V2 dry-runは全Show取得済みです。review前のためplaylistには書き込みません。");
    return reportAutoPlaylistV2Rule_(rule.key);
  }

  let state = next.state || createAutoPlaylistScopedShowState_(rule, next.showId, "bootstrap", "");
  const now = Date.now();
  if (Number(state.retryNotBeforeMs || 0) > now) {
    Logger.log("Spotify cooldown中。APIアクセスせず停止 | 残り約" +
      Math.ceil((state.retryNotBeforeMs - now) / 1000) + "秒");
    return state;
  }

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const url = String(state.nextUrl || "") || buildAutoPlaylistV2InitialUrl_(next.showId);
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const status = response.getResponseCode();

  if (status === 429) {
    const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
    const retryAfter = headers["Retry-After"] || headers["retry-after"] || "";
    const waitSeconds = Math.max(0, Number(retryAfter) || 0) || AUTO_PLAYLIST_V2_COOLDOWN_FALLBACK_SECONDS_;
    state.retryNotBeforeMs = Date.now() +
      (waitSeconds + AUTO_PLAYLIST_V2_COOLDOWN_BUFFER_SECONDS_) * 1000;
    saveAutoPlaylistScopedState_(state);
    Logger.log("Spotify 429。V2 scoped stateへcooldownを保存して停止しました。");
    return state;
  }

  if (status !== 200) {
    saveAutoPlaylistScopedState_(state);
    throw new Error("Show取得に失敗しました: " + next.showId + " | status=" + status);
  }

  const data = JSON.parse(response.getContentText());
  state.retryNotBeforeMs = 0;
  state = applyAutoPlaylistPageToScopedState_(state, Array.isArray(data.items) ? data.items : [], rule, data.next || "");
  saveAutoPlaylistScopedState_(state);

  Logger.log("V2 dry-run | rule=" + rule.key + " | show=" + next.showId +
    " | pages=" + state.pagesFetched + " | inspected=" + state.inspectedCount +
    " | candidates=" + state.candidateCount + " | complete=" + state.complete);
  Logger.log("playlist・Spreadsheetへの書き込みはしていません。");
  return state;
}

function reportAutoPlaylistV2Rule_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  const showIds = getAutoPlaylistShowIds_(rule);
  const states = showIds.map(function(showId) {
    return loadAutoPlaylistScopedState_(rule.key, showId);
  }).filter(Boolean);
  const candidateIds = mergeAutoPlaylistCandidateIds_([], states.reduce(function(all, state) {
    return all.concat(state.candidateIds || []);
  }, []), AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_);
  const report = {
    dryRun: true,
    ruleKey: rule.key,
    showCount: showIds.length,
    startedShowCount: states.length,
    completeShowCount: states.filter(function(state) { return state.complete === true; }).length,
    pagesFetched: states.reduce(function(sum, state) { return sum + Number(state.pagesFetched || 0); }, 0),
    inspectedCount: states.reduce(function(sum, state) { return sum + Number(state.inspectedCount || 0); }, 0),
    candidateIds: candidateIds,
    candidateCount: candidateIds.length,
    reviewRequired: true,
    productionWriteAllowed: false
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

// GASエディタから引数なしで使う読み取り専用レポート。
function reportOtaMasahikoAutoPlaylistV2DryRun() {
  return reportAutoPlaylistV2Rule_("ota-masahiko");
}

// Spotifyへアクセスするため、cooldown解除確認後にだけ実行する。
function dryRunOtaMasahikoAutoPlaylistV2Step() {
  return dryRunAutoPlaylistV2Step("ota-masahiko");
}

//
// ノーミライ：V2初回構築テスト。
// 1回につきSpotify最大1ページ。playlist / Spreadsheetには書き込まない。
//
function dryRunNoMiraiAutoPlaylistV2Step() {
  return dryRunAutoPlaylistV2Step("no-mirai");
}

function reportNoMiraiAutoPlaylistV2DryRun() {
  return reportAutoPlaylistV2Rule_("no-mirai");
}
