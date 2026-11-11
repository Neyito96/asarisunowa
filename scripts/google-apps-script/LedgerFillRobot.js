// 第49号: 台帳リンク補完ロボット（省クレジット型）の中核。GAS/Node 共用の純JS。
// 設計: 収集/照合(manifest生成) と 本番書込 を分離。書込は「固定マニフェスト」の承認済みセルだけ。
//  - モード: READ_ONLY(検証のみ) / DRY_RUN(分類のみ・書込なし) / WRITE(承認スコープ内のみ)
//  - 単一ワーカー(ロック)・チャンク単位の再照合・1セルずつ期待値確認・書込後読み戻し・全行差分監査・再開可能チェックポイント
//  - 既存非空セルは絶対に上書きしない(競合はSKIP)。同一値なら冪等(DONE扱い)。
//  - 本ファイルは GAS トリガー/本番には未接続。導入は管理人の別承認後。
// adapter 契約:
//   readColumn(colLetter) -> string[] (index0=1行目)    // 列全体を1回で取得
//   writeCells([{row,col,value}]) -> void               // 失敗時 err.transient=true で再試行可
//   lock: {tryLock(ms)->bool, release()}   props: {get(k)->string|null, set(k,v)}
//   sleep(ms), nowMs(), random()
var LedgerFillRobot_ = (function () {
  var MODES = { READ_ONLY: 1, DRY_RUN: 1, WRITE: 1 };
  var DEFAULTS = { chunkSize: 50, maxAttempts: 6, baseDelayMs: 1000, maxDelayMs: 60000, maxMillis: 330000 };

  function isTransient(err) {
    if (!err) return false;
    if (err.transient === true) return true;
    var m = String((err && err.message) || err);
    return /429|503|quota exceeded|rate limit|service unavailable|timed out|timeout|backend error|internal error/i.test(m);
  }
  function backoff(attempt, o, adapter) {
    var d = Math.min(o.maxDelayMs, o.baseDelayMs * Math.pow(2, attempt));
    return Math.floor(d / 2 + adapter.random() * d / 2);   // equal jitter
  }
  function withRetry(fn, o, adapter, stats) {
    for (var a = 0; ; a++) {
      try { return fn(); } catch (e) {
        if (!isTransient(e) || a + 1 >= o.maxAttempts) throw e;
        stats.retries++; stats.quotaErrors++;
        adapter.sleep(backoff(a, o, adapter));
      }
    }
  }
  function colIndex(letter) { var n = 0; for (var i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64); return n; }
  function isBlank(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function listenUrlOk(u) { return /^https:\/\/listen\.style\/p\/[a-z0-9]{8}\/[a-z0-9]{8}$/.test(u); }

  // マニフェスト形式: {runId, approval:{issue,columns:['K'],maxCells,sheet}, urlShape:'listen', holdEpIds:[], cells:[{epId,column,expectedOld:'',url,guid,basis}]}
  function validateManifest(m) {
    var errs = [];
    if (!m || !m.cells || !m.cells.length) errs.push('NO_CELLS');
    if (!m || !m.approval || !m.approval.issue || !m.approval.columns || !m.approval.maxCells) errs.push('NO_APPROVAL_SCOPE');
    if (errs.length) return errs;
    if (m.cells.length > m.approval.maxCells) errs.push('OVER_MAX_CELLS');
    var seenEp = {}, seenUrl = {};
    m.cells.forEach(function (c, i) {
      if (m.approval.columns.indexOf(c.column) < 0) errs.push('OUT_OF_SCOPE_COLUMN@' + i);
      if (c.expectedOld !== '') errs.push('EXPECTED_OLD_NOT_EMPTY@' + i);
      if (!c.epId || !c.url || !c.guid) errs.push('MISSING_FIELD@' + i);
      if (m.urlShape === 'listen' && !listenUrlOk(c.url)) errs.push('BAD_URL_SHAPE@' + i);
      var k = c.epId + ':' + c.column; if (seenEp[k]) errs.push('DUP_CELL@' + i); seenEp[k] = 1;
      if (seenUrl[c.url]) errs.push('DUP_URL@' + i); seenUrl[c.url] = 1;
      if ((m.holdEpIds || []).indexOf(c.epId) >= 0) errs.push('HOLD@' + i);
      if (m.keyPolicy === 'EPID+GUID' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(c.guid))) errs.push('BAD_GUID@' + i);
    });
    if (m.keyPolicy === 'EPID+GUID' && !(m.guidCheck && m.guidCheck.columns && m.guidCheck.columns.length)) errs.push('NO_GUID_CHECK_COLUMNS');
    return errs;
  }

  // 1セルの分類（ライブ列データに対する期待値確認）
  function classify(c, live, ctx) {
    var rows = ctx.rowsByEp[c.epId];
    if (!rows || rows.length !== 1) return { s: 'SKIP_EPID', why: rows ? 'EPID_MULTI' : 'EPID_NOT_FOUND' };
    var row = rows[0];
    if (ctx.guidCols && ctx.guidCols.length) {                       // 第50号: 行移動対策。EP-IDで引いた行のGUIDを書く直前に再確認
      var hay = ctx.guidCols.map(function (gc) { return String((ctx.guid[gc] || [])[row - 1] || '').toLowerCase(); }).join(' ');
      if (hay.indexOf(String(c.guid).toLowerCase()) < 0) return { s: 'SKIP_GUID_MISMATCH', row: row, why: 'GUID_NOT_ON_ROW' };
    }
    var cur = live[c.column] ? live[c.column][row - 1] : undefined;
    if (!isBlank(cur)) return String(cur).trim() === c.url ? { s: 'DONE', row: row } : { s: 'SKIP_CONFLICT', row: row, why: 'NON_EMPTY' };
    if (ctx.urlRows[c.column] && ctx.urlRows[c.column][c.url] && ctx.urlRows[c.column][c.url] !== row) return { s: 'SKIP_DUP_URL', row: row };
    return { s: 'WRITABLE', row: row };
  }
  function buildCtx(adapter, cols, stats, o, guidCols) {
    var live = {}; var urlRows = {}; var guid = {};
    (guidCols || []).forEach(function (gc) { guid[gc] = withRetry(function () { stats.apiCalls++; return adapter.readColumn(gc); }, o, adapter, stats); });
    var A = withRetry(function () { stats.apiCalls++; return adapter.readColumn('A'); }, o, adapter, stats);
    cols.forEach(function (col) {
      live[col] = withRetry(function () { stats.apiCalls++; return adapter.readColumn(col); }, o, adapter, stats);
      urlRows[col] = {}; live[col].forEach(function (v, i) { if (i > 0 && !isBlank(v)) urlRows[col][String(v).trim()] = i + 1; });
    });
    var rowsByEp = {}; A.forEach(function (v, i) { if (i > 0 && !isBlank(v)) (rowsByEp[String(v).trim()] = rowsByEp[String(v).trim()] || []).push(i + 1); });
    return { live: live, urlRows: urlRows, rowsByEp: rowsByEp, guid: guid, guidCols: guidCols || [] };
  }

  function run(manifest, adapter, mode, opts) {
    var o = {}; Object.keys(DEFAULTS).forEach(function (k) { o[k] = (opts && opts[k] !== undefined) ? opts[k] : DEFAULTS[k]; });
    var res = { mode: mode, runId: manifest && manifest.runId, status: 'INIT', counts: { planned: 0, written: 0, done: 0, skipped: 0, failed: 0 }, skips: [], failures: [], stats: { apiCalls: 0, retries: 0, quotaErrors: 0 } };
    if (!MODES[mode]) { res.status = 'BAD_MODE'; return res; }
    var errs = validateManifest(manifest);
    if (errs.length) { res.status = 'MANIFEST_INVALID'; res.errors = errs.slice(0, 20); return res; }
    res.counts.planned = manifest.cells.length;
    if (!adapter.lock.tryLock(5000)) { res.status = 'LOCKED'; return res; }   // 重複起動防止
    var t0 = adapter.nowMs(); var stats = res.stats;
    try {
      var ckKey = 'lfr:' + manifest.runId; var ck = adapter.props.get(ckKey); ck = ck ? JSON.parse(ck) : { settled: {} };
      var cols = []; manifest.cells.forEach(function (c) { if (cols.indexOf(c.column) < 0) cols.push(c.column); });
      var gcols = (manifest.guidCheck && manifest.guidCheck.columns) || [];
      var pending = manifest.cells.filter(function (c) { return !ck.settled[c.epId + ':' + c.column]; });
      for (var p = 0; p < pending.length; p += o.chunkSize) {
        if (adapter.nowMs() - t0 > o.maxMillis) { res.status = 'PARTIAL_TIME'; break; }          // 次回、チェックポイントから再開
        var chunk = pending.slice(p, p + o.chunkSize);
        var ctx = buildCtx(adapter, cols, stats, o, gcols);                                              // チャンク直前に最新を再取得
        var todo = [];
        chunk.forEach(function (c) {
          var r = classify(c, ctx.live, ctx);
          if (r.s === 'DONE') { res.counts.done++; ck.settled[c.epId + ':' + c.column] = 'DONE'; }
          else if (r.s === 'WRITABLE') todo.push({ c: c, row: r.row });
          else { res.counts.skipped++; res.skips.push({ epId: c.epId, s: r.s, why: r.why || '' }); ck.settled[c.epId + ':' + c.column] = r.s; }
        });
        if (mode !== 'WRITE') { res.counts.done += 0; todo.forEach(function (t) { res.counts.written += 0; res.dryRunWritable = (res.dryRunWritable || 0) + 1; }); continue; }
        if (todo.length) {
          var upd = todo.map(function (t) { return { row: t.row, col: t.c.column, value: t.c.url }; });
          try { withRetry(function () { stats.apiCalls++; adapter.writeCells(upd); }, o, adapter, stats); }
          catch (e) {
            // 書込結果が不明 → 再読込して確認（空欄のままのセルだけが未書込）。ここでは停止して報告。
            res.status = 'HALT_WRITE_ERROR'; res.failures.push({ error: String((e && e.message) || e).slice(0, 200) });
            adapter.props.set(ckKey, JSON.stringify(ck)); return res;
          }
          var after = buildCtx(adapter, cols, stats, o, []);                                          // 読み戻し
          todo.forEach(function (t) {
            var got = after.live[t.c.column][t.row - 1];
            if (String(got).trim() === t.c.url) { res.counts.written++; ck.settled[t.c.epId + ':' + t.c.column] = 'WRITTEN'; }
            else { res.counts.failed++; res.failures.push({ epId: t.c.epId, row: t.row, got: String(got || '').slice(0, 80) }); }
          });
          adapter.props.set(ckKey, JSON.stringify(ck));
          if (res.counts.failed) { res.status = 'HALT_READBACK_MISMATCH'; return res; }           // 異常時は停止
        } else adapter.props.set(ckKey, JSON.stringify(ck));
      }
      if (res.status === 'INIT') res.status = (mode === 'WRITE') ? 'COMPLETE' : 'COMPLETE_' + mode;
      return res;
    } finally { adapter.lock.release(); }
  }

  // 全行差分監査: pre/post は 2次元配列(A..K)。期待変更=マニフェスト中 WRITTEN のセルのみ。
  function auditDiff(pre, post, manifest, rowsByEpPost, columns) {
    var rows = {}; (post || []).forEach(function (r, i) { if (i > 0 && r[0]) rows[r[0]] = i + 1; });
    var exp = {}; manifest.cells.forEach(function (c) { var r = rows[c.epId]; if (r) exp[r + ':' + (colIndex(c.column) - 1)] = c; });
    var changed = [], n = Math.max(pre.length, post.length), w = (columns || 11);
    for (var r = 1; r <= n; r++) for (var c = 0; c < w; c++) {
      var a = (pre[r - 1] || [])[c] || '', b = (post[r - 1] || [])[c] || '';
      if (a !== b) changed.push(r + ':' + c);
    }
    var extra = changed.filter(function (k) { return !exp[k] || ((post[+k.split(':')[0] - 1] || [])[+k.split(':')[1]] || '') !== exp[k].url; });
    return { changed: changed.length, unexpected: extra.length, unexpectedCells: extra.slice(0, 10) };
  }

  // 第50号: EP-ID基準の全行差分監査（行の挿入・並べ替えがあっても、行番号でなくEP-IDで前後を突き合わせる）。
  // pre/post は 2次元配列(A..K, 1行目ヘッダ)。想定変更 = マニフェスト中セルが空欄→そのURLになった場合のみ。
  function auditDiffByEp(pre, post, manifest, columns) {
    var w = columns || 11, exp = {};
    manifest.cells.forEach(function (c) { exp[c.epId + ':' + (colIndex(c.column) - 1)] = c.url; });
    function index(t) { var m = {}, dup = []; (t || []).forEach(function (r, i) { if (i > 0 && r && r[0]) { if (m[r[0]]) dup.push(r[0]); m[r[0]] = r; } }); return { m: m, dup: dup }; }
    var A = index(pre), B = index(post), unexpected = [], changed = 0;
    Object.keys(A.m).forEach(function (ep) { if (!B.m[ep]) unexpected.push(ep + ':MISSING_AFTER'); });
    Object.keys(B.m).forEach(function (ep) {
      var a = A.m[ep], b = B.m[ep];
      if (!a) { unexpected.push(ep + ':NEW_ROW'); return; }
      for (var c = 0; c < w; c++) {
        var x = String(a[c] || ''), y = String(b[c] || '');
        if (x === y) continue; changed++;
        var e = exp[ep + ':' + c];
        if (!(e !== undefined && x.trim() === '' && y.trim() === e)) unexpected.push(ep + ':' + c);
      }
    });
    return { changed: changed, unexpected: unexpected.length, unexpectedCells: unexpected.slice(0, 10), dupEpIdsBefore: A.dup.length, dupEpIdsAfter: B.dup.length };
  }

  return { run: run, validateManifest: validateManifest, auditDiff: auditDiff, auditDiffByEp: auditDiffByEp, isTransient: isTransient, DEFAULTS: DEFAULTS, listenUrlOk: listenUrlOk };
})();

