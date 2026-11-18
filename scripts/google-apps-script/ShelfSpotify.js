// ShelfSpotify.js — 「蔵書推薦・受付」で管理人が承認した蔵書を、Spotifyプレイリストへ入れる。
// 動く条件: 状態を「Spotify追加OK」にし、「追加先プレイリストURL」に共同編集できるリストのURLを書いた行だけ。
// SpotifyのエピソードIDは蔵（公開データ）のリンクに実在するものだけを使い、推測で作らない。
// 毎時の自動更新（runAutoUpdateBackfillHourlyV1）から呼ばれる。新しいトリガーは作らない。
var SHELF_SPOTIFY_OK_ = 'Spotify追加OK';
var SHELF_SPOTIFY_DONE_ = 'Spotify追加済';
var SHELF_SPOTIFY_ERR_ = 'Spotify追加エラー';
var SHELF_LIBRARY_DETAILS_ = 'https://neyito96.github.io/asarisunowa/library/data/details/';
var SHELF_SPOTIFY_MAX_ROWS_ = 3;

function shelfPlaylistId_(url) {
  var m = String(url || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]{22})/);
  return m ? m[1] : '';
}
function shelfSpotifyEpisodeId_(links) {
  for (var i = 0; i < (links || []).length; i++) {
    var m = String(links[i] || '').match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
    if (m) return m[1];
  }
  return '';
}
// 蔵の公開データから EP-ID → {spotifyId, title}。バケットは EP番号/50 の切り捨て。
function shelfLibraryLookup_(ids, fetchJson) {
  var buckets = {}, out = {};
  ids.forEach(function (id) { var b = Math.floor(Number(id.slice(3)) / 50); (buckets[b] = buckets[b] || []).push(id); });
  Object.keys(buckets).forEach(function (b) {
    var rows = fetchJson(SHELF_LIBRARY_DETAILS_ + b + '.json') || [];
    rows.forEach(function (e) { if (e && buckets[b].indexOf(e.id) >= 0) out[e.id] = { spotifyId: shelfSpotifyEpisodeId_(e.links), title: String(e.title || '') }; });
  });
  return out;
}
// 純粋な計画: 並び順を保ち、Spotifyにない回と既にリストにある回を分ける。
function shelfSpotifyPlan_(ids, lookup, existingUris) {
  var add = [], missing = [], already = 0, seen = {};
  ids.forEach(function (id) {
    var x = lookup[id];
    if (!x || !x.spotifyId) { missing.push(id); return; }
    var uri = 'spotify:episode:' + x.spotifyId;
    if (existingUris[uri] || seen[uri]) { already++; return; }
    seen[uri] = true;
    add.push({ id: x.spotifyId, uri: uri, name: x.title, ep: id });
  });
  return { add: add, missing: missing, already: already };
}

function shelfSpotifySync_() {
  var c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), sh = ss.getSheetByName(SHELF_SHEET_);
  if (!sh || sh.getLastRow() < 2) return { rows: 0 };
  var W = SHELF_H_.length, data = sh.getRange(1, 1, sh.getLastRow(), W).getDisplayValues(), h = data[0];
  if (h[2] !== '状態' || h[3] !== 'EP-ID（並び順）' || h[12] !== '追加先プレイリストURL' || h[13] !== 'Spotify結果') return { error: '見出しが想定と違うため停止' };
  var targets = [];
  for (var r = 1; r < data.length && targets.length < SHELF_SPOTIFY_MAX_ROWS_; r++) if (String(data[r][2]).trim() === SHELF_SPOTIFY_OK_) targets.push(r);
  if (!targets.length) return { rows: 0 };
  var token = getSpotifyUserAccessToken();
  if (!token) return { error: 'Spotify認証トークンなし' };
  var fetchJson = function (url) { var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null; };
  var results = [];
  targets.forEach(function (r) {
    var row = data[r], rowNo = r + 1, receipt = row[0];
    var setResult = function (status, text) {
      // 書く直前に同じ受付IDの行か確かめる（並べ替え対策）
      if (sh.getRange(rowNo, 1).getDisplayValue() !== receipt) throw new Error('行がずれたため停止: ' + receipt);
      sh.getRange(rowNo, 3).setValue(status);
      sh.getRange(rowNo, 14).setValue(text);
    };
    try {
      var pid = shelfPlaylistId_(row[12]);
      if (!pid) { setResult(SHELF_SPOTIFY_ERR_, '追加先プレイリストURLがありません'); results.push({ receipt: receipt, error: 'NO_PLAYLIST' }); return; }
      var ids = String(row[3]).split(/\s+/).filter(function (x) { return /^EP-\d{5}$/.test(x); });
      var lookup = shelfLibraryLookup_(ids, fetchJson);
      var existing = {};
      getAllSpotifyPlaylistItems_(pid, token).forEach(function (it) { var u = it && it.item && it.item.uri; if (u) existing[String(u)] = true; });
      var plan = shelfSpotifyPlan_(ids, lookup, existing), added = 0;
      for (var i = 0; i < plan.add.length; i += 100) added += addAutoPlaylistEpisodesBatch_({ playlistId: pid, name: '蔵書 ' + receipt }, token, plan.add.slice(i, i + 100)).addedCount;
      var text = new Date().toISOString().slice(0, 16) + ' 追加' + added + '・既にあり' + plan.already + '・Spotifyなし' + plan.missing.length + (plan.missing.length ? '（' + plan.missing.join(' ') + '）' : '');
      setResult(SHELF_SPOTIFY_DONE_, text);
      results.push({ receipt: receipt, added: added, already: plan.already, missing: plan.missing.length });
    } catch (err) {
      try { setResult(SHELF_SPOTIFY_ERR_, String(err && err.message || err).slice(0, 200)); } catch (e2) {}
      results.push({ receipt: receipt, error: String(err && err.message || err) });
    }
  });
  SpreadsheetApp.flush();
  return { rows: results.length, results: results };
}

// 管理人が手で1回動かす用
function SHELF_SPOTIFY_RUN_NOW() { var r = shelfSpotifySync_(); Logger.log(JSON.stringify(r)); return r; }

if (typeof module !== 'undefined') module.exports = { shelfPlaylistId_: shelfPlaylistId_, shelfSpotifyEpisodeId_: shelfSpotifyEpisodeId_, shelfLibraryLookup_: shelfLibraryLookup_, shelfSpotifyPlan_: shelfSpotifyPlan_ };
