// Spotify公開プレイリストの登録前プレビュー用。
// 画像はここでは確定しない。空のプレイリストではモザイク画像が未生成のため、
// artwork は既存の公開同期 (scripts/sync-playlists.py) に任せる。

function handlePlaylistResolve_(e, callback) {
  const rawUrl = String(
    e && e.parameter && e.parameter.url ? e.parameter.url : ""
  ).trim();

  const match = rawUrl.match(
    /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)(?:[/?#]|$)/i
  );

  if (!match) {
    return apiResponse(
      { ok: false, error: "SpotifyプレイリストURLを入力してください" },
      callback
    );
  }

  const token = getSpotifyAccessToken();
  if (!token) {
    return apiResponse(
      { ok: false, error: "Spotify情報を取得できませんでした" },
      callback
    );
  }

  try {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" +
        encodeURIComponent(match[1]) +
        "?market=JP&fields=id,name,owner(display_name)",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    if (response.getResponseCode() !== 200) {
      return apiResponse(
        { ok: false, error: "Spotifyプレイリストを読み込めませんでした" },
        callback
      );
    }

    const data = JSON.parse(response.getContentText());
    return apiResponse(
      {
        ok: true,
        title: String(data && data.name ? data.name : "").trim(),
        owner: String(
          data && data.owner && data.owner.display_name
            ? data.owner.display_name
            : ""
        ).trim()
      },
      callback
    );
  } catch (_) {
    return apiResponse(
      { ok: false, error: "Spotifyプレイリストを読み込めませんでした" },
      callback
    );
  }
}
