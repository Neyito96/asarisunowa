import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('scripts/google-apps-script/LedgerFillRobot.js', 'utf8');
const sandbox = { module: { exports: {} }, console };
vm.runInNewContext(src, sandbox);
const R = sandbox.module.exports;

const U = (n) => `https://listen.style/p/abcd1234/${String(n).padStart(8, '0').replace(/0/g, 'a')}`;
// モックシート: A=EP-ID, K=LISTEN。1行目はヘッダ。
function mkSheet(n, prefilled = {}) {
  const A = ['台帳ID'], K = ['LISTEN'];
  for (let i = 1; i <= n; i++) { A.push('EP-' + String(i).padStart(5, '0')); K.push(prefilled[i] || ''); }
  return { A, K };
}
function mkAdapter(sheet, f = {}) {
  const st = { reads: 0, writeCalls: 0, cellsWritten: 0, sleeps: [], locked: false, props: {} };
  const ad = {
    st,
    readColumn(col) { st.reads++; if (f.failRead && st.reads === f.failRead) { const e = new Error('Quota exceeded: Read requests per minute'); throw e; } return [...(sheet[col] || sheet[col === 'A' ? 'A' : 'K'])]; },
    writeCells(cells) {
      st.writeCalls++;
      if (f.quotaEvery && st.writeCalls % f.quotaEvery === 0) throw new Error('429 Quota exceeded for Write requests per minute');
      if (f.crashAtCall && st.writeCalls === f.crashAtCall) { const e = new Error('FATAL crash'); throw e; }
      if (f.interfere) f.interfere(sheet, cells);
      for (const c of cells) { if (f.dropRow === c.row) continue; sheet.K[c.row - 1] = c.value; st.cellsWritten++; }
    },
    lock: { tryLock() { if (st.locked) return false; st.locked = true; return true; }, release() { st.locked = false; } },
    props: { get: (k) => st.props[k] ?? null, set: (k, v) => { st.props[k] = v; } },
    sleep(ms) { st.sleeps.push(ms); }, nowMs: () => Date.now(), random: () => 0.5,
  };
  return ad;
}
function manifest(cells, extra = {}) {
  return { runId: 'r1', urlShape: 'listen', holdEpIds: [], approval: { issue: '283', columns: ['K'], maxCells: 1000, sheet: 'エピソード台帳' }, cells: cells.map((i) => ({ epId: 'EP-' + String(i).padStart(5, '0'), column: 'K', expectedOld: '', url: U(i), guid: 'g' + i, basis: 'GUID+date' })), ...extra };
}

