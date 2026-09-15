// ルール×Show単位の状態分離を外部通信なしで確認する純粋テスト。

function testAutoPlaylistScopedStatePure() {
  const ruleA = {
    key: "rule-a",
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    keyword: "めくろう"
  };
  const ruleB = {
    key: "rule-b",
    ruleType: AUTO_PLAYLIST_RULE_TYPE_THEME_,
    keywords: ["中東"],
    reviewRequired: true
  };

  const keyA1 = buildAutoPlaylistScopedStateKey_(ruleA.key, "show-1");
  const keyA2 = buildAutoPlaylistScopedStateKey_(ruleA.key, "show-2");
  const keyB1 = buildAutoPlaylistScopedStateKey_(ruleB.key, "show-1");
  if (keyA1 === keyA2 || keyA1 === keyB1 || keyA2 === keyB1) {
    throw new Error("rule×showのstate keyが分離されていません");
  }

  let state = createAutoPlaylistScopedShowState_(ruleA, "show-1", "bootstrap", "");
  state = applyAutoPlaylistPageToScopedState_(state, [
    { id: "new-2", name: "別タイトル", description: "めくろう" },
    { id: "new-1", name: "一緒に新聞をめくろう！", description: "" }
  ], ruleA, "next-page");
  if (state.complete) throw new Error("nextがあるbootstrapを早期完了しています");
  if (state.pendingBoundaryId !== "new-2") throw new Error("先頭境界を保持できません");
  if (state.candidateIds.join(",") !== "new-1") throw new Error("候補IDの保持が不正です");

  state = applyAutoPlaylistPageToScopedState_(state, [
    { id: "older", name: "一緒に新聞をめくろう！", description: "" }
  ], ruleA, "");
  if (!state.complete) throw new Error("最終ページでbootstrapが完了しません");
  if (finalizeAutoPlaylistScopedBoundary_(state) !== "new-2") {
    throw new Error("bootstrap境界確定が不正です");
  }

  let incremental = createAutoPlaylistScopedShowState_(ruleB, "show-1", "incremental", "old-boundary");
  incremental = applyAutoPlaylistPageToScopedState_(incremental, [
    { id: "t2", name: "国際ニュース", description: "中東情勢" },
    { id: "old-boundary", name: "過去回", description: "中東" },
    { id: "too-old", name: "中東", description: "" }
  ], ruleB, "next-ignored");
  if (!incremental.complete || !incremental.reachedBoundary) {
    throw new Error("incrementalが前回境界で完了しません");
  }
  if (incremental.candidateIds.join(",") !== "t2") {
    throw new Error("境界より古い候補を保持しています");
  }

  let missingBoundaryStopped = false;
  try {
    let missing = createAutoPlaylistScopedShowState_(ruleB, "show-2", "incremental", "missing");
    applyAutoPlaylistPageToScopedState_(missing, [
      { id: "x1", name: "中東", description: "" }
    ], ruleB, "");
  } catch (error) {
    missingBoundaryStopped = true;
  }
  if (!missingBoundaryStopped) throw new Error("境界消失時に安全停止しません");

  Logger.log("Auto playlist scoped state pure tests: PASS");
  return true;
}
