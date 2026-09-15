// 自動更新の分類・申請・有効化ゲートをSpotify通信なしで確認する簡易テスト。

function testAutoPlaylistSafetyPureFunctions() {
  const titleRule = {
    key: "test-title",
    enabled: false,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "タイトル検索テスト",
    playlistId: "test-playlist",
    showIds: ["test-show"],
    keyword: "めくろう"
  };
  const episode = {
    name: "別のタイトル",
    description: "概要欄にめくろうと書かれている",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(episode, titleRule)) {
    throw new Error("title-text が概要欄を誤って検索しています");
  }

  episode.name = "一緒に新聞をめくろう！";
  if (!matchesAutoPlaylistRule_(episode, titleRule)) {
    throw new Error("title-text がタイトル文字列を検出できません");
  }

  const speakerRule = {
    key: "test-speaker",
    enabled: false,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_SPEAKER_,
    name: "出演者テスト",
    playlistId: "test-playlist",
    showIds: ["test-show"],
    keywords: ["豊秀一"],
    fields: ["name", "description", "html_description"]
  };
  const speakerEpisode = {
    name: "ニュースの現場から",
    description: "出演は豊秀一です",
    html_description: ""
  };
  if (!matchesAutoPlaylistRule_(speakerEpisode, speakerRule)) {
    throw new Error("speaker が概要欄の出演者名を検出できません");
  }

  const requestCandidate = buildAutoPlaylistRuleCandidateFromRequest_({
    updateType: AUTO_PLAYLIST_RULE_TYPE_SPEAKER_,
    title: "申請テスト",
    keywords: "山田太郎、山田 太郎"
  });
  if (requestCandidate.enabled !== false || requestCandidate.productionWriteAllowed !== false) {
    throw new Error("申請ルール候補が安全停止状態になっていません");
  }

  const activation = canActivateAutoPlaylistRule_(requestCandidate);
  if (activation.canActivate) {
    throw new Error("申請直後のルール候補が本番有効化可能になっています");
  }

  Logger.log("Auto playlist pure safety tests: PASS");
  return true;
}
