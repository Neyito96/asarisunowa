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
function env({ id = COPY, name = '【COPY試験】V2収蔵ボット', triggers = 0, feed, details = [] } = {}) {
  const box = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), box); const A = box.module.exports;
  const H = [...A.HEADERS], led = H.map(() => ''); led[0] = 'EP-00010'; led[H.indexOf('番組')] = 'ニュースの学校'; led[H.indexOf('タイトル')] = '既存'; led[H.indexOf('配信日時 JST')] = '2026/11/01 04:00'; led[H.indexOf('掲載判定')] = '対象'; led[H.indexOf('代表EP-ID')] = 'EP-00010'; led[H.indexOf('公式GUID')] = 'aaaaaaaa-0000-4000-8000-000000000010';
  const sheets = { 'V2・統合台帳': mkSheet('V2・統合台帳', [H, led]), '固定ID採番履歴': mkSheet('固定ID採番履歴', [[...A.NUM_HEADERS]], 9), 'V2・収蔵詳細': mkSheet('V2・収蔵詳細', [[...A.DETAIL_HEADERS], ...details], 17) };
  const props = {}, logs = [], fetched = [];
  const g = { Date, JSON, Math, Logger: { log: (s) => logs.push(s) },
    SpreadsheetApp: { openById: (x) => { assert.equal(x, COPY); return { getId: () => id, getName: () => name, getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n, [])) }; }, flush() {} },
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
  assert.ok(!/function\s+do(Get|Post)\b/.test(SRC)); assert.ok(!/newTrigger|deleteTrigger|\.timeBased\(|\.everyDays\(|DriveApp|GmailApp|MailApp/.test(SRC));
  const used = new Set([...SRC.matchAll(/\b(SpreadsheetApp|UrlFetchApp|LockService|ScriptApp|Utilities|PropertiesService|Logger|DriveApp|CacheService|MailApp)\./g)].map((m) => m[1]));
  assert.deepEqual([...used].sort(), ['LockService', 'Logger', 'PropertiesService', 'ScriptApp', 'SpreadsheetApp', 'UrlFetchApp', 'Utilities']);
  assert.deepEqual([...SRC.matchAll(/ScriptApp\.(\w+)/g)].map((m) => m[1]).filter((x, i, a) => a.indexOf(x) === i), ['getProjectTriggers']);
  const e = env({ feed: okFeed([]) }), cfg = JSON.parse(JSON.stringify(vm.runInNewContext('P25V2_COPY_CONFIG', e.g)));
  assert.equal(cfg.targetSpreadsheetId, COPY); assert.equal(cfg.expectedTargetId, COPY); assert.ok(!e.A.PROTECTED.includes(COPY)); assert.equal(cfg.maxRowsCap, 1);
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
  assert.equal(r.added, 0); assert.equal(r.feedErrors.length, 7); assert.equal(e2.fetched.length, 7);
  const e3 = env({ feed: okFeed([]) }); e3.sheets['V2・収蔵詳細'] = mkSheet('V2・収蔵詳細', [e3.A.DETAIL_HEADERS.slice(0, 12)], 12);
  assert.throws(() => e3.run('P25V2_1_CHECK'), /SHEET_TOO_NARROW/);
});

test('原文の後日補完: ハッシュ一致・空欄だけ埋める。ハッシュ違いは上書きせず HOLD。再実行は0', () => {
  const r2 = '<p>二件目の合成原文。</p>';
  const d1 = ['EP-06701', G1, '', '', '', sha(RAW).slice(0, 16), String(RAW.length), '原文未取得（長さ・ハッシュのみ確認）', '', '', '', '', '', '', '', '', '未取得（長さ・ハッシュのみ）'];
  const d2 = ['EP-06702', G2, '', '', '', 'deadbeefdeadbeef', String(r2.length), '原文未取得（長さ・ハッシュのみ確認）', '', '', '', '', '', '', '', '', '未取得（長さ・ハッシュのみ）'];
  const e = env({ details: [d1, d2], feed: okFeed([{ title: 'A', guid: G1, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: RAW }, { title: 'B', guid: G2, pub: 'Tue, 10 Nov 2026 19:00:00 GMT', raw: r2 }]) });
  const r = JSON.parse(JSON.stringify(e.run('P25V2_5_BACKFILL_RAW'))); assert.deepEqual(r.filled, ['EP-06701']); assert.deepEqual(r.hold, [{ epId: 'EP-06702', why: 'SHA_MISMATCH' }]);
  const det = e.sheets['V2・収蔵詳細'].st.rows; assert.equal(det[1][4], RAW); assert.equal(det[1][5], sha(RAW)); assert.equal(det[1][7], '未清掃'); assert.equal(det[2][4], '');
  const again = e.run('P25V2_5_BACKFILL_RAW'); assert.equal(again.filled.length, 0);
});
