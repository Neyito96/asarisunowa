// 通常投稿の保存処理

const PLAYLIST_RECEIPT_CACHE_PREFIX_ = "PLAYLIST_RECEIPT_";
const PLAYLIST_RECEIPT_SECONDS_ = 600;

function savePost_(url, title, maker, introducedDate, comment, artwork, kind, inviteUrl, requestId) {
  const writeLock = LockService.getScriptLock();
  if (!writeLock.tryLock(5000)) {
    throw new Error("ただいま投稿が混み合っています。少し待って再度お試しください");
  }

  try {
    const postSheets = getPostSheets_();

    appendPostLog_(
      postSheets.logSheet,
      url,
      title,
      maker,
      kind,
      comment
    );

    const targetSheet = getPostTargetSheet_(
      kind,
      postSheets.workSheet,
      postSheets.podcastSheet,
      postSheets.listenerPodcastSheet
    );

    const lastRow = targetSheet.getLastRow();

    const existingRows =
      lastRow > 1
        ? targetSheet
            .getRange(
              2,
              1,
              lastRow - 1,
              Math.max(2, targetSheet.getLastColumn())
            )
            .getDisplayValues()
        : [];

    const duplicate = findPostDuplicate_(existingRows, kind, url, title);

    let added = false;
    let duplicateReason = "";

    if (!duplicate.duplicateByUrl && !duplicate.duplicateByTitle) {
      appendPostRow_(
        targetSheet,
        kind,
        url,
        title,
        maker,
        introducedDate,
        comment,
        artwork,
        inviteUrl
      );

      added = true;
    } else {
      duplicateReason = duplicate.duplicateReason;
    }

    SpreadsheetApp.flush();

    const cleanRequestId = String(requestId || "").trim();
    if (kind === "playlist" && /^[A-Za-z0-9_-]{16,100}$/.test(cleanRequestId)) {
      CacheService.getScriptCache().put(
        PLAYLIST_RECEIPT_CACHE_PREFIX_ + cleanRequestId,
        "accepted",
        PLAYLIST_RECEIPT_SECONDS_
      );
    }

    return jsonResponse({
      ok: true,
      kind: kind,
      added: added,
      duplicateReason: duplicateReason,
      message: added ? "保存しました" : "すでに登録されています"
    });
  } finally {
    writeLock.releaseLock();
  }
}

function handlePlaylistRequestStatus_(e, callback) {
  const requestId = String(
    e && e.parameter && e.parameter.requestId
      ? e.parameter.requestId
      : ""
  ).trim();

  if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
    return apiResponse({ ok: false, accepted: false, error: "受付番号が正しくありません" }, callback);
  }

  const accepted = CacheService.getScriptCache().get(
    PLAYLIST_RECEIPT_CACHE_PREFIX_ + requestId
  ) === "accepted";

  return apiResponse({ ok: true, accepted: accepted }, callback);
}
