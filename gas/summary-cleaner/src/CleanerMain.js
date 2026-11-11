// ===== 概要欄清掃ロボ（Issue #308）— 入口 =====
// 管理人が押すのは番号付き関数だけ: S1_点検 → S2_清掃監査（全件・時間切れなら続きから）→ S3A_COPYへ反映_試験10件 → S3B_COPYへ反映_全件 →（確認後）S4_V2作業用へ反映。S0_進捗 はいつでも。
// 守ること: 原文は読むだけ（公式RSSから毎回取得し、SHA256で照合）。V1原本・本番59列・旧GAS参照シートは開かない。トリガーは作らない。
// 台帳へ書くのは「概要（清掃済）・出演者・関連記事URL」の3列だけ。手動訂正の可能性がある値・監査時から変わった値は書かない。

var SC_CONFIG = {
  copyId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',     // 【COPY試験】V2収蔵ボット …（本番ではない）。結果・進捗・反映履歴のシートもここに作る
  copyNameIncludes: '【COPY試験】',
  v2WorkingId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',  // V2作業用台帳（S4 だけが書く）
  // S4 で V2作業用へ反映する範囲: 'HUMAN_OK' = 結果シートの「人の確認」が OK の行だけ（既定）／'AUTO_PASS' = 自動検査合格も含める（COPYで抜き取り確認した後に管理人が切り替える）
  v2ApplyLevel: 'AUTO_PASS',   // 2026-11-12 司令塔指示で AUTO_PASS（COPYで抜き取り20件確認後）。'HUMAN_OK' に戻すと人の確認OKの行だけ
  ledgerSheet: 'V2・統合台帳',
  timeBudgetMs: 270000,     // 1回の実行で処理に使う時間（GASの上限6分に余裕を残す）
  applyMaxPerRun: 6000,
  feeds: P25V2_COPY_FEEDS_()
};
var SC_REFUSE_IDS_ = ['1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'];   // V1原本・本番59列・旧GAS参照
var SC_RESULT_ = '清掃・結果', SC_PROGRESS_ = '清掃・進捗', SC_HISTORY_ = '清掃・反映履歴';
var SC_HEADERS_ = ['EP-ID', '公式GUID', '番組', '原文SHA256', '原文文字数', '原文取得', '判定', '比較', '理由', '書換可', '新・概要', '新・出演者', '新・関連記事URL', '関連記事JSON(見出し+URL)', '出演者JSON', 'SNS等保全URL', '除去内訳', '旧・概要', '旧・出演者', '旧・関連記事URL', '旧値SHA', '清掃版', '処理日時', '人の確認', '確認メモ', '反映先', '反映日時'];
var SC_HIST_HEADERS_ = ['反映日時', '反映ID', '対象', 'EP-ID', '列', '旧値', '新値', '状態'];
// V2作業用台帳（34列）は列を増やさず、同じファイルの別タブに構造化データ（見出し＋URLの組・出演者の内訳）を保持する
var SC_V2DETAIL_ = 'V2・清掃詳細', SC_V2DETAIL_HEADERS_ = ['EP-ID', '公式GUID', '関連記事JSON(見出し+URL)', '出演者JSON', 'SNS等保全URL', '原文SHA256', '清掃版', '判定', '反映日時', '反映ID'];
var SC_COLS_ = { summary: '概要（清掃済）', cast: '出演者', related: '関連記事URL' };
function P25V2_COPY_FEEDS_() { return [
  { show: 'ニュースの現場から', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/684015f9-2396-4ac4-bc1f-ac0f0033d08c/podcast.rss', limit: 0 },
  { show: 'MEDIA TALK', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/07a1de49-67cf-4714-8581-ac1000059302/podcast.rss', limit: 0 },
  { show: 'こどもそうだんしつ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/693cfdd6-f5a9-4308-9025-adb10164b5b1/podcast.rss', limit: 0 },
  { show: 'スポンジ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/8ceab8ef-af5f-44e9-9545-b4ab0024434b/podcast.rss', limit: 0 },
  { show: 'ニュースの学校', url: 'https://feeds.megaphone.fm/TASC5851398719', limit: 0 },
  { show: 'ドーナツ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/c373aac9-fb6a-4172-8a8f-b498003d9389/podcast.rss', limit: 0 },
  { show: '報談', url: 'https://feeds.megaphone.fm/TASC9421488254', limit: 0 }]; }

function scVersion_() { return CleanerV4.CLEANER_VERSION + '|' + QualityAudit.AUDIT_VERSION; }
function scLog_(fn, o) { Logger.log(fn + ' ' + JSON.stringify(o, null, 1)); return o; }
function scOpen_(id, nameIncludes) {
  if (SC_REFUSE_IDS_.indexOf(id) >= 0) throw new Error('PROTECTED_TARGET_REFUSED');
  p25v2AssertIsolated_({ hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: ScriptApp.getProjectTriggers().length });
  var ss = SpreadsheetApp.openById(id); if (ss.getId() !== id) throw new Error('OPENED_ID_MISMATCH');
  if (nameIncludes && ss.getName().indexOf(nameIncludes) < 0) throw new Error('TARGET_NAME_NOT_EXPECTED');
  var sh = ss.getSheetByName(SC_CONFIG.ledgerSheet); if (!sh) throw new Error('LEDGER_SHEET_NOT_FOUND');
  return { ss: ss, sh: sh };
}
function scSheet_(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.getRange(1, 1, 1, headers.length).setValues([headers]); s.setFrozenRows(1); }
  var h = s.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (h.join('\u0001') !== headers.join('\u0001')) throw new Error('SHEET_HEADER_MISMATCH ' + name);
  return s;
}
function scLedger_(sh) {   // 台帳を見出し名で読む（列番号は決め打ちしない）
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(), h = v[0], I = function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + n); return i; };
  var ix = { ep: I('EP-ID'), show: I('番組'), guid: I('公式GUID'), uuid: I('公式JSON UUID'), url: I('公式個別URL'), summary: I(SC_COLS_.summary), cast: I(SC_COLS_.cast), related: I(SC_COLS_.related) };
  var rows = v.slice(1).map(function (r, i) {
    var g = p25v2Guids_({ guid: r[ix.guid], jsonUuid: r[ix.uuid], officialUrl: r[ix.url] });
    return { row: i + 2, ep: r[ix.ep], show: r[ix.show], guid: String(r[ix.guid] || '').toLowerCase(), guids: g, summary: r[ix.summary], cast: r[ix.cast], related: r[ix.related] };
  }).filter(function (r) { return r.ep; });
  return { values: v, ix: ix, rows: rows };
}
function scRawMap_() {
  var f = p25v2FetchFeeds_(SC_CONFIG.feeds), m = {};
  f.items.forEach(function (it) { if (it.guid && it.descriptionRaw) m[String(it.guid).toLowerCase()] = it.descriptionRaw; });
  return { map: m, errors: f.errors, stats: f.stats, items: f.items.length };
}

