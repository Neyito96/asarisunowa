// LibraryTheme.js — テーマ別プレイリストを「蔵で探す」方式で育てる（2026-11-24 管理人指示・Issue #524）。
// 1) 自動更新申請シートのテーマ別の行（状態「増分自動更新」）のキーワードで、蔵の全回（題名＋概要）を探す。
// 2) Spotify のエピソードIDは蔵（＝V2台帳）の既存リンクだけを使う。Spotify を巡回して探さない。
// 3) 足す前に Spotify API でその回の番組・題名が蔵と同じか確かめる（違えば足さない）。
// 4) 見つけた回はテーマのタブ（Theme V3 の1テーマ1シート）に「採用」で書き足し、Spotify への追加は
//    既存の Theme V3 の仕組み（syncThemeV3Rule_）に任せる。人が「除外」にした回・Spotify から手で消した回は
//    Theme V3 の仕組みで入れ直さない。タブに既にある回は触らない。
// 対象: 2026-11-24 以降に受け付けたテーマ別（北欧・台湾・中南米など以前からのテーマは変えない）。
//      以前のテーマも対象にするときは Script Property LIBRARY_THEME_EXTRA にプレイリストIDをカンマ区切りで足す。
// 書込は Script Property LIBRARY_PLAYLIST_WRITE=ON の時だけ（蔵起点の連載と同じスイッチ）。
// 毎時の自動更新（runAutoUpdateBackfillHourlyV1 → libraryPlaylistSyncAll_）から呼ばれる。新しいトリガーは作らない。

var LIBRARY_THEME_SINCE_ = '2026-11-24';
var LIBRARY_THEME_MAX_VERIFY_ = 40;   // 1回の実行で Spotify に確かめる回数の上限（多い時は次の時間に続き）
// SDGsを話そう の過去回は Spotify では「SDGsを話そう アーカイブ」番組にある（#395）
var LIBRARY_THEME_EXTRA_SHOW_IDS_ = { 'SDGsを話そう': '7vuSolzvNiNwu7UR4lVIwU' };

function libraryThemeNz_(s) { return String(s || '').normalize('NFKC').toLowerCase(); }
function libraryThemeSplitKeywords_(value) {
  return String(value || '').split(/[\n,、，]+/).map(function (k) { return k.trim(); }).filter(Boolean);
}

// 純粋: 自動更新申請の行 [受付日時, URL, 題名, 朝リスネーム, 招待URL, キーワード, 補足, 状態, メモ] → テーマ規則
function libraryThemeRuleFromRequestRow_(row, extraIds) {
  var memo = String(row[8] || ''), status = String(row[7] || '').trim();
  if (!/方式:\s*theme/.test(memo) || status !== '増分自動更新') return null;
  var m = String(row[1] || '').match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/);
  if (!m) return null;
  var d = String(row[0] || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  var received = d ? d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2) : '';
  if (!(received >= LIBRARY_THEME_SINCE_) && (extraIds || []).indexOf(m[1]) < 0) return null;
  var keywords = libraryThemeSplitKeywords_(row[5]);
  if (!keywords.length) return null;
  return { key: 'request-' + m[1], playlistId: m[1], name: String(row[2] || '').trim() || m[1], keywords: keywords };
}

// 純粋: 蔵の索引から、キーワードが題名か概要に入っている回を古い順に
//   liteRows: [id, 番組番号, 日時, 題名, …] / shows: 番組名の配列 / textById: { id: 概要 }
function libraryThemePick_(rule, shows, liteRows, textById) {
  var kws = rule.keywords.map(function (k) { return { raw: k, nz: libraryThemeNz_(k) }; }).filter(function (k) { return k.nz.length >= 2; });
  var out = [];
  liteRows.forEach(function (r) {
    var hay = libraryThemeNz_(String(r[3] || '') + '\n' + String(textById[r[0]] || ''));
    var matched = kws.filter(function (k) { return hay.indexOf(k.nz) >= 0; }).map(function (k) { return k.raw; });
    if (matched.length) out.push({ ep: r[0], show: shows[r[1]], date: String(r[2]).slice(0, 10), title: String(r[3] || ''), matched: matched });
  });
  return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.ep.localeCompare(b.ep); });
}

// 純粋: その回の番組の Spotify 番組ID
function libraryThemeExpectedShowId_(show) {
  return (typeof LIBRARY_PLAYLIST_SHOW_IDS_ !== 'undefined' && LIBRARY_PLAYLIST_SHOW_IDS_[show]) || LIBRARY_THEME_EXTRA_SHOW_IDS_[show] || '';
}

// 純粋: タブに書き足す行を決める
//   known: タブにある Spotify エピソードID / lookup: 蔵ID→{spotifyId} / verified: spotifyId→{name, showId}
function libraryThemePlan_(rule, picked, lookup, verified, known) {
  var out = { rows: [], already: 0, missing: [], hold: [], unverified: [] }, seen = {};
  picked.forEach(function (p) {
    var x = lookup[p.ep];
    if (!x || !x.spotifyId) { out.missing.push(p.ep); return; }
    var id = x.spotifyId;
    if (known[id] || seen[id]) { out.already += 1; return; }
    var v = verified[id];
    if (v === undefined) { out.unverified.push(p.ep); return; }   // 今回は確かめていない（次の時間に）
    var want = libraryThemeExpectedShowId_(p.show);
    if (!v || !want || v.showId !== want || libraryPlaylistNz_(v.name) !== libraryPlaylistNz_(p.title)) {
      out.hold.push({ ep: p.ep, reason: !v ? 'Spotifyで回を確認できない' : !want || v.showId !== want ? 'Spotify上の番組が違う' : 'Spotify上の題名が違う' });
      return;
    }
    seen[id] = true;
    out.rows.push({ ep: p.ep, id: id, date: p.date, show: p.show, title: p.title, matched: p.matched });
  });
  return out;
}

