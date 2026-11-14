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
  p25v2AssertIsolated_({ hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: p25v2ForeignTriggers_() });
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
  var pre = scPreservedRaw_(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), eps = L.rows.map(function (r) { return { ep: r.ep, raw: pre[r.ep] ? pre[r.ep].text : '', cast: r.cast, ledgerCast: r.cast, parse: CleanerV4.parseCastLine }; });
  var ix = PersonIndex.buildPersonIndex(eps), byEp = {}; ix.rows.forEach(function (r) { if (r.state === '原文で確認') (byEp[r.ep] = byEp[r.ep] || []).push(r.key); });
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

// ===== 出演者列（O列）の限定修正（Issue #309・SC4-12）。概要・関連記事列は触らない =====
// 書くのは次の2種類だけ: ①出演者列に配信サービス名が混入し、かつ現在値が原文から機械的に取れる値（＝人が直していない）→ SC4-12 の出演者へ
//                        ②出演者列が空で、SC4-12 が原文から出演者を取り出せた → 埋める
// それ以外（原文に名前が無い回・台帳にだけ名前がある543話・人が直した値・SC4-12でも空）は書かない。書いた行は履歴に旧値・新値を残し、C9で戻せる。
var CF_HIST_ = '出演者修正履歴', CF_HIST_HEADERS_ = ['日時', '実行ID', 'EP-ID', '台帳行', '種類', '旧値', '新値', '状態'];
function cfPlan_() {
  var pre = scPreservedRaw_(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), plan = [], hold = {}, holdEx = [], kinds = {};
  var hasPlat = function (cell) { return String(cell || '').split('\n').some(function (l) { return CleanerV4.PLATFORM_NAME.test(String(CleanerV4.parseCastLine(l).name || '').trim()); }); };
  L.rows.forEach(function (r) {
    var raw = pre[r.ep] ? pre[r.ep].text : '', cur = String(r.cast || ''), plat = hasPlat(cur);
    if (!plat && cur.trim()) return;                                   // 既に値があり混入なし → 触らない
    if (!raw) { if (plat) { hold.RAW_NONE = (hold.RAW_NONE || 0) + 1; holdEx.push([r.ep, 'RAW_NONE']); } return; }
    var c = CleanerV4.cleanV4(raw), cast = c.cast.filter(function (x) { return !PersonIndex.personHold(x.name); }), nw = CleanerV4.castCell(cast);
    if (!nw) { if (plat) { hold.NO_CAST_AFTER_FIX = (hold.NO_CAST_AFTER_FIX || 0) + 1; holdEx.push([r.ep, 'NO_CAST_AFTER_FIX']); } return; }   // 空欄で原文にも名前なし → 何もしない
    var kind = plat ? 'PLATFORM_REMOVED' : 'FILLED_EMPTY';
    if (plat && !CleanerV4.derivedFromRaw(cur, raw)) { hold.MANUAL_EDIT_PROTECTED = (hold.MANUAL_EDIT_PROTECTED || 0) + 1; holdEx.push([r.ep, 'MANUAL_EDIT_PROTECTED']); return; }
    if (nw === cur) return;
    kinds[kind] = (kinds[kind] || 0) + 1; plan.push({ row: r.row, ep: r.ep, kind: kind, old: cur, nw: nw });
  });
  return { v: v, L: L, plan: plan, hold: hold, holdEx: holdEx.slice(0, 40), kinds: kinds };
}
function C1_出演者_予行() {
  var p = cfPlan_();
  return scLog_('C1_出演者_予行', { status: 'OK', version: scVersion_(), toWrite: p.plan.length, kinds: p.kinds, hold: p.hold, holdExamples: p.holdEx,
    plan: p.plan.slice(0, 60).map(function (x) { return [x.ep, x.kind, x.old.replace(/https?:\/\/\S+/g, '<URL>').replace(/\n/g, ' / ').slice(0, 80), '→', x.nw.replace(/https?:\/\/\S+/g, '<URL>').replace(/\n/g, ' / ').slice(0, 80)]; }) });
}
function C0_承認_出演者修正() { PropertiesService.getScriptProperties().setProperty('APPROVE_CAST_FIX_V2', 'yes'); return scLog_('C0_承認_出演者修正', { status: 'APPROVED' }); }
function C2_出演者_反映() {
  if (PropertiesService.getScriptProperties().getProperty('APPROVE_CAST_FIX_V2') !== 'yes') return scLog_('C2_出演者_反映', { status: 'NOT_APPROVED', note: '先に C0_承認_出演者修正' });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('C2_出演者_反映', { status: 'LOCKED' });
  try {
    var p = cfPlan_(), col = p.L.ix.cast + 1, now = new Date().toISOString(), id = now + '/CAST', c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
    if (!p.plan.length) return scLog_('C2_出演者_反映', { status: 'OK_NO_CHANGE', hold: p.hold });
    var hs = c.ss.getSheetByName(CF_HIST_) || c.ss.insertSheet(CF_HIST_); if (hs.getLastRow() === 0) hs.getRange(1, 1, 1, CF_HIST_HEADERS_.length).setValues([CF_HIST_HEADERS_]);
    var hr = hs.getRange(hs.getLastRow() + 1, 1, p.plan.length, CF_HIST_HEADERS_.length); hr.setNumberFormat('@');
    hr.setValues(p.plan.map(function (x) { return [now, id, x.ep, x.row, x.kind, x.old, x.nw, '書込中']; })); SpreadsheetApp.flush();   // 先に履歴
    p.plan.forEach(function (x) { var cell = p.v.sh.getRange(x.row, col); cell.setNumberFormat('@'); cell.setValue(x.nw); });
    SpreadsheetApp.flush();
    var back = p.v.sh.getRange(1, col, p.v.sh.getLastRow(), 1).getDisplayValues(), eps = p.v.sh.getRange(1, p.L.ix.ep + 1, p.v.sh.getLastRow(), 1).getDisplayValues(), bad = 0;
    hr.offset(0, 7, p.plan.length, 1).setValues(p.plan.map(function (x) { var ok = back[x.row - 1][0] === x.nw && eps[x.row - 1][0] === x.ep; if (!ok) bad++; return [ok ? 'OK' : 'READBACK_MISMATCH']; }));
    return scLog_('C2_出演者_反映', { status: bad ? 'READBACK_MISMATCH' : 'OK', written: p.plan.length, kinds: p.kinds, readbackMismatch: bad, hold: p.hold, runId: id });
  } finally { lock.releaseLock(); }
}
function C9_出演者修正の取消() {   // 書いた値が今もそのままのセルだけ旧値へ
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hs = c.ss.getSheetByName(CF_HIST_), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), col = L.ix.cast + 1;
  if (!hs || hs.getLastRow() < 2) return scLog_('C9_出演者修正の取消', { status: 'NOTHING_TO_UNDO' });
  var hv = hs.getRange(2, 1, hs.getLastRow() - 1, CF_HIST_HEADERS_.length).getDisplayValues(), n = 0, kept = 0;
  hv.forEach(function (r, k) { if (r[7] !== 'OK') return; var row = Number(r[3]), cell = v.sh.getRange(row, col);
    if (v.sh.getRange(row, L.ix.ep + 1).getDisplayValue() === r[2] && cell.getDisplayValue() === r[6]) { cell.setValue(r[5]); hs.getRange(k + 2, 8).setValue('取消済'); n++; } else kept++; });
  return scLog_('C9_出演者修正の取消', { status: 'OK', undone: n, keptBecauseChanged: kept });
}

