// PlaylistLiveMeta.js — Spotifyリストのカード情報を Spotify から直接取る（2026-11-19 管理人指示「全自動・即時性重視」）。
// ・表紙: Spotify のプレイリスト画像。作成者が表紙を作り直していればそれ、無ければ Spotify が作った画像（モザイク）。
// ・最終新着: プレイリストの末尾（最後に追加された50件）にある回の一番新しい公開日。
// どちらもシートには書かない。スクリプトプロパティに保存し、各リスト1日1回ほど取り直す（#412）。閲覧時は保存値を返すだけ。
// 取得に失敗した時はシートの値（最終更新日）・サイト側の固定画像にそのまま戻る。

function plmToken_() {
  try { return typeof getSpotifyUserAccessToken === 'function' ? getSpotifyUserAccessToken() : ''; } catch (e) { return ''; }
}
function plmHeaders_(token) { return { Authorization: 'Bearer ' + token, Accept: 'application/json' }; }
// 一度に大量に送らないよう、5件ずつ・1秒空けて送る（#412）
function plmFetchChunked_(reqs) {
  // 返り値は reqs と同じ長さ。Spotify に 429 で止められたら以降は送らず null を入れる（待機を記録）
  var out = [], stopped = false;
  for (var i = 0; i < reqs.length; i += 5) {
    var chunk = reqs.slice(i, i + 5);
    if (stopped) { chunk.forEach(function () { out.push(null); }); continue; }
    if (i) Utilities.sleep(1000);
    var rs = UrlFetchApp.fetchAll(chunk);
    rs.forEach(function (r) { if (typeof spotifyCooldownNote_ === 'function' && spotifyCooldownNote_(r, 'PlaylistLiveMeta')) stopped = true; });
    out = out.concat(rs);
  }
  return out;
}
function plmOk_(r) { return !!(r && r.getResponseCode() === 200); }

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
    if (!plmOk_(pages[i])) return;
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
      if (!plmOk_(rs[i])) return;
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

// 2026-11-20 #412（管理人「Spotifyへのアクセスは必要最低限に」）:
// ・取得結果はスクリプトプロパティ（plm4:ID）に保存する。閲覧時（doGet）は保存値を返すだけで Spotify を呼ばない。
// ・取り直しは毎時の自動更新から、古い順に PLM_PER_RUN_ 件だけ。各リストはおおむね1日1回（PLM_MAX_AGE_MS_ より古いものだけ）。
var PLM_STORE_ = 'plm4:';
var PLM_PER_RUN_ = 4;
var PLM_MAX_AGE_MS_ = 20 * 3600 * 1000;

// 純粋: 保存値の一覧から、今回取り直すリストを選ぶ（未取得 → 古い順。新しいものは選ばない）
function plmPickStale_(ids, stored, nowMs, limit, maxAgeMs) {
  var seen = {};
  return (ids || []).filter(function (id) { if (seen[id] || !/^[A-Za-z0-9]{22}$/.test(id)) return false; seen[id] = true; return true; })
    .map(function (id) { var v = stored[id]; return { id: id, at: v && v.at ? Date.parse(v.at) || 0 : 0 }; })
    .filter(function (x) { return nowMs - x.at >= maxAgeMs; })
    .sort(function (a, b) { return a.at - b.at; })
    .slice(0, limit).map(function (x) { return x.id; });
}

function plmStoredAll_() {
  var all = PropertiesService.getScriptProperties().getProperties(), out = {};
  Object.keys(all).forEach(function (k) { if (k.indexOf(PLM_STORE_) === 0) { try { out[k.slice(PLM_STORE_.length)] = JSON.parse(all[k]); } catch (e) {} } });
  return out;
}

// プレイリストID の配列 → { id: { artwork, latestDate } }（保存値のみ。Spotify は呼ばない）
function playlistLiveMeta_(ids) {
  var stored = plmStoredAll_(), out = {};
  (ids || []).forEach(function (id) { var v = stored[id]; if (v) out[id] = { artwork: v.artwork || '', latestDate: v.latestDate || '' }; });
  return out;
}

