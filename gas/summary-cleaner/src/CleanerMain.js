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
  applyMaxPerRun: 1200, // 600セル約65秒の実測に基づき1200セル程度ずつ。履歴と現在値で重複書込を防ぐ
  feeds: P25V2_COPY_FEEDS_()
};
var SC_REFUSE_IDS_ = ['1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'];   // V1原本・本番59列・旧GAS参照
var SC_RESULT_ = '清掃・結果', SC_PROGRESS_ = '清掃・進捗', SC_HISTORY_ = '清掃・反映履歴';
var SC_HEADERS_ = ['EP-ID', '公式GUID', '番組', '原文SHA256', '原文文字数', '原文取得', '判定', '比較', '理由', '書換可', '新・概要', '新・出演者', '新・関連記事URL', '関連記事JSON(見出し+URL)', '出演者JSON', 'SNS等保全URL', '除去内訳', '旧・概要', '旧・出演者', '旧・関連記事URL', '旧値SHA', '清掃版', '処理日時', '人の確認', '確認メモ', '反映先', '反映日時'];
var SC_HIST_HEADERS_ = ['反映日時', '反映ID', '対象', 'EP-ID', '列', '旧値', '新値', '状態'];
// V2作業用台帳（34列）は列を増やさず、同じファイルの別タブに構造化データ（見出し＋URLの組・出演者の内訳）を保持する
// 台帳3列を書いたかどうかに依存せず、V2作業用台帳の全EPを1行ずつ保存する（S5）。S4 は書いた回だけ更新する
var SC_V2DETAIL_ = 'V2・清掃詳細', SC_V2DETAIL_HEADERS_ = ['EP-ID', '公式GUID', '関連記事JSON(見出し+URL)', '出演者JSON', 'SNS等保全URL', '原文SHA256', '清掃版', '判定', '理由', '原文状態', '更新日時'];
// 収蔵詳細（P25V2と同じ17列）に保全済みの原文と、公式RSSの現在の原文が違うときの記録（原文は上書きしない）
var SC_RAWHIST_ = 'V2・原文変化履歴', SC_RAWHIST_HEADERS_ = ['検出日時', 'EP-ID', '公式GUID', '保全済SHA256', 'RSS現在SHA256', 'RSS現在文字数', 'RSS現在原文'];
var SC_CELL_MAX_ = 49000;   // シートの1セル上限（5万字）未満
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
  var item = {};
  f.items.forEach(function (it) { if (it.guid && it.descriptionRaw) { m[String(it.guid).toLowerCase()] = it.descriptionRaw; item[String(it.guid).toLowerCase()] = it; } });
  return { map: m, item: item, errors: f.errors, stats: f.stats, items: f.items.length };
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
    var pre = scPreservedRaw_();
    var props = PropertiesService.getScriptProperties(), start = Number(props.getProperty('SC_CURSOR') || 0), ver = scVersion_(), now = new Date().toISOString();
    var updated = 0, skipped = 0, i = start, done = false;
    for (; i < L.rows.length; i++) {
      if (i % 50 === 0 && Date.now() - t0 > SC_CONFIG.timeBudgetMs) break;
      var r = L.rows[i], g = r.guids.filter(function (x) { return raw.map[x]; })[0], text = g ? raw.map[g] : '';
      if (!text && pre[r.ep] && r.guids.indexOf(pre[r.ep].guid) >= 0) { g = pre[r.ep].guid; text = pre[r.ep].text; }   // 今のRSSに無い回は、V2・収蔵詳細に保全済みの公式RSS原文（SHA256照合済み）を使う
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
function scApply_(targetId, nameIncludes, level, label, maxEpisodes, resName, onlyEps) {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(c.ss, resName || SC_RESULT_, SC_HEADERS_), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_);
    var t = targetId === SC_CONFIG.copyId ? c : scOpen_(targetId, nameIncludes), L = scLedger_(t.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
    var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [];
    var cols = { summary: L.ix.summary, cast: L.ix.cast, related: L.ix.related }, NEW = { summary: '新・概要', cast: '新・出演者', related: '新・関連記事URL' }, OLD = { summary: '旧・概要', cast: '旧・出演者', related: '旧・関連記事URL' };
    var last = {}; if (hist.getLastRow() > 1) hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().forEach(function (h) { if (/^OK/.test(h[7])) last[h[2] + '\u0001' + h[3] + '\u0001' + h[4]] = h[6]; else if (h[7] === 'UNDO') delete last[h[2] + '\u0001' + h[3] + '\u0001' + h[4]]; });   // このロボが最後に書いた値（人の編集と区別する）
    var recovered = [], epCount = 0, applyId = new Date().toISOString() + '/' + label, now = new Date().toISOString(), writes = [], skip = {}, sk = function (w) { skip[w] = (skip[w] || 0) + 1; };
    cur.forEach(function (r, ri) {
      if (writes.length >= SC_CONFIG.applyMaxPerRun || (maxEpisodes && epCount >= maxEpisodes)) return;
      var ok = String(r[H['人の確認']]).toUpperCase() === 'OK', v = r[H['判定']];
      if (!(ok || (level === 'AUTO_PASS' && v === '自動検査合格・目視未確認'))) { sk('NOT_APPROVED_LEVEL'); return; }
      if (!r[H['書換可']]) { sk('NOTHING_TO_WRITE'); return; }
      if (onlyEps && !onlyEps[r[H['EP-ID']]]) { sk('OUT_OF_SCOPE'); return; }
      var x = byEp[r[H['EP-ID']]]; if (!x) { sk('EP_NOT_IN_TARGET'); return; }
      if (r[H['公式GUID']] && x.guids.indexOf(String(r[H['公式GUID']]).toLowerCase()) < 0) { sk('GUID_MISMATCH'); return; }
      var ks = String(r[H['書換可']]).split('+'), st = {};
      ks.forEach(function (k) { st[k] = String(x[k]) === String(r[H[NEW[k]]]) ? 'done' : (String(x[k]) === String(r[H[OLD[k]]]) || last[label + '\u0001' + x.ep + '\u0001' + SC_COLS_[k]] === String(x[k])) ? 'old' : 'changed'; });   // 列単位: 最新値は書かず、監査旧値またはロボ最終反映値との一致だけ更新を許す
      if (r[H['反映先']] === label && ks.every(function (k) { return String(x[k]) === String(r[H[NEW[k]]]); })) { sk('ALREADY_APPLIED'); return; }
      var hasChanged = ks.some(function (k) { return st[k] === 'changed'; }); if (hasChanged) sk('CHANGED_SINCE_AUDIT');   // 手動変更の可能性がある列は後段の old フィルタで保護し、他の安全な列は進める
      ks.filter(function (k) { return st[k] === 'done' && !r[H['反映先']]; }).forEach(function (k) { recovered.push([now, applyId, label, x.ep, SC_COLS_[k], String(r[H[OLD[k]]]), String(r[H[NEW[k]]]), 'OK(回収)']); });   // 反映記録のない一致列だけ履歴を回収（既存記録の重複は作らない）
      ks = ks.filter(function (k) { return st[k] === 'old'; });
      if (!ks.length) { if (!hasChanged) { cur[ri][H['反映先']] = label; cur[ri][H['反映日時']] = now; } return; }
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
      if (Object.keys(eps).length) detailWritten = scV2DetailUpsert_(t.ss, L, cur, H, eps, now).changed;
    }
    if (pend.length) res.getRange(2, 1, cur.length, SC_HEADERS_.length).setValues(cur);
    if (pend.length) PropertiesService.getScriptProperties().setProperty('SC_LAST_APPLY', applyId);   // 書込が無い回で取消対象を上書きしない
    return { status: bad ? 'READBACK_MISMATCH' : writes.length ? 'OK' : 'OK_NO_CHANGE', target: label, level: level, cellsWritten: writes.length, recoveredHistory: recovered.length, detailRows: detailWritten, episodes: Object.keys(writes.reduce(function (a, w) { a[w.ep] = 1; return a; }, {})).length, skipped: skip, applyId: applyId, ms: Date.now() - t0 };
  } finally { lock.releaseLock(); }
}
// S3: COPYの台帳へ反映（自動検査合格＋人の確認OK）。まず10件だけ（S3A）→ 結果シート・反映履歴で確認 → 全件（S3B）
function S3A_COPYへ反映_試験10件() { return scLog_('S3A_COPYへ反映_試験10件', scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 10)); }
function S3B_COPYへ反映_全件() { return scLog_('S3B_COPYへ反映_全件', scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 0)); }
// S4: V2作業用台帳へ反映（既定は「人の確認=OK」の行だけ。SC_CONFIG.v2ApplyLevel を 'AUTO_PASS' にすると自動検査合格も含める）
function S4_V2作業用へ反映() { return scLog_('S4_V2作業用へ反映', scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, null, scV2NotPassedScope_())); }
// V2へ書いてよい範囲: V2・清掃詳細で「自動検査合格」になっていない回（または行がない回）だけ。
// 既に合格して反映済みのロボ出力は、清掃版が変わっても書き直さない（2026-11-12: 版の古い規則で新しい出力を上書きした事故の再発防止）
function scV2NotPassedScope_() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(SC_V2DETAIL_), L = scLedger_(v.sh), pass = {}, scope = {};
  if (ds && ds.getLastRow() > 1) { var dv = ds.getRange(1, 1, ds.getLastRow(), SC_V2DETAIL_HEADERS_.length).getDisplayValues(), e = dv[0].indexOf('EP-ID'), j = dv[0].indexOf('判定');
    dv.slice(1).forEach(function (x) { if (x[j] === '自動検査合格・目視未確認') pass[x[e]] = 1; }); }
  L.rows.forEach(function (r) { if (!pass[r.ep]) scope[r.ep] = 1; });
  return scope;
}
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

