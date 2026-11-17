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
function scAuditOn_(ledgerId, nameIncludes, resName, cursorKey, label) {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), o = ledgerId === SC_CONFIG.copyId ? c : scOpen_(ledgerId, nameIncludes), res = scSheet_(c.ss, resName, SC_HEADERS_), L = scLedger_(o.sh), raw = scRawMap_();   // 台帳は読むだけ。結果は COPY の resName へ
    if (raw.errors.length) return { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors };   // 一部の番組だけで判定を進めない
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], at = {}, H = {};
    SC_HEADERS_.forEach(function (n, i) { H[n] = i; }); cur.forEach(function (r, i) { at[r[0]] = i; });
    var pre = scPreservedRaw_();
    var props = PropertiesService.getScriptProperties(), start = Number(props.getProperty(cursorKey) || 0), ver = scVersion_(), now = new Date().toISOString();
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
    props.setProperty(cursorKey, String(i));
    var cnt = {}, w = 0, sv = 0; cur.forEach(function (x) { cnt[x[H['判定']]] = (cnt[x[H['判定']]] || 0) + 1; if (x[H['書換可']]) w++; if (/SV_OLD_FAIL/.test(x[H['理由']])) sv++; });
    return { status: done ? 'DONE' : 'PARTIAL_RESUME_NEEDED', label: label, done: done, cursor: i, total: L.rows.length, updated: updated, skipped: skipped, verdicts: cnt, writable: w, currentValueFailsSV: sv, ms: Date.now() - t0, version: ver };
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
function scApply_(targetId, nameIncludes, level, label, maxEpisodes, resName, onlyEps, dryRun) {
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
      if ((!dryRun && writes.length >= SC_CONFIG.applyMaxPerRun) || (maxEpisodes && epCount >= maxEpisodes)) return;
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
    if (dryRun) return { status: 'DRYRUN', target: label, level: level, cellsPlanned: writes.length, episodes: Object.keys(writes.reduce(function (a, w) { a[w.ep] = 1; return a; }, {})).length, byColumn: writes.reduce(function (a, w) { a[w.colName] = (a[w.colName] || 0) + 1; return a; }, {}), skipped: skip, writes: writes.map(function (w) { return { ep: w.ep, col: w.colName, oldV: w.oldV, newV: String(w.newV) }; }), ms: Date.now() - t0 };   // 予行: 何も書かない
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
  var res = V2LibCore.buildV2Library({ ledger: ledger, persons: persons, related: related, previousPublicIds: new Set(Object.keys(prevIds)), verifiedAudio: verifiedAudio, newEpisodeAllowList: new Set(Object.keys(allow)), decidedAt: new Date().toISOString(), hash: p25v2GasSha256_, netDecisions: NET_E1_DECISIONS_ });   // 正味_3 から呼ばれたときだけ正味判定を使う
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

// ===== V2データ品質監査 QA（2026-11-14 司令塔「V2データ品質・統合GAS監査」）=====
// 読むだけ: V2（正本）の「V2・統合台帳」「V2・収蔵詳細」「V2・関連記事索引」。書くのは COPY の監査タブ（監査・品質_URL／_概要／_関連記事／_集計）だけ。
// 本番台帳・公開JSON・Spotify・外部サービスには書かない（外部へのアクセスもしない）。6,000件超を分割（1回 約4分）し、続きは QA8 で再開。
// 押す順: QA0_品質監査_全体開始 → （PARTIAL なら）QA8_中断位置から再開 を DONE まで → QA9_結果確認。個別に回すときは QA1／QA2／QA3。
var QA_SHEETS_ = { url: '監査・品質_URL', summary: '監査・品質_概要', related: '監査・品質_関連記事', total: '監査・品質_集計' };
var QA_STATE_KEY_ = 'QA_STATE', QA_CHUNK_MS_ = 240000;
function qaOpen_() { var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes); if (c.ss.getId() === v.ss.getId()) throw new Error('QA_TARGET_IS_V2'); return { v: v, c: c }; }
function qaHeader_(ss, name, H) { var sh = ss.getSheetByName(name) || ss.insertSheet(name); sh.clearContents(); sh.getRange(1, 1, 1, H.length).setValues([H]); sh.setFrozenRows(1); return sh; }
function qaAppend_(sh, rows, n) { if (!rows.length) return; sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setNumberFormat('@').setValues(rows.map(function (r) { return r.map(function (x) { return LedgerAudit.sheetText(String(x)); }); })); }
function qaWhere_(o, extra) { return Object.assign({ readFrom: 'V2 ' + SC_CONFIG.v2WorkingId + '（読むだけ）', wroteTo: 'COPY ' + SC_CONFIG.copyId + ' の監査タブ', version: LedgerAudit.QA_VERSION }, extra || {}); }
function qaIndexSource_(o) {
  var v2 = o.v.ss.getSheetByName(RL_SHEET_V2_), cp = o.c.ss.getSheetByName(RL_SHEET_COPY_), at = new Date().toISOString();
  var pick = v2 && v2.getLastRow() > 1 ? { sheet: v2, label: 'V2正本索引', id: o.v.ss.getId(), tab: RL_SHEET_V2_ } : cp && cp.getLastRow() > 1 ? { sheet: cp, label: 'COPY試験索引（V2正本の索引は未作成）', id: o.c.ss.getId(), tab: RL_SHEET_COPY_ } : { sheet: null, label: '', id: '', tab: '' };
  pick.info = { used: pick.label || '索引シートなし', sheetId: pick.id, tab: pick.tab, rows: pick.sheet ? pick.sheet.getLastRow() - 1 : 0, readAt: at, v2IndexRows: v2 ? Math.max(0, v2.getLastRow() - 1) : '（シートなし）', copyIndexRows: cp ? Math.max(0, cp.getLastRow() - 1) : '（シートなし）' };
  return pick;
}
function qaUrlRun_(o) {
  var D = laRead_(o.v.sh), P = LedgerAudit.PLATFORM_COLUMNS, idx = P.map(function (p) { return D.h.indexOf(p); });
  var rows = D.rows.filter(function (r) { return r.ep; }).map(function (r) { var links = {}; P.forEach(function (p, j) { if (idx[j] >= 0) links[p] = r._r[idx[j]]; }); return { ep: r.ep, rep: r.rep, judge: r.judge, links: links }; });
  var res = LedgerAudit.qaPlatformUrls(rows), sh = qaHeader_(o.c.ss, QA_SHEETS_.url, LedgerAudit.QA_URL_HEADERS); qaAppend_(sh, res.rows, LedgerAudit.QA_URL_HEADERS.length);
  return { episodes: rows.length, missingColumns: P.filter(function (p, j) { return idx[j] < 0; }), counts: res.counts, issueRows: res.rows.length };
}
function qaStart_(fn, modes) {
  var o = qaOpen_(), out = {}, P = PropertiesService.getScriptProperties();
  if (modes.indexOf('url') >= 0) out.url = qaUrlRun_(o);
  var deep = modes.filter(function (m) { return m === 'summary' || m === 'related'; });
  if (!deep.length) return scLog_(fn, qaWhere_(o, { status: 'DONE', url: out.url }));
  if (deep.indexOf('summary') >= 0) qaHeader_(o.c.ss, QA_SHEETS_.summary, LedgerAudit.QA_SUMMARY_HEADERS);
  if (deep.indexOf('related') >= 0) qaHeader_(o.c.ss, QA_SHEETS_.related, LedgerAudit.QA_RELATED_HEADERS);
  P.setProperty(QA_STATE_KEY_, JSON.stringify({ modes: deep, cursor: 0, startedAt: new Date().toISOString(), fn: fn }));
  var r = qaChunk_(o); r.url = out.url; return scLog_(fn, r);
}
function qaChunk_(o) {
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), st = JSON.parse(P.getProperty(QA_STATE_KEY_) || 'null');
  if (!st) return { status: 'NO_STATE', note: '先に QA0／QA2／QA3 で開始' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var D = laRead_(o.v.sh), sumCol = D.h.indexOf('概要（清掃済）'), eps = D.rows.filter(function (r) { return r.ep; }), pre = scPreservedRaw_();
    var ds = o.v.ss.getSheetByName(P25V2_DETAIL_SHEET_), shaBy = {};   // 原文のハッシュ一致を確かめる（不一致は pre に入らない）
    if (ds && ds.getLastRow() > 1) { var dv = ds.getRange(1, 1, ds.getLastRow(), 6).getDisplayValues(), he = dv[0].indexOf('EP-ID'), hs = dv[0].indexOf('概要原文SHA256'), ht = dv[0].indexOf('概要原文'); dv.slice(1).forEach(function (x) { shaBy[x[he]] = { sha: x[hs], has: !!x[ht] }; }); }
    // 関連記事索引の出どころ（QA-2）: V2正本の「V2・関連記事索引」があればそれ。無ければ COPY の「関連記事索引(試験)」を読み、結果に「COPY試験索引」と明記する（正本の索引が完成したとは扱わない）
    var idxBy = {}, src = qaIndexSource_(o); if (st.modes.indexOf('related') >= 0 && src.sheet) src.sheet.getRange(2, 1, src.sheet.getLastRow() - 1, LedgerAudit.RELATED_HEADERS.length).getDisplayValues().forEach(function (x) { (idxBy[x[0]] = idxBy[x[0]] || []).push(x); });
    var sS = o.c.ss.getSheetByName(QA_SHEETS_.summary), sR = o.c.ss.getSheetByName(QA_SHEETS_.related), bufS = [], bufR = [], i = st.cursor;
    for (; i < eps.length; i++) {
      if (Date.now() - t0 > QA_CHUNK_MS_) break;
      var r = eps[i], p = pre[r.ep], raw = p ? p.text : '', cl = raw ? CleanerV4.cleanV4(raw) : { text: '', related: [] };
      if (st.modes.indexOf('summary') >= 0) { var j = raw ? CleanerV4.judgeEpisode(raw, { summary: sumCol >= 0 ? r._r[sumCol] : '', related: r.related }) : null, s = shaBy[r.ep];
        bufS.push(LedgerAudit.qaSummary({ ep: r.ep, raw: raw, rawSha: s ? s.sha : '', shaOk: s && s.has ? !!p : undefined, ledger: sumCol >= 0 ? r._r[sumCol] : '', reclean: cl.text, judge: j }).row); }
      if (st.modes.indexOf('related') >= 0) bufR.push(LedgerAudit.qaRelated({ ep: r.ep, fromRaw: cl.related, ledgerUrls: r.related, indexRows: idxBy[r.ep] || [], indexSource: src.label }).row);
      if (bufS.length + bufR.length >= 400) { qaAppend_(sS, bufS, LedgerAudit.QA_SUMMARY_HEADERS.length); qaAppend_(sR, bufR, LedgerAudit.QA_RELATED_HEADERS.length); bufS = []; bufR = []; st.cursor = i + 1; P.setProperty(QA_STATE_KEY_, JSON.stringify(st)); }
    }
    if (sS) qaAppend_(sS, bufS, LedgerAudit.QA_SUMMARY_HEADERS.length); if (sR) qaAppend_(sR, bufR, LedgerAudit.QA_RELATED_HEADERS.length);
    st.cursor = i; var done = i >= eps.length; if (done) P.deleteProperty(QA_STATE_KEY_); else P.setProperty(QA_STATE_KEY_, JSON.stringify(st));
    return qaWhere_(o, { status: done ? 'DONE' : 'PARTIAL_RESUME_NEEDED', modes: st.modes, processed: i, total: eps.length, left: eps.length - i, preservedRaw: Object.keys(pre).length, indexEpisodes: Object.keys(idxBy).length, indexSource: src.info, next: done ? 'QA9_結果確認' : 'QA8_中断位置から再開', ms: Date.now() - t0 });
  } finally { lock.releaseLock(); }
}
function QA0_品質監査_全体開始() { return qaStart_('QA0_品質監査_全体開始', ['url', 'summary', 'related']); }
function QA1_URL監査() { return qaStart_('QA1_URL監査', ['url']); }
function QA2_概要欄監査() { return qaStart_('QA2_概要欄監査', ['summary']); }
function QA3_関連記事監査() { return qaStart_('QA3_関連記事監査', ['related']); }
function QA8_中断位置から再開() { return scLog_('QA8_中断位置から再開', qaChunk_(qaOpen_())); }
function QA9_結果確認() {
  var o = qaOpen_(), out = { status: 'OK', state: JSON.parse(PropertiesService.getScriptProperties().getProperty(QA_STATE_KEY_) || 'null') }, tot = [];
  [['url', 2], ['summary', 1], ['related', 1]].forEach(function (k) {
    var sh = o.c.ss.getSheetByName(QA_SHEETS_[k[0]]); if (!sh || sh.getLastRow() < 2) { out[k[0]] = '未実行'; return; }
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getDisplayValues(), byV = {}, byC = {};
    v.forEach(function (r) { var vv = (k[0] === 'url' ? r[1] + '・' : '') + r[k[1]]; byV[vv] = (byV[vv] || 0) + 1; String(r[2]).split(' / ').filter(Boolean).forEach(function (c) { if (k[0] !== 'url') byC[c] = (byC[c] || 0) + 1; }); });
    out[k[0]] = { rows: v.length, byVerdict: byV, byCause: byC };
    Object.keys(byV).forEach(function (x) { tot.push([k[0], '判定', x, byV[x]]); }); Object.keys(byC).forEach(function (x) { tot.push([k[0], '原因', x, byC[x]]); });
  });
  var si = qaIndexSource_(o).info; out.indexSource = si; Object.keys(si).forEach(function (k) { tot.push(['related', '索引の出どころ', k, String(si[k])]); }); tot.push(['all', '監査', '集計日時', new Date().toISOString()]);
  laWriteSheet_(o.c.ss, QA_SHEETS_.total, ['領域', '区分', '値', '件数'], tot);
  return scLog_('QA9_結果確認', qaWhere_(o, out));
}


// ===== 概要欄 統合整備（2026-11-15 司令塔「概要欄清掃GAS 統合整備指令」）=====
// 既存の部品をそのまま使う: 監査 QA2・判定 S2・COPY反映 S3B・V2反映 S4（scApply_）・取消 S9・新着 D2（S6A/S6B）。
// 原文（V2・収蔵詳細の概要原文＋SHA256）は読むだけ。V2台帳へ書くのは 概要欄_4 だけで、当日の承認（概要欄_0）が無ければ0件。
var SUM_PLAN_SHEET_ = '概要欄・反映予定', SUM_APPROVE_KEY_ = 'APPROVE_SUMMARY_V2', SUM_RES_V2_ = '清掃・結果(V2基準)';
// V2へ書く前の判定は、V2の今の値を「旧値」として行う（COPYの台帳は試験で書き換わるため）。V2は読むだけ、結果は COPY「清掃・結果(V2基準)」
function 概要欄_2V_V2基準の判定() { return scLog_('概要欄_2V_V2基準の判定', scAuditOn_(SC_CONFIG.v2WorkingId, '', SUM_RES_V2_, 'SC_CURSOR_V2BASE', 'V2基準')); }
function sumResV2_() { var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), sh = c.ss.getSheetByName(SUM_RES_V2_); if (!sh || sh.getLastRow() < 2) throw new Error('先に 概要欄_2V_V2基準の判定 を全件（DONE）まで'); return SUM_RES_V2_; }
function sumToday_() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'); }
// 1) 現状監査（読むだけ。結果は COPY「監査・品質_概要」→ 概要欄_1 を DONE まで押す）
function 概要欄_1_現状監査() { var P = PropertiesService.getScriptProperties(); return P.getProperty(QA_STATE_KEY_) ? QA8_中断位置から再開() : QA2_概要欄監査(); }
// 2) COPY全件試験: 判定（S2、途中なら続きから）→ 判定が全件済んだら COPY の台帳コピーへ反映（S3B）
function 概要欄_2_COPY全件試験() {
  var s2 = S2_清掃監査(); if (!s2.done) return scLog_('概要欄_2_COPY全件試験', { status: 'PARTIAL_RESUME_NEEDED', step: 'S2', cursor: s2.cursor, total: s2.total, note: 'もう一度 概要欄_2 を押す' });
  var s3 = scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 0);
  return scLog_('概要欄_2_COPY全件試験', { status: s3.status, s2: { verdicts: s2.verdicts, writable: s2.writable }, copyCellsWritten: s3.cellsWritten, copyEpisodes: s3.episodes, skipped: s3.skipped });
}
// 3) 差分検証（読むだけ）: 原文のハッシュ全件照合・V2へ書く予定（予行）・保護対象が予定に入っていないこと
function 概要欄_3_差分検証() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_), rawBad = [], rawEmpty = 0, rawRows = 0;
  if (ds && ds.getLastRow() > 1) { var dv = ds.getDataRange().getValues(), h = dv[0], e = h.indexOf('EP-ID'), t = h.indexOf('概要原文'), sh = h.indexOf('概要原文SHA256');
    dv.slice(1).forEach(function (x) { rawRows++; var raw = String(x[t] || ''); if (!raw) { rawEmpty++; return; } if (p25v2GasSha256_(raw) !== String(x[sh])) rawBad.push(x[e]); }); }
  var plan = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, sumResV2_(), scV2NotPassedScope_(), true);
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(SUM_RES_V2_), H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
  var why = {}; if (res && res.getLastRow() > 1) res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues().forEach(function (r) { why[r[H['EP-ID']]] = r[H['理由']] + ' ' + r[H['判定']]; });
  var bad = (plan.writes || []).filter(function (w) { return /MANUAL_EDIT_PROTECTED:[^,]*summary|UNACCOUNTED_LINE|不合格|要確認/.test(why[w.ep] || '') && w.col === '概要（清掃済）'; });
  var out = [['EP-ID', '列', '旧値（先頭80字）', '新値（先頭80字）', '判定・理由']].concat((plan.writes || []).map(function (w) { return [w.ep, w.col, w.oldV.slice(0, 80), w.newV.slice(0, 80), String(why[w.ep] || '').slice(0, 120)]; }));
  laWriteSheet_(c.ss, SUM_PLAN_SHEET_, out[0], out.slice(1));
  return scLog_('概要欄_3_差分検証', { status: rawBad.length || bad.length ? 'NG' : 'OK', raw: { rows: rawRows, empty: rawEmpty, shaMismatch: rawBad.length, shaMismatchEps: rawBad.slice(0, 10) }, planned: { cells: plan.cellsPlanned, episodes: plan.episodes, byColumn: plan.byColumn, skipped: plan.skipped }, protectedInPlan: bad.length, planSheet: 'COPY「' + SUM_PLAN_SHEET_ + '」' });
}
// 0) 承認（管理人が押す。当日だけ有効）
function 概要欄_0_承認_V2本番反映() { PropertiesService.getScriptProperties().setProperty(SUM_APPROVE_KEY_, sumToday_()); return scLog_('概要欄_0_承認_V2本番反映', { status: 'APPROVED', validOn: sumToday_() }); }
// 4) V2本番反映（承認当日だけ。差分検証が OK でなければ書かない）
function 概要欄_4_V2本番反映() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(SUM_APPROVE_KEY_) !== sumToday_()) return scLog_('概要欄_4_V2本番反映', { status: 'NOT_APPROVED_TODAY', note: '先に 概要欄_0_承認_V2本番反映' });
  var chk = 概要欄_3_差分検証(); if (chk.status !== 'OK') return scLog_('概要欄_4_V2本番反映', { status: 'STOP_PRECHECK_NG', precheck: chk });
  var r = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, sumResV2_(), scV2NotPassedScope_());
  if (r.status !== 'OK' || r.cellsWritten < SC_CONFIG.applyMaxPerRun) P.deleteProperty(SUM_APPROVE_KEY_); else r.note = '上限まで書いたので続きあり: もう一度 概要欄_4 を押す（承認は当日中有効）';   // 全件書き終えたら承認を使い切る
  return scLog_('概要欄_4_V2本番反映', r);
}
// 5) 反映後監査（読むだけ）: 直前の反映の読み戻し・原文ハッシュ・取消可能か
function 概要欄_5_反映後監査() {
  var id = PropertiesService.getScriptProperties().getProperty('SC_LAST_APPLY'), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_);
  var rows = id && hist.getLastRow() > 1 ? hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().filter(function (r) { return r[1] === id; }) : [];
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
  var keyOf = { '概要（清掃済）': 'summary', '出演者': 'cast', '関連記事URL': 'related' }, same = 0, diff = [];
  rows.forEach(function (r) { var x = byEp[r[3]], k = keyOf[r[4]]; if (x && k && String(x[k]) === r[6]) same++; else diff.push(r[3] + '/' + r[4]); });
  var chk = 概要欄_3_差分検証();
  return scLog_('概要欄_5_反映後監査', { status: diff.length || chk.raw.shaMismatch ? 'NG' : 'OK', applyId: id || '', historyRows: rows.length, stillAsWritten: same, changedSinceWrite: diff.slice(0, 20), rawShaMismatch: chk.raw.shaMismatch, remainingPlanned: chk.planned.cells, undo: 'S9_直前の反映を取消' });
}

