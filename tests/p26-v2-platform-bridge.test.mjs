import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const SRC = fs.readFileSync('scripts/google-apps-script/P26V2PlatformBridge.gs', 'utf8');
const V2 = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', V1 = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', COPY = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';
const H = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '公式GUID', '音声URL', '再生時間 秒', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody'];
const row = (ep, t, g, sp = '') => [ep, 'ニュースの現場から', t, '2026/11/14 4:00', g, 'https://a/x.mp3', 600, sp, '', '', '', '', ''];
function sheet(rows) { const st = { rows: rows.map((r) => [...r]) }; return { st, getLastRow: () => st.rows.length, getDataRange: () => ({ getValues: () => st.rows.map((r) => [...r]) }), getRange: (r, c, nr = 1, nc = 1) => ({ getValue: () => (st.rows[r - 1] || [])[c - 1] ?? '', setValue: (v) => { st.rows[r - 1][c - 1] = v; }, getValues: () => st.rows.slice(r - 1, r - 1 + nr).map((x) => x.slice(c - 1, c - 1 + nc)), setValues: (v) => { v.forEach((x, i) => { st.rows[r - 1 + i] = st.rows[r - 1 + i] || []; x.forEach((y, j) => { st.rows[r - 1 + i][c - 1 + j] = y; }); }); }, setNumberFormat() { return this; } }), clearContents: () => { st.rows = []; }, appendRow: (r) => st.rows.push(r) }; }
function env({ verified = ['https://open.spotify.com/episode/OK1', 'https://open.spotify.com/episode/OK2'] } = {}) {
  const books = { [V2]: { 'V2・統合台帳': sheet([H, row('EP-1', '題A', 'g1'), row('EP-2', '題B', 'g2'), row('EP-3', '題C', 'g3', 'https://open.spotify.com/episode/OLD'), row('EP-4', '同題', 'g4'), row('EP-5', '同題', 'g5')]) },
    [V1]: { P15_PLATFORM_CANDIDATES: sheet([['SHOW', 'SERVICE', 'LABEL', 'URL', 'DISCOVERY_URL'], ['ニュースの現場から', 'Spotify', '題A', 'https://open.spotify.com/episode/OK1', ''], ['ニュースの現場から', 'Spotify', '題B', 'https://open.spotify.com/episode/NG', ''], ['ニュースの現場から', 'Spotify', '題C', 'https://open.spotify.com/episode/NEW', ''], ['ニュースの現場から', 'Spotify', '同題', 'https://open.spotify.com/episode/OK2', '']]) },
    [COPY]: { 'V2・統合台帳': sheet([H, row('EP-1', '題A', 'g1'), row('EP-2', '題B', 'g2'), row('EP-3', '題C', 'g3', 'https://open.spotify.com/episode/OLD')]) } };
  const props = {}, calls = [];
  const ss = (id) => ({ getId: () => id, getSheetByName: (n) => books[id][n] || null, insertSheet: (n) => (books[id][n] = sheet([])) });
  const g = { SpreadsheetApp: { openById: (id) => { if (!books[id]) throw new Error('NO ' + id); return ss(id); }, flush() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, Utilities: { parseDate: (s) => new Date(s.replace(/\//g, '-').replace(' ', 'T') + ':00+09:00') }, Logger: { log() {} }, JSON, Date, Math, String, Number, Object,
    P15_PLATFORMS: { resolve: (src, o) => { const r = o.references[0]; calls.push(r.url); const ok = verified.includes(r.url); return { links: ok ? { 12: r.url } : {}, results: [{ service: r.service, state: ok ? 'VERIFIED' : 'REVIEW', method: ok ? 'GUID_TITLE_DATE' : '', reason: ok ? '' : 'TITLE_MISMATCH', url: ok ? r.url : '' }] }; } } };
  vm.createContext(g); vm.runInContext(SRC, g); return { g, books, calls };
}
test('P26: 照合は読むだけ（V2・旧本番は変わらない）。題名1件一致・空欄だけ確認、既存URLと違えば保留、同題複数は対象外', () => {
  const e = env(), v2 = JSON.stringify(e.books[V2]), v1 = JSON.stringify(e.books[V1]);
  const r = vm.runInContext('P26_1_照合_READ_ONLY()', e.g); assert.equal(r.status, 'DONE'); assert.equal(r.candidates, 3);
  assert.equal(JSON.stringify(e.books[V2]), v2); assert.equal(JSON.stringify(e.books[V1]), v1);
  const res = e.books[COPY]['P26・V2URL照合'].st.rows.slice(1); assert.deepEqual(res.map((x) => [x[0], x[6].split(':')[0]]), [['EP-1', 'VERIFIED'], ['EP-2', '保留'], ['EP-3', '保留']]);
  assert.match(res[2][6], /別のURL/); assert.ok(!e.calls.includes('https://open.spotify.com/episode/NEW'));   // 既存URLがある枠は確認にも出さない
});
test('P26: COPY反映はVERIFIEDの空欄だけ・既存URLは不変・読み戻しOK・再実行で追加0', () => {
  const e = env(); vm.runInContext('P26_1_照合_READ_ONLY()', e.g);
  const w = vm.runInContext('P26_2_COPY反映_少数()', e.g); assert.equal(w.wrote.length, 1); assert.equal(w.wrote[0].ep, 'EP-1'); assert.equal(w.wrote[0].before, ''); assert.equal(w.wrote[0].readBack, true);
  const led = e.books[COPY]['V2・統合台帳'].st.rows; assert.equal(led[1][7], 'https://open.spotify.com/episode/OK1'); assert.equal(led[3][7], 'https://open.spotify.com/episode/OLD');
  const snap = JSON.stringify(led); const w2 = vm.runInContext('P26_2_COPY反映_少数()', e.g); assert.equal(w2.wrote.length, 0); assert.equal(JSON.stringify(led), snap);
  const chk = vm.runInContext('P26_3_再実行確認()', e.g); assert.equal(chk.status, 'OK'); assert.equal(chk.replannedForWrittenSlots, 0);
});
test('P26: 書き先はCOPYに固定・トリガーを作らない・旧P18/P19の関数を呼ばない', () => {
  assert.ok(!/newTrigger|deleteTrigger|P18_process_|P19_scan_|writeRow|P18_URL_ENABLED/.test(SRC));
  assert.match(SRC, /P26_TARGET_NOT_COPY/);
});

test('P26: 書込の上限は予行全体で3件（2回目以降は CAP_REACHED で0件）', () => {
  const urls = ['https://open.spotify.com/episode/OK1', 'https://open.spotify.com/episode/OK2', 'https://open.spotify.com/episode/OK3', 'https://open.spotify.com/episode/OK4'];
  const e = env({ verified: urls }); const cand = e.books[V1].P15_PLATFORM_CANDIDATES.st.rows, v2 = e.books[V2]['V2・統合台帳'].st.rows, cp = e.books[COPY]['V2・統合台帳'].st.rows;
  ['題D', '題E', '題F'].forEach((t, i) => { v2.push(row('EP-' + (6 + i), t, 'g' + (6 + i))); cp.push(row('EP-' + (6 + i), t, 'g' + (6 + i))); cand.push(['ニュースの現場から', 'Spotify', t, urls[1 + Math.min(i, 2)].replace('OK', 'OK' + i), '']); });
  e.g.P15_PLATFORMS.resolve = (src, o) => { const r = o.references[0]; return { links: { 12: r.url }, results: [{ service: r.service, state: 'VERIFIED', method: 'GUID_TITLE_DATE', url: r.url }] }; };
  vm.runInContext('P26_1_照合_READ_ONLY()', e.g);
  assert.equal(vm.runInContext('P26_2_COPY反映_少数()', e.g).wrote.length, 3);
  const w2 = vm.runInContext('P26_2_COPY反映_少数()', e.g); assert.equal(w2.status, 'CAP_REACHED'); assert.equal(w2.wrote.length, 0);
});
const many = () => { const urls = ['A', 'B', 'C', 'D', 'E'].map((x) => 'https://open.spotify.com/episode/OK' + x); const e = env({ verified: urls }); const cand = e.books[V1].P15_PLATFORM_CANDIDATES.st.rows, v2 = e.books[V2]['V2・統合台帳'].st.rows, cp = e.books[COPY]['V2・統合台帳'].st.rows;
  cand.length = 1; v2.length = 1; cp.length = 1; urls.forEach((u, i) => { const t = '題' + i; v2.push(row('EP-' + i, t, 'g' + i)); cp.push(row('EP-' + i, t, 'g' + i)); cand.push(['ニュースの現場から', 'Spotify', t, u, '']); });
  e.g.P15_PLATFORMS.resolve = (src, o) => { const r = o.references[0]; return { links: { 12: r.url }, results: [{ service: r.service, state: 'VERIFIED', method: 'GUID_TITLE_DATE', url: r.url }] }; };
  vm.runInContext('P26_1_照合_READ_ONLY()', e.g); return e; };
test('P26上限: 途中で止まったPENDINGは上限に数え、後始末するまで書かない（後始末で取消/OKに確定）', () => {
  const e = many(), log = () => e.books[COPY]['P26・COPY反映履歴'];
  vm.runInContext("p26LogSheet_(p26Copy_(), P26_LOG_).appendRow(['t','EP-0','Spotify','','https://open.spotify.com/episode/OKA','x','PENDING',''])", e.g);
  assert.equal(vm.runInContext('P26_2_COPY反映_少数()', e.g).status, 'PENDING_EXISTS');
  const f = vm.runInContext('P26_8_未完了の確認()', e.g); assert.equal(JSON.stringify(f.fixed), JSON.stringify(['EP-0:取消']));
  const w = vm.runInContext('P26_2_COPY反映_少数()', e.g); assert.equal(w.wrote.length, 3); assert.ok(!w.wrote.some((x) => x.ep === 'EP-0'));   // 取消した枠は書き直さない
  assert.equal(vm.runInContext('P26_2_COPY反映_少数()', e.g).status, 'CAP_REACHED');
  assert.equal(log().st.rows.slice(1).filter((x) => !x[7]).length, 3);
});
test('P26上限: 同時実行はロックで拒否・読み戻し不一致で停止旗→以後すべて拒否→解除まで書かない', () => {
  const e = many();
  e.g.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock() {} }) }; assert.equal(vm.runInContext('P26_2_COPY反映_少数()', e.g).status, 'LOCKED');
  e.g.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
  const sh = e.books[COPY]['V2・統合台帳'], orig = sh.getRange; sh.getRange = (r, c, nr, nc) => { const g = orig(r, c, nr, nc); return { ...g, setValue: () => {} }; };   // 書いても反映されない異常
  const w = vm.runInContext('P26_2_COPY反映_少数()', e.g); assert.equal(w.status, 'STOPPED_READBACK_MISMATCH'); assert.equal(w.wrote.length, 0);
  sh.getRange = orig; assert.equal(vm.runInContext('P26_2_COPY反映_少数()', e.g).status, 'STOPPED');
  vm.runInContext('P26_9_停止解除()', e.g); assert.notEqual(vm.runInContext('P26_2_COPY反映_少数()', e.g).status, 'STOPPED');
});
test('P26上限: 本番V2への書込は承認の印（コード上のフラグ＋上限）が無ければ0件', () => {
  const e = many(); const v2 = JSON.stringify(e.books[V2]);
  const w = vm.runInContext("p26Write_('V2')", e.g); assert.equal(w.status, 'V2_WRITE_NOT_APPROVED'); assert.equal(JSON.stringify(e.books[V2]), v2);
});

test('P26: 配信先の番組名の呼び方を合わせて照合に渡す（一致条件は変えない）', () => {
  const e = many(); const seen = []; e.books[V2]['V2・統合台帳'].st.rows.forEach((r, i) => { if (i) r[1] = 'MEDIA TALK'; }); e.books[V1].P15_PLATFORM_CANDIDATES.st.rows.forEach((r, i) => { if (i) r[0] = 'MEDIA TALK'; });
  e.g.P15_PLATFORMS.resolve = (src, o) => { seen.push(src.show); return { links: {}, results: [{ service: o.references[0].service, state: 'REVIEW', reason: 'INSUFFICIENT_IDENTITY' }] }; };
  vm.runInContext("PropertiesService.getScriptProperties().deleteProperty('P26_STATE'); p26Copy_().getSheetByName(P26_RESULT_).clearContents()", e.g);
  vm.runInContext('P26_1_照合_READ_ONLY()', e.g); assert.ok(seen.length > 0); assert.ok(seen.every((x) => x === 'MEDIA TALK メディアトーク'));
});