// ---- S5: V2作業用の別タブへ保全（台帳34列は触らない） ----
function scChunkWrite_(sh, startRow, rows, width) {   // 大量行を500行ずつ書く（文字列として。=で始まる値も式にしない）
  for (var i = 0; i < rows.length; i += 500) { var part = rows.slice(i, i + 500), r = sh.getRange(startRow + i, 1, part.length, width); r.setNumberFormat('@'); r.setValues(part); }
}
// 清掃詳細: 清掃・結果（COPY）の行を V2作業用台帳のEPごとに保存。結果が無い・GUIDが合わない回も HOLD として残す。内容が同じ行は書かない＝再実行差分0
function scV2DetailUpsert_(ss, L, resRows, H, onlyEps, now) {
  var n = SC_V2DETAIL_HEADERS_.length, ds = scSheet_(ss, SC_V2DETAIL_, SC_V2DETAIL_HEADERS_), dv = ds.getLastRow() > 1 ? ds.getRange(2, 1, ds.getLastRow() - 1, n).getDisplayValues() : [], at = {}, byEp = {}, c = { rows: 0, changed: 0, rawMissing: 0, hold: 0, readbackMismatch: 0 };
  dv.forEach(function (r, i) { at[r[0]] = i; }); resRows.forEach(function (r) { byEp[r[H['EP-ID']]] = r; });
  L.rows.forEach(function (x) {
    if (onlyEps && !onlyEps[x.ep]) return;
    var r = byEp[x.ep], row;
    if (!r) row = [x.ep, x.guid, '', '', '', '', '', 'HOLD', 'NO_AUDIT_RESULT（清掃・結果に行なし）', '未判定'];
    else if (r[H['公式GUID']] && x.guids.indexOf(String(r[H['公式GUID']]).toLowerCase()) < 0) row = [x.ep, x.guid, '', '', '', '', r[H['清掃版']], 'HOLD', 'GUID_MISMATCH（台帳と清掃結果のGUIDが違う）', '未判定'];
    else row = [x.ep, r[H['公式GUID']] || x.guid, r[H['関連記事JSON(見出し+URL)']], r[H['出演者JSON']], r[H['SNS等保全URL']], r[H['原文SHA256']], r[H['清掃版']], r[H['判定']], r[H['理由']], r[H['原文取得']] === '公式RSS' ? '取得' : '欠損'];
    row = row.map(function (q) { return String(q == null ? '' : q); }); c.rows++;
    if (row[9] !== '取得') c.rawMissing++; if (row[7] === 'HOLD') c.hold++;
    var i = at[x.ep]; if (i != null && dv[i].slice(0, n - 1).join('\u0001') === row.join('\u0001')) return;
    row.push(now); c.changed++; if (i != null) dv[i] = row; else { at[x.ep] = dv.length; dv.push(row); }
  });
  if (c.changed) { scChunkWrite_(ds, 2, dv, n); SpreadsheetApp.flush();
    var back = ds.getRange(2, 1, dv.length, n).getDisplayValues(); back.forEach(function (b, i) { if (b.join('\u0001') !== dv[i].join('\u0001')) c.readbackMismatch++; }); }
  return c;
}
// 収蔵詳細: 公式RSSの原文を EP-ID＋GUID で保存。既にある原文は上書きしない（RSS側が変わったら原文変化履歴へ）。空欄の原文は、記録済みSHAと一致する場合だけ埋める。RSSに無い回は「原文なし（欠損）」
function scV2RawPreserve_(ss, L, raw, maxNew, now, t0) {
  var n = P25V2_DETAIL_HEADERS_.length, d = ss.getSheetByName(P25V2_DETAIL_SHEET_);
  if (!d) { d = ss.insertSheet(P25V2_DETAIL_SHEET_); d.getRange(1, 1, 1, n).setValues([P25V2_DETAIL_HEADERS_]); d.setFrozenRows(1); }
  var v = d.getRange(1, 1, Math.max(d.getLastRow(), 1), n).getDisplayValues(); p25v2SheetHeaderCheck_(v, P25V2_DETAIL_HEADERS_, P25V2_DETAIL_SHEET_);
  var at = {}; v.forEach(function (r, i) { if (i && r[0]) at[r[0]] = i; });
  var hs = scSheet_(ss, SC_RAWHIST_, SC_RAWHIST_HEADERS_), seen = {}; (hs.getLastRow() > 1 ? hs.getRange(2, 1, hs.getLastRow() - 1, 5).getDisplayValues() : []).forEach(function (r) { seen[r[1] + '|' + r[4]] = 1; });
  var add = [], fill = [], hist = [], eps = {}, c = { added: 0, addedMissing: 0, filled: 0, kept: 0, stillMissing: 0, rssChangedLogged: 0, tooLong: 0, readbackMismatch: 0, partial: false };
  L.rows.forEach(function (x) {
    if (c.partial) return;
    if (Date.now() - t0 > SC_CONFIG.timeBudgetMs - 60000) { c.partial = true; return; }
    var g = x.guids.filter(function (q) { return raw.map[q]; })[0], text = g ? String(raw.map[g]) : '', sha = text ? p25v2GasSha256_(text) : '', i = at[x.ep];
    if (text.length > SC_CELL_MAX_) { c.tooLong++; }
    if (i == null) {
      if (maxNew && add.length >= maxNew) return;
      var row = text && text.length <= SC_CELL_MAX_ ? p25v2DetailRow_(x.ep, raw.item[g], now, p25v2GasSha256_)
        : [x.ep, g || x.guid, '', now, '', sha, String(text.length), text ? '原文過大（保存不可・ハッシュのみ）' : '原文なし（欠損）', '', '', '', '', '', '', '', '', text ? '公式RSS（長さ・ハッシュのみ）' : 'なし（公式RSSに無し）'];
      if (row[4]) row[16] = '公式RSS（清掃GAS S5）'; else c.addedMissing++;
      add.push(row.map(function (q) { return String(q == null ? '' : q); })); eps[x.ep] = 1; return;
    }
    var cur = v[i];
    if (cur[4]) { if (text && sha !== cur[5] && sha.indexOf(cur[5]) !== 0) { if (!seen[x.ep + '|' + sha]) { hist.push([now, x.ep, g, cur[5], sha, String(text.length), text.length <= SC_CELL_MAX_ ? text : '']); seen[x.ep + '|' + sha] = 1; } } else c.kept++; return; }
    if (!text || text.length > SC_CELL_MAX_) { c.stillMissing++; return; }
    if (cur[5] && sha.indexOf(cur[5]) !== 0) { if (!seen[x.ep + '|' + sha]) { hist.push([now, x.ep, g, cur[5], sha, String(text.length), text]); seen[x.ep + '|' + sha] = 1; } return; }   // 記録済みハッシュと違う原文では埋めない
    fill.push({ row: i + 1, text: text, sha: sha });
  });
  if (add.length) { var s0 = d.getLastRow() + 1; scChunkWrite_(d, s0, add, n); SpreadsheetApp.flush();
    d.getRange(s0, 1, add.length, n).getDisplayValues().forEach(function (b, k) { if (b[0] !== add[k][0] || b[4] !== add[k][4] || (b[4] && p25v2GasSha256_(b[4]) !== add[k][5])) c.readbackMismatch++; }); c.added = add.length; }
  fill.forEach(function (f) { var r = d.getRange(f.row, 5, 1, 3); r.setNumberFormat('@'); r.setValues([[f.text, f.sha, String(f.text.length)]]); d.getRange(f.row, 17).setValue('公式RSS（清掃GAS S5・後日補完）'); });
  if (fill.length) { SpreadsheetApp.flush(); fill.forEach(function (f) { if (p25v2GasSha256_(d.getRange(f.row, 5).getDisplayValue()) !== f.sha) c.readbackMismatch++; }); c.filled = fill.length; }
  if (hist.length) { scChunkWrite_(hs, hs.getLastRow() + 1, hist, SC_RAWHIST_HEADERS_.length); c.rssChangedLogged = hist.length; }
  c.totalRows = d.getLastRow() - 1; c.addedEps = eps;
  return c;
}
function scV2Preserve_(fn, maxNew) {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_(fn, { status: 'LOCKED' });
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(SC_RESULT_); if (!res) return scLog_(fn, { status: 'STOP_NO_AUDIT_RESULT（先に S2）' });
    var t = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(t.sh), raw = scRawMap_();
    if (raw.errors.length) return scLog_(fn, { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });   // 一部の番組だけで保全しない
    var H = {}; SC_HEADERS_.forEach(function (k, i) { H[k] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], now = new Date().toISOString();
    var a = scV2RawPreserve_(t.ss, L, raw, maxNew, now, t0), eps = a.addedEps; delete a.addedEps;
    var b = scV2DetailUpsert_(t.ss, L, cur, H, maxNew ? eps : null, now);
    var bad = a.readbackMismatch + b.readbackMismatch;
    return scLog_(fn, { status: bad ? 'READBACK_MISMATCH' : a.partial ? 'PARTIAL_TIME（もう一度押すと続きから）' : (a.added + a.filled + a.rssChangedLogged + b.changed) ? 'OK' : 'OK_NO_CHANGE', ledgerEps: L.rows.length, raw: a, detail: b, ms: Date.now() - t0 });
  } finally { lock.releaseLock(); }
}
// S5A: まず10件だけ（収蔵詳細に原文、清掃詳細に構造化データ）→ V2作業用の2タブで確認 → S5B で全件。何度押しても差分0
function S5A_V2詳細保全_試験10件() { return scV2Preserve_('S5A_V2詳細保全_試験10件', 10); }
function S5B_V2詳細保全_全件() { return scV2Preserve_('S5B_V2詳細保全_全件', 0); }

