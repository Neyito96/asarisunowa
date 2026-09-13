function syncAllAutoPlaylists() {
  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  AUTO_PLAYLIST_RULES.forEach(function(rule) {
    syncOneAutoPlaylist_(rule, token);
  });
}

function syncAutoPlaylistByPlaylistId_(playlistId) {
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

  syncOneAutoPlaylist_(rule, token);
}

function syncOneAutoPlaylist_(rule, token) {
  Logger.log("=== " + rule.name + " ===");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);

  const playlistItems =
    getAllSpotifyPlaylistItems_(rule.playlistId, token);

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

  Logger.log("候補件数: " + candidates.length);
  Logger.log("新規追加候補: " + newEpisodes.length);

  if (!newEpisodes.length) {
    Logger.log("追加なし。すべて登録済みです ✅");
    return;
  }

  if (rule.addIndividually === true) {
    const result =
      addAutoPlaylistEpisodesIndividually_(rule, token, newEpisodes);

    if (
      result.addedCount > 0 &&
      rule.updateLatestDateOnAdd === true
    ) {
      updatePlaylistLatestDate_(rule.playlistId);
    }

    return;
  }

  const uris = newEpisodes.map(function(ep) {
    return String(ep.uri);
  });

  const addRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(rule.playlistId) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({ uris: uris })
    }
  );

  Logger.log("Add status: " + addRes.getResponseCode());
  Logger.log(addRes.getContentText());

  if (
    addRes.getResponseCode() !== 200 &&
    addRes.getResponseCode() !== 201
  ) {
    throw new Error(rule.name + " への追加に失敗しました");
  }

  newEpisodes.forEach(function(ep) {
    Logger.log("追加完了 ✅ " + ep.name);
  });

  if (rule.updateLatestDateOnAdd === true) {
    updatePlaylistLatestDate_(rule.playlistId);
  }
}