test('WRITE: 全セル書込・読み戻し一致・API回数はチャンク単位(逐セルでない)', () => {
  const sh = mkSheet(200); const ad = mkAdapter(sh);
  const r = R.run(manifest(Array.from({ length: 200 }, (_, i) => i + 1)), ad, 'WRITE', { chunkSize: 50 });
  assert.equal(r.status, 'COMPLETE'); assert.equal(r.counts.written, 200); assert.equal(r.counts.failed, 0);
  assert.equal(ad.st.writeCalls, 4);                       // 200セル=4リクエスト
  assert.ok(r.stats.apiCalls <= 4 * 5, 'API calls ' + r.stats.apiCalls);
});
test('DRY_RUN/READ_ONLY は一切書き込まない', () => {
  for (const mode of ['DRY_RUN', 'READ_ONLY']) {
    const sh = mkSheet(20); const ad = mkAdapter(sh);
    const r = R.run(manifest([1, 2, 3]), ad, mode);
    assert.equal(ad.st.writeCalls, 0); assert.equal(sh.K.slice(1).filter(Boolean).length, 0); assert.equal(r.dryRunWritable, 3);
  }
});
test('既存非空セルは上書きしない(競合はSKIP)、同一値は冪等DONE', () => {
  const sh = mkSheet(10, { 2: 'https://listen.style/p/zzzzzzzz/zzzzzzzz', 3: U(3) }); const ad = mkAdapter(sh);
  const r = R.run(manifest([1, 2, 3]), ad, 'WRITE');
  assert.equal(sh.K[2], 'https://listen.style/p/zzzzzzzz/zzzzzzzz');
  assert.equal(r.counts.written, 1); assert.equal(r.counts.done, 1); assert.equal(r.counts.skipped, 1);
  assert.equal(r.skips[0].s, 'SKIP_CONFLICT');
});
test('quota(429)は指数バックオフ+ジッターで再試行し完了する', () => {
  const sh = mkSheet(100); const ad = mkAdapter(sh, { quotaEvery: 2 });
  const r = R.run(manifest(Array.from({ length: 100 }, (_, i) => i + 1)), ad, 'WRITE', { chunkSize: 25 });
  assert.equal(r.status, 'COMPLETE'); assert.equal(r.counts.written, 100); assert.ok(r.stats.quotaErrors >= 1);
  assert.ok(ad.st.sleeps.every((s) => s >= 500));
});
test('途中クラッシュ→再開: 書込済みは再書込せず、残りだけ処理(チェックポイント+冪等)', () => {
  const sh = mkSheet(100); const ad = mkAdapter(sh, { crashAtCall: 3 });
  const m = manifest(Array.from({ length: 100 }, (_, i) => i + 1));
  const r1 = R.run(m, ad, 'WRITE', { chunkSize: 25 });
  assert.equal(r1.status, 'HALT_WRITE_ERROR'); assert.equal(sh.K.filter((v, i) => i && v).length, 50);
  const ad2 = mkAdapter(sh); ad2.st.props = ad.st.props;
  const r2 = R.run(m, ad2, 'WRITE', { chunkSize: 25 });
  assert.equal(r2.status, 'COMPLETE'); assert.equal(ad2.st.cellsWritten, 50); assert.equal(sh.K.filter((v, i) => i && v).length, 100);
});
test('重複起動はロックで拒否', () => {
  const sh = mkSheet(5); const ad = mkAdapter(sh); ad.st.locked = true;
  assert.equal(R.run(manifest([1]), ad, 'WRITE').status, 'LOCKED'); assert.equal(ad.st.writeCalls, 0);
});
test('マニフェスト検証: スコープ外列/重複URL/HOLD/形状不正/上限超過/承認なしを拒否', () => {
  const base = manifest([1, 2]);
  assert.ok(R.validateManifest({ ...base, approval: undefined }).includes('NO_APPROVAL_SCOPE'));
  assert.ok(R.validateManifest({ ...base, approval: { ...base.approval, maxCells: 1 } }).includes('OVER_MAX_CELLS'));
  const m2 = manifest([1, 2]); m2.cells[1].column = 'L'; assert.ok(R.validateManifest(m2).some((e) => e.startsWith('OUT_OF_SCOPE_COLUMN')));
  const m3 = manifest([1, 2]); m3.cells[1].url = m3.cells[0].url; assert.ok(R.validateManifest(m3).some((e) => e.startsWith('DUP_URL')));
  const m4 = manifest([1, 2], { holdEpIds: ['EP-00002'] }); assert.ok(R.validateManifest(m4).some((e) => e.startsWith('HOLD')));
  const m5 = manifest([1]); m5.cells[0].url = 'https://example.com/x'; assert.ok(R.validateManifest(m5).some((e) => e.startsWith('BAD_URL_SHAPE')));
  const m6 = manifest([1]); m6.cells[0].expectedOld = 'x'; assert.ok(R.validateManifest(m6).some((e) => e.startsWith('EXPECTED_OLD')));
  assert.equal(R.run(m2, mkAdapter(mkSheet(5)), 'WRITE').status, 'MANIFEST_INVALID');
});
test('他の台帳URLと重複するURLはSKIP_DUP_URL', () => {
  const sh = mkSheet(10, { 9: U(1) }); const ad = mkAdapter(sh);
  const r = R.run(manifest([1]), ad, 'WRITE'); assert.equal(r.counts.written, 0); assert.equal(r.skips[0].s, 'SKIP_DUP_URL');
});
test('読み戻し不一致(書込が反映されない)は停止して報告', () => {
  const sh = mkSheet(10); const ad = mkAdapter(sh, { dropRow: 4 });
  const r = R.run(manifest([1, 2, 3]), ad, 'WRITE');
  assert.equal(r.status, 'HALT_READBACK_MISMATCH'); assert.equal(r.counts.failed, 1);
});
test('EP-IDが見つからない/複数行は書かない', () => {
  const sh = mkSheet(3); sh.A.push('EP-00001'); sh.K.push('');
  const r = R.run(manifest([1, 9]), mkAdapter(sh), 'WRITE'); assert.equal(r.counts.written, 0); assert.equal(r.counts.skipped, 2);
});
test('全行差分監査: 想定外の変更を検出', () => {
  const sh = mkSheet(5); const pre = sh.A.map((a, i) => [a, 'x', '', '', '', '', '', '', '', '', sh.K[i]]);
  const post = pre.map((r) => [...r]); post[1][10] = U(1); post[3][2] = '変えた';
  const rr = R.auditDiff(pre, post, manifest([1]), null, 11);
  assert.equal(rr.changed, 2); assert.equal(rr.unexpected, 1);
});
test('1000セルの測定: 4並列ワーカー相当の約2,000リクエスト→ロボットは~数十リクエスト、Claude介入0', () => {
  const N = 1000; const sh = mkSheet(N); const ad = mkAdapter(sh, { quotaEvery: 7 });
  const r = R.run(manifest(Array.from({ length: N }, (_, i) => i + 1)), ad, 'WRITE', { chunkSize: 50 });
  assert.equal(r.counts.written, N);
  console.log('measure', JSON.stringify({ cells: N, writeCalls: ad.st.writeCalls, apiCalls: r.stats.apiCalls, quotaErrorsHandled: r.stats.quotaErrors }));
  assert.ok(r.stats.apiCalls < 200);
});
