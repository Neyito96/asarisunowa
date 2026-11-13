// 朝リスの田 Apple GUID照合テスト（Issue #280 / DeepSeek第8版の成果をPR #281の判定規則に統合した独立COPY専用GAS）
// 目的: COPYの「V2・公開台帳」で既にApple個別URL(?i=)とGUIDを持つ回を選び、Apple Lookup APIの
//       trackId / episodeGuid と照合して、GUID照合方式が実用になるかを少数件で実測する。
// 守ること:
//  - 書き込み先は COPY の新シート「URL補完GUIDテスト」だけ（追記のみ）。台帳本体・固定シート・既存ログは読むだけ。
//  - 本番V2・V1・本番59列・既存GAS台帳のIDは開く前に拒否。開いた後もID・名前を再確認。
//  - トリガーを作らない（存在すれば停止）。URLBOT_VERIFIED_ENABLED は false 固定（URL補完の書込機能はこのファイルに無い）。
//  - 1回の上限10件。1,000件バッチは無い。
// 管理人が押す関数: URLBOT_GUID_0_CHECK（書込なし・通信なし）→ URLBOT_GUID_5 →（妥当なら）URLBOT_GUID_10

var AGT_CFG = {
  environment: 'COPY',
  targetSpreadsheetId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY', // 【COPY試験】V2収蔵ボット P25V2 1件試験 2026-11-11（本番ではない）
  expectedNameIncludes: '【COPY試験】',
  sourceSheet: 'V2・公開台帳',
  logSheet: 'URL補完GUIDテスト',
  country: 'JP',
  lookupLimit: 200,
  minDelayMs: 1500,
  cacheSec: 21600,
  maxN: 10,
  verifiedEnabled: false // URLBOT_VERIFIED_ENABLED。true にする経路はこのファイルに無い
};
var AGT_PROTECTED_IDS_ = [
  '1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', // V1 完全保全
  '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', // V2 作業用（正本）
  '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', // 本番 59列台帳
  '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'  // 既存GAS SPREADSHEET_ID
];
var AGT_LOG_HEADERS_ = ['実行日時', 'runId', '関数', 'seq', 'EP-ID', '番組', 'collectionId', 'trackId(V2)', 'V2 GUID', 'API GUID', '結果', '理由', 'API返却件数', '200件打切り', '取得元', '5件テストと重複'];
var AGT_STATUSES_ = ['MATCH', 'MISMATCH', 'API_NULL_GUID', 'NOT_RETRIEVED', 'API_ERROR'];

