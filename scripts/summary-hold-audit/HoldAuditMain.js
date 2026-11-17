// HA-1 概要欄HOLD監査（Issue #308 / #315）
// 目的: 蔵の表示整形（public/library/description-tidy.mjs・PR #316）で HOLD になった回について、
//   1) 原文がどこにあるか（V2・収蔵詳細「概要原文」）を確かめ、取得済み・未取得・SHA不一致に分ける
//   2) 原文に同じ整形規則をかけ、品質の検査（本文が原文の中にある・関連記事の見出しとURLが原文の中で対応している・出演者の重複）をする
//   3) 自動修正可能・人間確認必要・原文未取得に分け、COPY の明細・集計シートに書く
// 安全: V2作業用台帳・本番は読むだけ。書くのは COPY の「HOLD監査・明細」「HOLD監査・集計」だけ（毎回まるごと書き直す＝冪等）。原文は加工しない。
var HA_VERSION = 'HA-1';
var HA_CFG = {
  v2Id: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',   // V2作業用（読むだけ）
  copyId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY', // COPY（書く）
  refuse: ['1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'],
  ledger: 'V2・統合台帳', detail: 'V2・収蔵詳細', cleanDetail: 'V2・清掃詳細',
  outRows: 'HOLD監査・明細', outSum: 'HOLD監査・集計'
};
var HA_ROW_H = ['EP-ID', '番組', '分類', '原因', '原文状態', '原文SHA256', '原文文字数', '清掃済文字数', '整形後文字数', '整形の判定', '関連記事数（整形）', '関連記事数（SC4-18）', 'URL差（整形にだけ）', 'URL差（SC4-18にだけ）', '出演者重複', '整形後本文（先頭200字）', '関連記事JSON（整形）', '版', '日時'];