// 指定したリストだけ Spotify から取り直して保存する（呼ぶのは playlistLiveMetaWarm_ のみ）
function plmRefresh_(ids) {
  if (!ids.length) return {};
  if (typeof spotifyAnyCooldown_ === 'function' && spotifyAnyCooldown_()) return {};
  var token = plmToken_(); if (!token) return {};
  var base = 'https://api.spotify.com/v1/playlists/';
  // 1回目: 画像と総数
  var r1 = plmFetchChunked_(ids.map(function (id) { return { url: base + id + '?market=JP&fields=images,tracks.total,items.total', headers: plmHeaders_(token), muteHttpExceptions: true }; }));
  var head = {}, second = [];
  ids.forEach(function (id, i) {
    if (!plmOk_(r1[i])) return;
    var j = JSON.parse(r1[i].getContentText()), total = Number((j.items && j.items.total) || (j.tracks && j.tracks.total) || 0);
    head[id] = { artwork: plmArtwork_(j.images), total: total };
    if (total > 0) second.push(id);
  });
  // 2回目: 末尾50件の公開日
  var r2 = second.length ? plmFetchChunked_(second.map(function (id) {
    return { url: base + id + '/items?market=JP&limit=50&offset=' + Math.max(0, head[id].total - 50), headers: plmHeaders_(token), muteHttpExceptions: true };
  })) : [];
  var latest = {};
  second.forEach(function (id, i) { if (plmOk_(r2[i])) latest[id] = plmLatestFromItems_(JSON.parse(r2[i].getContentText()).items); });
  // API で中身を読めなかったもの（他人のプレイリスト）は埋め込みページ経由で
  var noLatest = Object.keys(head).filter(function (id) { return !latest[id]; });
  try { var viaEmbed = plmLatestViaEmbed_(noLatest, token); Object.keys(viaEmbed).forEach(function (id) { latest[id] = viaEmbed[id]; }); } catch (err) {}
  var props = PropertiesService.getScriptProperties(), put = {}, out = {}, now = new Date().toISOString();
  Object.keys(head).forEach(function (id) {
    out[id] = { artwork: head[id].artwork, latestDate: latest[id] || '' };
    put[PLM_STORE_ + id] = JSON.stringify({ artwork: out[id].artwork, latestDate: out[id].latestDate, at: now });
  });
  if (Object.keys(put).length) props.setProperties(put);
  return out;
}

// 切り替え時だけ: 旧キャッシュ（plm3:）に残っている値を保存値へ移す（表紙が一時的に消えないように）。
// 取得時刻は「古い」扱いにして、通常の順番で取り直されるようにする。Spotify は呼ばない
function plmMigrateFromCache_(ids, stored) {
  var need = ids.filter(function (id) { return !stored[id]; });
  if (!need.length) return 0;
  var got = CacheService.getScriptCache().getAll(need.map(function (id) { return 'plm3:' + id; })) || {}, put = {};
  var old = new Date(Date.now() - PLM_MAX_AGE_MS_).toISOString();
  need.forEach(function (id) {
    var v = got['plm3:' + id]; if (!v) return;
    try { var j = JSON.parse(v); stored[id] = { artwork: j.artwork || '', latestDate: j.latestDate || '', at: old }; put[PLM_STORE_ + id] = JSON.stringify(stored[id]); } catch (e) {}
  });
  if (Object.keys(put).length) PropertiesService.getScriptProperties().setProperties(put);
  return Object.keys(put).length;
}

// 毎時の自動更新から: サイト公開用のリストのうち、古いものを数件だけ取り直す
function playlistLiveMetaWarm_() {
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), PUBLIC_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return { warmed: 0 };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return playlistIdForPublicRead_(r[0]); }).filter(Boolean);
  var stored = plmStoredAll_();
  plmMigrateFromCache_(ids, stored);
  var pick = plmPickStale_(ids, stored, Date.now(), PLM_PER_RUN_, PLM_MAX_AGE_MS_);
  var m = plmRefresh_(pick);
  return { playlists: ids.length, picked: pick.length, warmed: Object.keys(m).length };
}

function PLAYLIST_LIVE_META_CHECK() { var r = playlistLiveMetaWarm_(); Logger.log(JSON.stringify(r)); return r; }
// 切り替え直後に手で1回: 旧キャッシュから保存値へ移すだけ（Spotify は呼ばない）
function PLAYLIST_LIVE_META_MIGRATE_ONLY() {
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), PUBLIC_SHEET_NAME);
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return playlistIdForPublicRead_(r[0]); }).filter(Boolean);
  var stored = plmStoredAll_(), n = plmMigrateFromCache_(ids, stored);
  Logger.log(JSON.stringify({ playlists: ids.length, migrated: n, stored: Object.keys(stored).length }));
}

if (typeof module !== 'undefined') module.exports = { plmPickStale_: plmPickStale_, plmLatestFromItems_: plmLatestFromItems_, plmArtwork_: plmArtwork_, plmEmbedEpisodeIds_: plmEmbedEpisodeIds_ };