// ---------- 純関数（Nodeのテストと実API試験でも同じものを使う） ----------
function agtStr_(v) { return v == null ? '' : String(v).trim(); }
/** Apple個別URLから番組ID(collectionId)とエピソードID(trackId)。番組URLは trackId='' */
function agtParseApple_(url) {
  var u = agtStr_(url); if (!/^https:\/\/podcasts\.apple\.com\//.test(u)) return { collectionId: '', trackId: '' };
  var c = u.match(/\/id(\d+)/), t = u.match(/[?&]i=(\d+)/);
  return { collectionId: c ? c[1] : '', trackId: t ? t[1] : '' };
}
/** 台帳行→候補。必須見出しが無ければ例外（列位置を決め打ちしない） */
function agtRowsFromValues_(values) {
  var h = values[0].map(agtStr_), ix = {};
  ['EP-ID', '番組', 'Apple', '公式GUID'].forEach(function (k) { var i = h.indexOf(k); if (i < 0) throw new Error('HEADER_NOT_FOUND ' + k); ix[k] = i; });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r], ep = agtStr_(v[ix['EP-ID']]); if (!ep) continue;
    var p = agtParseApple_(v[ix['Apple']]);
    out.push({ rowIndex: r + 1, epId: ep, show: agtStr_(v[ix['番組']]), appleUrl: agtStr_(v[ix['Apple']]), guid: agtStr_(v[ix['公式GUID']]), collectionId: p.collectionId, trackId: p.trackId });
  }
  return out;
}
/** 候補選定: 個別URL(trackIdあり)とGUIDの両方がある行だけ。番組を巡回して1件ずつ（異なる番組を優先）。決定的。 */
function agtSelect_(rows, n) {
  var ok = rows.filter(function (r) { return r.collectionId && r.trackId && r.guid; });
  var byShow = {}, order = [];
  ok.forEach(function (r) { if (!byShow[r.show]) { byShow[r.show] = []; order.push(r.show); } byShow[r.show].push(r); });
  var picked = [], round = 0;
  while (picked.length < n) {
    var added = false;
    for (var i = 0; i < order.length && picked.length < n; i++) { var q = byShow[order[i]]; if (q[round]) { picked.push(q[round]); added = true; } }
    if (!added) break; round++;
  }
  return { picked: picked, eligible: ok.length, shows: order.length, showUrlOnly: rows.filter(function (r) { return r.collectionId && !r.trackId; }).length };
}
/** 1件の判定。lookup = {ok, reason, episodes:[{trackId,guid,collectionId,viewUrlOk}], truncated} */
function agtJudge_(row, lookup) {
  if (!lookup || !lookup.ok) return { status: 'API_ERROR', reason: (lookup && lookup.reason) || 'NO_RESULT', apiGuid: '' };
  var hit = null;
  for (var i = 0; i < lookup.episodes.length; i++) if (String(lookup.episodes[i].trackId) === String(row.trackId)) { hit = lookup.episodes[i]; break; }
  if (!hit) return { status: 'NOT_RETRIEVED', reason: lookup.truncated ? 'TRACKID_NOT_IN_LATEST_200' : 'TRACKID_NOT_IN_RESPONSE', apiGuid: '' };
  if (String(hit.collectionId) !== String(row.collectionId)) return { status: 'MISMATCH', reason: 'COLLECTION_ID_DIFFERS', apiGuid: agtStr_(hit.guid) };
  if (!hit.viewUrlOk) return { status: 'MISMATCH', reason: 'TRACKVIEWURL_NOT_EPISODE', apiGuid: agtStr_(hit.guid) };
  if (!agtStr_(hit.guid)) return { status: 'API_NULL_GUID', reason: 'EPISODE_GUID_EMPTY', apiGuid: '' };
  if (agtStr_(hit.guid).toLowerCase() === row.guid.toLowerCase()) return { status: 'MATCH', reason: 'GUID_EXACT', apiGuid: agtStr_(hit.guid) };
  return { status: 'MISMATCH', reason: 'GUID_DIFFERS', apiGuid: agtStr_(hit.guid) };
}
/** Lookup応答JSON→最小形（キャッシュ100KB制限に収まるようURL本文は持たない） */
function agtCompact_(json, collectionId) {
  var res = (json && json.results) || [], eps = [];
  for (var i = 0; i < res.length; i++) {
    var x = res[i]; if (!(x.wrapperType === 'podcastEpisode' || x.kind === 'podcast-episode')) continue;
    var tid = String(x.trackId || ''), v = agtStr_(x.trackViewUrl);
    eps.push({ trackId: tid, guid: agtStr_(x.episodeGuid), collectionId: String(x.collectionId || ''), viewUrlOk: !!tid && agtParseApple_(v).trackId === tid && agtParseApple_(v).collectionId === String(collectionId) });
  }
  return { episodes: eps, truncated: eps.length >= AGT_CFG.lookupLimit };
}
/** 番組ごとに1回だけ照会。deps = {fetch(url)->{code,text}, sleep(ms), cacheGet(k), cachePut(k,v,sec)}。agg に通信試行とキャッシュを分けて数える */
function agtLookup_(collectionId, deps, agg) {
  var key = 'agt:' + collectionId + ':' + AGT_CFG.country;
  var c = deps.cacheGet(key);
  if (c) { agg.cacheHits++; var o = JSON.parse(c); o.ok = true; o.source = 'CACHE'; return o; }
  var url = 'https://itunes.apple.com/lookup?id=' + collectionId + '&media=podcast&entity=podcastEpisode&country=' + AGT_CFG.country + '&limit=' + AGT_CFG.lookupLimit;
  var last = '';
  for (var attempt = 0; attempt < 2; attempt++) {
    if (agg.apiAttempts > 0 || attempt > 0) deps.sleep(attempt ? 5000 : AGT_CFG.minDelayMs);
    var r; agg.apiAttempts++;
    try { r = deps.fetch(url); } catch (e) { agg.apiFailures++; last = 'FETCH_EXCEPTION'; continue; }
    if (r.code >= 200 && r.code < 300) {
      var j; try { j = JSON.parse(r.text); } catch (e) { agg.apiFailures++; return { ok: false, reason: 'BAD_JSON', source: 'API' }; }
      agg.apiSuccess++;
      var compact = agtCompact_(j, collectionId);
      try { deps.cachePut(key, JSON.stringify(compact), AGT_CFG.cacheSec); } catch (e) { /* キャッシュ失敗は致命的でない */ }
      compact.ok = true; compact.source = 'API'; return compact;
    }
    agg.apiFailures++; last = 'HTTP_' + r.code;
    if (!(r.code === 429 || r.code >= 500)) break; // 再試行は429/5xxに1回だけ
  }
  return { ok: false, reason: last, source: 'API' };
}
/** 選定→照会→判定（書込なし）。シートに依らない中核 */
function agtEvaluate_(rows, n, deps, prevEpIds) {
  var sel = agtSelect_(rows, n), agg = { apiAttempts: 0, apiSuccess: 0, apiFailures: 0, cacheHits: 0 }, memo = {}, results = [], prev = {};
  (prevEpIds || []).forEach(function (e) { prev[e] = true; });
  sel.picked.forEach(function (row, k) {
    if (!memo[row.collectionId]) memo[row.collectionId] = agtLookup_(row.collectionId, deps, agg);
    var lk = memo[row.collectionId], j = agtJudge_(row, lk);
    results.push({ seq: k + 1, epId: row.epId, show: row.show, rowIndex: row.rowIndex, collectionId: row.collectionId, trackId: row.trackId, v2Guid: row.guid, apiGuid: j.apiGuid, status: j.status, reason: j.reason,
      returned: lk.ok ? lk.episodes.length : 0, truncated: !!(lk.ok && lk.truncated), source: lk.source || 'API', overlap5: !!prev[row.epId] });
    if (!lk.ok) delete memo[row.collectionId]; // 失敗は次の行で再試行してよい（通信試行は数える）
  });
  var counts = {}; AGT_STATUSES_.forEach(function (s) { counts[s] = 0; }); results.forEach(function (r) { counts[r.status]++; });
  return { selection: { requested: n, picked: sel.picked.length, eligible: sel.eligible, shows: sel.shows, showUrlOnlyRows: sel.showUrlOnly }, counts: counts, api: agg, results: results };
}

