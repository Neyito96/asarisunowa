// 通常投稿の保存先選択・行追加

function getPostTargetSheet_(kind, workSheet, podcastSheet, listenerPodcastSheet) {
  return kind === "listenerPodcast"
    ? listenerPodcastSheet
    : kind === "podcast"
    ? podcastSheet
    : workSheet;
}

function appendPostRow_(targetSheet, kind, url, title, maker, introducedDate, comment, artwork) {
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
    return;
  }

  if (kind === "podcast") {
    targetSheet.appendRow([
      url,
      title,
      maker,
      new Date(),
      comment,
      artwork || ""
    ]);
    return;
  }

  targetSheet.appendRow([
    url,
    title,
    maker
  ]);
}