// S0: 進捗の表示（書込なし）
function S0_進捗() {
  var o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = o.ss.getSheetByName(SC_PROGRESS_);
  return scLog_('S0_進捗', p ? p.getRange(1, 1, p.getLastRow(), 2).getDisplayValues() : '未実行');
}
// S1: 点検（書込なし）。対象・列・トリガー0・RSS取得・原文と台帳の突き合わせ件数
function S1_点検() {
  var t0 = Date.now(), o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), L = scLedger_(o.sh), raw = scRawMap_();
  var withRaw = L.rows.filter(function (r) { return r.guids.some(function (g) { return raw.map[g]; }); }).length;
  return scLog_('S1_点検', { status: raw.errors.length ? 'CHECK_WITH_FEED_ERRORS' : 'CHECK_OK', target: o.ss.getName(), ledgerRows: L.rows.length, rssItems: raw.items, ledgerWithRaw: withRaw, ledgerWithoutRaw: L.rows.length - withRaw, existingSummary: L.rows.filter(function (r) { return r.summary; }).length, feedErrors: raw.errors, ms: Date.now() - t0, version: scVersion_() });
}
// S2: 清掃・監査（全件）。原文と既存値を比べ、結果シートに保存。時間切れなら続きから（もう一度押す）。同じ原文・同じ既存値・同じ版の行は処理しない＝再実行で差分0
function S2_清掃監査() {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('S2_清掃監査', { status: 'LOCKED' });
  try {
    var o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(o.ss, SC_RESULT_, SC_HEADERS_), L = scLedger_(o.sh), raw = scRawMap_();
    if (raw.errors.length) return scLog_('S2_清掃監査', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });   // 一部の番組だけで判定を進めない
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], at = {}, H = {};
    SC_HEADERS_.forEach(function (n, i) { H[n] = i; }); cur.forEach(function (r, i) { at[r[0]] = i; });
    var props = PropertiesService.getScriptProperties(), start = Number(props.getProperty('SC_CURSOR') || 0), ver = scVersion_(), now = new Date().toISOString();
    var updated = 0, skipped = 0, i = start, done = false;
    for (; i < L.rows.length; i++) {
      if (i % 50 === 0 && Date.now() - t0 > SC_CONFIG.timeBudgetMs) break;
      var r = L.rows[i], g = r.guids.filter(function (x) { return raw.map[x]; })[0], text = g ? raw.map[g] : '';
      var exSha = p25v2GasSha256_([r.summary, r.cast, r.related].join('\u0001')), rawSha = text ? p25v2GasSha256_(text) : '';
      var k = at[r.ep], old = k != null ? cur[k] : null;
      if (old && old[H['原文SHA256']] === rawSha && old[H['清掃版']] === ver && old[H['旧値SHA']] === exSha) { skipped++; continue; }
      var row = scJudgeRow_(r, text, g, rawSha, exSha, ver, now, H);
      if (old) { row[H['人の確認']] = old[H['人の確認']]; row[H['確認メモ']] = old[H['確認メモ']]; row[H['反映先']] = old[H['反映先']]; row[H['反映日時']] = old[H['反映日時']]; cur[k] = row; }   // 人の記入は保持
      else { at[r.ep] = cur.length; cur.push(row); }
      updated++;
    }
    if (i >= L.rows.length) { done = true; i = 0; }
    if (updated) { var rg = res.getRange(2, 1, cur.length, SC_HEADERS_.length); rg.setNumberFormat('@'); rg.setValues(cur); }   // 文字列のまま保存（日付・数式に化けさせない）
    props.setProperty('SC_CURSOR', String(i));
    var summary = scProgress_(o.ss, cur, H, { done: done, cursor: i, total: L.rows.length, updated: updated, skipped: skipped, ms: Date.now() - t0, version: ver, at: now });
    return scLog_('S2_清掃監査', summary);
  } finally { lock.releaseLock(); }
}
function scJudgeRow_(r, text, g, rawSha, exSha, ver, now, H) {
  var row = SC_HEADERS_.map(function () { return ''; });
  row[H['EP-ID']] = r.ep; row[H['公式GUID']] = g || r.guid; row[H['番組']] = r.show; row[H['原文SHA256']] = rawSha; row[H['原文文字数']] = text ? String(text.length) : '0';
  row[H['原文取得']] = text ? '公式RSS' : 'なし'; row[H['旧・概要']] = r.summary; row[H['旧・出演者']] = r.cast; row[H['旧・関連記事URL']] = r.related; row[H['旧値SHA']] = exSha; row[H['清掃版']] = ver; row[H['処理日時']] = now;
  if (!text) { row[H['判定']] = 'HOLD'; row[H['理由']] = 'RAW_NOT_IN_RSS（公式RSSに原文なし。推測で補完しない）'; row[H['比較']] = r.summary ? '旧値のみ' : '旧空欄'; return row; }
  var j;
  try { j = CleanerV4.judgeEpisode(text, { summary: r.summary, cast: r.cast, related: r.related }); }
  catch (e) { row[H['判定']] = '要確認'; row[H['理由']] = 'CLEANER_ERROR ' + String(e.message || e).slice(0, 200); return row; }
  var c = j.clean;
  row[H['判定']] = j.verdict; row[H['比較']] = j.compare; row[H['理由']] = j.reason.slice(0, 500);
  row[H['書換可']] = ['summary', 'cast', 'related'].filter(function (k) { return j.writable && j.writable[k]; }).join('+');
  row[H['新・概要']] = c.text; row[H['新・出演者']] = CleanerV4.castCell(c.cast); row[H['新・関連記事URL']] = CleanerV4.relatedCell(c.related);
  row[H['関連記事JSON(見出し+URL)']] = JSON.stringify(c.related); row[H['出演者JSON']] = JSON.stringify(c.cast); row[H['SNS等保全URL']] = c.socials.join(' ');
  var rm = {}; c.removed.forEach(function (x) { rm[x.reason] = (rm[x.reason] || 0) + 1; }); row[H['除去内訳']] = JSON.stringify(rm);
  return row;
}
function scProgress_(ss, cur, H, s) {
  var cnt = {}, cmp = {}, writable = 0; cur.forEach(function (r) { cnt[r[H['判定']]] = (cnt[r[H['判定']]] || 0) + 1; cmp[r[H['比較']]] = (cmp[r[H['比較']]] || 0) + 1; if (r[H['書換可']]) writable++; });
  var human = cur.filter(function (r) { return String(r[H['人の確認']]).toUpperCase() === 'OK'; }).length;
  var p = ss.getSheetByName(SC_PROGRESS_) || ss.insertSheet(SC_PROGRESS_);
  var rows = [['項目', '値'], ['最終実行', s.at], ['状態', s.done ? '全件完了（もう一度押すと変更分だけ再処理）' : '途中（もう一度 S2 を押すと続きから）'], ['処理位置', s.cursor + ' / ' + s.total], ['今回 更新', s.updated], ['今回 変更なし', s.skipped], ['所要ミリ秒', s.ms], ['清掃版', s.version], ['結果行数', cur.length]];
  Object.keys(cnt).sort().forEach(function (k) { rows.push(['判定: ' + k, cnt[k]]); });
  Object.keys(cmp).sort().forEach(function (k) { rows.push(['比較: ' + k, cmp[k]]); });
  rows.push(['書換可能な行', writable], ['人の確認 OK', human]);
  p.clear(); p.getRange(1, 1, rows.length, 2).setValues(rows);
  return { done: s.done, cursor: s.cursor, total: s.total, updated: s.updated, skipped: s.skipped, ms: s.ms, verdicts: cnt, compare: cmp, writable: writable, humanOk: human };
}

