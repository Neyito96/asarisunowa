import test from 'node:test';
import assert from 'node:assert/strict';
import { queueOrder, platformOf, topVotes, consensus, shareText } from '../public/minna/minna-core.mjs';

test('並び順: 迷った回→票の少ない回→残り。自分の済み・スキップは最後', () => {
  const it = (id, o = {}) => ({ id, n: 0, boundary: false, mine: false, skipped: false, ...o });
  const out = queueOrder([it('A', { n: 5 }), it('B', { mine: true }), it('C', { boundary: true, n: 9 }), it('D', { n: 1 }), it('E', { skipped: true })], 'dev12345').map((x) => x.id);
  assert.equal(out[0], 'C'); assert.equal(out[1], 'D'); assert.equal(out[2], 'A'); assert.deepEqual(out.slice(3), ['E', 'B']);
});
test('並び順: 端末ごとに違う順（同じ端末では同じ）', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: 'EP-' + i, n: 0 }));
  const a = queueOrder(items, 'deviceAAAA').map((x) => x.id), b = queueOrder(items, 'deviceBBBB').map((x) => x.id);
  assert.notDeepEqual(a, b); assert.deepEqual(a, queueOrder(items, 'deviceAAAA').map((x) => x.id));
});
test('配信先の見分け', () => {
  assert.equal(platformOf('https://open.spotify.com/episode/abc').key, 'spotify');
  assert.equal(platformOf('https://pca.st/episode/x').key, 'pocketcasts');
  assert.equal(platformOf('https://omny.fm/shows/a/b/embed').key, 'omny-embed');
  assert.equal(platformOf('https://example.com'), null);
});
test('票の集計と「みんなの分類」の条件（3人以上・3分の2以上）', () => {
  assert.deepEqual(topVotes({ main: { 科学: 1, 教育: 3 } }).map((x) => x.name), ['教育', '科学']);
  assert.deepEqual(consensus({ n: 3, main: { 教育: 2, 科学: 1 } }), { name: '教育', count: 2, n: 3 });
  assert.equal(consensus({ n: 2, main: { 教育: 2 } }), null);
  assert.equal(consensus({ n: 4, main: { 教育: 2, 科学: 2 } }), null);
  assert.equal(consensus({ n: 3, main: { 教育: 1 }, unsure: 2 }), null);   // 「わからない」が多い
  assert.match(shareText('題', 'u'), /#朝リスみんなで仕分け/);
});
