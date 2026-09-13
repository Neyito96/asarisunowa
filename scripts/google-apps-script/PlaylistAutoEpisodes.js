// プレイリスト自動更新用エピソード取得
function fetchAutoPlaylistEpisodes_(rule, token) {
  const showIds = getAutoPlaylistShowIds_(rule);

  if (!showIds.length) {
    throw new Error(rule.name + " のShow IDが設定されていません");
  }

  const episodesByUri = {};
  const fetchAllPages = rule.fetchAllPages === true;
  const continueOnShowFetchError =
    rule.continueOnShowFetchError === true;

  showIds.forEach(function(showId) {
    let nextUrl =
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(showId) +
      "/episodes?market=JP&limit=50";

    while (nextUrl) {
      const showRes = UrlFetchApp.fetch(nextUrl, {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      });

      if (showRes.getResponseCode() !== 200) {
        Logger.log(
          "Show取得失敗: " +
          showId +
          " | status=" +
          showRes.getResponseCode() +
          " | " +
          showRes.getContentText()
        );

        if (continueOnShowFetchError) {
          break;
        }

        throw new Error(rule.name + " のShow取得に失敗しました: " + showId);
      }

      const showData = JSON.parse(showRes.getContentText());
      const episodes = Array.isArray(showData.items) ? showData.items : [];

      episodes.forEach(function(episode) {
        const uri = String(episode && episode.uri ? episode.uri : "");
        const key = uri || (showId + "::" + String(episode && episode.id ? episode.id : ""));

        if (key) {
          episodesByUri[key] = episode;
        }
      });

      nextUrl = fetchAllPages && showData.next
        ? String(showData.next)
        : null;
    }
  });

  return Object.keys(episodesByUri).map(function(key) {
    return episodesByUri[key];
  });
}
