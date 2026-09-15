// プレイリスト自動更新申請の受付

const AUTO_UPDATE_REQUEST_SHEET_NAME = "自動更新申請";

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

  // 申請時点ではSpotifyへ接続せず、初回構築前の安全なプランだけを確定する。
  const requestPlan = buildAutoPlaylistRequestPlan_({
    updateType: updateType,
    url: url,
    title: title,
    keywords: keywords
  });

  const autoUpdateLock = LockService.getScriptLock();
  if (!autoUpdateLock.tryLock(5000)) {
    throw new Error("ただいま投稿が混み合っています。少し待って再度お試しください");
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const requestSheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);

    if (!requestSheet) {
      throw new Error("自動更新申請シートが見つかりません");
    }

    requestSheet.appendRow([
      new Date(),
      url,
      title,
      maker,
      inviteUrl,
      keywords,
      ruleNote,
      requestPlan.statusLabel,
      "方式: " + updateType + " / ruleType: " + requestPlan.ruleType
    ]);

    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      kind: "autoUpdateRequest",
      message: "自動更新申請を受け付けました",
      lifecycle: requestPlan.status,
      ruleType: requestPlan.ruleType,
      productionWriteAllowed: requestPlan.productionWriteAllowed
    });
  } finally {
    autoUpdateLock.releaseLock();
  }
}
