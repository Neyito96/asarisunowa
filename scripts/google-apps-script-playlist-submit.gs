// 朝リスの輪：プレイリスト投稿受付
// このコードを Google Apps Script に貼り付け、ウェブアプリとして公開してください。
// 実行ユーザー：自分 / アクセスできるユーザー：全員

const SPREADSHEET_ID = "1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ";
const SHEET_NAME = "投稿受付";
const PUBLIC_SHEET_NAME = "サイト公開用";
const PODCAST_SHEET_NAME = "おすすめPodcast";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const url = String(data.url || "").trim();
    const title = String(data.title || "").trim();
    const maker = String(data.maker || "").trim();
    const website = String(data.website || "").trim();
    const kind = String(data.kind || "playlist").trim();
    const securityAnswer = String(data.securityAnswer || "").trim();

    // bot向けハニーポット
    if (website) {
      return jsonResponse({ ok: true });
    }

    if (!url || !title || !maker) {
      return jsonResponse({ ok: false, error: "必須項目が不足しています" });
    }

    // 朝リス向けの簡単なロボット対策
    if (securityAnswer !== "大介") {
      return jsonResponse({ ok: false, error: "合言葉が違います" });
    }

    const isPlaylistUrl =
      /^https:\/\/open\.spotify\.com\/playlist\//i.test(url) ||
      /^https:\/\/music\.youtube\.com\/playlist\?/i.test(url);
    const isPodcastUrl =
      /^https:\/\/open\.spotify\.com\/show\//i.test(url) ||
      /^https:\/\/podcasts\.apple\.com\//i.test(url) ||
      /^https:\/\/music\.amazon\./i.test(url);

    if ((kind === "playlist" && !isPlaylistUrl) || (kind === "podcast" && !isPodcastUrl)) {
      return jsonResponse({ ok: false, error: "投稿の種類とURLを確認してください" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const publicSheet = ss.getSheetByName(PUBLIC_SHEET_NAME);
    const podcastSheet = ss.getSheetByName(PODCAST_SHEET_NAME);
    if (!sheet) throw new Error("投稿受付シートが見つかりません");
    if (!publicSheet) throw new Error("サイト公開用シートが見つかりません");
    if (!podcastSheet) throw new Error("おすすめPodcastシートが見つかりません");

    // 受付記録を残す
    sheet.appendRow([
      new Date(),
      url,
      title,
      maker,
      kind === "podcast" ? "おすすめPodcast" : "朝ポキプレイリスト",
      ""
    ]);

    const targetSheet = kind === "podcast" ? podcastSheet : publicSheet;
    const lastRow = targetSheet.getLastRow();
    const existing = lastRow > 1
      ? targetSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat()
      : [];
    if (!existing.includes(url)) {
      if (kind === "podcast") {
        targetSheet.appendRow([url, title, maker, new Date()]);
      } else {
        targetSheet.appendRow([url, title, maker]);
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: "asarisunowa-playlist-submit" });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
