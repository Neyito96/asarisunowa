// AutoUpdateRecovery.js — 旧自動更新の取りこぼし回の回収（2026-11-19）。
// 原因: Spotify のまとめ取得 /v1/episodes?ids= が 403 になり、旧自動更新（AutoUpdateAutomationV1）は
//   候補回を見つけても0件扱いで追加せず、「ここまで確認済み」の境界だけ進めていた（AutoUpdateAutomationV1 側は修正済み）。
// 回収方法: 蔵（朝リスの田）の回一覧から期間内・各ルールの番組の回を選び、Spotify から1件ずつ実データを読み、
//   各ルールの既存の判定 matchesAutoPlaylistRule_ にかける。新しい判定は作らない。既にリストにある回は入れない。
// 書込は AUTO_UPDATE_RECOVERY_WRITE を管理人承認後に手で実行した時だけ。毎時の処理からは呼ばない。
var AUR_SINCE_ = '2026-08-01';
var AUR_MAX_ADD_PER_RULE_ = 20;

// 純粋: 蔵 lite 行 [id, 番組番号, 日時, 題名, …] → 期間内・指定番組の回（古い順）
function aurPickLibrary_(liteRows, shows, showIdByName, wantShowIds, since) {
  return (liteRows || []).filter(function (r) {
    var sid = showIdByName[shows[r[1]]];
    return sid && wantShowIds.indexOf(sid) >= 0 && String(r[2]).slice(0, 10) >= since;
  }).sort(function (a, b) { return String(a[2]).localeCompare(String(b[2])); })
    .map(function (r) { return { ep: r[0], date: String(r[2]).slice(0, 10), title: r[3] }; });
}

// 純粋: Spotify 実データ・ルール判定・既存URIから追加計画
function aurPlan_(rule, episodes, existingUris, matcher) {
  var showIds = getAutoPlaylistShowIds_(rule), seen = {};
  return (episodes || []).filter(function (e) {
    if (!e || !e.id || e.is_playable === false) return false;
    if (showIds.indexOf(String(e.show && e.show.id || '')) < 0) return false;
    var uri = String(e.uri || ('spotify:episode:' + e.id));
    if (existingUris[uri] || seen[uri]) return false;
    if (!matcher(e, rule)) return false;
    seen[uri] = true; return true;
  }).sort(function (a, b) { return String(a.release_date).localeCompare(String(b.release_date)); })
    .map(function (e) { return { id: String(e.id), uri: String(e.uri || ('spotify:episode:' + e.id)), name: String(e.name || ''), release_date: String(e.release_date || '') }; });
}

function aurRules_() {
  return loadAutoUpdateRuntimeRulesV1_().filter(function (rule) {
    return rule && rule.enabled !== false && rule.lifecycleStatus !== 'human_deleted' && rule.bootstrapPending !== true &&
      !(typeof isThemeV3RuntimeRule_ === 'function' && isThemeV3RuntimeRule_(rule));
  }).map(function (rule) { return normalizeAutoUpdateRuntimeRuleV1_(rule); });
}

function aurRun_(write) {
  var token = getSpotifyUserAccessToken(); if (!token) throw new Error('Spotifyトークンなし');
  var rules = aurRules_(), wantShows = [];
  rules.forEach(function (r) { getAutoPlaylistShowIds_(r).forEach(function (s) { if (wantShows.indexOf(s) < 0) wantShows.push(s); }); });
  var manifest = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json'), si = manifest.searchIndex || {};
  var picked = aurPickLibrary_(libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + si.lite), si.shows || [], LIBRARY_PLAYLIST_SHOW_IDS_, wantShows, AUR_SINCE_);
  var lookup = shelfLibraryLookup_(picked.map(function (p) { return p.ep; }), function (u) { return libraryPlaylistFetchJson_(u); });
  var ids = picked.map(function (p) { return lookup[p.ep] && lookup[p.ep].spotifyId; }).filter(Boolean);
  var res = plmFetchChunked_(ids.map(function (id) {
    return { url: 'https://api.spotify.com/v1/episodes/' + encodeURIComponent(id) + '?market=JP', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } };
  }));
  var episodes = [], failed = 0;
  res.forEach(function (r) { if (r.getResponseCode() === 200) episodes.push(JSON.parse(r.getContentText())); else failed++; });
  var report = { since: AUR_SINCE_, libraryEpisodes: picked.length, withSpotify: ids.length, fetched: episodes.length, fetchFailed: failed, write: !!write, rules: [] };
  rules.forEach(function (rule) {
    var item = { name: rule.name || rule.key, playlistId: rule.playlistId };
    try {
      var existing = libraryPlaylistExisting_(rule.playlistId, token);
      var plan = aurPlan_(rule, episodes, existing, matchesAutoPlaylistRule_);
      item.add = plan.map(function (e) { return e.release_date + ' ' + e.name; });
      if (write && plan.length) {
        var batch = plan.slice(0, AUR_MAX_ADD_PER_RULE_);
        assertAutoPlaylistSheetLinkBeforeWrite_(rule);
        var added = addAutoPlaylistEpisodesIndividually_(rule, token, batch);
        var after = libraryPlaylistExisting_(rule.playlistId, token);
        item.added = added.addedCount; item.failed = added.failedCount;
        item.lost = batch.filter(function (e) { return !after[e.uri]; }).map(function (e) { return e.name; });
        if (added.addedCount > 0) updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(added.addedEpisodes));
      }
    } catch (e) { item.error = String(e && e.message || e).slice(0, 200); }
    if ((item.add && item.add.length) || item.error) report.rules.push(item);
  });
  report.rulesChecked = rules.length;
  return report;
}

// 管理人が手で動かす用
function AUTO_UPDATE_RECOVERY_DRY_RUN() { var r = aurRun_(false); Logger.log(JSON.stringify(r, null, 1)); return r; }
function AUTO_UPDATE_RECOVERY_WRITE() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) throw new Error('別の自動更新処理が実行中です');
  try { var r = aurRun_(true); Logger.log(JSON.stringify(r, null, 1)); return r; } finally { lock.releaseLock(); }
}

if (typeof module !== 'undefined') module.exports = { aurPickLibrary_: aurPickLibrary_, aurPlan_: aurPlan_ };
