// 通常投稿の保存先選択・行追加

function getPostTargetSheet_(kind, workSheet, podcastSheet, listenerPodcastSheet) {
  return kind === "listenerPodcast"
    ? listenerPodcastSheet
    : kind === "podcast"
    ? podcastSheet
    : workSheet;
}

function appendPostRow_(targetSheet, kind, url, title, maker, host, rss, introducedDate, comment, artwork, inviteUrl, shelf) {
  if (kind === "listenerPodcast") {
    ensurePodcastMetadataHeaders_(targetSheet, kind);
    // Persist submitted/known information only; no external lookup on the save path.
    const resolved = {};
    applyKnownPodcastUrl_(resolved, url);
    // Pody URLs are verified asynchronously, even when submitted as the primary URL.
    resolved.pody = "";

    targetSheet.appendRow([
      url,
      title,
      maker,
      introducedDate || "",
      comment,
      resolved.spotify || "",
      resolved.apple || "",
      resolved.listen || "",
      resolved.standfm || "",
      resolved.amazon || "",
      resolved.youtube || "",
      resolved.website || "",
      resolved.artwork || artwork || "",
      resolved.rss || rss || "",
      resolved.pocketcasts || "",
      resolved.pody || "",
      resolved.genre || ""
    ]);
    return;
  }

  if (kind === "podcast") {
    ensurePodcastMetadataHeaders_(targetSheet, kind);
    const resolved = {};
    applyKnownPodcastUrl_(resolved, url);
    resolved.pody = "";

    targetSheet.appendRow([
      url,
      title,
      maker,
      new Date(),
      comment,
      resolved.artwork || artwork || "",
      host || "",
      resolved.rss || rss || "",
      resolved.youtube || "",
      resolved.spotify || "",
      resolved.amazon || "",
      resolved.apple || "",
      resolved.pocketcasts || "",
      resolved.listen || "",
      resolved.standfm || "",
      resolved.pody || "",
      resolved.website || "",
      resolved.genre || ""
    ]);
    return;
  }

  // プレイリストはD列に共同編集URL、G列に取得待ち状態、H列に登録日を保存する。
  // Spotify取得に成功したら PlaylistDates.js がF列を書き、G列をAUTOへ進める。
  const row = targetSheet.getLastRow() + 1;
  targetSheet.getRange(row, 1, 1, 4).setValues([[
    url,
    title,
    maker,
    inviteUrl || ""
  ]]);
  targetSheet.getRange(row, 7).setValue("要確認");
  targetSheet.getRange(row, 8).setValue(new Date());
  // I列＝掲載先（連載／朝リスト）。投稿で選ばれた時だけ書く。管理人は作業台のI列を直せば掲載先を変えられる。
  const shelfLabel = normalizePlaylistShelf_(shelf);
  if (shelfLabel) targetSheet.getRange(row, 9).setValue(shelfLabel);
}


function ensurePodcastMetadataHeaders_(sheet, kind) {
  if (!sheet) return;

  if (kind === "podcast") {
    const headers = [
      "配信者 / Host",
      "RSS",
      "YouTube",
      "Spotify",
      "Amazon Music",
      "Apple Podcasts",
      "Pocket Casts",
      "LISTEN",
      "stand.fm",
      "Pody",
      "番組HP",
      "ジャンル"
    ];
    const range = sheet.getRange(1, 7, 1, headers.length);
    const current = range.getDisplayValues()[0];
    const next = current.slice();
    let changed = false;
    for (let i = 0; i < headers.length; i++) {
      if (!String(next[i] || "").trim()) {
        next[i] = headers[i];
        changed = true;
      }
    }
    if (changed) range.setValues([next]);
    return;
  }

  if (kind === "listenerPodcast") {
    const headers = ["RSS", "Pocket Casts", "Pody", "ジャンル"];
    const range = sheet.getRange(1, 14, 1, headers.length);
    const current = range.getDisplayValues()[0];
    const next = current.slice();
    let changed = false;
    for (let i = 0; i < headers.length; i++) {
      if (!String(next[i] || "").trim()) {
        next[i] = headers[i];
        changed = true;
      }
    }
    if (changed) range.setValues([next]);
  }
}
