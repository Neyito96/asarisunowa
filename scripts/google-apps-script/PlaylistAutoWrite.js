// プレイリスト自動更新用 Spotify 書き込み補助
function addAutoPlaylistEpisodesIndividually_(rule, token, episodes) {
  let addedCount = 0;
  let failedCount = 0;
  const addedEpisodes = [];

  episodes.forEach(function(ep) {
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
        payload: JSON.stringify({
          uris: [String(ep.uri)]
        })
      }
    );

    const status = addRes.getResponseCode();

    if (status === 200 || status === 201) {
      addedCount++;
      addedEpisodes.push(ep);
      Logger.log("追加成功 ✅ " + ep.name);
    } else {
      failedCount++;
      Logger.log(
        "追加不可 ⚠️ " +
        ep.name +
        " | status=" +
        status +
        " | " +
        addRes.getContentText()
      );
    }
  });

  Logger.log("追加成功件数: " + addedCount);
  Logger.log("追加不可件数: " + failedCount);

  return {
    addedCount: addedCount,
    failedCount: failedCount,
    addedEpisodes: addedEpisodes
  };
}

function addAutoPlaylistEpisodesBatch_(rule, token, episodes) {
  const uris = episodes.map(function(ep) {
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

  episodes.forEach(function(ep) {
    Logger.log("追加完了 ✅ " + ep.name);
  });

  const responseBody = JSON.parse(addRes.getContentText() || "{}");
  return {
    addedCount: episodes.length,
    failedCount: 0,
    addedEpisodes: episodes.slice(),
    snapshotId: String(responseBody.snapshot_id || "")
  };
}