// ===== 概要欄 修復（2026-11-16 司令塔「統合実機検証指令」1）=====
// 既存の保護（V2・清掃詳細で合格済みの回は書き直さない）は 概要欄_4 でそのまま維持する。
// それとは別に、「今の台帳の値が原文照合（SV-1）で不合格」かつ「新しい清掃値が照合合格・自動検査合格」の回だけを、承認つきで直す経路。
// 手入力の列（MANUAL_EDIT_PROTECTED）・監査後に人が変えたセル（CHANGED_SINCE_AUDIT）は scApply_ の既存の保護でそのまま守られる。
var SUM_REPAIR_SHEET_ = '概要欄・修復予定', SUM_REPAIR_KEY_ = 'APPROVE_SUMMARY_REPAIR';
function scV2RepairScope_() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(sumResV2_()), H = {}, scope = {}, n = 0;
  SC_HEADERS_.forEach(function (x, i) { H[x] = i; });
  if (res && res.getLastRow() > 1) res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues().forEach(function (r) {
    if (r[H['判定']] === '自動検査合格・目視未確認' && /SV_OLD_FAIL/.test(r[H['理由']]) && /summary/.test(r[H['書換可']])) { scope[r[H['EP-ID']]] = 1; n++; } });
  return scope;
}
function sumRepairPlan_() {
  var plan = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, sumResV2_(), scV2RepairScope_(), true);
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(SUM_RES_V2_), H = {}, why = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
  if (res && res.getLastRow() > 1) res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues().forEach(function (r) { why[r[H['EP-ID']]] = String(r[H['理由']]).match(/SV_OLD_FAIL:[^,]*/) || ''; });
  var out = (plan.writes || []).map(function (w) { return [w.ep, w.col, w.oldV.slice(0, 80), w.newV.slice(0, 80), String(why[w.ep] || '')]; });
  laWriteSheet_(c.ss, SUM_REPAIR_SHEET_, ['EP-ID', '列', '旧値（先頭80字）', '新値（先頭80字）', '今の値の問題（SV-1）'], out);
  return plan;
}
// 6) 修復の予行（読むだけ。COPY「概要欄・修復予定」に一覧）
function 概要欄_6_修復予行() {
  var chk = 概要欄_3_差分検証(), plan = sumRepairPlan_();
  return scLog_('概要欄_6_修復予行', { status: chk.raw.shaMismatch ? 'NG' : 'OK', rawShaMismatch: chk.raw.shaMismatch, repairCells: plan.cellsPlanned, repairEpisodes: plan.episodes, byColumn: plan.byColumn, skipped: plan.skipped, planSheet: 'COPY「' + SUM_REPAIR_SHEET_ + '」' });
}
// 承認（管理人が押す。当日だけ有効）
function 概要欄_0R_承認_V2修復() { PropertiesService.getScriptProperties().setProperty(SUM_REPAIR_KEY_, sumToday_()); return scLog_('概要欄_0R_承認_V2修復', { status: 'APPROVED', validOn: sumToday_() }); }
// 7) V2修復反映（承認当日だけ・原文ハッシュ不一致0のときだけ。上限 applyMaxPerRun 件ずつ、続きは再実行）
function 概要欄_7_V2修復反映() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(SUM_REPAIR_KEY_) !== sumToday_()) return scLog_('概要欄_7_V2修復反映', { status: 'NOT_APPROVED_TODAY', note: '先に 概要欄_0R_承認_V2修復' });
  var chk = 概要欄_3_差分検証(); if (chk.raw.shaMismatch || chk.protectedInPlan) return scLog_('概要欄_7_V2修復反映', { status: 'STOP_PRECHECK_NG', precheck: chk });
  var r = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, sumResV2_(), scV2RepairScope_());
  if (r.status !== 'OK' || r.cellsWritten < SC_CONFIG.applyMaxPerRun) P.deleteProperty(SUM_REPAIR_KEY_); else r.note = '上限まで書いたので続きあり: もう一度 概要欄_7 を押す（承認は当日中有効）';
  return scLog_('概要欄_7_V2修復反映', r);
}

// ===== 配信先URL: Apple Podcasts を公式GUIDで照合（READ_ONLY、2026-11-16 司令塔「統合実機検証指令」3）=====
// Apple の公開API（iTunes Search/Lookup）が返すエピソードの episodeGuid と、V2 の公式GUID が完全一致したものだけを採る。
// 番組は「Apple が返す番組のRSS（feedUrl）＝ V2 の公式RSS」で特定する（番組名だけで決めない）。URL は Apple が返した trackViewUrl をそのまま使い、作らない。
// V2 は読むだけ。結果は COPY「配信先・Apple照合」。Lookup は番組ごとに新しい方から最大200話までしか返さない（それより古い回は「APIに無い」）。
var PF_APPLE_SHEET_ = '配信先・Apple照合';
function pfJson_(url) { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode() + ' ' + url.split('?')[0]); return JSON.parse(r.getContentText()); }
function pfNormFeed_(u) { return String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase(); }
function 配信先_A1_Apple照合_READ_ONLY() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), vals = v.sh.getRange(1, 1, v.sh.getLastRow(), v.sh.getLastColumn()).getDisplayValues(), h = vals[0];
  var iEp = h.indexOf('EP-ID'), iShow = h.indexOf('番組'), iGuid = h.indexOf('公式GUID'), iApple = h.indexOf('Apple');
  if ([iEp, iShow, iGuid, iApple].some(function (x) { return x < 0; })) throw new Error('LEDGER_COLUMN_NOT_FOUND');
  var out = [], perShow = {}, total = { matched: 0, newUrl: 0, sameAsLedger: 0, differsFromLedger: 0, notInApi: 0 };
  P25V2_COPY_FEEDS_().forEach(function (f) {
    var st = perShow[f.show] = { collectionId: '', apiEpisodes: 0, ledgerRows: 0, matched: 0, newUrl: 0, same: 0, differs: 0, notInApi: 0, error: '' };
    try {
      var s = pfJson_('https://itunes.apple.com/search?media=podcast&entity=podcast&country=JP&limit=25&term=' + encodeURIComponent(f.show));
      var hit = (s.results || []).filter(function (x) { return pfNormFeed_(x.feedUrl) === pfNormFeed_(f.url); })[0];
      if (!hit) {   // 検索で出ない番組は、V2 に既にある Apple URL の番組ID（/id数字）を Lookup し、RSS が一致したときだけ採る
        var ids = {}; vals.slice(1).forEach(function (r) { if (r[iShow] === f.show) { var m = String(r[iApple] || '').match(/\/id(\d+)/); if (m) ids[m[1]] = 1; } });
        Object.keys(ids).some(function (id) { var lk = pfJson_('https://itunes.apple.com/lookup?entity=podcast&country=JP&id=' + id); hit = (lk.results || []).filter(function (x) { return pfNormFeed_(x.feedUrl) === pfNormFeed_(f.url); })[0]; return !!hit; });
      }
      if (!hit) { st.error = 'FEED_NOT_FOUND_IN_APPLE'; return; }   // 番組名が似ていても RSS が違えば採らない
      st.collectionId = String(hit.collectionId);
      var l = pfJson_('https://itunes.apple.com/lookup?entity=podcastEpisode&country=JP&limit=200&id=' + hit.collectionId), byGuid = {};
      (l.results || []).forEach(function (x) { if (x.wrapperType === 'podcastEpisode' && x.episodeGuid && x.trackViewUrl) byGuid[String(x.episodeGuid).toLowerCase()] = { url: String(x.trackViewUrl), trackId: String(x.trackId) }; });
      st.apiEpisodes = Object.keys(byGuid).length;
      vals.slice(1).forEach(function (r) {
        if (r[iShow] !== f.show || !r[iEp]) return; st.ledgerRows++;
        var g = String(r[iGuid] || '').toLowerCase(), a = g && byGuid[g], ex = String(r[iApple] || ''), exId = (ex.match(/[?&]i=(\d+)/) || [])[1] || '';
        if (!a) { st.notInApi++; return; }
        st.matched++; var state = !ex ? '新規取得' : exId === a.trackId ? '既存と一致' : '既存と不一致';
        if (state === '新規取得') st.newUrl++; else if (state === '既存と一致') st.same++; else st.differs++;
        out.push([r[iEp], f.show, g, a.url, ex, state]);
      });
    } catch (e) { st.error = String(e.message || e).slice(0, 120); }
    ['matched', 'newUrl', 'notInApi'].forEach(function (k) { total[k] += st[k]; }); total.sameAsLedger += st.same; total.differsFromLedger += st.differs;
  });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, PF_APPLE_SHEET_, ['EP-ID', '番組', '公式GUID', 'Apple URL（APIの値）', 'V2の今の値', '状態'], out);
  return scLog_('配信先_A1_Apple照合_READ_ONLY', { status: 'READ_ONLY', v2Writes: 0, total: total, perShow: perShow, sheet: 'COPY「' + PF_APPLE_SHEET_ + '」', method: 'Apple公開APIの episodeGuid = V2公式GUID（完全一致）、番組はRSS一致で特定', ms: Date.now() - t0 });
}


// ===== 正味件数（2026-11-16 司令塔「正味件数確定・差分解消」＋音声チーム回答 docs/operations/2026-11-16-rebroadcast-policy.md）=====
// 判定は scripts/ledger-v2/net-count.mjs（NetCount）。V2・おんさ比較シート・SDGs公式JSON・SDGs再配信185件照合は読むだけ。
// 結果は COPY「正味・判定案」「正味・集計」「正味・おんさ差分」。台帳へ書くのは 正味_2（COPY台帳）と 正味_4（V2、当日承認つき）だけ。
var NET_ONSA_ID_ = '1CvRyWLQb7YyonGyRSNKtc_liRrgtiWE5yDGI3R48Xfk';   // おんささんの比較シート（読むだけ。書く関数からは開かない）
var NET_ONSA_TABS_ = ['ニュースの現場から', 'メディアトーク', 'ドーナツ', 'スポンジ', 'SDGs', '報談', 'ニュースの学校'];
var NET_SHEET_ = '正味・判定案', NET_SUM_ = '正味・集計', NET_ONSA_SHEET_ = '正味・おんさ差分', NET_HIST_ = '正味・反映履歴', NET_APPROVE_KEY_ = 'APPROVE_NET_V2';
var NET_E1_DECISIONS_ = null;
var NET_NEW_JUDGE_ = { '対象案': '対象', '重複案': '対象外', '保留案': '保留' };
function netInputs_() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), vals = v.sh.getRange(1, 1, v.sh.getLastRow(), v.sh.getLastColumn()).getDisplayValues(), h = vals[0], I = function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + n); return i; };
  var ix = { ep: I('EP-ID'), show: I('番組'), title: I('タイトル'), date: I('配信日時 JST'), judge: I('掲載判定'), rep: I('代表EP-ID'), guid: I('公式GUID'), uuid: I('公式JSON UUID'), url: I('公式個別URL'), dur: I('再生時間 秒'), basis: I('判定根拠'), reason: I('除外・保留理由') };
  var v2Rows = vals.slice(1).filter(function (r) { return /^EP-\d{5}$/.test(r[ix.ep]); }).map(function (r) { return { ep: r[ix.ep], show: r[ix.show], title: r[ix.title], date: r[ix.date], judge: r[ix.judge], rep: r[ix.rep], guid: r[ix.guid], uuid: r[ix.uuid], officialUrl: r[ix.url], duration: r[ix.dur], basis: r[ix.basis], reason: r[ix.reason] }; });
  var on = SpreadsheetApp.openById(NET_ONSA_ID_), onsaRows = [], onsaCounts = {}, youtube = 0;
  NET_ONSA_TABS_.forEach(function (t) { var sh = on.getSheetByName(t); if (!sh || sh.getLastRow() < 3) return; var hh = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], ai = hh.indexOf('Asahi.com URL');
    var rr = sh.getRange(3, 1, sh.getLastRow() - 2, Math.max(13, ai + 1)).getDisplayValues().filter(function (r) { return r[0] || r[2]; }); onsaCounts[t] = rr.length;
    rr.forEach(function (r) { var m = String(ai >= 0 ? r[ai] : '').match(/itemid=([0-9a-f-]{36})/i); onsaRows.push({ show: t, title: r[2], date: r[1], item: m ? m[1].toLowerCase() : '' }); }); });
  var yt = on.getSheetByName('YouTube'); if (yt && yt.getLastRow() > 2) youtube = yt.getRange(3, 1, yt.getLastRow() - 2, 1).getDisplayValues().filter(function (r) { return r[0]; }).length;
  var s185 = v.ss.getSheetByName('V2・SDGs再配信185件照合'), rerun185 = [];
  if (s185 && s185.getLastRow() > 1) { var a = s185.getRange(1, 1, s185.getLastRow(), s185.getLastColumn()).getDisplayValues(), hh2 = a[0];
    a.slice(1).forEach(function (r) { if (/^EP-/.test(r[0])) rerun185.push({ ep: r[0], match: r[hh2.indexOf('元配信照合')], origin: r[hh2.indexOf('元EP-ID候補')], diff: r[hh2.indexOf('尺差（秒）')] }); }); }
  var so = v.ss.getSheetByName('SDGs公式JSON_1092件原本'), sdgsOfficial = so ? so.getRange(2, 1, so.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0]; }).filter(String) : [];
  return { v2Rows: v2Rows, onsaRows: onsaRows, onsaCounts: onsaCounts, youtube: youtube, rerun185: rerun185, sdgsOfficial: sdgsOfficial };
}
// 1) 照合と判定案（読むだけ）
function 正味_1_件数照合_READ_ONLY() {
  var t0 = Date.now(), inp = netInputs_(), res = NetCount.classifyNet({ v2Rows: inp.v2Rows, onsaRows: inp.onsaRows, rerun185: inp.rerun185, sdgsOfficial: inp.sdgsOfficial, identityOverrides: NetCount.NET_IDENTITY_OVERRIDES });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, NET_SHEET_, ['EP-ID', '番組', '現判定', '判定案', '代表EP-ID案', '根拠', 'おんさ表'], res.rows.map(function (x) { return [x.ep, x.show, x.now, x.prop, x.rep, x.reason, x.onsa]; }));
  var by = {}; inp.v2Rows.forEach(function (r) { by[r.ep] = r; });   // 代表EP-ID対応表（重複・対象外の行を、代表の行と並べて照合できるように）
  laWriteSheet_(c.ss, '正味・代表対応表', ['再配信・重複EP-ID', '判定案', '番組', 'タイトル', '配信日時', '尺(秒)', '公式GUID/UUID', '代表EP-ID', '代表の番組', '代表タイトル', '代表の配信日時', '代表の尺(秒)', '代表の公式GUID/UUID', '尺差(秒)', '根拠'],
    res.rows.filter(function (x) { return x.prop === '重複案' || x.prop === '対象外'; }).map(function (x) { var a = by[x.ep] || {}, b = by[x.rep] || {}, d = (parseInt(a.duration, 10) - parseInt(b.duration, 10));
      return [x.ep, x.prop, a.show, a.title, a.date, a.duration, a.guid || a.uuid, x.rep, b.show || '（代表行なし）', b.title || '', b.date || '', b.duration || '', b.guid || b.uuid || '', isNaN(d) ? '' : Math.abs(d), x.reason]; }));
  laWriteSheet_(c.ss, NET_ONSA_SHEET_, ['区分', '番組', 'タイトル', '日付', 'itemid'], res.onsaOnly.map(function (x) { return ['おんさにあり V2に無い', x.show, x.title, x.date, x.item]; }).concat(res.sdgsMissing.map(function (u) { return ['SDGs公式にあり V2に無い', 'SDGsを話そう', '', '', u]; })));
  var sum = res.summary; sum.onsaRowsByTab = inp.onsaCounts; sum.youtubeVideosInOnsa = inp.youtube; sum.excludedShows = 'AJW・アルキキ・YouTube動画は計上しない（V2統合台帳に行なし）';
  laWriteSheet_(c.ss, NET_SUM_, ['項目', '値'], Object.keys(sum).map(function (k) { return [k, typeof sum[k] === 'object' ? JSON.stringify(sum[k]) : sum[k]]; }));
  return scLog_('正味_1_件数照合_READ_ONLY', { status: 'READ_ONLY', version: res.version, summary: sum, onsaOnly: res.onsaOnly.map(function (x) { return x.show + ':' + x.item; }), ms: Date.now() - t0 });
}
function netPlan_() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), sh = c.ss.getSheetByName(NET_SHEET_); if (!sh || sh.getLastRow() < 2) throw new Error('先に 正味_1_件数照合_READ_ONLY');
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues().map(function (r) { return { ep: r[0], now: r[2], prop: r[3], rep: r[4], reason: r[5] }; });
}
// 台帳の 掲載判定・代表EP-ID・除外・保留理由 を判定案どおりにする（変わる行だけ。元の値は「正味・反映履歴」に残し、読み戻して確認）
function netApply_(targetId, nameIncludes, label, dry) {
  if ([SC_CONFIG.copyId, SC_CONFIG.v2WorkingId].indexOf(targetId) < 0) throw new Error('NET_TARGET_REFUSED');
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return { status: 'LOCKED' };
  try {
    var o = scOpen_(targetId, nameIncludes), vals = o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues(), h = vals[0];
    var iE = h.indexOf('EP-ID'), iJ = h.indexOf('掲載判定'), iR = h.indexOf('代表EP-ID'), iW = h.indexOf('除外・保留理由'); if ([iE, iJ, iR, iW].some(function (x) { return x < 0; })) throw new Error('LEDGER_COLUMN_NOT_FOUND');
    var row = {}; vals.forEach(function (r, i) { if (i) row[r[iE]] = i; });
    var plan = netPlan_(), writes = [], skipped = { NO_CHANGE: 0, NOT_IN_LEDGER: 0, CHANGED_SINCE_PLAN: 0 };
    plan.forEach(function (p) { var nj = NET_NEW_JUDGE_[p.prop]; if (!nj) { skipped.NO_CHANGE++; return; } var i = row[p.ep]; if (!i) { skipped.NOT_IN_LEDGER++; return; }
      var r = vals[i]; if (r[iJ] !== p.now) { skipped.CHANGED_SINCE_PLAN++; return; }   // 判定案を作った後に人が変えた行は触らない
      var nr = p.prop === '重複案' ? p.rep : r[iR], nw = '[' + NetCount.NET_VERSION + '] ' + p.reason;
      if (r[iJ] === nj && r[iR] === nr) { skipped.NO_CHANGE++; return; }
      writes.push({ ep: p.ep, i: i, old: [r[iJ], r[iR], r[iW]], nw: [nj, nr, nw] }); });
    if (dry) return { status: 'DRYRUN', target: label, rows: writes.length, skipped: skipped, byNew: writes.reduce(function (a, w) { a[w.nw[0]] = (a[w.nw[0]] || 0) + 1; return a; }, {}) };
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, NET_HIST_, ['日時', '反映ID', '反映先', 'EP-ID', '旧 掲載判定', '旧 代表EP-ID', '旧 除外・保留理由', '新 掲載判定', '新 代表EP-ID', '新 除外・保留理由', '状態']);
    var id = new Date().toISOString() + '/' + label, at = new Date().toISOString();
    if (writes.length) hist.getRange(hist.getLastRow() + 1, 1, writes.length, 11).setNumberFormat('@').setValues(writes.map(function (w) { return [at, id, label, w.ep].concat(w.old, w.nw, ['書込中']); }));   // 先に記録してから書く
    writes.forEach(function (w) { o.sh.getRange(w.i + 1, iJ + 1).setValue(w.nw[0]); o.sh.getRange(w.i + 1, iR + 1).setValue(w.nw[1]); o.sh.getRange(w.i + 1, iW + 1).setValue(w.nw[2]); });
    SpreadsheetApp.flush();
    var back = o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues(), bad = writes.filter(function (w) { var r = back[w.i]; return r[iE] !== w.ep || r[iJ] !== w.nw[0] || r[iR] !== w.nw[1]; });
    PropertiesService.getScriptProperties().setProperty('NET_LAST_APPLY', id);
    return { status: bad.length ? 'MISMATCH' : 'OK', target: label, applyId: id, rows: writes.length, readbackMismatch: bad.map(function (w) { return w.ep; }).slice(0, 20), skipped: skipped, ledgerRowsBefore: vals.length - 1, ledgerRowsAfter: back.length - 1 };
  } finally { lock.releaseLock(); }
}
// 2) COPY台帳へ判定案を反映（試験）
function 正味_2_COPY台帳へ反映() { return scLog_('正味_2_COPY台帳へ反映', netApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'COPY', false)); }
// 3) 公開データの試算（読むだけ）: V2台帳＋正味判定で公開図書館データを作り、今の公開と比べる（E1 の処理を使う。公開・mainへは出さない）
function 正味_3_公開データ試算() {
  var m = {}; netPlan_().forEach(function (p) { m[p.ep] = p; }); NET_E1_DECISIONS_ = m;
  try { var r = E1_V2公開データ_予行(); } finally { NET_E1_DECISIONS_ = null; }
  return scLog_('正味_3_公開データ試算', { status: 'DRYRUN', adopted: r.adopted, held: r.held, excluded: r.excluded, publicNow: r.publicNow, added: r.added, removed: r.removed, note: '公開は L4 で確認済みの新規回だけ（既存の安全柵）。結果は COPY「E1・予行差分」' });
}
// 0) 承認（当日のみ）→ 4) V2へ反映 → 9) 直前の反映を戻す
function 正味_0_承認_V2反映() { PropertiesService.getScriptProperties().setProperty(NET_APPROVE_KEY_, sumToday_()); return scLog_('正味_0_承認_V2反映', { status: 'APPROVED', validOn: sumToday_() }); }
function 正味_4_V2反映_承認後() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(NET_APPROVE_KEY_) !== sumToday_()) return scLog_('正味_4_V2反映_承認後', { status: 'NOT_APPROVED_TODAY', dryrun: netApply_(SC_CONFIG.v2WorkingId, '', 'V2', true) });
  var r = netApply_(SC_CONFIG.v2WorkingId, '', 'V2', false); P.deleteProperty(NET_APPROVE_KEY_); return scLog_('正味_4_V2反映_承認後', r);
}
function 正味_9_直前の反映を戻す() {
  var id = PropertiesService.getScriptProperties().getProperty('NET_LAST_APPLY'); if (!id) return scLog_('正味_9_直前の反映を戻す', { status: 'NOTHING' });
  var label = id.split('/').pop(), target = label === 'V2' ? SC_CONFIG.v2WorkingId : SC_CONFIG.copyId, o = scOpen_(target, label === 'V2' ? '' : SC_CONFIG.copyNameIncludes);
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = c.ss.getSheetByName(NET_HIST_), hv = hist.getRange(2, 1, hist.getLastRow() - 1, 11).getDisplayValues();
  var vals = o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues(), h = vals[0], iE = h.indexOf('EP-ID'), iJ = h.indexOf('掲載判定'), iR = h.indexOf('代表EP-ID'), iW = h.indexOf('除外・保留理由'), row = {}; vals.forEach(function (r, i) { if (i) row[r[iE]] = i; });
  var n = 0, skip = 0; hv.forEach(function (x, k) { if (x[1] !== id) return; var i = row[x[3]]; if (!i || vals[i][iJ] !== x[7]) { skip++; return; }   // 反映後に人が変えた行は戻さない
    o.sh.getRange(i + 1, iJ + 1).setValue(x[4]); o.sh.getRange(i + 1, iR + 1).setValue(x[5]); o.sh.getRange(i + 1, iW + 1).setValue(x[6]); hist.getRange(k + 2, 11).setValue('取消済'); n++; });
  return scLog_('正味_9_直前の反映を戻す', { status: 'OK', applyId: id, restored: n, skippedChangedSince: skip });
}


