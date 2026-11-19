// PlaylistLiveMeta.js — Spotifyリストのカード情報を Spotify から直接取る（2026-11-19 管理人指示「全自動・即時性重視」）。
// ・表紙: Spotify のプレイリスト画像。作成者が表紙を作り直していればそれ、無ければ Spotify が作った画像（モザイク）。
// ・最終新着: プレイリストの末尾（最後に追加された50件）にある回の一番新しい公開日。
// どちらもシートには書かない（その場で読む）。キャッシュ50分。毎時の自動更新が温め直すので、閲覧時はほぼ即時。
// 取得に失敗した時はシートの値（最終更新日）・サイト側の固定画像にそのまま戻る。
var PLM_CACHE_SEC_ = 3000;
var PLM_KEY_ = 'plm2:';

function plmToken_() {
  try { return typeof getSpotifyUserAccessToken === 'function' ? getSpotifyUserAccessToken() : ''; } catch (e) { return ''; }
}
function plmHeaders_(token) { return { Authorization: 'Bearer ' + token, Accept: 'application/json' }; }

// 純粋: 末尾の項目から一番新しい公開日（YYYY-MM-DD）
function plmLatestFromItems_(items) {
  var best = '';
  (items || []).forEach(function (it) {
    var x = it && (it.item || it.track), d = String(x && x.release_date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > best) best = d;
  });
  return best;
}
// 純粋: 画像（一番大きいもの）
function plmArtwork_(images) {
  var list = (images || []).filter(function (i) { return i && i.url; });
  list.sort(function (a, b) { return (Number(b.width) || 0) - (Number(a.width) || 0); });
  return list.length ? String(list[0].url) : '';
}

// プレイリストID の配列 → { id: { artwork, latestDate } }
function playlistLiveMeta_(ids, opt) {
  opt = opt || {};
  var cache = CacheService.getScriptCache(), out = {}, miss = [];
  ids = ids.filter(function (id, i) { return /^[A-Za-z0-9]{22}$/.test(id) && ids.indexOf(id) === i; });
  if (!opt.refresh) {
    var got = cache.getAll(ids.map(function (id) { return PLM_KEY_ + id; })) || {};
    ids.forEach(function (id) { var v = got[PLM_KEY_ + id]; if (v) out[id] = JSON.parse(v); else miss.push(id); });
  } else miss = ids.slice();
  if (!miss.length) return out;
  var token = plmToken_(); if (!token) return out;
  var base = 'https://api.spotify.com/v1/playlists/';
  // 1回目: 画像と総数
  var r1 = UrlFetchApp.fetchAll(miss.map(function (id) { return { url: base + id + '?market=JP&fields=images,tracks.total,items.total', headers: plmHeaders_(token), muteHttpExceptions: true }; }));
  var head = {}, second = [];
  miss.forEach(function (id, i) {
    if (r1[i].getResponseCode() !== 200) return;
    var j = JSON.parse(r1[i].getContentText()), total = Number((j.items && j.items.total) || (j.tracks && j.tracks.total) || 0);
    head[id] = { artwork: plmArtwork_(j.images), total: total };
    if (total > 0) second.push(id);
  });
  // 2回目: 末尾50件の公開日
  var r2 = second.length ? UrlFetchApp.fetchAll(second.map(function (id) {
    return { url: base + id + '/items?market=JP&limit=50&offset=' + Math.max(0, head[id].total - 50), headers: plmHeaders_(token), muteHttpExceptions: true };
  })) : [];
  var latest = {};
  second.forEach(function (id, i) { if (r2[i].getResponseCode() === 200) latest[id] = plmLatestFromItems_(JSON.parse(r2[i].getContentText()).items); });
  var put = {};
  Object.keys(head).forEach(function (id) {
    out[id] = { artwork: head[id].artwork, latestDate: latest[id] || '' };
    put[PLM_KEY_ + id] = JSON.stringify(out[id]);
  });
  if (Object.keys(put).length) cache.putAll(put, PLM_CACHE_SEC_);
  return out;
}

// 毎時の自動更新から: サイト公開用の全プレイリストを温め直す
function playlistLiveMetaWarm_() {
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), PUBLIC_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return { warmed: 0 };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return playlistIdForPublicRead_(r[0]); }).filter(Boolean);
  var m = playlistLiveMeta_(ids, { refresh: true });
  return { playlists: ids.length, warmed: Object.keys(m).length };
}

function PLAYLIST_LIVE_META_CHECK() { var r = playlistLiveMetaWarm_(); Logger.log(JSON.stringify(r)); return r; }

if (typeof module !== 'undefined') module.exports = { plmLatestFromItems_: plmLatestFromItems_, plmArtwork_: plmArtwork_ };
