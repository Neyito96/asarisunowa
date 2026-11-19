// LibraryPlaylist.js — 蔵（朝リスの田）を正本に、既存の Spotify プレイリストへ該当回を育てる（Issue #271・2026-11-19 管理人確定仕様）。
// 対象回は蔵の公開データ（題名・番組）で選び、Spotify のエピソードIDは蔵（＝V2台帳）の既存リンクだけを使う。Spotify を巡回して探さない。
// 追加の前に Spotify API でその回の番組IDと題名を読み、蔵と一致しない回は保留（誤照合防止）。
// 既にプレイリストにある回は入れない（重複防止）。既存の項目は動かさない・消さない。書いた後に読み戻して確認し、合わなければ停止する。
// 書込は Script Property LIBRARY_PLAYLIST_WRITE=ON の時だけ（管理人承認後）。それまでは確認（dry-run）だけ。
// 毎時の自動更新（runAutoUpdateBackfillHourlyV1・既存トリガー）から呼ばれる。新しいトリガーは作らない。
// 新しいプレイリストを足すときは LIBRARY_PLAYLIST_RULES_ に1行足すだけ（番組・題名の語・プレイリストID）。
var LIBRARY_PLAYLIST_RULES_ = [
  { key: 'posusume', name: 'ポすすめ', playlistId: '20eSUPkdsSN56eEC8dg2Lq', show: 'ドーナツ', showId: '0341I5UOUrJgm7KEvNGInZ', titleIncludes: '（ポすすめ）' }
];
var LIBRARY_PLAYLIST_DATA_ = 'https://neyito96.github.io/asarisunowa/library/data/';
var LIBRARY_PLAYLIST_MAX_ADD_ = 20;

function libraryPlaylistNz_(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').trim(); }

// 純粋: 蔵の索引（lite 行 [id, 番組番号, 日時, 題名, 出演者, 音声]）から規則に合う回を古い順に
function libraryPlaylistPick_(rule, shows, liteRows) {
  var want = libraryPlaylistNz_(rule.titleIncludes);
  return liteRows.filter(function (r) { return shows[r[1]] === rule.show && libraryPlaylistNz_(r[3]).indexOf(want) >= 0; })
    .sort(function (a, b) { return String(a[2]).localeCompare(String(b[2])) || String(a[0]).localeCompare(String(b[0])); })
    .map(function (r) { return { ep: r[0], date: String(r[2]).slice(0, 10), title: r[3] }; });
}

// 純粋: 追加計画。蔵のID→Spotify ID、Spotify側の確認結果、プレイリストの既存URIから
//   add: 追加する回（古い順） / already: 既にある / missing: 蔵にSpotify URLが無い / hold: Spotify側の番組・題名が蔵と違う
function libraryPlaylistPlan_(rule, picked, lookup, verified, existingUris) {
  var out = { add: [], already: [], missing: [], hold: [] }, seen = {};
  picked.forEach(function (p) {
    var x = lookup[p.ep];
    if (!x || !x.spotifyId) { out.missing.push(p.ep); return; }
    var uri = 'spotify:episode:' + x.spotifyId, v = verified[x.spotifyId];
    if (!v || v.showId !== rule.showId || libraryPlaylistNz_(v.name) !== libraryPlaylistNz_(p.title)) {
      out.hold.push({ ep: p.ep, reason: !v ? 'Spotifyで回を確認できない' : v.showId !== rule.showId ? 'Spotify上の番組が違う' : 'Spotify上の題名が違う' }); return;
    }
    if (existingUris[uri] || seen[uri]) { out.already.push(p.ep); return; }
    seen[uri] = true;
    out.add.push({ id: x.spotifyId, uri: uri, name: p.title, ep: p.ep, date: p.date });
  });
  return out;
}

function libraryPlaylistFetchJson_(url) {
  var res = UrlFetchApp.fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('蔵データ取得失敗 ' + res.getResponseCode() + ' ' + url.replace(LIBRARY_PLAYLIST_DATA_, ''));
  return JSON.parse(res.getContentText());
}

// Spotify API でエピソードの番組IDと題名を読む（50件ずつ）
function libraryPlaylistVerify_(ids, token) {
  var out = {};
  for (var i = 0; i < ids.length; i += 50) {
    var res = fetchSpotifyReadWithRetry_('https://api.spotify.com/v1/episodes?market=JP&ids=' + ids.slice(i, i + 50).join(','),
      { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }, 'LibraryPlaylist episodes');
    if (res.getResponseCode() !== 200) throw new Error('Spotifyエピソード確認失敗 ' + res.getResponseCode());
    (JSON.parse(res.getContentText()).episodes || []).forEach(function (e) { if (e && e.id) out[e.id] = { name: e.name, showId: e.show && e.show.id }; });
  }
  return out;
}

function libraryPlaylistExisting_(playlistId, token) {
  var m = {};
  getAllSpotifyPlaylistItems_(playlistId, token).forEach(function (it) { var u = it && (it.item || it.track) && (it.item || it.track).uri; if (u) m[String(u)] = true; });
  return m;
}

function libraryPlaylistSyncOne_(rule, write) {
  var P = PropertiesService.getScriptProperties(), stopKey = 'LIBRARY_PLAYLIST_STOP_' + rule.key;
  if (write && P.getProperty(stopKey)) return { rule: rule.key, status: 'STOPPED', reason: P.getProperty(stopKey) };
  var manifest = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json'), si = manifest.searchIndex || {};
  var picked = libraryPlaylistPick_(rule, si.shows || [], libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + si.lite));
  var lookup = shelfLibraryLookup_(picked.map(function (p) { return p.ep; }), function (u) { return libraryPlaylistFetchJson_(u); });
  var token = getSpotifyUserAccessToken();
  if (!token) return { rule: rule.key, status: 'NO_TOKEN' };
  var access = inspectAutoUpdatePlaylistAccessV1_(rule.playlistId, token);
  var ids = picked.map(function (p) { return lookup[p.ep] && lookup[p.ep].spotifyId; }).filter(Boolean);
  var verified = libraryPlaylistVerify_(ids, token), existing = libraryPlaylistExisting_(rule.playlistId, token);
  var plan = libraryPlaylistPlan_(rule, picked, lookup, verified, existing);
  var report = { rule: rule.key, playlist: rule.name, write: !!write, access: access, targets: picked.length, withSpotify: ids.length,
    add: plan.add.map(function (a) { return a.ep + ' ' + a.date + ' ' + a.name; }), already: plan.already.length, missing: plan.missing, hold: plan.hold };
  if (!write) { report.status = 'DRY_RUN'; return report; }
  if (!access || !access.editable) { report.status = 'NO_EDIT_PERMISSION'; return report; }
  if (!plan.add.length) { report.status = 'OK_NO_CHANGE'; return report; }
  var batch = plan.add.slice(0, LIBRARY_PLAYLIST_MAX_ADD_), added = addAutoPlaylistEpisodesBatch_({ playlistId: rule.playlistId, name: rule.name }, token, batch);
  // 読み戻し: 追加したはずの回が全部プレイリストにあるか
  var after = libraryPlaylistExisting_(rule.playlistId, token), lost = batch.filter(function (a) { return !after[a.uri]; }).map(function (a) { return a.ep; });
  if (lost.length) { P.setProperty(stopKey, new Date().toISOString() + ' 読み戻し不一致 ' + lost.join(' ')); report.status = 'READBACK_MISMATCH_STOPPED'; report.lost = lost; return report; }
  report.status = 'OK'; report.added = added && added.addedCount; report.more = plan.add.length > batch.length; return report;
}

