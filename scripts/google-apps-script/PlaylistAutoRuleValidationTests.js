// 静的検証器そのものの純粋テスト。Spotify・Spreadsheetへアクセスしない。

function testAutoPlaylistRuleValidationPure() {
  const validTitle = validateAutoPlaylistRule_({
    key: "title-ok",
    enabled: false,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "title",
    playlistId: "playlist",
    showIds: ["show"],
    keyword: "文字"
  });
  if (!validTitle.valid) throw new Error("有効なtitle-textルールが検証失敗しました");

  const invalid = validateAutoPlaylistRule_({
    enabled: false,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_SPEAKER_,
    name: "invalid"
  });
  if (invalid.valid) throw new Error("不足項目のあるルールが検証を通過しました");

  Logger.log("Auto playlist rule validation pure tests: PASS");
  return true;
}