// =====================================================================
// 人物索引・出演者欄の日常運用（2026-11-13）。新しいロボではなく、清掃ロボの P系・C系に「差分更新」「公開台帳の点検」「日次入口」を足したもの。
// P5 差分更新: 話ごとの指紋（原文SHA・出演者欄・索引版）を「人物索引_状態」に持ち、変わった話だけ索引を作り直す。書くのは差がある時だけ。
//   途中で時間切れになっても、処理済みの話の指紋だけ保存するので、同じボタンで続きから再開できる（冪等）。
// X1 公開台帳の点検（読むだけ）: 式の有無・#REF!・行数・出演者列の一致・式を塞ぐ手入力セル。X2 は塞いでいるセルのうち統合台帳と同じ値のものだけ空にする（承認後）。
// D2 日次: 停止旗 → S6A → S6B → C2（承認済みなら）→ P5 → X1。異常で停止旗。トリガーは承認ボタン後の D8 で1本だけ。
// =====================================================================
var PI_STATE_ = '人物索引_状態', PI_STATE_HEADERS_ = ['EP-ID', '指紋', '索引行数', '状態', '更新日時'], PI_DIFF_ = '人物・差異', PI_DIFF_HEADERS_ = ['EP-ID', '種類', '原文の名前', '出演者欄の名前', '出演者欄に無い名前', '原文に無い名前', '記録日時'];
var PI_TIME_BUDGET_MS_ = 240000;
function piEnv_(env) {
  var copy = env === 'COPY', ledgerSs = copy ? scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes) : scOpen_(SC_CONFIG.v2WorkingId, '');
  return { env: env, ss: ledgerSs.ss, sh: ledgerSs.sh, indexName: copy ? PI_SHEET_COPY_ : PI_SHEET_V2_ };
}
function piReadRows_(sh, H) { if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getDisplayValues(); }
function piSheet_(ss, name, H) { var sh = ss.getSheetByName(name) || ss.insertSheet(name); if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, H.length).setValues([H]); return sh; }
function piWriteAll_(sh, H, vals) {   // 上書きしてから余った末尾行だけ消す（先に全消ししない＝途中で止まっても空にならない）。書いたら件数と先頭2列を読み戻す
  var before = sh.getLastRow();
  for (var i = 0; i < vals.length; i += 5000) { var part = vals.slice(i, i + 5000), rg = sh.getRange(2 + i, 1, part.length, H.length); rg.setNumberFormat('@'); rg.setValues(part); }
  if (before > vals.length + 1) sh.getRange(vals.length + 2, 1, before - vals.length - 1, Math.max(H.length, sh.getLastColumn())).clearContent();
  SpreadsheetApp.flush();
  var back = piReadRows_(sh, H), bad = Math.abs(back.length - vals.length); back.forEach(function (r, i) { if (vals[i] && (r[0] !== String(vals[i][0]) || r[1] !== String(vals[i][1]))) bad++; });
  return bad;
}
var PI_BACKUP_ = '人物索引_直前', PI_HIST_ = '人物索引_更新履歴', PI_HIST_HEADERS_ = ['日時', 'EP-ID', '前の索引名', '新しい索引名', '前の行数', '新しい行数', '索引版', '環境'];
function piIncremental_(env, fn, dry, budgetMs, maxEps) {   // dry=true: 何も書かず（シートも作らず）、変わる話と件数だけ返す
  var t0 = Date.now(), E = piEnv_(env), ver = PersonIndex.PERSON_INDEX_VERSION + '/' + CleanerV4.CLEANER_VERSION, pre = scPreservedRaw_(), L = scLedger_(E.sh);
  var H = PersonIndex.PERSON_INDEX_HEADERS, getS = function (n, h) { return dry ? E.ss.getSheetByName(n) : piSheet_(E.ss, n, h); }, ix = getS(E.indexName, H), st = getS(PI_STATE_, PI_STATE_HEADERS_);
  var state = {}; piReadRows_(st, PI_STATE_HEADERS_).forEach(function (r) { state[r[0]] = r; });
  var inLedger = {}, todo = [], now = new Date().toISOString();
  L.rows.forEach(function (r) { inLedger[r.ep] = 1; var raw = pre[r.ep] ? pre[r.ep].text : '', fp = p25v2GasSha256_(PersonIndex.epFingerprintText(raw, r.cast, ver)); if (!state[r.ep] || state[r.ep][1] !== fp) todo.push({ r: r, raw: raw, fp: fp }); });
  var removed = Object.keys(state).filter(function (ep) { return !inLedger[ep]; });
  var updates = new Map(), done = [], partial = false;
  for (var i = 0; i < todo.length; i++) {
    if (Date.now() - t0 > (budgetMs || PI_TIME_BUDGET_MS_) || (maxEps && i >= maxEps)) { partial = true; break; }
    var t = todo[i], b = PersonIndex.buildPersonIndex([{ ep: t.r.ep, raw: t.raw, ledgerCast: t.r.cast, parse: CleanerV4.parseCastLine }]);
    updates.set(t.r.ep, b.rows); done.push([t.r.ep, t.fp, String(b.rows.length), b.stat.withNames ? '原文で確認' : b.rows.length ? '原文に出典なし・未検証' : (t.raw ? '原文に人名なし' : '原文なし'), now]);
  }
  var cur = piReadRows_(ix, H).map(function (r) { return { ep: r[0], key: r[1], display: r[2], note: r[3], links: r[4], source: r[5], state: r[6], ver: r[7] }; });
  var m = PersonIndex.mergeIndex(cur, updates, partial ? [] : removed), bad = 0;
  // 変わる話の一覧（前→後の索引名）。履歴と予行の両方に使う
  var oldBy = {}, newBy = {}; cur.forEach(function (r) { (oldBy[r.ep] = oldBy[r.ep] || []).push(r.key); }); m.rows.forEach(function (r) { (newBy[r.ep] = newBy[r.ep] || []).push(r.key + (r.state === '原文で確認' ? '' : '(未検証)')); });
  cur.forEach(function (r) { if (r.state !== '原文で確認') { var a = oldBy[r.ep]; a[a.indexOf(r.key)] = r.key + '(未検証)'; } });
  var changedEps = []; Object.keys(Object.assign({}, oldBy, newBy)).forEach(function (ep) { var o = (oldBy[ep] || []).join('、'), n = (newBy[ep] || []).join('、'); if (o !== n) changedEps.push([now, ep, o, n, String((oldBy[ep] || []).length), String((newBy[ep] || []).length), PersonIndex.PERSON_INDEX_VERSION, env]); });
  // 未検証（原文に出典なし）の名前が1つも消えていないか: 旧行の索引名（「/」で並んだものは1人ずつ）が、同じ話の新しい索引名に全部あるか
  var newKeys = {}; m.rows.forEach(function (r) { (newKeys[r.ep] = newKeys[r.ep] || {})[r.key] = 1; }), lostUnverified = [];
  // 「消えた」と数えるのは、その名前が今の出演者欄（従来から索引の対象だった行）にまだ書かれているのに索引から落ちた時だけ。出演者欄の名前を人が変えた・消した場合は消えて正しい
  var castBy = {}; L.rows.forEach(function (r) { castBy[r.ep] = String(r.cast || '').split('\n').filter(function (l) { return !PersonIndex.legacyHeld(CleanerV4.parseCastLine(l).name); }).join('\n').normalize('NFKC').replace(/[\s\u3000]+/g, ''); });
  cur.forEach(function (r) { if (r.state === '原文で確認' || !updates.has(r.ep) || (newKeys[r.ep] || {})[r.key]) return; String(r.key).split(/\s*[\/、]\s*/).forEach(function (p) { var k = PersonIndex.personKey(p); if (k && !(newKeys[r.ep] || {})[k] && !PersonIndex.personHold(p) && String(castBy[r.ep] || '').indexOf(k) >= 0) lostUnverified.push(r.ep + ':' + r.key); }); });
  var byState = function (rows) { var c = {}; rows.forEach(function (r) { c[r.state] = (c[r.state] || 0) + 1; }); return c; }, people = function (rows) { var k = {}; rows.forEach(function (r) { k[r.key] = 1; }); return Object.keys(k).length; };
  var summary = { env: env, changedEpisodes: todo.length, processed: done.length, removedEpisodes: partial ? 0 : removed.length, merge: m.stat, rowsBefore: cur.length, rowsAfter: m.rows.length, peopleBefore: people(cur), peopleAfter: people(m.rows), stateBefore: byState(cur), stateAfter: byState(m.rows), indexChangedEpisodes: changedEps.length, lostUnverified: lostUnverified.length, lostUnverifiedExamples: lostUnverified.slice(0, 20) };
  if (lostUnverified.length && !dry) return scLog_(fn, Object.assign({ status: 'STOP_UNVERIFIED_WOULD_BE_LOST' }, summary));   // 未検証の名前を消す更新は書かない
  if (m.stat.duplicatePairs) return scLog_(fn, Object.assign({ status: 'STOP_DUPLICATE' }, summary));
  if (dry) {   // 変わる話を「原文の名前の分離」「出演者欄（未検証）の分割・回収」「注記だけ」に分けて示す（ログが切れないよう例は少なめ）
    var full = function (rows) { var o = {}; rows.forEach(function (r) { (o[r.ep] = o[r.ep] || []).push([r.key, r.display, r.note, r.links, r.source, r.state].join('|')); }); return o; }, fo = full(cur), fn2 = full(m.rows), cat = { raw: [], ledger: [], noteOnly: [] };
    var keysOf = function (rows, ep, verified) { return rows.filter(function (r) { return r.ep === ep && (r.state === '原文で確認') === verified; }).map(function (r) { return r.key; }).join('、'); };
    var curBy = {}, newBy2 = {}; cur.forEach(function (r) { (curBy[r.ep] = curBy[r.ep] || []).push(r); }); m.rows.forEach(function (r) { (newBy2[r.ep] = newBy2[r.ep] || []).push(r); });
    Object.keys(Object.assign({}, fo, fn2)).forEach(function (ep) { if ((fo[ep] || []).join('\n') === (fn2[ep] || []).join('\n')) return; var a = curBy[ep] || [], b = newBy2[ep] || [];
      if (keysOf(a, ep, true) !== keysOf(b, ep, true)) cat.raw.push(ep + ': ' + keysOf(a, ep, true) + ' → ' + keysOf(b, ep, true)); else if (keysOf(a, ep, false) !== keysOf(b, ep, false)) cat.ledger.push(ep + ': ' + keysOf(a, ep, false) + ' → ' + keysOf(b, ep, false)); else cat.noteOnly.push(ep); });
    summary.status = partial ? 'DRYRUN_PARTIAL' : 'DRYRUN_OK'; summary.categories = { rawNameSplit: cat.raw.length, ledgerUnverified: cat.ledger.length, noteOnly: cat.noteOnly.length };
    summary.rawExamples = cat.raw.slice(0, 40); summary.ledgerExamples = cat.ledger.slice(0, 25); summary.noteOnlyIds = cat.noteOnly.slice(0, 40).join(',');
    summary.rawIds = cat.raw.map(function (x) { return x.slice(0, 8); }).join(','); summary.ms = Date.now() - t0; return scLog_(fn, summary);
  }
  if (m.changed) {
    if (env === 'V2' && ix.getLastRow() > 1) { var old = E.ss.getSheetByName(PI_BACKUP_); if (old) E.ss.deleteSheet(old); ix.copyTo(E.ss).setName(PI_BACKUP_); }   // 戻し用の写し（直前の索引）
    bad = piWriteAll_(ix, H, m.rows.map(function (r) { return [r.ep, r.key, r.display, r.note, r.links, r.source, r.state, r.ver || PersonIndex.PERSON_INDEX_VERSION]; }));
    if (!bad && changedEps.length) { var hs = piSheet_(E.ss, PI_HIST_, PI_HIST_HEADERS_), hr = hs.getLastRow(); for (var j = 0; j < changedEps.length; j += 5000) { var part = changedEps.slice(j, j + 5000), rg = hs.getRange(hr + 1 + j, 1, part.length, PI_HIST_HEADERS_.length); rg.setNumberFormat('@'); rg.setValues(part); } }
  }
  if (!bad) {   // 指紋は索引の書込が読み戻しで一致した後にだけ保存（途中で失敗しても次回やり直せる）
    done.forEach(function (d) { state[d[0]] = d; }); if (!partial) removed.forEach(function (ep) { delete state[ep]; });
    var sv = Object.keys(state).map(function (k) { return state[k]; }); if (done.length || removed.length) bad += piWriteAll_(st, PI_STATE_HEADERS_, sv);
  }
  // 出演者欄と原文の名前の差（記録だけ。人の値は直さない）
  var byEp = {}; m.rows.forEach(function (r) { if (r.state === '原文で確認') (byEp[r.ep] = byEp[r.ep] || []).push(r.key); });
  var diffs = []; L.rows.forEach(function (r) { var d = PersonIndex.castDifference(r.ep, byEp[r.ep] || [], r.cast, CleanerV4.parseCastLine); if (d) diffs.push([d.ep, d.kind, d.raw, d.ledger, d.missingInLedger || '', d.notInRaw || '', now]); });
  var ds = piSheet_(E.ss, PI_DIFF_, PI_DIFF_HEADERS_), prevDiff = piReadRows_(ds, PI_DIFF_HEADERS_).map(function (r) { return r.slice(0, 6).join('\u0001'); }).join('\n');
  if (prevDiff !== diffs.map(function (r) { return r.slice(0, 6).join('\u0001'); }).join('\n')) piWriteAll_(ds, PI_DIFF_HEADERS_, diffs);
  var dk = {}; diffs.forEach(function (d) { dk[d[1]] = (dk[d[1]] || 0) + 1; });
  summary.status = bad ? 'READBACK_MISMATCH' : partial ? 'PARTIAL_RESUME_NEEDED' : (m.changed ? 'OK' : 'OK_NO_CHANGE'); summary.differences = dk; summary.changedExamples = changedEps.slice(0, 30).map(function (c) { return c[1]; }); summary.ms = Date.now() - t0;
  return scLog_(fn, summary);
}
function P5_人物索引_予行() { return piIncremental_('V2', 'P5_人物索引_予行', true); }   // V2を読むだけ（書かない・シートも作らない）
function P5T_途中停止の試験_COPY() { return piIncremental_('COPY', 'P5T_途中停止の試験_COPY', false, 0, 2000); }   // わざと2,000話で止めて、続きから再開できるか確かめる
function P5_人物索引_予行_COPY() { return piIncremental_('COPY', 'P5_人物索引_予行_COPY', true); }
function P8_人物索引_直前に戻す() {   // P5 の直前の写しから V2 索引を戻す（承認キーは P5 と同じ）。戻した後は状態を空にして次の P5 で全話を再確認
  var fn = 'P8_人物索引_直前に戻す'; if (PropertiesService.getScriptProperties().getProperty('APPROVE_PI_INCREMENTAL_V2') !== 'yes') return scLog_(fn, { status: 'NOT_APPROVED' });
  var E = piEnv_('V2'), bk = E.ss.getSheetByName(PI_BACKUP_), H = PersonIndex.PERSON_INDEX_HEADERS; if (!bk || bk.getLastRow() < 2) return scLog_(fn, { status: 'NO_BACKUP' });
  var vals = piReadRows_(bk, H), bad = piWriteAll_(E.ss.getSheetByName(E.indexName), H, vals), st = E.ss.getSheetByName(PI_STATE_); if (!bad && st && st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, PI_STATE_HEADERS_.length).clearContent();
  return scLog_(fn, { status: bad ? 'READBACK_MISMATCH' : 'OK', restoredRows: vals.length });
}
// 突合（読むだけ）: COPY の索引と V2 の索引の違いを EP-ID・索引名・出典で並べ、出演者欄の違いと C2 履歴の有無で理由を付ける
function P6_人物索引_COPYとV2の突合() {
  var H = PersonIndex.PERSON_INDEX_HEADERS, c = piEnv_('COPY'), v = piEnv_('V2'), ci = piReadRows_(c.ss.getSheetByName(PI_SHEET_COPY_), H), vi = piReadRows_(v.ss.getSheetByName(PI_SHEET_V2_), H);
  var k = function (r) { return [r[0], r[1], r[5], r[6]].join(' | '); }, cs = {}, vs = {}; ci.forEach(function (r) { cs[k(r)] = r; }); vi.forEach(function (r) { vs[k(r)] = r; });
  var onlyC = ci.filter(function (r) { return !vs[k(r)]; }), onlyV = vi.filter(function (r) { return !cs[k(r)]; });
  var lc = {}, lv = {}; scLedger_(c.sh).rows.forEach(function (r) { lc[r.ep] = r.cast; }); scLedger_(v.sh).rows.forEach(function (r) { lv[r.ep] = r.cast; });
  var hist = {}, hs = c.ss.getSheetByName('出演者修正履歴'); if (hs && hs.getLastRow() > 1) { var hv = hs.getRange(1, 1, hs.getLastRow(), hs.getLastColumn()).getDisplayValues(), he = hv[0].indexOf('EP-ID'), hk = hv[0].indexOf('種類'); hv.slice(1).forEach(function (r) { hist[r[he]] = hk >= 0 ? r[hk] : 'あり'; }); }
  var eps = {}; onlyC.concat(onlyV).forEach(function (r) { eps[r[0]] = 1; });
  var why = Object.keys(eps).sort().map(function (ep) { return { ep: ep, ledgerSame: lc[ep] === lv[ep], c2History: hist[ep] || '', copyCast: String(lc[ep] || '').slice(0, 80), v2Cast: String(lv[ep] || '').slice(0, 80), copyOnly: onlyC.filter(function (r) { return r[0] === ep; }).map(function (r) { return r[1] + '[' + r[6] + ']'; }), v2Only: onlyV.filter(function (r) { return r[0] === ep; }).map(function (r) { return r[1] + '[' + r[6] + ']'; }) }; });
  var pc = {}, pv = {}; ci.forEach(function (r) { pc[r[1]] = 1; }); vi.forEach(function (r) { pv[r[1]] = 1; });
  return scLog_('P6_人物索引_COPYとV2の突合', { status: 'OK', copyRows: ci.length, v2Rows: vi.length, onlyInCopy: onlyC.length, onlyInV2: onlyV.length, episodes: why.length, episodesWithLedgerDiff: why.filter(function (w) { return !w.ledgerSame; }).length, episodesWithC2History: why.filter(function (w) { return w.c2History; }).length,
    peopleCopy: Object.keys(pc).length, peopleV2: Object.keys(pv).length, peopleOnlyCopy: Object.keys(pc).filter(function (x) { return !pv[x]; }), peopleOnlyV2: Object.keys(pv).filter(function (x) { return !pc[x]; }), detail: why });
}
function P5_人物索引_差分更新_COPY() { return piIncremental_('COPY', 'P5_人物索引_差分更新_COPY'); }
function P5_人物索引_差分更新() {
  if (PropertiesService.getScriptProperties().getProperty('APPROVE_PI_INCREMENTAL_V2') !== 'yes') return scLog_('P5_人物索引_差分更新', { status: 'NOT_APPROVED', note: '先に P4_承認_人物索引差分更新V2' });
  return piIncremental_('V2', 'P5_人物索引_差分更新');
}
function P4_承認_人物索引差分更新V2() { PropertiesService.getScriptProperties().setProperty('APPROVE_PI_INCREMENTAL_V2', 'yes'); return scLog_('P4_承認_人物索引差分更新V2', { status: 'APPROVED' }); }