// 反映（共通）: 結果シートの「新・…」を台帳に書く。条件: 書換可・判定が許可範囲・台帳の現在値が監査時の旧値と同じ（変わっていたら人の編集とみなし書かない）・EP-IDとGUIDが一致
function scApply_(targetId, nameIncludes, level, label, maxEpisodes) {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(c.ss, SC_RESULT_, SC_HEADERS_), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_);
    var t = targetId === SC_CONFIG.copyId ? c : scOpen_(targetId, nameIncludes), L = scLedger_(t.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
    var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [];
    var cols = { summary: L.ix.summary, cast: L.ix.cast, related: L.ix.related }, NEW = { summary: '新・概要', cast: '新・出演者', related: '新・関連記事URL' }, OLD = { summary: '旧・概要', cast: '旧・出演者', related: '旧・関連記事URL' };
    var recovered = [], epCount = 0, applyId = new Date().toISOString() + '/' + label, now = new Date().toISOString(), writes = [], skip = {}, sk = function (w) { skip[w] = (skip[w] || 0) + 1; };
    cur.forEach(function (r, ri) {
      if (writes.length >= SC_CONFIG.applyMaxPerRun || (maxEpisodes && epCount >= maxEpisodes)) return;
      var ok = String(r[H['人の確認']]).toUpperCase() === 'OK', v = r[H['判定']];
      if (!(ok || (level === 'AUTO_PASS' && v === '自動検査合格・目視未確認'))) { sk('NOT_APPROVED_LEVEL'); return; }
      if (!r[H['書換可']]) { sk('NOTHING_TO_WRITE'); return; }
      var x = byEp[r[H['EP-ID']]]; if (!x) { sk('EP_NOT_IN_TARGET'); return; }
      if (r[H['公式GUID']] && x.guids.indexOf(String(r[H['公式GUID']]).toLowerCase()) < 0) { sk('GUID_MISMATCH'); return; }
      var ks = String(r[H['書換可']]).split('+'), st = {};
      ks.forEach(function (k) { st[k] = String(x[k]) === String(r[H[OLD[k]]]) ? 'old' : (!r[H['反映先']] && String(x[k]) === String(r[H[NEW[k]]])) ? 'done' : 'changed'; });
      if (r[H['反映先']] === label && ks.every(function (k) { return String(x[k]) === String(r[H[NEW[k]]]); })) { sk('ALREADY_APPLIED'); return; }
      if (ks.some(function (k) { return st[k] === 'changed'; })) { sk('CHANGED_SINCE_AUDIT'); return; }   // 監査後に誰かが直した値は守る（S2を再実行すると最新値で判定し直す）
      ks.filter(function (k) { return st[k] === 'done'; }).forEach(function (k) { recovered.push([now, applyId, label, x.ep, SC_COLS_[k], String(r[H[OLD[k]]]), String(r[H[NEW[k]]]), 'OK(回収)']); });   // 前回が途中で止まり、書けていたのに記録が無い列は履歴だけ回収
      ks = ks.filter(function (k) { return st[k] === 'old'; });
      if (!ks.length) { cur[ri][H['反映先']] = label; cur[ri][H['反映日時']] = now; return; }
      if (ks.some(function (k) { return /^[=+]/.test(String(r[H[NEW[k]]])); })) { sk('FORMULA_LIKE_VALUE_HOLD'); return; }
      epCount++;
      ks.forEach(function (k) { writes.push({ ri: ri, ep: x.ep, row: x.row, col: cols[k] + 1, colName: SC_COLS_[k], oldV: String(x[k]), newV: r[H[NEW[k]]] }); });
    });
    var histRows = [], bad = 0, byCol = {};
    var pend = writes.map(function (w) { return [now, applyId, label, w.ep, w.colName, w.oldV, w.newV, '書込中']; }).concat(recovered), hStart = hist.getLastRow() + 1;
    if (pend.length) { var pr = hist.getRange(hStart, 1, pend.length, SC_HIST_HEADERS_.length); pr.setNumberFormat('@'); pr.setValues(pend); SpreadsheetApp.flush(); PropertiesService.getScriptProperties().setProperty('SC_LAST_APPLY', applyId); }   // 先に履歴（旧値）を残してから書く＝途中で止まっても取消できる
    writes.forEach(function (w) { (byCol[w.col] = byCol[w.col] || []).push(w); });
    Object.keys(byCol).forEach(function (col) {   // 連続する行をまとめて書く（1セルずつ書くと遅く、時間切れで履歴が残らない恐れ）
      var ws = byCol[col].sort(function (a, b) { return a.row - b.row; }), i = 0;
      while (i < ws.length) { var j = i; while (j + 1 < ws.length && ws[j + 1].row === ws[j].row + 1) j++;
        t.sh.getRange(ws[i].row, Number(col), j - i + 1, 1).setValues(ws.slice(i, j + 1).map(function (w) { return [w.newV]; })); i = j + 1; }
    });
    SpreadsheetApp.flush();
    var lastRow = t.sh.getLastRow(), back = {};
    Object.keys(byCol).forEach(function (col) { back[col] = t.sh.getRange(1, Number(col), lastRow, 1).getDisplayValues(); });   // 読み戻しは列ごとに1回
    writes.forEach(function (w) { var b = back[w.col][w.row - 1][0], st = b === String(w.newV) ? 'OK' : 'READBACK_MISMATCH'; if (st !== 'OK') bad++; histRows.push([now, applyId, label, w.ep, w.colName, w.oldV, w.newV, st]); cur[w.ri][H['反映先']] = label; cur[w.ri][H['反映日時']] = now; });
    if (histRows.length) hist.getRange(hStart, 8, histRows.length, 1).setValues(histRows.map(function (h) { return [h[7]]; }));   // 書込中 → OK / READBACK_MISMATCH
    var detailWritten = 0;
    if (targetId !== SC_CONFIG.copyId) {   // V2作業用: 反映した行の構造化データを別タブに保存（EP-IDで上書き更新）
      var eps = {}; writes.forEach(function (w) { eps[w.ep] = 1; }); recovered.forEach(function (h) { eps[h[3]] = 1; });
      var ds = scSheet_(t.ss, SC_V2DETAIL_, SC_V2DETAIL_HEADERS_), dv = ds.getLastRow() > 1 ? ds.getRange(2, 1, ds.getLastRow() - 1, SC_V2DETAIL_HEADERS_.length).getDisplayValues() : [], at = {};
      dv.forEach(function (r, i) { at[r[0]] = i; });
      cur.forEach(function (r) { if (!eps[r[H['EP-ID']]]) return;
        var row = [r[H['EP-ID']], r[H['公式GUID']], r[H['関連記事JSON(見出し+URL)']], r[H['出演者JSON']], r[H['SNS等保全URL']], r[H['原文SHA256']], r[H['清掃版']], r[H['判定']], now, applyId];
        if (at[row[0]] != null) dv[at[row[0]]] = row; else { at[row[0]] = dv.length; dv.push(row); } detailWritten++; });
      if (dv.length) { var dr = ds.getRange(2, 1, dv.length, SC_V2DETAIL_HEADERS_.length); dr.setNumberFormat('@'); dr.setValues(dv); }
    }
    if (pend.length) res.getRange(2, 1, cur.length, SC_HEADERS_.length).setValues(cur);
    PropertiesService.getScriptProperties().setProperty('SC_LAST_APPLY', applyId);
    return { status: bad ? 'READBACK_MISMATCH' : writes.length ? 'OK' : 'OK_NO_CHANGE', target: label, level: level, cellsWritten: writes.length, recoveredHistory: recovered.length, detailRows: detailWritten, episodes: Object.keys(writes.reduce(function (a, w) { a[w.ep] = 1; return a; }, {})).length, skipped: skip, applyId: applyId, ms: Date.now() - t0 };
  } finally { lock.releaseLock(); }
}
// S3: COPYの台帳へ反映（自動検査合格＋人の確認OK）。まず10件だけ（S3A）→ 結果シート・反映履歴で確認 → 全件（S3B）
function S3A_COPYへ反映_試験10件() { return scLog_('S3A_COPYへ反映_試験10件', scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 10)); }
function S3B_COPYへ反映_全件() { return scLog_('S3B_COPYへ反映_全件', scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 0)); }
// S4: V2作業用台帳へ反映（既定は「人の確認=OK」の行だけ。SC_CONFIG.v2ApplyLevel を 'AUTO_PASS' にすると自動検査合格も含める）
function S4_V2作業用へ反映() { return scLog_('S4_V2作業用へ反映', scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用')); }
// S9: 直前の反映を取り消す（反映履歴の旧値に戻す。反映後に人が直したセルは戻さない）
function S9_直前の反映を取消() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_), id = PropertiesService.getScriptProperties().getProperty('SC_LAST_APPLY');
  if (!id || hist.getLastRow() < 2) return scLog_('S9_直前の反映を取消', { status: 'NOTHING_TO_UNDO' });
  var rows = hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().filter(function (r) { return r[1] === id && /^OK|^書込中$/.test(r[7]); });
  if (!rows.length) return scLog_('S9_直前の反映を取消', { status: 'NOTHING_TO_UNDO' });
  var t = rows[0][2] === 'COPY' ? c : scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(t.sh), byEp = {}, h = L.values[0], undone = 0, kept = 0, out = [];
  L.rows.forEach(function (r) { byEp[r.ep] = r; });
  rows.forEach(function (r) { var x = byEp[r[3]]; if (!x) return; var col = h.indexOf(r[4]) + 1, cell = t.sh.getRange(x.row, col);
    if (cell.getDisplayValue() === r[6]) { cell.setValue(r[5]); undone++; out.push([new Date().toISOString(), id + '/UNDO', r[2], r[3], r[4], r[6], r[5], 'UNDO']); } else kept++; });
  if (out.length) hist.getRange(hist.getLastRow() + 1, 1, out.length, SC_HIST_HEADERS_.length).setValues(out);
  PropertiesService.getScriptProperties().deleteProperty('SC_LAST_APPLY');
  return scLog_('S9_直前の反映を取消', { status: 'OK', undone: undone, keptBecauseEditedAfter: kept });
}

