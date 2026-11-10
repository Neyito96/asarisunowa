import test from 'node:test';
import assert from 'node:assert/strict';
import { isEpisodeUrl, rejectReason, appleEpisodesFromLookup, matchApple, tally } from '../public/library/link-discovery.mjs';

const G1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const lookup = {
  resultCount: 4,
  results: [
    { wrapperType: 'track', kind: 'podcast', collectionName: 'show' },
    { wrapperType: 'podcastEpisode', trackName: '回A', episodeGuid: G1.toUpperCase(), releaseDate: '2026-11-09T19:00:00Z', trackViewUrl: 'https://podcasts.apple.com/jp/podcast/a/id123?i=1000700000001&uo=4', episodeUrl: 'https://x/a.mp3' },
    { wrapperType: 'podcastEpisode', trackName: '回B', episodeGuid: '', releaseDate: '2026-11-08T19:00:00Z', trackViewUrl: 'https://podcasts.apple.com/jp/podcast/b/id123?i=1000700000002' },
    { wrapperType: 'podcastEpisode', trackName: '回C', episodeGuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', releaseDate: '2026-11-07T19:00:00Z', trackViewUrl: 'https://podcasts.apple.com/jp/podcast/c/id123' },
  ],
};

test('URL形状: 個別EPのみ許可、番組・検索・音声は拒否', () => {
  assert.ok(isEpisodeUrl('apple', 'https://podcasts.apple.com/jp/podcast/x/id1?i=2'));
  assert.ok(!isEpisodeUrl('apple', 'https://podcasts.apple.com/jp/podcast/x/id1'));
  assert.ok(isEpisodeUrl('amazon', 'https://music.amazon.co.jp/podcasts/11111111-1111-4111-8111-111111111111/episodes/22222222-2222-4222-8222-222222222222'));
  assert.ok(!isEpisodeUrl('amazon', 'https://music.amazon.co.jp/podcasts/11111111-1111-4111-8111-111111111111'));
  assert.ok(isEpisodeUrl('listen', 'https://listen.style/p/tvzppbdm/er1oo5ax'));
  assert.ok(!isEpisodeUrl('listen', 'https://listen.style/p/tvzppbdm'));
  assert.ok(isEpisodeUrl('pody', 'https://pody.jp/player/aaa/bbb'));
  assert.ok(!isEpisodeUrl('pody', 'https://pody.jp/player/aaa'));
  assert.equal(rejectReason('apple', 'https://x/a.mp3'), 'AUDIO_FILE_URL');
  assert.equal(rejectReason('apple', 'https://podcasts.apple.com/jp/search?term=x'), 'SEARCH_RESULT_URL');
});

test('Apple: episodeGuid強照合→CANDIDATE、音声URLは採らない、既存は上書きしない', () => {
  const eps = appleEpisodesFromLookup(lookup);
  assert.equal(eps.length, 3);
  assert.ok(eps[0].url.startsWith('https://podcasts.apple.com/'));
  const res = matchApple([
    { epId: 'EP-1', title: '回A', date: '2026-11-10', guid: G1, known: {} },
    { epId: 'EP-2', title: '回A', date: '2026-11-10', guid: G1, known: { apple: 'https://podcasts.apple.com/jp/podcast/a/id123?i=1000700000001' } },
    { epId: 'EP-3', title: '回A', date: '2026-11-10', guid: G1, known: { apple: 'https://podcasts.apple.com/jp/podcast/a/id123?i=1000799999999' } },
    { epId: 'EP-4', title: '回B', date: '2026-11-09', guid: 'none', known: {} },
    { epId: 'EP-5', title: '回C', date: '2026-11-08', guid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', known: {} },
    { epId: 'EP-6', title: '無い回', date: '2026-01-01', guid: 'zzz', known: {} },
  ], eps);
  assert.deepEqual(res.map((r) => r.state), ['CANDIDATE', 'SAME', 'URL_CONFLICT', 'HOLD', 'REJECTED', 'NOT_FOUND']);
  assert.equal(res[0].url, 'https://podcasts.apple.com/jp/podcast/a/id123?i=1000700000001&uo=4');
  assert.equal(res[3].basis, 'タイトル+配信日のみ');
  assert.equal(res[4].url, '');
});

test('tally', () => {
  assert.deepEqual(tally([{ service: 'apple', state: 'CANDIDATE' }, { service: 'apple', state: 'HOLD' }, { service: 'apple', state: 'CANDIDATE' }]), { apple: { total: 3, CANDIDATE: 2, HOLD: 1 } });
});
