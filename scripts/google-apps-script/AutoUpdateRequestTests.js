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

  const mismatchedInvite = Object.assign({}, valid, {
    inviteUrl: "https://open.spotify.com/playlist/73ppqrTcsjVgl1xwIZa4SY?pt=test-token"
  });
  if (!validateAutoUpdateRequest_(mismatchedInvite)) {
    throw new Error("別プレイリストの共同編集URLが許可されました");
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

function testAutoUpdateDuplicateStatusPure() {
  ["重複申請", "却下", "取消", "キャンセル", "停止"].forEach(function(status) {
    if (!isInactiveAutoUpdateRequestStatus_(status)) {
      throw new Error("再申請を許可する終了状態として判定できません: " + status);
    }
  });
  ["", "招待承認待ち", "初回補完中", "増分自動更新", "確認待ち"].forEach(function(status) {
    if (isInactiveAutoUpdateRequestStatus_(status)) {
      throw new Error("有効な申請状態を終了扱いしています: " + status);
    }
  });

  const rows = [
    ["2026/09/18", "https://open.spotify.com/playlist/OTHER", "別リスト", "A", "", "", "", "増分自動更新"],
    ["2026/09/19", "https://open.spotify.com/playlist/TARGET?si=test", "対象", "B", "", "", "", "停止"],
    ["2026/09/19", "https://open.spotify.com/playlist/TARGET", "対象", "B", "", "", "", "招待承認待ち"]
  ];
  const fakeSheet = {
    getLastRow: function() { return rows.length + 1; },
    getRange: function() {
      return { getDisplayValues: function() { return rows; } };
    }
  };
  const duplicate = findActiveAutoUpdateRequestDuplicate_(fakeSheet, "TARGET");
  if (!duplicate.found || duplicate.rowNumber !== 4 || duplicate.status !== "招待承認待ち") {
    throw new Error("同一プレイリストの最新有効申請を検出できません");
  }
  if (findActiveAutoUpdateRequestDuplicate_(fakeSheet, "MISSING").found) {
    throw new Error("別プレイリストを重複と誤判定しました");
  }
  Logger.log("Auto update duplicate status pure tests: PASS");
  return true;
}

function testAutoUpdateRequestNotificationPure() {
  const mail = buildAutoUpdateRequestNotificationMail_({
    receivedAt: "2026/09/18 15:36:30",
    title: "新聞社員の「楽屋裏」",
    maker: "朝日新聞ポッドキャスト",
    updateType: "series",
    keywords: "楽屋裏 / #52-半角数字",
    rowNumber: 8,
    immediateRunScheduled: false,
    immediateRunReason: "scheduler-unavailable"
  });
  const serialized = JSON.stringify(mail);

  if (mail.to !== "shuheinezu@gmail.com") throw new Error("管理者通知先が正しくありません");
  if (mail.name !== "朝リスの田") throw new Error("差出人表示名が正しくありません");
  if (mail.subject.indexOf("【朝リスの田】") !== 0) throw new Error("通知件名が正しくありません");
  if (mail.body.indexOf("自動更新申請シート 8行目") < 0) throw new Error("確認場所が本文にありません");
  if (mail.body.indexOf("補完待ちに登録できませんでした") < 0) throw new Error("補完待ち登録失敗時の案内が本文にありません");
  if (/pt=|access[_ -]?token|refresh[_ -]?token/i.test(serialized)) {
    throw new Error("通知メールに秘密情報らしき文字列が含まれています");
  }

  Logger.log("Auto update request notification pure tests: PASS");
  return true;
}

function testAutoUpdateFailureNotificationPure() {
  const mail = buildAutoUpdateFailureNotificationMail_({
    target: "新聞社員の「楽屋裏」",
    stage: "毎時50件補充",
    error: "status=500 https://example.test/?pt=secret Bearer abc.def access_token=secret"
  });
  const serialized = JSON.stringify(mail);
  if (mail.subject.indexOf("新聞社員の「楽屋裏」") < 0) throw new Error("失敗対象が件名にありません");
  if (/pt=secret|Bearer abc|access_token=secret/i.test(serialized)) {
    throw new Error("失敗通知に秘密情報らしき文字列が含まれています");
  }
  Logger.log("Auto update failure notification pure tests: PASS");
  return true;
}
