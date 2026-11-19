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

// Spotify から1件ずつ読む。10件ずつ・1秒間隔、断られた分（429 など）は間を空けて最大3回やり直す
function aurFetchEpisodes_(ids, token) {
  var episodes = [], failed = 0, stopped = false;
  for (var i = 0; i < ids.length; i += 10) {
    var chunk = ids.slice(i, i + 10);
    if (stopped) { failed += chunk.length; continue; }
    if (i) Utilities.sleep(1500);
    UrlFetchApp.fetchAll(chunk.map(function (id) {
      return { url: 'https://api.spotify.com/v1/episodes/' + encodeURIComponent(id) + '?market=JP', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } };
    })).forEach(function (r) {
      if (spotifyCooldownNote_(r)) stopped = true;
      if (r.getResponseCode() === 200) episodes.push(JSON.parse(r.getContentText())); else failed++;
    });
  }
  return { episodes: episodes, failed: failed, stopped: stopped };
}

// 純粋: ルールの手がかり語（出演者名・題名の語など）。特別判定のルールは既定の語を使う
function aurRuleTerms_(rule) {
  var t = [].concat(Array.isArray(rule.keywords) ? rule.keywords : (rule.keyword ? [rule.keyword] : []));
  if (rule.seriesTitleCode) t.push(String(rule.seriesTitleCode));
  var special = { 'no-mirai-title-keywords': ['ノーミライ', '農MUSIC', '猟LIFE'], 'ota-safe-confirmed': ['太田匡彦'], 'sato-yo-safe-confirmed': ['佐藤陽'] };
  if (special[rule.matchStrategy]) t = t.concat(special[rule.matchStrategy]);
  return t.map(function (x) { return String(x || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }).filter(function (x) { return x.length >= 2; });
}
// 純粋: 蔵の題名・出演者に手がかり語が入っている回だけに絞る（Spotify への問い合わせを減らす）。語の無いルールが1つでもあれば絞らない
function aurPrefilter_(picked, liteById, rules) {
  var all = [], open = false;
  rules.forEach(function (r) { var t = aurRuleTerms_(r); if (!t.length) open = true; all = all.concat(t); });
  if (open) return picked;
  return picked.filter(function (p) {
    var row = liteById[p.ep] || [], text = String((row[3] || '') + ' ' + (row[4] || '')).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
    return all.some(function (t) { return text.indexOf(t) >= 0; });
  });
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
  var until = spotifyCooldownUntil_(); if (until) return { status: 'SPOTIFY_COOLDOWN', until: until };
  var lite = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + si.lite), liteById = {};
  lite.forEach(function (r) { liteById[r[0]] = r; });
  var picked = aurPrefilter_(aurPickLibrary_(lite, si.shows || [], LIBRARY_PLAYLIST_SHOW_IDS_, wantShows, AUR_SINCE_), liteById, rules);
  var lookup = shelfLibraryLookup_(picked.map(function (p) { return p.ep; }), function (u) { return libraryPlaylistFetchJson_(u); });
  var ids = picked.map(function (p) { return lookup[p.ep] && lookup[p.ep].spotifyId; }).filter(Boolean);
  var got = aurFetchEpisodes_(ids, token), episodes = got.episodes, failed = got.failed;
  // 一部しか読めなかった時は書き込まない（取りこぼしたまま「完了」にしない）
  if (got.stopped || failed) write = false;
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

if (typeof module !== 'undefined') module.exports = { aurPickLibrary_: aurPickLibrary_, aurPlan_: aurPlan_, aurRuleTerms_: aurRuleTerms_, aurPrefilter_: aurPrefilter_ };