// ===== AJW・アルキキの表示タブ整理（2026-11-16 指令「V2台帳整合性回復」2）=====
// AJW・アルキキの行は V2・統合台帳には無い（公開台帳にも出ない）。V2ファイル内の旧表示タブ「AJW」「アルキキ」だけを整理する。
// 旧「エピソード台帳」の AJW・アルキキ行は EP-ID 採番の重複防止（P25 の reservationSources）に使うので消さない。
var LEGACY_TABS_ = ['AJW', 'アルキキ'], LEGACY_APPROVE_KEY_ = 'APPROVE_DELETE_LEGACY_TABS';
// 1) 参照の確認（読むだけ）: V2ファイルの全シートで、数式がこの2タブを参照していないか／タブ自身の数式の参照先
function 整理_1_AJWアルキキ_参照確認_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ss = v.ss, out = [], tabs = {};
  LEGACY_TABS_.forEach(function (t) { var sh = ss.getSheetByName(t); tabs[t] = sh ? { rows: sh.getLastRow(), cols: sh.getLastColumn(), formulas: sh.getRange(1, 1, Math.max(1, sh.getLastRow()), Math.max(1, sh.getLastColumn())).getFormulas().reduce(function (a, r) { return a + r.filter(String).length; }, 0) } : null; });
  // 速度対策（初版はシート×語ごとの検索で6分超過）: ファイル全体を1回だけ正規表現で数式検索する
  ss.createTextFinder("(AJW|アルキキ)'?!").useRegularExpression(true).matchFormulaText(true).findAll().forEach(function (cell) {
    var sn = cell.getSheet().getName(), f = cell.getFormula(); if (!f || LEGACY_TABS_.indexOf(sn) >= 0) return;
    LEGACY_TABS_.forEach(function (t) { if (f.indexOf("'" + t + "'!") >= 0 || f.indexOf(t + '!') >= 0) out.push([sn, cell.getA1Notation(), t, f.slice(0, 200)]); });
  });
  // INDIRECT 等で文字列としてタブ名を組み立てる数式も拾う（"AJW" / "アルキキ" を含む数式）
  ss.createTextFinder('"(AJW|アルキキ)"').useRegularExpression(true).matchFormulaText(true).findAll().forEach(function (cell) {
    var sn = cell.getSheet().getName(), f = cell.getFormula(); if (!f || LEGACY_TABS_.indexOf(sn) >= 0) return;
    if (/INDIRECT/i.test(f)) out.push([sn, cell.getA1Notation(), '文字列参照(INDIRECT)', f.slice(0, 200)]);
  });
  var named = ss.getNamedRanges().filter(function (n) { return LEGACY_TABS_.indexOf(n.getRange().getSheet().getName()) >= 0; }).map(function (n) { return n.getName(); });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, '整理・旧タブ参照', ['参照元シート', 'セル', '参照先タブ', '数式（先頭200字）'], out);
  return scLog_('整理_1_AJWアルキキ_参照確認_READ_ONLY', { status: out.length || named.length ? 'HAS_REFERENCES' : 'NO_REFERENCES', tabs: tabs, referencingCells: out.length, namedRanges: named, v2LedgerHasRows: 'V2・統合台帳に AJW/アルキキ の行は無い（正味_1 の番組別で確認）' });
}
// 2) COPY へバックアップ（値と数式の両方。数式の写しは別ファイルでは参照が切れるので、値の写しも残す）
function 整理_2_AJWアルキキ_COPYへ退避() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm'), done = {};
  LEGACY_TABS_.forEach(function (t) {
    var sh = v.ss.getSheetByName(t); if (!sh) { done[t] = 'NOT_FOUND'; return; }
    var vals = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), Math.max(1, sh.getLastColumn())).getDisplayValues(), fx = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), Math.max(1, sh.getLastColumn())).getFormulas();
    var name = '退避_' + t + '_' + stamp, b = c.ss.insertSheet(name); b.getRange(1, 1, vals.length, vals[0].length).setNumberFormat('@').setValues(vals);
    var fn = c.ss.insertSheet(name + '_数式'); fn.getRange(1, 1, fx.length, fx[0].length).setNumberFormat('@').setValues(fx.map(function (r) { return r.map(function (f) { return f ? "'" + f : ''; }); }));
    var back = b.getRange(1, 1, vals.length, vals[0].length).getDisplayValues(), same = JSON.stringify(back) === JSON.stringify(vals);
    done[t] = { backup: name, rows: vals.length, cols: vals[0].length, readbackSame: same };
  });
  PropertiesService.getScriptProperties().setProperty('LEGACY_TABS_BACKUP', JSON.stringify(done));
  return scLog_('整理_2_AJWアルキキ_COPYへ退避', { status: 'OK', backups: done, note: 'V2 は読むだけ。削除は 整理_0_承認 → 整理_3 で' });
}
function 整理_0_承認_旧タブ削除() { PropertiesService.getScriptProperties().setProperty(LEGACY_APPROVE_KEY_, sumToday_()); return scLog_('整理_0_承認_旧タブ削除', { status: 'APPROVED', validOn: sumToday_() }); }
// 3) 削除（当日承認・退避の読み戻し一致・他シートからの参照0 のときだけ）
function 整理_3_AJWアルキキ表示タブ削除_承認後() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(LEGACY_APPROVE_KEY_) !== sumToday_()) return scLog_('整理_3_AJWアルキキ表示タブ削除_承認後', { status: 'NOT_APPROVED_TODAY' });
  var bk = JSON.parse(P.getProperty('LEGACY_TABS_BACKUP') || '{}'), chk = 整理_1_AJWアルキキ_参照確認_READ_ONLY();
  if (chk.status !== 'NO_REFERENCES') return scLog_('整理_3_AJWアルキキ表示タブ削除_承認後', { status: 'STOP_REFERENCES', check: chk });
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), res = {};
  LEGACY_TABS_.forEach(function (t) { var sh = v.ss.getSheetByName(t); if (!sh) { res[t] = 'NOT_FOUND'; return; } if (!bk[t] || !bk[t].readbackSame) { res[t] = 'NO_VERIFIED_BACKUP'; return; } v.ss.deleteSheet(sh); res[t] = 'DELETED（退避: COPY「' + bk[t].backup + '」）'; });
  P.deleteProperty(LEGACY_APPROVE_KEY_);
  return scLog_('整理_3_AJWアルキキ表示タブ削除_承認後', { status: 'OK', result: res, restore: 'COPY の退避タブ（値）と「_数式」タブから戻せる' });
}

// ===== 原文の補完・更新（2026-11-16 最終指令「概要欄清掃・関連記事保全GASの完成」1）=====
// 原文の置き場所は V2・収蔵詳細（概要原文・概要原文SHA256・概要原文文字数・原文取得方法）。台帳の34列には原文を持たない。
// 書いてよいのは RawSource.classifyRaw が FILL（空欄）／UPDATE（保存が公式原文の途中で切れている）としたものだけ。内容が違うものは書かず要確認。
// 同じエピソードの確認: 収蔵詳細の公式GUID が台帳のGUID群に含まれ、公式RSSの同じGUIDの原文と比べる（題名では照合しない）。
// 書く前に COPY「原文・反映履歴」へ旧値（原文そのもの・SHA・取得方法）を残す → 書く → 読み戻し（SHA）→ 状態を OK に。取消は 原文_9。
var RAW_AUDIT_SHEET_ = '原文・照合', RAW_PLAN_SHEET_ = '原文・反映予定', RAW_TEST_SHEET_ = '原文試験・収蔵詳細', RAW_APPROVE_KEY_ = 'APPROVE_RAW_V2', RAW_MAX_ROWS_PER_RUN_ = 300, RAW_PAGE_FETCH_MAX_ = 20;
var RAW_AUDIT_HEADERS_ = ['EP-ID', '公式GUID', '判定', '処理', '理由', '保存SHA256', '保存文字数', '公式SHA256', '公式文字数', '公式の取得元', '照合日時'];
var RAW_HIST_SHEET_ = '原文・反映履歴', RAW_HIST_HEADERS_ = ['反映日時', '反映ID', '対象', 'EP-ID', '旧SHA256', '旧文字数', '旧原文', '旧取得方法', '新SHA256', '新文字数', '新取得方法', '判定', '状態'];
function rawDetailRead_(sh) {
  var n = P25V2_DETAIL_HEADERS_.length, v = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), n).getDisplayValues(); p25v2SheetHeaderCheck_(v, P25V2_DETAIL_HEADERS_, sh.getName());
  var at = {}; v.forEach(function (r, i) { if (i && r[0]) at[r[0]] = i; }); return { v: v, at: at, n: n };
}
// 公式の原文: RSS（GUID一致）→ 無ければ 公式個別ページ（上限 RAW_PAGE_FETCH_MAX_ 件、HTMLのJSONに本文があるときだけ）
function rawOfficial_(guids, rssMap, pageUrl, budget, jsonMap) {
  var g = guids.filter(function (x) { return rssMap[x]; })[0]; if (g) return { text: String(rssMap[g]), source: '公式RSS', guid: g };
  var j = jsonMap ? guids.filter(function (x) { return jsonMap[x]; })[0] : ''; if (j) return { text: String(jsonMap[j]), source: '公式JSON本文（SDGs原本）', guid: j };   // RSSに無いSDGsの回は、取り込み済みの公式JSONの本文（body）だけを使う（短縮された description は使わない）
  if (pageUrl && /^https:\/\/(?:omny\.fm|www\.omnycontent\.com)\//.test(pageUrl) && budget.left > 0) {
    budget.left--; try { var r = UrlFetchApp.fetch(pageUrl, { muteHttpExceptions: true, followRedirects: true }); if (r.getResponseCode() === 200) { var t = RawSource.rawFromOfficialPage(r.getContentText()); if (t) return { text: t, source: '公式個別ページ', guid: guids[0] || '' }; } } catch (e) { /* 取れなければ公式なし扱い */ }
  }
  return { text: '', source: '', guid: guids[0] || '' };
}
// 計画: 台帳の各回について、収蔵詳細の今の原文と公式の原文を比べる
function rawJsonMap_(ss) {   // V2「SDGs公式JSON_1092件原本」の 公式JSON UUID → 公式body原文（空なら載せない）
  var sh = ss.getSheetByName('SDGs公式JSON_1092件原本'), m = {}; if (!sh || sh.getLastRow() < 2) return m;
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(), u = v[0].indexOf('公式JSON UUID'), b = v[0].indexOf('公式body原文'); if (u < 0 || b < 0) return m;
  v.slice(1).forEach(function (r) { if (r[u] && r[b] && r[b].length >= 40) m[String(r[u]).toLowerCase()] = r[b]; }); return m;
}
function rawPlan_(L, D, rssMap, now, opts) {
  opts = opts || {}; var budget = { left: RAW_PAGE_FETCH_MAX_ }, rows = [], plan = [], cnt = {};
  L.rows.forEach(function (x) {
    var i = D.at[x.ep], cur = i != null ? D.v[i] : null, stored = cur ? cur[4] : '', guidOk = !cur || !cur[1] || x.guids.indexOf(String(cur[1]).toLowerCase()) >= 0;
    var pageUrl = L.values[x.row - 1][L.ix.url], off = rawOfficial_(x.guids, rssMap, pageUrl, budget, opts.jsonMap), c;
    if (!guidOk) c = { action: 'HOLD', verdict: 'GUID不一致', reason: '収蔵詳細のGUIDが台帳と違う（同じ回と確認できない）' };
    else if (!cur) c = off.text ? { action: 'ADD', verdict: '行なし→追加', reason: off.source + 'の原文で収蔵詳細の行を作る' } : { action: 'HOLD', verdict: '行なし・取得元なし', reason: '収蔵詳細に行がなく公式原文も無い' };
    else c = RawSource.classifyRaw(stored, off.text, { source: off.source || '公式RSS', cellMax: SC_CELL_MAX_ });
    if (opts.allowChanged && c.verdict === '内容変化' && opts.allowChanged[x.ep]) c = { action: 'UPDATE', verdict: '内容変化→公式に合わせる', reason: '承認された回だけ、今の公式原文に合わせる（旧原文は履歴に保存）' };
    cnt[c.verdict] = (cnt[c.verdict] || 0) + 1;
    var oldSha = stored ? p25v2GasSha256_(stored) : '', newSha = off.text ? p25v2GasSha256_(off.text) : '';
    rows.push([x.ep, off.guid || (cur ? cur[1] : x.guid), c.verdict, c.action, c.reason, oldSha, String(stored.length), newSha, String(off.text.length), off.source, now]);
    if (c.action === 'FILL' || c.action === 'UPDATE' || c.action === 'ADD') plan.push({ ep: x.ep, guids: x.guids, action: c.action, verdict: c.verdict, oldSha: oldSha, newText: off.text, newSha: newSha, source: off.source, guid: off.guid });
  });
  return { rows: rows, plan: plan, counts: cnt, pageFetched: RAW_PAGE_FETCH_MAX_ - budget.left };
}
// 反映（共通）: target = { ss, sh, label }。計画後に変わった行・GUID不一致は書かない。履歴→書込→読み戻し
function rawApply_(target, plan, dryRun) {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, RAW_HIST_SHEET_, RAW_HIST_HEADERS_), D = rawDetailRead_(target.sh), now = new Date().toISOString();
  var applyId = now + '/' + target.label + '/原文', writes = [], skip = {}, sk = function (k) { skip[k] = (skip[k] || 0) + 1; };
  plan.forEach(function (p) {
    if (writes.length >= RAW_MAX_ROWS_PER_RUN_) { sk('RUN_LIMIT（もう一度押すと続き）'); return; }
    var i = D.at[p.ep], cur = i != null ? D.v[i] : null;
    if (p.action === 'ADD') { if (cur) { sk('ROW_EXISTS_SINCE_PLAN'); return; } writes.push({ p: p, add: true }); return; }
    if (!cur) { sk('ROW_GONE'); return; }
    if (cur[1] && p.guids.indexOf(String(cur[1]).toLowerCase()) < 0) { sk('GUID_MISMATCH'); return; }
    var nowSha = cur[4] ? p25v2GasSha256_(cur[4]) : '';
    if (nowSha === p.newSha) { sk('ALREADY_DONE'); return; }
    if (nowSha !== p.oldSha) { sk('CHANGED_SINCE_PLAN'); return; }   // 計画後に人や別のロボが書いた行は書かない
    if (p.action === 'FILL' && cur[4]) { sk('NOT_EMPTY'); return; }
    writes.push({ p: p, row: i + 1, cur: cur });
  });
  if (dryRun) return { status: 'DRYRUN', target: target.label, planned: writes.length, byAction: writes.reduce(function (a, w) { a[w.p.action] = (a[w.p.action] || 0) + 1; return a; }, {}), skipped: skip, eps: writes.map(function (w) { return w.p.ep; }) };
  if (!writes.length) return { status: 'OK_NO_CHANGE', target: target.label, skipped: skip };
  var method = function (p) { return p.source + '（原文_補完 ' + now.slice(0, 10) + '）'; };
  var pend = writes.map(function (w) { var o = w.cur || []; return [now, applyId, target.label, w.p.ep, o[5] || '', o[6] || '', String(o[4] || '').slice(0, SC_CELL_MAX_), o[16] || '', w.p.newSha, String(w.p.newText.length), method(w.p), w.p.verdict, '書込中']; });
  var h0 = hist.getLastRow() + 1; scChunkWrite_(hist, h0, pend, RAW_HIST_HEADERS_.length); SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().setProperty('RAW_LAST_APPLY', JSON.stringify({ id: applyId, label: target.label, ssId: target.ss.getId(), sheet: target.sh.getName() }));
  var adds = [];
  writes.forEach(function (w) {
    if (w.add) { var row = [w.p.ep, w.p.guid, w.p.source, now, w.p.newText, w.p.newSha, String(w.p.newText.length), '未清掃', '', '', '', '', '', '', '', '', method(w.p)]; adds.push(row); return; }
    var rg = target.sh.getRange(w.row, 5, 1, 3); rg.setNumberFormat('@'); rg.setValues([[w.p.newText, w.p.newSha, String(w.p.newText.length)]]); target.sh.getRange(w.row, 17).setValue(method(w.p));
  });
  var addStart = 0; if (adds.length) { addStart = target.sh.getLastRow() + 1; scChunkWrite_(target.sh, addStart, adds, P25V2_DETAIL_HEADERS_.length); }
  SpreadsheetApp.flush();
  var back = rawDetailRead_(target.sh), bad = 0, st = writes.map(function (w) { var i = back.at[w.p.ep], b = i != null ? back.v[i] : null, ok = b && p25v2GasSha256_(b[4]) === w.p.newSha && b[5] === w.p.newSha; if (!ok) bad++; return [ok ? 'OK' : 'READBACK_MISMATCH']; });
  hist.getRange(h0, RAW_HIST_HEADERS_.length, st.length, 1).setValues(st);
  return { status: bad ? 'READBACK_MISMATCH' : 'OK', target: target.label, written: writes.length, byAction: writes.reduce(function (a, w) { a[w.p.action] = (a[w.p.action] || 0) + 1; return a; }, {}), readbackMismatch: bad, skipped: skip, applyId: applyId, more: !!skip['RUN_LIMIT（もう一度押すと続き）'] };
}
function rawUndo_(fn) {
  var P = PropertiesService.getScriptProperties(), last = JSON.parse(P.getProperty('RAW_LAST_APPLY') || 'null'); if (!last) return { status: 'NOTHING_TO_UNDO' };
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, RAW_HIST_SHEET_, RAW_HIST_HEADERS_);
  var ss = last.ssId === c.ss.getId() ? c.ss : scOpen_(last.ssId, '').ss, sh = ss.getSheetByName(last.sheet), D = rawDetailRead_(sh), rows = hist.getRange(2, 1, Math.max(1, hist.getLastRow() - 1), RAW_HIST_HEADERS_.length).getDisplayValues().filter(function (r) { return r[1] === last.id && /^OK|^書込中$/.test(r[12]); });
  var undone = 0, kept = 0, delRows = [], out = [], now = new Date().toISOString();
  rows.forEach(function (r) { var i = D.at[r[3]]; if (i == null) return; var cur = D.v[i];
    if (p25v2GasSha256_(cur[4]) !== r[8]) { kept++; return; }   // 反映後に変わった行は戻さない
    if (!r[4] && !r[6] && !r[7] && /行なし/.test(r[11])) { delRows.push(i + 1); undone++; out.push([now, last.id + '/UNDO', last.label, r[3], r[8], r[9], '', r[10], r[4], r[5], r[7], r[11], 'UNDO（追加行を削除）']); return; }
    var rg = sh.getRange(i + 1, 5, 1, 3); rg.setNumberFormat('@'); rg.setValues([[r[6], r[4], r[5]]]); sh.getRange(i + 1, 17).setValue(r[7]); undone++;
    out.push([now, last.id + '/UNDO', last.label, r[3], r[8], r[9], '', r[10], r[4], r[5], r[7], r[11], 'UNDO']); });
  delRows.sort(function (a, b) { return b - a; }).forEach(function (rw) { sh.deleteRow(rw); });
  if (out.length) scChunkWrite_(hist, hist.getLastRow() + 1, out, RAW_HIST_HEADERS_.length);
  SpreadsheetApp.flush(); P.deleteProperty('RAW_LAST_APPLY');
  var back = rawDetailRead_(sh), mism = 0; rows.forEach(function (r) { var i = back.at[r[3]]; if (i == null) return; if (r[4] && p25v2GasSha256_(back.v[i][4]) !== r[4]) mism++; });
  return { status: mism ? 'UNDO_READBACK_MISMATCH' : 'OK', target: last.label, undone: undone, keptBecauseChangedAfter: kept, readbackMismatch: mism };
}
// 1) 照合（読むだけ。結果は COPY「原文・照合」）
function 原文_1_照合_READ_ONLY() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), raw = scRawMap_();
  if (raw.errors.length) return scLog_('原文_1_照合_READ_ONLY', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });   // 一部の番組のRSSが取れない時は判定しない
  var ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_); if (!ds) return scLog_('原文_1_照合_READ_ONLY', { status: 'STOP_NO_DETAIL_SHEET' });
  var r = rawPlan_(L, rawDetailRead_(ds), raw.map, new Date().toISOString(), { jsonMap: rawJsonMap_(v.ss) }), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, RAW_AUDIT_SHEET_, RAW_AUDIT_HEADERS_, r.rows);
  return scLog_('原文_1_照合_READ_ONLY', { status: 'OK', ledgerEps: L.rows.length, rssItems: raw.items, counts: r.counts, toWrite: { total: r.plan.length, byAction: r.plan.reduce(function (a, p) { a[p.action] = (a[p.action] || 0) + 1; return a; }, {}), eps: r.plan.map(function (p) { return p.ep; }).slice(0, 40) }, pageFetched: r.pageFetched, sheet: 'COPY「' + RAW_AUDIT_SHEET_ + '」', ms: Date.now() - t0, version: RawSource.RAW_SOURCE_VERSION });
}
// 2) COPY試験（V2は読むだけ）: V2の収蔵詳細から数件を COPY の試験タブへ写し、空欄・途中切れ・中身違い・GUID違いを作ってから
//    計画→反映→読み戻し→再実行で差分0→計画後に変わった行は書かない→取消で元に戻る、までを1回で確かめる
function 原文_2_COPY試験() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), raw = scRawMap_(), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), log = {};
  if (raw.errors.length) return scLog_('原文_2_COPY試験', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });
  var src = rawDetailRead_(v.ss.getSheetByName(P25V2_DETAIL_SHEET_)), want = ['EP-06630', 'EP-06631'], pick = [];
  L.rows.forEach(function (x) { var i = src.at[x.ep]; if (i == null || pick.length >= 9) return; var g = String(src.v[i][1]).toLowerCase(); if ((want.indexOf(x.ep) >= 0 || pick.length < 7) && raw.map[g] && raw.map[g] === src.v[i][4] && x.guids.indexOf(g) >= 0) pick.push({ x: x, row: src.v[i].slice() }); });
  want.forEach(function (w) { if (!pick.some(function (p) { return p.x.ep === w; })) { var x = L.rows.filter(function (r) { return r.ep === w; })[0], i = x ? src.at[w] : null; if (i != null) pick.push({ x: x, row: src.v[i].slice() }); } });
  if (pick.length < 8) return scLog_('原文_2_COPY試験', { status: 'STOP_NOT_ENOUGH_SAMPLES', picked: pick.length });
  // 試験データを作る（COPYの試験タブだけ）。0,1=空欄  2,3=途中切れ  4=中身違い  5=GUID違い  残り=一致
  var exp = {}, rows = pick.map(function (p, k) { var r = p.row.slice(), t = r[4];
    if (k <= 1) { r[4] = ''; r[5] = ''; r[6] = '0'; exp[p.x.ep] = 'FILL'; }
    else if (k <= 3) { r[4] = t.slice(0, Math.floor(t.length * 0.6)) + '…'; r[5] = p25v2GasSha256_(r[4]); r[6] = String(r[4].length); exp[p.x.ep] = 'UPDATE'; }
    else if (k === 4) { r[4] = t.replace(/。/, '。（試験で書き換えた文）'); r[5] = p25v2GasSha256_(r[4]); r[6] = String(r[4].length); exp[p.x.ep] = 'HOLD'; }
    else if (k === 5) { r[1] = '00000000-0000-0000-0000-000000000000'; exp[p.x.ep] = 'HOLD_GUID'; }
    else exp[p.x.ep] = 'KEEP';
    return r.map(String); });
  var sh = c.ss.getSheetByName(RAW_TEST_SHEET_) || c.ss.insertSheet(RAW_TEST_SHEET_); sh.clearContents();
  sh.getRange(1, 1, 1, P25V2_DETAIL_HEADERS_.length).setValues([P25V2_DETAIL_HEADERS_]); scChunkWrite_(sh, 2, rows, P25V2_DETAIL_HEADERS_.length); SpreadsheetApp.flush();
  var before = rawDetailRead_(sh), beforeSha = {}; rows.forEach(function (r) { beforeSha[r[0]] = before.v[before.at[r[0]]][4] ? p25v2GasSha256_(before.v[before.at[r[0]]][4]) : ''; });
  var subL = { rows: pick.map(function (p) { return p.x; }), values: L.values, ix: L.ix };
  var plan = rawPlan_(subL, before, raw.map, new Date().toISOString());
  var got = {}; plan.rows.forEach(function (r) { got[r[0]] = r[3] + (r[2] === 'GUID不一致' ? '_GUID' : ''); });
  log.classify = { expected: exp, got: got, allMatch: Object.keys(exp).every(function (e) { return got[e] === exp[e]; }) };
  // 計画の後に1行（途中切れの2件目）を人が直したことにする → その行は書かれないはず
  var tamper = pick[3].x.ep, ti = before.at[tamper] + 1; sh.getRange(ti, 5).setValue(before.v[ti - 1][4] + '（人の修正）'); SpreadsheetApp.flush();
  var a1 = rawApply_({ ss: c.ss, sh: sh, label: 'COPY試験' }, plan.plan, false);
  var after = rawDetailRead_(sh), restored = 0, wrong = [];
  plan.plan.forEach(function (p) { var b = after.v[after.at[p.ep]]; if (p.ep === tamper) { if (b[4] === before.v[ti - 1][4] + '（人の修正）') restored += 0; else wrong.push(p.ep + ':TAMPERED_ROW_OVERWRITTEN'); return; }
    if (b[4] === raw.map[String(b[1]).toLowerCase()] && b[5] === p25v2GasSha256_(b[4])) restored++; else wrong.push(p.ep); });
  var untouched = rows.filter(function (r) { return !plan.plan.some(function (p) { return p.ep === r[0]; }); }).every(function (r) { var b = after.v[after.at[r[0]]]; return b[4] === r[4] && b[1] === r[1]; });
  log.apply1 = { result: a1, restoredToOfficial: restored, wrong: wrong, tamperedRowKept: wrong.indexOf(tamper + ':TAMPERED_ROW_OVERWRITTEN') < 0, othersUntouched: untouched };
  var a2 = rawApply_({ ss: c.ss, sh: sh, label: 'COPY試験' }, plan.plan, false); log.rerun = { status: a2.status, written: a2.written || 0, skipped: a2.skipped };
  var u = rawUndo_('原文_2_COPY試験'); log.undo = u;
  // 2回目の反映は0件なので、取消の対象は1回目（RAW_LAST_APPLY は2回目で上書きしない）
  var fin = rawDetailRead_(sh), back = 0; rows.forEach(function (r) { var b = fin.v[fin.at[r[0]]], want = r[0] === tamper ? p25v2GasSha256_(before.v[ti - 1][4] + '（人の修正）') : beforeSha[r[0]]; if ((b[4] ? p25v2GasSha256_(b[4]) : '') === want) back++; });
  log.undoBackToTestStart = back + '/' + rows.length;
  // 内容変化（k=4）を「承認された回だけ公式に合わせる」経路（原文_5 と同じ）→ 読み戻し → 取消
  var chg = pick[4].x.ep, al = {}; al[chg] = 1;
  var p5 = rawPlan_(subL, rawDetailRead_(sh), raw.map, new Date().toISOString(), { allowChanged: al }), only = p5.plan.filter(function (p) { return p.ep === chg && p.verdict === '内容変化→公式に合わせる'; });
  var a5 = rawApply_({ ss: c.ss, sh: sh, label: 'COPY試験' }, only, false), d5 = rawDetailRead_(sh), b5 = d5.v[d5.at[chg]], ok5 = a5.status === 'OK' && a5.written === 1 && b5[4] === raw.map[String(b5[1]).toLowerCase()];
  var u5 = rawUndo_('原文_2_COPY試験'), d6 = rawDetailRead_(sh), back5 = d6.v[d6.at[chg]][4] === pick[4].row[4].replace(/。/, '。（試験で書き換えた文）');
  log.changedPath = { planned: only.length, apply: a5.status, matchedOfficial: ok5, undo: u5.status, backToTest: back5 };
  var ok = log.classify.allMatch && a1.status === 'OK' && a1.readbackMismatch === 0 && !wrong.length && untouched && a2.status === 'OK_NO_CHANGE' && u.status === 'OK' && back === rows.length && ok5 && u5.status === 'OK' && back5;
  return scLog_('原文_2_COPY試験', { status: ok ? 'PASS' : 'FAIL', samples: rows.length, log: log, sheet: 'COPY「' + RAW_TEST_SHEET_ + '」（試験用。V2は読むだけ）', ms: Date.now() - t0 });
}
// 3) V2予行（読むだけ。COPY「原文・反映予定」）
function 原文_3_V2予行_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), raw = scRawMap_(); if (raw.errors.length) return scLog_('原文_3_V2予行_READ_ONLY', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });
  var ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_), r = rawPlan_(L, rawDetailRead_(ds), raw.map, new Date().toISOString(), { jsonMap: rawJsonMap_(v.ss) }), d = rawApply_({ ss: v.ss, sh: ds, label: 'V2作業用' }, r.plan, true), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, RAW_PLAN_SHEET_, ['EP-ID', '処理', '判定', '旧SHA256', '新SHA256', '新文字数', '公式の取得元'], r.plan.map(function (p) { return [p.ep, p.action, p.verdict, p.oldSha, p.newSha, p.newText.length, p.source]; }));
  return scLog_('原文_3_V2予行_READ_ONLY', { status: 'OK', counts: r.counts, dryRun: d, planSheet: 'COPY「' + RAW_PLAN_SHEET_ + '」' });
}
function 原文_0_承認_V2補完() { PropertiesService.getScriptProperties().setProperty(RAW_APPROVE_KEY_, sumToday_()); return scLog_('原文_0_承認_V2補完', { status: 'APPROVED', validOn: sumToday_() }); }
// 4) V2補完（承認当日だけ。反映の直前にRSSを取り直して計画を作り直す。1回 RAW_MAX_ROWS_PER_RUN_ 行まで、続きは再実行）
function 原文_4_V2補完_承認後() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(RAW_APPROVE_KEY_) !== sumToday_()) return scLog_('原文_4_V2補完_承認後', { status: 'NOT_APPROVED_TODAY', note: '先に 原文_0_承認_V2補完' });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('原文_4_V2補完_承認後', { status: 'LOCKED' });
  try {
    var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), raw = scRawMap_(); if (raw.errors.length) return scLog_('原文_4_V2補完_承認後', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });
    var ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_), r = rawPlan_(L, rawDetailRead_(ds), raw.map, new Date().toISOString(), { jsonMap: rawJsonMap_(v.ss) }), a = rawApply_({ ss: v.ss, sh: ds, label: 'V2作業用' }, r.plan, false);
    if (a.status !== 'OK' || !a.more) P.deleteProperty(RAW_APPROVE_KEY_);
    a.next = a.more ? 'もう一度 原文_4 を押す（承認は当日中有効）' : '原文_1 で残り0を確認 → 概要欄_2V を押して判定を作り直す';
    return scLog_('原文_4_V2補完_承認後', a);
  } finally { lock.releaseLock(); }
}
// 5) 内容変化（公式側の後日修正）を公式に合わせる: 管理人が回を指定して承認した分だけ。
//    使い方: スクリプトプロパティ RAW_CHANGE_ALLOW に EP-ID を空白区切りで入れ（COPY「原文・照合」の「内容変化」から選ぶ）、原文_0_承認_V2補完 → 原文_5
function 原文_5_内容変化を公式に合わせる_承認後() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(RAW_APPROVE_KEY_) !== sumToday_()) return scLog_('原文_5_内容変化を公式に合わせる_承認後', { status: 'NOT_APPROVED_TODAY', note: '先に 原文_0_承認_V2補完' });
  var allow = {}; String(P.getProperty('RAW_CHANGE_ALLOW') || '').split(/[\s,、]+/).filter(Boolean).forEach(function (e) { allow[e] = 1; }); if (!Object.keys(allow).length) return scLog_('原文_5_内容変化を公式に合わせる_承認後', { status: 'NO_EPS', note: 'RAW_CHANGE_ALLOW に EP-ID を入れる' });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('原文_5_内容変化を公式に合わせる_承認後', { status: 'LOCKED' });
  try {
    var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), raw = scRawMap_(); if (raw.errors.length) return scLog_('原文_5_内容変化を公式に合わせる_承認後', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });
    var ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_), r = rawPlan_(L, rawDetailRead_(ds), raw.map, new Date().toISOString(), { jsonMap: rawJsonMap_(v.ss), allowChanged: allow });
    var a = rawApply_({ ss: v.ss, sh: ds, label: 'V2作業用' }, r.plan.filter(function (p) { return allow[p.ep] && p.verdict === '内容変化→公式に合わせる'; }), false);
    P.deleteProperty(RAW_APPROVE_KEY_); P.deleteProperty('RAW_CHANGE_ALLOW');
    return scLog_('原文_5_内容変化を公式に合わせる_承認後', a);
  } finally { lock.releaseLock(); }
}
function 原文_9_直前の補完を戻す() { return scLog_('原文_9_直前の補完を戻す', rawUndo_('原文_9')); }

