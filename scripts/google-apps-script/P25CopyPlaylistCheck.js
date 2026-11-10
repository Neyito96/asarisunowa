// COPY-only READ-ONLY playlist identity check. Spotify GET only. Never logs credentials.
// Not installed anywhere until the administrator explicitly approves a COPY GAS change.
function p25CopyPlaylistVerify_(expected, meta, copyPlaylistIds) {
  const problems = [];
  if (!expected || !/^[A-Za-z0-9]{22}$/.test(expected.playlistId || "")) problems.push("EXPECTED_ID_INVALID");
  if (!expected || !expected.ownerId) problems.push("EXPECTED_OWNER_REQUIRED");
  if (!Array.isArray(copyPlaylistIds) || copyPlaylistIds.length !== 1 || copyPlaylistIds[0] !== expected.playlistId) problems.push("ALLOWLIST_MISMATCH");
  if (!meta || typeof meta !== "object") problems.push("META_UNAVAILABLE");
  else {
    if (meta.id !== expected.playlistId) problems.push("ID_MISMATCH");
    if (!meta.owner || meta.owner.id !== expected.ownerId) problems.push("OWNER_MISMATCH");
    if (meta.public !== false) problems.push("NOT_PRIVATE"); // null/true/missing => stop
    if (meta.collaborative === true) problems.push("COLLABORATIVE");
    if (expected.name && meta.name !== expected.name) problems.push("NAME_DIFFERS_INFO"); // informational only
  }
  const blocking = problems.filter(function(p) { return p !== "NAME_DIFFERS_INFO"; });
  return {status: blocking.length ? "STOP" : "PASS", problems: problems, spotifyWrite: false};
}
function P25_COPY_VERIFY_PLAYLIST_20261107() {
  const config = p25CopySessionConfig20261107_();
  p25CopyIo_(config); // isolation: COPY script id, COPY sheets only
  const expected = {playlistId: "1N0T7tMxPMKxXy77C0RPMw", ownerId: config.expectedOwnerId, name: "朝リス Phase25 COPY試験 2026-11-07"};
  const token = PropertiesService.getScriptProperties().getProperty("P25_COPY_SPOTIFY_ACCESS_TOKEN");
  if (!token) throw new Error("COPY_TOKEN_REQUIRED");
  const url = "https://api.spotify.com/v1/playlists/" + expected.playlistId + "?fields=id,name,public,collaborative,owner(id),snapshot_id";
  const res = UrlFetchApp.fetch(url, {method: "get", muteHttpExceptions: true, headers: {Authorization: "Bearer " + token}});
  const code = res.getResponseCode();
  if (code !== 200) { const r = {status: "STOP", problems: ["HTTP_" + code], spotifyWrite: false}; console.log(JSON.stringify(r)); return r; }
  let meta = null;
  try { meta = JSON.parse(res.getContentText()); } catch (_) { meta = null; }
  const result = p25CopyPlaylistVerify_(expected, meta, config.copyPlaylistIds);
  console.log(JSON.stringify(result)); // status/problem codes only
  return result;
}
