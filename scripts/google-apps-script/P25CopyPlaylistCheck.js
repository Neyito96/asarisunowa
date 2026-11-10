// COPY-only READ-ONLY playlist identity/membership check. Spotify GET only.
// Logs and results contain status codes and counts only (no tokens, no ids of people).
// Depends on (already in COPY GAS): p25CopySessionConfig20261107_, p25CopyIo_,
// Script Property P25_COPY_SPOTIFY_ACCESS_TOKEN. Not installed until the admin approves.
var P25_COPY_CHECK_TARGET_ = {playlistId: "1N0T7tMxPMKxXy77C0RPMw", episodeId: "2bQehZDGaWmylhP7x6iyeR"};

// Pure decision function (unit-tested). me = GET /me body, before/after = playlist bodies.
function p25CopyPlaylistVerify_(target, copyPlaylistIds, me, before, after, items) {
  const problems = [];
  if (!Array.isArray(copyPlaylistIds) || copyPlaylistIds.length !== 1 || copyPlaylistIds[0] !== target.playlistId) problems.push("ALLOWLIST_MISMATCH");
  if (!me || typeof me.id !== "string" || !me.id) problems.push("ME_UNAVAILABLE");
  if (!before || !after) problems.push("PLAYLIST_UNAVAILABLE");
  else {
    if (before.id !== target.playlistId) problems.push("ID_MISMATCH");
    if (!before.owner || typeof before.owner.id !== "string" || !before.owner.id) problems.push("OWNER_MISSING");
    else if (me && before.owner.id !== me.id) problems.push("OWNER_NOT_AUTHORIZED_ACCOUNT");
    if (before.public !== false) problems.push("NOT_PRIVATE");
    if (before.collaborative !== false) problems.push("COLLABORATIVE_OR_UNKNOWN");
    if (!before.snapshot_id || before.snapshot_id !== after.snapshot_id) problems.push("SNAPSHOT_CHANGED_OR_MISSING");
  }
  if (!Array.isArray(items)) problems.push("MEMBERSHIP_UNAVAILABLE");
  return {status: problems.length ? "STOP" : "PASS", problems: problems, spotifyWrite: false,
    memberCount: Array.isArray(items) ? items.length : null,
    targetPresent: Array.isArray(items) ? items.indexOf(target.episodeId) >= 0 : null};
}

// Pure orchestration with injected GET (unit-tested). get(path) returns {code, body}.
function p25CopyPlaylistCheckRun_(target, copyPlaylistIds, get) {
  const fail = function(c) { return {status: "STOP", problems: ["HTTP_" + c], spotifyWrite: false, memberCount: null, targetPresent: null}; };
  const me = get("me"); if (me.code !== 200) return fail(me.code);
  const f = "playlists/" + target.playlistId;
  const b = get(f + "?fields=id,public,collaborative,owner(id),snapshot_id"); if (b.code !== 200) return fail(b.code);
  const ids = []; let offset = 0;
  while (true) {
    const p = get(f + "/items?market=JP&limit=50&offset=" + offset); if (p.code !== 200) return fail(p.code);
    if (!p.body || !Array.isArray(p.body.items)) return p25CopyPlaylistVerify_(target, copyPlaylistIds, me.body, b.body, b.body, null);
    for (let i = 0; i < p.body.items.length; i++) { const it = p.body.items[i].item || p.body.items[i].track; if (!it || !it.id) return p25CopyPlaylistVerify_(target, copyPlaylistIds, me.body, b.body, b.body, null); ids.push(it.id); }
    if (!p.body.next) break; if (!p.body.items.length) return p25CopyPlaylistVerify_(target, copyPlaylistIds, me.body, b.body, b.body, null);
    offset += p.body.items.length;
  }
  const a = get(f + "?fields=snapshot_id"); if (a.code !== 200) return fail(a.code);
  return p25CopyPlaylistVerify_(target, copyPlaylistIds, me.body, b.body, a.body, ids);
}

// Entry point (no arguments). Run from the editor; expected: {"status":"PASS",...,"spotifyWrite":false}
function P25_COPY_VERIFY_PLAYLIST_20261107() {
  const config = p25CopySessionConfig20261107_();
  p25CopyIo_(config); // COPY isolation guard (script id, COPY sheets)
  const token = PropertiesService.getScriptProperties().getProperty("P25_COPY_SPOTIFY_ACCESS_TOKEN");
  if (!token) throw new Error("COPY_TOKEN_REQUIRED");
  const get = function(path) {
    const res = UrlFetchApp.fetch("https://api.spotify.com/v1/" + path, {method: "get", muteHttpExceptions: true, headers: {Authorization: "Bearer " + token}});
    let body = null; try { body = JSON.parse(res.getContentText() || "null"); } catch (_) { body = null; }
    return {code: res.getResponseCode(), body: body};
  };
  const result = p25CopyPlaylistCheckRun_(P25_COPY_CHECK_TARGET_, config.copyPlaylistIds, get);
  console.log(JSON.stringify(result));
  return result;
}

// READ-ONLY (no Spotify): confirms the official feed lists the target GUID. Outputs booleans and counts only.
function P25_COPY_FEED_CHECK_20261110() {
  const config = p25CopySessionConfig20261107_();
  p25CopyIo_(config);
  const out = {feeds: [], targetGuidFound: false, spotifyWrite: false};
  (config.officialFeedUrls || []).forEach(function(url) {
    const r = {hostOk: /^https:\/\/(?:omny\.fm|www\.omnycontent\.com|feeds\.megaphone\.fm)\//.test(url), code: null, items: 0};
    if (r.hostOk) {
      const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true}); r.code = res.getResponseCode();
      if (r.code === 200) {
        const ch = XmlService.parse(res.getContentText()).getRootElement().getChild("channel");
        const items = ch ? ch.getChildren("item") : [];
        r.items = items.length;
        items.forEach(function(it) { if (it.getChildText("guid") === "d7ea556a-cd9b-41ae-91d1-b4fa00731960") out.targetGuidFound = true; });
      }
    }
    out.feeds.push(r);
  });
  console.log(JSON.stringify(out)); return out;
}
