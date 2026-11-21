// PlaylistJstDate.js — Spotify リストの「最終新着」を日本時間の配信日にする（#432・2026-11-21）。
// Spotify の release_date は、日本時間 04:00 に配信した回が前日の日付になる（例: 11/21 04:00 配信 → 2026-11-20）。
// 蔵（朝リスの田）の回一覧（題名・日本時間の配信日時）から、同じ題名で release_date の当日か翌日の回を探し、その日付を使う。
// 見つからない回は release_date のまま（今まで通り）。蔵の一覧は1回の実行で1度だけ読む。
var PJD_INDEX_ = null;

function pjdNorm_(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }
function pjdAddDay_(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

// 純粋: 蔵 lite 行 [id, 番組番号, 日時, 題名, …] → 題名ごとの配信日（日本時間）
function pjdIndex_(liteRows) {
  var idx = {};
  (liteRows || []).forEach(function (r) { var k = pjdNorm_(r && r[3]); if (k) (idx[k] = idx[k] || []).push(String(r[2]).slice(0, 10)); });
  return idx;
}

// 純粋: Spotify の回 {name, release_date} → 日本時間の配信日
function pjdJstDate_(ep, idx) {
  var rd = String(ep && (ep.release_date || ep.date) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rd)) return rd;
  var next = pjdAddDay_(rd, 1), hits = ((idx || {})[pjdNorm_(ep && ep.name)] || []).filter(function (d) { return d === rd || d === next; });
  return hits.length ? hits.sort().pop() : rd;
}

function pjdLibraryIndex_() {
  if (PJD_INDEX_) return PJD_INDEX_;
  try {
    var m = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json');
    PJD_INDEX_ = pjdIndex_(libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + m.searchIndex.lite));
  } catch (e) { PJD_INDEX_ = {}; }
  return PJD_INDEX_;
}

// 回の配列を日本時間の配信日つきにする（release_date を置き換えた写し）
function pjdWithJstDates_(episodes) {
  var idx = (episodes || []).length ? pjdLibraryIndex_() : {};
  return (episodes || []).map(function (ep) { if (!ep) return ep; var c = {}; Object.keys(ep).forEach(function (k) { c[k] = ep[k]; }); c.release_date = pjdJstDate_(ep, idx); return c; });
}

if (typeof module !== 'undefined') module.exports = { pjdIndex_: pjdIndex_, pjdJstDate_: pjdJstDate_, pjdAddDay_: pjdAddDay_ };