// ---------- 公開台帳の点検（読むだけ）／塞いでいる手入力セルの除去（承認後）／警告つき保護（承認後） ----------
var PUB_SHEET_ = 'V2・公開台帳';
function xInspect_(env) {
  var E = piEnv_(env), ps = E.ss.getSheetByName(PUB_SHEET_); if (!ps) return { status: 'NO_PUBLIC_SHEET' };
  var formula = ps.getRange(2, 1).getFormula(), n = ps.getLastRow(), w = ps.getLastColumn(), v = n > 1 ? ps.getRange(2, 1, n - 1, w).getDisplayValues() : [];
  var hp = ps.getRange(1, 1, 1, w).getDisplayValues()[0], cP = hp.indexOf('出演者'), errs = v.filter(function (r) { return /^#(REF|N\/A|VALUE|ERROR|NAME)/.test(r[0]); }).length;
  var L = scLedger_(E.sh), Lv = E.sh.getRange(1, 1, E.sh.getLastRow(), E.sh.getLastColumn()).getDisplayValues(), lh = Lv[0], cJ = lh.indexOf('掲載判定'), cR = lh.indexOf('代表EP-ID');
  var expected = Lv.slice(1).filter(function (r) { return r[0] && r[cJ] === '対象' && r[0] === r[cR]; }).length, castByEp = {}; L.rows.forEach(function (r) { castByEp[r.ep] = r.cast; });
  var rows = v.filter(function (r) { return r[0] && !/^#/.test(r[0]); }), castMismatch = rows.filter(function (r) { return cP >= 0 && String(castByEp[r[0]] || '') !== r[cP]; }).length;
  var blockers = [];   // 式が展開できない時、2行目以降に値があるセル＝手入力で塞いでいるセル
  if (errs && v.length) v.forEach(function (r, i) { r.forEach(function (x, j) { if (x !== '' && !(i === 0 && j === 0)) blockers.push({ row: i + 2, col: j + 1, value: x, header: hp[j] }); }); });
  var ok = !!formula && /^=FILTER\(/i.test(formula) && !errs && rows.length === expected && !castMismatch;
  return { status: ok ? 'PUBLIC_OK' : 'PUBLIC_ANOMALY', env: env, hasFormula: !!formula, errors: errs, rows: rows.length, expected: expected, castMismatch: castMismatch, blockers: blockers.length, blockerExamples: blockers.slice(0, 10).map(function (b) { return [b.row, b.header, b.value.slice(0, 40)]; }), _blockers: blockers, _castByEp: castByEp, _sheet: ps, _E: E };
}
function X1_公開台帳_点検() { var r = xInspect_('V2'); delete r._blockers; delete r._castByEp; delete r._sheet; delete r._E; return scLog_('X1_公開台帳_点検', r); }
function X1_公開台帳_点検_COPY() { var r = xInspect_('COPY'); delete r._blockers; delete r._castByEp; delete r._sheet; delete r._E; return scLog_('X1_公開台帳_点検_COPY', r); }
function X0_承認_公開台帳の修復() { PropertiesService.getScriptProperties().setProperty('APPROVE_PUBLIC_REPAIR_V2', 'yes'); return scLog_('X0_承認_公開台帳の修復', { status: 'APPROVED' }); }
function xRepair_(env, fn) {   // 塞いでいるセルのうち、出演者列で統合台帳と同じ値のものだけ空にする。それ以外は触らず報告（自動で大量削除・再生成しない）
  var r = xInspect_(env); if (!r._blockers || !r._blockers.length) return scLog_(fn, { status: 'NOTHING_TO_REPAIR', inspect: r.status });
  var ps = r._sheet, hp = ps.getRange(1, 1, 1, ps.getLastColumn()).getDisplayValues()[0], Lv = r._E.sh.getRange(1, 1, r._E.sh.getLastRow(), r._E.sh.getLastColumn()).getDisplayValues();
  var castSet = {}; Lv.slice(1).forEach(function (x) { var c = x[Lv[0].indexOf('出演者')]; if (c) castSet[c] = 1; });
  var cleared = [], kept = [];
  r._blockers.forEach(function (b) { if (b.header === '出演者' && castSet[b.value]) { ps.getRange(b.row, b.col).clearContent(); cleared.push(b.row + ':' + b.col); } else kept.push([b.row, b.header]); });
  SpreadsheetApp.flush(); var after = xInspect_(env);
  return scLog_(fn, { status: kept.length ? 'PARTIAL_HELD' : (after.status === 'PUBLIC_OK' ? 'OK' : 'STILL_ANOMALY'), cleared: cleared, kept: kept.slice(0, 20), after: { status: after.status, rows: after.rows, expected: after.expected, castMismatch: after.castMismatch } });
}
function X2_公開台帳_塞ぎセル除去_COPY() { return xRepair_('COPY', 'X2_公開台帳_塞ぎセル除去_COPY'); }
function X2_公開台帳_塞ぎセル除去() { if (PropertiesService.getScriptProperties().getProperty('APPROVE_PUBLIC_REPAIR_V2') !== 'yes') return scLog_('X2_公開台帳_塞ぎセル除去', { status: 'NOT_APPROVED' }); return xRepair_('V2', 'X2_公開台帳_塞ぎセル除去'); }
function xProtect_(env, fn) {   // 公開台帳シートに「編集時に警告」の保護を付ける（権限は変えない。誤って手入力するのを防ぐ）
  var E = piEnv_(env), ps = E.ss.getSheetByName(PUB_SHEET_); if (!ps) return scLog_(fn, { status: 'NO_PUBLIC_SHEET' });
  var has = ps.getProtections(SpreadsheetApp.ProtectionType.SHEET).filter(function (p) { return p.getDescription() === '公開台帳は統合台帳から生成（直接編集しない）'; });
  if (has.length) return scLog_(fn, { status: 'ALREADY_PROTECTED' });
  var p = ps.protect().setDescription('公開台帳は統合台帳から生成（直接編集しない）'); p.setWarningOnly(true);
  return scLog_(fn, { status: 'PROTECTED_WARNING_ONLY', sheet: PUB_SHEET_ });
}
function X3_公開台帳_警告保護_COPY() { return xProtect_('COPY', 'X3_公開台帳_警告保護_COPY'); }
function X3_公開台帳_警告保護() { if (PropertiesService.getScriptProperties().getProperty('APPROVE_PUBLIC_REPAIR_V2') !== 'yes') return scLog_('X3_公開台帳_警告保護', { status: 'NOT_APPROVED' }); return xProtect_('V2', 'X3_公開台帳_警告保護'); }

// ---------- 日次入口（清掃ロボ側）。トリガーは承認後に D8 で1本だけ ----------
function D2_清掃と人物_日次() {
  var P = PropertiesService.getScriptProperties(), fn = 'D2_清掃と人物_日次'; if (P.getProperty('AUTORUN_STOP')) return scLog_(fn, { status: 'STOPPED', reason: P.getProperty('AUTORUN_STOP') });
  var out = {}, stop = function (why, res) { P.setProperty('AUTORUN_STOP', new Date().toISOString() + ' ' + why); laDashboard_('D2_清掃と人物_日次', 'STOP ' + why, out); return scLog_(fn, { status: 'STOP', reason: why, res: res }); };
  out.s6a = S6A_V2新着_清掃監査().status; if (!/^OK/.test(out.s6a)) return stop('S6A_' + out.s6a);
  var b = S6B_V2新着_反映(); out.s6b = b.status; if (/MISMATCH|ERROR/.test(b.status)) return stop('S6B_' + b.status, b);
  if (P.getProperty('APPROVE_CAST_FIX_V2') === 'yes') { var c = C2_出演者_反映(); out.c2 = c.status; if (/MISMATCH/.test(c.status)) return stop('C2_' + c.status, c); }
  if (P.getProperty('APPROVE_PI_INCREMENTAL_V2') === 'yes') { var p = P5_人物索引_差分更新(); out.p5 = p.status; if (/MISMATCH|STOP/.test(p.status)) return stop('P5_' + p.status, p); }
  if (P.getProperty('APPROVE_OFFICIAL_URL_V2') === 'yes') { var u1 = ouCheck_('U1_公式URL_確認', 120000); out.u1 = u1.status; var u2 = ouApply_('V2', 'U2_公式URL補完_V2'); out.u2 = u2.status; if (/MISMATCH/.test(u2.status)) return stop('U2_' + u2.status, u2); }   // 新着の公式個別URL（確認できたものだけ）
  if (P.getProperty('APPROVE_RELATED_INDEX_V2') === 'yes') { var r3 = rlBuild_('V2', 'R3_関連記事索引_V2作成'); out.r3 = r3.status; if (/MISMATCH/.test(r3.status)) return stop('R3_' + r3.status, r3); }
  var x = xInspect_('V2'); out.x1 = x.status; if (x.status !== 'PUBLIC_OK') return stop('PUBLIC_' + x.status, { errors: x.errors, rows: x.rows, expected: x.expected, castMismatch: x.castMismatch, blockers: x.blockers });
  laDashboard_('D2_清掃と人物_日次', 'OK', out);
  return scLog_(fn, { status: 'OK', steps: out });
}
function D0_承認_清掃日次トリガー() { PropertiesService.getScriptProperties().setProperty('APPROVE_CLEANER_DAILY_TRIGGER', 'yes'); return scLog_('D0_承認_清掃日次トリガー', { status: 'APPROVED' }); }
function D8_清掃日次トリガー設置() {
  var fn = 'D8_清掃日次トリガー設置'; if (PropertiesService.getScriptProperties().getProperty('APPROVE_CLEANER_DAILY_TRIGGER') !== 'yes') return scLog_(fn, { status: 'NOT_APPROVED' });
  var ts = ScriptApp.getProjectTriggers(), other = ts.filter(function (t) { return t.getHandlerFunction() !== 'D2_清掃と人物_日次'; });
  if (other.length) return scLog_(fn, { status: 'REFUSED_OTHER_TRIGGERS', handlers: other.map(function (t) { return t.getHandlerFunction(); }) });
  if (ts.length) return scLog_(fn, { status: 'ALREADY_INSTALLED' });
  ScriptApp.newTrigger('D2_清掃と人物_日次').timeBased().everyDays(1).atHour(7).nearMinute(20).create();   // 収蔵ボットの日次（6時台）の後
  return scLog_(fn, { status: 'INSTALLED', at: '毎日 7時台（日本時間）' });
}
function D9_清掃日次停止() {
  var n = 0; ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'D2_清掃と人物_日次') { ScriptApp.deleteTrigger(t); n++; } });
  var P = PropertiesService.getScriptProperties(); P.setProperty('AUTORUN_STOP', new Date().toISOString() + ' 手動停止'); P.deleteProperty('APPROVE_CLEANER_DAILY_TRIGGER');
  return scLog_('D9_清掃日次停止', { status: 'OK', deletedTriggers: n });
}
function D7_停止旗を外す() { PropertiesService.getScriptProperties().deleteProperty('AUTORUN_STOP'); return scLog_('D7_停止旗を外す', { status: 'OK' }); }

// =====================================================================
// V2統合台帳 総合監査・改善（2026-11-13 司令塔指令 LA-1）。新しいロボは作らず清掃ロボに足す。
// L1 総合監査: V2を読むだけ。結果は COPY の「監査・…」シートに書く（V2には書かない）。
// U系 公式個別URL: 空欄で GUID がある行だけ、公式ページを取得して canonical の itemid が GUID と一致したものだけ書く（作った URL をそのまま書かない）。
// R系 関連記事索引: 1記事1行の別シート（見出し・URL・リンク）。統合台帳の関連記事URL列は変えない。
// =====================================================================
var LA_COPY_SHEETS_ = { summary: '監査・概要', cols: '監査・列充足', url: '監査・公式URL欠落', plat: '監査・各サービスURL', platCells: '監査・各サービスURL_要確認', sdgs: '監査・SDGs1092', show: '監査・番組別件数', odd: '監査・要確認行' };
function laRead_(sh) {   // 台帳を見出し名で読む（全列）
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(), h = v[0], c = function (n) { return h.indexOf(n); };
  var I = { ep: c('EP-ID'), show: c('番組'), title: c('タイトル'), date: c('配信日時 JST'), judge: c('掲載判定'), rep: c('代表EP-ID'), guid: c('公式GUID'), uuid: c('公式JSON UUID'), url: c('公式個別URL'), src: c('旧元ページURL'), reason: c('除外・保留理由'), related: c('関連記事URL'), audio: c('音声URL'), spotify: c('Spotify'), sec: c('再生時間 秒') };
  ['ep', 'show', 'judge', 'rep', 'guid', 'url'].forEach(function (k) { if (I[k] < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + k); });
  var rows = v.slice(1).map(function (r, i) { return { row: i + 2, ep: r[I.ep], show: r[I.show], title: r[I.title], date: r[I.date], judge: r[I.judge], rep: r[I.rep], guid: String(r[I.guid] || '').toLowerCase(), jsonUuid: I.uuid >= 0 ? r[I.uuid] : '', officialUrl: r[I.url], sourceUrl: I.src >= 0 ? r[I.src] : '', reason: I.reason >= 0 ? r[I.reason] : '', related: I.related >= 0 ? r[I.related] : '', audioUrl: I.audio >= 0 ? r[I.audio] : '', spotify: I.spotify >= 0 ? r[I.spotify] : '', seconds: I.sec >= 0 ? r[I.sec] : '', _r: r }; }).filter(function (r) { return r._r.some(function (x) { return x !== ''; }); });
  return { h: h, I: I, rows: rows, values: v };
}
function laWriteSheet_(ss, name, H, vals) { var sh = ss.getSheetByName(name) || ss.insertSheet(name); sh.clearContents(); sh.getRange(1, 1, 1, H.length).setValues([H]); for (var i = 0; i < vals.length; i += 5000) { var p = vals.slice(i, i + 5000), rg = sh.getRange(2 + i, 1, p.length, H.length); rg.setNumberFormat('@'); rg.setValues(p.map(function (r) { return r.map(function (x) { return String(x); }); })); } sh.setFrozenRows(1); return vals.length; }
function L1_台帳総合監査() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), D = laRead_(v.sh), rows = D.rows, pub = function (r) { return r.ep && r.judge === '対象' && r.rep === r.ep; };
  // 列充足（全行・公開対象）
  var cols = D.h.map(function (name, j) { var all = 0, p = 0, np = 0; rows.forEach(function (r) { if (String(r._r[j]).trim()) { all++; if (pub(r)) p++; } if (pub(r)) np++; }); return [name, rows.length, all, rows.length - all, np, p, np - p]; });
  // 公式個別URL 欠落
  var miss = rows.filter(function (r) { return !String(r.officialUrl).trim(); }).map(function (r) { var cand = LedgerAudit.officialUrlCandidate(r); return [r.ep || '(EP-IDなし)', r.row, r.show, r.date, r.judge, pub(r) ? '公開対象' : '', r.guid, r.sourceUrl, cand.status === 'CANDIDATE' ? '確認待ち（GUIDあり）' : 'GUIDなし（補完不可）']; });
  var missPub = miss.filter(function (m) { return m[5]; }).length, firstGap = '';   // 最新側から空欄が続く範囲
  for (var i = rows.length - 1; i >= 0; i--) { if (!rows[i].ep) continue; if (String(rows[i].officialUrl).trim()) break; firstGap = rows[i].ep; }
  // 各サービスURL
  var platRows = [], platCells = [];
  LedgerAudit.PLATFORM_COLUMNS.forEach(function (p) { var j = D.h.indexOf(p); if (j < 0) { platRows.push([p, '列なし', '', '', '', '', '', '']); return; } var k = { EMPTY: 0, EPISODE: 0, SHOW_TOP: 0, OTHER: 0 }, emptyPub = 0, seen = {}, dup = 0;
    rows.forEach(function (r) { var u = r._r[j], s = LedgerAudit.classifyPlatformUrl(p, u); k[s]++; if (s === 'EMPTY' && pub(r)) emptyPub++; if (s === 'SHOW_TOP' || s === 'OTHER') platCells.push([r.ep || '(EP-IDなし)', r.row, p, s === 'SHOW_TOP' ? '番組トップ等（個別EPではない）' : '形が不明', u]); if (u) { if (seen[u] && pub(r) && pub(seen[u])) dup++; seen[u] = seen[u] || r; } });
    platRows.push([p, rows.length, k.EPISODE, k.SHOW_TOP, k.OTHER, k.EMPTY, emptyPub, dup]); });
  // SDGs
  var sd = LedgerAudit.auditSdgs(rows);
  // 番組別・要確認行
  var shows = LedgerAudit.playlistCounts(rows), epSeen = {}, odd = [];
  rows.forEach(function (r) { if (!r.ep) odd.push(['EP-IDなし', '', r.row, r.show, r.title, r.judge, r.guid]); else if (epSeen[r.ep]) odd.push(['EP-ID重複', r.ep, r.row, r.show, r.title, r.judge, '最初は行' + epSeen[r.ep]]); else epSeen[r.ep] = r.row; if (r.ep && r.judge === '対象' && !r.rep) odd.push(['代表EP-IDなし', r.ep, r.row, r.show, r.title, r.judge, '']); if (String(r.officialUrl).trim() && !LedgerAudit.officialItemId(r.officialUrl)) odd.push(['公式個別URLの形が違う（朝日の個別ページではない）', r.ep, r.row, r.show, r.title, r.judge, r.officialUrl]); else if (LedgerAudit.officialItemId(r.officialUrl) && r.guid && LedgerAudit.officialItemId(r.officialUrl) !== r.guid) odd.push(['公式個別URLのitemidとGUIDが違う', r.ep, r.row, r.show, r.title, r.judge, r.officialUrl]); });
  var summary = [['監査版', LedgerAudit.LEDGER_AUDIT_VERSION], ['実行日時', new Date().toISOString()], ['台帳行（空行除く）', rows.length], ['公開対象（対象かつ代表EP）', rows.filter(pub).length], ['公式個別URL 空欄', miss.length], ['うち公開対象', missPub], ['最新側から公式個別URLの空欄が続く最初のEP-ID', firstGap], ['SDGs 公式件数', sd.official]]
    .concat(Object.keys(sd.count).sort().map(function (k) { return ['SDGs ' + k, sd.count[k]]; })).concat([['EP-IDなし・重複などの要確認行', odd.length]]);
  var S = LA_COPY_SHEETS_, ss = c.ss;
  laWriteSheet_(ss, S.summary, ['項目', '値'], summary);
  laWriteSheet_(ss, S.cols, ['列', '全行', '入力あり', '空欄', '公開対象', '公開対象で入力あり', '公開対象で空欄'], cols);
  laWriteSheet_(ss, S.url, ['EP-ID', '台帳行', '番組', '配信日時', '掲載判定', '公開', '公式GUID', '旧元ページURL', '補完の可否'], miss);
  laWriteSheet_(ss, S.plat, ['サービス', '全行', '個別EP形式', '番組トップ等', '形が不明', '空欄', '公開対象で空欄', '公開対象どうしで同じURL'], platRows);
  laWriteSheet_(ss, S.platCells, ['EP-ID', '台帳行', 'サービス', '判定', 'URL'], platCells);
  laWriteSheet_(ss, S.sdgs, LedgerAudit.SDGS_AUDIT_HEADERS, sd.rows);
  laWriteSheet_(ss, S.show, LedgerAudit.PLAYLIST_HEADERS, shows);
  laWriteSheet_(ss, S.odd, ['種類', 'EP-ID', '台帳行', '番組', 'タイトル', '掲載判定', 'メモ'], odd);
  return scLog_('L1_台帳総合監査', { status: 'OK', wroteTo: 'COPY の「監査・…」シート（V2には書いていない）', rows: rows.length, officialUrlEmpty: miss.length, officialUrlEmptyPublic: missPub, gapFrom: firstGap, platforms: platRows.map(function (p) { return p[0] + ' 個別' + p[2] + '/空欄' + p[5]; }), sdgs: sd.count, oddRows: odd.length, ms: Date.now() - t0 });
}