// ===== S6: V2作業用に新しく収蔵された回の清掃（P25V2 一括収蔵の後に押す）=====
// 対象: V2作業用台帳で「概要（清掃済）・出演者・関連記事URL」がすべて空の回（＝新着）と、既にS6の結果がある回。原文はRSSを取り直さず、
//   V2・収蔵詳細に保全済みの概要原文を使う（SHA256が記録値と一致する場合だけ）。原文・EP-ID・GUIDは書かない。
// S6A（書込なし・判定を保存）→ 結果を見る → S6B（自動検査合格／人の確認OKだけ台帳3列へ）。取消は S9。
var SC_V2NEW_RESULT_ = '清掃・結果(V2新着)';
function S6A_V2新着_清掃監査() {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('S6A_V2新着_清掃監査', { status: 'LOCKED' });
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(c.ss, SC_V2NEW_RESULT_, SC_HEADERS_), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh);
    var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], at = {}; cur.forEach(function (r, i) { at[r[0]] = i; });
    var ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_); if (!ds) throw new Error('SHEET_NOT_FOUND ' + P25V2_DETAIL_SHEET_);
    var dv = ds.getRange(1, 1, ds.getLastRow(), P25V2_DETAIL_HEADERS_.length).getDisplayValues(), dh = dv[0], D = function (n) { var i = dh.indexOf(n); if (i < 0) throw new Error('DETAIL_COLUMN_NOT_FOUND ' + n); return i; };
    var raw = {}; dv.slice(1).forEach(function (r) { raw[r[D('EP-ID')]] = { guid: String(r[D('公式GUID')]).toLowerCase(), text: r[D('概要原文')], sha: r[D('概要原文SHA256')] }; });
    var ver = scVersion_(), now = new Date().toISOString(), cnt = { target: 0, updated: 0, skipped: 0, rawMissing: 0, rawShaMismatch: 0, guidMismatch: 0 }, eps = {};
    L.rows.forEach(function (r) {
      if (!(at[r.ep] != null || (!r.summary && !r.cast && !r.related))) return;
      cnt.target++; eps[r.ep] = 1;
      var d = raw[r.ep], text = '', g = r.guid;
      if (!d || !d.text) cnt.rawMissing++;
      else if (r.guids.indexOf(d.guid) < 0) cnt.guidMismatch++;
      else if (p25v2GasSha256_(d.text) !== d.sha) cnt.rawShaMismatch++;
      else { text = d.text; g = d.guid; }
      var exSha = p25v2GasSha256_([r.summary, r.cast, r.related].join('\u0001')), rawSha = text ? p25v2GasSha256_(text) : '', k = at[r.ep], old = k != null ? cur[k] : null;
      if (old && old[H['原文SHA256']] === rawSha && old[H['清掃版']] === ver && old[H['旧値SHA']] === exSha) { cnt.skipped++; return; }
      var row = scJudgeRow_(r, text, g, rawSha, exSha, ver, now, H);
      if (!text) row[H['理由']] = 'RAW_NOT_PRESERVED（V2・収蔵詳細に検証済みの原文なし。推測で補完しない）';
      if (old) { ['人の確認', '確認メモ', '反映先', '反映日時'].forEach(function (n) { row[H[n]] = old[H[n]]; }); cur[k] = row; } else { at[r.ep] = cur.length; cur.push(row); }
      cnt.updated++;
    });
    if (cnt.updated) { var rg = res.getRange(2, 1, cur.length, SC_HEADERS_.length); rg.setNumberFormat('@'); rg.setValues(cur); }
    var det = Object.keys(eps).length ? scV2DetailUpsert_(v.ss, L, cur, H, eps, now) : { changed: 0 };   // 判定・出演者JSON・関連記事JSONを V2・清掃詳細へ（台帳3列は書かない）
    var vc = {}; cur.forEach(function (r) { if (eps[r[0]]) vc[r[H['判定']]] = (vc[r[H['判定']]] || 0) + 1; });
    return scLog_('S6A_V2新着_清掃監査', { status: 'OK', counts: cnt, verdicts: vc, writable: cur.filter(function (r) { return eps[r[0]] && r[H['書換可']]; }).length, v2DetailChanged: det.changed, v2DetailReadbackMismatch: det.readbackMismatch || 0, eps: Object.keys(eps).join(' ').slice(0, 600), version: ver, ms: Date.now() - t0 });
  } finally { lock.releaseLock(); }
}
function S6B_V2新着_反映() { return scLog_('S6B_V2新着_反映', scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用(新着)', 0, SC_V2NEW_RESULT_)); }

// ===== S10R: 非公式S10（2026-11-12 13:13Z、PR #306 外）による概要の強制書換を元に戻す =====
// 「V2・強制概要反映履歴」の状態 OK の行だけ対象。V2台帳の概要が履歴の新概要と完全一致する場合に限り旧概要へ戻す（人がその後に直した行は HOLD）。
// 書込前に COPY の清掃・反映履歴へ旧値・新値を記録 → 書込 → 読み戻し → 履歴行の状態を「取消済(S10R)」に更新。再実行は差分0。
function S10R_非公式S10の書換を取消() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('S10R_非公式S10の書換を取消', { status: 'LOCKED' });
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), v = scOpen_(SC_CONFIG.v2WorkingId, ''), hs = v.ss.getSheetByName('V2・強制概要反映履歴');
    if (!hs || hs.getLastRow() < 2) return scLog_('S10R_非公式S10の書換を取消', { status: 'NO_HISTORY' });
    var hv = hs.getRange(1, 1, hs.getLastRow(), hs.getLastColumn()).getValues(), hh = hv[0].map(String), X = function (n) { var i = hh.indexOf(n); if (i < 0) throw new Error('S10_HISTORY_COLUMN_NOT_FOUND ' + n); return i; };
    var iEp = X('EP-ID'), iOld = X('旧概要'), iNew = X('新概要'), iSt = X('状態'), L = scLedger_(v.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
    var col = L.ix.summary + 1, now = new Date().toISOString(), id = now + '/S10R', todo = [], cnt = { okRows: 0, restored: 0, alreadyUndone: 0, holdChanged: 0, holdNoRow: 0, readbackMismatch: 0, untouchedNotOk: 0 }, hold = [];
    hv.slice(1).forEach(function (r, k) {
      var st = String(r[iSt]); if (st === '取消済(S10R)') { cnt.alreadyUndone++; return; } if (st !== 'OK') { cnt.untouchedNotOk++; return; }
      cnt.okRows++; var x = byEp[String(r[iEp])]; if (!x) { cnt.holdNoRow++; hold.push(r[iEp] + ':台帳に行なし'); return; }
      var cur = x.summary, nw = String(r[iNew]), od = String(r[iOld]);
      if (cur === od) { todo.push({ k: k, x: x, od: od, nw: nw, skipWrite: true }); return; }   // 既に旧値（手で戻された等）→ 状態だけ更新
      if (cur !== nw) { cnt.holdChanged++; hold.push(r[iEp] + ':S10後に変更あり'); return; }
      todo.push({ k: k, x: x, od: od, nw: nw });
    });
    var hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_), w = todo.filter(function (t) { return !t.skipWrite; });
    if (w.length) { var pr = hist.getRange(hist.getLastRow() + 1, 1, w.length, SC_HIST_HEADERS_.length); pr.setNumberFormat('@'); pr.setValues(w.map(function (t) { return [now, id, 'V2作業用(S10取消)', t.x.ep, SC_COLS_.summary, t.nw, t.od, '書込中']; })); SpreadsheetApp.flush(); }
    w.forEach(function (t) { v.sh.getRange(t.x.row, col).setValue(t.od); });
    SpreadsheetApp.flush();
    w.forEach(function (t) { if (v.sh.getRange(t.x.row, col).getDisplayValue() === t.od) cnt.restored++; else cnt.readbackMismatch++; });
    if (w.length) hist.getRange(hist.getLastRow() - w.length + 1, 8, w.length, 1).setValues(w.map(function (t) { return [v.sh.getRange(t.x.row, col).getDisplayValue() === t.od ? 'OK' : 'READBACK_MISMATCH']; }));
    if (!cnt.readbackMismatch) todo.forEach(function (t) { hs.getRange(t.k + 2, iSt + 1).setValue('取消済(S10R)'); });
    return scLog_('S10R_非公式S10の書換を取消', { status: cnt.readbackMismatch ? 'READBACK_MISMATCH' : (w.length || todo.length) ? 'OK' : 'OK_NO_CHANGE', counts: cnt, restoredEps: w.map(function (t) { return t.x.ep; }), hold: hold, applyId: id });
  } finally { lock.releaseLock(); }
}

