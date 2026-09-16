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
    description: "連載『それぞれの最終楽章』から、文化くらし報道部の佐藤陽記者が話します。",
    html_description: ""
  };
  if (!matchesAutoPlaylistRule_(confirmedSato, satoYo)) {
    throw new Error("佐藤陽記者の出演確認文を検出できません");
  }

  const announcementOnly = {
    name: "別の出演者による回",
    description: "【イベントのお知らせ】佐藤陽記者が登壇します。詳しくはこちら。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(announcementOnly, satoYo)) {
    throw new Error("佐藤陽さんのイベント告知を誤採用しました");
  }

  const articleOnly = {
    name: "別の記者による解説",
    description: "【関連記事】佐藤陽記者が執筆した記事はこちらです。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(articleOnly, satoYo)) {
    throw new Error("佐藤陽さんの関連記事だけの回を誤採用しました");
  }

  const titleOnly = {
    name: "佐藤陽記者に聞く",
    description: "番組の詳しい出演情報はありません。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(titleOnly, satoYo)) {
    throw new Error("概要欄で出演確認できない佐藤陽タイトルを誤採用しました");
  }

  const unrelatedHeadingAfterCast = {
    name: "別の出演者による回",
    description: "【出演】\n山田太郎\n【今回のテーマ】\n佐藤陽記者の仕事を紹介します。",
    html_description: ""
  };
  if (matchesAutoPlaylistRule_(unrelatedHeadingAfterCast, satoYo)) {
    throw new Error("佐藤陽さんを別見出し後も出演者として誤採用しました");
  }

  Logger.log("New auto playlist rule candidates pure tests: PASS");
  return true;
}
