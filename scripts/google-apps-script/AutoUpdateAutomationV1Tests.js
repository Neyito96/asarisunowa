// 自動受付v1の純粋判定テスト。Spotify・Spreadsheet・Propertiesへアクセスしない。

function testAutoUpdateAutomationV1Pure() {
  if (AUTO_UPDATE_V1_IMMEDIATE_HANDLER_ !== "runAutoUpdateAutomationSoonV1") {
    throw new Error("直後実行用の公開ハンドラー名が不正です");
  }
  if (AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_ < 60 * 1000) {
    throw new Error("直後実行の予約間隔が短すぎます");
  }
  if (AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_ !== 20) {
    throw new Error("日次巡回の取得件数が想定外です");
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
  if (rule.requestSheetRow !== 5 || rule.playlistId !== "73ppqrTcsjVgl1xwIZa4SY") {
    throw new Error("申請行またはPlaylist IDを保持できません");
  }

  Logger.log("Auto update automation v1 pure tests: PASS");
  return true;
}