// V2・収蔵詳細に保全済みの概要原文（EP-ID → GUID・原文）。記録済みSHA256と一致するものだけ返す（読むだけ）
function scPreservedRaw_() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_), out = {};
  if (!ds || ds.getLastRow() < 2) return out;
  var dv = ds.getRange(1, 1, ds.getLastRow(), P25V2_DETAIL_HEADERS_.length).getDisplayValues(), h = dv[0], e = h.indexOf('EP-ID'), g = h.indexOf('公式GUID'), t = h.indexOf('概要原文'), s = h.indexOf('概要原文SHA256');
  if (e < 0 || g < 0 || t < 0 || s < 0) throw new Error('DETAIL_COLUMN_NOT_FOUND');
  dv.slice(1).forEach(function (r) { if (r[t] && p25v2GasSha256_(r[t]) === r[s]) out[r[e]] = { guid: String(r[g]).toLowerCase(), text: r[t] }; });
  return out;
}

// S4B: V2作業用へ反映（V2・清掃詳細で「未合格」だった回だけ）。既に合格・反映済みの回（ロボの前回出力）は書き直さない＝既存の成果を維持。
// 対象は最初の実行時に固定し（スクリプトプロパティ SC_S4B_SCOPE）、以後の実行でも同じ範囲だけを扱う（反映で清掃詳細が更新されても範囲は広がらない）。
function S4B_V2作業用へ反映_未合格分のみ() {
  var props = PropertiesService.getScriptProperties(), scope = JSON.parse(props.getProperty('SC_S4B_SCOPE') || 'null');
  if (!scope) {
    var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(SC_V2DETAIL_); if (!ds) throw new Error('SHEET_NOT_FOUND ' + SC_V2DETAIL_);
    var dv = ds.getRange(1, 1, ds.getLastRow(), SC_V2DETAIL_HEADERS_.length).getDisplayValues(), h = dv[0], e = h.indexOf('EP-ID'), j = h.indexOf('判定'), r = h.indexOf('原文状態');
    scope = {}; dv.slice(1).forEach(function (x) { if (x[e] && x[j] !== '自動検査合格・目視未確認' && x[r] === '取得') scope[x[e]] = 1; });
    props.setProperty('SC_S4B_SCOPE', JSON.stringify(scope));
  }
  var out = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, null, scope);
  out.scopeEpisodes = Object.keys(scope).length;
  return scLog_('S4B_V2作業用へ反映_未合格分のみ', out);
}

