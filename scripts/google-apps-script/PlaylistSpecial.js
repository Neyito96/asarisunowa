  function syncToyohidePlaylist() {
  const KEYWORDS = ["豊秀一", "豊 秀一"];
  const TARGET_PLAYLIST_ID = "4Ri6rxTGFimTm0KkZtKfBZ";

  const OFFICIAL_SHOWS = [
    { name: "スポンジ Sports Lounge／スポーツラウンジ", showId: "7euH6hzudIdp61JRSi9E8w" },
    { name: "ドーナツ ～このポッドキャストはSNSです", showId: "0341I5UOUrJgm7KEvNGInZ" },
    { name: "MEDIA TALK メディアトーク", showId: "0yhef9ORZkUZs9ZeotdCSY" },
    { name: "ニュースの現場から", showId: "392h0MYfvMTndEVzf2cOvC" },
    { name: "ニュースを深く面白く　報談【HOU-DAN】ホウダン", showId: "5Dt1uyQaJpM6hPV8aEMP3R" },
    { name: "こどもそうだんしつ", showId: "1KExdSsjQnatS4TdseGoC0" },
    { name: "ニュースの学校", showId: "2uG9W6CnsaNi87AfSuGe8r" }
  ];

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const existingItems =
    getAllSpotifyPlaylistItems_(TARGET_PLAYLIST_ID, token);

  const existingUris = new Set(
    existingItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? item.item.uri
          : "";
      })
      .filter(Boolean)
  );

  const candidates = [];

  OFFICIAL_SHOWS.forEach(function(show) {
    let nextUrl =
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(show.showId) +
      "/episodes?market=JP&limit=50";

    while (nextUrl) {
      const res = UrlFetchApp.fetch(nextUrl, {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      });

      if (res.getResponseCode() !== 200) {
        Logger.log(
          "Show取得失敗: " +
          show.name +
          " | status=" +
          res.getResponseCode()
        );
        break;
      }

      const data = JSON.parse(res.getContentText());
      const episodes =
        data && Array.isArray(data.items)
          ? data.items
          : [];

      episodes.forEach(function(ep) {
        const text = [
          ep && ep.name ? ep.name : "",
          ep && ep.description ? ep.description : "",
          ep && ep.html_description ? ep.html_description : ""
        ].join(" ");

        const hit = KEYWORDS.some(function(keyword) {
          return text.indexOf(keyword) >= 0;
        });

        if (
          hit &&
          ep &&
          ep.uri &&
          !existingUris.has(ep.uri)
        ) {
          candidates.push({
            showName: show.name,
            name: ep.name || "",
            uri: ep.uri,
            id: ep.id || "",
            releaseDate: ep.release_date || ""
          });
        }
      });

      nextUrl = data.next || null;
    }
  });

  Logger.log("新規候補件数: " + candidates.length);

  let addedCount = 0;
  let failedCount = 0;

  candidates.forEach(function(ep) {
    Logger.log(
      "追加候補: " +
      ep.showName +
      " | " +
      ep.name +
      " | " +
      ep.releaseDate
    );

    const addRes = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" +
        encodeURIComponent(TARGET_PLAYLIST_ID) +
        "/items",
      {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        headers: {
          Authorization: "Bearer " + token
        },
        payload: JSON.stringify({
          uris: [ep.uri]
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
  if (addedCount > 0) {
  updatePlaylistLatestDate_(
    "4Ri6rxTGFimTm0KkZtKfBZ"
  );
}
}
