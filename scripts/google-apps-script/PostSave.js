// 通常投稿の保存処理

function savePost_(url, title, maker, introducedDate, comment, artwork, kind) {
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
        artwork
      );

      added = true;
    } else {
      duplicateReason = duplicate.duplicateReason;
    }

    SpreadsheetApp.flush();

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
