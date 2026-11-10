import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseTransfer, checkAgainst} from '../scripts/apply-description-transfer.mjs';
const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
const L = o => JSON.stringify(o);
test('parseTransfer accepts good rows, holds corrupted / personal-info rows, rejects bad ids and duplicates', () => {
  const text = [L({_meta: {snapshotDate: '2026-11-10'}}), L({id: 'EP-00001', w: '清掃済みの本文', wSha256: sha('清掃済みの本文'), wLen: 7}), L({id: 'EP-00002', w: '本文', wSha256: 'deadbeef'}),
    L({id: 'EP-00003', w: '連絡は a@example.com まで'}), L({id: 'EP-00003', w: '重複'}), L({id: 'bad', w: 'x'}), L({id: 'EP-00004', w: '  '}), 'not json'].join('\n');
  const t = parseTransfer(text), codes = t.problems.map(p => p.code);
  assert.deepEqual([...t.rows.keys()], ['EP-00001']); assert.ok(t.held.has('EP-00002') && t.held.has('EP-00003'));
  for (const c of ['DUPLICATE_ID', 'SHA_MISMATCH', 'PUBLIC_RESIDUE:EMAIL', 'BAD_ID', 'W_BLANK', 'BAD_JSON']) assert.ok(codes.includes(c), c);
});
test('checkAgainst counts what must change without returning any text', () => {
  const t = parseTransfer([L({id: 'EP-00001', w: '清掃後'}), L({id: 'EP-00002', w: '同じ'})].join('\n'));
  const r = checkAgainst([{id: 'EP-00001', show: 'S', description: '原文', descriptionSource: 'raw-rendered'}, {id: 'EP-00002', show: 'S', description: '同じ', descriptionSource: 'clean'}, {id: 'EP-00003', show: 'S', description: 'x', descriptionSource: 'clean'}], t.rows);
  assert.equal(r.needChange, 1); assert.equal(r.needChangeFromRaw, 1); assert.equal(r.alreadyReflected, 1); assert.deepEqual(r.notInTransfer, ['EP-00003']);
  assert.ok(!JSON.stringify(r).includes('清掃後'));
});
