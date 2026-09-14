// 太田匡彦プレイリスト既存項目の監査 dry-run v4
// プレイリスト内のepisode IDだけをSpotifyから最大50件ずつ取得し、
// Show全件取得を避けつつdescriptionを使って再判定する。
// Spotify・スプレッドシートへの書き込みは行わない。

function dryRunOtaMasahikoExistingPlaylistAuditV4() {
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

  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  const episodeIds = [];
  const seenIds = {};

  playlistItems.forEach(function(playlistItem) {
    const episode = playlistItem && playlistItem.item ? playlistItem.item : null;
    const id = String(episode && episode.id ? episode.id : "").trim();
    if (id && !seenIds[id]) {
      seenIds[id] = true;
      episodeIds.push(id);
    }
  });

  const detailedById = fetchOtaMasahikoEpisodeDetailsInBatchesV4_(episodeIds, token);

  const items = playlistItems.map(function(playlistItem, index) {
    const playlistEpisode = playlistItem && playlistItem.item
      ? playlistItem.item
      : null;
    const id = String(playlistEpisode && playlistEpisode.id ? playlistEpisode.id : "").trim();
    const detailedEpisode = id && detailedById[id]
      ? detailedById[id]
      : playlistEpisode;
    const metadataSource = id && detailedById[id]
      ? "episode_detail_batch"
      : playlistEpisode
      ? "playlist_item_fallback"
      : "none";

    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(
      detailedEpisode
    );

    return {
      position: index + 1,
      id: String(detailedEpisode && detailedEpisode.id ? detailedEpisode.id : id),
      name: String(
        detailedEpisode && detailedEpisode.name
          ? detailedEpisode.name
          : playlistEpisode && playlistEpisode.name
          ? playlistEpisode.name
          : ""
      ),
      uri: String(
        playlistEpisode && playlistEpisode.uri
          ? playlistEpisode.uri
          : detailedEpisode && detailedEpisode.uri
          ? detailedEpisode.uri
          : ""
      ),
      releaseDate: String(
        detailedEpisode && detailedEpisode.release_date
          ? detailedEpisode.release_date
          : playlistEpisode && playlistEpisode.release_date
          ? playlistEpisode.release_date
          : ""
      ),
      metadataSource: metadataSource,
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

  Logger.log("=== EXISTING PLAYLIST AUDIT DRY RUN V4: " + rule.name + " ===");
  Logger.log("Show全件取得: スキップ（429回避）");
  Logger.log("既存プレイリスト項目数: " + playlistItems.length);
  Logger.log("ユニークepisode ID数: " + episodeIds.length);
  Logger.log("詳細取得成功数: " + Object.keys(detailedById).length);
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
    version: 4,
    name: rule.name,
    playlistId: playlistId,
    playlistItemCount: playlistItems.length,
    uniqueEpisodeIdCount: episodeIds.length,
    fetchedEpisodeDetailCount: Object.keys(detailedById).length,
    counts: counts,
    items: items
  };
}

function fetchOtaMasahikoEpisodeDetailsInBatchesV4_(episodeIds, token) {
  const ids = Array.isArray(episodeIds) ? episodeIds.slice() : [];
  const byId = {};
  const batchSize = 50;

  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    if (!batch.length) continue;

    const url =
      "https://api.spotify.com/v1/episodes?ids=" +
      encodeURIComponent(batch.join(",")) +
      "&market=JP";

    const response = fetchSpotifyReadWithRetry_(
      url,
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Episode details batch " + (Math.floor(start / batchSize) + 1)
    );

    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error(
        "Spotify episode詳細取得に失敗しました: status=" +
        status +
        " | " +
        response.getContentText()
      );
    }

    const data = JSON.parse(response.getContentText());
    const episodes = Array.isArray(data.episodes) ? data.episodes : [];

    episodes.forEach(function(episode) {
      const id = String(episode && episode.id ? episode.id : "").trim();
      if (id) {
        byId[id] = episode;
      }
    });

    Logger.log(
      "Episode詳細取得 batch " +
      (Math.floor(start / batchSize) + 1) +
      ": requested=" + batch.length +
      " fetched=" + episodes.filter(Boolean).length
    );

    // 68件なら通常2リクエスト。連続呼び出しを少し緩和する。
    if (start + batchSize < ids.length) {
      Utilities.sleep(1500);
    }
  }

  return byId;
}
