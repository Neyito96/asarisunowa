// ======================================================
// 朝リスの輪 API
// 朝リスト・おすすめPodcast 保存 / JSONP / 番組URL解析
// ======================================================

const SPREADSHEET_ID = "1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ";
const LOG_SHEET_NAME = "投稿受付";
const WORK_SHEET_NAME = "作業台　 ";
const PUBLIC_SHEET_NAME = "サイト公開用";
const PODCAST_SHEET_NAME = "おすすめPodcast";
const LISTENER_PODCAST_SHEET_NAME = "朝リスPodcast";
const SUBMIT_SECURITY_ANSWER = "大介";

function doPost(e) {
  try {
    const input = parsePostInput_(e);
    const data = input.data;
    const url = input.url;
    const title = input.title;
    const maker = input.maker;
    const host = input.host;
    const rss = input.rss;
    const inviteUrl = input.inviteUrl;
    const comment = input.comment;
    const introducedDate = input.introducedDate;
    let artwork = input.artwork;
    const kind = input.kind;
    const securityAnswer = input.securityAnswer;
    const website = input.website;
    const shelf = input.shelf;
    const autoGrow = { show: input.autoShow, keyword: input.autoKeyword };
    let requestId = String(data.requestId || "").trim();

    if (website) return jsonResponse({ ok: true });

    const baseLengthError = validatePostInputLengths_({
      url: url,
      title: title,
      maker: maker,
      host: host,
      rss: rss,
      comment: comment,
      introducedDate: introducedDate,
      artwork: artwork,
      kind: kind,
      securityAnswer: securityAnswer
    });

    if (baseLengthError) {
      return jsonResponse({ ok: false, error: baseLengthError });
    }

    if (kind === "autoUpdateRequest") {
      return handleAutoUpdateRequest_(
        data,
        url,
        title,
        maker,
        securityAnswer
      );
    }

    const basicError = validatePostBasic_(url, title, maker, securityAnswer);

    if (basicError) {
      return jsonResponse({ ok: false, error: basicError });
    }

    if (kind !== "podcast" && kind !== "listenerPodcast") {
      artwork = resolvePostArtwork_(artwork, kind, title);
    }

    const kindError = validatePostKind_(kind);

    if (kindError) {
      return jsonResponse({ ok: false, error: kindError });
    }

    const targetUrlError = validatePostTargetUrl_(kind, url);

    if (targetUrlError) {
      return jsonResponse({
        ok: false,
        error: targetUrlError
      });
    }

    if (kind === "podcast" || kind === "listenerPodcast") {
      if (!requestId) {
        requestId = "legacy_" + Utilities.getUuid().replace(/-/g, "");
        // Legacy clients have no receipt protocol: queue failure must not reject their post.
        try { beginPodcastReceipt_(requestId, kind, url, title); }
        catch (_) { Logger.log("Legacy podcast queue deferred; common blank-cell sweep will retry."); }
      } else {
        beginPodcastReceipt_(requestId, kind, url, title);
      }
    }

    const saved = savePost_(
      url,
      title,
      maker,
      host,
      rss,
      introducedDate,
      comment,
      artwork,
      kind,
      inviteUrl,
      requestId,
      shelf,
      autoGrow
    );
    // 自動育成が指定されたプレイリストは、投稿直後にその1件だけすぐ育てる（失敗しても投稿は成功のまま・毎時でも再試行）
    if (kind === "playlist" && autoGrow.show && typeof libraryPlaylistSyncByUrl_ === "function") {
      try { libraryPlaylistSyncByUrl_(url); } catch (growError) {}
    }
    return saved;

  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function doGet(e) {

  if (e && e.parameter && e.parameter.code) {
    return handleSpotifyUserOAuthCallback_(e);
  }

  if (e && e.parameter && e.parameter.error) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証がキャンセルされました</h2>"
    );
  }

  const callback =
    e && e.parameter && e.parameter.callback
      ? String(e.parameter.callback)
      : "";

  try {
    if (!isValidJsonpCallback_(callback)) {
      return jsonResponse({
        ok: false,
        error: "callback名が正しくありません"
      });
    }

    const type =
      e && e.parameter && e.parameter.type
        ? String(e.parameter.type)
        : "status";

    if (type === "status") {
      return apiResponse({
        ok: true,
        service: "asarisunowa-api",
        version: "2026.09.08-resolve12-artwork-persist"
      }, callback);
    }

    if (type === "resolve") {
      return handlePodcastResolve_(e, callback);
    }

    // ポす神回・ポすすめ返し（#312/#315）。Posukami.gs
    if (type === "posukamiSubmit") {
      return handlePosukamiSubmit_(e, callback);
    }

    // 蔵の「わたしの蔵書」をテーマへの推薦として受け付ける（#345）。ShelfSubmit.js・別タブ「蔵書推薦・受付」
    if (type === "shelfSubmit") {
      return handleShelfSubmit_(e, callback);
    }
    if (type === "posukamiPublic") {
      return handlePosukamiPublic_(e, callback);
    }

    if (type === "autoUpdateRequestStatus") {
      return handleAutoUpdateRequestStatus_(e, callback);
    }

    if (type === "podcastRequestStatus") {
      return handlePodcastRequestStatus_(e, callback);
    }

    if (type === "playlistRequestStatus") {
      return handlePlaylistRequestStatus_(e, callback);
    }

    if (type === "playlistResolve") {
      return handlePlaylistResolve_(e, callback);
    }

    const readResponse = handleApiRead_(type, callback);

    if (readResponse) {
      return readResponse;
    }

    return apiResponse({
      ok: false,
      error:
        "type は playlist / podcast / listenerPodcast / resolve を指定してください"
    }, callback);

  } catch (error) {
    return apiResponse({
      ok: false,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    }, callback);
  }
}
