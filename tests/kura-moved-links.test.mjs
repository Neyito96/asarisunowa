import test from 'node:test';
import assert from 'node:assert/strict';
import { isMovedLink, liveLinks } from '../public/library/shelf-core.mjs';

test('#395: SDGsを話そう の過去回は Spotify・Pocket Casts のボタンを出さない（Omny・公式は残す）', () => {
  const e = { id: 'EP-06145', show: 'SDGsを話そう' };
  const links = ['https://www.asahi.com/special/podcasts/item/?itemid=x', 'https://omny.fm/shows/arukiki-ajw/658/embed', 'https://open.spotify.com/episode/0ZbG92Q53KUKBBYecMoMA2', 'https://pca.st/episode/6a9deb69-950b-406d-bfce-cf51ea6a15ef'];
  assert.deepEqual(liveLinks(e, links), links.slice(0, 2));
  assert.equal(isMovedLink({ id: 'EP-06577', show: 'SDGsを話そう' }, links[2]), false);   // 旧住所でも開ける回
  assert.equal(isMovedLink({ id: 'EP-06752', show: 'ニュースの現場から' }, links[2]), false); // ほかの番組は対象外
});
