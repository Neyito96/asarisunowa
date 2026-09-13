// プレイリスト自動更新用 Spotify 書き込み補助
function addAutoPlaylistEpisodesIndividually_(rule, token, episodes) {
  let addedCount = 0;
  let failedCount = 0;

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
    failedCount: failedCount
  };
}
