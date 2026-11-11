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
  var f = p25v2FetchFeeds_(cfg.feeds);
  cfg.feeds.forEach(function (fd) { out.feeds.push({ show: fd.show, items: f.items.filter(function (i) { return i.show === fd.show; }).length, rawPresent: f.items.filter(function (i) { return i.show === fd.show && i.descriptionRaw; }).length }); });
  out.feedErrors = f.errors; out.status = f.errors.length ? 'CHECK_WITH_FEED_ERRORS' : 'CHECK_OK';
  return p25v2Report_('P25V2_1_CHECK', out);
}
// 2) 予行（書込なし）: 判定の内訳と、全候補の予定採番
function P25V2_2_DRYRUN() {
  var cfg = p25v2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds);
  var res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, planAll: true, sha256: p25v2GasSha256_ });
  res.feedErrors = src.errors; res.decisions = res.decisions.filter(function (d) { return d.decision !== 'ALREADY_INGESTED'; });
  return p25v2Report_('P25V2_2_DRYRUN', res);
}
// 3) COPYへ1件だけ実書込（古い候補から1件）。採番→追記→読み戻し→収蔵詳細（原文）→登録完了。結果はスクリプトのプロパティに保存
function P25V2_3_WRITE_ONE() {
  var cfg = p25v2Cfg_({ write: true, maxRows: 1 }), o = p25v2OpenChecked_(cfg, true), res;
  try { res = P25V2_INGEST_COPY(cfg, null, true); }
  catch (e) { res = e.result || { mode: 'COPY_WRITE', status: 'ERROR' }; res.status = 'ERROR'; res.error = String(e.message || e); }
  p25v2Log_(o.ss, 'P25V2_3_WRITE_ONE', res, res.error || '');
  PropertiesService.getScriptProperties().setProperty('P25V2_LAST_WRITE', JSON.stringify({ at: new Date().toISOString(), addedEpIds: res.addedEpIds || [], guids: (res.plan || []).map(function (p) { return p.guid; }), status: res.status }));
  return p25v2Report_('P25V2_3_WRITE_ONE', res);
}
// 4) 読み戻し検証（書込なし）: 直前の追加分が 台帳(GUID一致)・採番(登録完了)・収蔵詳細(原文SHA256一致) に揃い、再実行では「既収蔵」になること
function P25V2_4_VERIFY() {
  var cfg = p25v2Cfg_(), o = p25v2OpenChecked_(cfg, false), last = JSON.parse(PropertiesService.getScriptProperties().getProperty('P25V2_LAST_WRITE') || '{}');
  var io = p25v2GasIo_(cfg); io.open();
  var recs = p25v2Records_(io.readAll()), num = p25v2Numbering_(io.readNumbering()), det = io.readDetails(), dh = det[0];
  var checks = (last.addedEpIds || []).map(function (ep) {
    var row = recs.rows.filter(function (r) { return r.epId === ep; })[0], n = num.filter(function (x) { return x.epId === ep; })[0];
    var d = det.filter(function (r) { return r[0] === ep; })[0], raw = d ? String(d[dh.indexOf('概要原文')]) : '';
    return { epId: ep, ledgerRow: !!row, numbering: n ? n.state : 'なし', detailRow: !!d, rawLen: raw.length, rawShaOk: !!raw && p25v2GasSha256_(raw) === String(d[dh.indexOf('概要原文SHA256')]) };
  });
  var pending = num.filter(function (x) { return x.state === '採番済'; }).map(function (x) { return x.epId; });
  var src = p25v2FetchFeeds_(cfg.feeds), again = p25v2Ingest_(io, cfg, p25v2StripUnverified_(src.items), { write: false, sha256: p25v2GasSha256_ });
  var lastGuids = last.guids || [], rerunAlready = again.decisions.filter(function (x) { return lastGuids.indexOf(x.guid) >= 0; }).every(function (x) { return x.decision === 'ALREADY_INGESTED'; });
  var ok = checks.length > 0 && checks.every(function (c) { return c.ledgerRow && c.numbering === '登録完了' && c.detailRow && c.rawShaOk; }) && !pending.length && rerunAlready;
  var out = { status: ok ? 'VERIFY_OK' : 'VERIFY_NG', last: last, checks: checks, numberingPending: pending, rerunAlreadyIngested: rerunAlready, nextCandidates: again.counts.CANDIDATE };
  p25v2Log_(o.ss, 'P25V2_4_VERIFY', { mode: 'READ_ONLY', status: out.status, counts: again.counts }, JSON.stringify(checks).slice(0, 300));
  return p25v2Report_('P25V2_4_VERIFY', out);
}
// 5) 原文の後日補完: 収蔵詳細で原文が空・ハッシュだけある行を、公式RSSの原文で埋める（GUID一致・SHA前方一致・文字数一致・空欄だけ）。1回10件まで
function P25V2_5_BACKFILL_RAW() {
  var cfg = p25v2Cfg_({ write: true }), o = p25v2OpenChecked_(cfg, true), lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return p25v2Report_('P25V2_5_BACKFILL_RAW', { status: 'LOCKED' });
  try {
    var det = o.ss.getSheetByName(P25V2_DETAIL_SHEET_), vals = det.getRange(1, 1, det.getLastRow(), P25V2_DETAIL_HEADERS_.length).getDisplayValues();
    p25v2SheetHeaderCheck_(vals, P25V2_DETAIL_HEADERS_, P25V2_DETAIL_SHEET_);
    var src = p25v2FetchFeeds_(cfg.feeds.map(function (f) { return { show: f.show, url: f.url, limit: 0 }; })), byGuid = {};   // 古い回も探すので全件
    src.items.forEach(function (i) { if (i.guid && i.descriptionRaw) byGuid[i.guid] = i.descriptionRaw; });
    var plan = p25v2PlanRawBackfill_(vals, byGuid, p25v2GasSha256_, new Date().toISOString()).slice(0, P25V2_HARD_CAP_), done = [], hold = [];
    plan.forEach(function (p) {
      if (p.hold) { hold.push({ epId: p.epId, why: p.hold }); return; }
      var cur = det.getRange(p.row, 5).getDisplayValue(); if (cur) { hold.push({ epId: p.epId, why: 'RAW_ALREADY_PRESENT' }); return; }   // 書込直前に再確認
      det.getRange(p.row, 4, 1, 5).setValues([[p.at, p.raw, p.sha, String(p.raw.length), '未清掃']]); det.getRange(p.row, 17).setValue('公式RSS直接（GAS後日補完）');
      SpreadsheetApp.flush();
      var back = det.getRange(p.row, 5).getValue();
      if (p25v2GasSha256_(String(back)) !== p.sha) hold.push({ epId: p.epId, why: 'READBACK_MISMATCH' }); else done.push(p.epId);
    });
    var res = { mode: 'COPY_WRITE', status: hold.some(function (h) { return h.why === 'READBACK_MISMATCH'; }) ? 'READBACK_MISMATCH' : 'OK', filled: done, hold: hold, feedErrors: src.errors };
    p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', { mode: res.mode, status: res.status, added: done.length, feedErrors: src.errors, addedEpIds: done }, JSON.stringify(hold).slice(0, 300));
    return p25v2Report_('P25V2_5_BACKFILL_RAW', res);
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