// マニフェストのハッシュ対象文字列（build-manifest*.mjs と同じ: sha256 を除いた JSON.stringify）。
function ledgerFillRobotDigestInput_(m) { var c = JSON.parse(JSON.stringify(m)); delete c.sha256; return JSON.stringify(c); }

// GAS 用アダプタ（本番未接続）。第50号: 既存 SPREADSHEET_ID（コード.js の別シート）は使わない。書込先は必ず明示する。
function ledgerFillRobotGasAdapter_(spreadsheetId, sheetName) {
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) throw new Error('LFR_SHEET_NOT_FOUND');
  var lock = LockService.getScriptLock(); var props = PropertiesService.getScriptProperties();
  function colNo(col) { var n = 0; for (var i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64); return n; }
  return {
    readColumn: function (col) { var last = sheet.getLastRow(); return sheet.getRange(1, colNo(col), last, 1).getDisplayValues().map(function (r) { return String(r[0]); }); },
    writeCells: function (cells) { cells.forEach(function (u) { sheet.getRange(u.row, colNo(u.col)).setValue(u.value); }); SpreadsheetApp.flush(); },
    lock: { tryLock: function (ms) { return lock.tryLock(ms); }, release: function () { lock.releaseLock(); } },
    props: { get: function (k) { return props.getProperty(k); }, set: function (k, v) { props.setProperty(k, v); } },
    sleep: function (ms) { Utilities.sleep(ms); }, nowMs: function () { return Date.now(); }, random: Math.random
  };
}

