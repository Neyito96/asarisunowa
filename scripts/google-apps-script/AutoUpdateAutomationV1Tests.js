// 自動受付v1の純粋判定テスト。Spotify・Spreadsheet・Propertiesへアクセスしない。

function testAutoUpdateAutomationV1Pure() {
  if (AUTO_UPDATE_V1_IMMEDIATE_HANDLER_ !== "runAutoUpdateAutomationSoonV1") {
    throw new Error("直後実行用の公開ハンドラー名が不正です");
  }
  if (AUTO_UPDATE_V1_DAILY_HANDLER_ !== "runAutoUpdateAutomationV1") {
    throw new Error("日次巡回用の公開ハンドラー名が不正です");
  }
  if (typeof deleteAutoUpdateAutomationSoonTriggersV1_ !== "function") {
    throw new Error("実行済み継続トリガーの削除関数がありません");
  }
  if (typeof installAutoUpdateAutomationDailyTriggerV1 !== "function") {
    throw new Error("4時台の日次トリガー設定関数がありません");
  }
  if (typeof syncDailyManagedAutoPlaylistsV1_ !== "function") {
    throw new Error("固定ルールの日次巡回関数がありません");
  }
  if (AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_ < 60 * 1000) {
    throw new Error("直後実行の予約間隔が短すぎます");
  }
  if (AUTO_UPDATE_V1_WAITING_RETRY_DELAY_MS_ !== 15 * 60 * 1000) {
    throw new Error("招待承認待ちの再確認間隔が15分ではありません");
  }
  if (AUTO_UPDATE_V1_WAITING_RETRY_WINDOW_MS_ !== 6 * 60 * 60 * 1000) {
    throw new Error("招待承認待ちの再確認期間が6時間ではありません");
  }
  if (AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_ !== 20) {
    throw new Error("日次巡回の取得件数が想定外です");
  }
  if (AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_ !== 10) {
    throw new Error("日次増分の1回あたり追加上限が想定外です");
  }
  if (AUTO_UPDATE_V1_BOOTSTRAP_MAX_ADDITIONS_PER_RUN_ !== 100) {
    throw new Error("初回補完の1回あたり追加上限が100件ではありません");
  }
  if (typeof authorizeAutoUpdateAutomationV1 !== "function") {
    throw new Error("トリガー権限承認用の管理関数がありません");
  }

  if (!isAutoUpdateV1TypeEligible_(AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_)) {
    throw new Error("シリーズ型が自動化対象になっていません");
  }
  if (!isAutoUpdateV1TypeEligible_(AUTO_PLAYLIST_RULE_TYPE_SPEAKER_)) {
    throw new Error("出演者型が自動化対象になっていません");
  }
  if (isAutoUpdateV1TypeEligible_(AUTO_PLAYLIST_RULE_TYPE_THEME_)) {
    throw new Error("テーマ型が確認なしで自動化対象になっています");
  }

  const request = {
    updateType: "speaker",
    url: "https://open.spotify.com/playlist/73ppqrTcsjVgl1xwIZa4SY",
    title: "佐藤陽 記者が出演した番組",
    maker: "パクチー",
    inviteUrl: "https://open.spotify.com/playlist/73ppqrTcsjVgl1xwIZa4SY?pt=test-token",
    keywords: "佐藤陽",
    ruleNote: "",
    securityAnswer: "大介",
    requestId: "request_automation_v1_test"
  };
  const rule = buildAutoUpdateRuntimeRuleV1_(request, "73ppqrTcsjVgl1xwIZa4SY", 5);
  if (!rule.enabled || !rule.productionWriteAllowed) {
    throw new Error("安全確認後の実行ルールが有効状態になりません");
  }
  if (rule.lifecycleStatus !== AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL) {
    throw new Error("増分自動更新状態になりません");
  }

  const seed = selectAutoUpdateSeedEpisodeV1_([
    { id: "new", name: "佐藤陽 新しい回", release_date: "2026-01-02" },
    { id: "old", name: "佐藤陽 起点回", release_date: "2025-01-02" },
    { id: "other", name: "別の出演者", release_date: "2024-01-02" }
  ], rule);
  if (!seed || seed.id !== "new" || seed.releaseDate !== "2026-01-02") {
    throw new Error("条件に合う最新の起点回を選べません");
  }

  const bootstrapState = createAutoPlaylistScopedShowState_(rule, "show-test", "seed-bootstrap", "");
  bootstrapState.bootstrapSeedDate = "2025-01-02";
  const pageState = applyAutoUpdateSeedBootstrapPageV1_(bootstrapState, [
    { id: "new", name: "佐藤陽 新しい回", release_date: "2026-01-02" },
    { id: "seed", name: "佐藤陽 起点回", release_date: "2025-01-02" },
    { id: "too-old", name: "佐藤陽 対象外", release_date: "2025-01-01" }
  ], rule, "next-url");
  if (!pageState.complete || pageState.candidateIds.join(",") !== "new") {
    throw new Error("起点日より後の回だけを初回補完候補にできません");
  }

  const backstageRequest = {
    updateType: "series",
    title: "新聞社員の「楽屋裏」",
    keywords: "楽屋裏",
    ruleNote: "#52- とあるものも追加"
  };
  const backstageRule = buildAutoUpdateRuntimeRuleV1_(backstageRequest, "playlist-backstage", 8);
  if (backstageRule.seriesTitleCode !== "#52-") {
    throw new Error("楽屋裏の連載コードを申請補足から抽出できません");
  }
  if (!matchesAutoPlaylistRule_({ name: "採用の舞台裏 #52-123" }, backstageRule)) {
    throw new Error("#52-半角数字の楽屋裏回を判定できません");
  }
  if (matchesAutoPlaylistRule_({ name: "別シリーズ #52-ABC" }, backstageRule)) {
    throw new Error("半角数字でない連載コードを誤判定しています");
  }

  const tenseiRule = buildAutoUpdateRuntimeRuleV1_({
    updateType: "series",
    title: "まなび場天声人語",
    keywords: "まなび場天声人語",
    ruleNote: "タイトルに #42- と書かれた回を追加"
  }, "playlist-tensei", 9);
  if (!matchesAutoPlaylistRule_({ name: "見出しづくり #42-007" }, tenseiRule)) {
    throw new Error("#42-半角数字のまなび場天声人語回を判定できません");
  }
  if (rule.requestSheetRow !== 5 || rule.playlistId !== "73ppqrTcsjVgl1xwIZa4SY") {
    throw new Error("申請行またはPlaylist IDを保持できません");
  }
  const statusNote = mergeAutoUpdateStatusNoteV1_(
    "方式: series / 申請を受け付けました",
    "招待承認待ち"
  );
  if (statusNote !== "方式: series / 招待承認待ち") {
    throw new Error("再試行に必要な自動更新方式を状態メモに保持できません");
  }

  Logger.log("Auto update automation v1 pure tests: PASS");
  return true;
}
