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

// ===== 掲載判定（Issue #278 基準・V2作業用の新着28件だけ）=====
// 5) 予行（書込なし）→ 6) 反映。掲載判定が「未判定」の行だけを対象にし、既に判定済みの行は書かない（再実行で差分0）。
// 規則: 除外番組（アルキキ・AJW・朝ポキTV/YouTube由来）→ 対象外／再配信表記（（再）（ふりかえり）（深掘り）再放送です）・再生時間0以下 → 対象外（再配信）
//       採番履歴が登録完了でない・GUIDが台帳内で一意でない・同題同日時の他行あり・概要欄に未検証（自動検査合格／品質確認済 以外）の文がある → 保留
//       それ以外 → 対象。概要清掃の合否そのものは掲載可否に使わない（未検証の概要文が台帳に入っていないことだけ確認する）。
var P25V2_V2_JUDGE_EPS_ = ['EP-06695', 'EP-06698'].concat([6700, 6701, 6702, 6703, 6704, 6705, 6706, 6707, 6708, 6709, 6710, 6711, 6712, 6713, 6714, 6715, 6716, 6717, 6718, 6719, 6720, 6721, 6722, 6723, 6724, 6725].map(function (n) { return 'EP-0' + n; }));
var P25V2_EXCLUDED_SHOWS_ = /アルキキ|AJW|朝ポキ|YouTube/i, P25V2_RERUN_MARK_ = /（再）|\(再\)|（ふりかえり）|（深掘り）|再放送です/;
function p25v2V2JudgePlan_(cfg) {
  var o = p25v2OpenChecked_(cfg, false), v = o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues(), h = v[0];
  var I = function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + n); return i; };
  var c = { ep: I('EP-ID'), show: I('番組'), title: I('タイトル'), date: I('配信日時 JST'), judge: I('掲載判定'), rep: I('代表EP-ID'), guid: I('公式GUID'), uuid: I('公式JSON UUID'), dur: I('再生時間 秒'), sum: I('概要（清掃済）'), reason: I('除外・保留理由'), basis: I('判定根拠') };
  var num = {}; p25v2Numbering_(p25v2GasIo_(cfg).readNumbering()).forEach(function (n) { num[n.epId] = n; });
  var ds = o.ss.getSheetByName('V2・清掃詳細'), cv = {}; if (ds && ds.getLastRow() > 1) { var dv = ds.getRange(1, 1, ds.getLastRow(), ds.getLastColumn()).getDisplayValues(); dv.slice(1).forEach(function (r) { cv[r[0]] = r[dv[0].indexOf('判定')]; }); }
  var guidCount = {}, titleDate = {};
  v.slice(1).forEach(function (r) { var seen = {}; [r[c.guid], r[c.uuid]].forEach(function (g) { g = String(g).toLowerCase(); if (g && !seen[g]) { seen[g] = 1; guidCount[g] = (guidCount[g] || 0) + 1; } }); var k = r[c.show] + '\u0001' + r[c.title] + '\u0001' + r[c.date]; titleDate[k] = (titleDate[k] || 0) + 1; });
  var plan = [], at = new Date().toISOString();
  v.forEach(function (r, i) {
    if (i === 0 || P25V2_V2_JUDGE_EPS_.indexOf(r[c.ep]) < 0) return;
    var p = { row: i + 1, ep: r[c.ep], show: r[c.show], cur: r[c.judge], guid: String(r[c.guid]).toLowerCase() }, why = [];
    if (P25V2_EXCLUDED_SHOWS_.test(r[c.show])) { p.judge = '対象外'; why.push('除外番組（Issue #278）'); }
    else if (P25V2_RERUN_MARK_.test(r[c.title]) || !(Number(r[c.dur]) > 0)) { p.judge = '対象外'; why.push(P25V2_RERUN_MARK_.test(r[c.title]) ? '再配信表記（Issue #278）' : '再生時間0以下（Issue #278）'); }
    else {
      if (!num[p.ep] || num[p.ep].state !== '登録完了' || num[p.ep].guid !== p.guid) why.push('採番履歴が登録完了でない');
      if (r[c.rep] !== p.ep) why.push('代表EP-IDが自分でない');
      if (!p.guid || guidCount[p.guid] !== 1) why.push('GUIDが台帳内で一意でない');
      if (titleDate[r[c.show] + '\u0001' + r[c.title] + '\u0001' + r[c.date]] !== 1) why.push('同題・同日時の他行あり');
      if (r[c.sum] && !/^(自動検査合格・目視未確認|品質確認済)$/.test(cv[p.ep] || '')) why.push('未検証の概要文が台帳にある');
      p.judge = why.length ? '保留' : '対象';
    }
    p.reason = p.judge === '対象' ? '' : why.join('／');
    p.basis = 'Issue #278 基準 ' + at.slice(0, 10) + ' P25V2_V2_6: 除外番組でない・再配信表記なし・再生時間>0・採番登録完了・GUID一意・同題同日なし' + (p.judge === '対象' ? '' : ' → ' + p.reason);
    p.action = p.cur === '未判定' ? '書込' : (p.cur === p.judge ? '判定済（同じ）' : '判定済（変更しない）');
    p.cols = c; plan.push(p);
  });
  return { o: o, plan: plan, cols: c };
}
function p25v2PublicMeasured_(ss) { var p = ss.getSheetByName('V2・公開台帳'); if (!p) return 'シートなし'; SpreadsheetApp.flush(); var a = p.getRange(2, 1, Math.max(p.getLastRow() - 1, 1), 1).getDisplayValues(); return a.filter(function (r) { return r[0]; }).length; }
function p25v2JudgeCounts_(plan) { var n = {}; plan.forEach(function (p) { n[p.judge] = (n[p.judge] || 0) + 1; }); return n; }
function P25V2_V2_5_掲載判定_予行() {
  var cfg = p25v2V2Cfg_(), r = p25v2V2JudgePlan_(cfg);
  return p25v2Report_('P25V2_V2_5_掲載判定_予行', { status: 'OK', targets: r.plan.length, judges: p25v2JudgeCounts_(r.plan), toWrite: r.plan.filter(function (p) { return p.action === '書込'; }).length, publicMeasured: p25v2PublicMeasured_(r.o.ss),
    plan: r.plan.map(function (p) { return [p.ep, p.show, p.cur, '→', p.judge, p.reason, p.action]; }) });
}
function P25V2_V2_6_掲載判定_反映() {
  var cfg = p25v2V2Cfg_({ write: true }), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return p25v2Report_('P25V2_V2_6_掲載判定_反映', { status: 'LOCKED' });
  try {
    p25v2OpenChecked_(cfg, true);
    var r = p25v2V2JudgePlan_(cfg), c = r.cols, sh = r.o.sh, before = p25v2PublicMeasured_(r.o.ss), w = r.plan.filter(function (p) { return p.action === '書込'; }), bad = 0;
    if (r.plan.length !== P25V2_V2_JUDGE_EPS_.length) throw new Error('JUDGE_TARGET_COUNT_MISMATCH ' + r.plan.length);
    w.forEach(function (p) { sh.getRange(p.row, c.judge + 1).setValue(p.judge); sh.getRange(p.row, c.reason + 1).setValue(p.reason); sh.getRange(p.row, c.basis + 1).setValue(p.basis); });
    SpreadsheetApp.flush();
    w.forEach(function (p) { var b = sh.getRange(p.row, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; if (b[c.ep] !== p.ep || b[c.judge] !== p.judge || b[c.reason] !== p.reason || b[c.basis] !== p.basis) bad++; });
    var after = p25v2PublicMeasured_(r.o.ss), added = w.filter(function (p) { return p.judge === '対象'; }).length;
    var out = { status: bad ? 'READBACK_MISMATCH' : (typeof before === 'number' && after === before + added) ? (w.length ? 'OK' : 'OK_NO_CHANGE') : 'PUBLIC_COUNT_MISMATCH', written: w.length, readbackMismatch: bad, judges: p25v2JudgeCounts_(r.plan), publicBefore: before, publicAfter: after, expectedAfter: typeof before === 'number' ? before + added : null,
      skipped: r.plan.filter(function (p) { return p.action !== '書込'; }).length, notTarget: r.plan.filter(function (p) { return p.judge !== '対象'; }).map(function (p) { return [p.ep, p.judge, p.reason]; }) };
    p25v2Log_(r.o.ss, 'P25V2_V2_6_掲載判定_反映', { mode: 'V2_WRITE', status: out.status, counts: out.judges }, JSON.stringify(w.map(function (p) { return p.ep + ':' + p.cur + '→' + p.judge; })).slice(0, 400));
    return p25v2Report_('P25V2_V2_6_掲載判定_反映', out);
  } finally { lock.releaseLock(); }
}