// ---------- 公式個別URL: 確認（公式ページを取得）→ 承認後に空欄だけ書く → 取消 ----------
// 公式URL確認の2列目は照合キー（itemid）: UUID の GUID、Megaphone 配信ID、おんさ記録の itemid のどれか
var OU_STATE_ = '公式URL確認', OU_STATE_H_ = ['EP-ID', '公式GUID', '確認したURL', '状態', '理由', '確認日時'], OU_HIST_ = '公式URL補完履歴', OU_HIST_H_ = ['日時', '実行ID', '環境', 'EP-ID', '台帳行', '旧値', '新値', '状態'];
// 原因（2026-11-13 19:14）: UrlFetchApp.fetchAll は、まとめた10件のうち1件でも通信そのものが失敗すると（「使用できないアドレス」など。muteHttpExceptions は HTTP の失敗しか抑えない）
// 全体を例外で止める。さらに結果を最後にまとめて書いていたので、その回に確かめた分も残らなかった。
// 修正: ① 転送は自動で追わず（followRedirects:false）、朝日の同じページ内の転送だけ自分で3回まで追う。他所への転送は HOLD
//       ② まとめて取得が例外なら1件ずつ取り直し、1件の例外はその EP だけ ERROR（理由つき）にして続ける
//       ③ 10件ごとに確認結果を書き足す（途中で止まっても確かめた分は残り、次は続きから）
//       ④ ERROR は次回もう一度確かめる。同じ GUID で3回続けて ERROR なら HOLD（REPEATED_FETCH_ERROR）にして止めない
var OU_MAX_ERRORS_ = 3;
// 429（回数制限）・5xx（相手の一時障害）は少し待って2回まで取り直す。Retry-After があれば最大10秒まで従う。それでも駄目ならその応答を返し、呼び出し側が ERROR として次回に回す
function laFetchRetry_(url, opts) {
  var r = null;
  for (var i = 0; i < 3; i++) {
    r = UrlFetchApp.fetch(url, opts); var code = r.getResponseCode();
    if (code !== 429 && code < 500) return r;
    if (i < 2) { var h = r.getHeaders() || {}, ra = Number(h['Retry-After'] || h['retry-after'] || 0); Utilities.sleep(Math.min(10000, ra > 0 ? ra * 1000 : 1500 * (i + 1))); }
  }
  return r;
}
function ouFetchOne_(url) {   // 1件取得。例外は投げずに { code, html, location, error } で返す
  try {
    for (var hop = 0; hop < 4; hop++) {
      var r = laFetchRetry_(url, { muteHttpExceptions: true, followRedirects: false }), code = r.getResponseCode();
      if (code < 300 || code >= 400) return { code: code, html: code === 200 ? r.getContentText() : '' };
      var h = r.getHeaders() || {}, loc = String(h.Location || h.location || '');
      if (!/^https:\/\/www\.asahi\.com\//.test(loc) || hop === 3) return { code: code, html: '', location: loc };
      url = loc;
    }
  } catch (e) { return { error: String(e && e.message || e).slice(0, 120) }; }
}
function ouResults_(part) {   // 10件をまとめて取得。例外なら1件ずつ取り直す
  var reqs = part.map(function (x) { return { url: x.c.url, muteHttpExceptions: true, followRedirects: false }; }), res;
  try { res = UrlFetchApp.fetchAll(reqs); } catch (e) { return part.map(function (x) { return ouFetchOne_(x.c.url); }); }
  return res.map(function (r, j) { var code = r.getResponseCode(); if (code >= 300 && code < 400) return ouFetchOne_(part[j].c.url); return { code: code, html: code === 200 ? r.getContentText() : '' }; });
}
function ouCheck_(fn, budgetMs, maxN) {   // V2を読むだけ。確認結果は COPY の「公式URL確認」に書き足す（確かめ済みは取り直さない＝途中で止まっても続きから）
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), D = laRead_(v.sh);
  var st = c.ss.getSheetByName(OU_STATE_) || c.ss.insertSheet(OU_STATE_); if (st.getLastRow() === 0) st.getRange(1, 1, 1, OU_STATE_H_.length).setValues([OU_STATE_H_]);
  var done = {}, errs = {}; if (st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, OU_STATE_H_.length).getDisplayValues().forEach(function (r) { if (r[3] === 'ERROR') errs[r[1]] = (errs[r[1]] || 0) + 1; else done[r[1]] = r[3]; });
  var onsa = laOnsaAsahiByEp_(D.rows), todo = D.rows.map(function (r) { return { r: r, c: laOfficialCandidate_(r, onsa) }; }).filter(function (x) { return x.r.ep && x.c.status === 'CANDIDATE' && !done[x.c.key]; });
  var n = 0, k = { VERIFIED: 0, NOT_FOUND: 0, HOLD: 0, ERROR: 0 }, ex = [];
  for (var i = 0; i < todo.length; i += 10) {
    if (Date.now() - t0 > (budgetMs || 240000) || (maxN && n >= maxN)) break;
    var part = todo.slice(i, i + 10), res = ouResults_(part), out = [];
    part.forEach(function (x, j) {
      var f = res[j] || { error: 'NO_RESPONSE' }, vr;
      if (f.error) vr = (errs[x.c.guid] || 0) + 1 >= OU_MAX_ERRORS_ ? { status: 'HOLD', reason: 'REPEATED_FETCH_ERROR ' + f.error } : { status: 'ERROR', reason: 'FETCH_EXCEPTION ' + f.error };
      else if (f.code >= 300 && f.code < 400) vr = { status: 'HOLD', reason: 'REDIRECT ' + (f.location || '(転送先なし)').slice(0, 100) };
      else { try { vr = LedgerAudit.verifyOfficialPage(f.code, f.html, x.c.key, x.r.title, { show: x.r.show, date: x.r.date }); } catch (e) { vr = { status: 'ERROR', reason: 'VERIFY_EXCEPTION ' + String(e).slice(0, 80) }; } }
      k[vr.status]++; n++; out.push([x.r.ep, x.c.key, x.c.url, vr.status, vr.reason + (x.c.kind ? ' [' + x.c.kind + ']' : ''), new Date().toISOString()]); if (vr.status !== 'VERIFIED' && ex.length < 10) ex.push(x.r.ep + ' ' + vr.status + ' ' + vr.reason);
    });
    var r0 = st.getLastRow() + 1, rg = st.getRange(r0, 1, out.length, OU_STATE_H_.length); rg.setNumberFormat('@'); rg.setValues(out); SpreadsheetApp.flush();   // 10件ごとに保存
    Utilities.sleep(300);
  }
  var left = todo.length - n;
  return scLog_(fn, { status: left ? 'PARTIAL_RESUME_NEEDED' : 'OK', candidates: todo.length, checked: n, left: left, result: k, notVerifiedExamples: ex, ms: Date.now() - t0 });
}
function U1_公式URL_確認() { return ouCheck_('U1_公式URL_確認'); }
function U1T_公式URL_確認_試験20件() { return ouCheck_('U1T_公式URL_確認_試験20件', 0, 20); }
function ouApply_(env, fn) {   // 確認済み（VERIFIED）の URL を、公式個別URLが空で GUID が同じ行にだけ書く。書いた後に読み戻す
  var t0 = Date.now(), runId = new Date().toISOString() + '/OFFICIAL_URL', c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), target = env === 'V2' ? scOpen_(SC_CONFIG.v2WorkingId, '') : c, D = laRead_(target.sh);
  var st = c.ss.getSheetByName(OU_STATE_); if (!st || st.getLastRow() < 2) return scLog_(fn, { status: 'NO_VERIFIED', note: '先に U1_公式URL_確認' });
  var ok = {}; st.getRange(2, 1, st.getLastRow() - 1, OU_STATE_H_.length).getDisplayValues().forEach(function (r) { if (r[3] === 'VERIFIED') ok[r[1]] = r[2]; });
  var onsa = laOnsaAsahiByEp_(D.rows), col = D.I.url + 1, plan = D.rows.map(function (r) { return { r: r, c: laOfficialCandidate_(r, onsa) }; }).filter(function (x) { return x.r.ep && x.c.status === 'CANDIDATE' && !x.c.replaces && ok[x.c.key] && ok[x.c.key] === x.c.url; }).map(function (x) { return { row: x.r.row, ep: x.r.ep, url: x.c.url }; });
  if (!plan.length) return scLog_(fn, { status: 'OK_NO_CHANGE', env: env });
  var hs = c.ss.getSheetByName(OU_HIST_) || c.ss.insertSheet(OU_HIST_); if (hs.getLastRow() === 0) hs.getRange(1, 1, 1, OU_HIST_H_.length).setValues([OU_HIST_H_]);
  var h0 = hs.getLastRow() + 1, hr = plan.map(function (p) { return [runId, runId, env, p.ep, String(p.row), '', p.url, '予定']; }), hrg = hs.getRange(h0, 1, hr.length, OU_HIST_H_.length); hrg.setNumberFormat('@'); hrg.setValues(hr);   // 先に履歴
  var cur = target.sh.getRange(1, col, target.sh.getLastRow(), 1).getDisplayValues(), wrote = 0, skipped = 0;
  plan.forEach(function (p) { if (String(cur[p.row - 1][0]).trim()) { p.skip = true; skipped++; return; } target.sh.getRange(p.row, col).setValue(p.url); wrote++; });
  SpreadsheetApp.flush();
  var back = target.sh.getRange(1, col, target.sh.getLastRow(), 1).getDisplayValues(), bad = 0, stat = plan.map(function (p) { if (p.skip) return ['直前に値あり・書かず']; var okb = back[p.row - 1][0] === p.url; if (!okb) bad++; return [okb ? 'OK' : 'READBACK_MISMATCH']; });
  hs.getRange(h0, 8, stat.length, 1).setValues(stat);
  return scLog_(fn, { status: bad ? 'READBACK_MISMATCH' : 'OK', env: env, runId: runId, written: wrote, skippedBecauseFilled: skipped, readbackMismatch: bad, examples: plan.slice(0, 5).map(function (p) { return p.ep; }), ms: Date.now() - t0 });
}
function U2_公式URL補完_COPY() { return ouApply_('COPY', 'U2_公式URL補完_COPY'); }
function U0_承認_公式URL補完V2() { PropertiesService.getScriptProperties().setProperty('APPROVE_OFFICIAL_URL_V2', 'yes'); return scLog_('U0_承認_公式URL補完V2', { status: 'APPROVED' }); }
function U2_公式URL補完_V2() { if (PropertiesService.getScriptProperties().getProperty('APPROVE_OFFICIAL_URL_V2') !== 'yes') return scLog_('U2_公式URL補完_V2', { status: 'NOT_APPROVED', note: '先に U0_承認_公式URL補完V2' }); return ouApply_('V2', 'U2_公式URL補完_V2'); }
function U9_公式URL補完の取消() {   // 直前の実行（実行ID）で書いたセルを、今もその値のままの時だけ空に戻す。人が書き換えたセルは触らない
  var fn = 'U9_公式URL補完の取消', c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hs = c.ss.getSheetByName(OU_HIST_); if (!hs || hs.getLastRow() < 2) return scLog_(fn, { status: 'NO_HISTORY' });
  var hv = hs.getRange(2, 1, hs.getLastRow() - 1, OU_HIST_H_.length).getDisplayValues(), last = ''; hv.forEach(function (r) { if (r[7] === 'OK') last = r[1]; }); if (!last) return scLog_(fn, { status: 'NOTHING_TO_UNDO' });
  var env = hv.filter(function (r) { return r[1] === last; })[0][2], target = env === 'V2' ? scOpen_(SC_CONFIG.v2WorkingId, '') : c, D = laRead_(target.sh), col = D.I.url + 1, n = 0, kept = 0;
  hv.forEach(function (r, i) { if (r[1] !== last || r[7] !== 'OK') return; var row = Number(r[4]), cell = target.sh.getRange(row, col); if (cell.getDisplayValue() === r[6] && target.sh.getRange(row, D.I.ep + 1).getDisplayValue() === r[3]) { cell.setValue(''); hs.getRange(i + 2, 8).setValue('取消済み'); n++; } else kept++; });
  return scLog_(fn, { status: 'OK', runId: last, env: env, restored: n, keptBecauseChanged: kept });
}

