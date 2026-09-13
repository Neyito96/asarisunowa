// プレイリスト自動更新用エピソード取得

function fetchSpotifyReadWithRetry_(url, options, contextLabel) {
  const maxRetries = 2;
  let retryCount = 0;

  while (true) {
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();

    if (status !== 429) {
      return response;
    }

    if (retryCount >= maxRetries) {
      throw new Error(
        "Spotify APIのレート制限が続いているため取得を中止しました: " +
        String(contextLabel || url)
      );
    }

    const headers = response.getAllHeaders
      ? response.getAllHeaders()
      : response.getHeaders();
    const retryAfterRaw =
      headers["Retry-After"] ||
      headers["retry-after"] ||
      "";
    const retryAfterParsed = parseInt(String(retryAfterRaw), 10);
    const fallbackSeconds = Math.pow(2, retryCount + 1);
    const waitSeconds = Math.max(
      1,
      Math.min(
        60,
        Number.isFinite(retryAfterParsed)
          ? retryAfterParsed
          : fallbackSeconds
      )
    );

    retryCount += 1;
    Logger.log(
      "Spotify 429: " +
      String(contextLabel || url) +
      " | " +
      waitSeconds +
      "秒待って再試行 " +
      retryCount +
      "/" +
      maxRetries
    );
    Utilities.sleep(waitSeconds * 1000);
  }
}

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
      const showRes = fetchSpotifyReadWithRetry_(
        nextUrl,
        {
          muteHttpExceptions: true,
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json"
          }
        },
        "Show " + showId
      );

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
