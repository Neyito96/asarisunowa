// 自動更新申請の入力検証テスト。Spotify・Spreadsheet・Cacheへアクセスしない。

function testAutoUpdateRequestValidationPure() {
  const valid = {
    url: "https://open.spotify.com/playlist/4FBXSFf2nLjLb3qaRoSdoD",
    title: "テストプレイリスト",
    maker: "テスト",
    updateType: "series",
    inviteUrl: "https://open.spotify.com/playlist/4FBXSFf2nLjLb3qaRoSdoD?pt=test-token",
    keywords: "ノーミライ",
    ruleNote: "",
    securityAnswer: "大介",
    requestId: "request_20260916_test"
  };

  if (validateAutoUpdateRequest_(valid)) {
    throw new Error("正しい自動更新申請が拒否されました");
  }

  const invalidInvite = Object.assign({}, valid, {
    inviteUrl: "https://open.spotify.com/playlist/4FBXSFf2nLjLb3qaRoSdoD"
  });
  if (!validateAutoUpdateRequest_(invalidInvite)) {
    throw new Error("ptなしの共同編集URLが許可されました");
  }

  const invalidType = Object.assign({}, valid, { updateType: "unknown" });
  if (!validateAutoUpdateRequest_(invalidType)) {
    throw new Error("未対応の自動更新種別が許可されました");
  }

  const missingKeywords = Object.assign({}, valid, { keywords: "" });
  if (!validateAutoUpdateRequest_(missingKeywords)) {
    throw new Error("キーワードなしの申請が許可されました");
  }

  Logger.log("Auto update request validation pure tests: PASS");
  return true;
}
