const SPOTIFY_USER_REDIRECT_URI =
  "https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec";
function startSpotifyUserAuth() {
  const props = PropertiesService.getScriptProperties();
  const clientId = String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  if (!clientId) {
    throw new Error("SPOTIFY_CLIENT_ID がありません");
  }

  const state = Utilities.getUuid();
  props.setProperty("SPOTIFY_OAUTH_STATE", state);

  const scopes = [
    "playlist-read-private",
    "playlist-modify-public",
    "playlist-modify-private"
  ].join(" ");

  const url =
    "https://accounts.spotify.com/authorize" +
    "?response_type=code" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&scope=" + encodeURIComponent(scopes) +
    "&redirect_uri=" + encodeURIComponent(SPOTIFY_USER_REDIRECT_URI) +
    "&state=" + encodeURIComponent(state) +
    "&show_dialog=true";

  // OAuth URL contains state; do not log it.

  return url;
}

function handleSpotifyUserOAuthCallback_(e) {
  const props = PropertiesService.getScriptProperties();

  const code = String(
    e && e.parameter && e.parameter.code
      ? e.parameter.code
      : ""
  ).trim();

  const state = String(
    e && e.parameter && e.parameter.state
      ? e.parameter.state
      : ""
  ).trim();

  const expectedState =
    String(props.getProperty("SPOTIFY_OAUTH_STATE") || "").trim();

  if (!code) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証エラー</h2><p>認証コードがありません。</p>"
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証エラー</h2><p>state が一致しません。</p>"
    );
  }

  const clientId =
    String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  const clientSecret =
    String(props.getProperty("SPOTIFY_CLIENT_SECRET") || "").trim();

  if (!clientId || !clientSecret) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証エラー</h2><p>Client ID / Secret がありません。</p>"
    );
  }

  const response = UrlFetchApp.fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "post",
      muteHttpExceptions: true,
      headers: {
        Authorization:
          "Basic " +
          Utilities.base64Encode(clientId + ":" + clientSecret)
      },
      payload: {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_USER_REDIRECT_URI
      }
    }
  );

  const status = response.getResponseCode();
  const body = response.getContentText();

  Logger.log("Spotify OAuth status: " + status);

  if (status !== 200) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証に失敗しました</h2><p>Status: " +
      status +
      "</p>"
    );
  }

  const data = JSON.parse(body);

  if (data.refresh_token) {
    props.setProperty(
      "SPOTIFY_USER_REFRESH_TOKEN",
      String(data.refresh_token)
    );
  }

  if (data.access_token) {
    CacheService.getScriptCache().put(
      "SPOTIFY_USER_ACCESS_TOKEN",
      String(data.access_token),
      Math.max(60, Number(data.expires_in || 3600) - 120)
    );
  }

  props.deleteProperty("SPOTIFY_OAUTH_STATE");

  return HtmlService.createHtmlOutput(
    "<h2>Spotify認証成功 ✅</h2>" +
    "<p>NEYITOのプレイリストを自動更新できる準備ができました。</p>" +
    "<p>この画面は閉じて大丈夫です。</p>"
  );
}
function getSpotifyUserAccessToken() {
  const cache = CacheService.getScriptCache();

  const cached =
    String(cache.get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();

  if (cached) {
    return cached;
  }

  const props = PropertiesService.getScriptProperties();

  const clientId =
    String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  const clientSecret =
    String(props.getProperty("SPOTIFY_CLIENT_SECRET") || "").trim();

  const refreshToken =
    String(
      props.getProperty("SPOTIFY_USER_REFRESH_TOKEN") || ""
    ).trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return "";
  }

  const response = UrlFetchApp.fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "post",
      muteHttpExceptions: true,
      headers: {
        Authorization:
          "Basic " +
          Utilities.base64Encode(clientId + ":" + clientSecret)
      },
      payload: {
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }
    }
  );

  if (response.getResponseCode() !== 200) {
    Logger.log("Spotify refresh failed (HTTP " + response.getResponseCode() + ")");
    return "";
  }

  const data = JSON.parse(response.getContentText());

  const accessToken =
    String(data.access_token || "").trim();

  if (accessToken) {
    cache.put(
      "SPOTIFY_USER_ACCESS_TOKEN",
      accessToken,
      Math.max(60, Number(data.expires_in || 3600) - 120)
    );
  }

  return accessToken;
}
