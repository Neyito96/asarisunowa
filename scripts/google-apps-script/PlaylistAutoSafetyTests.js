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

  const seriesPlan = buildAutoPlaylistRequestPlan_({ updateType: "series" });
  if (seriesPlan.ruleType !== AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ || !seriesPlan.supported) {
    throw new Error("フォームのseriesがtitle-textへ正規化されません");
  }

  const speakerPlan = buildAutoPlaylistRequestPlan_({ updateType: "speaker" });
  if (speakerPlan.ruleType !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_ || !speakerPlan.supported) {
    throw new Error("フォームのspeakerがspeakerへ正規化されません");
  }

  const themePrepared = prepareAutoPlaylistRuleCandidate_({
    updateType: "theme",
    title: "テーマ申請テスト",
    keywords: "中東"
  });
  if (!themePrepared.requestPlan.supported) {
    throw new Error("フォームのthemeがthemeへ正規化されません");
  }
  if (
    themePrepared.candidate.ruleType !== AUTO_PLAYLIST_RULE_TYPE_THEME_ ||
    themePrepared.candidate.reviewRequired !== true ||
    themePrepared.candidate.enabled !== false ||
    themePrepared.candidate.productionWriteAllowed !== false
  ) {
    throw new Error("theme申請がreview必須の安全停止状態になっていません");
  }

  const themeRule = {
    key: "test-theme",
    enabled: false,
    lifecycleStatus: AUTO_PLAYLIST_LIFECYCLE_.REVIEW,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_THEME_,
    name: "中東テーマ",
    playlistId: "test-playlist",
    showIds: ["test-show"],
    keywords: ["中東"],
    fields: ["name", "description", "html_description"],
    reviewRequired: true
  };
  const themeEpisode = {
    name: "国際ニュースを読み解く",
    description: "中東情勢について解説します",
    html_description: ""
  };
  if (!matchesAutoPlaylistRule_(themeEpisode, themeRule)) {
    throw new Error("themeが概要欄のキーワードを検出できません");
  }

  const requestCandidate = buildAutoPlaylistRuleCandidateFromRequest_({
    updateType: "speaker",
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

  const themeDryRun = dryRunThemeRequestProvisioningNoWriteV1_();
  if (
    themeDryRun.status !== "確認待ち" ||
    themeDryRun.spotifyAccessed !== false ||
    themeDryRun.playlistWritten !== false ||
    themeDryRun.createdSheets.length !== 2
  ) {
    throw new Error("theme申請の最終dry-runが安全停止条件を満たしていません");
  }

  Logger.log("Auto playlist pure safety tests: PASS");
  return true;
}

// 新規テーマ申請の最終確認用。
// SpreadsheetApp / Spotify API / PropertiesService は呼ばず、
// 実運用と同じルール生成・専用タブ名決定までを純粋関数だけで確認する。
function dryRunThemeRequestProvisioningNoWriteV1_() {
  const playlistId = "AbCdEfGhIjKlMnOpQrStUv";
  const request = {
    updateType: "theme",
    title: "テーマ申請dry-run",
    keywords: "鉄道, 地方交通",
    ruleNote: ""
  };

  const rule = buildAutoUpdateRuntimeRuleV1_(request, playlistId, 9999);

  if (
    rule.key !== "request-" + playlistId ||
    getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_ ||
    rule.enabled !== false ||
    rule.productionWriteAllowed !== false ||
    rule.reviewRequired !== true ||
    rule.lifecycleStatus !== "requested"
  ) {
    throw new Error("テーマ申請ルールが未承認の安全停止状態になっていません");
  }

  const names = getThemeReviewSheetNamesV1_(rule);
  const expectedQueue = "テーマ候補_" + playlistId;
  const expectedHistory = "テーマ履歴_" + playlistId;

  if (
    !names ||
    names.queue !== expectedQueue ||
    names.history !== expectedHistory ||
    names.queue === names.history
  ) {
    throw new Error("テーマ専用候補/履歴タブ名の生成が不正です");
  }

  // 実シートは作らず、作成予定だけをメモリ上で再現する。
  const fakeSpreadsheet = {
    sheets: {},
    getSheetByName: function(name) {
      return this.sheets[name] || null;
    },
    insertSheet: function(name) {
      if (this.sheets[name]) throw new Error("dry-run内でタブ名が重複しました: " + name);
      const sheet = { name: name };
      this.sheets[name] = sheet;
      return sheet;
    }
  };

  if (fakeSpreadsheet.getSheetByName(names.queue) ||
      fakeSpreadsheet.getSheetByName(names.history)) {
    throw new Error("dry-run開始時点で専用タブが存在しています");
  }

  fakeSpreadsheet.insertSheet(names.queue);
  fakeSpreadsheet.insertSheet(names.history);

  const createdSheets = Object.keys(fakeSpreadsheet.sheets).sort();
  if (
    createdSheets.length !== 2 ||
    !fakeSpreadsheet.getSheetByName(expectedQueue) ||
    !fakeSpreadsheet.getSheetByName(expectedHistory)
  ) {
    throw new Error("テーマ専用候補/履歴タブの作成計画を再現できません");
  }

  const result = {
    dryRun: true,
    ruleKey: rule.key,
    playlistId: playlistId,
    createdSheets: createdSheets,
    status: "確認待ち",
    note: "テーマ専用タブを準備しました。内容確認と承認が必要です",
    reviewRequired: true,
    incrementalActivationAllowed: false,
    spotifyAccessed: false,
    playlistWritten: false
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
