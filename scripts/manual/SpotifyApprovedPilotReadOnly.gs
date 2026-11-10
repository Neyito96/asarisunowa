/** NOT DEPLOYED. Fixed-target READ_ONLY resource probe; contains no playlist write. */
function inspectApprovedSpotifyConnection20261022() {
  const started = Date.now();
  const report = {
    mode: 'READ_ONLY_SPOTIFY_CONNECTION', startedAt: new Date().toISOString(),
    epId: 'EP-00004', uri: 'spotify:episode:6opJ4Ig4s7CTY9fRqGEHd2',
    playlistId: '4FiVIwysKDtLqEXfkfhu2O', playlistName: 'リス田｜自動更新テスト',
    status: 'NOT_EXECUTED', api: [], beforeCount: null, targetPresent: null,
    ownerVerified: null, grantedScopes: 'UNVERIFIED',
    requiredScopes: ['playlist-read-private', 'playlist-modify-public OR playlist-modify-private'],
    spotifyPostAttempts: 0, sheetWrites: 0, triggerChanges: 0, propertyWrites: 0
  };
  const finish = function(status) {
    report.status = status; report.finishedAt = new Date().toISOString();
    Logger.log(JSON.stringify(report)); return report;
  };
  if (ScriptApp.getScriptId() !== '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9') return finish('HOLD_WRONG_PROJECT');
  if (typeof getSpotifyUserAccessToken !== 'function') return finish('HOLD_AUTH_HELPER_MISSING');
  // The supplied live helper logs raw refresh errors. Require its one-block log fix.
  if (getSpotifyUserAccessToken.toString().indexOf('Spotify refresh error: ') >= 0) return finish('HOLD_RAW_REFRESH_LOG');
  let token;
  try { token = getSpotifyUserAccessToken(); } catch (_) { return finish('HOLD_AUTH_EXCEPTION'); }
  if (!token) return finish('AUTH_UNAVAILABLE');
  const pid = report.playlistId;
  const fail = function(code) { throw new Error(code); };
  const get = function(path) {
    if (Date.now() - started > 210000) fail('HOLD_TIME_BUDGET');
    if (path !== '/me' && path.indexOf('/playlists/' + pid + '?') !== 0 && path.indexOf('/playlists/' + pid + '/items?') !== 0 && path !== '/episodes/6opJ4Ig4s7CTY9fRqGEHd2?market=JP') fail('HOLD_TARGET');
    const event = { at: new Date().toISOString(), method: 'GET', endpoint: path, httpStatus: null };
    report.api.push(event);
    let response;
    try {
      response = UrlFetchApp.fetch('https://api.spotify.com/v1' + path, {
        method: 'get', muteHttpExceptions: true, followRedirects: false,
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
      });
    } catch (_) { fail('STOP_NETWORK'); }
    const status = response.getResponseCode(); event.httpStatus = status;
    if (status !== 200) fail(status === 403 ? 'STOP_403' : status === 401 ? 'STOP_401' : status === 429 ? 'STOP_429' : 'STOP_HTTP');
    try { return JSON.parse(response.getContentText()); } catch (_) { fail('STOP_INVALID_JSON'); }
  };
  try {
    const me = get('/me');
    if (!me || !me.id) fail('HOLD_USER_IDENTITY');
    const fields = '?fields=id,name,public,collaborative,owner(id),snapshot_id';
    const before = get('/playlists/' + pid + fields);
    if (before.id !== pid || before.name !== report.playlistName || !before.snapshot_id || typeof before.public !== 'boolean') fail('HOLD_PLAYLIST_IDENTITY');
    report.ownerVerified = before.owner && before.owner.id === me.id;
    report.requiredWriteScope = before.public ? 'playlist-modify-public' : 'playlist-modify-private';
    report.collaborative = before.collaborative === true;
    let offset = 0, total = null, occurrences = 0, complete = false;
    for (let page = 0; page < 100; page++) {
      const body = get('/playlists/' + pid + '/items?limit=50&offset=' + offset + '&additional_types=episode');
      if (!body || !Array.isArray(body.items) || !Number.isInteger(body.total) || body.total < 0 || body.items.length > 50 || body.offset !== undefined && body.offset !== offset) fail('HOLD_INVALID_PAGE');
      if (total !== null && body.total !== total) fail('HOLD_PLAYLIST_CHANGED');
      total = body.total;
      for (const entry of body.items) {
        const item = entry && (entry.item || entry.track);
        if (!item || !/^[A-Za-z0-9]{22}$/.test(item.id || '') || !['episode', 'track'].includes(item.type)) fail('HOLD_UNAVAILABLE_ITEM');
        if (item.type === 'episode' && item.id === '6opJ4Ig4s7CTY9fRqGEHd2') occurrences++;
      }
      offset += body.items.length;
      if (offset > total) fail('HOLD_INVALID_TOTAL');
      if (offset === total) { complete = true; break; }
      if (!body.items.length) fail('HOLD_INCOMPLETE_PAGE');
    }
    if (!complete) fail('HOLD_PAGE_LIMIT');
    const after = get('/playlists/' + pid + fields);
    if (after.id !== pid || after.name !== before.name || after.snapshot_id !== before.snapshot_id || !after.owner || !before.owner || after.owner.id !== before.owner.id || after.public !== before.public) fail('HOLD_PLAYLIST_CHANGED');
    report.beforeCount = total; report.targetPresent = occurrences > 0; report.targetOccurrences = occurrences;
    report.snapshotId = after.snapshot_id;
    const e = get('/episodes/6opJ4Ig4s7CTY9fRqGEHd2?market=JP');
    if (!e || e.id !== '6opJ4Ig4s7CTY9fRqGEHd2') fail('HOLD_EPISODE_IDENTITY');
    report.episode = {id:e.id, title:e.name, showId:e.show && e.show.id, releaseDate:e.release_date, releaseDatePrecision:e.release_date_precision, playable:e.is_playable === true};
    // GET success/ownership does not prove actual OAuth modify scope or POST permission.
    return finish(report.ownerVerified ? 'CONNECTED_READ_ONLY_OWNER' : 'CONNECTED_READ_ONLY_WRITE_HELD');
  } catch (error) {
    const status = String(error && error.message || '');
    if (status === 'STOP_403') report.cause = 'FORBIDDEN_ROOT_CAUSE_UNCONFIRMED';
    return finish(/^(STOP|HOLD)_[A-Z0-9_]+$/.test(status) ? status : 'HOLD_UNEXPECTED');
  }
}
