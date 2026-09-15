// V2 scoped stateのPropertiesService保存層。
// 既存AUTO_INCREMENTAL_V1_には触れず、V2専用prefixだけを読み書きする。

function getAutoPlaylistScopedStateStore_() {
  return PropertiesService.getUserProperties();
}

function loadAutoPlaylistScopedState_(ruleKey, showId) {
  const key = buildAutoPlaylistScopedStateKey_(ruleKey, showId);
  const raw = getAutoPlaylistScopedStateStore_().getProperty(key);
  if (!raw) return null;

  let state;
  try {
    state = JSON.parse(raw);
  } catch (error) {
    throw new Error("V2 scoped state JSONが壊れています: " + key);
  }

  if (Number(state.version) !== AUTO_PLAYLIST_SCOPED_STATE_VERSION_) {
    throw new Error("V2 scoped state versionが一致しません: " + key);
  }
  if (String(state.ruleKey || "") !== String(ruleKey || "").trim()) {
    throw new Error("V2 scoped state ruleKeyが一致しません: " + key);
  }
  if (String(state.showId || "") !== String(showId || "").trim()) {
    throw new Error("V2 scoped state showIdが一致しません: " + key);
  }
  return state;
}

function saveAutoPlaylistScopedState_(state) {
  const source = state || {};
  if (Number(source.version) !== AUTO_PLAYLIST_SCOPED_STATE_VERSION_) {
    throw new Error("保存対象のV2 scoped state versionが不正です");
  }
  const key = buildAutoPlaylistScopedStateKey_(source.ruleKey, source.showId);
  getAutoPlaylistScopedStateStore_().setProperty(key, JSON.stringify(source));
  return key;
}

function deleteAutoPlaylistScopedState_(ruleKey, showId) {
  const key = buildAutoPlaylistScopedStateKey_(ruleKey, showId);
  getAutoPlaylistScopedStateStore_().deleteProperty(key);
  return key;
}

function listAutoPlaylistScopedStatesForRule_(ruleKey) {
  const safeRuleKey = normalizeAutoPlaylistStateKeyPart_(ruleKey);
  if (!safeRuleKey) throw new Error("state一覧にはruleKeyが必要です");
  const prefix = AUTO_PLAYLIST_SCOPED_STATE_PREFIX_ + safeRuleKey + "__";
  const all = getAutoPlaylistScopedStateStore_().getProperties();
  return Object.keys(all).filter(function(key) {
    return key.indexOf(prefix) === 0;
  }).sort().map(function(key) {
    try {
      return JSON.parse(all[key]);
    } catch (error) {
      return { key: key, invalid: true, error: "JSON parse error" };
    }
  });
}

// 読み取り専用レポート。Spotify・playlist・Spreadsheetにはアクセスしない。
function reportAutoPlaylistScopedStates(ruleKey) {
  const states = listAutoPlaylistScopedStatesForRule_(ruleKey);
  const report = states.map(function(state) {
    return {
      ruleKey: state.ruleKey || "",
      showId: state.showId || "",
      mode: state.mode || "",
      pagesFetched: Number(state.pagesFetched || 0),
      candidateCount: Number(state.candidateCount || 0),
      complete: state.complete === true,
      reachedBoundary: state.reachedBoundary === true,
      retryNotBeforeMs: Number(state.retryNotBeforeMs || 0),
      invalid: state.invalid === true
    };
  });
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
