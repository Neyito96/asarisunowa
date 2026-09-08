// ======================================================
// 朝リスの輪 API
// 朝リスト・おすすめPodcast 保存 / JSONP / 番組URL解析
// ======================================================

const SPREADSHEET_ID = "1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ";
const LOG_SHEET_NAME = "投稿受付";
const WORK_SHEET_NAME = "作業台";
const PUBLIC_SHEET_NAME = "サイト公開用";
const PODCAST_SHEET_NAME = "おすすめPodcast";

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const url = String(data.url || "").trim();
    const title = String(data.title || "").trim();
    const maker = String(data.maker || "").trim();
    const comment = String(data.comment || "").trim();
    const kind = String(data.kind || "playlist").trim();
    const securityAnswer = String(data.securityAnswer || "").trim();
    const website = String(data.website || "").trim();

    if (website) return jsonResponse({ ok: true });
    if (!url || !title || !maker) return jsonResponse({ ok: false, error: "必須項目が不足しています" });
    if (securityAnswer !== "大介") return jsonResponse({ ok: false, error: "合言葉が違います" });
    if (kind !== "playlist" && kind !== "podcast") return jsonResponse({ ok: false, error: "投稿の種類が正しくありません" });

    const isPlaylistUrl =
      /^https:\/\/open\.spotify\.com\/playlist\//i.test(url) ||
      /^https:\/\/music\.youtube\.com\/playlist\?/i.test(url);
    const isPodcastUrl =
      /^https:\/\/open\.spotify\.com\/show\//i.test(url) ||
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
      return jsonResponse({ ok: false, error: "朝リストにはSpotifyまたはYouTube MusicのプレイリストURLを入力してください" });
    }
    if (kind === "podcast" && !isPodcastUrl) {
      return jsonResponse({ ok: false, error: "Podcastの番組URLを確認してください" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);
    const workSheet = getSheetLoose(ss, WORK_SHEET_NAME);
    const podcastSheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
    if (!logSheet) throw new Error("投稿受付シートが見つかりません");
    if (!workSheet) throw new Error("作業台シートが見つかりません");
    if (!podcastSheet) throw new Error("おすすめPodcastシートが見つかりません");

    logSheet.appendRow([
      new Date(), url, title, maker,
      kind === "podcast" ? "おすすめPodcast" : "朝ポキプレイリスト",
      comment
    ]);

    const targetSheet = kind === "podcast" ? podcastSheet : workSheet;
    const lastRow = targetSheet.getLastRow();
    const existingUrls = lastRow > 1
      ? targetSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat().map(normalizeUrl)
      : [];
    const normalized = normalizeUrl(url);

    let added = false;
    if (!existingUrls.includes(normalized)) {
      if (kind === "podcast") {
        targetSheet.appendRow([url, title, maker, new Date(), comment]);
      } else {
        targetSheet.appendRow([url, title, maker]);
      }
      added = true;
    }

    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, kind: kind, added: added, message: added ? "保存しました" : "すでに登録されています" });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback ? String(e.parameter.callback) : "";
  try {
    if (callback && !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
      return jsonResponse({ ok: false, error: "callback名が正しくありません" });
    }

    const type = e && e.parameter && e.parameter.type ? String(e.parameter.type) : "status";

    if (type === "status") {
      return apiResponse({ ok: true, service: "asarisunowa-api", version: "2026.09.08-resolver" }, callback);
    }

    if (type === "resolve") {
      const url = e && e.parameter && e.parameter.url ? String(e.parameter.url).trim() : "";
      if (!url) return apiResponse({ ok: false, error: "URLを入力してください" }, callback);
      return apiResponse(resolvePodcastUrl(url), callback);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (type === "playlist") {
      const sheet = getSheetLoose(ss, PUBLIC_SHEET_NAME);
      if (!sheet) throw new Error("サイト公開用シートが見つかりません");
      return apiResponse(readPlaylistSheet(sheet), callback);
    }

    if (type === "podcast") {
      const sheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
      if (!sheet) throw new Error("おすすめPodcastシートが見つかりません");
      return apiResponse(readPodcastSheet(sheet), callback);
    }

    return apiResponse({ ok: false, error: "type は playlist / podcast / resolve を指定してください" }, callback);
  } catch (error) {
    return apiResponse({ ok: false, error: String(error && error.message ? error.message : error) }, callback);
  }
}

