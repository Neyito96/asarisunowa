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
    const comment = input.comment;
    const introducedDate = input.introducedDate;
    let artwork = input.artwork;
    const kind = input.kind;
    const securityAnswer = input.securityAnswer;
    const website = input.website;

    if (website) return jsonResponse({ ok: true });

    const baseLengthError = validatePostInputLengths_({
      url: url,
      title: title,
      maker: maker,
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

    artwork = resolvePostArtwork_(artwork, kind, title);

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

    return savePost_(
      url,
      title,
      maker,
      introducedDate,
      comment,
      artwork,
      kind
    );

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
