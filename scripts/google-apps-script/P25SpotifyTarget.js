// Phase25 Spotify target adapter. Everything Spotify-specific lives here so that the ledger
// search (P25LibraryPipeline.js) stays platform-neutral: Apple Podcasts / LISTEN targets can be
// added later as sibling files with the same four functions. Spotify IDs are a target detail;
// the identity of an episode stays EP-ID/GUID in the ledger.
//
// Nothing in this file writes unless p25SpotifyAdd_ is called, and p25ProdIo_ only calls it
// from inside the ownership gate (see P25ProdIo.js).
function p25SpotifyError_(status, response) {
  const error = new Error("SPOTIFY_HTTP");
  error.status = status;
  try {
    const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
    error.retryAfterSeconds = Number(headers["Retry-After"] || headers["retry-after"] || 60);
  } catch (_) { error.retryAfterSeconds = 60; }
  return error;
}

function p25SpotifyGet_(token, path) {
  const response = UrlFetchApp.fetch("https://api.spotify.com/v1/" + path, {
    method: "get", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw p25SpotifyError_(status, response);
  return JSON.parse(response.getContentText() || "{}");
}

// Complete, consistent episode membership (snapshot checked before/after). Throws on any
// doubt: an unavailable item, a schema surprise or a concurrent change must never be read as "removed".
function p25SpotifyReadMembership_(token, playlistId) {
  const id = encodeURIComponent(playlistId);
  const before = p25SpotifyGet_(token, "playlists/" + id + "?fields=snapshot_id").snapshot_id;
  if (!before) throw new Error("SNAPSHOT_REQUIRED");
  const ids = [];
  let offset = 0;
  while (true) {
    const page = p25SpotifyGet_(token, "playlists/" + id + "/items?market=JP&limit=50&offset=" + offset);
    if (!Array.isArray(page.items)) throw new Error("MEMBERSHIP_SCHEMA");
    page.items.forEach(function(row) {
      const item = row.item || row.track;
      if (!item || !item.id) throw new Error("MEMBERSHIP_UNAVAILABLE_ITEM");
      if (item.type === "episode") ids.push(item.id);
    });
    if (!page.next) break;
    if (!page.items.length) throw new Error("MEMBERSHIP_PAGINATION");
    offset += page.items.length;
  }
  const after = p25SpotifyGet_(token, "playlists/" + id + "?fields=snapshot_id").snapshot_id;
  if (before !== after) throw new Error("MEMBERSHIP_CHANGED_DURING_READ");
  return Array.from(new Set(ids));
}

// The ONLY production Spotify write of Phase25. Callers must hold the ownership gate.
// Appends at the end, so oldest-first input keeps release order.
function p25SpotifyAdd_(token, playlistId, episodeIds) {
  if (!Array.isArray(episodeIds) || !episodeIds.length || episodeIds.length > 50) throw new Error("INVALID_ADD_BATCH");
  episodeIds.forEach(function(id) { if (!/^[A-Za-z0-9]{22}$/.test(String(id))) throw new Error("INVALID_EPISODE_ID"); });
  const response = UrlFetchApp.fetch("https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) + "/items", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    payload: JSON.stringify({ uris: episodeIds.map(function(id) { return "spotify:episode:" + id; }) })
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw p25SpotifyError_(status, response);
  return true;
}

// Read-only: checks that ledger-recorded Spotify episode IDs really exist (and are playable) in Japan.
function p25SpotifyVerifyEpisodes_(token, episodeIds) {
  const found = [], missing = [], unplayable = [];
  for (let offset = 0; offset < episodeIds.length; offset += 50) {
    const chunk = episodeIds.slice(offset, offset + 50);
    const data = p25SpotifyGet_(token, "episodes?market=JP&ids=" + chunk.map(encodeURIComponent).join(","));
    if (!Array.isArray(data.episodes) || data.episodes.length !== chunk.length) throw new Error("EPISODES_SCHEMA");
    data.episodes.forEach(function(episode, i) {
      if (!episode || episode.id !== chunk[i]) missing.push(chunk[i]);
      else if (episode.is_playable === false) unplayable.push(chunk[i]);
      else found.push(chunk[i]);
    });
  }
  return { found: found, missing: missing, unplayable: unplayable };
}

// Creates an EMPTY private playlist for the signed-in operator account. This is a Spotify write, but it
// does not touch any existing playlist and adds no episode. Callers must have passed every approval check.
function p25SpotifyCreatePlaylist_(token, spec) {
  const response = UrlFetchApp.fetch("https://api.spotify.com/v1/me/playlists", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    payload: JSON.stringify({ name: spec.name, description: spec.description || "", public: false, collaborative: false })
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw p25SpotifyError_(status, response);
  const data = JSON.parse(response.getContentText() || "{}");
  if (!/^[A-Za-z0-9]{22}$/.test(String(data.id || ""))) throw new Error("PLAYLIST_CREATE_SCHEMA");
  return { playlistId: data.id, url: "https://open.spotify.com/playlist/" + data.id };
}