// ===== 関連記事の保全確認（読むだけ、2026-11-16 最終指令 3）=====
// V2の保存済み原文（SHA一致）を今の清掃器で分け、原文の記事URLがすべて関連記事JSONに残るか・見出しの有無・種類を数える。結果は COPY「関連記事・保全監査」
var REL_AUDIT_SHEET_ = '関連記事・保全監査', REL_AUDIT_HEADERS_ = ['EP-ID', '原文の記事URL数', '保存できた記事数', '取りこぼし', '見出しなし（見える記事）', '非表示リンク', '動画', '参考文献', 'リンク', '宣伝', 'SNS', '保留理由', '清掃版'];
function 関連_1_保全監査_READ_ONLY() {
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), pre = scPreservedRaw_(), eps = Object.keys(pre).sort(), start = Number(P.getProperty('REL_AUDIT_CURSOR') || 0), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  var sh = start ? c.ss.getSheetByName(REL_AUDIT_SHEET_) : null; if (!sh) { laWriteSheet_(c.ss, REL_AUDIT_SHEET_, REL_AUDIT_HEADERS_, []); sh = c.ss.getSheetByName(REL_AUDIT_SHEET_); start = 0; }
  var ART = /^https?:\/\/(?:www\.asahi\.com\/(?:[a-z]+\/)?articles\/|digital\.asahi\.com\/articles\/|withnews\.jp\/article\/|globe\.asahi\.com\/article\/|book\.asahi\.com\/article\/|smbiz\.asahi\.com\/article\/|www\.asahi\.com\/(?:sdgs|and|edu)\/article\/|www\.asahi\.com\/special\/(?!podcasts))/;
  var out = [], i = start, ver = CleanerV4.CLEANER_VERSION;
  for (; i < eps.length; i++) {
    if (i % 50 === 0 && Date.now() - t0 > SC_CONFIG.timeBudgetMs) break;
    var raw = pre[eps[i]].text, r = CleanerV4.cleanV4(raw), keyOf = function (u) { return QualityAudit.cleanUrl(String(u).replace(/&amp;/g, '&').replace(/[.,;]+$/, '').replace(/&nbsp;?$/, '')); };
    var vis = (raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;?/g, ' ').replace(/&amp;/g, '&').match(/https?:\/\/(?:(?!https?:\/\/)[A-Za-z0-9\-._~:/?#\[\]@!$&*+,;=%])+/g) || []);
    var hrefs = []; raw.replace(/<a\b[^>]*?href\s*=\s*["']([^"']+)["']/gi, function (m, u) { hrefs.push(u); return m; });
    var want = {}; vis.concat(hrefs).forEach(function (u) { if (ART.test(u)) want[keyOf(u)] = 1; });
    var got = {}; r.related.forEach(function (x) { if (x.url) got[keyOf(x.url)] = 1; });
    var miss = Object.keys(want).filter(function (u) { return !got[u]; }), k = function (kind) { return r.related.filter(function (x) { return x.kind === kind; }).length; };
    out.push([eps[i], Object.keys(want).length, k('article'), miss.length ? miss.length + ' ' + miss.slice(0, 3).join(' ') : 0, r.related.filter(function (x) { return x.kind === 'article' && !x.title && !x.hiddenLink; }).length, r.related.filter(function (x) { return x.hiddenLink; }).length, k('video'), k('reference'), k('link'), k('promo'), k('sns'), r.holds.join(' '), ver]);
  }
  if (out.length) scChunkWrite_(sh, sh.getLastRow() + 1, out, REL_AUDIT_HEADERS_.length);
  var done = i >= eps.length; if (done) P.deleteProperty('REL_AUDIT_CURSOR'); else P.setProperty('REL_AUDIT_CURSOR', String(i));
  var sum = null; if (done) { var all = sh.getRange(2, 1, sh.getLastRow() - 1, REL_AUDIT_HEADERS_.length).getDisplayValues(); sum = { episodes: all.length, rawArticleUrls: 0, kept: 0, episodesWithLoss: 0, noTitleVisible: 0, hidden: 0, video: 0, reference: 0, link: 0, promo: 0, sns: 0 };
    all.forEach(function (r) { sum.rawArticleUrls += +r[1]; sum.kept += +r[2]; if (r[3] !== '0') sum.episodesWithLoss++; sum.noTitleVisible += +r[4]; sum.hidden += +r[5]; sum.video += +r[6]; sum.reference += +r[7]; sum.link += +r[8]; sum.promo += +r[9]; sum.sns += +r[10]; }); }
  return scLog_('関連_1_保全監査_READ_ONLY', { status: done ? 'DONE' : 'PARTIAL_RESUME_NEEDED（もう一度押すと続きから）', processed: i, total: eps.length, summary: sum, sheet: 'COPY「' + REL_AUDIT_SHEET_ + '」', version: ver, ms: Date.now() - t0 });
}
// 回帰の実データ確認（読むだけ）: 事故の起きた回が今の清掃器で正しく分かれるか。合否と件数だけを出す（本文は出さない）
function 概要欄_R_回帰確認_READ_ONLY() {
  var pre = scPreservedRaw_(), res = {}, fail = 0;
  var cases = {
    'EP-06630': function (r) { var a = r.related.filter(function (x) { return x.kind === 'article'; }); return a.length === 3 && a.every(function (x) { return x.title && x.url; }) && !/PODCAST MEETING|月額/.test(r.text) && r.cast.length === 3; },
    'EP-06631': function (r) { return r.socials.indexOf('https://x.com/MangaLearn') >= 0 && !/Xから/.test(r.text) && r.cast.length === 2; },
    'EP-03025': function (r) { return r.related.filter(function (x) { return x.kind === 'article'; }).length === 3 && r.text.length > 50 && r.holds.indexOf('CONTENT_EMPTY') < 0; },
    'EP-00605': function (r) { return /プレコンセプションケア/.test(r.text) && r.related.filter(function (x) { return x.kind === 'article'; }).length >= 1; },
    'EP-01176': function (r) { return r.related.filter(function (x) { return x.kind === 'article'; }).every(function (x) { return !/[^\x00-\x7F]/.test(x.url); }) && r.related.filter(function (x) { return x.kind === 'article'; }).length === 3; },
    'EP-01271': function (r) { return /読み解きます/.test(r.text) && r.related.some(function (x) { return x.kind === 'article'; }); },
    'EP-02417': function (r) { return r.related.filter(function (x) { return x.kind === 'article' && /smbiz/.test(x.url); }).length === 4; },
    'EP-04021': function (r) { return r.related.filter(function (x) { return x.hiddenLink; }).every(function (x) { return !x.title; }); },
    'EP-01110': function (r) { return r.cast.every(function (c) { return !/^https?:/.test(c.raw); }); }
  };
  Object.keys(cases).forEach(function (ep) { if (!pre[ep]) { res[ep] = '原文なし（未確認）'; return; } var r = CleanerV4.cleanV4(pre[ep].text), ok = false; try { ok = cases[ep](r); } catch (e) { ok = false; } res[ep] = ok ? 'PASS' : 'FAIL'; if (!ok) fail++; });
  return scLog_('概要欄_R_回帰確認_READ_ONLY', { status: fail ? 'FAIL' : 'PASS', version: CleanerV4.CLEANER_VERSION, results: res });
}

// ===== 概要欄: COPYで少数件の書込→読み戻し→再実行で差分0→取消 を1回で確かめる（2026-11-16 最終指令 5。V2は読むだけ）=====
// 対象: COPY「清掃・結果(V2基準)」で、今の値が照合不合格（SV_OLD_FAIL）かつ新しい値が自動検査合格の回のうち、
//       COPYの台帳の今の値が V2基準の旧値と同じ回を最大10件（＝本番の 概要欄_7 と同じ条件の回で試す）
function 概要欄_T_COPY少数件試験() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(SUM_RES_V2_); if (!res || res.getLastRow() < 2) return scLog_('概要欄_T_COPY少数件試験', { status: 'STOP_NO_V2BASE_RESULT（先に 概要欄_2V を DONE まで）' });
  var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
  var L = scLedger_(c.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
  var rs = res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues(), scope = {}, picked = [], before = {};
  rs.forEach(function (r) { if (picked.length >= 10) return; var x = byEp[r[H['EP-ID']]];
    if (!x || r[H['判定']] !== '自動検査合格・目視未確認' || !/SV_OLD_FAIL/.test(r[H['理由']]) || !/summary/.test(r[H['書換可']])) return;
    if (x.summary !== r[H['旧・概要']] || x.cast !== r[H['旧・出演者']] || x.related !== r[H['旧・関連記事URL']]) return;
    scope[x.ep] = 1; picked.push(x.ep); before[x.ep] = { summary: x.summary, cast: x.cast, related: x.related }; });
  if (!picked.length) return scLog_('概要欄_T_COPY少数件試験', { status: 'STOP_NO_CANDIDATE' });
  var PP = PropertiesService.getScriptProperties(), prevLast = PP.getProperty('SC_LAST_APPLY');   // 本番の取消（S9）の対象を試験で消さないよう、終わったら元に戻す
  var a1 = scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 10, SUM_RES_V2_, scope);
  var L2 = scLedger_(c.sh), by2 = {}; L2.rows.forEach(function (r) { by2[r.ep] = r; });
  var asPlanned = 0, keyCols = { summary: '新・概要', cast: '新・出演者', related: '新・関連記事URL' };
  rs.forEach(function (r) { if (!scope[r[H['EP-ID']]]) return; var x = by2[r[H['EP-ID']]], ok = String(r[H['書換可']]).split('+').every(function (k) { return String(x[k]) === String(r[H[keyCols[k]]]); }); if (ok) asPlanned++; });
  var a2 = scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 10, SUM_RES_V2_, scope);
  var u = S9_直前の反映を取消(); if (prevLast) PP.setProperty('SC_LAST_APPLY', prevLast);
  var L3 = scLedger_(c.sh), back = 0; L3.rows.forEach(function (r) { var b = before[r.ep]; if (b && r.summary === b.summary && r.cast === b.cast && r.related === b.related) back++; });
  var ok = a1.status === 'OK' && asPlanned === picked.length && a2.status === 'OK_NO_CHANGE' && u.status === 'OK' && back === picked.length;
  return scLog_('概要欄_T_COPY少数件試験', { status: ok ? 'PASS' : 'FAIL', eps: picked, write: { status: a1.status, cells: a1.cellsWritten, episodes: a1.episodes }, readbackAsPlanned: asPlanned + '/' + picked.length, rerun: { status: a2.status, cells: a2.cellsWritten }, undo: u, backToBefore: back + '/' + picked.length, note: 'COPYの台帳だけ。V2は読むだけ' });
}

