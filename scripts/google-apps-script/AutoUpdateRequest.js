// プレイリスト自動更新申請の受付

const AUTO_UPDATE_REQUEST_SHEET_NAME = "自動更新申請";
const AUTO_UPDATE_RECEIPT_CACHE_PREFIX_ = "AUTO_UPDATE_RECEIPT_";
const AUTO_UPDATE_RECEIPT_SECONDS_ = 600;

function handleAutoUpdateRequest_(data, url, title, maker, securityAnswer) {
  const updateType = String(data.updateType || "").trim();
  // テーマ別は耕し中。再開時はこの条件だけ取り除く。
  if (updateType === "theme") {
    return jsonResponse({ ok: false, error: "テーマ別は現在、耕し中のため新規受付を休止しています。" });
  }
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

  // ブラウザ側が受付確認を再試行しても、同じ申請を二重保存しない。
  if (requestId && CacheService.getScriptCache().get(
    AUTO_UPDATE_RECEIPT_CACHE_PREFIX_ + requestId
  ) === "accepted") {
    return jsonResponse({
      ok: true,
      kind: "autoUpdateRequest",
      added: false,
      duplicateReason: "requestId",
      message: "この申請はすでに受け付けています"
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

    const playlistId = extractAutoUpdateSpotifyPlaylistId_(url);
    const existingRequest = findActiveAutoUpdateRequestDuplicate_(requestSheet, playlistId);
    if (existingRequest.found) {
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
        added: false,
        duplicateReason: "playlist",
        existingRow: existingRequest.rowNumber,
        existingStatus: existingRequest.status,
        message: "このプレイリストの自動更新申請はすでに受け付けています"
      });
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
    const requestRowNumber = requestSheet.getLastRow();

    // 受付ごとの臨時トリガーは作らず、常設の1時間処理が順番に受け取る。
    const immediateRun = { scheduled: true, reason: "hourly-backfill-queue" };

    try {
      notifyAutoUpdateRequestReceived_({
        receivedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss"),
        title: title,
        maker: maker,
        updateType: updateType,
        keywords: keywords,
        rowNumber: requestRowNumber,
        immediateRunScheduled: immediateRun.scheduled === true,
        immediateRunReason: immediateRun.reason
      });
    } catch (notificationError) {
      console.error("自動更新申請の管理者メール通知に失敗しました", notificationError);
      const noteCell = requestSheet.getRange(requestRowNumber, 9);
      const currentNote = String(noteCell.getDisplayValue() || "");
      noteCell.setValue(currentNote + " / 管理者メール通知失敗");
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
      message: "自動更新申請を受け付けました。共同編集確認後、初回分は1時間ごとに最大50件ずつ追加し、完了後は毎朝4〜5時に新着回だけ確認します",
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

function findActiveAutoUpdateRequestDuplicate_(sheet, playlistId) {
  const wantedId = String(playlistId || "").trim();
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (!wantedId || lastRow < 2) return { found: false, rowNumber: 0, status: "" };

  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (extractAutoUpdateSpotifyPlaylistId_(row[1]) !== wantedId) continue;
    const status = String(row[7] || "").trim();
    if (isInactiveAutoUpdateRequestStatus_(status)) continue;
    return { found: true, rowNumber: index + 2, status: status || "受付済み" };
  }
  return { found: false, rowNumber: 0, status: "" };
}

function isInactiveAutoUpdateRequestStatus_(status) {
  return ["重複申請", "却下", "取消", "キャンセル", "停止"].indexOf(
    String(status || "").trim()
  ) >= 0;
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
