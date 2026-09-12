function testToyohideDiff() {
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

  // 既存プレイリスト
  const existingItems = getAllSpotifyPlaylistItems_(
    TARGET_PLAYLIST_ID,
    token
  );

  const existing = existingItems
    .map(function(item) {
      const ep = item && item.item ? item.item : null;

      return {
        uri: ep && ep.uri ? ep.uri : "",
        name: ep && ep.name ? ep.name : "",
        url:
          ep &&
          ep.external_urls &&
          ep.external_urls.spotify
            ? ep.external_urls.spotify
            : ""
      };
    })
    .filter(function(ep) {
      return ep.uri;
    });

  const existingUris = new Set(
    existing.map(function(ep) {
      return ep.uri;
    })
  );

  Logger.log("既存プレイリスト件数: " + existing.length);

  const allMatches = [];
  let totalEpisodesChecked = 0;

  OFFICIAL_SHOWS.forEach(function(show) {
    let nextUrl =
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(show.showId) +
      "/episodes?market=JP&limit=50";

    let showChecked = 0;
    let showMatches = 0;

    while (nextUrl) {
      const res = UrlFetchApp.fetch(nextUrl, {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      });

      const status = res.getResponseCode();

      if (status !== 200) {
        Logger.log(
          "取得失敗: " +
          show.name +
          " | status=" +
          status +
          " | " +
          res.getContentText()
        );
        break;
      }

      const data = JSON.parse(res.getContentText());
      const episodes =
        data && Array.isArray(data.items)
          ? data.items
          : [];

      episodes.forEach(function(ep) {
        showChecked++;
        totalEpisodesChecked++;

        const text = [
          ep && ep.name ? ep.name : "",
          ep && ep.description ? ep.description : "",
          ep && ep.html_description ? ep.html_description : ""
        ].join(" ");

        const hit = KEYWORDS.some(function(keyword) {
          return text.indexOf(keyword) >= 0;
        });

        if (hit) {
          showMatches++;

          allMatches.push({
            showName: show.name,
            name: ep.name || "",
            uri: ep.uri || "",
            releaseDate: ep.release_date || "",
            url:
              ep.external_urls &&
              ep.external_urls.spotify
                ? ep.external_urls.spotify
                : ""
          });
        }
      });

      nextUrl =
        data &&
        data.next
          ? data.next
          : null;
    }

    Logger.log(
      show.name +
      " | 検索件数=" +
      showChecked +
      " | 豊秀一候補=" +
      showMatches
    );
  });

  Logger.log("全検索エピソード数: " + totalEpisodesChecked);
  Logger.log("豊秀一候補総数: " + allMatches.length);

  const matchedUris = new Set();

  Logger.log("===== 既存と一致 =====");

  allMatches.forEach(function(ep) {
    if (existingUris.has(ep.uri)) {
      matchedUris.add(ep.uri);

      Logger.log(
        "○ " +
        ep.showName +
        " | " +
        ep.name +
        " | " +
        ep.releaseDate +
        " | " +
        ep.url
      );
    }
  });

  Logger.log("===== ★新規候補 =====");

  allMatches.forEach(function(ep) {
    if (!existingUris.has(ep.uri)) {
      Logger.log(
        "★ " +
        ep.showName +
        " | " +
        ep.name +
        " | " +
        ep.releaseDate +
        " | " +
        ep.url
      );
    }
  });

  Logger.log("===== 検索で拾えなかった既存 =====");

  existing.forEach(function(ep) {
    if (!matchedUris.has(ep.uri)) {
      Logger.log(
        "? " +
        ep.name +
        " | " +
        ep.url
      );
    }
  });

  Logger.log("※確認専用です。プレイリストへの追加はしていません。");
}
function testToyohidePlaylistInfo() {
  const PLAYLIST_ID = "4Ri6rxTGFimTm0KkZtKfBZ";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(PLAYLIST_ID),
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("status: " + res.getResponseCode());

  const data = JSON.parse(res.getContentText());

  Logger.log("name: " + data.name);
  Logger.log("owner: " + (data.owner ? data.owner.display_name : ""));
  Logger.log("ownerId: " + (data.owner ? data.owner.id : ""));
  Logger.log("collaborative: " + data.collaborative);
  Logger.log("public: " + data.public);
  }