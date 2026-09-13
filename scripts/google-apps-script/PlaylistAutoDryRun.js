// プレイリスト自動更新の書き込みなし確認
// Spotify・スプレッドシートへの書き込みは行わず、候補件数と未登録候補を返す。

function dryRunAutoPlaylistByPlaylistId(playlistId) {
  const wantedId = String(playlistId || "").trim();
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === wantedId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + wantedId);
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);

  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  const candidates = episodes.filter(function(ep) {
    return matchesAutoPlaylistRule_(ep, rule);
  });

  const newEpisodes = candidates.filter(function(ep) {
    const uri = String(ep && ep.uri ? ep.uri : "");
    return uri && !existingUris.has(uri);
  });

  const result = {
    dryRun: true,
    name: rule.name,
    playlistId: rule.playlistId,
    sourceShowCount: getAutoPlaylistShowIds_(rule).length,
    fetchedEpisodeCount: episodes.length,
    candidateCount: candidates.length,
    newEpisodeCount: newEpisodes.length,
    newEpisodes: newEpisodes.map(function(ep) {
      return {
        id: String(ep && ep.id ? ep.id : ""),
        name: String(ep && ep.name ? ep.name : ""),
        uri: String(ep && ep.uri ? ep.uri : ""),
        releaseDate: String(ep && ep.release_date ? ep.release_date : "")
      };
    })
  };

  Logger.log("=== DRY RUN: " + rule.name + " ===");
  Logger.log("一次ソース数: " + result.sourceShowCount);
  Logger.log("取得エピソード数: " + result.fetchedEpisodeCount);
  Logger.log("候補件数: " + result.candidateCount);
  Logger.log("未登録候補: " + result.newEpisodeCount);
  result.newEpisodes.forEach(function(ep) {
    Logger.log(ep.releaseDate + " | " + ep.name + " | " + ep.uri);
  });

  return result;
}
