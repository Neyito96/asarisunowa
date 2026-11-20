import test from 'node:test';
import assert from 'node:assert/strict';
import { nz, rssItems, matchByTitleDate, appleShowIds } from '../scripts/library/platform-gap-probe.mjs';

test('題名の正規化：#番号と記号を落とす', () => {
  assert.equal(nz('感じた違和感、変わる結婚式 #1001'), nz('感じた違和感 変わる結婚式'));
});
test('RSS の item を読む', () => {
  const x = '<rss><channel><item><title><![CDATA[回A]]></title><pubDate>Fri, 05 Dec 2025 19:00:00 GMT</pubDate><guid isPermaLink="false">ABC</guid><itunes:duration>01:02</itunes:duration></item></channel></rss>';
  assert.deepEqual(rssItems(x)[0], { title: '回A', pub: '2025-12-05T19:00:00.000Z', guid: 'abc', dur: 62 });
});
test('題名＋日付で 1対1 だけ対応、同じ相手に2回が当たれば外す', () => {
  const kura = [{ id: 'EP-1', title: '回A #1', date: '2025-12-06T04:00:00+09:00', duration: 60 }, { id: 'EP-2', title: '回B', date: '2025-12-06', duration: 60 }, { id: 'EP-3', title: '回B', date: '2025-12-06', duration: 60 }];
  const c = [{ key: 'a', title: '回A', pub: '2025-12-05T19:00:00Z', dur: 61 }, { key: 'b', title: '回B', pub: '2025-12-05T19:00:00Z', dur: 60 }];
  const m = matchByTitleDate(kura, c);
  assert.deepEqual(m.matched.map((x) => x.e.id), ['EP-1']);
  assert.equal(m.duplicates, 1);
});
test('SDGs の Apple 番組ID は こどもそうだんしつ を使う', () => {
  const k = [{ show: 'こどもそうだんしつ', links: ['https://podcasts.apple.com/jp/podcast/x/id123?i=1'] }, { show: 'SDGsを話そう', links: [] }];
  assert.equal(appleShowIds(k)['SDGsを話そう'], '123');
});
