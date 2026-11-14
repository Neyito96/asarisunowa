// 独立COPY専用GAS（gas/p25v2-copy/dist/P25V2CopyIngest.js）の試験。実物の配布ファイルを GAS 模擬環境で動かす。合成データのみ。
// 模擬PASS ≠ 実機確認。実機（OAuth後のCOPY実行）は管理人操作で別途行う。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { buildCopyGas } from '../scripts/ledger-v2/build-copy-gas.mjs';
const DIST = 'gas/p25v2-copy/dist/P25V2CopyIngest.js', SRC = fs.readFileSync(DIST, 'utf8');
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const COPY = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';

function mkSheet(name, rows, maxCols) {
  const st = { name, rows: rows.map((r) => [...r]) }, w = () => Math.max(maxCols || 0, ...st.rows.map((r) => r.length), 1);
  const put = (r, c, x) => { while (st.rows.length < r) st.rows.push([]); st.rows[r - 1][c - 1] = x; };
  const get = (r, c) => String((st.rows[r - 1] || [])[c - 1] ?? '');
  const rng = (r, c, nr = 1, nc = 1) => ({ getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))),
    getDisplayValue: () => get(r, c), getValue: () => get(r, c), setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => put(r + i, c + j, x))), setValue: (x) => put(r, c, x), copyFormatToRange: () => {} });
  return { st, getName: () => name, getLastRow: () => st.rows.length, getLastColumn: () => w(), getMaxColumns: () => w(), getRange: rng, appendRow: (row) => st.rows.push([...row]) };
}
const V1 = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', V2W = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
function env({ id = COPY, name = '【COPY試験】V2収蔵ボット', triggers = 0, feed, details = [], ledgerExtra = [], v1Rows = [['EP-00001', 'aaaaaaaa-0000-4000-8000-000000000000']], v2Rows = [] } = {}) {
  const box = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), box); const A = box.module.exports;
  const H = [...A.HEADERS], led = H.map(() => ''); led[0] = 'EP-00010'; led[H.indexOf('番組')] = 'ニュースの学校'; led[H.indexOf('タイトル')] = '既存'; led[H.indexOf('配信日時 JST')] = '2026/11/01 04:00'; led[H.indexOf('掲載判定')] = '対象'; led[H.indexOf('代表EP-ID')] = 'EP-00010'; led[H.indexOf('公式GUID')] = 'aaaaaaaa-0000-4000-8000-000000000010';
  const extra = ledgerExtra.map(([ep, gd]) => { const r = H.map(() => ''); r[0] = ep; r[H.indexOf('番組')] = 'ニュースの学校'; r[H.indexOf('タイトル')] = 't' + ep; r[H.indexOf('配信日時 JST')] = '2026/11/02 04:00'; r[H.indexOf('掲載判定')] = '未判定'; r[H.indexOf('代表EP-ID')] = ep; r[H.indexOf('公式GUID')] = gd; return r; });
  const sheets = { 'V2・統合台帳': mkSheet('V2・統合台帳', [H, led, ...extra]), '固定ID採番履歴': mkSheet('固定ID採番履歴', [[...A.NUM_HEADERS]], 9), 'V2・収蔵詳細': mkSheet('V2・収蔵詳細', [[...A.DETAIL_HEADERS], ...details], 17) };
  const props = {}, logs = [], fetched = [];
  const g = { Date, JSON, Math, Logger: { log: (s) => logs.push(s) },
    SpreadsheetApp: { openById: (x) => {
      if (x === V1) { const v1 = { 'エピソード台帳': mkSheet('エピソード台帳', [['台帳ID', '番組名', 'タイトル', '配信日時（JST）', '媒体', '取得元', '外部ID'], ...v1Rows.map(([e, gd]) => [e, '', '', '', '', '', gd])]) }; return { getId: () => V1, getName: () => '本番', getSheetByName: (n) => v1[n] || null, insertSheet: () => { throw new Error('V1_WRITE_FORBIDDEN'); } }; }
      if (x === V2W) { const v2 = { 'V2・統合台帳': mkSheet('V2・統合台帳', [['EP-ID', '公式GUID'], ...v2Rows]) }; return { getId: () => V2W, getName: () => 'V2', getSheetByName: (n) => v2[n] || null, insertSheet: () => { throw new Error('V2_WRITE_FORBIDDEN'); } }; }
      assert.equal(x, COPY); return { getId: () => id, getName: () => name, getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n, [])) }; }, flush() {} },
    UrlFetchApp: { fetch: (u) => { fetched.push(u); return feed(u); } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ScriptApp: { getProjectTriggers: () => Array(triggers).fill({}), newTrigger: () => { throw new Error('TRIGGER_FORBIDDEN'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { sleep() {}, DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)) } };
  vm.runInNewContext(SRC, g);
  return { g, A, sheets, props, logs, fetched, run: (fn) => vm.runInNewContext(fn + '()', g) };
}
const RAW = '<p>合成の概要原文です。</p><p>ご意見・感想・リクエスト https://bit.ly/x</p>';
const rss = (items) => `<?xml version="1.0"?><rss><channel><title>t</title>${items.map((x) => `<item><title>${x.title}</title><guid>${x.guid}</guid><pubDate>${x.pub}</pubDate><link>https://example.invalid/e</link><description><![CDATA[${x.raw}]]></description><enclosure url="https://example.invalid/a.mp3"/></item>`).join('')}</channel></rss>`;
const G1 = 'bbbbbbbb-0000-4000-8000-000000000001', G2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const okFeed = (items) => (u) => ({ getResponseCode: () => 200, getContentText: () => (/TASC5851398719/.test(u) ? rss(items) : rss([])) });

