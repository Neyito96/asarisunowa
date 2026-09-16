// ノーミライ・佐藤陽ルール候補の純粋テスト。
// Spotify・Spreadsheetへのアクセスや本番書き込みは行わない。

function testNewAutoPlaylistRuleCandidatesPure() {
  const noMirai = getAutoPlaylistRuleByKey_("no-mirai");
  const satoYo = getAutoPlaylistRuleByKey_("sato-yo");
  if (!noMirai || !satoYo) throw new Error("新規ルール候補が見つかりません");

  [noMirai, satoYo].forEach(function(rule) {
    if (rule.enabled !== false) throw new Error(rule.key + " が有効化されています");
    if (rule.lifecycleStatus !== AUTO_PLAYLIST_LIFECYCLE_.REQUESTED) {
      throw new Error(rule.key + " がrequested状態ではありません");
    }
    if (rule.productionWriteAllowed !== false) {
      throw new Error(rule.key + " の本番書き込みが許可されています");
    }
    if (canActivateAutoPlaylistRule_(rule).canActivate) {
      throw new Error(rule.key + " が申請直後に有効化可能です");
    }
  });

  if (satoYo.requireSheetLinkBeforeWrite !== true) {
    throw new Error("佐藤陽ルールの書き込み前シート確認が無効です");
  }
  if (satoYo.continueOnShowFetchError !== false) {
    throw new Error("佐藤陽ルールが番組取得失敗後も継続する設定です");
  }

  if (noMirai.fetchAllPages !== true) {
    throw new Error("ノーミライの全ページ取得が無効です");
  }

  if (!matchesAutoPlaylistRule_({
    name: "（ノーミライ #1）犬がキャンと鳴いた、というお話",
    description: "",
    html_description: ""
  }, noMirai)) {
    throw new Error("ノーミライの正しいタイトルを検出できません");
  }
  if (!matchesAutoPlaylistRule_({
    name: "（農M,猟L #2）うじうじしてたらあかんのかい、というお話",
    description: "",
    html_description: ""
  }, noMirai)) {
    throw new Error("ノーミライのSpotify表示名を検出できません");
  }
  if (extractNoMiraiEpisodeNumber_("（農M，猟L #4）テスト") !== 4) {
    throw new Error("ノーミライの回番号を取得できません");
  }
  const launchEpisodes = selectExactNoMiraiEpisodes_([
    { name: "（農M,猟L #4）四", uri: "spotify:episode:4" },
    { name: "（ノーミライ #2）二", uri: "spotify:episode:2" },
    { name: "（農M、猟L #3）三", uri: "spotify:episode:3" },
    { name: "（ノーミライ #1）一", uri: "spotify:episode:1" }
  ], [2, 3, 4]);
  if (launchEpisodes.map(function(ep) {
    return extractNoMiraiEpisodeNumber_(ep.name);
  }).join(",") !== "2,3,4") {
    throw new Error("ノーミライ初回追加が#2・#3・#4に限定されていません");
  }
  let duplicateStopped = false;
  try {
    selectExactNoMiraiEpisodes_([
      { name: "（ノーミライ #2）二", uri: "spotify:episode:2" },
      { name: "（農M,猟L #2）二の重複", uri: "spotify:episode:2b" },
      { name: "（ノーミライ #3）三", uri: "spotify:episode:3" },
      { name: "（ノーミライ #4）四", uri: "spotify:episode:4" }
    ], [2, 3, 4]);
  } catch (_) {
    duplicateStopped = true;
  }
  if (!duplicateStopped) {
    throw new Error("同じ回番号が複数ある場合に初回追加が停止しません");
  }
  if (matchesAutoPlaylistRule_({
    name: "農と音楽のこれから",
    description: "概要欄にノーミライ #2 と書かれています",
    html_description: ""
  }, noMirai)) {
    throw new Error("ノーミライが概要欄だけの一致を誤採用しました");
  }
  if (matchesAutoPlaylistRule_({
    name: "（ポすすめ）ノーミライ #1を聞いて",
    description: "",
    html_description: ""
  }, noMirai)) {
    throw new Error("ノーミライがタイトル途中の言及を誤採用しました");
  }

  const confirmedSato = {
    name: "#7-1 こんな夜更けにパクチーかよ",
    uri: "spotify:episode:sato-confirmed",
    description: "連載『それぞれの最終楽章』から、文化くらし報道部の佐藤陽記者が話します。",
    html_description: ""
  };
  if (!matchesAutoPlaylistRule_(confirmedSato, satoYo)) {
    throw new Error("佐藤陽記者の出演確認文を検出できません");
  }

  const invitedSato = {
    name: "（1on1）佐藤陽さん 友達がいない神田大介の悩み相談",
    uri: "spotify:episode:sato-invited",
    description: "記事が掲載されるや大きな反響を呼びました。今回は、著者の佐藤陽記者を招き、その後のことを聞きました。",
    html_description: ""
  };
  if (!matchesAutoPlaylistRule_(invitedSato, satoYo)) {
    throw new Error("佐藤陽記者を招いた出演回を検出できません");
  }

  const satoAndWife = {
    name: "手洗いがやめられない①",
    uri: "spotify:episode:sato-and-wife",
    description: "その当事者である佐藤陽記者と、向き合い続けている妻が、それぞれの立場から長い道のりについて話します。",
    html_description: ""
  };
  if (!matchesAutoPlaylistRule_(satoAndWife, satoYo)) {
    throw new Error("佐藤陽記者と同席者が話す出演回を検出できません");
  }

  const announcementOnly = {
    name: "別の出演者による回",
    uri: "spotify:episode:sato-announcement",
    description: "【イベントのお知らせ】佐藤陽記者が登壇します。詳しくはこちら。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(announcementOnly, satoYo)) {
    throw new Error("佐藤陽さんのイベント告知を誤採用しました");
  }

  const publicRecordingAnnouncement = {
    name: "別の出演者による回",
    uri: "spotify:episode:sato-public-recording",
    description: "記念グッズを大放出。公開収録や交流会も！ 寺下真理加、太田匡彦、佐藤陽に朝ポキメンバーも多数参加。会場はこちら。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(publicRecordingAnnouncement, satoYo)) {
    throw new Error("佐藤陽さんの公開収録告知を誤採用しました");
  }

  const articleOnly = {
    name: "別の記者による解説",
    uri: "spotify:episode:sato-article",
    description: "【関連記事】佐藤陽記者が執筆した記事はこちらです。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(articleOnly, satoYo)) {
    throw new Error("佐藤陽さんの関連記事だけの回を誤採用しました");
  }

  const titleOnly = {
    name: "佐藤陽記者に聞く",
    uri: "spotify:episode:sato-title-only",
    description: "番組の詳しい出演情報はありません。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(titleOnly, satoYo)) {
    throw new Error("概要欄で出演確認できない佐藤陽タイトルを誤採用しました");
  }

  const unrelatedHeadingAfterCast = {
    name: "別の出演者による回",
    uri: "spotify:episode:sato-unrelated-heading",
    description: "【出演】\n山田太郎\n【今回のテーマ】\n佐藤陽記者の仕事を紹介します。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(unrelatedHeadingAfterCast, satoYo)) {
    throw new Error("佐藤陽さんを別見出し後も出演者として誤採用しました");
  }

  const beFourKingsReview = {
    name: "遊びじゃない、ガチの付録だよ　BE四天王が集合",
    uri: "spotify:episode:be-four-kings-review",
    description: "佐藤陽、太田匡彦ほか4人の名前がありますが、出演上の役割は確認できません。",
    html_description: ""
  };
  const beFourKingsClassification = classifySatoYoAutoPlaylistEpisode_(beFourKingsReview);
  if (beFourKingsClassification.classification !== "review") {
    throw new Error("BE四天王の既知回がreviewに固定されていません");
  }
  if (matchesAutoPlaylistRule_(beFourKingsReview, satoYo)) {
    throw new Error("BE四天王の既知review回を自動採用しました");
  }

  const missingIdentityClassification = classifySatoYoAutoPlaylistEpisode_({
    name: "佐藤陽記者の出演回",
    description: "佐藤陽記者が話します。",
    html_description: ""
  });
  if (
    missingIdentityClassification.classification !== "unresolved" ||
    missingIdentityClassification.reason !== "episode_identity_missing"
  ) {
    throw new Error("URI・ID欠落時にunresolvedで安全停止しません");
  }

  const classifierError = classifySpeakerEpisodeWithGuardrail_({
    name: "テスト回",
    uri: "spotify:episode:classifier-error",
    description: "出演情報",
    html_description: ""
  }, {}, function() {
    throw new Error("test classifier failure");
  });
  if (classifierError.classification !== "unresolved" || classifierError.reason !== "classifier_error") {
    throw new Error("人物別classifier例外時にunresolvedで安全停止しません");
  }

  const linkedSheet = classifyAutoPlaylistSheetRows_([
    ["https://open.spotify.com/playlist/other", "別リスト", "A", "", "", ""],
    ["https://open.spotify.com/playlist/73ppqrTcsjVgl1xwIZa4SY", "佐藤陽", "B", "", "", "2026-09-16"]
  ], satoYo.playlistId);
  if (!linkedSheet.found || linkedSheet.match.row !== 3) {
    throw new Error("佐藤陽プレイリストの作業台連携を検出できません");
  }
  const validHeaders = validateAutoPlaylistSheetHeaders_([
    "Spotifyプレイリストのリンク", "公開プレイリスト", "プロフィール", "共同編集URL", "", "最終更新日"
  ]);
  if (!validHeaders.valid) {
    throw new Error("作業台の列見出し契約を検証できません");
  }
  const invalidHeaders = validateAutoPlaylistSheetHeaders_([
    "URL", "公開プレイリスト", "プロフィール", "", "", "更新日"
  ]);
  if (invalidHeaders.valid || invalidHeaders.missing.length !== 2) {
    throw new Error("作業台の列見出し変更を安全停止できません");
  }
  const duplicateSheet = classifyAutoPlaylistSheetRows_([
    ["https://open.spotify.com/playlist/73ppqrTcsjVgl1xwIZa4SY", "佐藤陽", "B"],
    ["https://open.spotify.com/playlist/73ppqrTcsjVgl1xwIZa4SY?si=x", "佐藤陽 duplicate", "C"]
  ], satoYo.playlistId);
  if (!duplicateSheet.duplicate || duplicateSheet.found) {
    throw new Error("佐藤陽プレイリストの重複行を安全停止できません");
  }

  Logger.log("New auto playlist rule candidates pure tests: PASS");
  return true;
}
