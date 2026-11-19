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
// 作業台の J列（自動育成: 番組）・K列（自動育成: 題名の語）からも規則を作る。投稿フォームで指定でき、管理人がシートで直せる。
var LIBRARY_PLAYLIST_SHOW_IDS_ = {
  'ニュースの現場から': '392h0MYfvMTndEVzf2cOvC', 'ニュースの学校': '2uG9W6CnsaNi87AfSuGe8r', '報談': '5Dt1uyQaJpM6hPV8aEMP3R', 'スポンジ': '7euH6hzudIdp61JRSi9E8w',
  'MEDIA TALK': '0yhef9ORZkUZs9ZeotdCSY', 'こどもそうだんしつ': '1KExdSsjQnatS4TdseGoC0', 'ドーナツ': '0341I5UOUrJgm7KEvNGInZ'
};
// 純粋: 作業台の行 [URL, 題名, …, J番組, K語] → 規則
function libraryPlaylistRuleFromRow_(row) {
  var m = String(row[0] || '').match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/), show = String(row[9] || '').trim(), word = String(row[10] || '').trim();
  if (!m || !LIBRARY_PLAYLIST_SHOW_IDS_[show] || libraryPlaylistNz_(word).length < 2) return null;
  return { key: 'sheet-' + m[1], name: String(row[1] || '').trim() || m[1], playlistId: m[1], show: show, showId: LIBRARY_PLAYLIST_SHOW_IDS_[show], titleIncludes: word };
}
function libraryPlaylistRules_() {
  var rules = LIBRARY_PLAYLIST_RULES_.slice(), seen = {};
  rules.forEach(function (r) { seen[r.playlistId] = true; });
  try {
    var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), WORK_SHEET_NAME);
    if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 11).getDisplayValues().forEach(function (row) {
      var r = libraryPlaylistRuleFromRow_(row); if (r && !seen[r.playlistId]) { seen[r.playlistId] = true; rules.push(r); }
    });
  } catch (e) {}
  return rules;
}
// 直近の同期で「育っている」と確認できたプレイリスト（楽育ち表示用）
function libraryPlaylistGrowingIds_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_GROWING') || '{}'); } catch (e) { return {}; }
}
function libraryPlaylistMarkGrowing_(rule, ok) {
  var P = PropertiesService.getScriptProperties(), m = libraryPlaylistGrowingIds_();
  if (ok) m[rule.playlistId] = new Date().toISOString().slice(0, 16); else delete m[rule.playlistId];
  P.setProperty('LIBRARY_PLAYLIST_GROWING', JSON.stringify(m));
}
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

// Spotify API でエピソードの番組IDと題名を読む（1件ずつ。まとめ取り /v1/episodes?ids= は 403 になるため既存の1件取得を使う）
function libraryPlaylistVerify_(ids) {
  var out = {};
  ids.forEach(function (id) { var e = fetchSpotifyEpisodeFromWebApi(id); if (e && e.showId) out[id] = { name: e.episodeTitle, showId: e.showId }; });
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
  var verified = libraryPlaylistVerify_(ids), existing = libraryPlaylistExisting_(rule.playlistId, token);
  var plan = libraryPlaylistPlan_(rule, picked, lookup, verified, existing);
  var report = { rule: rule.key, playlist: rule.name, write: !!write, access: access, targets: picked.length, withSpotify: ids.length,
    add: plan.add.map(function (a) { return a.ep + ' ' + a.date + ' ' + a.name; }), already: plan.already.length, missing: plan.missing, hold: plan.hold };
  if (!write) { report.status = 'DRY_RUN'; return report; }
  if (!access || !access.editable) { report.status = 'NO_EDIT_PERMISSION'; libraryPlaylistMarkGrowing_(rule, false); return report; }
  var inList = picked.filter(function (p) { return plan.already.indexOf(p.ep) >= 0; }).map(function (p) { return p.date; }).sort();
  libraryPlaylistMarkGrowing_(rule, true);
  if (!plan.add.length) { report.status = 'OK_NO_CHANGE'; report.latest = libraryPlaylistTouchLatest_(rule, inList[inList.length - 1]); return report; }
  var batch = plan.add.slice(0, LIBRARY_PLAYLIST_MAX_ADD_), added = addAutoPlaylistEpisodesBatch_({ playlistId: rule.playlistId, name: rule.name }, token, batch);
  // 読み戻し: 追加したはずの回が全部プレイリストにあるか
  var after = libraryPlaylistExisting_(rule.playlistId, token), lost = batch.filter(function (a) { return !after[a.uri]; }).map(function (a) { return a.ep; });
  if (lost.length) { P.setProperty(stopKey, new Date().toISOString() + ' 読み戻し不一致 ' + lost.join(' ')); report.status = 'READBACK_MISMATCH_STOPPED'; report.lost = lost; return report; }
  var dates = inList.concat(batch.map(function (a) { return a.date; })).sort();
  report.latest = libraryPlaylistTouchLatest_(rule, dates[dates.length - 1]);
  report.status = 'OK'; report.added = added && added.addedCount; report.more = plan.add.length > batch.length; return report;
}

