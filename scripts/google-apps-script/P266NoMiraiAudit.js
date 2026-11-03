// Issue #266: READ ONLY diagnostic. Never modifies a playlist, trigger or sheet.
function P266_NO_MIRAI_READ_ONLY_AUDIT() {
  const showId = "0341I5UOUrJgm7KEvNGInZ";
  const playlistId = "4FBXSFf2nLjLb3qaRoSdoD";
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("SPOTIFY_AUTH_MISSING");
  const page = fetchAutoUpdateShowFirstPageV1_(showId, token);
  const items = Array.isArray(page && page.items) ? page.items : [];
  const episode = items.find(function(ep) {
    return String(ep && ep.name || "").indexOf("ノーミライ番外編") >= 0 &&
      String(ep && ep.name || "").indexOf("土曜が5回") >= 0;
  });
  const playlistRows = getAllSpotifyPlaylistItems_(playlistId, token);
  const existingUris = new Set(playlistRows.map(function(row) {
    const item = row && row.item || row && row.track || {};
    return String(item.uri || "");
  }).filter(Boolean));
  const rule = getAutoPlaylistRuleByKey_("no-mirai");
  const report = {
    mode: "READ_ONLY", writes: 0,
    showId: showId, playlistId: playlistId,
    scanned: items.length, playlistItems: playlistRows.length,
    found: !!episode,
    episodeId: episode ? episode.id : null,
    episodeUri: episode ? (episode.uri || "spotify:episode:" + episode.id) : null,
    ruleMatch: episode ? matchesAutoPlaylistRule_(episode, rule) : null,
    alreadyInPlaylist: episode ? existingUris.has(episode.uri || "spotify:episode:" + episode.id) : null,
    nextAction: !episode ? "VERIFY_SHOW_ID_OR_PAGINATE" :
      existingUris.has(episode.uri || "spotify:episode:" + episode.id) ? "ALREADY_PRESENT" :
      "ONE_EPISODE_MISSING_REVIEW_BEFORE_WRITE"
  };
  Logger.log(JSON.stringify(report));
  return report;
}
