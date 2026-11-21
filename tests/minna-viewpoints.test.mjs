import test from 'node:test';
import assert from 'node:assert/strict';
import { viewpoints, freshTally, consensus } from '../public/minna/minna-core.mjs';

test('1人目から見立てを並べる', () => {
  const v = { n: 2, main: { 'メディア': 1, '暮らし・生活': 1 }, unsure: 0 };
  const r = viewpoints(v);
  assert.equal(r.n, 2);
  assert.deepEqual(r.rows.map((x) => x.name), ['メディア', '暮らし・生活']);
  assert.equal(consensus(v), null); // 3人に届かないので候補にはしない
});
test('票がない回は出さない', () => { assert.equal(viewpoints(null), null); assert.equal(viewpoints({ n: 0, main: {} }), null); });
test('送った直後の集計が公開版より新しければ使う', () => {
  const served = { n: 1, main: { 'A': 1 } }, t = { n: 2, main: { 'A': 1, 'B': 1 } };
  assert.equal(freshTally(served, { t, at: Date.parse('2026-11-22T01:00:00Z') }, '2026-11-22T00:30:00Z'), t);
  assert.equal(freshTally(served, { t, at: Date.parse('2026-11-22T00:00:00Z') }, '2026-11-22T00:30:00Z'), served);
  assert.equal(freshTally(served, undefined, '2026-11-22T00:30:00Z'), served);
});
