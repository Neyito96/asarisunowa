// プレイリスト自動更新申請の受付

const AUTO_UPDATE_REQUEST_SHEET_NAME = "自動更新申請";
const AUTO_UPDATE_RECEIPT_CACHE_PREFIX_ = "AUTO_UPDATE_RECEIPT_";
const AUTO_UPDATE_RECEIPT_SECONDS_ = 600;

function handleAutoUpdateRequest_(data, url, title, maker, securityAnswer) {
  const updateType = String(data.updateType || "").trim();
  const inviteUrl = String(data.inviteUrl || "").trim();
  const keywords = String(data.keywords || "").trim();
  const ruleNote = String(data.ruleNote || "").trim();
  const requestId = String(data.requestId || "").trim();

  const validationError = validateAutoUpdateRequest_({
    url: url,
    title: title,
    maker: maker,
    updateType: updateType,
    inviteUrl: inviteUrl,
    keywords: keywords,
    ruleNote: ruleNote,
    securityAnswer: securityAnswer,
    requestId: requestId
  });

  if (validationError) {
    return jsonResponse({ ok: false, error: validationError });
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
      "招待承認待ち",
      "方式: " + updateType + " / ruleType: " + requestPlan.ruleType
    ]);

    SpreadsheetApp.flush();

    // 受付レスポンスを待たせず、直後の1回だけを時間主導トリガーへ予約する。
    // すでに予約済みなら同じトリガーへ相乗りし、トリガー数の増加を防ぐ。
    let immediateRun = { scheduled: false, reason: "scheduler-unavailable" };
    try {
      immediateRun = scheduleImmediateAutoUpdateAutomationV1_();
    } catch (scheduleError) {
      // 毎朝4〜5時の定期巡回が予備になるため、受付自体は成功として残す。
      console.error("自動更新の直後実行を予約できませんでした", scheduleError);
    }

    if (requestId) {
      CacheService.getScriptCache().put(
        AUTO_UPDATE_RECEIPT_CACHE_PREFIX_ + requestId,
        "accepted",
        AUTO_UPDATE_RECEIPT_SECONDS_
      );
    }

    return jsonResponse({
      ok: true,
      kind: "autoUpdateRequest",
      message: "自動更新申請を受け付けました。共同編集招待の承認後、安全条件を満たす申請は自動更新を開始します",
      lifecycle: requestPlan.status,
      ruleType: requestPlan.ruleType,
      productionWriteAllowed: requestPlan.productionWriteAllowed,
      immediateRunScheduled: immediateRun.scheduled,
      immediateRunReason: immediateRun.reason
    });
  } finally {
    autoUpdateLock.releaseLock();
  }
}

function handleAutoUpdateRequestStatus_(e, callback) {
  const requestId = String(
    e && e.parameter && e.parameter.requestId
      ? e.parameter.requestId
      : ""
  ).trim();

  if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
    return apiResponse({ ok: false, accepted: false, error: "受付番号が正しくありません" }, callback);
  }

  const accepted = CacheService.getScriptCache().get(
    AUTO_UPDATE_RECEIPT_CACHE_PREFIX_ + requestId
  ) === "accepted";

  return apiResponse({ ok: true, accepted: accepted }, callback);
}
