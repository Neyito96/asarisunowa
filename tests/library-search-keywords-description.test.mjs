import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEpisodes } from '../public/library/library-core.mjs';

const episode = { id: 'EP-TEST', show: 'テスト番組', title: 'タイトル', date: '2026-11-11T00:00:00+09:00', cast: '出演者', keywords: '政治', description: '福祉と地域の暮らし' };

test('description is searchable even when keywords are present', () => {
  assert.deepEqual(filterEpisodes([episode], { query: '福祉' }).map(x => x.id), ['EP-TEST']);
});
test('keywords and other existing search fields remain searchable', () => {
  for (const query of ['政治', 'タイトル', '出演者', 'EP-TEST', '政治 福祉']) {
    assert.equal(filterEpisodes([episode], { query }).length, 1, query);
  }
});
test('empty keywords and description do not throw', () => {
  assert.equal(filterEpisodes([{ ...episode, keywords: '', description: '' }], { query: '福祉' }).length, 0);
});
