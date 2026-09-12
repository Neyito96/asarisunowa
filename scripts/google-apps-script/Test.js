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

function testSpotifyApi() {
  const props = PropertiesService.getScriptProperties();

  const clientId =
    String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  const clientSecret =
    String(props.getProperty("SPOTIFY_CLIENT_SECRET") || "").trim();

  Logger.log("Client ID exists: " + Boolean(clientId));
  Logger.log("Client Secret exists: " + Boolean(clientSecret));
  Logger.log("Client ID length: " + clientId.length);
  Logger.log("Client Secret length: " + clientSecret.length);

  if (!clientId || !clientSecret) {
    Logger.log("ERROR: Script Properties are missing.");
    return;
  }

  const tokenResponse =
    UrlFetchApp.fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "post",
        muteHttpExceptions: true,
        contentType:
          "application/x-www-form-urlencoded",
        payload: {
          grant_type:
            "client_credentials",
          client_id:
            clientId,
          client_secret:
            clientSecret
        }
      }
    );

  Logger.log("Token status: " + tokenResponse.getResponseCode());

  if (tokenResponse.getResponseCode() !== 200) {
    Logger.log("Token error: " + tokenResponse.getContentText());
    return;
  }

  const tokenData =
    JSON.parse(tokenResponse.getContentText());

  const token =
    tokenData.access_token;

  Logger.log("Token acquired: " + Boolean(token));

  const showId =
    "7dDe6pPYCdUUDQ2AL40xtE";

  const showResponse =
    UrlFetchApp.fetch(
      "https://api.spotify.com/v1/shows/" +
      showId +
      "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization:
            "Bearer " + token
        }
      }
    );

  Logger.log("Show status: " + showResponse.getResponseCode());

  if (showResponse.getResponseCode() === 200) {
    const show =
      JSON.parse(showResponse.getContentText());

    Logger.log("Show name: " + show.name);
    Logger.log("Publisher: " + show.publisher);
    Logger.log(
      "Artwork exists: " +
      Boolean(show.images && show.images.length)
    );
  } else {
    Logger.log("Show error: " + showResponse.getContentText());
  }
}
function testSyncIsshoShinbunPlaylist() {
  const SHOW_ID = "392h0MYfvMTndEVzf2cOvC";
  const PLAYLIST_ID = "4tY0lHoV8IemMBp4iTnKnl";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotify access token を取得できませんでした");
  }

  // 公式Showの新着エピソードを取得
  const showRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(SHOW_ID) +
      "/episodes?market=JP&limit=50",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("Show status: " + showRes.getResponseCode());

  if (showRes.getResponseCode() !== 200) {
    Logger.log(showRes.getContentText());
    throw new Error("公式Showの取得に失敗しました");
  }

  const showData = JSON.parse(showRes.getContentText());
  const episodes = Array.isArray(showData.items) ? showData.items : [];

  // 追加先プレイリストの現在の中身を取得
 
const playlistItems = getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);
  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  // 最近の「（めくろう）」回だけ候補にする
  const candidates = episodes.filter(function(ep) {
    const name = String(ep && ep.name ? ep.name : "");
    return /[（(]めくろう[）)]/.test(name);
  });

  Logger.log("公式Show取得件数: " + episodes.length);
  Logger.log("プレイリスト取得件数: " + playlistItems.length);
  Logger.log("めくろう候補件数: " + candidates.length);

  candidates.forEach(function(ep) {
    const uri = String(ep.uri || "");
    const exists = existingUris.has(uri);

    Logger.log(
      (exists ? "既存 ✅ " : "未登録 ➕ ") +
      ep.name +
      " | " +
      uri
    );
  });

  Logger.log("※ この関数は確認専用です。追加・削除はしていません。");
}

function testPlaylistLatestDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheets().find(function(s) {
    return String(s.getName()).trim() === "作業台";
  });

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const values = sheet.getDataRange().getValues();

  const headers = values[0].map(function(v) {
    return String(v || "").trim();
  });

  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const profileCol = headers.indexOf("プロフィール");
  const latestCol = headers.indexOf("最終更新日");

  if (
    urlCol < 0 ||
    titleCol < 0 ||
    profileCol < 0 ||
    latestCol < 0
  ) {
    throw new Error("必要な列見出しが見つかりません");
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できません");
  }

  let checked = 0;

  for (let i = 1; i < values.length && checked < 10; i++) {
    const url = String(values[i][urlCol] || "").trim();
    const title = String(values[i][titleCol] || "").trim();
    const profile = String(values[i][profileCol] || "").trim();

    // NEYITO管理、または共同編集URLがあるプレイリストを試す
const collaboratorUrl = String(values[i][3] || "").trim();

const shouldTry =
  profile.toUpperCase() === "NEYITO" ||
  Boolean(collaboratorUrl);

if (!shouldTry) {
  continue;
}

    if (!url || !/open\.spotify\.com\/playlist\//i.test(url)) {
      continue;
    }

    const match = url.match(
      /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
    );

    if (!match) continue;

    const playlistId = match[1];

    try {
      const items = getAllSpotifyPlaylistItems_(playlistId, token);

      let latestAddedAt = "";

      items.forEach(function(row) {
        const addedAt =
          row && row.added_at
            ? String(row.added_at)
            : "";

        if (
          addedAt &&
          (!latestAddedAt || addedAt > latestAddedAt)
        ) {
          latestAddedAt = addedAt;
        }
      });

      const latestDate =
        latestAddedAt
          ? latestAddedAt.slice(0, 10)
          : "";

      Logger.log(
        title +
        " | 件数: " + items.length +
        " | 最終更新: " +
        (latestDate || "取得できず")
      );

    } catch (err) {
      Logger.log(
        title +
        " | スキップ: " +
        String(err)
      );
    }

    checked++;
  }

  Logger.log("※確認専用。シートには書き込んでいません。");
}
function testSpeakerSearch() {
  const KEYWORD = "豊秀一";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const searchRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/search?" +
      "q=" + encodeURIComponent(KEYWORD) +
      "&type=episode&market=JP&limit=10",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("Search status: " + searchRes.getResponseCode());

  if (searchRes.getResponseCode() !== 200) {
    Logger.log(searchRes.getContentText());
    throw new Error("Spotify検索に失敗しました");
  }

  const data = JSON.parse(searchRes.getContentText());
  const episodes =
    data &&
    data.episodes &&
    Array.isArray(data.episodes.items)
      ? data.episodes.items
      : [];
episodes.forEach(function(ep, index) {
  Logger.log(
    "検索結果" + (index + 1) + ": " +
    String(ep.name || "") +
    " | " +
    String(ep.description || "").substring(0, 150)
     );
});
  const matches = episodes.filter(function(ep) {
    const text = [
      ep && ep.name ? ep.name : "",
      ep && ep.description ? ep.description : "",
      ep && ep.html_description ? ep.html_description : ""
    ].join(" ");

    return text.indexOf(KEYWORD) >= 0;
  });

  Logger.log("検索取得件数: " + episodes.length);
  Logger.log("豊秀一一致件数: " + matches.length);

  matches.forEach(function(ep, index) {
    Logger.log(
      (index + 1) +
      ". " +
      ep.name +
      " | " +
      (ep.release_date || "") +
      " | " +
      (ep.external_urls && ep.external_urls.spotify
        ? ep.external_urls.spotify
        : "")
    );
  });

  Logger.log("※確認専用です。プレイリストへの追加はしていません。");
}
function testOfficialShows() {
  const SHOW_IDS = [
    "7euH6hzudIdp61JRSi9E8w",
    "0341I5UOUrJgm7KEvNGInZ",
    "0yhef9ORZkUZs9ZeotdCSY",
    "392h0MYfvMTndEVzf2cOvC",
    "5Dt1uyQaJpM6hPV8aEMP3R",
    "1KExdSsjQnatS4TdseGoC0",
    "2uG9W6CnsaNi87AfSuGe8r"
  ];

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  SHOW_IDS.forEach(function(showId) {
    const res = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/shows/" +
        encodeURIComponent(showId) +
        "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    if (res.getResponseCode() !== 200) {
      Logger.log(
        "取得失敗: " +
        showId +
        " | status=" +
        res.getResponseCode() +
        " | " +
        res.getContentText()
      );
      return;
    }

    const show = JSON.parse(res.getContentText());

    Logger.log(
      show.name +
        " | " +
        showId +
        " | episodes=" +
        (show.total_episodes || "")
    );
  });
}
function testToyohideEpisodeInfo() {
  const EPISODE_ID = "21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();

  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/episodes/" +
      encodeURIComponent(EPISODE_ID) +
      "?market=JP",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("status: " + res.getResponseCode());

  const ep = JSON.parse(res.getContentText());

  Logger.log("name: " + ep.name);
  Logger.log("uri: " + ep.uri);
  Logger.log(
    "url: " +
      (ep.external_urls && ep.external_urls.spotify
        ? ep.external_urls.spotify
        : "")
  );
}
function testFind2244Uri() {
  const SHOW_ID = "392h0MYfvMTndEVzf2cOvC";
  const token = getSpotifyUserAccessToken();

  let nextUrl =
    "https://api.spotify.com/v1/shows/" +
    SHOW_ID +
    "/episodes?market=JP&limit=50";

  while (nextUrl) {
    const res = UrlFetchApp.fetch(nextUrl, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    });

    const data = JSON.parse(res.getContentText());
    const episodes = Array.isArray(data.items) ? data.items : [];

    for (const ep of episodes) {
      if (String(ep.name || "").indexOf("#2244") >= 0) {
        Logger.log("name: " + ep.name);
        Logger.log("id: " + ep.id);
        Logger.log("uri: " + ep.uri);
        Logger.log("href: " + ep.href);
        Logger.log(
          "url: " +
          (ep.external_urls && ep.external_urls.spotify
            ? ep.external_urls.spotify
            : "")
        );
        return;
      }
    }

    nextUrl = data.next || null;
  }

  Logger.log("#2244 が見つかりませんでした");
}
function testGetMekurouEpisodeUri() {
  const PLAYLIST_ID = AUTO_PLAYLIST_RULES[0].playlistId;

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const items = getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  for (const item of items) {
    const ep = item && item.item ? item.item : null;

    if (
      ep &&
      ep.uri &&
      String(ep.uri).indexOf("spotify:episode:") === 0
    ) {
      Logger.log("name: " + ep.name);
      Logger.log("uri: " + ep.uri);
      Logger.log(
        "url: " +
        (ep.external_urls && ep.external_urls.spotify
          ? ep.external_urls.spotify
          : "")
      );
      return;
    }
  }

  Logger.log("episodeが見つかりませんでした");
}
function testCompareEpisodes() {
  const IDS = [
    {
      label: "#2244",
      id: "21Bx1Naz0iJebxLUWPD8yV"
    },
    {
      label: "#980",
      id: "1CyMwuqTxKU0XKMSZfMqut"
    }
  ];

  const token = getSpotifyUserAccessToken();

  IDS.forEach(function(x) {
    const res = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" +
        encodeURIComponent(x.id) +
        "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    Logger.log(
      x.label +
      " status: " +
      res.getResponseCode()
    );

    Logger.log(res.getContentText());
  });
}