// ---------- 関連記事索引（1記事1行の別シート） ----------
var RL_SHEET_V2_ = 'V2・関連記事索引', RL_SHEET_COPY_ = '関連記事索引(試験)', RL_BACKUP_ = '関連記事索引_直前';
// 再実行で毎回 changed:true になっていた原因（2026-11-13）: 見出しが「'」で始まる記事（EP-04536 「'ケヅレー一家'で…」）は、Sheets が先頭の ' を
// 文字列の印として消すため、読み戻すと1文字短くなり、毎回「違う」と判定していた（読み戻し検査は見出しを見ていなかったので 0 のままだった）。
// 修正: 書く時は sheetText（先頭 ' を二重にする）、比べる時は表示どおりの値（元の文字列）と全列を比べる。違いがあれば最初の10件をログに出す
var RL_CMP_COLS_ = [0, 1, 2, 3, 5, 6];
// 材料の台帳は常に V2（正本）を読む。COPY の統合台帳の関連記事URL列は古く（11/14 司令塔の直接照合で URL のある話が V2 4,935／COPY 2,495）、試験の材料にしない。
// COPY に書くのは試験用の索引シートだけ。R4 だけは COPY 台帳を材料にして差を見せる（src='COPY'）
function rlCompute_(env, src) {
  var pre = scPreservedRaw_(), E = piEnv_(env), L = laRead_((src === 'COPY' ? E : piEnv_('V2')).sh), rows = [], k = { eps: 0, withHeadline: 0, notFetched: 0, fromLedgerOnly: 0 };
  L.rows.forEach(function (r) { if (!r.ep) return; var raw = pre[r.ep] ? pre[r.ep].text : '', rel = raw ? CleanerV4.cleanV4(raw).related : []; var rr = LedgerAudit.relatedRows(r.ep, rel, r.related); if (rr.length) k.eps++; rr.forEach(function (x) { if (x[2] === '未取得') k.notFetched++; else k.withHeadline++; if (/^統合台帳/.test(x[5])) k.fromLedgerOnly++; }); rows = rows.concat(rr); });
  return { E: E, rows: rows, k: k };
}
function rlDiff_(cur, rows) {   // 表示どおりの値で全列比較
  var d = [], n = Math.max(cur.length, rows.length);
  for (var i = 0; i < n && d.length < 10; i++) { var a = cur[i], b = rows[i]; if (!a || !b) { d.push({ row: i + 2, field: !a ? '行が増える' : '行が減る', old: a ? a[0] + ' ' + a[3] : '', new: b ? b[0] + ' ' + b[3] : '' }); continue; }
    for (var j = 0; j < RL_CMP_COLS_.length; j++) { var c = RL_CMP_COLS_[j]; if (String(a[c]) !== String(b[c])) { d.push({ row: i + 2, ep: b[0], field: LedgerAudit.RELATED_HEADERS[c], old: String(a[c]).slice(0, 60), new: String(b[c]).slice(0, 60) }); break; } } }
  var diffCount = Math.abs(cur.length - rows.length); for (var x = 0; x < Math.min(cur.length, rows.length); x++) { for (var y = 0; y < RL_CMP_COLS_.length; y++) { if (String(cur[x][RL_CMP_COLS_[y]]) !== String(rows[x][RL_CMP_COLS_[y]])) { diffCount++; break; } } }
  return { count: diffCount, examples: d };
}
function rlBuild_(env, fn, dry) {
  var t0 = Date.now(), C = rlCompute_(env), E = C.E, rows = C.rows, k = C.k, H = LedgerAudit.RELATED_HEADERS;
  var name = env === 'V2' ? RL_SHEET_V2_ : RL_SHEET_COPY_, sh = E.ss.getSheetByName(name), cur = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getDisplayValues() : [];
  var df = rlDiff_(cur, rows), res = { env: env, rows: rows.length, episodes: k.eps, withHeadline: k.withHeadline, headlineNotFetched: k.notFetched, ledgerOnlyRows: k.fromLedgerOnly, changed: df.count > 0, changedRows: df.count, changeExamples: df.examples };
  if (dry || !df.count) return scLog_(fn, Object.assign({ status: dry ? 'DRYRUN_OK' : 'OK_NO_CHANGE', ms: Date.now() - t0 }, res));
  if (env === 'V2' && sh && sh.getLastRow() > 1) { var old = E.ss.getSheetByName(RL_BACKUP_); if (old) E.ss.deleteSheet(old); sh.copyTo(E.ss).setName(RL_BACKUP_); }
  sh = sh || E.ss.insertSheet(name); if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, H.length).setValues([H]);
  var before = sh.getLastRow(), tx = function (r, a, b) { return r.slice(a, b).map(LedgerAudit.sheetText); };
  for (var i = 0; i < rows.length; i += 5000) { var p = rows.slice(i, i + 5000); sh.getRange(2 + i, 1, p.length, 4).setNumberFormat('@').setValues(p.map(function (r) { return tx(r, 0, 4); })); sh.getRange(2 + i, 5, p.length, 1).setFormulas(p.map(function (r) { return [r[4]]; })); sh.getRange(2 + i, 6, p.length, 2).setNumberFormat('@').setValues(p.map(function (r) { return tx(r, 5, 7); })); }
  if (before > rows.length + 1) sh.getRange(rows.length + 2, 1, before - rows.length - 1, H.length).clearContent();
  sh.setFrozenRows(1); SpreadsheetApp.flush();
  var back = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getDisplayValues() : [], bad = rlDiff_(back, rows);   // 読み戻しも全列（表示どおり）
  return scLog_(fn, Object.assign({ status: bad.count ? 'READBACK_MISMATCH' : 'OK', readbackMismatch: bad.count, readbackExamples: bad.examples, ms: Date.now() - t0 }, res));
}
// 差の監査（読むだけ）: V2 の台帳から作る索引と COPY の台帳から作る索引を、EP-ID・記事URL 単位で比べ、COPY の「関連記事索引_差分」に書く
function R4_関連記事索引_V2とCOPYの差() {
  var t0 = Date.now(), a = rlCompute_('V2', 'V2'), b = rlCompute_('COPY', 'COPY'), key = function (r) { return r[0] + '\u0001' + LedgerAudit.articleKey(r[3]); }, A = {}, B = {};
  a.rows.forEach(function (r) { A[key(r)] = r; }); b.rows.forEach(function (r) { B[key(r)] = r; });
  var lv = {}, lc = {}; laRead_(a.E.sh).rows.forEach(function (r) { lv[r.ep] = r.related; }); laRead_(b.E.sh).rows.forEach(function (r) { lc[r.ep] = r.related; });
  var out = [];
  b.rows.forEach(function (r) { if (!A[key(r)]) out.push(['COPYだけ', r[0], r[3], r[2], r[5], String(lv[r[0]] === undefined ? '(V2に行なし)' : lv[r[0]]).slice(0, 300), String(lc[r[0]] || '').slice(0, 300)]); });
  a.rows.forEach(function (r) { if (!B[key(r)]) out.push(['V2だけ', r[0], r[3], r[2], r[5], String(lv[r[0]] || '').slice(0, 300), String(lc[r[0]] === undefined ? '(COPYに行なし)' : lc[r[0]]).slice(0, 300)]); });
  var epA = {}, epB = {}; a.rows.forEach(function (r) { epA[r[0]] = 1; }); b.rows.forEach(function (r) { epB[r[0]] = 1; });
  var epOnlyCopy = Object.keys(epB).filter(function (e) { return !epA[e]; }), epOnlyV2 = Object.keys(epA).filter(function (e) { return !epB[e]; });
  laWriteSheet_(b.E.ss, '関連記事索引_差分', ['側', 'EP-ID', '記事URL', '見出し', '出典', 'V2 台帳の関連記事URL', 'COPY 台帳の関連記事URL'], out);
  var bySrc = {}; out.forEach(function (o) { var kk = o[0] + '・' + o[4]; bySrc[kk] = (bySrc[kk] || 0) + 1; });
  return scLog_('R4_関連記事索引_V2とCOPYの差', { status: 'OK', v2Rows: a.rows.length, copyRows: b.rows.length, diffRows: out.length, bySideAndSource: bySrc, episodesOnlyCopy: epOnlyCopy, episodesOnlyV2: epOnlyV2, examples: out.slice(0, 8).map(function (o) { return o[0] + ' ' + o[1] + ' ' + o[2]; }), wroteTo: 'COPY「関連記事索引_差分」', ms: Date.now() - t0 });
}
function R1_関連記事索引_予行() { return rlBuild_('V2', 'R1_関連記事索引_予行', true); }
function R2_関連記事索引_COPY作成() { return rlBuild_('COPY', 'R2_関連記事索引_COPY作成'); }
function R0_承認_関連記事索引V2() { PropertiesService.getScriptProperties().setProperty('APPROVE_RELATED_INDEX_V2', 'yes'); return scLog_('R0_承認_関連記事索引V2', { status: 'APPROVED' }); }
function R3_関連記事索引_V2作成() { if (PropertiesService.getScriptProperties().getProperty('APPROVE_RELATED_INDEX_V2') !== 'yes') return scLog_('R3_関連記事索引_V2作成', { status: 'NOT_APPROVED', note: '先に R0_承認_関連記事索引V2' }); return rlBuild_('V2', 'R3_関連記事索引_V2作成'); }
function R9_関連記事索引_直前に戻す() {
  var fn = 'R9_関連記事索引_直前に戻す'; if (PropertiesService.getScriptProperties().getProperty('APPROVE_RELATED_INDEX_V2') !== 'yes') return scLog_(fn, { status: 'NOT_APPROVED' });
  var E = piEnv_('V2'), bk = E.ss.getSheetByName(RL_BACKUP_); if (!bk) return scLog_(fn, { status: 'NO_BACKUP', note: '初回作成の取消は V2・関連記事索引 シートを削除するだけでよい（台帳は変えていない）' });
  var sh = E.ss.getSheetByName(RL_SHEET_V2_); if (sh) E.ss.deleteSheet(sh); bk.copyTo(E.ss).setName(RL_SHEET_V2_);
  return scLog_(fn, { status: 'OK' });
}

