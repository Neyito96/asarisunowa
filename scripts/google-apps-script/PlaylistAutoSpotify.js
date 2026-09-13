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