// ===== V2・清掃詳細（関連記事の見出し＋URLの組・出演者の内訳）を最新の判定で更新（2026-11-16 最終指令 3・4）=====
// 元は COPY「清掃・結果(V2基準)」（概要欄_2V の結果）。関連記事JSON・出演者JSON・SNS等保全URL・原文SHA・清掃版は全話を最新にする。
// 「判定・理由」は、V2台帳の今の3列が新しい値と同じ回だけ更新する（台帳に書いていない回を「合格・反映済み」と記録しない＝概要欄_4 の範囲を勝手に狭めない）。
var SUM_DETAIL_KEY_ = 'APPROVE_SUMMARY_DETAIL';
function sumDetailRows_() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(sumResV2_()), H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
  var ds = v.ss.getSheetByName(SC_V2DETAIL_), old = {}; if (ds && ds.getLastRow() > 1) ds.getRange(2, 1, ds.getLastRow() - 1, SC_V2DETAIL_HEADERS_.length).getDisplayValues().forEach(function (r) { old[r[0]] = r; });
  var keepJudge = 0, rows = res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues().map(function (r) {
    var x = byEp[r[H['EP-ID']]], same = x && ['summary', 'cast', 'related'].every(function (k) { var nv = r[H[{ summary: '新・概要', cast: '新・出演者', related: '新・関連記事URL' }[k]]]; return !nv || String(x[k]) === String(nv); });
    if (!same && old[r[H['EP-ID']]]) { r = r.slice(); r[H['判定']] = old[r[H['EP-ID']]][7]; r[H['理由']] = old[r[H['EP-ID']]][8]; keepJudge++; }
    return r; });
  return { v: v, L: L, rows: rows, H: H, keepJudge: keepJudge, oldRows: Object.keys(old).length };
}
function 概要欄_8P_清掃詳細_予行_READ_ONLY() {
  var d = sumDetailRows_(), n = SC_V2DETAIL_HEADERS_.length, ds = d.v.ss.getSheetByName(SC_V2DETAIL_), cur = {}, changed = 0, json = 0, H = d.H;
  if (ds && ds.getLastRow() > 1) ds.getRange(2, 1, ds.getLastRow() - 1, n).getDisplayValues().forEach(function (r) { cur[r[0]] = r; });
  d.rows.forEach(function (r) { var o = cur[r[H['EP-ID']]]; if (!o || o[2] !== r[H['関連記事JSON(見出し+URL)']] || o[3] !== r[H['出演者JSON']] || o[6] !== r[H['清掃版']]) changed++; if (o && o[2] !== r[H['関連記事JSON(見出し+URL)']]) json++; });
  return scLog_('概要欄_8P_清掃詳細_予行_READ_ONLY', { status: 'OK', detailRowsNow: d.oldRows, rowsToUpdate: changed, relatedJsonChanges: json, judgeKeptBecauseLedgerNotUpdated: d.keepJudge, note: 'V2は読むだけ' });
}
function 概要欄_0D_承認_清掃詳細() { PropertiesService.getScriptProperties().setProperty(SUM_DETAIL_KEY_, sumToday_()); return scLog_('概要欄_0D_承認_清掃詳細', { status: 'APPROVED', validOn: sumToday_() }); }
function 概要欄_8_V2清掃詳細の更新_承認後() {
  var P = PropertiesService.getScriptProperties(); if (P.getProperty(SUM_DETAIL_KEY_) !== sumToday_()) return scLog_('概要欄_8_V2清掃詳細の更新_承認後', { status: 'NOT_APPROVED_TODAY', note: '先に 概要欄_0D_承認_清掃詳細' });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('概要欄_8_V2清掃詳細の更新_承認後', { status: 'LOCKED' });
  try {
    var d = sumDetailRows_(), ds0 = d.v.ss.getSheetByName(SC_V2DETAIL_), bk = '';
    if (ds0 && ds0.getLastRow() > 1) { var c0 = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), vals = ds0.getRange(1, 1, ds0.getLastRow(), SC_V2DETAIL_HEADERS_.length).getDisplayValues();   // 更新前の清掃詳細を COPY へ退避（戻すときはこのタブの値を貼る）
      bk = '退避_V2清掃詳細_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm'); var b0 = c0.ss.insertSheet(bk); scChunkWrite_(b0, 1, vals, vals[0].length); SpreadsheetApp.flush();
      if (b0.getRange(1, 1, vals.length, vals[0].length).getDisplayValues().join('\u0002') !== vals.join('\u0002')) return scLog_('概要欄_8_V2清掃詳細の更新_承認後', { status: 'STOP_BACKUP_MISMATCH', backup: bk }); }
    var r = scV2DetailUpsert_(d.v.ss, d.L, d.rows, d.H, null, new Date().toISOString());
    P.deleteProperty(SUM_DETAIL_KEY_);
    return scLog_('概要欄_8_V2清掃詳細の更新_承認後', { status: r.readbackMismatch ? 'READBACK_MISMATCH' : 'OK', rows: r.rows, changed: r.changed, hold: r.hold, rawMissing: r.rawMissing, readbackMismatch: r.readbackMismatch, judgeKeptBecauseLedgerNotUpdated: d.keepJudge, backup: bk ? 'COPY「' + bk + '」' : '（更新前の行なし）' });
  } finally { lock.releaseLock(); }
}
// COPY試験: 清掃詳細の更新と同じ処理を COPY の「V2・清掃詳細」タブへ20話だけ書く → 読み戻し → 再実行で変更0（V2は読むだけ）
function 概要欄_8T_COPY試験() {
  var d = sumDetailRows_(), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), only = {}, H = d.H;
  d.rows.filter(function (r) { return /"kind":"article"/.test(r[H['関連記事JSON(見出し+URL)']]); }).slice(0, 18).forEach(function (r) { only[r[H['EP-ID']]] = 1; }); only['EP-06630'] = 1; only['EP-06631'] = 1;
  var now = new Date().toISOString(), a = scV2DetailUpsert_(c.ss, d.L, d.rows, H, only, now), b = scV2DetailUpsert_(c.ss, d.L, d.rows, H, only, now);
  var ds = c.ss.getSheetByName(SC_V2DETAIL_), v = ds.getRange(2, 1, ds.getLastRow() - 1, SC_V2DETAIL_HEADERS_.length).getDisplayValues(), byEp = {}; v.forEach(function (r) { byEp[r[0]] = r; });
  var src = {}; d.rows.forEach(function (r) { src[r[H['EP-ID']]] = r; });
  var same = Object.keys(only).filter(function (e) { return byEp[e] && byEp[e][2] === src[e][H['関連記事JSON(見出し+URL)']]; }).length;
  var e630 = byEp['EP-06630'] ? JSON.parse(byEp['EP-06630'][2] || '[]').filter(function (x) { return x.kind === 'article' && x.title && x.url; }).length : -1;
  var ok = a.readbackMismatch === 0 && b.changed === 0 && same === Object.keys(only).length && e630 === 3;
  return scLog_('概要欄_8T_COPY試験', { status: ok ? 'PASS' : 'FAIL', episodes: Object.keys(only).length, first: { changed: a.changed, readbackMismatch: a.readbackMismatch }, rerun: { changed: b.changed }, relatedJsonAsPlanned: same + '/' + Object.keys(only).length, ep06630ArticlePairs: e630, sheet: 'COPY「' + SC_V2DETAIL_ + '」（試験用）' });
}

// ===== P27 配信先URLロボ: 下調べ（読むだけ、2026-11-17 設計書 docs/design/2026-11-17-platform-url-robot-design.md §2）=====
// Pocket Casts・Pody・Amazon Music の番組ページ／公開データを1回ずつ取り、回ごとのID・題名・日時が機械的に取れるかを表にする。
// V2・おんさ原本には触れない。結果は COPY「P27・下調べ」。各URLは1回だけ取得（大量取得はしない）。
var P27_PROBE_SHEET_ = 'P27・下調べ';
var P27_PROBE_TARGETS_ = [
  ['Pody', '番組ページ ドーナツ', 'https://pody.jp/player/to04ABW3puiCBtAvp6Wx'],
  ['Pody', '番組ページ スポンジ', 'https://pody.jp/player/SLYemnwXxXWVj4z0zqt0'],
  ['Pody', '番組ページ MEDIA TALK', 'https://pody.jp/player/woMdDOpTDIxhqS4HtAsS'],
  ['Pody', '番組ページ ニュースの現場から', 'https://pody.jp/player/4UD5sHilP15gqAc0clXN'],
  ['Pody', '番組ページ 報談', 'https://pody.jp/player/sDYbQUEUe07sRv1wMI9z'],
  ['Pody', '番組ページ こどもそうだんしつ', 'https://pody.jp/player/8aeTZ7uuPPmWLxZTkRER'],
  ['Pocket Casts', '番組ページ ニュースの現場から', 'https://pocketcasts.com/podcast/ce4f8cb0-c119-0138-e716-0acc26574db2'],
  ['Pocket Casts', '公開データ(podcast-api) ニュースの現場から', 'https://podcast-api.pocketcasts.com/podcast/full/ce4f8cb0-c119-0138-e716-0acc26574db2'],
  ['Pocket Casts', '公開データ(cache) ニュースの現場から', 'https://cache.pocketcasts.com/mobile/podcast/full/ce4f8cb0-c119-0138-e716-0acc26574db2'],
  ['Pocket Casts', '公開データ(podcast-api) 報談', 'https://podcast-api.pocketcasts.com/podcast/full/e2bb4c60-c679-0138-e72c-0acc26574db2'],
  ['Pocket Casts', '回ページ EP-00001（V2既存URL）', 'https://pca.st/episode/17496f9e-d20a-4b32-9c66-85954538a1d0'],
  ['Amazon Music', '番組ページ ニュースの現場から', 'https://music.amazon.co.jp/podcasts/7337408b-4752-4a85-8f27-4208a2ca8b1d']
];
function p27ProbeOne_(url) {
  var r, code = 0, body = '', type = '', err = '';
  try { r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'Accept-Language': 'ja,en;q=0.8' } }); code = r.getResponseCode(); body = r.getContentText(); type = String((r.getHeaders() || {})['Content-Type'] || ''); }
  catch (e) { err = String(e).slice(0, 120); }
  var out = { code: code, type: type.slice(0, 40), bytes: body.length, err: err };
  if (!body) return out;
  var t = body.trim();
  if (/^[\[{]/.test(t)) {   // JSON
    try { var j = JSON.parse(t), eps = null, walk = function (x, d) { if (!x || d > 5 || eps) return; if (Array.isArray(x)) { if (x.length && typeof x[0] === 'object' && (x[0].title || x[0].name) && (x[0].published || x[0].date || x[0].url || x[0].uuid)) eps = x; else x.forEach(function (y) { walk(y, d + 1); }); return; } if (typeof x === 'object') Object.keys(x).forEach(function (k) { walk(x[k], d + 1); }); };
      walk(j, 0); out.json = { topKeys: Object.keys(j).slice(0, 12).join(','), episodeArray: eps ? eps.length : 0, firstEpisodeKeys: eps ? Object.keys(eps[0]).slice(0, 20).join(',') : '', firstEpisode: eps ? JSON.stringify({ title: eps[0].title, published: eps[0].published || eps[0].date, duration: eps[0].duration, uuid: eps[0].uuid, url: eps[0].url }).slice(0, 400) : '' };
    } catch (e) { out.json = { parseError: String(e).slice(0, 80) }; }
    return out;
  }
  var tt = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '', og = (body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i) || [])[1] || '';
  var links = function (re) { var s = {}; (body.match(re) || []).forEach(function (m) { s[m] = 1; }); var k = Object.keys(s); return { n: k.length, sample: k.slice(0, 3).join(' ') }; };
  out.html = {
    title: tt.replace(/\s+/g, ' ').trim().slice(0, 100), ogTitle: og.slice(0, 100), nextData: /id=["']__NEXT_DATA__["']/.test(body), jsonLd: (body.match(/application\/ld\+json/g) || []).length,
    needsJs: /enable JavaScript|JavaScriptを有効/i.test(body) && body.length < 20000,
    podyEpisodeLinks: links(/(?:https?:\/\/pody\.jp)?\/(?:player|episode|episodes|e)\/[A-Za-z0-9_-]{8,}\/[A-Za-z0-9_-]{6,}/g),
    pcEpisodeLinks: links(/(?:pca\.st|pocketcasts\.com)\/episode\/[0-9a-f-]{36}/g),
    amazonEpisodeLinks: links(/podcasts\/[0-9a-f-]{36}\/episodes\/[0-9a-f-]{36}/g),
    isoDates: (body.match(/20\d\d-\d\d-\d\dT\d\d:\d\d/g) || []).length, audioUrls: links(/https?:\/\/[^"'\s]+\.mp3[^"'\s]*/g).n
  };
  return out;
}
function P27_0_下調べ_READ_ONLY() {
  var t0 = Date.now(), rows = [], sum = {};
  P27_PROBE_TARGETS_.forEach(function (x) {
    var o = p27ProbeOne_(x[2]), h = o.html || {}, j = o.json || {};
    var verdict = o.err ? '取得エラー' : o.code !== 200 ? 'HTTP ' + o.code : j.episodeArray ? '一覧JSONあり（' + j.episodeArray + '件）' : (h.podyEpisodeLinks && h.podyEpisodeLinks.n) || (h.pcEpisodeLinks && h.pcEpisodeLinks.n) || (h.amazonEpisodeLinks && h.amazonEpisodeLinks.n) ? 'HTMLに回のリンクあり' : h.nextData ? '__NEXT_DATA__あり（中身を要確認）' : h.needsJs ? 'JavaScriptが必要（GASでは読めない）' : '回の情報が見えない';
    rows.push([x[0], x[1], x[2], verdict, o.code, o.type, o.bytes, JSON.stringify(h).slice(0, 1500), JSON.stringify(j).slice(0, 1500), o.err, new Date().toISOString()]);
    sum[x[0] + '｜' + x[1]] = verdict;
    Utilities.sleep(800);   // 相手先への配慮（連続取得しない）
  });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, P27_PROBE_SHEET_, ['配信先', '対象', 'URL', '判定', 'HTTP', '種類', 'バイト', 'HTMLの要約', 'JSONの要約', 'エラー', '確認日時'], rows);
  return scLog_('P27_0_下調べ_READ_ONLY', { status: 'OK', results: sum, sheet: 'COPY「' + P27_PROBE_SHEET_ + '」', ms: Date.now() - t0 });
}

// ===== P27 配信先URLロボ 第2段階（2026-11-17 08:02 司令塔「P27 第2段階実行指令」）=====
// Pocket Casts: 公開データ（podcast-api.pocketcasts.com/podcast/full/<番組ID>）の各回を V2 と 1対1 で照合（PlatformMatch）。
// 安全装置は P26 と同じ考え方（既存 P26 ファイルには触れない）: 空欄だけ・上限・履歴を先に書く→書込→読み戻し・不一致で停止旗・ロック・取消・未完了確認・停止解除。
// V2 への書込は P27_V2_WRITE_ENABLED_ が false の間はコードで止める（本番配置・V2書込は未承認）。
var P27_V2_WRITE_ENABLED_ = false;
var P27_PC_SHOWS_ = {   // 番組ID は サイト掲載の Pocket Casts 番組URL で確認できたものだけ（推測しない）。照合の一致率で番組の取り違えも検査する
  'ニュースの現場から': 'ce4f8cb0-c119-0138-e716-0acc26574db2',
  '報談': 'e2bb4c60-c679-0138-e72c-0acc26574db2',
  'ドーナツ': 'eac35880-7806-013f-17c3-0affc24a29f5',
  // 2026-11-17 P27_ID_1: 台帳の Apple 番組ID → 公開の転送リンク pca.st/itunes/<id> の転送先で確認し、公開データの回と台帳の一致率（97.6〜100%）で検査したもの
  'MEDIA TALK': 'e2e4c3f0-c679-0138-e72c-0acc26574db2',
  'スポンジ': 'd88b2460-7e69-013f-f21c-0affd341b2cf',
  'こどもそうだんしつ': '99d4f220-1d27-013a-d5ca-0acc26574db2',
  'ニュースの学校': '52e7ed60-5a72-0139-33d1-0acc26574db2'
};
var P27_COL_ = 'Pocket Casts', P27_PC_SHEET_ = 'P27・PC照合', P27_PC_EXTRA_ = 'P27・PC余り', P27_HIST_ = 'P27・反映履歴', P27_STATE_KEY_ = 'P27_STATE', P27_COPY_MAX_ = 10, P27_V2_MAX_PER_RUN_ = 300;
var P27_HIST_H_ = ['日時', '反映ID', '対象', 'EP-ID', '列', '変更前', '変更後', '根拠', '状態'];
var P27_PC_H_ = ['EP-ID', '番組', '判定', '処理', '方法', '題名一致', '配信時刻の差(時間)', '長さの差(秒)', '書くURL', '既存URL', '既存URLのID', '既存URLの確認', 'IDの確認', 'ページ確認'];
function p27State_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty(P27_STATE_KEY_) || '{"stop":false}'); }
function p27SetState_(s) { PropertiesService.getScriptProperties().setProperty(P27_STATE_KEY_, JSON.stringify(s)); }
// 台帳を見出し名で読む（V2 でも COPY でも同じ）
function p27Ledger_(ss, col) {
  col = col || P27_COL_;
  var sh = ss.getSheetByName('V2・統合台帳'); if (!sh) throw new Error('P27_NO_LEDGER');
  var v = sh.getDataRange().getDisplayValues(), h = v[0], need = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '公式GUID', '音声URL', '再生時間 秒', col], ix = {};
  need.forEach(function (n) { ix[n] = h.indexOf(n); if (ix[n] < 0) throw new Error('P27_HEADER_MISSING:' + n); });
  var rows = []; v.forEach(function (r, i) { if (!i || !String(r[ix['EP-ID']]).trim()) return; rows.push({ ep: r[ix['EP-ID']].trim(), show: r[ix['番組']], title: r[ix['タイトル']], published: r[ix['配信日時 JST']], guid: String(r[ix['公式GUID']]).trim().toLowerCase(), audio: r[ix['音声URL']], duration: Number(r[ix['再生時間 秒']]) || 0, current: String(r[ix[col]] || '').trim(), row: i + 1 }); });
  return { sh: sh, rows: rows, col: ix[col] + 1, colName: col };
}
function p27PcFetch_(showId) {
  var r = UrlFetchApp.fetch('https://podcast-api.pocketcasts.com/podcast/full/' + showId, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { error: 'HTTP ' + r.getResponseCode(), eps: [] };
  var j = JSON.parse(r.getContentText()); return { eps: PlatformMatch.pcEpisodesFromJson(j), title: (j.podcast || {}).title || '', hasMore: !!j.has_more_episodes, count: j.episode_count };
}
// 照合（番組ごと）。番組の取り違え検査: その番組の公開データの回のうち、V2 の同じ番組の行と結べた割合が5割未満なら番組ごと使わない
function p27PcPlan_(L) {
  var all = [], extra = [], shows = {};
  Object.keys(P27_PC_SHOWS_).forEach(function (show) {
    var f = p27PcFetch_(P27_PC_SHOWS_[show]), v2 = L.rows.filter(function (r) { return r.show === show; });
    if (f.error) { shows[show] = { status: 'FETCH_ERROR', error: f.error }; return; }
    var m = PlatformMatch.matchPlatform(v2, f.eps, { urlOf: function (e) { return e.url; }, isValidUrl: function (u) { return PlatformMatch.PC_EPISODE_URL.test(u); }, idOfUrl: PlatformMatch.pcUuidOf });
    var linked = f.eps.length - m.summary.platformUnmatched, ratio = f.eps.length ? linked / f.eps.length : 0;
    shows[show] = { status: ratio >= 0.5 ? 'OK' : 'STOP_SHOW_MISMATCH', pcTitle: f.title, pcEpisodes: f.eps.length, pcHasMore: f.hasMore, v2Rows: v2.length, linkedRatio: Math.round(ratio * 1000) / 10 + '%', summary: m.summary };
    var idSet = {}; f.eps.forEach(function (e) { idSet[e.id] = 1; });
    m.rows.forEach(function (x) {
      if (shows[show].status !== 'OK' && x.action === 'WRITE') { x.action = 'HOLD'; x.verdict = '保留: 番組の一致率が低い（番組IDを要確認）'; }
      var r = v2.filter(function (y) { return y.ep === x.ep; })[0];
      all.push({ x: x, r: r, idCheck: x.id ? (idSet[x.id] ? 'API確認済み（公開データにIDあり）' : 'IDなし') : '', page: x.url ? '未検証（ページは403で確認不能）' : '' });
    });
    m.unmatchedEps.forEach(function (e) { extra.push([show, e.id, PlatformMatch.pcEpisodeUrl(e.id), e.title, e.published]); });
  });
  return { all: all, extra: extra, shows: shows };
}
function P27_PC_1_照合_READ_ONLY() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = p27Ledger_(v.ss), p = p27PcPlan_(L), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, P27_PC_SHEET_, P27_PC_H_, p.all.map(function (a) { var x = a.x; return [x.ep, x.show, x.verdict, x.action, x.method || '', x.titleSame === undefined ? '' : x.titleSame, x.hoursApart, x.durationDiff, x.url || '', x.current, x.currentId, x.existingCheck || '', a.idCheck, a.page]; }));
  laWriteSheet_(c.ss, P27_PC_EXTRA_, ['番組', 'Pocket Casts ID', 'URL', '題名', '配信日時(UTC)'], p.extra);
  var tot = { v2Rows: 0, write: 0, hold: 0, byVerdict: {}, byMethod: {}, existingCheck: {} };
  p.all.forEach(function (a) { var ec = String(a.x.existingCheck || '').replace(/・時刻差.*$/, ''); if (ec) tot.existingCheck[a.x.show + '｜' + ec] = (tot.existingCheck[a.x.show + '｜' + ec] || 0) + 1; tot.v2Rows++; tot.byVerdict[a.x.verdict] = (tot.byVerdict[a.x.verdict] || 0) + 1; if (a.x.action === 'WRITE') tot.write++; if (a.x.action === 'HOLD') tot.hold++; if (a.x.method && a.x.action !== 'HOLD') tot.byMethod[a.x.method] = (tot.byMethod[a.x.method] || 0) + 1; });
  return scLog_('P27_PC_1_照合_READ_ONLY', { status: 'OK', shows: p.shows, total: tot, platformUnmatched: p.extra.length, sheets: 'COPY「' + P27_PC_SHEET_ + '」「' + P27_PC_EXTRA_ + '」', version: PlatformMatch.PLATFORM_MATCH_VERSION, ms: Date.now() - t0 });
}
// 書込の共通部（COPY / V2）。plan: [{ ep, url, basis }]
function p27Write_(target, ss, plan, max, col, re) {
  col = col || P27_COL_; re = re || PlatformMatch.PC_EPISODE_URL;
  var st = p27State_(); if (st.stop) return { status: 'STOPPED', note: '停止旗が立っている → P27_PC_8_未完了の確認 → P27_PC_9_停止解除' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, P27_HIST_, P27_HIST_H_), L = p27Ledger_(ss, col), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
    var now = new Date().toISOString(), id = now + '/' + target + '/P27', go = [], skip = {}, sk = function (k) { skip[k] = (skip[k] || 0) + 1; };
    plan.forEach(function (p) { if (go.length >= max) { sk('上限（もう一度押すと続き）'); return; } var r = byEp[p.ep]; if (!r) { sk('行なし'); return; } if (r.current === p.url) { sk('既に同じURL'); return; } if (r.current) { sk('空欄でない（上書きしない）'); return; } if (!re.test(p.url)) { sk('URLの形が不正'); return; } go.push({ p: p, r: r }); });
    if (!go.length) return { status: 'OK_NO_CHANGE', target: target, skipped: skip };
    var h0 = hist.getLastRow() + 1; scChunkWrite_(hist, h0, go.map(function (g) { return [now, id, target, g.p.ep, col, '', g.p.url, g.p.basis, 'PENDING']; }), P27_HIST_H_.length); SpreadsheetApp.flush();
    st.pending = id; st.last = { id: id, target: target, col: col }; p27SetState_(st);
    go.forEach(function (g) { L.sh.getRange(g.r.row, L.col).setValue(g.p.url); }); SpreadsheetApp.flush();
    var back = p27Ledger_(ss, col), bb = {}, bad = 0; back.rows.forEach(function (r) { bb[r.ep] = r; });
    var res = go.map(function (g) { var ok = bb[g.p.ep] && bb[g.p.ep].current === g.p.url && bb[g.p.ep].row === g.r.row; if (!ok) bad++; return [ok ? 'OK' : 'READBACK_MISMATCH']; });
    hist.getRange(h0, P27_HIST_H_.length, res.length, 1).setValues(res);
    st.pending = ''; if (bad) st.stop = true; p27SetState_(st);
    return { status: bad ? 'READBACK_MISMATCH（停止旗を立てた）' : 'OK', target: target, column: col, written: go.length, readbackMismatch: bad, skipped: skip, applyId: id, eps: go.map(function (g) { return g.p.ep; }) };
  } finally { lock.releaseLock(); }
}
function p27Undo_(ss) {
  var st = p27State_(), last = st.last; if (!last) return { status: 'NOTHING_TO_UNDO' };
  var col = last.col || P27_COL_, c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, P27_HIST_, P27_HIST_H_), L = p27Ledger_(ss, col), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
  var rows = hist.getRange(2, 1, Math.max(1, hist.getLastRow() - 1), P27_HIST_H_.length).getDisplayValues().filter(function (r) { return r[1] === last.id && /^(OK|PENDING|READBACK_MISMATCH)$/.test(r[8]); });
  // 取消対象の履歴が見つからない場合、成功扱いで反映IDを消してはならない。
  if (!rows.length) return { status: 'UNDO_HISTORY_MISSING', target: last.target, column: col, applyId: last.id };
  var undone = 0, kept = 0, out = [], now = new Date().toISOString();
  rows.forEach(function (r) { var x = byEp[r[3]]; if (!x) return; if (x.current !== r[6]) { kept++; return; } L.sh.getRange(x.row, L.col).setValue(r[5]); undone++; out.push([now, last.id + '/UNDO', last.target, r[3], r[4], r[6], r[5], '取消', 'UNDO']); });
  if (out.length) scChunkWrite_(hist, hist.getLastRow() + 1, out, P27_HIST_H_.length); SpreadsheetApp.flush();
  var back = p27Ledger_(ss, col), bb = {}; back.rows.forEach(function (r) { bb[r.ep] = r; }); var mism = rows.filter(function (r) { return bb[r[3]] && bb[r[3]].current !== r[5] && bb[r[3]].current === r[6]; }).length;
  if (!mism && !kept) { delete st.last; if (st.pending === last.id) st.pending = ''; p27SetState_(st); }
  return { status: mism ? 'UNDO_READBACK_MISMATCH' : kept ? 'MANUAL_CHANGE_PROTECTED' : 'OK', target: last.target, column: col, undone: undone, keptBecauseChangedAfter: kept };
}
// COPY試験（V2は読むだけ）: 確定分から最大10件を COPY の台帳コピーへ → 読み戻し → 再実行で0件 → 取消で復元、を1回で
function P27_PC_2_COPY試験() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27PcPlan_(p27Ledger_(v.ss)), CL = p27Ledger_(c.ss), cb = {}; CL.rows.forEach(function (r) { cb[r.ep] = r; });
  // COPY の行が V2 の行と同じ回（EP-ID・公式GUID）で、COPY 側も空欄のものだけ
  var plan = p.all.filter(function (a) { var y = cb[a.x.ep]; return a.x.action === 'WRITE' && y && y.guid === a.r.guid && !y.current; }).slice(0, P27_COPY_MAX_).map(function (a) { return { ep: a.x.ep, url: a.x.url, basis: a.x.method + '・' + a.idCheck + '・' + a.page }; });
  if (!plan.length) return scLog_('P27_PC_2_COPY試験', { status: 'STOP_NO_CANDIDATE' });
  var before = {}; plan.forEach(function (q) { before[q.ep] = cb[q.ep].current; });
  var a1 = p27Write_('COPY', c.ss, plan, P27_COPY_MAX_), a2 = p27Write_('COPY', c.ss, plan, P27_COPY_MAX_);
  var mid = p27Ledger_(c.ss), mb = {}; mid.rows.forEach(function (r) { mb[r.ep] = r; });
  var asPlanned = plan.filter(function (q) { return mb[q.ep].current === q.url; }).length;
  var others = CL.rows.filter(function (r) { return !before.hasOwnProperty(r.ep); }).every(function (r) { return mb[r.ep] && mb[r.ep].current === r.current; });
  var u = p27Undo_(c.ss), fin = p27Ledger_(c.ss), fb = {}; fin.rows.forEach(function (r) { fb[r.ep] = r; });
  var restored = plan.filter(function (q) { return fb[q.ep].current === before[q.ep]; }).length;
  var ok = a1.status === 'OK' && a1.readbackMismatch === 0 && asPlanned === plan.length && others && a2.status === 'OK_NO_CHANGE' && u.status === 'OK' && restored === plan.length;
  return scLog_('P27_PC_2_COPY試験', { status: ok ? 'PASS' : 'FAIL', eps: plan.map(function (q) { return q.ep; }), write: a1, readbackAsPlanned: asPlanned + '/' + plan.length, otherCellsUnchanged: others, rerun: { status: a2.status, skipped: a2.skipped }, undo: u, restored: restored + '/' + plan.length, note: 'COPYの台帳コピーだけ。V2は読むだけ' });
}
// ページ確認（読むだけ・最大5件・1件1回）。403 は「未検証」として記録し、API確認と区別する。回避（偽装・再試行）はしない
function P27_PC_4_ページ確認_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), p = p27PcPlan_(p27Ledger_(v.ss)), pick = p.all.filter(function (a) { return a.x.url; }).slice(0, 5), res = {};
  pick.forEach(function (a) { var code = 0; try { code = UrlFetchApp.fetch(a.x.url, { muteHttpExceptions: true, followRedirects: true }).getResponseCode(); } catch (e) { code = -1; } res[a.x.ep] = code === 200 ? 'ページ確認（200）' : code === 403 ? '未検証（403・ページ確認不能）' : '未検証（HTTP ' + code + '）'; Utilities.sleep(1000); });
  return scLog_('P27_PC_4_ページ確認_READ_ONLY', { status: 'OK', results: res, note: 'API で ID を確認できても、ページ表示の確認済みとは扱わない' });
}
function P27_PC_0_承認_V2反映() { PropertiesService.getScriptProperties().setProperty('APPROVE_P27_V2', sumToday_()); return scLog_('P27_PC_0_承認_V2反映', { status: P27_V2_WRITE_ENABLED_ ? 'APPROVED' : 'APPROVED_BUT_DISABLED（V2書込はコードで無効）', validOn: sumToday_() }); }
function P27_PC_5_V2反映_承認後() {
  if (!P27_V2_WRITE_ENABLED_) return scLog_('P27_PC_5_V2反映_承認後', { status: 'DISABLED', note: 'V2書込は未承認のためコードで無効（P27_V2_WRITE_ENABLED_ = false）' });
  var P = PropertiesService.getScriptProperties(); if (P.getProperty('APPROVE_P27_V2') !== sumToday_()) return scLog_('P27_PC_5_V2反映_承認後', { status: 'NOT_APPROVED_TODAY' });
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), p = p27PcPlan_(p27Ledger_(v.ss));
  var plan = p.all.filter(function (a) { return a.x.action === 'WRITE'; }).map(function (a) { return { ep: a.x.ep, url: a.x.url, basis: a.x.method + '・' + a.idCheck + '・' + a.page }; });
  var r = p27Write_('V2', v.ss, plan, P27_V2_MAX_PER_RUN_); if (r.status !== 'OK' || !r.skipped || !r.skipped['上限（もう一度押すと続き）']) P.deleteProperty('APPROVE_P27_V2');
  return scLog_('P27_PC_5_V2反映_承認後', r);
}
function P27_PC_7_直前の反映を戻す() { var st = p27State_(); if (!st.last) return scLog_('P27_PC_7_直前の反映を戻す', { status: 'NOTHING_TO_UNDO' }); var ss = st.last.target === 'V2' ? scOpen_(SC_CONFIG.v2WorkingId, '').ss : scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes).ss; return scLog_('P27_PC_7_直前の反映を戻す', p27Undo_(ss)); }
function P27_PC_8_未完了の確認() { var st = p27State_(); return scLog_('P27_PC_8_未完了の確認', { stop: !!st.stop, pending: st.pending || '', last: st.last || null, note: st.pending ? '書込中に止まった反映あり → P27_PC_7 で戻すか、COPY「' + P27_HIST_ + '」で確認' : '未完了なし' }); }
function P27_PC_9_停止解除() { var st = p27State_(); st.stop = false; st.pending = ''; p27SetState_(st); return scLog_('P27_PC_9_停止解除', { status: 'OK' }); }