function libraryThemeRules_() {
  var P = PropertiesService.getScriptProperties();
  var extra = String(P.getProperty('LIBRARY_THEME_EXTRA') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  var seen = {};
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getDisplayValues().map(function (row) { return libraryThemeRuleFromRequestRow_(row, extra); })
    .filter(function (r) { if (!r || seen[r.playlistId]) return false; seen[r.playlistId] = true; return true; });
}

function libraryThemeTextIndex_(si) {
  var out = {};
  (si.text || []).forEach(function (path) {
    (libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + path) || []).forEach(function (r) { if (r && r[0]) out[r[0]] = String(r[1] || ''); });
  });
  return out;
}

function libraryThemeSyncOne_(rule, data, write) {
  var runtime = getThemeV3RuntimeRuleByPlaylistId_(rule.playlistId);   // 一意でなければ例外（触らない）
  if (!isThemeV3RuntimeRule_(runtime) || String(runtime.lifecycleStatus || '') !== 'incremental') return { rule: rule.key, status: 'NOT_V3_INCREMENTAL' };
  var sheet = ensureThemeV3SheetForRule_(runtime);
  var known = {};
  readThemeV3Rows_(sheet).forEach(function (row) { var id = getThemeV3EpisodeId_(row); if (id) known[id] = true; });
  var picked = libraryThemePick_(rule, data.shows, data.lite, data.text);
  var lookup = shelfLibraryLookup_(picked.map(function (p) { return p.ep; }), function (u) { return libraryPlaylistFetchJson_(u); });
  var toVerify = [];
  picked.forEach(function (p) { var x = lookup[p.ep]; if (x && x.spotifyId && !known[x.spotifyId] && toVerify.indexOf(x.spotifyId) < 0) toVerify.push(x.spotifyId); });
  var verified = {};
  toVerify.slice(0, LIBRARY_THEME_MAX_VERIFY_).forEach(function (id) {
    var e = fetchSpotifyEpisodeFromWebApi(id);
    verified[id] = e && e.showId ? { name: e.episodeTitle, showId: e.showId } : null;
  });
  var plan = libraryThemePlan_(rule, picked, lookup, verified, known);
  var report = { rule: rule.key, playlist: rule.name, write: !!write, found: picked.length, newRows: plan.rows.map(function (r) { return r.ep + ' ' + r.date + ' ' + r.title; }),
    already: plan.already, missing: plan.missing, hold: plan.hold, later: plan.unverified.length };
  if (!write) { report.status = 'DRY_RUN'; return report; }
  if (plan.rows.length) {
    var now = new Date();
    sheet.getRange(sheet.getLastRow() + 1, 1, plan.rows.length, 14).setValues(plan.rows.map(function (r) {
      return [runtime.key || rule.key, r.id, r.date, r.show, r.title, r.matched.join(' / '), '', 'https://open.spotify.com/episode/' + r.id,
        '採用', now, '', '', '蔵', '蔵で一致（題名・概要）: ' + r.matched.join(' / ') + ' ／ 不要なら判定を「除外」にしてSpotifyから削除'];
    }));
    SpreadsheetApp.flush();
    var token = getSpotifyUserAccessToken();
    if (!token) { report.status = 'ROWS_ADDED_NO_TOKEN'; return report; }
    report.spotify = syncThemeV3Rule_(runtime, token);   // 既存の Theme V3 の仕組みで Spotify へ追加（人の除外・手動削除を尊重）
  }
  report.status = 'OK';
  return report;
}

var LIBRARY_THEME_INTERVAL_MS_ = 6 * 3600 * 1000;   // 蔵は1日数回しか変わらないので6時間おき（新しいテーマが来た時はすぐ）

function libraryThemeSyncAll_(write) {
  var rules = libraryThemeRules_();
  if (!rules.length) return { status: 'NO_THEME' };
  var P = PropertiesService.getScriptProperties(), sig = rules.map(function (r) { return r.playlistId + ':' + r.keywords.join('|'); }).join(',');
  var last = Number(P.getProperty('LIBRARY_THEME_LAST_RUN') || 0), lastSig = P.getProperty('LIBRARY_THEME_LAST_SIG') || '';
  if (write && sig === lastSig && Date.now() - last < LIBRARY_THEME_INTERVAL_MS_) return { status: 'WAIT', next: new Date(last + LIBRARY_THEME_INTERVAL_MS_).toISOString() };
  var manifest = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json'), si = manifest.searchIndex || {};
  var data = { shows: si.shows || [], lite: libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + si.lite), text: libraryThemeTextIndex_(si) };
  var results = rules.map(function (rule) {
    try { return libraryThemeSyncOne_(rule, data, write); } catch (e) { return { rule: rule.key, status: 'ERROR', error: String(e && e.message || e).slice(0, 300) }; }
  });
  if (write && !results.some(function (r) { return r.later; })) {   // 確かめ残しがある時は次の時間に続きをやる
    P.setProperty('LIBRARY_THEME_LAST_RUN', String(Date.now()));
    P.setProperty('LIBRARY_THEME_LAST_SIG', sig);
  }
  return results;
}

// 管理人が手で動かす用（確認だけ・書き込まない）
function LIBRARY_THEME_DRY_RUN() { var r = libraryThemeSyncAll_(false); Logger.log(JSON.stringify(r, null, 1)); return r; }

if (typeof module !== 'undefined') module.exports = { libraryThemeRuleFromRequestRow_: libraryThemeRuleFromRequestRow_, libraryThemePick_: libraryThemePick_, libraryThemePlan_: libraryThemePlan_, libraryThemeSplitKeywords_: libraryThemeSplitKeywords_ };
