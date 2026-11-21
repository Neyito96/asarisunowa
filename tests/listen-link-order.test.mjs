import test from 'node:test';
import assert from 'node:assert/strict';
import { listenLinks } from '../public/library/shelf-core.mjs';

test('聴く場所: 朝日新聞 公式 → Spotify → Apple → ほか。Omny・Megaphone（pdst.fm）は出さない', () => {
  const links = ['https://omny.fm/shows/asahi/polirebi20', 'https://pca.st/episode/x', 'https://listen.style/p/x', 'https://www.asahi.com/special/podcasts/item/?itemid=x',
    'https://open.spotify.com/episode/abc', 'https://podcasts.apple.com/jp/podcast/x', 'https://pdst.fm/e/traffic.megaphone.fm/TASC1.mp3', 'https://omny.fm/shows/arukiki-ajw/658/embed', 'https://pody.jp/x', 'https://music.amazon.co.jp/podcasts/x'];
  assert.deepEqual(listenLinks(links).map((l) => l.label), ['朝日新聞 公式ページ', 'Spotify', 'Apple Podcasts', 'Amazon Music', 'Pocket Casts', 'LISTEN', 'Pody']);
});