// ===== Pody 過去回の取得経路調査（読むだけ）=====
// robots.txt を守る。1番組あたり: 番組ページ1回・ページ送り候補1回・回ページ1回まで（計 1+6×3=19 回）。偽装・回避・繰り返し取得はしない
var P27_PODY_SHOWS_ = { 'ドーナツ': 'to04ABW3puiCBtAvp6Wx', 'スポンジ': 'SLYemnwXxXWVj4z0zqt0', 'MEDIA TALK': 'woMdDOpTDIxhqS4HtAsS', 'ニュースの現場から': '4UD5sHilP15gqAc0clXN', '報談': 'sDYbQUEUe07sRv1wMI9z', 'こどもそうだんしつ': '8aeTZ7uuPPmWLxZTkRER' };
function p27Get_(url) { try { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true }); return { code: r.getResponseCode(), body: r.getContentText() }; } catch (e) { return { code: -1, body: '', err: String(e).slice(0, 100) }; } }
function P27_PD_1_取得経路調査_READ_ONLY() {
  var t0 = Date.now(), rows = [], sum = {}, robots = p27Get_('https://pody.jp/robots.txt'), rb = robots.code === 200 ? robots.body : '';
  var disallowPlayer = /Disallow:\s*\/player/i.test(rb) || /Disallow:\s*\/\s*$/m.test(rb);
  if (disallowPlayer) return scLog_('P27_PD_1_取得経路調査_READ_ONLY', { status: 'STOP_ROBOTS', robots: rb.slice(0, 500) });
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = p27Ledger_(v.ss);
  Object.keys(P27_PODY_SHOWS_).forEach(function (show) {
    var sid = P27_PODY_SHOWS_[show], base = 'https://pody.jp/player/' + sid, a = p27Get_(base); Utilities.sleep(1000);
    var eps = a.body ? PlatformMatch.podyEpisodesFromHtml(a.body, sid) : [], h = String(a.body || '').replace(/\\"/g, '"');
    var grab = function (re, n) { var s = {}; (h.match(re) || []).forEach(function (m) { s[m.slice(0, 80)] = 1; }); return Object.keys(s).slice(0, n || 6); };
    var clues = { query: grab(/[?&](?:page|p|offset|cursor|before|after|limit)=[\w-]{1,30}/g), keys: grab(/"(?:nextCursor|cursor|hasMore|hasNext|nextPage|page|totalCount|episodeCount|total|count|limit|offset)"\s*:\s*[^,}\]]{1,30}/g), apis: grab(/\/api\/[A-Za-z0-9_\/.-]{2,60}/g), loadMore: /もっと見る|さらに表示|load\s*more|次へ|過去のエピソード/i.test(h) };
    var p2 = p27Get_(base + '?page=2'); Utilities.sleep(1000);
    var eps2 = p2.body ? PlatformMatch.podyEpisodesFromHtml(p2.body, sid) : [], seen = {}; eps.forEach(function (e) { seen[e.id] = 1; });
    var newOnP2 = eps2.filter(function (e) { return !seen[e.id]; }).length;
    var ep1 = eps[0] ? p27Get_(eps[0].url) : { code: 0, body: '' }; Utilities.sleep(1000);
    var eb = String(ep1.body || ''), epPage = { code: ep1.code, ogTitle: ((eb.match(/property=["']og:title["'][^>]+content=["']([^"']*)/i) || [])[1] || '').slice(0, 80), hasMp3: /\.mp3/.test(eb), episodeLinks: ep1.body ? PlatformMatch.podyEpisodesFromHtml(eb, sid).length : 0 };
    // 照合: 回のIDの近くに音声URLが1つだけあるもの → 音声キー（Omnyクリップ＝公式GUID／音声URL）で V2 の同じ番組と結ぶ
    var v2 = L.rows.filter(function (r) { return r.show === show; }), byG = {}, byA = {}; v2.forEach(function (r) { if (r.guid) byG[r.guid] = r.ep; var k = PlatformMatch.audioKey(r.audio); if (k) byA[k] = r.ep; });
    // 照合: 埋め込みの guid ＝ V2 の公式GUID（GUID）、無ければ 音声URL の一致（AUDIO）。1ページ目と2ページ目の回で数える
    var both = eps.concat(eps2.filter(function (e) { return !seen[e.id]; })), how = { GUID: 0, AUDIO: 0, none: 0 }, hitEp = {}, dupHit = 0;
    both.forEach(function (e) { var g = byG[e.guid], au = byA[PlatformMatch.audioKey(e.audio)], ep = g || au; if (g) how.GUID++; else if (au) how.AUDIO++; else how.none++; if (ep) { if (hitEp[ep]) dupHit++; hitEp[ep] = 1; } });
    var total = Number((h.match(/エピソード一覧 \((\d+)件\)/) || [])[1] || 0), maxPage = Math.max.apply(null, [1].concat((clues.query || []).map(function (q) { var m = q.match(/page=(\d+)/); return m ? +m[1] : 1; })));
    var paired = both, matched = both.filter(function (e) { return byG[e.guid] || byA[PlatformMatch.audioKey(e.audio)]; });
    sum[show] = { page: a.code, totalOnPody: total, pagesNeeded: Math.ceil(total / 20), lastPageLinked: maxPage, episodesPage1: eps.length, newOnPage2: newOnP2, checked: both.length, matchedToV2: matched.length, byMethod: how, oneToOneViolations: dupHit, v2Rows: v2.length, episodePage: epPage.code, episodePageOgTitle: epPage.ogTitle ? 'あり' : 'なし', clues: { query: clues.query.length, apis: clues.apis.length, loadMore: clues.loadMore } };
    var at = h.indexOf(eps[0] ? eps[0].id : '@@'), snippet = at >= 0 ? h.slice(Math.max(0, at - 600), at + 900) : '';
    rows.push([show, base, a.code, eps.length + '（全' + total + '件・' + Math.ceil(total / 20) + 'ページ）', paired.length, matched.length + '（GUID ' + how.GUID + '・音声 ' + how.AUDIO + '・なし ' + how.none + '）', p2.code, newOnP2, epPage.code, epPage.ogTitle, epPage.hasMp3, epPage.episodeLinks, JSON.stringify(clues).slice(0, 1500), snippet.replace(/\s+/g, ' ').slice(0, 1500), new Date().toISOString()]);
  });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, 'P27・Pody調査', ['番組', '番組ページ', 'HTTP', '1ページ目の回数', '確認した回（1〜2ページ）', 'V2と照合できた回', '?page=2 HTTP', '?page=2で増えた回', '回ページHTTP', '回ページog:title', '回ページに音声', '回ページ内の回リンク', 'ページ送りの手がかり', '構造の抜粋（1件目の周辺）', '確認日時'], rows);
  return scLog_('P27_PD_1_取得経路調査_READ_ONLY', { status: 'OK', robots: robots.code + (rb ? '（/player の禁止なし）' : ''), shows: sum, requests: 1 + Object.keys(P27_PODY_SHOWS_).length * 3, sheet: 'COPY「P27・Pody調査」', ms: Date.now() - t0 });
}

// ===== P27 共通: COPY試験（V2は読むだけ）=====
// plan: [{ ep, url, basis, guid }] から、COPY の行が V2 と同じ回（EP-ID・公式GUID）で COPY 側も空欄のものを最大10件 → 書込・読み戻し・再実行で0件・取消で復元
function p27CopyTest_(name, col, re, plan0) {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), CL = p27Ledger_(c.ss, col), cb = {}; CL.rows.forEach(function (r) { cb[r.ep] = r; });
  var plan = plan0.filter(function (q) { var y = cb[q.ep]; return y && (!q.guid || y.guid === q.guid) && !y.current; }).slice(0, P27_COPY_MAX_);
  if (!plan.length) return scLog_(name, { status: 'STOP_NO_CANDIDATE', candidates: plan0.length });
  var before = {}; plan.forEach(function (q) { before[q.ep] = cb[q.ep].current; });
  var a1 = p27Write_('COPY', c.ss, plan, P27_COPY_MAX_, col, re), a2 = p27Write_('COPY', c.ss, plan, P27_COPY_MAX_, col, re);
  var mid = p27Ledger_(c.ss, col), mb = {}; mid.rows.forEach(function (r) { mb[r.ep] = r; });
  var asPlanned = plan.filter(function (q) { return mb[q.ep].current === q.url; }).length;
  var others = CL.rows.filter(function (r) { return !before.hasOwnProperty(r.ep); }).every(function (r) { return mb[r.ep] && mb[r.ep].current === r.current; });
  var u = p27Undo_(c.ss), fin = p27Ledger_(c.ss, col), fb = {}; fin.rows.forEach(function (r) { fb[r.ep] = r; });
  var restored = plan.filter(function (q) { return fb[q.ep].current === before[q.ep]; }).length;
  var ok = a1.status === 'OK' && a1.readbackMismatch === 0 && asPlanned === plan.length && others && a2.status === 'OK_NO_CHANGE' && u.status === 'OK' && restored === plan.length;
  return scLog_(name, { status: ok ? 'PASS' : 'FAIL', column: col, eps: plan.map(function (q) { return q.ep; }), write: a1, readbackAsPlanned: asPlanned + '/' + plan.length, otherCellsUnchanged: others, rerun: { status: a2.status, skipped: a2.skipped }, undo: u, restored: restored + '/' + plan.length, note: 'COPYの台帳コピーだけ。V2は読むだけ' });
}

// ===== P27 Amazon Music（証拠照合）=====
// 公開ページは中身の無い枠で GAS では読めない・公式APIはクローズドベータ（承認制）。そこで Chrome で人と同じ画面を見た「証拠」を COPY「P27・Amazon証拠」に記録し、
// ここで台帳と機械的に照合する。番組ID はサイト掲載の Amazon 番組URLで確認できたものだけ（推測しない）
var P27_AM_SHOWS_ = { 'ニュースの現場から': '7337408b-4752-4a85-8f27-4208a2ca8b1d' };
var P27_AM_EVID_ = 'P27・Amazon証拠', P27_AM_SHEET_ = 'P27・Amazon照合';
function p27AmPlan_(L, cs) {
  var sh = cs.getSheetByName(P27_AM_EVID_); if (!sh) return { error: 'NO_EVIDENCE_SHEET', out: [] };
  var v = sh.getDataRange().getDisplayValues(), h = v[0], ix = function (n) { return h.indexOf(n); };
  var evs = v.slice(1).filter(function (r) { return r.join('').trim(); }).map(function (r) { return { ep: r[ix('調べたEP-ID')], url: r[ix('Amazonの回URL（画面のリンク）')], showName: r[ix('画面の番組名')], date: r[ix('画面の日付')], title: r[ix('画面の題名')], duration: r[ix('画面の長さ')], how: r[ix('取得方法')] }; });
  var out = [], byShow = {};
  evs.forEach(function (e) { var asked = e.ep ? L.rows.filter(function (r) { return r.ep === e.ep; })[0] : null; var show = e.showName || (asked && asked.show) || ''; (byShow[show] = byShow[show] || []).push(e); });
  Object.keys(byShow).forEach(function (show) {
    var v2 = L.rows.filter(function (r) { return r.show === show; }), res = PlatformMatch.amazonEvidenceMatch(v2, byShow[show], P27_AM_SHOWS_[show] || '');
    res.forEach(function (x, i) { out.push({ x: x, e: byShow[show][i], show: show, guid: (v2.filter(function (r) { return r.ep === x.ep; })[0] || {}).guid || '' }); });
  });
  return { out: out };
}
function P27_AM_1_証拠照合_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), L = p27Ledger_(v.ss, 'Amazon'), p = p27AmPlan_(L, c.ss);
  if (p.error) return scLog_('P27_AM_1_証拠照合_READ_ONLY', { status: p.error });
  laWriteSheet_(c.ss, P27_AM_SHEET_, ['調べたEP-ID', '照合したEP-ID', '番組', '状態', '理由', '書くURL', '画面の題名', '画面の日付', '画面の長さ', '取得方法'], p.out.map(function (a) { return [a.x.asked, a.x.ep, a.show, a.x.status, a.x.reason, a.x.url, a.e.title, a.e.date, a.e.duration, a.e.how]; }));
  var by = {}; p.out.forEach(function (a) { by[a.x.status] = (by[a.x.status] || 0) + 1; });
  var amEmpty = L.rows.filter(function (r) { return !r.current; }).length;
  return scLog_('P27_AM_1_証拠照合_READ_ONLY', { status: 'OK', evidence: p.out.length, byStatus: by, verified: p.out.filter(function (a) { return a.x.status === 'VERIFIED'; }).map(function (a) { return a.x.ep; }), notVerified: p.out.filter(function (a) { return !/^VERIFIED/.test(a.x.status); }).map(function (a) { return (a.x.asked || a.x.ep || '?') + ':' + a.x.status + '（' + a.x.reason + '）'; }), v2AmazonEmpty: amEmpty + '/' + L.rows.length, sheet: 'COPY「' + P27_AM_SHEET_ + '」', note: '画面の証拠（番組ID・題名・日付・長さ）がそろったものだけ VERIFIED。URLは画面のリンクから写したもの（推測で作らない）' });
}
function P27_AM_2_COPY試験() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27AmPlan_(p27Ledger_(v.ss, 'Amazon'), c.ss);
  return p27CopyTest_('P27_AM_2_COPY試験', 'Amazon', PlatformMatch.AMAZON_EPISODE_URL, (p.out || []).filter(function (a) { return a.x.status === 'VERIFIED'; }).map(function (a) { return { ep: a.x.ep, url: a.x.url, guid: a.guid, basis: 'Amazon画面の証拠（番組ID・題名・日付・長さ）' }; }));
}

