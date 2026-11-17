// P27 新着V2反映ゲート: GAS実機を触らず、承認スナップショットと中断・取消の純粋な制御を試す。
// 実機COPY試験の代替ではない。実機実行とログは別途必須。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const file = readFileSync(new URL('../gas/summary-cleaner/src/CleanerMain.js', import.meta.url), 'utf8');
const marker = 'var P27_NEW_APPROVAL_HASH_ =';
assert.ok(file.includes(marker), 'P27 gate source missing');
assert.match(file, /var P27_V2_WRITE_ENABLED_ = false;/, 'production V2 write gate must remain disabled');

const candidate = (col, url) => ({ ep: 'EP-06662', col, url, current: '', reason: 'GUID', action: 'WRITE' });
function harness(enabled = true) {
  const properties = new Map(), state = { stop: false }, writes = [], replies = [];
  let plan = { out: [
    candidate('Pocket Casts', 'https://pca.st/episode/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
    candidate('Pody', 'https://pody.jp/player/abcdefghijklmnopqrst/12345678901234567890')
  ] };
  const ctx = {
    P27_V2_WRITE_ENABLED_: enabled,
    P27_V2_MAX_PER_RUN_: 300,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, raw) => [...createHash('sha256').update(raw, 'utf8').digest()]
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => properties.get(k), setProperty: (k,v) => properties.set(k,v), deleteProperty: k => properties.delete(k)
    }) },
    sumToday_: () => '2026-11-17',
    p27State_: () => ({...state}),
    p27SetState_: s => { for (const k of Object.keys(state)) delete state[k]; Object.assign(state, s); },
    scOpen_: () => ({ss:{}}), SC_CONFIG: {},
    p27NewPlan_: () => plan, scLog_: (_name, output) => output,
    P27_NEW_RE_: () => /./,
    p27Write_: (_target, _ss, rows, _max, col) => {
      writes.push(col);
      return replies.shift() || { status: 'OK', written: rows.length, readbackMismatch: 0, applyId: 'TX:' + col };
    },
    p27Undo_: () => { const result = replies.shift() || {status:'OK'}; delete state.last; return result; }
  };
  vm.runInNewContext(file.slice(file.indexOf(marker)), ctx, { timeout: 2000 });
  return { ctx, state, writes, replies, properties, get plan(){return plan}, set plan(x){plan=x} };
}

test('本番フラグfalseでは承認さえ発行しない', () => {
  const h = harness(false);
  assert.equal(h.ctx.P27_NEW_0_承認_新着V2反映().status, 'DISABLED');
  assert.equal(h.properties.size, 0);
});

test('承認後のURL変更では一切書き込まずSTOP_PLAN_CHANGED', () => {
  const h = harness();
  assert.equal(h.ctx.P27_NEW_0_承認_新着V2反映().status, 'APPROVED');
  h.plan = { out: h.plan.out.map((r,i) => i ? r : {...r,url:r.url + '-changed'}) };
  assert.equal(h.ctx.P27_NEW_5_V2反映_承認後().status, 'STOP_PLAN_CHANGED');
  assert.equal(h.writes.length, 0);
});

test('列ごとの失敗時に中断、反映済み列だけ保持して安全に再取消', () => {
  const h = harness();
  assert.equal(h.ctx.P27_NEW_0_承認_新着V2反映().status, 'APPROVED');
  h.replies.push(
    {status:'OK', written:1, readbackMismatch:0, applyId:'TX:PC'},
    {status:'STOPPED', written:0, readbackMismatch:0}
  );
  assert.equal(h.ctx.P27_NEW_5_V2反映_承認後().status, 'STOP_PARTIAL_CHECK_AND_UNDO');
  assert.deepEqual(h.writes, ['Pocket Casts','Pody']);
  assert.equal(h.state.lastGroup.length, 1);
  h.replies.push({status:'UNDO_READBACK_MISMATCH'});
  assert.equal(h.ctx.P27_NEW_7_直前の新着反映を戻す().status,'CHECK_RETRY_REQUIRED');
  assert.equal(h.state.lastGroup.length,1);
  h.replies.push({status:'OK'});
  assert.equal(h.ctx.P27_NEW_7_直前の新着反映を戻す().status,'OK');
  assert.equal(h.state.lastGroup.length,0);
});
