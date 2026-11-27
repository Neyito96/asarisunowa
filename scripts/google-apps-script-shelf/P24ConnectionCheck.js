
function P24_CHECK_CONNECTION() {
  const result = {
    spotifyAuth:
      typeof getSpotifyUserAccessToken === "function",
    spotifyRead:
      typeof fetchSpotifyReadWithRetry_ === "function",
    librarySearch:
      typeof P24_LIBRARY_PLAYLIST_PROPOSE === "function"
  };

  Logger.log(JSON.stringify(result));
  return result;
}
