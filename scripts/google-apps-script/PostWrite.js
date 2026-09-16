// 通常投稿の保存先選択・行追加

function getPostTargetSheet_(kind, workSheet, podcastSheet, listenerPodcastSheet) {
  return kind === "listenerPodcast"
    ? listenerPodcastSheet
    : kind === "podcast"
    ? podcastSheet
    : workSheet;
}

function appendPostRow_(targetSheet, kind, url, title, maker, introducedDate, comment, artwork, inviteUrl) {
  if (kind === "listenerPodcast") {
    // 投稿された1本のURLを起点に、既存の安全な補完処理を使って
    // 確認できた配信先だけ保存する。補完に失敗しても投稿自体は継続する。
    let platforms = null;
    try {
      platforms = resolveListenerPodcastPlatforms_(title, maker, url);
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
      artwork: ""
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
      resolved.artwork || artwork || ""
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

  // プレイリストはH列に登録日を保存する。
  // F列（最終更新日）とG列（更新日取得方法）は既存用途のまま保持する。
  const row = targetSheet.getLastRow() + 1;
  targetSheet.getRange(row, 1, 1, 4).setValues([[
    url,
    title,
    maker,
    inviteUrl || ""
  ]]);
  targetSheet.getRange(row, 8).setValue(new Date());
}