// S9C: 2026-11-12 13:29〜13:31Z の S3B（COPY）3回分を取消。旧規則SC4-9の出力で、新しい清掃出力を上書きしたため。現在値が新値と一致するセルだけ旧値へ（列ごとにまとめて書く）
var SC_UNDO_IDS_20261112_ = ['2026-11-12T13:29:00.209Z/COPY', '2026-11-12T13:30:15.934Z/COPY', '2026-11-12T13:31:17.946Z/COPY'];
function S9C_COPY反映の取消_20261112() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_);
  var hv = hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().filter(function (r) { return SC_UNDO_IDS_20261112_.indexOf(r[1]) >= 0 && /^OK/.test(r[7]); });
  var done = {}; hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().forEach(function (r) { if (/\/UNDO$/.test(r[1])) done[r[1].replace(/\/UNDO$/, '') + '\u0001' + r[3] + '\u0001' + r[4]] = 1; });
  var L = scLedger_(c.sh), byEp = {}, h = L.values[0], cols = {}, out = [], kept = 0, now = new Date().toISOString(); L.rows.forEach(function (r) { byEp[r.ep] = r; });
  hv.forEach(function (r) { if (done[r[1] + '\u0001' + r[3] + '\u0001' + r[4]]) return; var x = byEp[r[3]], ci = h.indexOf(r[4]); if (!x || ci < 0) { kept++; return; }
    var colv = cols[ci] = cols[ci] || L.values.map(function (row) { return [row[ci]]; });
    if (colv[x.row - 1][0] === r[6]) { colv[x.row - 1][0] = r[5]; out.push([now, r[1] + '/UNDO', r[2], r[3], r[4], r[6], r[5], 'UNDO']); } else kept++; });
  if (out.length) { var pr = hist.getRange(hist.getLastRow() + 1, 1, out.length, SC_HIST_HEADERS_.length); pr.setNumberFormat('@'); pr.setValues(out); SpreadsheetApp.flush(); }
  var chg = {}; out.forEach(function (o) { var ci = h.indexOf(o[4]); (chg[ci] = chg[ci] || []).push(byEp[o[3]].row); });
  Object.keys(chg).forEach(function (ci) { var rows = chg[ci].sort(function (a, b) { return a - b; }), i = 0;   // 変えた行だけ、連続する行をまとめて書く
    while (i < rows.length) { var j = i; while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
      c.sh.getRange(rows[i], Number(ci) + 1, j - i + 1, 1).setValues(rows.slice(i, j + 1).map(function (rw) { return [cols[ci][rw - 1][0]]; })); i = j + 1; } });
  SpreadsheetApp.flush();
  var bad = 0; Object.keys(chg).forEach(function (ci) { var b = c.sh.getRange(1, Number(ci) + 1, c.sh.getLastRow(), 1).getDisplayValues(); chg[ci].forEach(function (rw) { if (b[rw - 1][0] !== String(cols[ci][rw - 1][0])) bad++; }); });
  return scLog_('S9C_COPY反映の取消_20261112', { status: bad ? 'READBACK_MISMATCH' : out.length ? 'OK' : 'OK_NO_CHANGE', undoneCells: out.length, keptBecauseChanged: kept, readbackMismatch: bad });
}

