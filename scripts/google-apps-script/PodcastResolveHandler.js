// Podcast resolve API handler

function handlePodcastResolve_(e, callback) {
  const url =
    e && e.parameter && e.parameter.url
      ? String(e.parameter.url).trim()
      : "";

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

  return apiResponse(resolved, callback);
}
