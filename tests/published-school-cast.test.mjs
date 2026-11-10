import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {expandFixture} from '../scripts/expand-cast-oracle-fixture.mjs';
import {verifyCastConsistency, castNames} from '../public/library/cast-sync.mjs';
const dir = new URL('../public/library/data/', import.meta.url);
const load = s => readdirSync(new URL(s + '/', dir)).flatMap(f => JSON.parse(readFileSync(new URL(s + '/' + f, dir), 'utf8')));
const fx = expandFixture(JSON.parse(readFileSync(new URL('./fixtures/news-school-cast-2026-11-10.json', import.meta.url), 'utf8')));
const details = load('details'), by = new Map(details.map(e => [e.id, e]));
test('published ニュースの学校 cast equals the admin-confirmed 2026-11-10 values for every published episode in the fixture (counts derived, not hardcoded)', () => {
  const inData = fx.rows.filter(r => by.has(r.id)); assert.ok(inData.length > 0);
  for (const r of inData) assert.deepEqual(castNames(by.get(r.id).cast), castNames(r.cast), r.id);
  const exp = {}; for (const r of inData) exp[r.cast] = (exp[r.cast] || 0) + 1;
  const got = {}; for (const e of details.filter(e => e.show === 'ニュースの学校' && fx.rows.some(r => r.id === e.id))) for (const n of castNames(e.cast)) got[n] = (got[n] || 0) + 1;
  assert.deepEqual(Object.fromEntries(Object.entries(got).sort()), Object.fromEntries(Object.entries(exp).map(([k, v]) => [castNames(k)[0], v]).sort()));
});
test('details / list pages / search index carry the same cast', () => {
  const r = verifyCastConsistency({details, pages: load('pages').filter(e => e.cast !== undefined && by.has(e.id)).filter((e, i, a) => a.findIndex(x => x.id === e.id) === i), search: load('search')});
  assert.equal(r.mismatches.length, 0);
});
