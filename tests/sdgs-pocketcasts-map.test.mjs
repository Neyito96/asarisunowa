import test from 'node:test';
import assert from 'node:assert/strict';
import { match, nz } from '../scripts/library/sdgs-pocketcasts-map.mjs';

test('番号の違いを無視して題名＋日付で対応づける', () => {
  const kura = [{ id: 'EP-1', title: '助けを求める力、あるかな #1048', date: '2026-03-13', duration: 1467, links: [] }];
  const pc = [{ uuid: 'u1', title: '助けを求める力、あるかな　#1045', pub: '2026-03-12T19:00:00Z', dur: 1467 },
              { uuid: 'u2', title: '別の回', pub: '2026-03-12T19:00:00Z', dur: 900 }];
  const r = match(kura, pc);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].newUrl, 'https://pca.st/episode/u1');
});

test('日付が3日以上離れていれば対応させない', () => {
  const r = match([{ id: 'EP-1', title: 'A', date: '2026-03-20', duration: 0 }],
                  [{ uuid: 'u', title: 'A', pub: '2026-03-12T19:00:00Z', dur: 1 }]);
  assert.equal(r.missing.length, 1);
});

test('nz は記号・空白・番号を除く', () => assert.equal(nz('「A」 B #12'), 'AB'));