// ---- 純関数（Node テストと共用） ----
function haSplitCast(s) { return String(s || '').split(/[；;／/、,\n]+/).map(function (x) { return x.replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, '').trim(); }).filter(Boolean); }
function haCastDup(s) { var seen = {}, dup = []; haSplitCast(s).forEach(function (n) { if (seen[n] && dup.indexOf(n) < 0) dup.push(n); seen[n] = 1; }); return dup; }
function haNormUrl(u) { return String(u || '').replace(/&amp;/g, '&').replace(/[?&](iref|ref|utm_[a-z]+)=[^&#]*/gi, '').replace(/[?&]$/, '').replace(/\/$/, '').trim(); }
function haNormText(t) { return String(t || '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
// 1件の判定。row: {ep, show, cleaned, cast, raw, rawSha, sc418Json}
function haJudge(row, sha) {
  var raw = String(row.raw || ''), out = { ep: row.ep, show: row.show, rawLen: raw.length, cleanedLen: String(row.cleaned || '').length };
  if (!raw.trim()) { out.cls = '原文未取得'; out.cause = '概要原文が空'; out.rawState = '未取得'; return out; }
  out.sha = sha; out.rawState = row.rawSha && row.rawSha.toLowerCase() !== String(sha).toLowerCase() ? 'SHA不一致' : '取得済み';
  if (out.rawState === 'SHA不一致') { out.cls = '人間確認必要'; out.cause = '保存の原文SHA256と一致しない'; return out; }
  var t = tidyDescription(raw), nraw = haNormText(raw);
  out.tidy = t; out.tidyStatus = t.status; out.bodyLen = t.body.length;
  var fails = [];
  if (t.status === 'HOLD') fails.push('整形HOLD: ' + t.reason);
  if (t.status === 'EMPTY') fails.push('整形後に空');
  // 本文は原文の中の語だけでできている（足した文字が無い）
  t.body.split(' ').forEach(function (w) { if (w && nraw.indexOf(w) < 0 && fails.indexOf('本文に原文に無い語') < 0) fails.push('本文に原文に無い語'); });
  // 関連記事: 見出しとURLがどちらも原文にあり、原文の中で 見出し→URL の順に並ぶ
  t.related.forEach(function (r) {
    var it = nraw.indexOf(haNormText(r.title)), iu = nraw.indexOf(r.url);
    if (it < 0 || iu < 0) { if (fails.indexOf('関連記事が原文に無い') < 0) fails.push('関連記事が原文に無い'); }
    else if (it > iu) { if (fails.indexOf('見出しとURLの順が逆') < 0) fails.push('見出しとURLの順が逆'); }
  });
  // SC4-18（既存の清掃ロボ）の見出し＋URLと比べる（記事URLだけ）
  var sc = []; try { sc = JSON.parse(row.sc418Json || '[]') || []; } catch (e) { fails.push('SC4-18のJSONが読めない'); }
  var mine = {}, theirs = {};
  t.related.forEach(function (r) { mine[haNormUrl(r.url)] = 1; });
  (sc || []).forEach(function (p) { var u = p && (p.url || p.u); if (u && /asahi\.com\/articles|digital\.asahi\.com\/articles|withnews|globe\.asahi/.test(u)) theirs[haNormUrl(u)] = 1; });
  out.onlyMine = Object.keys(mine).filter(function (u) { return !theirs[u]; }).length;
  out.onlyTheirs = Object.keys(theirs).filter(function (u) { return !mine[u]; }).length;
  out.scCount = Object.keys(theirs).length;
  if (out.onlyTheirs) fails.push('SC4-18にある記事を整形が落とした');
  out.castDup = haCastDup(row.cast);
  if (out.castDup.length) fails.push('出演者の重複');
  out.fails = fails;
  out.cls = fails.length ? '人間確認必要' : '自動修正可能';
  out.cause = fails.length ? fails[0] : (t.status === 'AS_IS' ? '原文のまま（外す物なし）' : '整形して表示できる');
  return out;
}
function haRowOut(j, ver, now) {
  var t = j.tidy || { body: '', related: [] };
  return [j.ep, j.show, j.cls, j.cause, j.rawState || '', j.sha || '', j.rawLen, j.cleanedLen, j.bodyLen || 0, j.tidyStatus || '', t.related.length, j.scCount || 0, j.onlyMine || 0, j.onlyTheirs || 0, (j.castDup || []).join('・'), t.body.slice(0, 200), JSON.stringify(t.related).slice(0, 2000), ver, now];
}
function haSummary(js, examples) {
  var by = {}, cause = {}, ex = {};
  js.forEach(function (j) { by[j.cls] = (by[j.cls] || 0) + 1; var k = j.cls + '｜' + j.cause; cause[k] = (cause[k] || 0) + 1; (ex[k] = ex[k] || []).length < (examples || 3) && ex[k].push(j.ep); });
  return { total: js.length, byClass: by, byCause: Object.keys(cause).sort(function (a, b) { return cause[b] - cause[a]; }).map(function (k) { return [k, cause[k], ex[k].join(' ')]; }) };
}

// ---- GAS 実行部 ----
function haOpen_(id) { if (HA_CFG.refuse.indexOf(id) >= 0) throw new Error('REFUSED_SPREADSHEET'); return SpreadsheetApp.openById(id); }
function haTable_(ss, name, cols) {
  var sh = ss.getSheetByName(name); if (!sh) throw new Error('SHEET_NOT_FOUND ' + name);
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), h = v[0].map(String), ix = {};
  cols.forEach(function (c) { ix[c] = h.indexOf(c); if (ix[c] < 0) throw new Error('COLUMN_NOT_FOUND ' + name + ':' + c); });
  return { rows: v.slice(1), ix: ix };
}
function haSha_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function haRun_(limit) {
  var t0 = Date.now(), v2 = haOpen_(HA_CFG.v2Id), copy = haOpen_(HA_CFG.copyId);
  if (copy.getName().indexOf('COPY') < 0) throw new Error('NOT_COPY');
  var L = haTable_(v2, HA_CFG.ledger, ['EP-ID', '番組', '掲載判定', '代表EP-ID', '概要（清掃済）', '出演者']);
  var D = haTable_(v2, HA_CFG.detail, ['EP-ID', '概要原文', '概要原文SHA256']);
  var C = haTable_(v2, HA_CFG.cleanDetail, ['EP-ID', '関連記事JSON(見出し+URL)']);
  var raw = {}, sc = {};
  D.rows.forEach(function (r) { raw[r[D.ix['EP-ID']]] = { t: String(r[D.ix['概要原文']] || ''), sha: String(r[D.ix['概要原文SHA256']] || '') }; });
  C.rows.forEach(function (r) { sc[r[C.ix['EP-ID']]] = String(r[C.ix['関連記事JSON(見出し+URL)']] || ''); });
  // 対象: 公開対象（掲載判定=対象・代表=自分）で、清掃済みの概要に表示整形をかけると HOLD になる回
  var targets = [], publicCount = 0;
  L.rows.forEach(function (r) {
    var ep = String(r[L.ix['EP-ID']]); if (r[L.ix['掲載判定']] !== '対象' || String(r[L.ix['代表EP-ID']] || ep) !== ep) return;
    publicCount++;
    if (tidyDescription(String(r[L.ix['概要（清掃済）']] || '')).status !== 'HOLD') return;
    targets.push({ ep: ep, show: r[L.ix['番組']], cleaned: String(r[L.ix['概要（清掃済）']] || ''), cast: String(r[L.ix['出演者']] || ''), raw: (raw[ep] || {}).t || '', rawSha: (raw[ep] || {}).sha || '', sc418Json: sc[ep] || '' });
  });
  var run = limit ? targets.slice(0, limit) : targets, now = new Date().toISOString();
  var js = run.map(function (row) { return haJudge(row, row.raw ? haSha_(row.raw) : ''); });
  // 書込（COPY・まるごと書き直し）
  var out = copy.getSheetByName(HA_CFG.outRows) || copy.insertSheet(HA_CFG.outRows); out.clearContents();
  var rows = [HA_ROW_H].concat(js.map(function (j) { return haRowOut(j, HA_VERSION, now); }));
  out.getRange(1, 1, rows.length, HA_ROW_H.length).setValues(rows); out.setFrozenRows(1);
  var back = out.getRange(2, 1, Math.max(js.length, 1), 1).getValues().map(function (r) { return r[0]; });
  var readback = js.every(function (j, i) { return back[i] === j.ep; });
  var s = haSummary(js, 5), sum = copy.getSheetByName(HA_CFG.outSum) || copy.insertSheet(HA_CFG.outSum); sum.clearContents();
  var sr = [['版', HA_VERSION, '実行', now], ['公開対象', publicCount, 'HOLD（清掃済に表示整形）', targets.length], ['今回の件数', js.length, '上限', limit || '全件']];
  Object.keys(s.byClass).forEach(function (k) { sr.push(['分類', k, '件数', s.byClass[k]]); });
  s.byCause.forEach(function (c) { sr.push(['原因', c[0], c[1], c[2]]); });
  sum.getRange(1, 1, sr.length, 4).setValues(sr);
  var res = { version: HA_VERSION, publicCount: publicCount, holdTargets: targets.length, judged: js.length, byClass: s.byClass, topCauses: s.byCause.slice(0, 8), readback: readback ? 'OK' : 'MISMATCH', ms: Date.now() - t0 };
  Logger.log(JSON.stringify(res));
  return res;
}
function HA_1_HOLD監査_100件() { return haRun_(100); }
function HA_2_HOLD監査_全件() { return haRun_(0); }

if (typeof module !== 'undefined') module.exports = { haJudge: haJudge, haSummary: haSummary, haCastDup: haCastDup, haRowOut: haRowOut, HA_ROW_H: HA_ROW_H };
