import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {classifyLink, resolveLink, serviceLinks, coverage, createCollection, addIds, removeId, move, encodeShare, decodeShare, toText, mailtoUrl, MAX_ITEMS} from '../public/collection/collection-core.mjs';
const sp = 'https://open.spotify.com/episode/6opJ4Ig4s7CTY9fRqGEHd2', ap = 'https://podcasts.apple.com/jp/podcast/x/id1592938106?i=1000700000000', apShow = 'https://podcasts.apple.com/jp/podcast/id1592938106', as = 'https://www.asahi.com/special/podcasts/item/?itemid=af085854-b81e-4578-b871-b4d7005c0188';
test('classifyLink distinguishes episode URLs from show URLs for each service (real link shapes from published data)', () => {
  assert.deepEqual(classifyLink(sp), {service: 'spotify', kind: 'episode'}); assert.equal(classifyLink('https://open.spotify.com/show/0341I5UOUrJgm7KEvNGInZ').kind, 'show');
  assert.equal(classifyLink(ap).kind, 'episode'); assert.equal(classifyLink(apShow).kind, 'show');
  assert.deepEqual(classifyLink('https://listen.style/p/tvzppbdm/bbjjdjyv'), {service: 'listen', kind: 'episode'}); assert.equal(classifyLink('https://listen.style/p/tvzppbdm').kind, 'show');
  assert.equal(classifyLink(as).kind, 'episode'); assert.equal(classifyLink('http://open.spotify.com/episode/6opJ4Ig4s7CTY9fRqGEHd2').service, null); assert.equal(classifyLink('javascript:alert(1)').service, null);
});
test('resolveLink: EXACT / SHOW_ONLY / MISSING with honest fallback, never inventing a URL', () => {
  const ep = {id: 'EP-00001', links: [sp, apShow, as]};
  assert.equal(resolveLink(ep, 'spotify').status, 'EXACT');
  const a = resolveLink(ep, 'apple'); assert.equal(a.status, 'SHOW_ONLY'); assert.equal(a.url, null); assert.equal(a.showUrl, apShow); assert.equal(a.fallback.service, 'asahi');
  const m = resolveLink(ep, 'pocketcasts'); assert.equal(m.status, 'MISSING'); assert.equal(m.url, null);
});
test('collection ops: ordered, de-duplicated, validated, capped; share token round-trips and rejects garbage', () => {
  let c = createCollection('  t', 'apple'); c = addIds(c, ['EP-00003', 'EP-00001', 'EP-00003', 'bad', 'EP-1']); assert.deepEqual(c.ids, ['EP-00003', 'EP-00001']);
  c = move(c, 'EP-00001', -1); assert.deepEqual(c.ids, ['EP-00001', 'EP-00003']); assert.deepEqual(move(c, 'EP-00001', -1).ids, c.ids); c = removeId(c, 'EP-00001'); assert.deepEqual(c.ids, ['EP-00003']);
  const big = addIds(createCollection(), Array.from({length: 500}, (_, i) => 'EP-' + String(i).padStart(5, '0'))); assert.equal(big.ids.length, MAX_ITEMS);
  const d = decodeShare(encodeShare({...big, title: '日本語タイトル', service: 'listen'})); assert.equal(d.title, '日本語タイトル'); assert.equal(d.service, 'listen'); assert.deepEqual(d.ids, big.ids);
  for (const bad of ['', 'xx', null, encodeShare({title: '', service: 's', ids: []}).slice(2)]) assert.equal(decodeShare(bad), null);
});
test('toText / mailto contain only resolved URLs, mark missing links, and mail is a mailto: link (no sending)', () => {
  const eps = [{id: 'EP-00001', show: 'S', title: '題名A', date: '2026-01-02T04:00:00+09:00', links: [sp, as]}, {id: 'EP-00002', show: 'S', title: '題名B', date: '2026-01-03T04:00:00+09:00', links: []}];
  const t = toText(addIds(createCollection('集', 'apple'), ['EP-00001', 'EP-00002']), eps); assert.match(t, /Apple Podcastsの個別リンクは未登録。朝日新聞\(公式\): https:\/\/www\.asahi\.com/); assert.match(t, /2\. 題名B/); assert.ok(!/podcasts\.apple\.com/.test(t));
  assert.match(mailtoUrl(addIds(createCollection('集'), ['EP-00001']), eps), /^mailto:\?subject=.*&body=/);
});
test('published data: coverage is measured (not assumed) and Apple show-only links are not counted as episode links', () => {
  const dir = new URL('../public/library/data/details/', import.meta.url), eps = readdirSync(dir).flatMap(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  const cv = coverage(eps); assert.equal(cv.total, eps.length); assert.ok(cv.byService.spotify.exact > 0);
  for (const e of eps) for (const [s, u] of Object.entries(serviceLinks(e).episode)) assert.equal(classifyLink(u).service, s);
});