// 作業台のこのプレイリストの行の「最終更新日」（F列）を、プレイリストに入っている一番新しい回の日付にする（空か古い時だけ）
function libraryPlaylistTouchLatest_(rule, newestDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(newestDate || ''))) return '';
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), WORK_SHEET_NAME); if (!sh || sh.getLastRow() < 2) return '';
  var urls = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < urls.length; i++) {
    if (String(urls[i][0]).indexOf('/playlist/' + rule.playlistId) < 0) continue;
    var cell = sh.getRange(i + 2, 6), cur = String(cell.getDisplayValue() || '');
    if (!cur || cur < newestDate) cell.setValue(newestDate);
    return newestDate;
  }
  return '';
}

function libraryPlaylistSyncAll_() {
  var write = PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_WRITE') === 'ON';
  if (!write) return { status: 'WRITE_OFF' };   // 承認前は毎時の処理では何もしない（確認は LIBRARY_PLAYLIST_DRY_RUN で）
  return libraryPlaylistRules_().map(function (rule) {
    try { return libraryPlaylistSyncOne_(rule, true); } catch (e) { return { rule: rule.key, status: 'ERROR', error: String(e && e.message || e).slice(0, 300) }; }
  });
}

// 管理人が手で動かす用
// 投稿直後に、その1件だけすぐ育てる（投稿で番組・題名の語が指定された時）
function libraryPlaylistSyncByUrl_(url) {
  if (PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_WRITE') !== 'ON') return { status: 'WRITE_OFF' };
  var m = String(url || '').match(/playlist\/([A-Za-z0-9]{22})/); if (!m) return { status: 'NO_PLAYLIST' };
  var rule = libraryPlaylistRules_().filter(function (r) { return r.playlistId === m[1]; })[0];
  return rule ? libraryPlaylistSyncOne_(rule, true) : { status: 'NO_RULE' };
}
function LIBRARY_PLAYLIST_DRY_RUN() { var r = libraryPlaylistRules_().map(function (rule) { return libraryPlaylistSyncOne_(rule, false); }); Logger.log(JSON.stringify(r, null, 1)); return r; }
function LIBRARY_PLAYLIST_WRITE_ON() { PropertiesService.getScriptProperties().setProperty('LIBRARY_PLAYLIST_WRITE', 'ON'); Logger.log('ON'); }
function LIBRARY_PLAYLIST_WRITE_OFF() { PropertiesService.getScriptProperties().deleteProperty('LIBRARY_PLAYLIST_WRITE'); Logger.log('OFF'); }
function LIBRARY_PLAYLIST_RUN_NOW() { var r = libraryPlaylistSyncAll_(); Logger.log(JSON.stringify(r, null, 1)); return r; }

if (typeof module !== 'undefined') module.exports = { libraryPlaylistPick_: libraryPlaylistPick_, libraryPlaylistPlan_: libraryPlaylistPlan_, libraryPlaylistRuleFromRow_: libraryPlaylistRuleFromRow_, LIBRARY_PLAYLIST_RULES_: LIBRARY_PLAYLIST_RULES_ };