// ---------- GAS 実行部 ----------
function agtOpenChecked_() {
  var cfg = AGT_CFG;
  if (cfg.environment !== 'COPY') throw new Error('ENV_NOT_COPY');
  if (cfg.verifiedEnabled !== false) throw new Error('VERIFIED_ENABLED_REFUSED');
  if (AGT_PROTECTED_IDS_.indexOf(cfg.targetSpreadsheetId) >= 0) throw new Error('PROTECTED_TARGET_REFUSED');
  var trig = ScriptApp.getProjectTriggers().length; if (trig !== 0) throw new Error('TRIGGERS_PRESENT ' + trig);
  var ss = SpreadsheetApp.openById(cfg.targetSpreadsheetId), id = ss.getId(), name = ss.getName();
  if (id !== cfg.targetSpreadsheetId || AGT_PROTECTED_IDS_.indexOf(id) >= 0) throw new Error('OPENED_ID_MISMATCH');
  if (name.indexOf(cfg.expectedNameIncludes) < 0) throw new Error('TARGET_NAME_NOT_COPY');
  var sh = ss.getSheetByName(cfg.sourceSheet); if (!sh) throw new Error('SHEET_NOT_FOUND ' + cfg.sourceSheet);
  return { ss: ss, sh: sh, target: { id: id, name: name, triggers: trig } };
}
function agtDigest_(values) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ((x + 256) % 256).toString(16); }).join('').slice(0, 16);
}
function agtDeps_() {
  var cache = CacheService.getScriptCache();
  return { fetch: function (u) { var r = UrlFetchApp.fetch(u, { method: 'get', muteHttpExceptions: true, followRedirects: true }); return { code: r.getResponseCode(), text: r.getContentText('UTF-8') }; },
    sleep: function (ms) { Utilities.sleep(ms); }, cacheGet: function (k) { return cache.get(k); }, cachePut: function (k, v, s) { cache.put(k, v, s); } };
}
function agtPrev5EpIds_(ss) {
  var lg = ss.getSheetByName(AGT_CFG.logSheet); if (!lg || lg.getLastRow() < 2) return [];
  var v = lg.getRange(2, 1, lg.getLastRow() - 1, AGT_LOG_HEADERS_.length).getValues(), last = '';
  v.forEach(function (r) { if (r[2] === 'URLBOT_GUID_5') last = r[1]; });
  return v.filter(function (r) { return r[1] === last; }).map(function (r) { return String(r[4]); });
}
function agtRun_(fnName, n) {
  if (!(n >= 1 && n <= AGT_CFG.maxN)) throw new Error('N_OUT_OF_RANGE');
  var t0 = Date.now(), o = agtOpenChecked_(), lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return agtReport_(fnName, { status: 'LOCKED' });
  try {
    var before = o.sh.getDataRange().getValues(), digestBefore = agtDigest_(before);
    var prev = n === 10 ? agtPrev5EpIds_(o.ss) : [];
    var ev = agtEvaluate_(agtRowsFromValues_(before), n, agtDeps_(), prev);
    var runId = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss') + '-' + n, now = new Date().toISOString();
    var lg = o.ss.getSheetByName(AGT_CFG.logSheet);
    if (!lg) { lg = o.ss.insertSheet(AGT_CFG.logSheet); lg.getRange(1, 1, 1, AGT_LOG_HEADERS_.length).setValues([AGT_LOG_HEADERS_]); }
    else { var h = lg.getRange(1, 1, 1, AGT_LOG_HEADERS_.length).getValues()[0].map(agtStr_); if (h.join('|') !== AGT_LOG_HEADERS_.join('|')) throw new Error('LOG_HEADER_MISMATCH（既存シートは消さずに停止）'); }
    var rows = ev.results.map(function (r) { return [now, runId, fnName, r.seq, r.epId, r.show, r.collectionId, r.trackId, r.v2Guid, r.apiGuid, r.status, r.reason, r.returned, r.truncated, r.source, n === 10 ? (r.overlap5 ? '重複' : '新規') : '']; });
    var start = lg.getLastRow() + 1;
    if (rows.length) lg.getRange(start, 1, rows.length, AGT_LOG_HEADERS_.length).setValues(rows);
    SpreadsheetApp.flush();
    var back = rows.length ? lg.getRange(start, 1, rows.length, AGT_LOG_HEADERS_.length).getValues() : [];
    var readbackOk = back.length === rows.length && back.every(function (b, i) { return String(b[1]) === runId && String(b[4]) === rows[i][4] && String(b[10]) === rows[i][10]; });
    var digestAfter = agtDigest_(o.sh.getDataRange().getValues());
    var out = { status: readbackOk && digestBefore === digestAfter ? 'OK' : (readbackOk ? 'SOURCE_CHANGED_DURING_RUN' : 'READBACK_MISMATCH'), runId: runId, target: o.target,
      selection: ev.selection, counts: ev.counts, api: ev.api, logRowsWritten: rows.length, logStartRow: start, readbackOk: readbackOk,
      sourceSheetUnchanged: digestBefore === digestAfter, overlapWith5: n === 10 ? ev.results.filter(function (r) { return r.overlap5; }).map(function (r) { return r.epId; }) : [],
      epIds: ev.results.map(function (r) { return r.epId + ':' + r.status; }), totalMs: Date.now() - t0 };
    return agtReport_(fnName, out);
  } finally { lock.releaseLock(); }
}
function agtReport_(fn, obj) { Logger.log(fn + ' ' + JSON.stringify(obj, null, 1)); return obj; }