function libraryPlaylistSyncAll_() {
  var write = PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_WRITE') === 'ON';
  if (!write) return { status: 'WRITE_OFF' };   // 承認前は毎時の処理では何もしない（確認は LIBRARY_PLAYLIST_DRY_RUN で）
  return LIBRARY_PLAYLIST_RULES_.map(function (rule) {
    try { return libraryPlaylistSyncOne_(rule, true); } catch (e) { return { rule: rule.key, status: 'ERROR', error: String(e && e.message || e).slice(0, 300) }; }
  });
}

// 管理人が手で動かす用
function LIBRARY_PLAYLIST_DRY_RUN() { var r = LIBRARY_PLAYLIST_RULES_.map(function (rule) { return libraryPlaylistSyncOne_(rule, false); }); Logger.log(JSON.stringify(r, null, 1)); return r; }
function LIBRARY_PLAYLIST_WRITE_ON() { PropertiesService.getScriptProperties().setProperty('LIBRARY_PLAYLIST_WRITE', 'ON'); Logger.log('ON'); }
function LIBRARY_PLAYLIST_WRITE_OFF() { PropertiesService.getScriptProperties().deleteProperty('LIBRARY_PLAYLIST_WRITE'); Logger.log('OFF'); }
function LIBRARY_PLAYLIST_RUN_NOW() { var r = libraryPlaylistSyncAll_(); Logger.log(JSON.stringify(r, null, 1)); return r; }

if (typeof module !== 'undefined') module.exports = { libraryPlaylistPick_: libraryPlaylistPick_, libraryPlaylistPlan_: libraryPlaylistPlan_, LIBRARY_PLAYLIST_RULES_: LIBRARY_PLAYLIST_RULES_ };