// 手動実行用エントリ（第50号）。設定は Script Properties だけで行い、コードに台帳IDを書かない。
//   LFR_TARGET_SPREADSHEET_ID : 書込先（COPY試験では COPY 台帳のID）
//   LFR_MANIFEST_FILE_ID      : マニフェストJSONを置いた Drive ファイルID
//   LFR_APPROVED_SHA256       : 管理人が承認したマニフェストの sha256
//   LFR_ALLOW_WRITE_RUN_ID    : WRITE を許可する runId（空なら WRITE 不可）
// WRITE の条件: 上記すべて一致 + manifest.approval.spreadsheetId == LFR_TARGET_SPREADSHEET_ID。
function runLedgerFillRobotFromProps(mode) {
  mode = mode || 'DRY_RUN';
  var p = PropertiesService.getScriptProperties();
  var target = p.getProperty('LFR_TARGET_SPREADSHEET_ID'), fileId = p.getProperty('LFR_MANIFEST_FILE_ID');
  if (!target || !fileId) return { status: 'CONFIG_MISSING' };
  var m = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8'));
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ledgerFillRobotDigestInput_(m), Utilities.Charset.UTF_8);
  var hex = bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
  if (hex !== m.sha256) return { status: 'MANIFEST_HASH_MISMATCH' };
  if (mode === 'WRITE') {
    if (hex !== p.getProperty('LFR_APPROVED_SHA256')) return { status: 'WRITE_NOT_APPROVED_SHA' };
    if (m.runId !== p.getProperty('LFR_ALLOW_WRITE_RUN_ID')) return { status: 'WRITE_NOT_APPROVED_RUN' };
    if (!m.approval || m.approval.spreadsheetId !== target) return { status: 'WRITE_TARGET_MISMATCH' };
  }
  var res = LedgerFillRobot_.run(m, ledgerFillRobotGasAdapter_(target, m.approval.sheet), mode);
  console.log(JSON.stringify({ runId: res.runId, mode: res.mode, status: res.status, counts: res.counts, stats: res.stats, skips: res.skips.length, failures: res.failures.slice(0, 5) }));
  return res;
}
if (typeof module !== 'undefined' && module.exports) { LedgerFillRobot_.digestInput = ledgerFillRobotDigestInput_; module.exports = LedgerFillRobot_; }
