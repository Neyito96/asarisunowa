// 朝リスの田 V2 収蔵ボット — 独立COPY専用 Apps Script の入口（P25V2IngestAdapter.js と1つのプロジェクトに入れる）。
// 守ること: 書き込み先は COPY だけ（保護ID・名前・実際に開いたID・シート見出しを毎回確認）。トリガーは作らない。
// 収蔵だけを行う。清掃・出演者・関連記事・6サービスURLは書かない（別工程。品質未検証の値を台帳本体に入れない）。
// 管理人が手で実行する関数は番号付きの5つ: P25V2_1_CHECK → P25V2_2_DRYRUN → P25V2_3_WRITE_ONE → P25V2_4_VERIFY →（必要時）P25V2_5_BACKFILL_RAW。

var P25V2_COPY_CONFIG = {
  environment: 'COPY',
  targetSpreadsheetId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',   // 【COPY試験】V2収蔵ボット P25V2 1件試験 2026-11-11（本番ではない）
  expectedTargetId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',     // 二重申告。上と違えば停止
  expectedNameIncludes: '【COPY試験】',
  sheetName: 'V2・統合台帳',
  scope: 'V2_INGEST_APPEND_ONLY',
  maxRowsCap: 1,            // 1回の追記上限（絶対上限10。引き上げは別承認）
  reservedMaxEpNo: 6720,    // 本番・削除済みを含めた既知の最大番号（これ以下は採番しない）
  feedLimit: 30,            // 1フィードあたり新しい順に見る件数（取りこぼし再探索は P25V2_6_RESCAN_READONLY）
  feeds: [
    { show: 'ニュースの現場から', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/684015f9-2396-4ac4-bc1f-ac0f0033d08c/podcast.rss' },
    { show: 'MEDIA TALK', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/07a1de49-67cf-4714-8581-ac1000059302/podcast.rss' },
    { show: 'こどもそうだんしつ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/693cfdd6-f5a9-4308-9025-adb10164b5b1/podcast.rss' },
    { show: 'スポンジ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/8ceab8ef-af5f-44e9-9545-b4ab0024434b/podcast.rss' },
    { show: 'ニュースの学校', url: 'https://feeds.megaphone.fm/TASC5851398719' },
    { show: 'ドーナツ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/c373aac9-fb6a-4172-8a8f-b498003d9389/podcast.rss' },
    { show: '報談', url: 'https://feeds.megaphone.fm/TASC9421488254' }
  ]
};
var P25V2_LOG_SHEET_ = 'V2・実行ログ';
var P25V2_FETCH_BUDGET_MS_ = 120000;   // 全件取得がこれを超えたら書込系は止める（GASの1回6分の上限に余裕を残す）。超えたら番組ごとの分割実行に切り替える
var P25V2_RUN_BUDGET_MS_ = 240000;     // 書込開始の締切（実行開始から4分）
var P25V2_LOG_HEADERS_ = ['実行日時', '関数', 'モード', '状態', '追加件数', '候補', 'HOLD', 'BLOCK', '既収蔵', '取得エラー', '追加EP-ID', '備考'];

function p25v2Cfg_(over) { var c = JSON.parse(JSON.stringify(P25V2_COPY_CONFIG)); Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; }); c.feeds = c.feeds.map(function (f) { return { show: f.show, url: f.url, limit: f.limit || c.feedLimit }; }); return c; }
function p25v2Env_() { return { hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: ScriptApp.getProjectTriggers().length }; }
// 開く前・開いた後の両方で対象を確認する（書込なし）
function p25v2OpenChecked_(cfg, forWrite) {
  p25v2AssertIsolated_(p25v2Env_());
  if (P25V2_PROTECTED_IDS_.indexOf(cfg.targetSpreadsheetId) >= 0) throw new Error('PROTECTED_TARGET_REFUSED');
  var ss = SpreadsheetApp.openById(cfg.targetSpreadsheetId), sh = ss.getSheetByName(cfg.sheetName);
  var actual = { id: ss.getId(), name: ss.getName(), sheetName: sh ? sh.getName() : '' };
  p25v2AssertCopyTarget_(cfg, actual, forWrite);
  if (cfg.expectedNameIncludes && actual.name.indexOf(cfg.expectedNameIncludes) < 0) throw new Error('TARGET_NAME_NOT_EXPECTED');
  return { ss: ss, sh: sh, actual: actual };
}
function p25v2Log_(ss, fn, res, note) {
  try {
    var lg = ss.getSheetByName(P25V2_LOG_SHEET_);
    if (!lg) { lg = ss.insertSheet(P25V2_LOG_SHEET_); lg.getRange(1, 1, 1, P25V2_LOG_HEADERS_.length).setValues([P25V2_LOG_HEADERS_]); }
    var c = (res && res.counts) || {};
    lg.appendRow([new Date().toISOString(), fn, (res && res.mode) || '', (res && res.status) || '', (res && res.added) || 0, c.CANDIDATE || 0, c.HOLD || 0, c.BLOCK || 0, c.ALREADY_INGESTED || 0,
      ((res && res.feedErrors) || []).map(function (e) { return e.show + ':' + e.error; }).join(' / '), ((res && res.addedEpIds) || []).join(','), String(note || '').slice(0, 300)]);   // 本文は書かない
  } catch (e) { Logger.log('LOG_WRITE_FAILED ' + e.message); }
}
function p25v2Report_(fn, obj) { Logger.log(fn + ' ' + JSON.stringify(obj, null, 1)); return obj; }