// =====================================================================
// 全台帳の統合監査（2026-11-14 司令塔「持続可能な運用」パッケージA）。L1（構造点検）は既存の L1_台帳総合監査 を使う。
// L2 差分監査: 旧公開図書館（GitHub Pages の公開JSON）・V2・旧本番59列台帳を EP-ID と GUID で突き合わせる。どれにも書かない（結果は COPY の「監査・…」だけ）
// L3 公式・音声: 追加候補の公式個別ページ（canonical の itemid 一致）と音声（HTTP・Content-Type・長さ）を確かめる。途中で止まっても続きから
// L4 採否集計: L2 と L3 から採否案と「公開できる数」を計算し、計算式が合わない時は該当 EP を全部出す
// =====================================================================
var LA2_PUBLIC_BASE_ = 'https://neyito96.github.io/asarisunowa/library/data/', LA2_V1_ID_ = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
var LA2_SHEET_ = '監査・全台帳差分', LA2_SUM_ = '監査・全台帳集計', LA3_SHEET_ = '監査・公式音声確認', LA4_SHEET_ = '監査・採否集計';
function la2OldPublic_() {   // 公開中の図書館（GitHub Pages）を読む
  var man = JSON.parse(UrlFetchApp.fetch(LA2_PUBLIC_BASE_ + 'manifest.json', { muteHttpExceptions: true }).getContentText()), out = [];
  var pages = man.pages || [];
  for (var i = 0; i < pages.length; i += 20) { UrlFetchApp.fetchAll(pages.slice(i, i + 20).map(function (p) { return { url: LA2_PUBLIC_BASE_ + p, muteHttpExceptions: true }; })).forEach(function (r) { if (r.getResponseCode() !== 200) throw new Error('PUBLIC_PAGE_FETCH_FAILED ' + r.getResponseCode()); out = out.concat(JSON.parse(r.getContentText())); }); }
  if (out.length !== man.total) throw new Error('PUBLIC_COUNT_MISMATCH manifest=' + man.total + ' pages=' + out.length);
  return { rows: out, manifest: { generatedAt: man.generatedAt, snapshotDate: man.snapshotDate, total: man.total } };
}
function la2V1ReadOnly_() {   // 旧本番59列台帳を読むだけ（getValues だけ。書込・挿入・削除は一切しない）
  var ss = SpreadsheetApp.openById(LA2_V1_ID_), sh = null;
  ss.getSheets().some(function (s) { if (s.getLastRow() > 1 && s.getRange(1, 1, 1, Math.min(60, s.getLastColumn())).getDisplayValues()[0].indexOf('台帳ID') >= 0) { sh = s; return true; } return false; });
  if (!sh) throw new Error('V1_LEDGER_SHEET_NOT_FOUND');
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(), h = v[0], c = function (n, d) { var i = h.indexOf(n); return i >= 0 ? i : d; };
  var I = { id: c('台帳ID'), show: c('番組名'), title: c('タイトル'), date: c('配信日時（JST）'), guid: h.findIndex(function (x) { return /GUID/i.test(x); }), ex: c('人間除外') };
  var hist = ss.getSheets().filter(function (s) { return /新着受入履歴/.test(s.getName()); })[0];
  return { sheet: sh.getName(), rows: v.slice(1).map(function (r) { return { id: r[I.id], show: r[I.show], title: r[I.title], date: r[I.date], guid: I.guid >= 0 ? r[I.guid] : '', excluded: I.ex >= 0 && /除外|^TRUE$|^true$|^1$/.test(String(r[I.ex])) }; }), intakeHistoryRows: hist ? Math.max(0, hist.getLastRow() - 1) : null };
}
function L2_全台帳_差分監査() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), D = laRead_(v.sh), old = la2OldPublic_(), v1 = la2V1ReadOnly_();
  var r = LedgerAudit.ledgerDiff({ oldPub: old.rows, v2: D.rows, v1: v1.rows, since: '2026-11-13' });
  laWriteSheet_(c.ss, LA2_SHEET_, LedgerAudit.LEDGER_DIFF_HEADERS, r.rows);
  var om = { count: { note: 'おんさ共有台帳を読めなかった' } }; try { om = LedgerAudit.onsaMatch(D.rows, laOnsaReadOnly_()); laWriteSheet_(c.ss, LA_ONSA_SHEET_, LedgerAudit.ONSA_MATCH_HEADERS, om.rows); } catch (e) { om.count.error = String(e).slice(0, 120); }
  var snap = new Date().toISOString(), sum = [['実行日時', snap], ['旧公開（GitHub Pages）', old.manifest.total + '（生成 ' + old.manifest.generatedAt + '・基準日 ' + old.manifest.snapshotDate + '）'], ['V2 統合台帳の行', D.rows.length], ['V2 公開候補（対象かつ代表EP）', r.n.v2Public], ['旧本番台帳の行（' + v1.sheet + '）', v1.rows.length], ['旧本番 新着受入履歴の行', v1.intakeHistoryRows === null ? 'シートなし' : v1.intakeHistoryRows], ['両方にある公開EP', r.n.both], ['V2で追加', r.n.added], ['旧公開だけ', r.n.oldOnly]]
    .concat(Object.keys(r.equation).map(function (k) { return ['計算式: ' + k, r.equation[k] ? '一致' : '不一致']; })).concat(Object.keys(r.count).sort().map(function (k) { return [k, r.count[k]]; })).concat(Object.keys(om.count).map(function (k) { return ['おんさ照合: ' + k, om.count[k]]; }));
  laWriteSheet_(c.ss, LA2_SUM_, ['項目', '値'], sum);
  return scLog_('L2_全台帳_差分監査', { status: Object.keys(r.equation).every(function (k) { return r.equation[k]; }) ? 'OK' : 'EQUATION_MISMATCH', counts: r.n, equation: r.equation, kinds: r.count, onsa: om.count, wroteTo: 'COPY「' + LA2_SHEET_ + '」「' + LA2_SUM_ + '」（V1・V2・公開には書いていない）', ms: Date.now() - t0 });
}
// ---------- おんさ共有台帳（朝ポキ出演者 共同編集用・永久 READ ONLY）。getValues だけ ----------
var LA_ONSA_ID_ = '1CvRyWLQb7YyonGyRSNKtc_liRrgtiWE5yDGI3R48Xfk', LA_ONSA_SKIP_ = /^(YouTube|出演者|記者ページ|プレイリスト|朝ポキメンバー)$/, LA_ONSA_SHEET_ = '監査・おんさ照合', laOnsaCache_ = null;
function laOnsaReadOnly_() {
  if (laOnsaCache_) return laOnsaCache_;
  var out = [];
  SpreadsheetApp.openById(LA_ONSA_ID_).getSheets().forEach(function (sh) {
    if (LA_ONSA_SKIP_.test(sh.getName()) || sh.getLastRow() < 3) return;
    var v = sh.getRange(1, 1, sh.getLastRow(), Math.min(14, sh.getLastColumn())).getDisplayValues(), h = v[0].map(function (x) { return String(x).toLowerCase(); });
    var c = function (re, d) { var i = h.findIndex(function (x) { return re.test(x); }); return i >= 0 ? i : d; }, A = c(/omny/, 0), D = c(/日付/, 1), T = c(/タイトル/, 2), S = 3, SP = c(/spotify/, 11), AS = c(/asahi/, 12);
    v.slice(2).forEach(function (r, i) { if (r[A] || r[AS] || r[SP]) out.push({ sheet: sh.getName(), row: i + 3, omny: r[A], date: r[D], title: r[T], seconds: r[S], spotify: r[SP], asahi: r[AS] }); });
  });
  laOnsaCache_ = out; return out;
}
function laOnsaAsahiByEp_(rows) {   // EP-ID → おんさの Asahi.com URL（識別子で一致した行だけ）。おんさが読めない時は空（止めない）
  try { var m = {}; LedgerAudit.onsaMatch(rows, laOnsaReadOnly_()).rows.forEach(function (x) { if (x[0] && /^一致/.test(x[1]) && x[8]) m[x[0]] = x[8]; }); return m; } catch (e) { console.log('ONSA_READ_FAILED ' + e); return {}; }
}
function laOfficialCandidate_(r, onsaMap) { return LedgerAudit.officialUrlCandidate({ officialUrl: r.officialUrl, guid: r.guid, audioUrl: r.audioUrl, onsaAsahiUrl: (onsaMap || {})[r.ep] || '' }); }