// S8: 診断（書込なし）。判定理由ごとに数件、原因の行を短く表示する（不具合の調査用）
function S8_診断() {
  var o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = o.ss.getSheetByName(SC_RESULT_), L = scLedger_(o.sh), raw = scRawMap_(), byEp = {};
  L.rows.forEach(function (r) { byEp[r.ep] = r; });
  var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; }); var cur = res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues();
  var want = (PropertiesService.getScriptProperties().getProperty('SC_DIAG') || 'OVER_DELETION,STAFF_IN_BODY').split(','), out = {};
  want.forEach(function (w) { out[w] = []; });
  cur.forEach(function (r) {
    var x = byEp[r[0]]; if (!x) return; var g = x.guids.filter(function (k) { return raw.map[k]; })[0]; if (!g) return; var text = raw.map[g];
    want.forEach(function (w) {
      if (out[w].length >= 3 || String(r[H['理由']]).indexOf(w) < 0) return;
      var d = { ep: r[0], show: r[2] };
      if (w === 'MANUAL_EDIT_PROTECTED') d.why = ['summary', 'cast', 'related'].map(function (k) { return [k, CleanerV4.explainDerived(x[k], text)]; }).filter(function (p) { return p[1]; });
      else { var c = CleanerV4.cleanV4(text), lines = QualityAudit.classifyRawLines(text), a = QualityAudit.auditPair(text, { description: c.text, cast: c.cast.map(function (q) { return [q.role, q.name, q.note].join(' '); }), related: c.related });
        d.findings = a.findings.filter(function (f) { return f.type === w; }).slice(0, 1).map(function (f) { var l = lines.filter(function (q) { return q.i === f.line; })[0], pv = lines.filter(function (q) { return q.i === f.line - 1; })[0]; return { line: f.line, expect: l && l.expect, text: l ? l.text.slice(0, 50) : '', prev: pv ? pv.text.slice(0, 40) : '' }; });
        d.secs = CleanerV4.sections(text).map(function (q) { return q.kind + ':' + String(q.head).slice(0, 14) + '(' + q.lines.length + ')'; }).join(' | ').slice(0, 160); d.out = c.text.slice(0, 60);
        if (w === 'CAST_CONTAMINATED') d.cast = c.cast.slice(0, 4).map(function (q) { return q.raw.slice(0, 60); });
        if (/RELATED/.test(w)) d.related = c.related.slice(0, 3).map(function (q) { return [q.title.slice(0, 30), q.url.slice(0, 60)]; }), d.removed = c.removed.slice(0, 6).map(function (q) { return q.reason; }); }
      out[w].push(d);
    });
  });
  return scLog_('S8_診断', out);
}

