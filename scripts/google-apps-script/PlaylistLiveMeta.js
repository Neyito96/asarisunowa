// PlaylistLiveMeta.js — Spotifyリストのカード情報を Spotify から直接取る（2026-11-19 管理人指示「全自動・即時性重視」）。
// ・表紙: Spotify のプレイリスト画像。作成者が表紙を作り直していればそれ、無ければ Spotify が作った画像（モザイク）。
// ・最終新着: プレイリストの末尾（最後に追加された50件）にある回の一番新しい公開日。
// どちらもシートには書かない（その場で読む）。キャッシュ2時間・毎時更新。毎時の自動更新が温め直すので、閲覧時はほぼ即時。
// 取得に失敗した時はシートの値（最終更新日）・サイト側の固定画像にそのまま戻る。
var PLM_CACHE_SEC_ = 7200;   // 毎時の温め直しより長く（閲覧者が Spotify 待ちにならない）
var PLM_KEY_ = 'plm3:';

function plmToken_() {
  try { return typeof getSpotifyUserAccessToken === 'function' ? getSpotifyUserAccessToken() : ''; } catch (e) { return ''; }
}
function plmHeaders_(token) { return { Authorization: 'Bearer ' + token, Accept: 'application/json' }; }
// 一度に大量に送ると GAS の「短時間に urlfetch が多すぎ」になるため、20件ずつ・間を空けて送る
function plmFetchChunked_(reqs) {
  var out = [];
  for (var i = 0; i < reqs.length; i += 20) {
    if (i) Utilities.sleep(600);
    out = out.concat(UrlFetchApp.fetchAll(reqs.slice(i, i + 20)));
  }
  return out;
}

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

// 純粋: 埋め込みページ（open.spotify.com/embed/playlist/ID）の HTML → エピソードID（並び順）
// 他人のプレイリストは API で中身を読めない（Spotify の制限）ため、公開の埋め込みページから回の一覧を取る
function plmEmbedEpisodeIds_(html) {
  var m = String(html || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  try {
    var e = JSON.parse(m[1]).props.pageProps.state.data.entity;
    return (e.trackList || []).map(function (t) { var x = String(t && t.uri || '').match(/^spotify:episode:([A-Za-z0-9]{22})$/); return x ? x[1] : ''; }).filter(Boolean);
  } catch (err) { return []; }
}
var PLM_EMBED_TAIL_ = 3;     // 末尾の何回分の公開日を見るか
var PLM_EP_KEY_ = 'plmEp:';  // 回の公開日は変わらないので6時間キャッシュ

// 埋め込みページ経由の最終新着（id の配列 → { id: 'YYYY-MM-DD' }）
function plmLatestViaEmbed_(ids, token) {
  var out = {}; if (!ids.length) return out;
  var pages = plmFetchChunked_(ids.map(function (id) { return { url: 'https://open.spotify.com/embed/playlist/' + id, muteHttpExceptions: true, followRedirects: true }; }));
  var tails = {}, need = {};
  ids.forEach(function (id, i) {
    if (pages[i].getResponseCode() !== 200) return;
    var eps = plmEmbedEpisodeIds_(pages[i].getContentText()).slice(-PLM_EMBED_TAIL_);
    tails[id] = eps; eps.forEach(function (e) { need[e] = true; });
  });
  var epIds = Object.keys(need); if (!epIds.length) return out;
  var cache = CacheService.getScriptCache(), dates = {}, got = cache.getAll(epIds.map(function (e) { return PLM_EP_KEY_ + e; })) || {}, miss = [];
  epIds.forEach(function (e) { var v = got[PLM_EP_KEY_ + e]; if (v) dates[e] = v; else miss.push(e); });
  if (miss.length) {
    var rs = plmFetchChunked_(miss.map(function (e) { return { url: 'https://api.spotify.com/v1/episodes/' + e + '?market=JP', headers: plmHeaders_(token), muteHttpExceptions: true }; }));
    var put = {};
    miss.forEach(function (e, i) {
      if (rs[i].getResponseCode() !== 200) return;
      var d = String(JSON.parse(rs[i].getContentText()).release_date || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { dates[e] = d; put[PLM_EP_KEY_ + e] = d; }
    });
    if (Object.keys(put).length) cache.putAll(put, 21600);
  }
  Object.keys(tails).forEach(function (id) {
    var best = ''; tails[id].forEach(function (e) { if (dates[e] && dates[e] > best) best = dates[e]; });
    if (best) out[id] = best;
  });
  return out;
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
  var r1 = plmFetchChunked_(miss.map(function (id) { return { url: base + id + '?market=JP&fields=images,tracks.total,items.total', headers: plmHeaders_(token), muteHttpExceptions: true }; }));
  var head = {}, second = [];
  miss.forEach(function (id, i) {
    if (r1[i].getResponseCode() !== 200) return;
    var j = JSON.parse(r1[i].getContentText()), total = Number((j.items && j.items.total) || (j.tracks && j.tracks.total) || 0);
    head[id] = { artwork: plmArtwork_(j.images), total: total };
    if (total > 0) second.push(id);
  });
  // 2回目: 末尾50件の公開日
  var r2 = second.length ? plmFetchChunked_(second.map(function (id) {
    return { url: base + id + '/items?market=JP&limit=50&offset=' + Math.max(0, head[id].total - 50), headers: plmHeaders_(token), muteHttpExceptions: true };
  })) : [];
  var latest = {};
  second.forEach(function (id, i) { if (r2[i].getResponseCode() === 200) latest[id] = plmLatestFromItems_(JSON.parse(r2[i].getContentText()).items); });
  // API で中身を読めなかったもの（他人のプレイリスト）は埋め込みページ経由で
  var noLatest = Object.keys(head).filter(function (id) { return !latest[id]; });   // 他人のリストは総数も0で返るので条件にしない
  try { var viaEmbed = plmLatestViaEmbed_(noLatest, token); Object.keys(viaEmbed).forEach(function (id) { latest[id] = viaEmbed[id]; }); } catch (err) {}
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

if (typeof module !== 'undefined') module.exports = { plmLatestFromItems_: plmLatestFromItems_, plmArtwork_: plmArtwork_, plmEmbedEpisodeIds_: plmEmbedEpisodeIds_ };