var LA3_H_ = ['EP-ID', '監査区分', '照合した公式URL', '公式ページ', '公式ページの理由', '音声URL', '音声', '音声の理由', 'Content-Type', 'Content-Length', '再生時間 秒', '比較相手EP-ID', '相手の再生時間 秒', '相手の音声 Content-Length', 'おんさ照合', '確認日時'];
function la3Audio_(url) {   // 音声の実在: 先頭2バイトだけ取る（Range）。200/206 で audio/* なら AUDIO_OK（再生の確認ではない。応答と形式の確認）
  if (!/^https:\/\//.test(String(url || ''))) return { status: 'NO_AUDIO_URL' };
  try { var r = laFetchRetry_(url, { muteHttpExceptions: true, followRedirects: true, headers: { Range: 'bytes=0-1' } }), code = r.getResponseCode(), h = r.getHeaders() || {}, ct = String(h['Content-Type'] || h['content-type'] || ''), cr = String(h['Content-Range'] || h['content-range'] || ''), len = cr.split('/')[1] || String(h['Content-Length'] || h['content-length'] || '');
    if ((code === 200 || code === 206) && /^audio\/|mpeg|mp4|octet-stream/i.test(ct)) return { status: 'AUDIO_OK', reason: 'HTTP_' + code, ct: ct, len: len };
    return { status: code === 404 || code === 410 ? 'NOT_FOUND' : 'NG', reason: 'HTTP_' + code, ct: ct, len: len };
  } catch (e) { return { status: 'ERROR', reason: String(e && e.message || e).slice(0, 100) }; }
}
// 監査の対象（EP-ID で重複を除く）: L2 の「V2にあり旧公開にない」213件前後・V2 の保留・未判定・対象外（10/22 の重複判定）・旧公開にありV2で非公開。
// ほかに、おんさにあって台帳に無い行（EP-ID なし）も「ONSA:シート:行」として公式ページを確かめる
function la3Candidates_(c, D) {
  var by = {}, cand = {}, add = function (ep, label, other) { var x = cand[ep] = cand[ep] || { ep: ep, labels: [], other: '' }; if (x.labels.indexOf(label) < 0) x.labels.push(label); if (other && !x.other) x.other = other; };
  D.rows.forEach(function (r) { by[r.ep] = r; });
  var l2 = c.ss.getSheetByName(LA2_SHEET_); if (l2 && l2.getLastRow() > 1) l2.getRange(2, 1, l2.getLastRow() - 1, LedgerAudit.LEDGER_DIFF_HEADERS.length).getDisplayValues().forEach(function (r) { if (/^V2にあり旧公開にない/.test(r[1])) add(r[0], r[1], String(r[17] || '').split(' ')[0]); else if (/^旧公開にありV2で非公開/.test(r[1])) add(r[0], '旧公開にありV2で非公開', r[17]); });
  D.rows.forEach(function (r) { if (!r.ep) return; if (r.judge === '保留') add(r.ep, 'V2保留'); else if (r.judge === '未判定' || !r.judge) add(r.ep, 'V2未判定'); else if (r.judge === '対象外') add(r.ep, 'V2対象外（10/22の重複判定）', r.rep && r.rep !== r.ep ? r.rep : ''); });
  var os = c.ss.getSheetByName(LA_ONSA_SHEET_); if (os && os.getLastRow() > 1) os.getRange(2, 1, os.getLastRow() - 1, LedgerAudit.ONSA_MATCH_HEADERS.length).getDisplayValues().forEach(function (r) { if (r[1] === 'おんさにあり台帳に無い') { var id = 'ONSA:' + r[3] + ':' + r[4]; cand[id] = { ep: id, labels: ['おんさにあり台帳に無い'], other: '', onsa: { sheet: r[3], title: r[5], date: r[6], asahi: r[8], seconds: r[7] } }; } });
  return { by: by, list: Object.keys(cand).sort().map(function (k) { return cand[k]; }) };
}
function L3_公式音声_確認() { return la3Run_('L3_公式音声_確認', LA3_SHEET_, null); }   // V2・おんさは読むだけ。確かめた結果を COPY に書き足す（済みは取り直さない。ERROR は次回もう一度）
// L3R（2026-11-14 司令塔「公式候補なし82件と番組照合9件の修正を対象限定で再測定」）: 元の L3 結果で「候補なし」「番組不一致（記事）」だった行だけを、
//   別シート「監査・L3再確認」に取り直す。元の L3 シートは書き換えない。V2・おんさは読むだけ。
var LA3R_SHEET_ = '監査・L3再確認';
function L3R_対象限定_再確認() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), st = c.ss.getSheetByName(LA3_SHEET_); if (!st || st.getLastRow() < 2) return scLog_('L3R_対象限定_再確認', { status: 'NO_L3' });
  var only = {}, why = { NO_OFFICIAL_URL: 0, SHOW_MISMATCH_ARTICLE: 0 };
  st.getRange(2, 1, st.getLastRow() - 1, LA3_H_.length).getDisplayValues().forEach(function (r) { if (r[3] === 'NO_OFFICIAL_URL') { only[r[0]] = 1; why.NO_OFFICIAL_URL++; } else if (/SHOW/.test(r[3] + ' ' + r[4]) && /記事/.test(r[4])) { only[r[0]] = 1; why.SHOW_MISMATCH_ARTICLE++; } });
  return la3Run_('L3R_対象限定_再確認', LA3R_SHEET_, only, why);
}
function la3Run_(name, sheetName, only, why) {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), D = laRead_(v.sh);
  if (!c.ss.getSheetByName(LA2_SHEET_)) return scLog_(name, { status: 'NO_L2', note: '先に L2_全台帳_差分監査' });
  var C = la3Candidates_(c, D), onsa = laOnsaAsahiByEp_(D.rows);
  var st = c.ss.getSheetByName(sheetName) || c.ss.insertSheet(sheetName); if (st.getLastRow() === 0) st.getRange(1, 1, 1, LA3_H_.length).setValues([LA3_H_]);
  var done = {}; if (st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, LA3_H_.length).getDisplayValues().forEach(function (r) { if (r[3] !== 'ERROR' && r[6] !== 'ERROR') done[r[0]] = 1; });
  var todo = C.list.filter(function (x) { return !done[x.ep] && (!only || only[x.ep]); }), n = 0, k = {}, buf = [], flush = function () { if (!buf.length) return; var r0 = st.getLastRow() + 1; st.getRange(r0, 1, buf.length, LA3_H_.length).setNumberFormat('@').setValues(buf); buf = []; SpreadsheetApp.flush(); };
  for (var i = 0; i < todo.length; i++) {
    if (Date.now() - t0 > 240000) break;
    var x = todo[i], r = C.by[x.ep] || { _r: [], title: x.onsa ? x.onsa.title : '' }, cand = x.onsa ? { status: LedgerAudit.officialItemId(x.onsa.asahi) ? 'CANDIDATE' : 'NO_GUID', url: x.onsa.asahi, key: LedgerAudit.officialItemId(x.onsa.asahi) } : (LedgerAudit.officialItemId(r.officialUrl) ? { status: 'CANDIDATE', url: r.officialUrl, key: LedgerAudit.officialItemId(r.officialUrl) } : laOfficialCandidate_(r, onsa));
    var page = { status: 'NO_OFFICIAL_URL', reason: '候補なし（GUID・配信ID・おんさ記録なし）' };
    if (cand.status === 'CANDIDATE') { var f = ouFetchOne_(cand.url); page = f.error ? { status: 'ERROR', reason: f.error } : (f.code >= 300 && f.code < 400 ? { status: 'HOLD', reason: 'REDIRECT ' + (f.location || '') } : LedgerAudit.verifyOfficialPage(f.code, f.html, cand.key, r.title, { show: x.onsa ? x.onsa.sheet : r.show, date: x.onsa ? x.onsa.date : r.date })); }
    var au = x.onsa ? { status: 'NO_AUDIO_URL', reason: '台帳に行が無い' } : la3Audio_(r.audioUrl), o = x.other ? C.by[x.other] : null, oa = o ? la3Audio_(o.audioUrl) : null;
    buf.push([x.ep, x.labels.join('・'), cand.url || '', page.status, (page.reason || '') + (cand.kind ? ' [' + cand.kind + ']' : ''), r.audioUrl || '', au.status, au.reason || '', au.ct || '', au.len || '', r.seconds || (x.onsa ? x.onsa.seconds : ''), x.other || '', o ? o.seconds : '', oa ? oa.len || '' : '', onsa[x.ep] ? 'おんさと一致（Asahi URLあり）' : '', new Date().toISOString()]);
    k[page.status + '/' + au.status] = (k[page.status + '/' + au.status] || 0) + 1; n++;
    if (buf.length >= 10) flush();
  }
  flush();
  var labels = {}; C.list.forEach(function (x) { x.labels.forEach(function (l) { labels[l] = (labels[l] || 0) + 1; }); });
  return scLog_(name, { status: todo.length - n ? 'PARTIAL_RESUME_NEEDED' : 'OK', candidates: C.list.length, targets: only ? Object.keys(only).length : undefined, targetWhy: why, byLabel: labels, checked: n, left: todo.length - n, result: k, ms: Date.now() - t0 });
}
function L4_採否_集計レポート() {   // 読むだけ（COPY の L2・L3 と V2 作業用台帳から計算し、COPY に書く）。根拠が足りない回は HOLD のまま
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), l3 = c.ss.getSheetByName(LA3_SHEET_), sumSh = c.ss.getSheetByName(LA2_SUM_);
  if (!sumSh || sumSh.getLastRow() < 2) return scLog_('L4_採否_集計レポート', { status: 'NO_L2' });
  var by = {}; laRead_(scOpen_(SC_CONFIG.v2WorkingId, '').sh).rows.forEach(function (r) { by[r.ep] = r; });
  var sv = {}; sumSh.getRange(2, 1, sumSh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) { sv[r[0]] = r[1]; });
  var L3 = l3 && l3.getLastRow() > 1 ? l3.getRange(2, 1, l3.getLastRow() - 1, LA3_H_.length).getDisplayValues() : [], last = {}; L3.forEach(function (r) { last[r[0]] = r; });
  var out = [], k = {}, cnt = function (key) { k[key] = (k[key] || 0) + 1; };
  // 重複（同じ回）の確定条件: 番組が同じ・タイトル（「再」等を除いた題）が同じ・自分の公式ページが VERIFIED・再生時間±2秒・音声の長さ一致。
  // 再生時間と音声の長さだけ一致しても確定しない（HOLD・理由に一致した項目を書く）
  var dupCheck = function (x) {
    var me = by[x[0]] || {}, ot = by[x[11]] || {}, m = [], miss = [];
    (x[10] && x[12] && Math.abs(Number(x[10]) - Number(x[12])) <= 2 ? m : miss).push('再生時間±2秒');
    (x[9] && x[13] && x[9] === x[13] ? m : miss).push('音声の長さ');
    (me.show && me.show === ot.show ? m : miss).push('番組');
    (me.title && ot.title && LedgerAudit.rerunBaseTitle(me.title) === LedgerAudit.rerunBaseTitle(ot.title) ? m : miss).push('タイトル');
    (x[3] === 'VERIFIED' ? m : miss).push('公式ページ');
    return { all: !miss.length, why: '一致=' + (m.join('・') || 'なし') + (miss.length ? '／不一致・未確認=' + miss.join('・') : '') };
  };
  Object.keys(last).sort().forEach(function (ep) {
    var x = last[ep], lab = x[1], pageOk = x[3] === 'VERIFIED', audioOk = x[6] === 'AUDIO_OK', err = x[3] === 'ERROR' || x[6] === 'ERROR';
    var verdict = 'HOLD', why = '公式ページ=' + x[3] + '・音声=' + x[6];
    if (err) verdict = 'ERROR';
    else if (/再配信|対象外（10\/22の重複判定）/.test(lab)) {
      if (!x[11]) why = '比較相手（原回・代表EP）が無い。司令塔の判断待ち';
      else { var d = dupCheck(x); why = '相手 ' + x[11] + '：' + d.why; verdict = d.all ? (/再配信/.test(lab) ? 'DUPLICATE（統合案）' : 'DUPLICATE（10/22判定を裏付け）') : 'HOLD'; }
    }
    else if (/おんさにあり台帳に無い/.test(lab)) { verdict = pageOk ? '未収蔵候補（公式ページあり）' : 'HOLD'; why = pageOk ? '公式ページでID・タイトル・番組・配信日を確認。台帳への収蔵は別承認' : 'おんさの記録だけでは実在を確定しない（' + x[4] + '）'; }
    else if (pageOk && audioOk) { verdict = /V2保留|V2未判定/.test(lab) ? 'HOLD解消候補（採用案）' : 'VERIFIED'; why = '公式ページ（ID・タイトル・番組・配信日）と音声の応答を確認'; }
    else why += '（' + x[4] + '）';
    cnt(verdict); out.push([ep, lab, verdict, why, x[2], x[3], x[6]]);
  });
  laWriteSheet_(c.ss, LA4_SHEET_, ['EP-ID', '監査区分', '採否案', '根拠', '照合した公式URL', '公式ページ', '音声'], out);
  var both = Number(sv['両方にある公開EP'] || 0), verifiedAdded = out.filter(function (r) { return r[2] === 'VERIFIED' && /V2にあり旧公開にない/.test(r[1]); }).length;
  return scLog_('L4_採否_集計レポート', { status: 'OK', oldPublic: sv['旧公開（GitHub Pages）'], v2Public: sv['V2 公開候補（対象かつ代表EP）'], both: both, checkedEpisodes: out.length, verdicts: k, publishableIfApproved: both + verifiedAdded,
    formula: '公開できる数 = 両方にある公開EP(' + both + ') + 追加のうち VERIFIED(' + verifiedAdded + ')。HOLD解消候補・未収蔵候補・統合案はすべて人の承認待ち', wroteTo: 'COPY「' + LA4_SHEET_ + '」' });
}
// ---------- E1 予行（読むだけ）: V2 統合台帳＋人物索引（＋関連記事索引があれば）から公開図書館データを作り、公開中のデータと EP-ID 単位で比べる ----------
// 作るだけで公開しない。結果は COPY「E1・予行差分」。旧公開に無い回は L4 で VERIFIED のものだけ採用候補にする（それ以外は保留）
function E1_V2公開データ_予行() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), old = la2OldPublic_();
  var ledger = v.sh.getRange(1, 1, v.sh.getLastRow(), v.sh.getLastColumn()).getDisplayValues().filter(function (r, i) { return i === 0 || r[0]; });
  var pi = v.ss.getSheetByName(PI_SHEET_V2_), persons = pi ? pi.getRange(1, 1, pi.getLastRow(), PersonIndex.PERSON_INDEX_HEADERS.length).getDisplayValues() : [];
  var rl = v.ss.getSheetByName(RL_SHEET_V2_), related = rl && rl.getLastRow() > 1 ? rl.getRange(1, 1, rl.getLastRow(), LedgerAudit.RELATED_HEADERS.length).getDisplayValues() : [];
  var allow = {}, l4 = c.ss.getSheetByName(LA4_SHEET_); if (l4 && l4.getLastRow() > 1) l4.getRange(2, 1, l4.getLastRow() - 1, 3).getDisplayValues().forEach(function (r) { if (r[2] === 'VERIFIED') allow[r[0]] = 1; });
  var prevIds = {}, audioPrev = {}; old.rows.forEach(function (e) { prevIds[e.id] = 1; if (e.audio) audioPrev[e.id] = 1; });
  var h = ledger[0], A = h.indexOf('音声URL'), verifiedAudio = {}; ledger.slice(1).forEach(function (r) { if (audioPrev[r[0]] && r[A]) verifiedAudio[r[0]] = { url: r[A] }; });   // 旧公開で再生できた回は、同じ音声URLなら確認済みを引き継ぐ
  var l3 = c.ss.getSheetByName(LA3_SHEET_); if (l3 && l3.getLastRow() > 1) l3.getRange(2, 1, l3.getLastRow() - 1, LA3_H_.length).getDisplayValues().forEach(function (r) { if (r[6] === 'AUDIO_OK' && r[5]) verifiedAudio[r[0]] = { url: r[5] }; });
  var res = V2LibCore.buildV2Library({ ledger: ledger, persons: persons, related: related, previousPublicIds: new Set(Object.keys(prevIds)), verifiedAudio: verifiedAudio, newEpisodeAllowList: new Set(Object.keys(allow)), decidedAt: new Date().toISOString(), hash: p25v2GasSha256_ });
  var d = V2LibCore.compareWithPublic(res.episodes, old.rows), rows = [];
  d.added.forEach(function (id) { rows.push([id, '追加', '', '']); }); d.removed.forEach(function (id) { var a = res.audit.filter(function (x) { return x.id === id; })[0]; rows.push([id, '削除', '', a ? a.publication + '/' + a.classification + ' ' + a.why : 'V2に行なし']); });
  d.changed.forEach(function (x) { rows.push([x.id, '変更', x.fields.join('・'), '']); });
  res.audit.filter(function (a) { return a.publication !== '対象' && a.previous === '非公開' && (a.classification !== '通常'); }).forEach(function (a) { rows.push([a.id, a.publication, a.classification, a.why]); });
  laWriteSheet_(c.ss, 'E1・予行差分', ['EP-ID', '区分', '変わる項目・分類', '理由'], rows);
  var fields = {}; d.changed.forEach(function (x) { x.fields.forEach(function (f) { fields[f] = (fields[f] || 0) + 1; }); });
  return scLog_('E1_V2公開データ_予行', { status: d.removed.length ? 'HAS_REMOVALS' : 'DRYRUN_OK', publicNow: old.manifest.total, adopted: res.scope.adopted, held: res.scope.held, excluded: res.scope.excluded, added: d.added.length, removed: d.removed.length, changed: d.changed.length, changedFields: fields, unchanged: d.same,
    relatedSource: related.length ? 'V2・関連記事索引' : '統合台帳の関連記事URL（見出しなし・V2索引が未作成のため）', scopeVersion: res.scope.version.slice(0, 16), wroteTo: 'COPY「E1・予行差分」（公開・main・V2には書いていない）', ms: Date.now() - t0 });
}

