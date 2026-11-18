// 通常投稿の保存処理

const PLAYLIST_RECEIPT_CACHE_PREFIX_ = "PLAYLIST_RECEIPT_";
const PLAYLIST_RECEIPT_SECONDS_ = 600;

function savePost_(url, title, maker, host, rss, introducedDate, comment, artwork, kind, inviteUrl, requestId, shelf) {
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
        host,
        rss,
        introducedDate,
        comment,
        artwork,
        inviteUrl,
        shelf
      );

      added = true;
    } else {
      duplicateReason = duplicate.duplicateReason;
    }

    SpreadsheetApp.flush();

    // Receipt failures cannot turn a committed row into a failed submission.
    if (kind === "podcast" || kind === "listenerPodcast") {
      try { completePodcastReceipt_(requestId, added, duplicateReason); }
      catch (_) { Logger.log("Podcast receipt completion deferred; status checks the saved row."); }
    }

    // 新規保存された通常投稿のみ管理者へ通知する。
    // メール送信に失敗しても、保存済み投稿そのものは失敗扱いにしない。
    if (added) {
      try {
        notifyPostReceived_({
          kind: kind,
          title: title,
          maker: maker,
          host: host,
          rss: rss,
          url: url,
          comment: comment
        });
      } catch (notificationError) {
        Logger.log(
          "通常投稿の管理者メール通知に失敗しました: " +
          String(notificationError)
        );
      }
    }

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
