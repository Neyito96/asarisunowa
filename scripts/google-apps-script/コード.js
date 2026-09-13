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
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
   
    const url = String(data.url || "").trim();
    const title = String(data.title || "").trim();
    const maker = String(data.maker || "").trim();
    const comment = String(data.comment || "").trim();
    const introducedDate = String(data.introducedDate || "").trim();
    let artwork = String(data.artwork || "").trim();
    const kind = String(data.kind || "playlist").trim();
    const securityAnswer = String(data.securityAnswer || "").trim();
    
    const website = String(data.website || "").trim();

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

    if (securityAnswer !== SUBMIT_SECURITY_ANSWER) {
      return jsonResponse({
        ok: false,
        error: "セキュリティ回答が正しくありません"
      });
    }

    if (!url || !title || !maker) return jsonResponse({ ok: false, error: "必須項目が不足しています" });

    if (!artwork && (kind === "podcast" || kind === "listenerPodcast")) {
      artwork = findPodcastArtworkByTitle(title);
    }

    if (kind !== "playlist" && kind !== "podcast" && kind !== "listenerPodcast") {
      return jsonResponse({ ok: false, error: "投稿の種類が正しくありません" });
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
    if (callback && !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
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

    const ss =
      SpreadsheetApp.openById(SPREADSHEET_ID);

    if (type === "playlist") {
      const sheet =
        getSheetLoose(ss, PUBLIC_SHEET_NAME);

      if (!sheet) {
        throw new Error("サイト公開用シートが見つかりません");
      }

      return apiResponse(
        readPlaylistSheet(sheet),
        callback
      );
    }

    if (type === "listenerPodcast") {
      const sheet =
        getSheetLoose(
          ss,
          LISTENER_PODCAST_SHEET_NAME
        );

      if (!sheet) {
        throw new Error("朝リスPodcastシートが見つかりません");
      }

      return apiResponse(
        readListenerPodcastSheet(sheet),
        callback
      );
    }

    if (type === "podcast") {
      const sheet =
        getSheetLoose(
          ss,
          PODCAST_SHEET_NAME
        );

      if (!sheet) {
        throw new Error("おすすめPodcastシートが見つかりません");
      }

      return apiResponse(
        readPodcastSheet(sheet),
        callback
      );
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
