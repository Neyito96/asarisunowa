import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanShelves } from '../scripts/library/fetch-shared-shelves.mjs';
test('みんなの蔵書: 形の違う返事は保存しない', () => {
  assert.throws(() => cleanShelves({ ok: false }));
  assert.throws(() => cleanShelves({ ok: true, type: 'bunruiPublic', shelves: [] }));
});
test('みんなの蔵書: 蔵に無い回は捨て、新しい順に並べる', () => {
  const known = new Set(['EP-00001', 'EP-00002']);
  const out = cleanShelves({ ok: true, type: 'shelfPublic', shelves: [
    { id: 'SH-20261101000000-001', date: '2026-11-01', title: '古い', ids: ['EP-00001'] },
    { id: 'SH-20261127000000-002', date: '2026-11-27', title: '新しい', ids: ['EP-00002', 'EP-99999', 'EP-00002'], nick: 'a\nb' },
    { id: 'SH-20261127000000-003', date: '2026-11-27', title: '回が無い', ids: ['EP-99999'] },
    { id: 'x', ids: ['EP-00001'] }] }, known);
  assert.deepEqual(out.map((x) => x.title), ['新しい', '古い']);
  assert.deepEqual(out[0].ids, ['EP-00002']); assert.equal(out[0].nick, 'a b');
});
