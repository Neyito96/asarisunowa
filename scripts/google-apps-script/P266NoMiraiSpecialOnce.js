// #266: one-time production repair for the 2026-10-31 ノーミライ番外編.
// Requires existing SpotifyAuth, PlaylistAutoSpotify, PlaylistDates modules.
// Call P266_ADD_NO_MIRAI_SPECIAL_ONCE manually; no new trigger.
function P266_ADD_NO_MIRAI_SPECIAL_ONCE() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("P266_LOCKED");
  try {
    const showId = "0341I5UOUrJgm7KEvNGInZ";
    const playlistId = "4FBXSFf2nLjLb3qaRoSdoD";
    const expectedDate = "2026-10-31";
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("P266_SPOTIFY_AUTH_MISSING");
    const page = fetchAutoUpdateShowFirstPageV1_(showId, token);
    const items = Array.isArray(page && page.items) ? page.items : [];
    const candidates = items.filter(function(ep) {
      const name = String(ep && ep.name || "").normalize("NFKC");
      return name.includes("ノーミライ番外編") &&
             name.includes("土曜が5回") &&
             String(ep.release_date || "").slice(0, 10) === expectedDate &&
             !!String(ep.id || "") &&
             !!String(ep.uri || "");
    });
    if (candidates.length !== 1) throw new Error("P266_EPISODE_MATCH_COUNT_" + candidates.length);
    const episode = candidates[0];
    const uri = episode.uri;
    if (uri !== "spotify:episode:" + episode.id) throw new Error("P266_INVALID_URI");
    function present() {
      return getAllSpotifyPlaylistItems_(playlistId, token).some(function(row) {
        const item = row && (row.item || row.track) || {};
        return String(item.uri || "") === uri;
      });
    }
    let addedCount = 0;
    if (!present()) {
      const rule = getAutoPlaylistRuleByKey_("no-mirai");
      if (!rule || rule.playlistId !== playlistId ||
          !Array.isArray(rule.showIds) || rule.showIds.indexOf(showId) < 0) {
        throw new Error("P266_RULE_MISMATCH");
      }
      // Preserve the normal authorization and work-sheet link guard.
      assertAutoPlaylistSheetLinkBeforeWrite_(rule);
      const result = addAutoPlaylistEpisodesIndividually_(rule, token, [episode]);
      if (!result || result.failedCount || result.addedCount !== 1) {
        throw new Error("P266_ADD_FAILED");
      }
      addedCount = 1;
    }
    if (!present()) throw new Error("P266_READBACK_NOT_PRESENT");
    // Only after Spotify readback: actual episode release date, never today's date.
    updatePlaylistLatestDate_(playlistId, expectedDate);
    const report = {
      ok: true, episodeId: episode.id, episodeUri: uri, addedCount: addedCount,
      playlistReadback: true, sheetLatestDate: expectedDate
    };
    Logger.log(JSON.stringify(report));
    return report;
  } finally {
    lock.releaseLock();
  }
}
