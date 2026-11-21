import test from 'node:test';
import assert from 'node:assert/strict';
import { isMovedLink, liveLinks } from '../public/library/shelf-core.mjs';

test('#395: SDGsを話そう は Spotify も新しい住所に置き換え済み。旧住所のままの EP-06532 だけ Spotify ボタンを出さない', () => {
  const links = ['https://www.asahi.com/special/podcasts/item/?itemid=x', 'https://omny.fm/shows/arukiki-ajw/658/embed', 'https://open.spotify.com/episode/0ZbG92Q53KUKBBYecMoMA2', 'https://pca.st/episode/6a9deb69-950b-406d-bfce-cf51ea6a15ef'];
  assert.deepEqual(liveLinks({ id: 'EP-06145', show: 'SDGsを話そう' }, links), links);
  assert.deepEqual(liveLinks({ id: 'EP-06532', show: 'SDGsを話そう' }, links), [links[0], links[1], links[3]]);
  assert.equal(isMovedLink({ id: 'EP-06752', show: 'ニュースの現場から' }, links[2]), false);
});