// 1) 事前点検（書込なし）: 隔離・トリガー0・保護ID拒否・COPY名・3シートの見出し・RSS7本の取得
function P25V2_1_CHECK() {
  var cfg = p25v2Cfg_(), o = p25v2OpenChecked_(cfg, false), out = { target: o.actual, triggers: 0, sheets: {}, feeds: [] };
  out.sheets[P25V2_SHEET_] = p25v2Schema_(o.sh.getRange(1, 1, 1, o.sh.getLastColumn()).getDisplayValues()[0]).width;
  [[P25V2_NUM_SHEET_, P25V2_NUM_HEADERS_], [P25V2_DETAIL_SHEET_, P25V2_DETAIL_HEADERS_]].forEach(function (p) {
    var x = o.ss.getSheetByName(p[0]); if (!x) throw new Error('SHEET_NOT_FOUND ' + p[0]);
    if (x.getMaxColumns() < p[1].length) throw new Error('SHEET_TOO_NARROW ' + p[0] + ' 必要列数=' + p[1].length);
    p25v2SheetHeaderCheck_(x.getRange(1, 1, 1, p[1].length).getDisplayValues(), p[1], p[0]); out.sheets[p[0]] = p[1].length;
  });
  var t0 = Date.now(), f = p25v2FetchFeeds_(cfg.feeds.map(function (x) { return { show: x.show, url: x.url, limit: 0 }; }));   // 全件取得の時間・サイズを実測（後日補完と同じ条件）
  cfg.feeds.forEach(function (fd) { var st = (f.stats || []).filter(function (x) { return x.show === fd.show; })[0] || {};
    out.feeds.push({ show: fd.show, items: f.items.filter(function (i) { return i.show === fd.show; }).length, rawPresent: f.items.filter(function (i) { return i.show === fd.show && i.descriptionRaw; }).length, ms: st.ms, chars: st.chars }); });
  out.fetchAllMs = Date.now() - t0; out.publicCount = p25v2PublicCount_(p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows);
  out.feedErrors = f.errors; out.status = f.errors.length ? 'CHECK_WITH_FEED_ERRORS' : (out.fetchAllMs > P25V2_FETCH_BUDGET_MS_ ? 'CHECK_FETCH_TOO_SLOW' : 'CHECK_OK');
  out.next = out.status !== 'CHECK_OK' ? '書込に進まない（表示をそのまま報告）' : '次は P25V2_2_DRYRUN';
  return p25v2Report_('P25V2_1_CHECK', out);
}
// 2) 予行（書込なし）: 判定の内訳と、全候補の予定採番
function P25V2_2_DRYRUN() {
  var cfg = p25v2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds);
  var res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, planAll: true, sha256: p25v2GasSha256_ });
  res.feedErrors = src.errors; res.decisions = res.decisions.filter(function (d) { return d.decision !== 'ALREADY_INGESTED'; });
  res.next = src.errors.length ? '書込に進まない（取得エラー）' : res.counts.CANDIDATE > 0 ? '次は P25V2_3_WRITE_ONE → P25V2_4_VERIFY' : '新着なし: WRITE_ONE は実行しない。次は P25V2_5_BACKFILL_RAW（原文の後日補完）→ もう一度 P25V2_5_BACKFILL_RAW（差分0の確認）';
  return p25v2Report_('P25V2_2_DRYRUN', res);
}
// 3) COPYへ1件だけ実書込（古い候補から1件）。採番→追記→読み戻し→収蔵詳細（原文）→登録完了。結果はスクリプトのプロパティに保存
function P25V2_3_WRITE_ONE() {
  var cfg = p25v2Cfg_({ write: true, maxRows: 1 }), o = p25v2OpenChecked_(cfg, true), res, src = p25v2FetchFeeds_(cfg.feeds);
  if (src.errors.length) { res = { mode: 'COPY_WRITE', status: 'STOP_FEED_ERRORS', added: 0, feedErrors: src.errors }; p25v2Log_(o.ss, 'P25V2_3_WRITE_ONE', res, '取得エラーのため書込なし'); return p25v2Report_('P25V2_3_WRITE_ONE', res); }
  try { res = P25V2_INGEST_COPY(cfg, src, true); }
  catch (e) { res = e.result || { mode: 'COPY_WRITE', status: 'ERROR' }; res.status = 'ERROR'; res.error = String(e.message || e); }
  p25v2Log_(o.ss, 'P25V2_3_WRITE_ONE', res, res.error || '');
  if (res.added > 0) PropertiesService.getScriptProperties().setProperty('P25V2_LAST_WRITE', JSON.stringify({ at: new Date().toISOString(), addedEpIds: res.addedEpIds || [], guids: (res.plan || []).map(function (p) { return p.guid; }), status: res.status }));
  return p25v2Report_('P25V2_3_WRITE_ONE', res);
}
// 4) 読み戻し検証（書込なし）: 直前の追加分が 台帳(GUID一致)・採番(登録完了)・収蔵詳細(原文SHA256一致) に揃い、再実行では「既収蔵」になること
function P25V2_4_VERIFY() { return p25v2Verify_(p25v2Cfg_(), 'P25V2_LAST_WRITE', 'P25V2_4_VERIFY'); }
function p25v2Verify_(cfg, propKey, fn) {
  var o = p25v2OpenChecked_(cfg, false), last = JSON.parse(PropertiesService.getScriptProperties().getProperty(propKey) || '{}');
  if (!(last.addedEpIds || []).length) return p25v2Report_(fn, { status: 'NO_WRITE_TO_VERIFY', note: '書込で1件以上追加した後に実行する' });
  var io = p25v2GasIo_(cfg); io.open();
  var recs = p25v2Records_(io.readAll()), num = p25v2Numbering_(io.readNumbering()), det = io.readDetails(), dh = det[0];
  var checks = (last.addedEpIds || []).map(function (ep, i) {
    var row = recs.rows.filter(function (r) { return r.epId === ep; }), n = num.filter(function (x) { return x.epId === ep; })[0];
    var d = det.filter(function (r) { return r[0] === ep; })[0], raw = d ? String(d[dh.indexOf('概要原文')]) : '', g = (last.guids || [])[i] || '';
    return { epId: ep, ledgerRows: row.length, guidOk: row.length === 1 && p25v2Guids_(row[0]).indexOf(g) >= 0, numbering: n ? n.state : 'なし', numberingGuidOk: !!n && n.guid === g, detailRow: !!d, rawLen: raw.length, rawShaOk: !!raw && p25v2GasSha256_(raw) === String(d[dh.indexOf('概要原文SHA256')]) };
  });
  var dupIds = {}, dups = []; recs.rows.forEach(function (r) { if (dupIds[r.epId]) dups.push(r.epId); dupIds[r.epId] = 1; });
  var pending = num.filter(function (x) { return x.state === '採番済'; }).map(function (x) { return x.epId; });
  var src = p25v2FetchFeeds_(cfg.feeds), again = p25v2Ingest_(io, cfg, p25v2StripUnverified_(src.items), { write: false, sha256: p25v2GasSha256_ });
  var lastGuids = last.guids || [], rerunAlready = again.decisions.filter(function (x) { return lastGuids.indexOf(x.guid) >= 0; }).every(function (x) { return x.decision === 'ALREADY_INGESTED'; });
  var ok = checks.length > 0 && checks.every(function (c) { return c.ledgerRows === 1 && c.guidOk && c.numbering === '登録完了' && c.numberingGuidOk && c.detailRow && c.rawShaOk; }) && !pending.length && !dups.length && rerunAlready;
  var out = { status: ok ? 'VERIFY_OK' : 'VERIFY_NG', last: last, checks: checks, numberingPending: pending, duplicateEpIds: dups, rerunAlreadyIngested: rerunAlready, nextCandidates: again.counts.CANDIDATE };
  p25v2Log_(o.ss, fn, { mode: 'READ_ONLY', status: out.status, counts: again.counts }, JSON.stringify(checks.map(function (c) { return c.epId + ':' + (c.guidOk && c.rawShaOk && c.numbering === '登録完了' ? 'OK' : 'NG'); })).slice(0, 300));
  return p25v2Report_(fn, out);
}
// 5) 原文の後日補完: 収蔵詳細で原文が空・ハッシュだけある行を、公式RSSの原文で埋める（GUID一致・SHA前方一致・文字数一致・空欄だけ）。1回10件まで
function P25V2_5_BACKFILL_RAW() {
  var t0 = Date.now(), cfg = p25v2Cfg_({ write: true }), o = p25v2OpenChecked_(cfg, true), lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return p25v2Report_('P25V2_5_BACKFILL_RAW', { status: 'LOCKED' });
  try {
    var det = o.ss.getSheetByName(P25V2_DETAIL_SHEET_), W = P25V2_DETAIL_HEADERS_.length;
    var readDet = function () { return det.getRange(1, 1, det.getLastRow(), W).getDisplayValues(); };
    var pub = function () { return p25v2PublicCount_(p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows); };
    var vals = readDet(); p25v2SheetHeaderCheck_(vals, P25V2_DETAIL_HEADERS_, P25V2_DETAIL_SHEET_);
    var ledger = p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows, guidOf = {};
    ledger.forEach(function (r) { guidOf[r.epId] = (p25v2Guids_(r)[0] || '').toLowerCase(); });
    var publicBefore = p25v2PublicCount_(ledger);
    var src = p25v2FetchFeeds_(cfg.feeds.map(function (f) { return { show: f.show, url: f.url, limit: 0 }; })), byGuid = {};   // 古い回も探すので全件
    var base = { mode: 'COPY_WRITE', fetchMs: Date.now() - t0, fetchStats: src.stats, feedErrors: src.errors, filled: [], hold: [] };
    if (src.errors.length) { base.status = 'STOP_FEED_ERRORS'; p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', base, '取得エラーのため書込なし'); return p25v2Report_('P25V2_5_BACKFILL_RAW', base); }
    if (Date.now() - t0 > P25V2_RUN_BUDGET_MS_) { base.status = 'STOP_TIME_BUDGET'; p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', base, '時間切れのため書込なし（分割実行に切替）'); return p25v2Report_('P25V2_5_BACKFILL_RAW', base); }
    src.items.forEach(function (i) { if (i.guid && i.descriptionRaw) byGuid[i.guid] = i.descriptionRaw; });
    var plan = p25v2PlanRawBackfill_(vals, byGuid, p25v2GasSha256_, new Date().toISOString()), writes = [], hold = base.hold, done = base.filled;
    plan.forEach(function (p) {
      if (p.hold) { hold.push({ epId: p.epId, why: p.hold }); return; }
      if (guidOf[p.epId] !== String(vals[p.row - 1][1]).toLowerCase()) { hold.push({ epId: p.epId, why: 'LEDGER_GUID_MISMATCH' }); return; }   // EP-ID と GUID が台帳と一致する行だけ
      if (writes.length < P25V2_HARD_CAP_) writes.push(p);
    });
    var touched = {};
    writes.forEach(function (p) {
      if (det.getRange(p.row, 5).getDisplayValue()) { hold.push({ epId: p.epId, why: 'RAW_ALREADY_PRESENT' }); return; }   // 書込直前に再確認
      det.getRange(p.row, 4, 1, 5).setValues([[p.at, p.raw, p.sha, String(p.raw.length), '未清掃']]); det.getRange(p.row, 17).setValue('公式RSS直接（GAS後日補完）');
      [4, 5, 6, 7, 8, 17].forEach(function (c) { touched[p.row + ':' + c] = 1; }); SpreadsheetApp.flush();
      var back = String(det.getRange(p.row, 5).getValue());
      if (p25v2GasSha256_(back) !== p.sha || back.length !== p.raw.length) hold.push({ epId: p.epId, why: 'READBACK_MISMATCH' }); else done.push(p.epId);
    });
    // 他のセルが変わっていないこと（収蔵詳細17列の全セル比較）と、公開数が変わっていないこと
    var after = readDet(), changed = 0;
    for (var r = 0; r < Math.max(vals.length, after.length); r++) for (var c = 0; c < W; c++) if (!touched[(r + 1) + ':' + (c + 1)] && String((vals[r] || [])[c] || '') !== String((after[r] || [])[c] || '')) changed++;
    var publicAfter = pub();
    base.otherCellsChanged = changed; base.publicBefore = publicBefore; base.publicAfter = publicAfter; base.remainingAfter = plan.filter(function (p) { return !p.hold; }).length - done.length;
    base.status = hold.some(function (h) { return h.why === 'READBACK_MISMATCH'; }) ? 'READBACK_MISMATCH' : changed ? 'OTHER_CELLS_CHANGED' : publicAfter !== publicBefore ? 'PUBLIC_COUNT_CHANGED' : done.length ? 'OK' : 'OK_NO_CHANGE';
    base.totalMs = Date.now() - t0;
    p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', { mode: base.mode, status: base.status, added: done.length, feedErrors: src.errors, addedEpIds: done }, JSON.stringify({ hold: hold, other: changed, pub: [publicBefore, publicAfter], ms: base.totalMs }).slice(0, 300));
    return p25v2Report_('P25V2_5_BACKFILL_RAW', base);
  } finally { lock.releaseLock(); }
}
// 原文補完の計画（純関数・試験対象）。rows は収蔵詳細の表示値（見出し込み）
function p25v2PlanRawBackfill_(vals, byGuid, sha256, at) {
  var h = vals[0], I = function (n) { return h.indexOf(n); }, out = [];
  vals.slice(1).forEach(function (r, i) {
    var ep = String(r[I('EP-ID')] || ''), g = String(r[I('公式GUID')] || '').toLowerCase(), have = String(r[I('概要原文')] || '');
    if (!ep || have || !byGuid[g]) return;
    var raw = byGuid[g], sha = sha256(raw), rec = String(r[I('概要原文SHA256')] || ''), len = String(r[I('概要原文文字数')] || '');
    if (!rec) { out.push({ row: i + 2, epId: ep, hold: 'NO_RECORDED_HASH' }); return; }
    if (sha.indexOf(rec) !== 0) { out.push({ row: i + 2, epId: ep, hold: 'SHA_MISMATCH' }); return; }   // 収蔵後に公式側の文面が変わった→上書きせず人が判断
    if (len && Number(len) !== raw.length) { out.push({ row: i + 2, epId: ep, hold: 'LENGTH_MISMATCH' }); return; }
    out.push({ row: i + 2, epId: ep, raw: raw, sha: sha, at: at });
  });
  return out;
}
// 6) 取りこぼし再探索（書込なし）: 各フィードの全件を見て、未収蔵の候補を一覧する。古い回は台帳側にGUIDが無いことがあるため、ここでは書かない
function P25V2_6_RESCAN_READONLY() {
  var cfg = p25v2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds.map(function (f) { return { show: f.show, url: f.url, limit: 0 }; }));
  var res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, sha256: p25v2GasSha256_ });
  return p25v2Report_('P25V2_6_RESCAN_READONLY', { counts: res.counts, feedErrors: src.errors, notIngested: res.decisions.filter(function (d) { return d.decision !== 'ALREADY_INGESTED'; }) });
}
