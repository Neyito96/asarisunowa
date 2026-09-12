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

function validatePostInputLengths_(values) {
  const limits = {
    url: 2048,
    title: 200,
    maker: 100,
    comment: 2000,
    introducedDate: 32,
    artwork: 2048,
    kind: 32,
    updateType: 100,
    inviteUrl: 2048,
    keywords: 500,
    ruleNote: 2000
  };

  const labels = {
    url: "URL",
    title: "タイトル",
    maker: "作成者",
    comment: "コメント",
    introducedDate: "紹介日",
    artwork: "画像URL",
    kind: "投稿種別",
    updateType: "更新方式",
    inviteUrl: "共同編集URL",
    keywords: "キーワード",
    ruleNote: "ルール"
  };

  for (const key in values) {
    if (
      Object.prototype.hasOwnProperty.call(values, key) &&
      limits[key] &&
      String(values[key] || "").length > limits[key]
    ) {
      return labels[key] + "が長すぎます";
    }
  }

  return "";
}

function withPostWriteLock_(fn) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    throw new Error("ただいま投稿が混み合っています。少し待って再度お試しください");
  }

  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

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
    
    const website = String(data.website || "").trim();

    if (website) return jsonResponse({ ok: true });

    const baseLengthError = validatePostInputLengths_({
      url: url,
      title: title,
      maker: maker,
      comment: comment,
      introducedDate: introducedDate,
      artwork: artwork,
      kind: kind
    });

    if (baseLengthError) {
      return jsonResponse({ ok: false, error: baseLengthError });
    }

    if (kind === "autoUpdateRequest") {
      const updateType = String(data.updateType || "").trim();
      const inviteUrl = String(data.inviteUrl || "").trim();
      const keywords = String(data.keywords || "").trim();
      const ruleNote = String(data.ruleNote || "").trim();

      const autoUpdateLengthError = validatePostInputLengths_({
        updateType: updateType,
        inviteUrl: inviteUrl,
        keywords: keywords,
        ruleNote: ruleNote
      });

      if (autoUpdateLengthError) {
        return jsonResponse({ ok: false, error: autoUpdateLengthError });
      }

      return withPostWriteLock_(function() {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);

        if (!logSheet) {
          throw new Error("投稿受付シートが見つかりません");
        }

        const memo = [
          "方式: " + updateType,
          "キーワード: " + keywords,
          "共同編集URL: " + inviteUrl,
          ruleNote ? "ルール: " + ruleNote : ""
        ].filter(Boolean).join("\n");

        logSheet.appendRow([
          new Date(),
          url,
          title,
          maker,
          "自動更新申請",
          memo
        ]);

        SpreadsheetApp.flush();

        return jsonResponse({
          ok: true,
          kind: "autoUpdateRequest",
          message: "自動更新申請を受け付けました"
        });
      });
    }

    if (!url || !title || !maker) return jsonResponse({ ok: false, error: "必須項目が不足しています" });

    if (!artwork && (kind === "podcast" || kind === "listenerPodcast")) {
      artwork = findPodcastArtworkByTitle(title);
    }

    if (kind !== "playlist" && kind !== "podcast" && kind !== "listenerPodcast") {
      return jsonResponse({ ok: false, error: "投稿の種類が正しくありません" });
    }

    const isPlaylistUrl =
      /^https:\/\/open\.spotify\.com\/playlist\//i.test(url) ||
      /^https:\/\/music\.youtube\.com\/playlist\?/i.test(url);

    const isPodcastUrl =
      /^https:\/\/open\.spotify\.com\/show\//i.test(url) ||
      /^https:\/\/open\.spotify\.com\/episode\//i.test(url) ||
      /^https:\/\/podcasts\.apple\.com\//i.test(url) ||
      /^https:\/\/music\.amazon\./i.test(url) ||
      /^https:\/\/www\.amazon\./i.test(url) ||
      /^https:\/\/listen\.style\//i.test(url) ||
      /^https:\/\/stand\.fm\//i.test(url) ||
      /^https:\/\/pca\.st\//i.test(url) ||
      /^https:\/\/pocketcasts\.com\//i.test(url) ||
      /^https:\/\/(www\.)?youtube\.com\//i.test(url) ||
      /^https:\/\/youtu\.be\//i.test(url);

    if (kind === "playlist" && !isPlaylistUrl) {
      return jsonResponse({
        ok: false,
        error: "朝リストにはSpotifyまたはYouTube MusicのプレイリストURLを入力してください"
      });
    }

    if ((kind === "podcast" || kind === "listenerPodcast") && !isPodcastUrl) {
      return jsonResponse({
        ok: false,
        error: "Podcastの番組URLを確認してください"
      });
    }

    return withPostWriteLock_(function() {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);
      const workSheet = getSheetLoose(ss, WORK_SHEET_NAME);
      const podcastSheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
      const listenerPodcastSheet = getSheetLoose(ss, LISTENER_PODCAST_SHEET_NAME);

      if (!logSheet) throw new Error("投稿受付シートが見つかりません");
      if (!workSheet) throw new Error("作業台シートが見つかりません");
      if (!podcastSheet) throw new Error("おすすめPodcastシートが見つかりません");
      if (!listenerPodcastSheet) throw new Error("朝リスPodcastシートが見つかりません");

      logSheet.appendRow([
        new Date(),
        url,
        title,
        maker,
        kind === "listenerPodcast"
          ? "朝リスPodcast"
          : kind === "podcast"
          ? "おすすめPodcast"
          : "朝ポキプレイリスト",
        comment
      ]);

      const targetSheet =
        kind === "listenerPodcast"
          ? listenerPodcastSheet
          : kind === "podcast"
          ? podcastSheet
          : workSheet;

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

      const normalized = normalizeUrl(url);
      const normalizedTitle = normalizeTitle(title);

      const duplicateByUrl = existingRows.some(function(row) {
        return normalizeUrl(row[0]) === normalized;
      });

      const duplicateByTitle =
        kind === "podcast" || kind === "listenerPodcast"
          ? existingRows.some(function(row) {
              return normalizeTitle(row[1]) === normalizedTitle;
            })
          : false;

      let added = false;
      let duplicateReason = "";

      if (!duplicateByUrl && !duplicateByTitle) {
        if (kind === "listenerPodcast") {
          const provider = detectProvider(url);
          targetSheet.appendRow([
            url,
            title,
            maker,
            introducedDate || "",
            comment,
            provider === "Spotify" ? url : "",
            provider === "Apple Podcasts" ? url : "",
            provider === "LISTEN" ? url : "",
            provider === "stand.fm" ? url : "",
            provider === "Amazon Music" ? url : "",
            provider === "YouTube" ? url : "",
            provider && provider !== "Spotify" && provider !== "Apple Podcasts" &&
              provider !== "LISTEN" && provider !== "stand.fm" &&
              provider !== "Amazon Music" && provider !== "YouTube" ? url : "",
            artwork || ""
          ]);
        } else if (kind === "podcast") {
          targetSheet.appendRow([
            url,
            title,
            maker,
            new Date(),
            comment,
            artwork || ""
          ]);
        } else {
          targetSheet.appendRow([
            url,
            title,
            maker
          ]);
        }

        added = true;
      } else {
        duplicateReason = duplicateByTitle ? "title" : "url";
      }

      SpreadsheetApp.flush();

      return jsonResponse({
        ok: true,
        kind: kind,
        added: added,
        duplicateReason: duplicateReason,
        message: added ? "保存しました" : "すでに登録されています"
      });
    });

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

function fetchJson(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return null;
    }

    return JSON.parse(
      res.getContentText()
    );

  } catch (_) {
    return null;
  }
}

function fetchText(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return "";
    }

    return res.getContentText();

  } catch (_) {
    return "";
  }
}
