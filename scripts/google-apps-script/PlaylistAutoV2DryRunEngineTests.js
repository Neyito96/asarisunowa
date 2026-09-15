// V2 dry-run engineの外部通信なし純粋テスト。

function testAutoPlaylistV2DryRunEnginePure() {
  const titleRule = {
    key: "__v2-engine-test__",
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    keyword: "めくろう"
  };
  let state = createAutoPlaylistScopedShowState_(titleRule, "show-1", "bootstrap", "");
  state = applyAutoPlaylistPageToScopedState_(state, [
    { id: "head", name: "別タイトル", description: "めくろう" },
    { id: "match", name: "一緒に新聞をめくろう！", description: "" }
  ], titleRule, "next-page");

  if (state.pagesFetched !== 1) throw new Error("1ページ進捗が不正です");
  if (state.candidateIds.join(",") !== "match") throw new Error("候補抽出が不正です");
  if (state.pendingBoundaryId !== "head") throw new Error("先頭境界の保持に失敗しました");
  if (state.complete) throw new Error("nextがあるのに完了扱いです");

  state = applyAutoPlaylistPageToScopedState_(state, [
    { id: "older", name: "対象外", description: "" }
  ], titleRule, "");
  if (!state.complete) throw new Error("最終ページで完了しません");
  if (finalizeAutoPlaylistScopedBoundary_(state) !== "head") {
    throw new Error("確定境界が不正です");
  }

  const incremental = createAutoPlaylistScopedShowState_(titleRule, "show-1", "incremental", "old-boundary");
  const stopped = applyAutoPlaylistPageToScopedState_(incremental, [
    { id: "new", name: "一緒に新聞をめくろう！" },
    { id: "old-boundary", name: "一緒に新聞をめくろう！" },
    { id: "too-old", name: "一緒に新聞をめくろう！" }
  ], titleRule, "next-page");
  if (!stopped.complete || !stopped.reachedBoundary) throw new Error("既知境界で停止できません");
  if (stopped.candidateIds.join(",") !== "new") throw new Error("境界より古い候補を拾っています");

  Logger.log("Auto playlist V2 dry-run engine pure tests: PASS");
  return true;
}
