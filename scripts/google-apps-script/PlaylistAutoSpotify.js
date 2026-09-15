// プレイリスト自動更新用 Spotify 補助

function getAllSpotifyPlaylistItems_(playlistId, token) {
  const allItems = [];

  let url =
    "https://api.spotify.com/v1/playlists/" +
    encodeURIComponent(playlistId) +
    "/items?market=JP&limit=100";

  while (url) {
    const response = fetchSpotifyReadWithRetry_(
      url,
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Playlist " + playlistId
    );

    const status = response.getResponseCode();
    Logger.log("Playlist page status: " + status);

    if (status !== 200) {
      Logger.log(response.getContentText());
      throw new Error("プレイリスト全件取得に失敗しました");
    }

    const data = JSON.parse(response.getContentText());

    if (Array.isArray(data.items)) {
      allItems.push.apply(allItems, data.items);
    }

    url = data.next ? String(data.next) : "";
  }

  return allItems;
}

// Playlist Items APIが返すepisodeはdescription等が省略されることがある。
// speaker-safe-v2で必要な場合だけepisode単体APIを呼び、全番組履歴走査を避ける。
function hydrateSpotifyEpisodeForSpeakerSafeV2_(episode, token) {
  if (!episode) return null;

  const hasDescription = !!String(episode.description || episode.html_description || "").trim();
  if (hasDescription) return episode;

  const id = String(episode.id || "").trim();
  if (!id) return episode;

  const url = "https://api.spotify.com/v1/episodes/" + encodeURIComponent(id) + "?market=JP";
  const response = fetchSpotifyReadWithRetry_(
    url,
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    },
    "Episode " + id
  );

  const status = response.getResponseCode();
  Logger.log("Episode detail status: " + status + " | " + id);
  if (status !== 200) return episode;

  try {
    const detail = JSON.parse(response.getContentText());
    if (!detail || !detail.id) return episode;
    // 単体APIの完全なメタデータを優先。ただしplaylist側にしかない値は保持。
    return Object.assign({}, episode, detail);
  } catch (_) {
    return episode;
  }
}

function hydrateSpotifyEpisodesForSpeakerSafeV2_(episodes, token) {
  const list = Array.isArray(episodes) ? episodes : [];
  return list.map(function(episode) {
    return hydrateSpotifyEpisodeForSpeakerSafeV2_(episode, token);
  });
}