// ===== 人物索引（Issue #309）: 1行 = 1人 × 1エピソード。役割で分けない。原文（保全済み公式RSS）にある名前だけ =====
// P1 予行（書込なし）→ P2 COPYに試験作成 → （承認）P0 → P3 V2作業用に作成。P9 でV2の索引シートを空に戻す。台帳の列（出演者O列・公開P列）は変えない。
var PI_SHEET_COPY_ = '人物索引(試験)', PI_SHEET_V2_ = 'V2・人物索引';
function piBuild_() {
  var pre = scPreservedRaw_(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), eps = L.rows.map(function (r) { return { ep: r.ep, raw: pre[r.ep] ? pre[r.ep].text : '', cast: r.cast }; });
  var ix = PersonIndex.buildPersonIndex(eps), byEp = {}; ix.rows.forEach(function (r) { (byEp[r.ep] = byEp[r.ep] || []).push(r.key); });
  var cmp = { same: 0, ledgerOnly_noSource: 0, rawOnly_ledgerEmpty: 0, ledgerHasPlatform: 0, differ: 0, bothEmpty: 0 }, ex = { ledgerOnly_noSource: [], rawOnly_ledgerEmpty: [], ledgerHasPlatform: [] };
  eps.forEach(function (e) {
    var led = String(e.cast || '').split('\n').map(function (l) { return CleanerV4.parseCastLine(l).name; }).filter(Boolean), ledKeys = led.filter(function (n) { return !PersonIndex.personHold(n); }).map(PersonIndex.personKey).sort(), raw = (byEp[e.ep] || []).slice().sort();
    var k = led.some(function (n) { return PersonIndex.personHold(n) === 'PLATFORM_NAME'; }) ? 'ledgerHasPlatform' : !led.length && !raw.length ? 'bothEmpty' : !raw.length ? 'ledgerOnly_noSource' : !led.length ? 'rawOnly_ledgerEmpty' : ledKeys.join('|') === raw.join('|') ? 'same' : 'differ';
    cmp[k]++; if (ex[k] && ex[k].length < 8) ex[k].push(e.ep);
  });
  return { ix: ix, cmp: cmp, ex: ex };
}
function P1_人物索引_予行() {
  var t0 = Date.now(), b = piBuild_(), holdWhy = {}; b.ix.hold.forEach(function (h) { holdWhy[h.why] = (holdWhy[h.why] || 0) + 1; });
  return scLog_('P1_人物索引_予行', { status: 'OK', version: PersonIndex.PERSON_INDEX_VERSION + '/' + scVersion_(), stat: b.ix.stat, holdReasons: holdWhy, ledgerCompare: b.cmp, examples: b.ex,
    variantExamples: b.ix.variants.slice(0, 10), ms: Date.now() - t0 });
}
function piWrite_(ss, name, rows, ver) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name), H = PersonIndex.PERSON_INDEX_HEADERS;
  sh.clearContents(); sh.getRange(1, 1, 1, H.length).setValues([H]);
  var vals = rows.map(function (r) { return [r.ep, r.key, r.display, r.note, r.links, r.source, r.state, ver]; });
  for (var i = 0; i < vals.length; i += 5000) { var part = vals.slice(i, i + 5000), rg = sh.getRange(2 + i, 1, part.length, H.length); rg.setNumberFormat('@'); rg.setValues(part); }
  SpreadsheetApp.flush();
  var back = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues() : [], bad = 0;
  back.forEach(function (r, i) { if (r[0] !== vals[i][0] || r[1] !== vals[i][1]) bad++; });
  return { written: vals.length, readBack: back.length, readbackMismatch: bad + Math.abs(back.length - vals.length) };
}
function P2_人物索引_COPY作成() {
  var b = piBuild_(), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), ver = PersonIndex.PERSON_INDEX_VERSION + '/' + CleanerV4.CLEANER_VERSION, w = piWrite_(c.ss, PI_SHEET_COPY_, b.ix.rows, ver);
  return scLog_('P2_人物索引_COPY作成', { status: w.readbackMismatch ? 'READBACK_MISMATCH' : 'OK', sheet: PI_SHEET_COPY_, stat: b.ix.stat, write: w });
}
function P0_承認_人物索引V2() { PropertiesService.getScriptProperties().setProperty('APPROVE_PERSON_INDEX_V2', 'yes'); return scLog_('P0_承認_人物索引V2', { status: 'APPROVED' }); }
function P3_人物索引_V2作成() {
  if (PropertiesService.getScriptProperties().getProperty('APPROVE_PERSON_INDEX_V2') !== 'yes') return scLog_('P3_人物索引_V2作成', { status: 'NOT_APPROVED', note: '先に P0_承認_人物索引V2' });
  var b = piBuild_(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), ver = PersonIndex.PERSON_INDEX_VERSION + '/' + CleanerV4.CLEANER_VERSION, w = piWrite_(v.ss, PI_SHEET_V2_, b.ix.rows, ver);
  return scLog_('P3_人物索引_V2作成', { status: w.readbackMismatch ? 'READBACK_MISMATCH' : 'OK', sheet: PI_SHEET_V2_, stat: b.ix.stat, write: w, note: '台帳の出演者列・公開台帳P列は変えていない' });
}
function P9_人物索引_V2を空に戻す() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), sh = v.ss.getSheetByName(PI_SHEET_V2_); if (!sh) return scLog_('P9_人物索引_V2を空に戻す', { status: 'NO_SHEET' });
  sh.clearContents(); return scLog_('P9_人物索引_V2を空に戻す', { status: 'OK', note: '索引シートの中身だけ消した（台帳は無変更）' });
}