// ---------- 運用ダッシュボード（COPY「運用ダッシュボード」に1回1行。日次の結果と止まった理由が一目で分かる） ----------
function laDashboard_(fn, status, steps) {
  try { var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), H = ['日時', '処理', '結果', '各工程'], sh = c.ss.getSheetByName('運用ダッシュボード') || c.ss.insertSheet('運用ダッシュボード');
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, H.length).setValues([H]);
    sh.getRange(sh.getLastRow() + 1, 1, 1, H.length).setNumberFormat('@').setValues([[new Date().toISOString(), fn, String(status), JSON.stringify(steps || {}).slice(0, 4000)]]);
  } catch (e) { console.log('DASHBOARD_WRITE_FAILED ' + e); }   // 記録の失敗で本処理を止めない
}

// ---------- K1 空欄棚卸し（読むだけ）: 項目ごとに「空欄の理由」と「埋める方法」を分類する。推測で埋めない ----------
var K1_SUM_ = '監査・空欄棚卸し', K1_ROWS_ = '監査・空欄個票';
function K1_空欄棚卸し() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), D = laRead_(v.sh), h = D.h, col = function (n) { return h.indexOf(n); };
  var pub = function (r) { return r.ep && r.judge === '対象' && r.rep === r.ep; }, pre = scPreservedRaw_();
  var readMap = function (ss, name, keyCol, valCols) { var sh = ss.getSheetByName(name), m = {}; if (!sh || sh.getLastRow() < 2) return m; var vv = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(), hh = vv[0], k = hh.indexOf(keyCol); vv.slice(1).forEach(function (r) { m[r[k]] = valCols.map(function (n) { return r[hh.indexOf(n)]; }); }); return m; };
  var det = readMap(v.ss, SC_V2DETAIL_, 'EP-ID', ['判定', '理由', '原文状態']), pst = readMap(v.ss, PI_STATE_, 'EP-ID', ['状態']), ou = readMap(c.ss, OU_STATE_, '公式GUID', ['状態', '理由']);
  var rl = {}, rsh = v.ss.getSheetByName(RL_SHEET_V2_); if (rsh && rsh.getLastRow() > 1) rsh.getRange(2, 1, rsh.getLastRow() - 1, 3).getDisplayValues().forEach(function (r) { var o = rl[r[0]] = rl[r[0]] || { n: 0, nt: 0 }; o.n++; if (r[2] === '未取得') o.nt++; });
  var PLAT = { Spotify: '補完器（#280）未接続のため未処理', Apple: '#280 の GUID 照合待ち', Amazon: '公開の取得経路が未確認（作らない）', 'Pocket Casts': '補完器（#280）未接続のため未処理', LISTEN: '補完器（#280）未接続のため未処理', Pody: '公開の取得経路が未確認（作らない）' };
  var cells = [], sum = {}, tally = function (field, state, cause, how, r) { var k = field + '｜' + state + '｜' + cause; sum[k] = sum[k] || { field: field, state: state, cause: cause, how: how, all: 0, pub: 0 }; sum[k].all++; if (pub(r)) sum[k].pub++; if (state !== '入力あり' && pub(r)) cells.push([r.ep, r.row, field, cause, how]); };
  D.rows.forEach(function (r) { if (!r.ep) return; var R = r._r, raw = pre[r.ep], dt = det[r.ep];
    tally('概要原文', raw ? '入力あり' : '空欄', raw ? '' : '保全原文なし（RSS に無い回・未保全）', raw ? '' : 'S5B で保全（RSS に残っている回だけ）', r);
    var clean = String(R[col('概要（清掃済）')] || '').trim();
    tally('概要（清掃済）', clean ? '入力あり' : '空欄', clean ? '' : !raw ? '原文が無い' : dt ? '清掃判定=' + dt[0] : '清掃未実施', clean ? '' : raw ? 'S6A→S6B（日次 D2）' : '原文の保全が先', r);
    var cast = String(R[col('出演者')] || '').trim(), ps = (pst[r.ep] || [''])[0];
    tally('出演者', cast ? '入力あり' : '空欄', cast ? '' : ps === '原文に人名なし' ? '原文に人名なし（空欄が正しい）' : ps === '原文なし' ? '原文なし' : ps ? '索引=' + ps : '人物索引が未処理', cast ? '' : ps === '原文に人名なし' ? '不要' : 'P5（日次 D2）・C2', r);
    var rel = String(R[col('関連記事URL')] || '').trim(), ri = rl[r.ep];
    tally('関連記事', rel || ri ? '入力あり' : '空欄', rel || ri ? '' : raw ? '原文に関連記事なし（空欄が正しい可能性）' : '原文なし', rel || ri ? '' : '不要または原文の保全が先', r);
    if (ri && ri.nt) tally('関連記事の見出し', '一部未取得', '原文に見出しが無い記事', '作らない（URL だけ表示）', r);
    var off = String(r.officialUrl || '').trim(), oc = LedgerAudit.officialUrlCandidate(r), os = ou[oc.guid];
    tally('公式個別URL', off ? '入力あり' : '空欄', off ? '' : oc.status === 'NO_GUID' ? 'GUIDなし' : !os ? '未確認' : os[0] === 'VERIFIED' ? '確認済み・書込待ち' : os[0] === 'NOT_FOUND' ? '公式ページなし（404）' : os[0] + ' ' + os[1], off ? '' : oc.status === 'NO_GUID' ? 'GUID 補完（G系）が先' : !os ? 'U1' : os[0] === 'VERIFIED' ? 'U2（承認後）' : os[0] === 'NOT_FOUND' ? '作らない' : 'U1 再実行', r);
    Object.keys(PLAT).forEach(function (p) { var j = col(p); if (j < 0) return; var u = R[j], k = LedgerAudit.classifyPlatformUrl(p, u);
      tally(p, k === 'EMPTY' ? '空欄' : k === 'EPISODE' ? '入力あり' : '要確認', k === 'EMPTY' ? PLAT[p] : k === 'EPISODE' ? '' : k === 'SHOW_TOP' ? '番組トップURL（個別EPではない）' : '形が不明', k === 'EMPTY' ? '#280 の工程' : k === 'EPISODE' ? '' : '人が確認', r); });
    tally('掲載判定', r.judge === '対象' || r.judge === '対象外' ? '入力あり' : '空欄', r.judge === '対象' || r.judge === '対象外' ? '' : '掲載判定=' + (r.judge || '空') + (r.reason ? '（' + r.reason + '）' : ''), r.judge === '対象' || r.judge === '対象外' ? '' : 'J1/J2（承認後）または人が判断', r);
    tally('テーマ・二重分類・地理', '列なし', 'V2 台帳に列が無い（未設計）', 'データ基盤の後に設計（今は作らない）', r);
  });
  var S = Object.keys(sum).sort().map(function (k) { var x = sum[k]; return [x.field, x.state, x.cause, x.how, x.all, x.pub]; });
  laWriteSheet_(c.ss, K1_SUM_, ['項目', '状態', '理由', '埋める方法', '全行', '公開候補'], S);
  laWriteSheet_(c.ss, K1_ROWS_, ['EP-ID', '台帳行', '項目', '理由', '埋める方法'], cells);
  var byField = {}; S.forEach(function (x) { var f = byField[x[0]] = byField[x[0]] || { filled: 0, blank: 0 }; if (x[1] === '入力あり') f.filled += x[5]; else f.blank += x[5]; });
  return scLog_('K1_空欄棚卸し', { status: 'OK', publicCandidates: D.rows.filter(pub).length, byFieldPublic: byField, wroteTo: 'COPY「' + K1_SUM_ + '」「' + K1_ROWS_ + '」（公開候補の空欄だけ個票）', ms: Date.now() - t0 });
}

// ---------- LA0 監査一式（L2→L3→L4→E1→K1）。押すたびに時間の許す所まで進み、止まった所から続ける。最後に監査マニフェストを残す ----------
// 結果はすべて COPY（非公開）。マニフェスト: 実行ID・配布物の SHA256・データ取得日時・対象台帳・各工程の結果と主な件数
var LA0_STEPS_ = ['L2', 'L3', 'L4', 'E1', 'K1'], LA0_MANIFEST_ = '監査・マニフェスト';
function LA0_監査一式_実行() {
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), st = JSON.parse(P.getProperty('LA0_STATE') || 'null');
  if (!st || st.step >= LA0_STEPS_.length) st = { runId: new Date().toISOString(), step: 0, results: {} };
  var run = { L2: L2_全台帳_差分監査, L3: L3_公式音声_確認, L4: L4_採否_集計レポート, E1: E1_V2公開データ_予行, K1: K1_空欄棚卸し };
  while (st.step < LA0_STEPS_.length) {
    if (Date.now() - t0 > 90000 && LA0_STEPS_[st.step] !== 'L4') { P.setProperty('LA0_STATE', JSON.stringify(st)); return scLog_('LA0_監査一式_実行', { status: 'PRESS_AGAIN', next: LA0_STEPS_[st.step], runId: st.runId, done: st.results }); }
    var name = LA0_STEPS_[st.step], r = run[name]();
    st.results[name] = { status: r.status, at: new Date().toISOString() };
    if (name === 'L3' && r.status === 'PARTIAL_RESUME_NEEDED') { st.results.L3.left = r.left; P.setProperty('LA0_STATE', JSON.stringify(st)); return scLog_('LA0_監査一式_実行', { status: 'PRESS_AGAIN', next: 'L3（続き）', left: r.left, runId: st.runId }); }
    if (/MISMATCH|ERROR|NO_L2/.test(r.status)) { P.setProperty('LA0_STATE', JSON.stringify(st)); return scLog_('LA0_監査一式_実行', { status: 'STOPPED_AT_' + name, result: r.status, runId: st.runId }); }
    if (name === 'L2') st.results.L2.counts = r.counts; if (name === 'L4') { st.results.L4.verdicts = r.verdicts; st.results.L4.publishable = r.publishableIfApproved; }
    if (name === 'E1') { st.results.E1.adopted = r.adopted; st.results.E1.removed = r.removed; st.results.E1.added = r.added; } if (name === 'K1') st.results.K1.byFieldPublic = r.byFieldPublic;
    st.step++; P.setProperty('LA0_STATE', JSON.stringify(st));
  }
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), H = ['実行ID', '終了日時', '配布物SHA256(本体)', 'V2台帳', 'COPY', '旧公開の基準', '工程の結果(JSON)'], sh = c.ss.getSheetByName(LA0_MANIFEST_) || c.ss.insertSheet(LA0_MANIFEST_);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, H.length).setValues([H]);
  var sum = c.ss.getSheetByName(LA2_SUM_), base = sum ? sum.getRange(3, 2).getDisplayValues()[0][0] : '';
  sh.getRange(sh.getLastRow() + 1, 1, 1, H.length).setNumberFormat('@').setValues([[st.runId, new Date().toISOString(), typeof CLEANER_BUILD_SOURCE_SHA256 === 'string' ? CLEANER_BUILD_SOURCE_SHA256 : '(不明)', SC_CONFIG.v2WorkingId, SC_CONFIG.copyId, base, JSON.stringify(st.results).slice(0, 45000)]]);
  return scLog_('LA0_監査一式_実行', { status: 'DONE', runId: st.runId, build: typeof CLEANER_BUILD_SOURCE_SHA256 === 'string' ? CLEANER_BUILD_SOURCE_SHA256.slice(0, 16) : '', results: st.results, wroteTo: 'COPY「' + LA0_MANIFEST_ + '」ほか監査シート', ms: Date.now() - t0 });
}
function LA9_監査一式_最初から() { PropertiesService.getScriptProperties().deleteProperty('LA0_STATE'); return scLog_('LA9_監査一式_最初から', { status: 'OK' }); }
