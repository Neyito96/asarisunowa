import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshDescriptionFromLedger as rf, verifyDescriptions} from '../public/library/description-sync.mjs';
const row = (id, raw, clean) => { const r = new Array(55).fill(''); r[0] = id; r[21] = raw; r[22] = clean; return r; };
test('cleaned (W) replaces raw-rendered; blank W never downgrades or blanks; idempotent', () => {
  const ex = [{id: 'A', show: 'S', description: '原文 本文', descriptionSource: 'raw-rendered'}, {id: 'B', show: 'S', description: '清掃済み', descriptionSource: 'clean'}, {id: 'C', show: 'S', description: '', descriptionSource: 'missing'}];
  const rows = new Map([['A', row('A', '原文 本文', '清掃後の本文')], ['B', row('B', '別の原文', '')], ['C', row('C', '補う原文', '')]]);
  const r = rf(ex, rows);
  assert.equal(r.episodes[0].description, '清掃後の本文'); assert.equal(r.episodes[0].descriptionSource, 'clean');
  assert.equal(r.episodes[1].description, '清掃済み'); assert.equal(r.keptBlank, 1);
  assert.equal(r.episodes[2].descriptionSource, 'raw-rendered');
  assert.equal(rf(r.episodes, rows).changes.length, 0);
});
test('verifyDescriptions flags clean-not-reflected and detail/search mismatch', () => {
  const rows = new Map([['A', row('A', 'raw', '清掃後')]]);
  const bad = verifyDescriptions(rows, {details: [{id: 'A', description: 'raw', descriptionSource: 'raw-rendered'}], search: [{id: 'A', keywords: 'raw'}]});
  assert.equal(bad.pass, false); assert.equal(bad.cleanNotReflected.length, 1);
  const ok = verifyDescriptions(rows, {details: [{id: 'A', description: '清掃後', descriptionSource: 'clean'}], search: [{id: 'A', keywords: '清掃後 タグ'}]});
  assert.equal(ok.pass, true);
});