// ===== P27 Pody 全件取得（読むだけ・上限つき・続きから）=====
// 1回の実行で最大60ページ・1ページごとに2秒あける・4分半で打ち切り。続きの位置は スクリプトのプロパティ P27_PODY_CRAWL に残す。robots.txt を毎回確認
var P27_PD_LIST_ = 'P27・Pody回一覧', P27_PD_CRAWL_KEY_ = 'P27_PODY_CRAWL', P27_PD_MAX_PAGES_ = 60;
var P27_PD_LIST_H_ = ['番組', 'Pody回ID', 'URL', '題名', '配信日時', '長さ(秒)', 'GUID', '音声URL', 'ページ', '取得日時'];
function P27_PD_2_全件取得_READ_ONLY() {
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), st = JSON.parse(P.getProperty(P27_PD_CRAWL_KEY_) || '{"i":0,"page":1,"done":false,"pages":0,"eps":0,"other":{}}');
  if (st.done) return scLog_('P27_PD_2_全件取得_READ_ONLY', { status: 'ALREADY_DONE', pagesFetched: st.pages, episodes: st.eps, note: 'やり直すときは P27_PD_2R_取得やり直し' });
  var robots = p27Get_('https://pody.jp/robots.txt'), rb = robots.code === 200 ? robots.body : '';
  if (/Disallow:\s*\/player/i.test(rb) || /Disallow:\s*\/\s*$/m.test(rb)) return scLog_('P27_PD_2_全件取得_READ_ONLY', { status: 'STOP_ROBOTS' });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), sh = scSheet_(c.ss, P27_PD_LIST_, P27_PD_LIST_H_), shows = Object.keys(P27_PODY_SHOWS_), n = 0, errors = [], now = new Date().toISOString(), buf = [];
  while (st.i < shows.length && n < P27_PD_MAX_PAGES_ && Date.now() - t0 < 270000) {
    var show = shows[st.i], sid = P27_PODY_SHOWS_[show], url = 'https://pody.jp/player/' + sid + (st.page > 1 ? '?page=' + st.page : ''), r = p27Get_(url); n++; st.pages++;
    if (r.code !== 200) { errors.push(show + ' p' + st.page + ' HTTP ' + r.code); if (r.code === 429 || r.code === 403) break; st.i++; st.page = 1; Utilities.sleep(2000); continue; }
    var eps = PlatformMatch.podyEpisodesFromHtml(r.body, sid), h = String(r.body).replace(/\\"/g, '"');
    if (st.page === 1) st.total = Number((h.match(/エピソード一覧 \((\d+)件\)/) || [])[1] || 0);
    (h.match(/\/player\/([A-Za-z0-9]{20})(?=["\/?])/g) || []).forEach(function (m) { var f = m.slice(8); if (f !== sid && !P27_PODY_SHOWS_hasId_(f)) st.other[f] = 1; });
    eps.forEach(function (e) { buf.push([show, e.id, e.url, e.title, e.published, e.duration, e.guid, e.audio, st.page, now]); });
    var last = Math.ceil((st.total || 0) / 20);
    if (!eps.length || (last && st.page >= last)) { st.i++; st.page = 1; } else st.page++;
    Utilities.sleep(2000);
  }
  if (buf.length) scChunkWrite_(sh, sh.getLastRow() + 1, buf, P27_PD_LIST_H_.length);
  st.eps += buf.length; if (st.i >= shows.length) st.done = true;
  P.setProperty(P27_PD_CRAWL_KEY_, JSON.stringify(st));
  return scLog_('P27_PD_2_全件取得_READ_ONLY', { status: st.done ? 'DONE' : errors.length ? 'PAUSED_WITH_ERRORS' : 'CONTINUE（もう一度押すと続き）', pagesThisRun: n, episodesThisRun: buf.length, totalPages: st.pages, totalEpisodes: st.eps, next: st.done ? '' : shows[st.i] + ' p' + st.page, errors: errors, otherFeedsSeen: Object.keys(st.other).length, ms: Date.now() - t0, sheet: 'COPY「' + P27_PD_LIST_ + '」' });
}
function P27_PODY_SHOWS_hasId_(f) { return Object.keys(P27_PODY_SHOWS_).some(function (k) { return P27_PODY_SHOWS_[k] === f; }); }
function P27_PD_2R_取得やり直し() { PropertiesService.getScriptProperties().deleteProperty(P27_PD_CRAWL_KEY_); var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), sh = c.ss.getSheetByName(P27_PD_LIST_); if (sh) sh.clearContents(); return scLog_('P27_PD_2R_取得やり直し', { status: 'OK', note: 'COPY「' + P27_PD_LIST_ + '」を空にした（V2は触らない）' }); }
function p27PdPlan_(L, cs) {
  var sh = cs.getSheetByName(P27_PD_LIST_); if (!sh || sh.getLastRow() < 2) return { error: 'NO_LIST（先に P27_PD_2_全件取得_READ_ONLY）' };
  var v = sh.getDataRange().getDisplayValues().slice(1), byShow = {}, seen = {};
  v.forEach(function (r) { if (!r[1] || seen[r[1]]) return; seen[r[1]] = 1; (byShow[r[0]] = byShow[r[0]] || []).push({ id: r[1], url: r[2], title: r[3], published: r[4], duration: Number(r[5]) || 0, guid: r[6], audio: r[7] }); });
  var all = [], extra = [], shows = {};
  Object.keys(byShow).forEach(function (show) {
    var eps = byShow[show], v2 = L.rows.filter(function (r) { return r.show === show; });
    // Pody の埋め込み guid は公式GUID。matchPlatform は配信先の guid を GUID 経路で使う（無ければ音声URL）
    var m = PlatformMatch.matchPlatform(v2, eps, { urlOf: function (e) { return e.url; }, isValidUrl: function (u) { return PlatformMatch.PODY_EPISODE_URL.test(u); }, idOfUrl: PlatformMatch.podyIdOf });
    var linked = eps.length - m.summary.platformUnmatched, ratio = eps.length ? linked / eps.length : 0;
    shows[show] = { status: ratio >= 0.5 ? 'OK' : 'STOP_SHOW_MISMATCH', podyEpisodes: eps.length, v2Rows: v2.length, linkedRatio: Math.round(ratio * 1000) / 10 + '%', summary: m.summary };
    m.rows.forEach(function (x) { if (shows[show].status !== 'OK' && x.action === 'WRITE') { x.action = 'HOLD'; x.verdict = '保留: 番組の一致率が低い'; } var r = v2.filter(function (y) { return y.ep === x.ep; })[0]; all.push({ x: x, r: r }); });
    m.unmatchedEps.forEach(function (e) { extra.push([show, e.id, 'https://pody.jp/player/' + P27_PODY_SHOWS_[show] + '/' + e.id, e.title, e.published]); });
  });
  return { all: all, extra: extra, shows: shows };
}
function P27_PD_3_照合_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27PdPlan_(p27Ledger_(v.ss, 'Pody'), c.ss);
  if (p.error) return scLog_('P27_PD_3_照合_READ_ONLY', { status: p.error });
  laWriteSheet_(c.ss, 'P27・Pody照合', ['EP-ID', '番組', '判定', '処理', '方法', '題名一致', '配信時刻の差(時間)', '長さの差(秒)', '書くURL', '既存URL'], p.all.map(function (a) { var x = a.x; return [x.ep, x.show, x.verdict, x.action, x.method || '', x.titleSame === undefined ? '' : x.titleSame, x.hoursApart, x.durationDiff, x.url || '', x.current]; }));
  laWriteSheet_(c.ss, 'P27・Pody余り', ['番組', 'Pody回ID', 'URL', '題名', '配信日時'], p.extra);
  var tot = { v2Rows: 0, write: 0, hold: 0, byVerdict: {}, byMethod: {} };
  p.all.forEach(function (a) { tot.v2Rows++; tot.byVerdict[a.x.verdict] = (tot.byVerdict[a.x.verdict] || 0) + 1; if (a.x.action === 'WRITE') tot.write++; if (a.x.action === 'HOLD') tot.hold++; if (a.x.method && a.x.action !== 'HOLD') tot.byMethod[a.x.method] = (tot.byMethod[a.x.method] || 0) + 1; });
  return scLog_('P27_PD_3_照合_READ_ONLY', { status: 'OK', shows: p.shows, total: tot, podyUnmatched: p.extra.length, sheets: 'COPY「P27・Pody照合」「P27・Pody余り」' });
}
function P27_PD_4_COPY試験() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27PdPlan_(p27Ledger_(v.ss, 'Pody'), c.ss);
  if (p.error) return scLog_('P27_PD_4_COPY試験', { status: p.error });
  return p27CopyTest_('P27_PD_4_COPY試験', 'Pody', PlatformMatch.PODY_EPISODE_URL, p.all.filter(function (a) { return a.x.action === 'WRITE'; }).map(function (a) { return { ep: a.x.ep, url: a.x.url, guid: a.r.guid, basis: 'Pody 埋め込みGUID＝公式GUID' }; }));
}
function P27_PD_5_V2反映_承認後() { return scLog_('P27_PD_5_V2反映_承認後', { status: 'DISABLED', note: 'V2書込は未承認のためコードで無効（P27_V2_WRITE_ENABLED_ = false）' }); }

// ===== P27 Pocket Casts 原因解析（読むだけ）=====
function P27_PC_3_原因解析_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = p27Ledger_(v.ss), rows = [], sum = {}, allIds = {}, fetched = {};
  Object.keys(P27_PC_SHOWS_).forEach(function (show) { var f = p27PcFetch_(P27_PC_SHOWS_[show]); fetched[show] = f.eps; f.eps.forEach(function (e) { allIds[e.id] = show; }); });
  var toMs = function (s) { var j = String(s).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/); return j ? Date.UTC(+j[1], +j[2] - 1, +j[3], +j[4] - 9, +j[5]) : Date.parse(s); };
  var add = function (show, kind, ep, detail) { var k = show + '｜' + kind; sum[k] = (sum[k] || 0) + 1; rows.push([show, kind, ep, detail]); };
  Object.keys(P27_PC_SHOWS_).forEach(function (show) {
    var eps = fetched[show], v2 = L.rows.filter(function (r) { return r.show === show; }), byId = {}; eps.forEach(function (e) { byId[e.id] = e; });
    var m = PlatformMatch.matchPlatform(v2, eps, { urlOf: function (e) { return PlatformMatch.pcEpisodeUrl(e.id); }, isValidUrl: function (u) { return PlatformMatch.PC_EPISODE_URL.test(u); }, idOfUrl: PlatformMatch.pcUuidOf });
    m.rows.forEach(function (x) {
      var r = v2.filter(function (y) { return y.ep === x.ep; })[0];
      if (x.verdict === '既存URL競合（上書きしない）') {
        var other = allIds[x.currentId]; add(show, '競合: 既存IDが' + (other ? '別番組「' + other + '」の公開データにある' : 'どの番組の公開データにも無い（古いID・削除された回の可能性）') + '／照合で見つかった回は' + (x.titleSame ? '題名一致' : '題名違い'), x.ep, x.currentId + ' → ' + x.id);
      } else if (/^既存URLのみ/.test(x.verdict)) {
        var ce = byId[x.currentId];
        if (!ce) { add(show, '既存URLのみ: 既存IDが公開データに無い', x.ep, x.currentId); return; }
        var dt = Math.abs(toMs(r.published) - Date.parse(ce.published)) / 3600000, dd = Math.abs((r.duration || 0) - ce.duration);
        add(show, '既存URLのみ: 既存IDは公開データにある・' + (dt <= 1 ? '時刻1時間以内' : '時刻' + Math.round(dt) + '時間差') + '・' + (r.duration && dd <= 2 ? '長さ一致' : r.duration ? '長さ違い' : 'V2に長さなし') + '・V2に' + (r.guid ? 'GUIDあり' : 'GUIDなし') + (r.audio ? '・音声URLあり' : '・音声URLなし'), x.ep, x.currentId + '｜PC題名: ' + ce.title.slice(0, 60));
      }
    });
    m.unmatchedEps.forEach(function (e) {
      var pe = byId[e.id], near = v2.filter(function (r) { return Math.abs(toMs(r.published) - Date.parse(pe.published)) <= 3600000 && r.duration && Math.abs(r.duration - pe.duration) <= 2; });
      var linked = near.filter(function (r) { return PlatformMatch.pcUuidOf(r.current) === e.id; });
      add(show, '余り: ' + (linked.length ? 'V2の行に既にこのIDのURLあり（題名違いで照合外）' : near.length ? 'V2に時刻・長さが同じ行あり（題名違い）' : 'V2に対応する行なし（未収蔵か配信先だけの回）'), near.map(function (r) { return r.ep; }).join(' '), e.id + '｜' + pe.published + '｜' + pe.title.slice(0, 60));
    });
  });
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  laWriteSheet_(c.ss, 'P27・PC原因解析', ['番組', '分類', 'EP-ID', '内容'], rows);
  return scLog_('P27_PC_3_原因解析_READ_ONLY', { status: 'OK', summary: sum, sheet: 'COPY「P27・PC原因解析」', note: '読むだけ。自動では何も直さない' });
}

// ===== P27 番組IDの調査（読むだけ・1番組1回）=====
// Pocket Casts: 台帳の Apple 列にある番組ID（id数字）で公開の転送リンク pca.st/itunes/<id> を1回だけ開き、転送先から番組IDを読む → 公開データの回と台帳の一致率で検査
function P27_ID_1_番組ID調査_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = p27Ledger_(v.ss, 'Apple'), res = {}, shows = {};
  L.rows.forEach(function (r) { var m = String(r.current).match(/\/id(\d+)/); if (m) { var s = (shows[r.show] = shows[r.show] || {}); s[m[1]] = (s[m[1]] || 0) + 1; } });
  var PCL = p27Ledger_(v.ss);
  Object.keys(shows).forEach(function (show) {
    if (P27_PC_SHOWS_[show]) { res[show] = { pocketCasts: '確認済み（既存）' }; return; }
    var ids = Object.keys(shows[show]).sort(function (a, b) { return shows[show][b] - shows[show][a]; }), appleId = ids[0], out = { appleId: appleId, appleIdRows: shows[show][appleId], otherAppleIds: ids.length - 1 };
    var r1 = null; try { r1 = UrlFetchApp.fetch('https://pca.st/itunes/' + appleId, { muteHttpExceptions: true, followRedirects: false }); } catch (e) { out.error = String(e).slice(0, 80); }
    Utilities.sleep(1000);
    if (r1) { var loc = String((r1.getAllHeaders() || {}).Location || (r1.getAllHeaders() || {}).location || ''); out.http = r1.getResponseCode(); out.location = loc.slice(0, 120); var u = loc.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/); if (u) out.pcShowId = u[1]; }
    if (out.pcShowId) {
      var f = p27PcFetch_(out.pcShowId); Utilities.sleep(1000);
      if (!f.error) { var v2 = PCL.rows.filter(function (r) { return r.show === show; }), m = PlatformMatch.matchPlatform(v2, f.eps, { urlOf: function (e) { return PlatformMatch.pcEpisodeUrl(e.id); }, isValidUrl: function (u) { return PlatformMatch.PC_EPISODE_URL.test(u); }, idOfUrl: PlatformMatch.pcUuidOf }); var linked = f.eps.length - m.summary.platformUnmatched; out.pcTitle = f.title; out.pcEpisodes = f.eps.length; out.linkedRatio = f.eps.length ? Math.round(linked / f.eps.length * 1000) / 10 + '%' : '0%'; out.verdict = f.eps.length && linked / f.eps.length >= 0.5 ? '番組ID確認（一致率5割以上）' : '要確認（一致率が低い）'; out.wouldWrite = m.summary.byVerdict['確定（空欄に書ける）'] || 0; out.alreadySame = m.summary.byVerdict['一致（既存URLと同じ）'] || 0; out.conflict = m.summary.byVerdict['既存URL競合（上書きしない）'] || 0; }
      else out.pcFetch = f.error;
    }
    res[show] = out;
  });
  return scLog_('P27_ID_1_番組ID調査_READ_ONLY', { status: 'OK', shows: res, note: '転送リンクは podnews 等が公開している形（pca.st/itunes/<Apple番組ID>）。確認できた番組IDはコードの P27_PC_SHOWS_ に人が追記してから P27_PC_1 で照合する' });
}

// ===== P27 7サービスの集計（読むだけ）=====
var P27_ROUTES_ = {
  Spotify: ['VERIFIED', 'P26（本番ロボ）の既存経路。P27 では触らない'],
  Apple: ['VERIFIED', 'P26（本番ロボ）の既存経路。空欄の大半は P26/#280 の承認待ち。P27 では触らない'],
  'Pocket Casts': ['VERIFIED', 'P27_PC: 公開データのIDを公式GUID・音声URLで照合（ページは403で未検証）'],
  LISTEN: ['HOLD', '既存の補完で個別URLが入っている回はある。空欄を埋める新しい経路は未調査（P27 未実装）'],
  Pody: ['VERIFIED', 'P27_PD: 番組ページ埋め込みの guid＝公式GUID で照合（上限つき全件取得）'],
  Amazon: ['CANDIDATE', '公開ページは中身なし・公式APIは承認制。Chrome で見た画面の証拠を照合（少数ずつ・人の承認つき）'],
  YouTube: ['UNAVAILABLE', 'YouTube Data API の有効化が未承認']
};
function P27_ST_1_7サービス集計_READ_ONLY() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), sh = v.ss.getSheetByName('V2・統合台帳'), d = sh.getDataRange().getDisplayValues(), h = d[0], svs = Object.keys(PlatformMatch.SERVICE_SHAPES), ix = {};
  svs.concat(['EP-ID', '番組', '掲載判定']).forEach(function (n) { ix[n] = h.indexOf(n); });
  var rows = d.slice(1).filter(function (r) { return String(r[ix['EP-ID']]).trim(); }).map(function (r) { var o = { show: r[ix['番組']], values: {} }; svs.forEach(function (s) { o.values[s] = ix[s] >= 0 ? r[ix[s]] : ''; }); return o; });
  var t = PlatformMatch.serviceTally(rows), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  var count = function (sheet, col, re) { var s = c.ss.getSheetByName(sheet); if (!s || s.getLastRow() < 2) return null; var x = s.getRange(2, col, s.getLastRow() - 1, 1).getDisplayValues(), n = 0; x.forEach(function (y) { if (re.test(y[0])) n++; }); return n; };
  var extra = {
    'Pocket Casts': { 新規確定: count('P27・PC照合', 4, /^WRITE$/), 保留: count('P27・PC照合', 4, /^HOLD$/), 候補: 0 },
    Pody: { 新規確定: count('P27・Pody照合', 4, /^WRITE$/), 保留: count('P27・Pody照合', 4, /^HOLD$/), 候補: 0 },
    Amazon: { 新規確定: count(P27_AM_SHEET_, 4, /^VERIFIED$/), 保留: count(P27_AM_SHEET_, 4, /^HOLD$/), 候補: count(P27_AM_SHEET_, 4, /^CANDIDATE$/), 取得不能: count(P27_AM_SHEET_, 4, /^UNAVAILABLE$/) }
  };
  var out = svs.map(function (s) { var a = t[s], e = extra[s] || {}, pct = a.total ? Math.round(a.EPISODE / a.total * 1000) / 10 : 0; return [s, P27_ROUTES_[s][0], a.total, a.EPISODE, pct + '%', a.SHOW_ONLY, a.EMPTY, a.OTHER, e.新規確定 === null || e.新規確定 === undefined ? '' : e.新規確定, e.候補 === null || e.候補 === undefined ? '' : e.候補, e.保留 === null || e.保留 === undefined ? '' : e.保留, e.取得不能 === null || e.取得不能 === undefined ? '' : e.取得不能, P27_ROUTES_[s][1]]; });
  laWriteSheet_(c.ss, 'P27・7サービス集計', ['サービス', '経路の状態', '台帳の行', '個別URLあり', '個別URLの割合', '番組トップのみ', '空欄', '形が不明', '新規確定（照合表）', '候補（未確定）', '保留', '取得不能', '経路'], out);
  var byShow = []; svs.forEach(function (s) { Object.keys(t[s].byShow).forEach(function (sh2) { var b = t[s].byShow[sh2]; byShow.push([s, sh2, b.total, b.EPISODE, b.SHOW_ONLY, b.EMPTY, b.OTHER]); }); });
  laWriteSheet_(c.ss, 'P27・7サービス番組別', ['サービス', '番組', '行', '個別URLあり', '番組トップのみ', '空欄', '形が不明'], byShow);
  var human = [];
  var pull = function (sheet, filt, kind) { var s = c.ss.getSheetByName(sheet); if (!s || s.getLastRow() < 2) return; s.getDataRange().getDisplayValues().slice(1).forEach(function (r) { var k = filt(r); if (k) human.push([kind, r[0] || r[1], r[1] && r[0] ? r[1] : '', k]); }); };
  pull('P27・PC照合', function (r) { return r[3] === 'HOLD' ? r[2] + '（既存 ' + r[10] + ' → 照合 ' + r[8] + '）' : ''; }, 'Pocket Casts');
  pull('P27・Pody照合', function (r) { return r[3] === 'HOLD' ? r[2] : ''; }, 'Pody');
  pull(P27_AM_SHEET_, function (r) { return /^(CANDIDATE|HOLD|UNAVAILABLE)$/.test(r[3]) ? r[3] + ': ' + r[4] : ''; }, 'Amazon');
  laWriteSheet_(c.ss, 'P27・要人手', ['サービス', 'EP-ID', '番組', '内容'], human);
  var log = {}; out.forEach(function (r) { log[r[0]] = { 経路: r[1], 個別URL: r[3] + '/' + r[2] + '（' + r[4] + '）', 番組トップのみ: r[5], 空欄: r[6], 形が不明: r[7], 新規確定: r[8], 候補: r[9], 保留: r[10], 取得不能: r[11] }; });
  return scLog_('P27_ST_1_7サービス集計_READ_ONLY', { status: 'OK', services: log, humanNeeded: human.length, sheets: 'COPY「P27・7サービス集計」「P27・7サービス番組別」「P27・要人手」' });
}

