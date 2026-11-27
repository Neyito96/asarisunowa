// 初回補完の読み取り専用テスト。Spotify・Spreadsheetにはアクセスしない。
function testAutoUpdateSeedBootstrapV1() {
  const rule = {
    key: "seed-test",
    enabled: true,
    lifecycleStatus: "incremental",
    ruleType: "speaker",
    name: "seed-test",
    playlistId: "seed-test",
    showIds: ["show-test"],
    keywords: ["佐藤陽"],
    fields: ["name", "description", "html_description"],
    productionWriteAllowed: true
  };
  const seed = findAutoUpdateSeedEpisodeV1_([
    { item: { id: "new", name: "佐藤陽 新しい回", release_date: "2026-01-02" } },
    { item: { id: "old", name: "佐藤陽 起点回", release_date: "2025-01-02" } }
  ], rule);
  if (!seed || seed.id !== "old") throw new Error("最古の起点回を選べません");
  const state = createAutoPlaylistScopedShowState_(rule, "show-test", "seed-bootstrap", "");
  state.bootstrapSeedDate = "2025-01-02";
  const next = applyAutoUpdateSeedBootstrapPageV1_(state, [
    { id: "new", name: "佐藤陽 新しい回", release_date: "2026-01-02" },
    { id: "seed", name: "佐藤陽 起点回", release_date: "2025-01-02" },
    { id: "too-old", name: "佐藤陽 対象外", release_date: "2025-01-01" }
  ], rule, "next-url");
  if (!next.complete || next.candidateIds.join(",") !== "new,seed") {
    throw new Error("起点日で初回補完を停止できません");
  }
  if (AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_ !== 10) throw new Error("追加上限が10件ではありません");
  Logger.log("Seed bootstrap v1 pure test: PASS");
  return true;
}