function resolvePodcastUrl(url) {
  try {
    const cleanUrl = String(url || "").trim();
    let title = "";
    let artwork = "";
    let provider = detectProvider(cleanUrl);

    // Spotify oEmbed
    if (/^https:\/\/open\.spotify\.com\//i.test(cleanUrl)) {
      const res = fetchJson("https://open.spotify.com/oembed?url=" + encodeURIComponent(cleanUrl));
      if (res) {
        title = String(res.title || "").trim();
        artwork = String(res.thumbnail_url || "").trim();
        provider = "Spotify";
      }
    }

    // Apple Podcasts / iTunes lookup
    if (!title && /^https:\/\/podcasts\.apple\.com\//i.test(cleanUrl)) {
      const m = cleanUrl.match(/\/id(\d+)/i);
      if (m) {
        const res = fetchJson("https://itunes.apple.com/lookup?id=" + encodeURIComponent(m[1]) + "&entity=podcast");
        const item = res && res.results && res.results[0];
        if (item) {
          title = String(item.collectionName || item.trackName || "").trim();
          artwork = String(item.artworkUrl600 || item.artworkUrl100 || "").trim();
          provider = "Apple Podcasts";
        }
      }
    }

    // YouTube oEmbed
    if (!title && (/youtube\.com/i.test(cleanUrl) || /youtu\.be/i.test(cleanUrl))) {
      const res = fetchJson("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(cleanUrl));
      if (res) {
        title = String(res.title || "").trim();
        artwork = String(res.thumbnail_url || "").trim();
        provider = "YouTube";
      }
    }

    // LISTEN / stand.fm / Amazon / Pocket Casts etc: read public page metadata.
    if (!title) {
      const html = fetchText(cleanUrl);
      if (html) {
        title = firstMeta(html, [
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
          /<title[^>]*>([\s\S]*?)<\/title>/i
        ]);
        artwork = firstMeta(html, [
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
          /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
        ]);
      }
    }

    title = cleanupTitle(decodeHtml(title));
    artwork = decodeHtml(artwork);

    if (!title) return { ok: false, error: "番組タイトルを自動取得できませんでした。手入力してください。", provider: provider };
    return { ok: true, title: title, artwork: artwork, provider: provider, url: cleanUrl };
  } catch (error) {
    return { ok: false, error: "番組情報を取得できませんでした。", detail: String(error && error.message ? error.message : error) };
  }
}

function readPlaylistSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, type: "playlist", count: 0, items: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  const items = values.filter(r => r[0] || r[1]).map((r, i) => ({
    id: String(i + 1), url: r[0] || "", title: r[1] || "", maker: r[2] || ""
  }));
  return { ok: true, type: "playlist", count: items.length, items: items };
}

function readPodcastSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, type: "podcast", count: 0, items: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
  const items = values.filter(r => r[0] || r[1]).map((r, i) => ({
    id: String(i + 1), url: r[0] || "", title: r[1] || "", maker: r[2] || "",
    receivedAt: r[3] || "", comment: r[4] || ""
  }));
  return { ok: true, type: "podcast", count: items.length, items: items };
}

function fetchJson(url) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (res.getResponseCode() < 200 || res.getResponseCode() >= 400) return null;
    return JSON.parse(res.getContentText());
  } catch (_) {
    return null;
  }
}

function fetchText(url) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (res.getResponseCode() < 200 || res.getResponseCode() >= 400) return "";
    return res.getContentText();
  } catch (_) {
    return "";
  }
}

function firstMeta(html, patterns) {
  for (let i = 0; i < patterns.length; i++) {
    const m = html.match(patterns[i]);
    if (m && m[1]) return String(m[1]).trim();
  }
  return "";
}

function cleanupTitle(title) {
  return String(title || "")
    .replace(/\s*[|｜]\s*(Spotify|Apple Podcasts?|LISTEN|stand\.fm|YouTube|Amazon Music).*$/i, "")
    .replace(/\s+-\s+(Spotify|Apple Podcasts?|LISTEN|stand\.fm).*$/i, "")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function detectProvider(url) {
  if (/spotify\.com/i.test(url)) return "Spotify";
  if (/podcasts\.apple\.com/i.test(url)) return "Apple Podcasts";
  if (/listen\.style/i.test(url)) return "LISTEN";
  if (/stand\.fm/i.test(url)) return "stand.fm";
  if (/amazon/i.test(url)) return "Amazon Music";
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/pca\.st|pocketcasts\.com/i.test(url)) return "Pocket Casts";
  return "";
}

function getSheetLoose(ss, wanted) {
  const exact = ss.getSheetByName(wanted);
  if (exact) return exact;
  const target = String(wanted || "").trim();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getName()).trim() === target) return sheets[i];
  }
  return null;
}

function normalizeUrl(url) {
  return String(url || "").trim().split("?")[0].replace(/\/+$/, "");
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function apiResponse(payload, callback) {
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse(payload);
}