test('配布ファイルは元コードから再生成した結果と一致（ずれ防止）・構文OK', () => {
  const b = buildCopyGas(); assert.equal(SRC, b['P25V2CopyIngest.js']); assert.equal(fs.readFileSync('gas/p25v2-copy/dist/appsscript.json', 'utf8'), b['appsscript.json']);
  assert.doesNotThrow(() => new vm.Script(SRC));
  const defined = new Set([...SRC.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]));
  assert.deepEqual([...SRC.matchAll(/\b(p25v2[A-Za-z0-9_]*|P25V2_[A-Z0-9_]+)\s*\(/g)].map((m) => m[1]).filter((f) => !defined.has(f)), []);   // 1ファイルで完結
});

test('静的検査: doGet/doPost なし・トリガー作成なし・使うGASサービスは限定・設定の対象はCOPYで保護ID外・RSSは記録済み7本', () => {
  assert.ok(!/function\s+do(Get|Post)\b/.test(SRC)); assert.ok(!/DriveApp|GmailApp|MailApp/.test(SRC));
  // トリガー作成は承認ボタン後の P25V2_D8 だけ（1本・他のトリガーがあれば拒否）。削除は P25V2_D9 だけ
  const fnOf = (re) => [...SRC.matchAll(/function\s+([^\s(]+)\s*\([^)]*\)\s*\{/g)].map((m) => ({ name: m[1], at: m.index })).filter((f, i, a) => { const end = (a[i + 1] || { at: SRC.length }).at; return re.test(SRC.slice(f.at, end)); }).map((f) => f.name);
  assert.deepEqual(fnOf(/newTrigger/), ['P25V2_D8_日次トリガー設置']); assert.deepEqual(fnOf(/deleteTrigger/), ['P25V2_D9_日次停止_トリガー削除']);
  const d8 = SRC.slice(SRC.indexOf('function P25V2_D8_日次トリガー設置')); assert.ok(d8.indexOf("p25v2Approved_('APPROVE_DAILY_TRIGGER')") < d8.indexOf('newTrigger'));
  const used = new Set([...SRC.matchAll(/\b(SpreadsheetApp|UrlFetchApp|LockService|ScriptApp|Utilities|PropertiesService|Logger|DriveApp|CacheService|MailApp)\./g)].map((m) => m[1]));
  assert.deepEqual([...used].sort(), ['LockService', 'Logger', 'PropertiesService', 'ScriptApp', 'SpreadsheetApp', 'UrlFetchApp', 'Utilities']);
  assert.deepEqual([...SRC.matchAll(/ScriptApp\.(\w+)/g)].map((m) => m[1]).filter((x, i, a) => a.indexOf(x) === i), ['getProjectTriggers', 'newTrigger', 'deleteTrigger']);
  const e = env({ feed: okFeed([]) }), cfg = JSON.parse(JSON.stringify(vm.runInNewContext('P25V2_COPY_CONFIG', e.g)));
  assert.equal(cfg.targetSpreadsheetId, COPY); assert.equal(cfg.expectedTargetId, COPY); assert.ok(!e.A.PROTECTED.includes(COPY)); assert.equal(cfg.maxRowsCap, 10);
  const feeds = JSON.parse(fs.readFileSync('scripts/ledger-v2/v2-feeds.json', 'utf8')).feeds;
  assert.deepEqual(cfg.feeds.map((f) => [f.show, f.url]), feeds.map((f) => [f.show, f.url]));
  const scopes = JSON.parse(fs.readFileSync('gas/p25v2-copy/appsscript.json', 'utf8')).oauthScopes;
  assert.deepEqual(scopes, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.scriptapp']);
  assert.ok(fs.readFileSync('scripts/google-apps-script/.claspignore', 'utf8').includes('P25V2IngestAdapter.js'));   // 本番GASへ混入させない
});

test('通し: 点検→予行（書込0）→1件書込（台帳・採番・原文）→検証OK→再実行は既収蔵で追加0。清掃・出演者・関連記事は台帳に書かない', () => {
  const e = env({ feed: okFeed([{ title: '新着A', guid: G1, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: RAW }]) });
  const c = e.run('P25V2_1_CHECK'); assert.equal(c.status, 'CHECK_OK'); assert.equal(c.feeds.length, 7);
  const snap = () => JSON.stringify(Object.values(e.sheets).map((s) => s.st.rows));
  const before = snap(); const d = e.run('P25V2_2_DRYRUN'); assert.equal(d.counts.CANDIDATE, 1); assert.equal(snap(), before);
  const w = e.run('P25V2_3_WRITE_ONE'); assert.equal(w.status, 'OK'); assert.equal(w.added, 1);
  const led = e.sheets['V2・統合台帳'].st.rows, H = led[0], row = led[2];
  assert.equal(row[H.indexOf('公式GUID')], G1); assert.equal(row[H.indexOf('概要（清掃済）')], ''); assert.equal(row[H.indexOf('出演者')], ''); assert.equal(row[H.indexOf('関連記事URL')], '');
  assert.equal(row[0], 'EP-06721');   // 既知最大 6720 の次
  const det = e.sheets['V2・収蔵詳細'].st.rows; assert.equal(det[1][4], RAW); assert.equal(det[1][5], sha(RAW)); assert.equal(det[1][7], '未清掃');
  assert.equal(e.sheets['固定ID採番履歴'].st.rows[1][4], '登録完了');
  const v = e.run('P25V2_4_VERIFY'); assert.equal(v.status, 'VERIFY_OK', JSON.stringify(v));
  const after = JSON.stringify([led, det]); const w2 = e.run('P25V2_3_WRITE_ONE'); assert.equal(w2.added, 0); assert.equal(JSON.stringify([led, det]), after);
  const log = e.sheets['V2・実行ログ'].st.rows; assert.equal(log[0][0], '実行日時'); assert.ok(!JSON.stringify(log).includes('合成の概要原文'));   // ログに本文を書かない
});

test('対象の確認: 保護ID・名前違い・開いたIDの食い違い・トリガーありは、書込前に停止', () => {
  const f = okFeed([]);
  assert.throws(() => env({ name: 'V2収蔵ボット', feed: f }).run('P25V2_1_CHECK'), /TARGET_NAME_NOT_COPY|TARGET_NAME_NOT_EXPECTED/);
  assert.throws(() => env({ name: 'COPY 何か', feed: f }).run('P25V2_1_CHECK'), /TARGET_NAME_NOT_EXPECTED/);
  assert.throws(() => env({ id: 'OTHER', feed: f }).run('P25V2_1_CHECK'), /OPENED_ID_MISMATCH/);
  assert.throws(() => env({ triggers: 1, feed: f }).run('P25V2_3_WRITE_ONE'), /TRIGGERS_PRESENT/);
  const e = env({ feed: f }); vm.runInNewContext("P25V2_COPY_CONFIG.targetSpreadsheetId = P25V2_COPY_CONFIG.expectedTargetId = '" + e.A.PROTECTED[0] + "'", e.g);
  assert.throws(() => e.run('P25V2_3_WRITE_ONE'), /PROTECTED_TARGET_REFUSED/);
});

test('障害: 5xx は1回だけ再試行して成功、4xx は再試行せず記録して書込0、収蔵詳細の列不足は点検で停止', () => {
  let n = 0; const e = env({ feed: (u) => (/TASC5851398719/.test(u) && n++ === 0 ? { getResponseCode: () => 503, getContentText: () => '' } : okFeed([{ title: 'A', guid: G1, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: RAW }])(u)) });
  assert.equal(e.run('P25V2_3_WRITE_ONE').added, 1);
  const e2 = env({ feed: () => ({ getResponseCode: () => 404, getContentText: () => '' }) }); const r = e2.run('P25V2_3_WRITE_ONE');
  assert.equal(r.status, 'STOP_FEED_ERRORS'); assert.equal(r.added, 0); assert.equal(r.feedErrors.length, 7); assert.equal(e2.fetched.length, 7);
  const e3 = env({ feed: okFeed([]) }); e3.sheets['V2・収蔵詳細'] = mkSheet('V2・収蔵詳細', [e3.A.DETAIL_HEADERS.slice(0, 12)], 12);
  assert.throws(() => e3.run('P25V2_1_CHECK'), /SHEET_TOO_NARROW/);
});

const D = (ep, g, h, len) => [ep, g, '', '', '', h, String(len), '原文未取得（長さ・ハッシュのみ確認）', '', '', '', '', '', '', '', '', '未取得（長さ・ハッシュのみ）'];
const R2 = '<p>二件目の合成原文。</p>', G3 = 'bbbbbbbb-0000-4000-8000-000000000003';
const bfEnv = (feed) => env({ details: [D('EP-06701', G1, sha(RAW).slice(0, 16), RAW.length), D('EP-06702', G2, 'deadbeefdeadbeef', R2.length), D('EP-06703', G3, sha(RAW).slice(0, 16), RAW.length)],
  ledgerExtra: [['EP-06701', G1], ['EP-06702', G2], ['EP-06703', 'cccccccc-0000-4000-8000-000000000009']],
  feed: feed || okFeed([{ title: 'A', guid: G1, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: RAW }, { title: 'B', guid: G2, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: R2 }, { title: 'C', guid: G3, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: RAW }]) });

test('新着0のとき: DRYRUN は WRITE_ONE を勧めず原文補完へ案内、VERIFY は書込記録なしを NO_WRITE_TO_VERIFY と返す', () => {
  const e = env({ feed: okFeed([{ title: '既存', guid: 'aaaaaaaa-0000-4000-8000-000000000010', pub: 'Sat, 31 Oct 2026 19:00:00 GMT', raw: RAW }]) });
  const c = e.run('P25V2_1_CHECK'); assert.equal(c.status, 'CHECK_OK'); assert.equal(c.publicCount, 1); assert.equal(typeof c.fetchAllMs, 'number'); assert.ok(c.feeds.every((f) => typeof f.chars === 'number'));
  const d = e.run('P25V2_2_DRYRUN'); assert.equal(d.counts.CANDIDATE, 0); assert.match(d.next, /WRITE_ONE は実行しない.*BACKFILL_RAW/);
  assert.equal(e.run('P25V2_4_VERIFY').status, 'NO_WRITE_TO_VERIFY');
  const w = e.run('P25V2_3_WRITE_ONE'); assert.equal(w.added, 0); assert.equal(e.props.P25V2_LAST_WRITE, undefined);   // 追加0なら検証記録を作らない
});

test('原文の後日補完: GUID/EP-ID/SHA/文字数が一致し原文が空の行だけ埋める。他セル不変・公開数不変・再実行は差分0。ハッシュ違い・台帳GUID違いは HOLD', () => {
  const e = bfEnv(), det = e.sheets['V2・収蔵詳細'].st.rows;
  const r = JSON.parse(JSON.stringify(e.run('P25V2_5_BACKFILL_RAW')));
  assert.equal(r.status, 'OK'); assert.deepEqual(r.filled, ['EP-06701']); assert.equal(r.otherCellsChanged, 0); assert.equal(r.publicBefore, r.publicAfter);
  assert.deepEqual(r.hold.map((h) => [h.epId, h.why]).sort(), [['EP-06702', 'SHA_MISMATCH'], ['EP-06703', 'LEDGER_GUID_MISMATCH']]);
  assert.equal(det[1][4], RAW); assert.equal(det[1][5], sha(RAW)); assert.equal(det[1][6], String(RAW.length)); assert.equal(det[1][7], '未清掃'); assert.equal(det[2][4], ''); assert.equal(det[3][4], '');
  const snap = JSON.stringify(det); const again = e.run('P25V2_5_BACKFILL_RAW');
  assert.equal(again.status, 'OK_NO_CHANGE'); assert.equal(again.filled.length, 0); assert.equal(JSON.stringify(det), snap);
  assert.ok(!JSON.stringify(e.sheets['V2・実行ログ'].st.rows).includes('合成の概要原文'));
});

test('原文の後日補完: 取得エラーが1本でもあれば書込0で停止（STOP_FEED_ERRORS）', () => {
  const e = bfEnv((u) => (/TASC9421488254/.test(u) ? { getResponseCode: () => 404, getContentText: () => '' } : okFeed([{ title: 'A', guid: G1, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: RAW }])(u)));
  const snap = JSON.stringify(e.sheets['V2・収蔵詳細'].st.rows), r = e.run('P25V2_5_BACKFILL_RAW');
  assert.equal(r.status, 'STOP_FEED_ERRORS'); assert.equal(JSON.stringify(e.sheets['V2・収蔵詳細'].st.rows), snap);
});


test('採番の単一経路: 旧本番が別の回に使った番号は振らない・旧本番と同じGUIDは空いていれば同じ番号、埋まっていれば新番号＋元EP-ID（旧本番・V2は読むだけ）', () => {
  // 旧本番: EP-06725 は別GUID、EP-06703 は G1 と同じ回（ただし V2 で EP-06703 は別の回）。V2: EP-06703 と EP-06725 を使用
  const items = [{ title: '新着1', guid: G1, pub: 'Fri, 13 Nov 2026 19:00:00 GMT', raw: RAW }, { title: '新着2', guid: G2, pub: 'Sat, 14 Nov 2026 19:00:00 GMT', raw: RAW }];
  const e = env({ feed: okFeed(items), v1Rows: [['EP-06703', G1], ['EP-06725', 'cccccccc-0000-4000-8000-000000000009'], ['EP-06710', G2]], v2Rows: [['EP-06703', 'dddddddd-0000-4000-8000-000000000001'], ['EP-06725', 'dddddddd-0000-4000-8000-000000000002']] });
  const r = JSON.parse(JSON.stringify(e.run('P25V2_2_DRYRUN')));
  const plan = Object.fromEntries((r.plan || r.result && r.result.plan || []).map((p) => [p.guid, p]));
  assert.equal(plan[G1].epId, 'EP-06726'); assert.equal(plan[G1].originV1, 'EP-06703');   // 旧本番の番号は V2 で別の回 → 新番号、元EP-IDに旧本番
  assert.equal(plan[G2].epId, 'EP-06710'); assert.equal(plan[G2].fromV1, true);          // 旧本番の番号がどこでも空いている → 揃える
});
test('採番の単一経路: 旧本番が読めなければ止まる（推測で採番しない）', () => {
  const e = env({ feed: okFeed([]), v1Rows: [] });
  assert.throws(() => e.run('P25V2_2_DRYRUN'), /RESERVATION_V1_EMPTY/);
});

test('最終設計: COPYは本番番号を予約・消費しない（V2の予約にCOPY台帳の番号を数えない）。COPYの中ではCOPYも数える', () => {
  const e = env({ feed: okFeed([]), ledgerExtra: [['EP-06740', 'eeeeeeee-0000-4000-8000-000000000001']], v1Rows: [['EP-06710', G2]], v2Rows: [['EP-06725', 'dddddddd-0000-4000-8000-000000000002']] });
  const v2 = JSON.parse(JSON.stringify(e.g.p25v2GlobalReservation_({ includeCopy: false })));
  assert.equal(v2.max, 6725); assert.equal(v2.summary.includeCopy, false); assert.deepEqual(v2.guidReserve, {}); assert.equal(v2.used['EP-06740'], undefined);
  const cp = JSON.parse(JSON.stringify(e.g.p25v2GlobalReservation_()));
  assert.equal(cp.max, 6740); assert.equal(cp.summary.includeCopy, true);
  const chk = JSON.parse(JSON.stringify(e.run('P25V2_0_採番点検'))); assert.equal(chk.nextIfNew || (chk.result && chk.result.nextIfNew), 'EP-06726');
});
test('COPY一括: 未収蔵3件を古い順に1回で収蔵→検証OK→再実行は0件（COPYだけに書く）', () => {
  const G3 = 'bbbbbbbb-0000-4000-8000-000000000033';
  const items = [{ title: '新着B', guid: G2, pub: 'Sat, 14 Nov 2026 19:00:00 GMT', raw: RAW }, { title: '新着A', guid: G1, pub: 'Fri, 13 Nov 2026 19:00:00 GMT', raw: RAW }, { title: '新着C', guid: G3, pub: 'Sat, 14 Nov 2026 21:00:00 GMT', raw: RAW }];
  const e = env({ feed: okFeed(items) });
  const w = JSON.parse(JSON.stringify(e.run('P25V2_3B_WRITE_BATCH_COPY'))); assert.equal(w.status, 'OK', JSON.stringify(w)); assert.equal(w.added, 3);
  const led = e.sheets['V2・統合台帳'].st.rows; assert.equal(led.length, 5);
  assert.equal(e.run('P25V2_4_VERIFY').status, 'VERIFY_OK');
  const snap = JSON.stringify(led); const w2 = e.run('P25V2_3B_WRITE_BATCH_COPY'); assert.equal(w2.added, 0); assert.equal(JSON.stringify(led), snap);
});
