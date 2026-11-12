// ===== V2作業用台帳への新着一括収蔵（PR #306）=====
// 既存の収蔵処理（P25V2_INGEST_COPY・検証）をそのまま使い、書き込み先だけ V2作業用に切り替える。トリガーは作らない。
// 採番衝突の防止: 実行のたびに V2作業用の「V2・統合台帳」「固定ID採番履歴」「削除・除外履歴」「エピソード台帳」と、COPY試験の台帳・採番履歴から
//   使用済みの最大番号を読み、それより大きい番号だけを新規に振る。COPY試験で同じGUIDに振った番号は、V2作業用で未使用ならそのまま使う（GUIDと番号を揃える）。
// 押す順: P25V2_V2_1_CHECK → P25V2_V2_2_DRYRUN → P25V2_V2_3_WRITE_BATCH（1回最大10件・古い順）→ P25V2_V2_4_VERIFY。候補が残れば 3→4 を繰り返す。

var P25V2_V2_CONFIG = {
  environment: 'V2_WORKING',
  targetSpreadsheetId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',
  expectedTargetId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',
  expectedNameIncludes: '基本台帳 V2 作業用',
  v2WorkingApproved: true,   // 2026-11-12 司令塔指示「PR #306のV2新着一括収蔵を実装…実機検証」で承認。false にすると書込は止まる
  sheetName: 'V2・統合台帳',
  scope: 'V2_INGEST_APPEND_ONLY',
  maxRowsCap: 10,
  reservationSources: ['固定ID採番履歴', '削除・除外履歴', 'エピソード台帳']
};
function p25v2V2Cfg_(over) {
  var c = p25v2Cfg_({}), v = JSON.parse(JSON.stringify(P25V2_V2_CONFIG));
  Object.keys(v).forEach(function (k) { c[k] = v[k]; }); Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; });
  var r = p25v2V2Reservation_(c); c.reservedMaxEpNo = r.max; c.guidReserve = r.guidReserve; c.reservation = r.summary;
  return c;
}
// 使用済み番号の最大値と、COPY試験の GUID→番号 対応（V2作業用で別GUIDに使われていない番号だけ）
function p25v2V2Reservation_(c) {
  var num = function (s) { var m = String(s || '').match(/^EP-(\d{5})$/); return m ? +m[1] : 0; }, max = 0, used = {}, summary = {};
  var take = function (label, ids) { var m = 0; ids.forEach(function (id) { var n = num(id); if (n) { used[id] = true; m = Math.max(m, n); } }); summary[label] = m; max = Math.max(max, m); };
  var v2 = SpreadsheetApp.openById(c.targetSpreadsheetId), col = function (ss, sheet, header) {
    var sh = ss.getSheetByName(sheet); if (!sh || sh.getLastRow() < 2) return [];
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], i = h.indexOf(header); if (i < 0) throw new Error('RESERVATION_COLUMN_NOT_FOUND ' + sheet + ':' + header);
    return sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0]; });
  };
  take('V2・統合台帳', col(v2, 'V2・統合台帳', 'EP-ID'));
  take('固定ID採番履歴', col(v2, '固定ID採番履歴', '固定ID'));
  take('削除・除外履歴', col(v2, '削除・除外履歴', '固定ID'));
  take('エピソード台帳', col(v2, 'エピソード台帳', '台帳ID'));
  var copy = SpreadsheetApp.openById(P25V2_COPY_CONFIG.targetSpreadsheetId);
  var cIds = col(copy, '固定ID採番履歴', '固定ID'), cGuids = col(copy, '固定ID採番履歴', 'GUID'), cState = col(copy, '固定ID採番履歴', '状態');
  var copyMax = 0; cIds.concat(col(copy, 'V2・統合台帳', 'EP-ID')).forEach(function (id) { copyMax = Math.max(copyMax, num(id)); });
  summary['COPY試験'] = copyMax; max = Math.max(max, copyMax);
  var guidReserve = {}; cIds.forEach(function (id, i) { if (cState[i] === '登録完了' && num(id) && !used[id]) guidReserve[String(cGuids[i]).toLowerCase()] = id; });
  summary.max = max; summary.copyReservable = Object.keys(guidReserve).length;
  return { max: max, guidReserve: guidReserve, summary: summary };
}
// 1) 点検（書込なし）
function P25V2_V2_1_CHECK() {
  var cfg = p25v2V2Cfg_(), o = p25v2OpenChecked_(cfg, false), out = { target: o.actual, triggers: 0, reservation: cfg.reservation };
  out.sheets = {}; out.sheets[P25V2_SHEET_] = p25v2Schema_(o.sh.getRange(1, 1, 1, o.sh.getLastColumn()).getDisplayValues()[0]).width;
  [[P25V2_NUM_SHEET_, P25V2_NUM_HEADERS_], [P25V2_DETAIL_SHEET_, P25V2_DETAIL_HEADERS_]].forEach(function (p) {
    var x = o.ss.getSheetByName(p[0]); if (!x) throw new Error('SHEET_NOT_FOUND ' + p[0]);
    p25v2SheetHeaderCheck_(x.getRange(1, 1, 1, p[1].length).getDisplayValues(), p[1], p[0]); out.sheets[p[0]] = p[1].length; });
  var f = p25v2FetchFeeds_(cfg.feeds); out.rssItems = f.items.length; out.feedErrors = f.errors;
  out.publicCount = p25v2PublicCount_(p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows);
  out.status = f.errors.length ? 'CHECK_WITH_FEED_ERRORS' : 'CHECK_OK';
  return p25v2Report_('P25V2_V2_1_CHECK', out);
}
// 2) 予行（書込なし）: 全候補と予定番号
function P25V2_V2_2_DRYRUN() {
  var cfg = p25v2V2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds), res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, planAll: true, sha256: p25v2GasSha256_ });
  return p25v2Report_('P25V2_V2_2_DRYRUN', { status: src.errors.length ? 'STOP_FEED_ERRORS' : 'OK', counts: res.counts, reservation: cfg.reservation, feedErrors: src.errors,
    plan: res.plan.map(function (p) { return [p.epId, p.show, p.date, p.guid, p.fromReserve ? 'COPYと同番号' : '新番号']; }),
    hold: res.decisions.filter(function (d) { return d.decision === 'HOLD' || d.decision === 'BLOCK'; }) });
}
// 3) V2作業用へ書込（1回最大10件・古い順）。採番→追記→読み戻し→収蔵詳細（原文）→登録完了
function P25V2_V2_3_WRITE_BATCH() {
  var cfg = p25v2V2Cfg_({ write: true, maxRows: 10 }), o = p25v2OpenChecked_(cfg, true), src = p25v2FetchFeeds_(cfg.feeds), res;
  if (src.errors.length) { res = { mode: 'V2_WRITE', status: 'STOP_FEED_ERRORS', added: 0, feedErrors: src.errors }; p25v2Log_(o.ss, 'P25V2_V2_3_WRITE_BATCH', res, '取得エラーのため書込なし'); return p25v2Report_('P25V2_V2_3_WRITE_BATCH', res); }
  try { res = P25V2_INGEST_COPY(cfg, src, true); }
  catch (e) { res = e.result || { mode: 'V2_WRITE', status: 'ERROR' }; res.status = 'ERROR'; res.error = String(e.message || e); }
  p25v2Log_(o.ss, 'P25V2_V2_3_WRITE_BATCH', res, (res.error || '') + ' 予約最大=' + cfg.reservedMaxEpNo);
  if (res.added > 0) PropertiesService.getScriptProperties().setProperty('P25V2_V2_LAST_WRITE', JSON.stringify({ at: new Date().toISOString(), addedEpIds: res.addedEpIds || [], guids: (res.plan || []).map(function (p) { return p.guid; }), status: res.status }));
  return p25v2Report_('P25V2_V2_3_WRITE_BATCH', { status: res.status, error: res.error, added: res.added, addedEpIds: res.addedEpIds, counts: res.counts, publicBefore: res.publicBefore, publicAfter: res.publicAfter, reservation: cfg.reservation,
    plan: (res.plan || []).map(function (p) { return [p.epId, p.show, p.guid, p.fromReserve ? 'COPYと同番号' : '新番号']; }) });
}
// 4) 読み戻し検証（書込なし）: 台帳1行・GUID一致・採番履歴（GUID一致・登録完了）・原文SHA256・EP-IDの重複なし・再実行で既収蔵
function P25V2_V2_4_VERIFY() { return p25v2Verify_(p25v2V2Cfg_(), 'P25V2_V2_LAST_WRITE', 'P25V2_V2_4_VERIFY'); }
