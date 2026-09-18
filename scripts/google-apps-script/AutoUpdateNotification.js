// 「朝リスの田」自動更新申請の管理者メール通知。
// 共同編集招待URLやSpotify認証情報は、引数にも本文にも含めない。

const AUTO_UPDATE_NOTIFICATION_TO_ = "shuheinezu@gmail.com";
const AUTO_UPDATE_NOTIFICATION_NAME_ = "朝リスの田";

function buildAutoUpdateRequestNotificationMail_(request) {
  const title = String(request && request.title ? request.title : "（タイトル未設定）").trim();
  const receivedAt = String(request && request.receivedAt ? request.receivedAt : "").trim();
  const maker = String(request && request.maker ? request.maker : "").trim();
  const updateType = String(request && request.updateType ? request.updateType : "").trim();
  const keywords = String(request && request.keywords ? request.keywords : "").trim();
  const rowNumber = Number(request && request.rowNumber ? request.rowNumber : 0);
  const immediateRunScheduled = request && request.immediateRunScheduled === true;
  const immediateRunReason = String(request && request.immediateRunReason ? request.immediateRunReason : "").trim();

  const lines = [
    "朝リスの田に、新しい自動更新申請が届きました。",
    "",
    "受付日時：" + (receivedAt || "受付時刻を取得できませんでした"),
    "タイトル：" + title,
    "制作者：" + (maker || "未入力"),
    "種類：" + (updateType || "未入力"),
    "判定条件：" + (keywords || "未入力"),
    "現在の状態：招待承認待ち",
    "確認場所：自動更新申請シート " + (rowNumber >= 2 ? rowNumber + "行目" : "（行番号不明）"),
    "直後実行：" + (immediateRunScheduled ? "予約済み" : "予約できませんでした。翌朝4〜5時の巡回で再確認します"),
    "",
    "共同編集の承認など、人の操作が必要な場合はシートの状態欄をご確認ください。"
  ];
  if (!immediateRunScheduled && immediateRunReason) {
    lines.push("予約結果：" + immediateRunReason);
  }

  return {
    to: AUTO_UPDATE_NOTIFICATION_TO_,
    name: AUTO_UPDATE_NOTIFICATION_NAME_,
    subject: "【朝リスの田】新しい自動更新申請：" + title,
    body: lines.join("\n")
  };
}

function notifyAutoUpdateRequestReceived_(request) {
  const mail = buildAutoUpdateRequestNotificationMail_(request);
  MailApp.sendEmail(mail);
  return { sent: true, to: mail.to, subject: mail.subject };
}

// 管理者が明示的に実行する実送信テスト。シート・Spotifyは変更しない。
function sendAutoUpdateNotificationTestMail() {
  const timeZone = Session.getScriptTimeZone() || "Asia/Tokyo";
  return notifyAutoUpdateRequestReceived_({
    receivedAt: Utilities.formatDate(new Date(), timeZone, "yyyy/MM/dd HH:mm:ss") + "（送信テスト）",
    title: "【テスト】新しいリスト投稿の通知確認",
    maker: "朝リスの田",
    updateType: "連載",
    keywords: "テスト通知（実際の申請ではありません）",
    rowNumber: 0,
    immediateRunScheduled: true,
    immediateRunReason: "test"
  });
}
