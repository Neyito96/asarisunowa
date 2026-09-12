function addToyohideNewEpisodeQueryTest() {
  const PLAYLIST_ID = "4Ri6rxTGFimTm0KkZtKfBZ";
  const EPISODE_URI = "spotify:episode:21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 重複チェック
  const existingItems =
    getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const alreadyExists = existingItems.some(function(item) {
    return (
      item &&
      item.item &&
      item.item.uri === EPISODE_URI
    );
  });

  if (alreadyExists) {
    Logger.log("すでに登録済みです。追加しません。");
    return;
  }

  const url =
    "https://api.spotify.com/v1/playlists/" +
    encodeURIComponent(PLAYLIST_ID) +
    "/items?uris=" +
    encodeURIComponent(EPISODE_URI);

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  });

  Logger.log("追加 status: " + res.getResponseCode());
  Logger.log(res.getContentText());

  if (
    res.getResponseCode() !== 200 &&
    res.getResponseCode() !== 201
  ) {
    throw new Error("Spotifyへの追加に失敗しました");
  }

  Logger.log("追加成功：#2244");
}
function testCreatePlaylistAndAdd2244() {
  const EPISODE_URI = "spotify:episode:21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 1. 自分のSpotifyユーザーIDを取得
  const meRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/me",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("me status: " + meRes.getResponseCode());

  if (meRes.getResponseCode() !== 200) {
    Logger.log(meRes.getContentText());
    throw new Error("Spotifyユーザー情報の取得に失敗しました");
  }

  const me = JSON.parse(meRes.getContentText());
  Logger.log("user: " + me.display_name);
  Logger.log("userId: " + me.id);

  // 2. 非公開テストプレイリストを作成
  const createRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/me/playlists",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        name: "朝リス自動更新 APIテスト",
        description: "Spotify API動作確認用。削除可。",
        public: false
      })
    }
  );

  Logger.log(
    "playlist create status: " +
    createRes.getResponseCode()
  );

  Logger.log(createRes.getContentText());

  if (
    createRes.getResponseCode() !== 200 &&
    createRes.getResponseCode() !== 201
  ) {
    throw new Error("テストプレイリスト作成に失敗しました");
  }

  const playlist =
    JSON.parse(createRes.getContentText());

  Logger.log("作成成功: " + playlist.name);
  Logger.log("playlistId: " + playlist.id);

  // 3. 作ったばかりのプレイリストへ #2244 を追加
  const addRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(playlist.id) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: [EPISODE_URI]
      })
    }
  );

  Logger.log(
    "episode add status: " +
    addRes.getResponseCode()
  );

  Logger.log(addRes.getContentText());

  if (
    addRes.getResponseCode() === 200 ||
    addRes.getResponseCode() === 201
  ) {
    Logger.log("★★ #2244 追加成功 ★★");
  } else {
    Logger.log("★★ #2244 追加失敗 ★★");
  }
}
function testAddMusicTrack() {
  const PLAYLIST_ID = "7xR7H5e5ZcQ5pL87ZcicPj";

  // Spotify公式ドキュメントの例にある音楽Track URI
  const TRACK_URI = "spotify:track:4iV5W9uYEdYUVa79Axb7Rh";

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(PLAYLIST_ID) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: [TRACK_URI]
      })
    }
  );

  Logger.log("track add status: " + res.getResponseCode());
  Logger.log(res.getContentText());

  if (
    res.getResponseCode() === 200 ||
    res.getResponseCode() === 201
  ) {
    Logger.log("★★ 音楽Track追加成功 ★★");
  } else {
    Logger.log("★★ 音楽Track追加失敗 ★★");
  }
}
function testAddKnownEpisode() {
  const SOURCE_PLAYLIST_ID = AUTO_PLAYLIST_RULES[0].playlistId;
  const TEST_PLAYLIST_ID = "7xR7H5e5ZcQ5pL87ZcicPj";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 「一緒に新聞をめくろう！」から実在episodeを1本取得
  const items = getAllSpotifyPlaylistItems_(
    SOURCE_PLAYLIST_ID,
    token
  );

  const episodeItem = items.find(function(item) {
    return (
      item &&
      item.item &&
      item.item.uri &&
      String(item.item.uri).indexOf("spotify:episode:") === 0
    );
  });

  if (!episodeItem) {
    throw new Error("テスト用episodeが見つかりませんでした");
  }

  const episode = episodeItem.item;

  Logger.log("テストepisode: " + episode.name);
  Logger.log("URI: " + episode.uri);

  // テストプレイリストへ追加
  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(TEST_PLAYLIST_ID) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: [episode.uri]
      })
    }
  );

  Logger.log("known episode add status: " + res.getResponseCode());
  Logger.log(res.getContentText());

  if (
    res.getResponseCode() === 200 ||
    res.getResponseCode() === 201
  ) {
    Logger.log("★★ 既存episode追加成功 ★★");
  } else {
    Logger.log("★★ 既存episode追加失敗 ★★");
  }
}