// Podcast resolve API handler

function handlePodcastResolve_(e, callback) {
  const rawUrl =
    e && e.parameter && e.parameter.url
      ? String(e.parameter.url).trim()
      : "";

  const url = normalizePodcastInputUrl(rawUrl);

  const kind =
    e && e.parameter && e.parameter.kind
      ? String(e.parameter.kind).trim()
      : "listenerPodcast";

  if (!url) {
    return apiResponse({
      ok: false,
      error: "URLを入力してください"
    }, callback);
  }

  if (kind !== "podcast" && kind !== "listenerPodcast") {
    return apiResponse({
      ok: false,
      error: "kind は podcast / listenerPodcast を指定してください"
    }, callback);
  }

  const ssForResolve =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  const targetSheetName =
    kind === "podcast"
      ? PODCAST_SHEET_NAME
      : LISTENER_PODCAST_SHEET_NAME;

  const targetSheet =
    getSheetLoose(ssForResolve, targetSheetName);

  const known =
    targetSheet
      ? findPodcastDuplicate(targetSheet, url, "")
      : null;

  if (known && known.urlMatch) {
    return apiResponse({
      ok: true,
      title: known.title,
      maker: known.maker || "",
      artwork: "",
      provider: detectProvider(url),
      duplicate: true,
      duplicateId: known.id,
      duplicateReason: "url",
      url: url
    }, callback);
  }

  const resolved =
    resolvePodcastUrl(url);

  if (resolved && resolved.ok && targetSheet) {
    if (kind === "listenerPodcast") {
      // ポ薦めは、別プラットフォームのURLでも
      // 番組タイトル＋配信者を使って同一番組を判定する。
      const identityDuplicate =
        findListenerPodcastDuplicateByIdentityInSheet_(targetSheet, resolved);

      if (identityDuplicate) {
        resolved.duplicate = true;
        resolved.duplicateId = identityDuplicate.id;
        resolved.duplicateReason = "identity";
        resolved.duplicateTitle = identityDuplicate.title;
        resolved.duplicateMaker = identityDuplicate.maker || "";
      } else {
        resolved.duplicate = false;
      }
    } else {
      // 従来のおすすめPodcastは既存挙動を変えない。
      const duplicate =
        findPodcastDuplicate(
          targetSheet,
          url,
          resolved.title || ""
        );

      if (duplicate) {
        resolved.duplicate = true;
        resolved.duplicateId = duplicate.id;
        resolved.duplicateReason =
          duplicate.titleMatch ? "title" : "url";
      } else {
        resolved.duplicate = false;
      }
    }
  }

  if (resolved && resolved.ok) {
    resolved.url = url;
  }

  return apiResponse(resolved, callback);
}
