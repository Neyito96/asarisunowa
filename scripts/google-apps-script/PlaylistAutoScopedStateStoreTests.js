// V2 Properties保存層のテスト。
// Spotify・playlist・Spreadsheetにはアクセスしない。
// テスト専用rule/show keyだけを作成し、finallyで必ず削除する。

function testAutoPlaylistScopedStateStoreRoundTrip() {
  const ruleKey = "__test-scoped-store__";
  const showId = "__test-show__";
  const key = buildAutoPlaylistScopedStateKey_(ruleKey, showId);

  try {
    deleteAutoPlaylistScopedState_(ruleKey, showId);

    const rule = { key: ruleKey };
    const state = createAutoPlaylistScopedShowState_(rule, showId, "bootstrap", "");
    state.pendingBoundaryId = "episode-head";
    state.candidateIds = ["candidate-1"];
    state.candidateCount = 1;

    const savedKey = saveAutoPlaylistScopedState_(state);
    if (savedKey !== key) throw new Error("保存keyが期待値と一致しません");

    const loaded = loadAutoPlaylistScopedState_(ruleKey, showId);
    if (!loaded) throw new Error("保存したstateを読み出せません");
    if (loaded.pendingBoundaryId !== "episode-head") throw new Error("boundaryのround tripに失敗しました");
    if (loaded.candidateIds.join(",") !== "candidate-1") throw new Error("candidateIdsのround tripに失敗しました");

    const listed = listAutoPlaylistScopedStatesForRule_(ruleKey);
    if (listed.length !== 1 || listed[0].showId !== showId) {
      throw new Error("rule単位のstate一覧が不正です");
    }

    Logger.log("Auto playlist scoped state store round trip: PASS");
    return true;
  } finally {
    deleteAutoPlaylistScopedState_(ruleKey, showId);
  }
}
