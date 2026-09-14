// 太田匡彦プレイリスト既存項目の監査 dry-run v3
// 既存プレイリスト項目だけを読み、Show一覧は取得しない。
// Spotify・スプレッドシートへの書き込みは行わない。

function dryRunOtaMasahikoExistingPlaylistAuditV3() {
  const playlistId = "7jLXrZ0JUNOnsSeFEFbw9S";
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === playlistId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + playlistId);
  }

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 429回避のため、7つのShowを全件取得しない。
  // 既存プレイリストに入っている各episodeのメタデータだけで監査する。
  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);

  const items = playlistItems.map(function(playlistItem, index) {
    const playlistEpisode = playlistItem && playlistItem.item
      ? playlistItem.item
      : null;
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(
      playlistEpisode
    );

    return {
      position: index + 1,
      id: String(playlistEpisode && playlistEpisode.id ? playlistEpisode.id : ""),
      name: String(playlistEpisode && playlistEpisode.name ? playlistEpisode.name : ""),
      uri: String(playlistEpisode && playlistEpisode.uri ? playlistEpisode.uri : ""),
      releaseDate: String(
        playlistEpisode && playlistEpisode.release_date
          ? playlistEpisode.release_date
          : ""
      ),
      metadataSource: playlistEpisode ? "playlist_item" : "none",
      classification: classification.classification,
      reasons: classification.reasons,
      matchedField: classification.matchedField,
      matchedSection: classification.matchedSection,
      excerpt: classification.excerpt
    };
  });

  const counts = {
    confirmed: 0,
    false_positive: 0,
    review: 0,
    unresolved: 0
  };

  items.forEach(function(item) {
    if (Object.prototype.hasOwnProperty.call(counts, item.classification)) {
      counts[item.classification]++;
    }
  });

  Logger.log("=== EXISTING PLAYLIST AUDIT DRY RUN V3: " + rule.name + " ===");
  Logger.log("Show全件取得: スキップ（429回避）");
  Logger.log("既存プレイリスト項目数: " + playlistItems.length);
  Logger.log("confirmed: " + counts.confirmed);
  Logger.log("false_positive: " + counts.false_positive);
  Logger.log("review: " + counts.review);
  Logger.log("unresolved: " + counts.unresolved);

  items.forEach(function(item) {
    Logger.log(
      item.classification + " | " + item.releaseDate + " | " + item.name +
      " | " + item.uri + " | metadata=" + item.metadataSource +
      " | reasons=" + item.reasons.join(",") +
      (item.excerpt ? " | excerpt=" + item.excerpt : "")
    );
  });

  return {
    dryRun: true,
    audit: true,
    version: 3,
    name: rule.name,
    playlistId: playlistId,
    fetchedShowEpisodeCount: 0,
    playlistItemCount: playlistItems.length,
    counts: counts,
    items: items
  };
}
