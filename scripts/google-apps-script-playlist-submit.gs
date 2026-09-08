// 朝リスの輪：プレイリスト投稿受付
// このコードを Google Apps Script に貼り付け、ウェブアプリとして公開してください。
// 実行ユーザー：自分 / アクセスできるユーザー：全員

const SPREADSHEET_ID = "1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ";
const SHEET_NAME = "投稿受付";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const url = String(data.url || "").trim();
    const title = String(data.title || "").trim();
    const maker = String(data.maker || "").trim();
    const website = String(data.website || "").trim();

    // bot向けハニーポット
    if (website) {
      return jsonResponse({ ok: true });
    }

    if (!url || !title || !maker) {
      return jsonResponse({ ok: false, error: "必須項目が不足しています" });
    }

    const isAllowed =
      /^https:\/\/open\.spotify\.com\/playlist\//i.test(url) ||
      /^https:\/\/music\.youtube\.com\/playlist\?/i.test(url);

    if (!isAllowed) {
      return jsonResponse({ ok: false, error: "Spotify または YouTube Music のプレイリストURLを入力してください" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("投稿受付シートが見つかりません");

    sheet.appendRow([
      new Date(),
      url,
      title,
      maker,
      "未確認",
      ""
    ]);

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
