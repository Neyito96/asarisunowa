// 通常投稿のシート取得・受付ログ

function getPostSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);
  const workSheet = getSheetLoose(ss, WORK_SHEET_NAME);
  const podcastSheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
  const listenerPodcastSheet = getSheetLoose(ss, LISTENER_PODCAST_SHEET_NAME);

  if (!logSheet) throw new Error("投稿受付シートが見つかりません");
  if (!workSheet) throw new Error("作業台シートが見つかりません");
  if (!podcastSheet) throw new Error("おすすめPodcastシートが見つかりません");
  if (!listenerPodcastSheet) throw new Error("朝リスPodcastシートが見つかりません");

  return {
    logSheet: logSheet,
    workSheet: workSheet,
    podcastSheet: podcastSheet,
    listenerPodcastSheet: listenerPodcastSheet
  };
}

function appendPostLog_(logSheet, url, title, maker, kind, comment) {
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
}
