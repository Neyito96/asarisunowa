// 通常投稿の保存先選択・行追加

function getPostTargetSheet_(kind, workSheet, podcastSheet, listenerPodcastSheet) {
  return kind === "listenerPodcast"
    ? listenerPodcastSheet
    : kind === "podcast"
    ? podcastSheet
    : workSheet;
}

function appendPostRow_(targetSheet, kind, url, title, maker, host, rss, introducedDate, comment, artwork, inviteUrl) {
  if (kind === "listenerPodcast") {
    // 投稿された1本のURLを起点に、既存の安全な補完処理を使って
    // 確認できた配信先だけ保存する。補完に失敗しても投稿自体は継続する。
    let platforms = null;
    try {
      platforms = resolveListenerPodcastPlatforms_(title, maker, url, rss);
    } catch (_) {
      platforms = null;
    }

    const resolved = platforms || {
      spotify: "",
      apple: "",
      listen: "",
      standfm: "",
      amazon: "",
      youtube: "",
      website: "",
      artwork: "",
      rss: "",
      pocketcasts: "",
      pody: "",
      genre: ""
    };

    // 入力URLは必ず既知URLとして反映する。
    applyKnownPodcastUrl_(resolved, url);

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
    let platforms = null;
    try {
      platforms = resolveListenerPodcastPlatforms_(title, host, url, rss);
    } catch (_) {
      platforms = null;
    }

    const resolved = platforms || {
      youtube: "",
      spotify: "",
      amazon: "",
      apple: "",
      pocketcasts: "",
      listen: "",
      standfm: "",
      pody: "",
      website: "",
      artwork: "",
      rss: "",
      genre: ""
    };

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
}
