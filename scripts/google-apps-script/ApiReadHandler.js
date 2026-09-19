// API読み取り処理

function handleApiRead_(type, callback) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (type === "playlist") {
    const sheet = getSheetLoose(ss, PUBLIC_SHEET_NAME);

    if (!sheet) {
      throw new Error("サイト公開用シートが見つかりません");
    }

    return apiResponse(readPlaylistSheet(sheet), callback);
  }

  if (type === "listenerPodcast") {
    const sheet = getSheetLoose(ss, LISTENER_PODCAST_SHEET_NAME);

    if (!sheet) {
      throw new Error("朝リスPodcastシートが見つかりません");
    }

    return apiResponse(readListenerPodcastSheet(sheet), callback);
  }

  if (type === "podcast") {
    const sheet = getSheetLoose(ss, PODCAST_SHEET_NAME);

    if (!sheet) {
      throw new Error("おすすめPodcastシートが見つかりません");
    }

    return apiResponse(readPodcastSheet(sheet), callback);
  }

  return null;
}
