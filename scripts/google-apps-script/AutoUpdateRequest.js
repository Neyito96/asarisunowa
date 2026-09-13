// プレイリスト自動更新申請の受付

function handleAutoUpdateRequest_(data, url, title, maker, securityAnswer) {
  const updateType = String(data.updateType || "").trim();
  const inviteUrl = String(data.inviteUrl || "").trim();
  const keywords = String(data.keywords || "").trim();
  const ruleNote = String(data.ruleNote || "").trim();

  const autoUpdateLengthError = validatePostInputLengths_({
    updateType: updateType,
    inviteUrl: inviteUrl,
    keywords: keywords,
    ruleNote: ruleNote
  });

  if (autoUpdateLengthError) {
    return jsonResponse({ ok: false, error: autoUpdateLengthError });
  }

  if (securityAnswer !== SUBMIT_SECURITY_ANSWER) {
    return jsonResponse({
      ok: false,
      error: "セキュリティ回答が正しくありません"
    });
  }

  const autoUpdateLock = LockService.getScriptLock();
  if (!autoUpdateLock.tryLock(5000)) {
    throw new Error("ただいま投稿が混み合っています。少し待って再度お試しください");
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);

    if (!logSheet) {
      throw new Error("投稿受付シートが見つかりません");
    }

    const memo = [
      "方式: " + updateType,
      "キーワード: " + keywords,
      "共同編集URL: " + inviteUrl,
      ruleNote ? "ルール: " + ruleNote : ""
    ].filter(Boolean).join("\n");

    logSheet.appendRow([
      new Date(),
      url,
      title,
      maker,
      "自動更新申請",
      memo
    ]);

    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      kind: "autoUpdateRequest",
      message: "自動更新申請を受け付けました"
    });
  } finally {
    autoUpdateLock.releaseLock();
  }
}