// S7: 抜き取り確認（書込なし）。自動検査合格から番組ごとに均等に n 件、原文の行分類と清掃結果（本文・出演者・関連記事の見出し＋URL）を短く並べる
function S7_抜き取り() {
  var n = 20, o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = o.ss.getSheetByName(SC_RESULT_), L = scLedger_(o.sh), raw = scRawMap_(), byEp = {}, H = {};
  L.rows.forEach(function (r) { byEp[r.ep] = r; }); SC_HEADERS_.forEach(function (k, i) { H[k] = i; });
  var cur = res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues().filter(function (r) { return r[H['判定']] === '自動検査合格・目視未確認'; });
  var byShow = {}; cur.forEach(function (r) { (byShow[r[H['番組']]] = byShow[r[H['番組']]] || []).push(r); });
  var pick = [], shows = Object.keys(byShow).sort(), k = 0; while (pick.length < n && k < 200) { shows.forEach(function (sh) { var a = byShow[sh], r = a[Math.floor((k * 7919) % a.length)]; if (pick.length < n && r && pick.indexOf(r) < 0) pick.push(r); }); k++; }
  var out = pick.map(function (r) { var x = byEp[r[0]], g = x.guids.filter(function (q) { return raw.map[q]; })[0], text = raw.map[g] || '';
    var lines = QualityAudit.classifyRawLines(text).filter(function (l) { return l.expect !== 'DROP'; }).map(function (l) { return l.expect[0] + ':' + l.text.slice(0, 28); });
    var rel = JSON.parse(r[H['関連記事JSON(見出し+URL)']] || '[]').map(function (q) { return (q.kind || 'a')[0] + ':' + String(q.title).slice(0, 18) + '|' + String(q.url).replace(/^https?:\/\/(www\.)?/, '').slice(0, 34); });
    var cast = JSON.parse(r[H['出演者JSON']] || '[]').map(function (q) { return [q.role, q.name, q.links && q.links.length ? 'L' + q.links.length : ''].filter(Boolean).join(' '); });
    return { ep: r[0], show: r[2], raw: lines.slice(0, 12), sum: r[H['新・概要']].slice(0, 50) + '…(' + r[H['新・概要']].length + ')', cast: cast, rel: rel }; });
  return scLog_('S7_抜き取り', out);
}
