// 「朝リスの田」自動更新申請の管理者メール通知。
// 共同編集招待URLやSpotify認証情報は、引数にも本文にも含めない。

const AUTO_UPDATE_NOTIFICATION_TO_ = "shuheinezu@gmail.com";
const AUTO_UPDATE_NOTIFICATION_NAME_ = "朝リスの田";
const AUTO_UPDATE_FAILURE_NOTICE_PREFIX_ = "AUTO_UPDATE_FAILURE_NOTICE_";
const AUTO_UPDATE_FAILURE_NOTICE_SECONDS_ = 6 * 60 * 60;

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
    "初回処理：" + (immediateRunScheduled ? "1時間ごとの補完待ちに登録済み" : "補完待ちに登録できませんでした"),
    "",
    "共同編集の承認など、人の操作が必要な場合はシートの状態欄をご確認ください。"
  ];
  if (!immediateRunScheduled && immediateRunReason) {
    lines.push("登録結果：" + immediateRunReason);
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

function buildAutoUpdateFailureNotificationMail_(failure) {
  const target = String(failure && failure.target ? failure.target : "対象不明").trim();
  const stage = String(failure && failure.stage ? failure.stage : "自動更新").trim();
  const rawError = String(failure && failure.error ? failure.error : "原因不明");
  const safeError = rawError
    .replace(/([?&]pt=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~-]+/gi, "$1[REDACTED]")
    .replace(/(refresh[_ -]?token|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 1000);
  return {
    to: AUTO_UPDATE_NOTIFICATION_TO_,
    name: AUTO_UPDATE_NOTIFICATION_NAME_,
    subject: "【朝リスの田】自動更新エラー：" + target,
    body: [
      "朝リスの田の自動更新でエラーが発生しました。",
      "",
      "対象：" + target,
      "処理：" + stage,
      "内容：" + safeError,
      "",
      "Spotify、スプレッドシート、Apps Scriptの実行ログを確認してください。"
    ].join("\n")
  };
}

function notifyAutoUpdateFailure_(failure) {
  const target = String(failure && failure.target ? failure.target : "unknown").trim();
  const stage = String(failure && failure.stage ? failure.stage : "automation").trim();
  const cache = CacheService.getScriptCache();
  const cacheKey = AUTO_UPDATE_FAILURE_NOTICE_PREFIX_ + Utilities.base64EncodeWebSafe(stage + "|" + target);
  if (cache.get(cacheKey) === "sent") return { sent: false, suppressed: true };
  const mail = buildAutoUpdateFailureNotificationMail_(failure);
  MailApp.sendEmail(mail);
  cache.put(cacheKey, "sent", AUTO_UPDATE_FAILURE_NOTICE_SECONDS_);
  return { sent: true, suppressed: false };
}

function notifyAutoUpdateFailureSafely_(failure) {
  try {
    return notifyAutoUpdateFailure_(failure);
  } catch (notificationError) {
    Logger.log("自動更新エラー通知に失敗しました: " + String(notificationError));
    return { sent: false, notificationError: true };
  }
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