/** 0) 点検（書込なし・Apple通信なし）: COPY確認・トリガー0・見出し・候補数・ログシートの有無 */
function URLBOT_GUID_0_CHECK() {
  var o = agtOpenChecked_(), v = o.sh.getDataRange().getValues(), rows = agtRowsFromValues_(v), s5 = agtSelect_(rows, 5), s10 = agtSelect_(rows, 10);
  var lg = o.ss.getSheetByName(AGT_CFG.logSheet), fixed = o.ss.getSheetByName('URL補完対象_固定');
  return agtReport_('URLBOT_GUID_0_CHECK', { status: 'CHECK_OK', target: o.target, sourceRows: rows.length, eligible: s5.eligible, shows: s5.shows, showUrlOnlyRows: s5.showUrlOnly,
    preview5: s5.picked.map(function (r) { return r.epId + ' ' + r.show; }), preview10: s10.picked.map(function (r) { return r.epId + ' ' + r.show; }),
    logSheet: lg ? { exists: true, rows: lg.getLastRow() } : { exists: false }, legacyFixedSheet: fixed ? { exists: true, rows: fixed.getLastRow(), cols: fixed.getLastColumn(), note: '読むだけ。移行・削除しない' } : { exists: false } });
}
function URLBOT_GUID_5() { return agtRun_('URLBOT_GUID_5', 5); }
function URLBOT_GUID_10() { return agtRun_('URLBOT_GUID_10', 10); }

if (typeof module !== 'undefined') module.exports = { AGT_CFG: AGT_CFG, agtParseApple_: agtParseApple_, agtRowsFromValues_: agtRowsFromValues_, agtSelect_: agtSelect_, agtJudge_: agtJudge_, agtCompact_: agtCompact_, agtLookup_: agtLookup_, agtEvaluate_: agtEvaluate_ };
