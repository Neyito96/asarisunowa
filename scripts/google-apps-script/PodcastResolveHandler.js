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
    return apiResponse({ ok: false, error: "URLを入力してください" }, callback);
  }

  if (kind !== "podcast" && kind !== "listenerPodcast") {
    return apiResponse({
      ok: false,
      error: "kind は podcast / listenerPodcast を指定してください"
    }, callback);
  }

  const ssForResolve = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targetSheetName = kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME;
  const targetSheet = getSheetLoose(ssForResolve, targetSheetName);

  if (kind === "listenerPodcast" && targetSheet) {
    // A列だけでなく、Spotify / Apple / LISTEN / stand.fm / Amazon / YouTube / 公式サイトも照合する。
    const knownPlatform = findListenerPodcastDuplicateByAnyUrlInSheet_(targetSheet, [url]);
    if (knownPlatform) {
      return apiResponse({
        ok: true,
        title: knownPlatform.title,
        maker: knownPlatform.maker || "",
        artwork: "",
        provider: detectProvider(url),
        duplicate: true,
        duplicateId: knownPlatform.id,
        duplicateReason: "platform_url",
        duplicateTitle: knownPlatform.title,
        duplicateMaker: knownPlatform.maker || "",
        url: url
      }, callback);
    }
  }

  const known = targetSheet ? findPodcastDuplicate(targetSheet, url, "") : null;
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

  const resolved = resolvePodcastUrl(url);

  if (resolved && resolved.ok && targetSheet) {
    if (kind === "listenerPodcast") {
      // まず、入力URLから確認できる他配信先も含めて既存行と照合する。
      let discovered = null;
      try {
        discovered = resolveListenerPodcastPlatforms_(
          resolved.title || "",
          resolved.maker || resolved.author || resolved.publisher || "",
          url
        );
      } catch (_) {
        discovered = null;
      }

      const platformDuplicate = findListenerPodcastDuplicateByAnyUrlInSheet_(
        targetSheet,
        [url].concat(podcastPlatformUrlsFromResolved_(discovered))
      );

      const identityDuplicate = platformDuplicate
        ? null
        : findListenerPodcastDuplicateByIdentityInSheet_(targetSheet, resolved);
      const duplicate = platformDuplicate || identityDuplicate;

      if (duplicate) {
        resolved.duplicate = true;
        resolved.duplicateId = duplicate.id;
        resolved.duplicateReason = platformDuplicate ? "platform_url" : "identity";
        resolved.duplicateTitle = duplicate.title;
        resolved.duplicateMaker = duplicate.maker || "";
      } else {
        resolved.duplicate = false;
      }
    } else {
      const duplicate = findPodcastDuplicate(targetSheet, url, resolved.title || "");
      if (duplicate) {
        resolved.duplicate = true;
        resolved.duplicateId = duplicate.id;
        resolved.duplicateReason = duplicate.titleMatch ? "title" : "url";
      } else {
        resolved.duplicate = false;
      }
    }
  }

  if (resolved && resolved.ok) resolved.url = url;
  return apiResponse(resolved, callback);
}