// ===== P27 新着1件を7サービスへ自動照合・補完（2026-11-17 司令塔「新着1件を7サービスへ自動照合・補完する仕組みを完成させよ」）=====
// 対象: 配信日時が P27_NEW_DAYS_ 日以内の V2 行（スクリプトのプロパティ P27_NEW_DAYS で変更可）。1回の実行で各サービス・各番組を1〜2回だけ取得する。
// 状態: VERIFIED（同じ回と確認）／CANDIDATE（候補だが未確定）／SHOW_ONLY（番組トップのみ）／HOLD（競合・照合不足・確認待ち）／UNAVAILABLE（取得経路なし）
// サービスごとの経路（推測でURLを作らない。番組IDは台帳の既存URLかサイト掲載のものだけ。番組の取り違えは一致率5割未満で止める）:
//   Pocket Casts … 公開データ podcast/full（公式GUID・音声URL）／Pody … 番組ページ1ページ目の埋め込み guid／Apple … iTunes Search API lookup の episodeGuid
//   LISTEN … 番組ページに載る公開RSS の guid／Amazon … Chrome で見た画面の証拠（COPY「P27・Amazon証拠」）を照合、無ければ「証拠待ち」一覧へ
//   Spotify … P26（本番ロボ）の経路。P27 では重複実装しない（記入済みかだけ見る）／YouTube … API 未承認のため UNAVAILABLE
var P27_NEW_DAYS_ = 14, P27_NEW_SHEET_ = 'P27・新着照合', P27_AM_QUEUE_ = 'P27・Amazon証拠待ち';
var P27_NEW_COLS_ = ['Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube'];
var P27_NEW_RE_ = function (col) { return { Apple: PlatformMatch.APPLE_EPISODE_URL, Amazon: PlatformMatch.AMAZON_EPISODE_URL, 'Pocket Casts': PlatformMatch.PC_EPISODE_URL, LISTEN: PlatformMatch.LISTEN_EPISODE_URL, Pody: PlatformMatch.PODY_EPISODE_URL }[col]; };
function p27LedgerAll_(ss) {
  var sh = ss.getSheetByName('V2・統合台帳'), v = sh.getDataRange().getDisplayValues(), h = v[0], ix = {};
  ['EP-ID', '番組', 'タイトル', '配信日時 JST', '公式GUID', '音声URL', '再生時間 秒'].concat(P27_NEW_COLS_).forEach(function (n) { ix[n] = h.indexOf(n); if (ix[n] < 0) throw new Error('P27_HEADER_MISSING:' + n); });
  return v.slice(1).filter(function (r) { return String(r[ix['EP-ID']]).trim(); }).map(function (r) { var o = { ep: r[ix['EP-ID']].trim(), show: r[ix['番組']], title: r[ix['タイトル']], published: r[ix['配信日時 JST']], guid: String(r[ix['公式GUID']]).trim().toLowerCase(), audio: r[ix['音声URL']], duration: Number(r[ix['再生時間 秒']]) || 0, cur: {} }; P27_NEW_COLS_.forEach(function (c) { o.cur[c] = String(r[ix[c]] || '').trim(); }); return o; });
}
function p27MostCommon_(rows, col, fn) { var n = {}; rows.forEach(function (r) { var k = fn(r.cur[col]); if (k) n[k] = (n[k] || 0) + 1; }); var ks = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }); return ks[0] || ''; }
// サービス × 番組 → 配信先の回の一覧（取得は1回の実行で1度だけ）
function p27NewFetch_(col, show, showRows, cache, robotsOk) {
  var key = col + '|' + show; if (cache[key]) return cache[key];
  var out = { eps: [], source: '', error: '' };
  try {
    if (col === 'Pocket Casts') { var id = P27_PC_SHOWS_[show]; if (!id) out.error = 'NO_SHOW_ID'; else { var f = p27PcFetch_(id); out.eps = f.eps; out.error = f.error || ''; out.source = 'Pocket Casts 公開データ'; } }
    else if (col === 'Pody') { var sid = P27_PODY_SHOWS_[show]; if (!sid) out.error = 'NO_SHOW_ID'; else if (!robotsOk) out.error = 'ROBOTS'; else { var g = p27Get_('https://pody.jp/player/' + sid); if (g.code !== 200) out.error = 'HTTP ' + g.code; else { out.eps = PlatformMatch.podyEpisodesFromHtml(g.body, sid); out.source = 'Pody 番組ページ1ページ目'; } } }
    else if (col === 'Apple') { var aid = p27MostCommon_(showRows, 'Apple', PlatformMatch.appleShowIdOf); if (!aid) out.error = 'NO_SHOW_ID'; else { var a = p27Get_('https://itunes.apple.com/lookup?id=' + aid + '&entity=podcastEpisode&limit=200&country=jp'); if (a.code !== 200) out.error = 'HTTP ' + a.code; else { out.eps = PlatformMatch.appleEpisodesFromLookup(JSON.parse(a.body)); out.source = 'iTunes Search API lookup id' + aid; } } }
    else if (col === 'LISTEN') { var lid = p27MostCommon_(showRows, 'LISTEN', PlatformMatch.listenShowIdOf); if (!lid) out.error = 'NO_SHOW_ID'; else { var pg = p27Get_('https://listen.style/p/' + lid), rss = pg.code === 200 ? PlatformMatch.listenRssUrlFromHtml(pg.body, lid) : ''; if (!rss) out.error = pg.code === 200 ? 'NO_RSS_LINK' : 'HTTP ' + pg.code; else { var x = p27Get_(rss); if (x.code !== 200) out.error = 'RSS HTTP ' + x.code + (x.err ? ' ' + x.err : ''); else { out.eps = PlatformMatch.rssEpisodes(x.body, 400); out.source = 'LISTEN 公開RSS（新しい400回）'; } } } }
  } catch (e) { out.error = String(e).slice(0, 100); }
  Utilities.sleep(500); cache[key] = out; return out;
}
function p27NewPlan_(vss, css) {
  var all = p27LedgerAll_(vss), P = PropertiesService.getScriptProperties(), days = Number(P.getProperty('P27_NEW_DAYS')) || P27_NEW_DAYS_;
  var targets = PlatformMatch.recentRows(all, Date.now(), days), byShow = {}, cache = {}, out = [], shows = {}, queue = [];
  all.forEach(function (r) { (byShow[r.show] = byShow[r.show] || []).push(r); });
  var robots = p27Get_('https://pody.jp/robots.txt'), robotsOk = robots.code === 200 && !(/Disallow:\s*\/player/i.test(robots.body) || /Disallow:\s*\/\s*$/m.test(robots.body));
  // Amazon の証拠（あれば）
  var am = p27AmPlan_({ rows: all.map(function (r) { return { ep: r.ep, show: r.show, title: r.title, published: r.published, duration: r.duration, current: r.cur.Amazon, guid: r.guid }; }) }, css), amBy = {};
  (am.out || []).forEach(function (a) { if (a.x.ep) amBy[a.x.ep] = a; });
  var tShows = {}; targets.forEach(function (r) { tShows[r.show] = 1; });
  var res = {}; // res[col][show] = { rowsByEp, status }
  ['Pocket Casts', 'Pody', 'Apple', 'LISTEN'].forEach(function (col) {
    res[col] = {};
    Object.keys(tShows).forEach(function (show) {
      var rows = byShow[show], f = p27NewFetch_(col, show, rows, cache, robotsOk), st = { source: f.source, error: f.error, eps: f.eps.length };
      if (f.error) { st.status = f.error === 'NO_SHOW_ID' ? 'NO_SHOW_ID' : 'FETCH_ERROR'; res[col][show] = { st: st, by: {} }; shows[col + '｜' + show] = st; return; }
      var v2 = rows.map(function (r) { return { ep: r.ep, show: r.show, title: r.title, published: r.published, guid: r.guid, audio: r.audio, duration: r.duration, current: r.cur[col] }; });
      var idOf = { 'Pocket Casts': PlatformMatch.pcUuidOf, Pody: PlatformMatch.podyIdOf, Apple: PlatformMatch.appleIdOf, LISTEN: PlatformMatch.listenIdOf }[col], re = P27_NEW_RE_(col);
      var m = PlatformMatch.matchPlatform(v2, f.eps, { urlOf: function (e) { return col === 'Pocket Casts' ? PlatformMatch.pcEpisodeUrl(e.id) : e.url; }, isValidUrl: function (u) { return re.test(u); }, idOfUrl: idOf });
      var linked = f.eps.length - m.summary.platformUnmatched, ratio = f.eps.length ? linked / f.eps.length : 0;
      st.linkedRatio = Math.round(ratio * 1000) / 10 + '%'; st.status = ratio >= 0.5 ? 'OK' : 'STOP_SHOW_MISMATCH';
      var by = {}; m.rows.forEach(function (x) { by[x.ep] = x; }); res[col][show] = { st: st, by: by }; shows[col + '｜' + show] = st;
    });
  });
  targets.forEach(function (r) {
    P27_NEW_COLS_.forEach(function (col) {
      var cur = r.cur[col], row = { ep: r.ep, show: r.show, title: r.title, published: r.published, col: col, state: '', action: 'NONE', url: '', reason: '', current: cur };
      if (col === 'YouTube') { row.state = 'UNAVAILABLE'; row.reason = 'YouTube Data API の有効化が未承認'; }
      else if (col === 'Spotify') { var sh = PlatformMatch.cellShape('Spotify', cur); row.state = sh === 'EPISODE' ? 'VERIFIED' : sh === 'SHOW_ONLY' ? 'SHOW_ONLY' : 'HOLD'; row.reason = sh === 'EPISODE' ? 'P26（本番ロボ）が個別URLを記入済み' : 'P26（本番ロボ）の照合待ち（P27 では重複実装しない）'; }
      else if (col === 'Amazon') {
        var a = amBy[r.ep];
        if (a && a.x.status === 'VERIFIED') { row.state = 'VERIFIED'; row.action = 'WRITE'; row.url = a.x.url; row.reason = a.x.reason; }
        else if (a && a.x.status === 'VERIFIED_SAME') { row.state = 'VERIFIED'; row.url = a.x.url; row.reason = '既存URLと同じ'; }
        else if (a) { row.state = a.x.status === 'CANDIDATE' ? 'CANDIDATE' : a.x.status === 'UNAVAILABLE' ? 'HOLD' : 'HOLD'; row.url = a.x.url; row.reason = a.x.reason; }
        else if (cur) { row.state = PlatformMatch.cellShape('Amazon', cur) === 'EPISODE' ? 'VERIFIED' : 'SHOW_ONLY'; row.reason = '既存の値'; }
        else { row.state = 'HOLD'; row.reason = '画面の証拠待ち（Chrome で確認 → COPY「P27・Amazon証拠」）'; queue.push([r.ep, r.show, r.title, r.published, r.title, P27_AM_SHOWS_[r.show] || '（番組ID未確認）', '証拠待ち']); }
      } else {
        var rr = res[col][r.show], x = rr && rr.by[r.ep];
        if (!rr || rr.st.status === 'NO_SHOW_ID') { row.state = cur ? (PlatformMatch.cellShape(col, cur) === 'EPISODE' ? 'VERIFIED' : 'SHOW_ONLY') : 'UNAVAILABLE'; row.reason = cur ? '既存の値（番組IDが未確認のため照合なし）' : 'この番組の配信先IDが未確認'; }
        else if (rr.st.status !== 'OK') { row.state = 'HOLD'; row.reason = rr.st.status + (rr.st.error ? ' ' + rr.st.error : ''); }
        else if (!x) { row.state = 'HOLD'; row.reason = '照合結果なし'; }
        else if (x.action === 'WRITE') { row.state = 'VERIFIED'; row.action = 'WRITE'; row.url = x.url; row.reason = x.method + '（' + rr.st.source + '）'; }
        else if (/^一致/.test(x.verdict)) { row.state = 'VERIFIED'; row.url = x.url; row.reason = '既存URLと同じ回（' + x.method + '）'; }
        else if (/^不一致/.test(x.verdict)) { row.state = 'HOLD'; row.reason = '配信先にまだ見つからない（次回に再照合）'; }
        else { row.state = 'HOLD'; row.url = x.url || ''; row.reason = x.verdict; }
      }
      out.push(row);
    });
  });
  return { targets: targets, days: days, out: out, shows: shows, queue: queue, robotsOk: robotsOk };
}
function P27_NEW_1_新着照合_READ_ONLY() {
  var t0 = Date.now(), v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27NewPlan_(v.ss, c.ss);
  laWriteSheet_(c.ss, P27_NEW_SHEET_, ['EP-ID', '番組', '題名', '配信日時', 'サービス', '状態', '処理', 'URL', '根拠・理由', '既存URL'], p.out.map(function (o) { return [o.ep, o.show, o.title, o.published, o.col, o.state, o.action, o.url, o.reason, o.current]; }));
  laWriteSheet_(c.ss, P27_AM_QUEUE_, ['EP-ID', '番組', '題名', '配信日時', '検索語', 'Amazon番組ID', '状態'], p.queue);
  var bySvc = {}; p.out.forEach(function (o) { var b = (bySvc[o.col] = bySvc[o.col] || { VERIFIED: 0, CANDIDATE: 0, SHOW_ONLY: 0, HOLD: 0, UNAVAILABLE: 0, write: 0 }); b[o.state]++; if (o.action === 'WRITE') b.write++; });
  return scLog_('P27_NEW_1_新着照合_READ_ONLY', { status: 'OK', days: p.days, targets: p.targets.length, targetEps: p.targets.map(function (r) { return r.ep; }).slice(0, 40), byService: bySvc, writable: p.out.filter(function (o) { return o.action === 'WRITE'; }).length, amazonQueue: p.queue.length, shows: p.shows, podyRobots: p.robotsOk ? 'OK' : 'STOP', sheets: 'COPY「' + P27_NEW_SHEET_ + '」「' + P27_AM_QUEUE_ + '」', ms: Date.now() - t0 });
}
// COPY試験: 新着の WRITE をサービス（列）ごとに、合計10件まで COPY の写しへ → 読み戻し・再実行0件・取消で復元
function P27_NEW_2_COPY試験() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27NewPlan_(v.ss, c.ss), guid = {}; p.targets.forEach(function (r) { guid[r.ep] = r.guid; });
  var left = P27_COPY_MAX_, results = {}, ok = true, any = false;
  ['Pocket Casts', 'Pody', 'Apple', 'LISTEN', 'Amazon'].forEach(function (col) {
    if (left <= 0) return;
    var plan = p.out.filter(function (o) { return o.col === col && o.action === 'WRITE'; }).map(function (o) { return { ep: o.ep, url: o.url, guid: guid[o.ep], basis: '新着照合: ' + o.reason }; });
    if (!plan.length) { results[col] = 'NO_CANDIDATE'; return; }
    var cap = Math.max(1, Math.min(left, Math.ceil(P27_COPY_MAX_ / 4)));
    var r = p27CopyTest_('P27_NEW_2_COPY試験（' + col + '）', col, P27_NEW_RE_(col), plan.slice(0, cap));
    results[col] = { status: r.status, eps: r.eps, readback: r.readbackAsPlanned, rerun: r.rerun && r.rerun.status, restored: r.restored };
    if (r.status === 'PASS') { any = true; left -= (r.eps || []).length; } else if (r.status !== 'STOP_NO_CANDIDATE') ok = false;
  });
  return scLog_('P27_NEW_2_COPY試験', { status: ok && any ? 'PASS' : any ? 'FAIL' : 'STOP_NO_CANDIDATE', byService: results, note: 'COPYの台帳コピーだけ。V2は読むだけ' });
}
// 承認対象は書込可能なエピソード・列・URL・旧値・根拠のSHA256で固定。
// 反映時に別の候補が増減・変化した場合は再承認が必要。ScriptPropertiesのサイズ上、全候補は保存しない。
var P27_NEW_APPROVAL_HASH_ = 'APPROVE_P27_NEW_V2_HASH';
function p27NewPlanHash_(p) {
  var selected = p.out.filter(function (o) { return o.action === 'WRITE'; }).map(function (o) {
    return [o.ep, o.col, o.url, o.current, o.reason];
  }).sort(function (a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); });
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(selected), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function P27_NEW_0_承認_新着V2反映() {
  if (!P27_V2_WRITE_ENABLED_) return scLog_('P27_NEW_0_承認_新着V2反映', { status: 'DISABLED', note: '本番反映禁止フラグがfalse。候補承認は行わない' });
  var st = p27State_();
  if (st.stop || st.pending || (st.lastGroup && st.lastGroup.length)) return scLog_('P27_NEW_0_承認_新着V2反映', { status: 'STOP_PENDING_UNDO', pending: st.pending || '', group: (st.lastGroup || []).length });
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27NewPlan_(v.ss, c.ss);
  var hash = p27NewPlanHash_(p), count = p.out.filter(function (o) { return o.action === 'WRITE'; }).length;
  if (!count) return scLog_('P27_NEW_0_承認_新着V2反映', { status: 'NO_CANDIDATE' });
  var P = PropertiesService.getScriptProperties();
  P.setProperty('APPROVE_P27_NEW_V2', sumToday_());
  P.setProperty(P27_NEW_APPROVAL_HASH_, hash);
  return scLog_('P27_NEW_0_承認_新着V2反映', { status: 'APPROVED', validOn: sumToday_(), writable: count, planHash: hash });
}
// 複数列の反映は１列ずつ結果を確認。失敗時の部分反映IDは直ちに保存し、取り消し可能に保つ。
function P27_NEW_5_V2反映_承認後() {
  if (!P27_V2_WRITE_ENABLED_) return scLog_('P27_NEW_5_V2反映_承認後', { status: 'DISABLED', note: 'V2書込は未承認のためコードで無効（P27_V2_WRITE_ENABLED_ = false）' });
  var P = PropertiesService.getScriptProperties(), approvedDate = P.getProperty('APPROVE_P27_NEW_V2'), approvedHash = P.getProperty(P27_NEW_APPROVAL_HASH_);
  if (approvedDate !== sumToday_() || !approvedHash) return scLog_('P27_NEW_5_V2反映_承認後', { status: 'NOT_APPROVED_TODAY' });
  var st = p27State_();
  if (st.stop || st.pending || (st.lastGroup && st.lastGroup.length)) return scLog_('P27_NEW_5_V2反映_承認後', { status: 'STOP_PENDING_UNDO' });
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = p27NewPlan_(v.ss, c.ss), actualHash = p27NewPlanHash_(p);
  if (actualHash !== approvedHash) return scLog_('P27_NEW_5_V2反映_承認後', { status: 'STOP_PLAN_CHANGED', approvedHash: approvedHash, actualHash: actualHash, note: '承認した候補と現在の候補が異なる。再確認・再承認が必要' });
  var group = [], res = {}, failure = '', columns = ['Pocket Casts', 'Pody', 'Apple', 'LISTEN', 'Amazon'];
  for (var i = 0; i < columns.length; i++) {
    var col = columns[i], plan = p.out.filter(function (o) { return o.col === col && o.action === 'WRITE'; }).map(function (o) { return { ep: o.ep, url: o.url, basis: '新着照合: ' + o.reason }; });
    if (!plan.length) continue;
    try {
      var r = p27Write_('V2', v.ss, plan, P27_V2_MAX_PER_RUN_, col, P27_NEW_RE_(col)); res[col] = r;
      if (r.applyId) {
        group.push({ id: r.applyId, target: 'V2', col: col });
        var state = p27State_(); state.lastGroup = group.slice(); p27SetState_(state);
      }
      if (r.status !== 'OK' || r.readbackMismatch !== 0 || r.written !== plan.length) {
        failure = col + ':' + r.status + ' (' + (r.written || 0) + '/' + plan.length + ')'; break;
      }
    } catch (e) {
      // 書込途中の例外でもp27Write_が残した反映IDを救済してUNDO可能にする。
      var recovery = p27State_(), last = recovery.last;
      if (last && recovery.pending && last.id === recovery.pending && last.target === 'V2' && last.col === col && !group.some(function (x) { return x.id === last.id; })) {
        group.push({ id: last.id, target: 'V2', col: col });
        recovery.lastGroup = group.slice(); p27SetState_(recovery);
      }
      failure = col + ':' + String(e).slice(0, 200); break;
    }
  }
  P.deleteProperty('APPROVE_P27_NEW_V2'); P.deleteProperty(P27_NEW_APPROVAL_HASH_);
  return scLog_('P27_NEW_5_V2反映_承認後', { status: failure ? 'STOP_PARTIAL_CHECK_AND_UNDO' : 'OK', failure: failure, byService: res, rollbackColumns: group.map(function (g) { return g.col; }) });
}
// 取り消し失敗時は未完了の列をlastGroupに残し、同じ関数を再実行可能にする。
function P27_NEW_7_直前の新着反映を戻す() {
  var st = p27State_(), group = (st.lastGroup || []).slice();
  // p27Write_が途中で例外停止した場合、pending/lastに記録されたV2反映を救済する。
  if (!group.length && st.pending && st.last && st.last.target === 'V2' && st.last.id === st.pending) {
    group = [st.last]; st.lastGroup = group.slice(); p27SetState_(st);
  }
  if (!group.length) return scLog_('P27_NEW_7_直前の新着反映を戻す', { status: 'NOTHING_TO_UNDO' });
  var ss = scOpen_(SC_CONFIG.v2WorkingId, '').ss, results = [], failure = '';
  while (group.length) {
    var x = group[group.length - 1];
    try {
      var state = p27State_(); state.last = x; p27SetState_(state);
      var r = p27Undo_(ss); results.push({ column: x.col, result: r });
      if (r.status !== 'OK' || (r.keptBecauseChangedAfter || 0) > 0) { failure = x.col + ':' + (r.keptBecauseChangedAfter ? 'MANUAL_CHANGE_PROTECTED' : r.status); break; }
      group.pop(); state = p27State_(); state.lastGroup = group.slice(); if (state.pending === x.id) state.pending = ''; p27SetState_(state);
    } catch (e) { failure = x.col + ':' + String(e).slice(0, 200); break; }
  }
  return scLog_('P27_NEW_7_直前の新着反映を戻す', { status: failure ? 'CHECK_RETRY_REQUIRED' : 'OK', failure: failure, remainingColumns: group.map(function (g) { return g.col; }), results: results });
}
