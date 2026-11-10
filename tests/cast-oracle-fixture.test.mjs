import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandFixture} from '../scripts/expand-cast-oracle-fixture.mjs';
import {sparseRows} from '../scripts/resync-cast-from-oracle.mjs';
import {refreshCastFromLedger} from '../public/library/cast-sync.mjs';
const fx = JSON.parse(readFileSync(new URL('./fixtures/news-school-cast-2026-11-10.json', import.meta.url), 'utf8'));
test('fixture expands to declared total/per-person with no duplicates', () => {
  const r = expandFixture(fx);
  assert.equal(r.total, fx.expectedTotal); assert.equal(r.duplicates, 0);
  assert.deepEqual(r.perPerson, fx.expectedPerPerson); assert.deepEqual(r.exceptionsNotInSet, []);
});
test('resync from fixture is additive, keeps unrelated episodes and is idempotent', () => {
  const rows = sparseRows(fx), ids = [...rows.keys()].slice(0, 5);
  const existing = [...ids.map(id => ({id, show: 'ニュースの学校', cast: ''})), {id: 'EP-99999', show: 'X', cast: '人間指定'}, {id: 'EP-00804', show: 'ニュースの学校', cast: ''}];
  const a = refreshCastFromLedger(existing, rows);
  assert.equal(a.episodes.find(e => e.id === 'EP-99999').cast, '人間指定');
  assert.equal(a.episodes.find(e => e.id === 'EP-00804').cast, '杢田光');
  assert.equal(refreshCastFromLedger(a.episodes, rows).changes.length, 0);
});
