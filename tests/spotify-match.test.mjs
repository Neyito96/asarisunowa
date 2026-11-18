import test from 'node:test';
import assert from 'node:assert/strict';
import { spotifyMatch } from '../scripts/spotify/match.mjs';
import { extractEpisodes } from '../scripts/spotify/scrape-new.mjs';
const SHOWS = { 'ニュースの学校': 'S'.repeat(22) };
const id = (c) => c.repeat(22);
const ep = (c, title, date, sec) => ({ id: id(c), url: 'https://open.spotify.com/episode/' + id(c), title, date, durationMs: sec * 1000 });
const data = (eps, showId = SHOWS['ニュースの学校']) => ({ shows: { 'ニュースの学校': { showId, episodes: eps } } });
const row = (e, title, pub, sec, spotify = '') => ({ ep: e, show: 'ニュースの学校', title, published: pub, seconds: String(sec), spotify });
test('番組ID・題名・日付・長さが揃った回だけ確定する', () => {
  const r = spotifyMatch([row('EP-00001', '保釈', '2026/11/18 04:00', 832)], data([ep('A', '保釈', '2026-11-17', 832.162)]), SHOWS);
  assert.equal(r[0].status, 'VERIFIED'); assert.equal(r[0].ep, 'EP-00001');
});
test('長さ・日付・番組IDのどれかが違えば確定しない', () => {
  assert.equal(spotifyMatch([row('EP-1', '保釈', '2026/11/18 04:00', 900)], data([ep('A', '保釈', '2026-11-17', 832)]), SHOWS)[0].status, 'CANDIDATE');
  assert.equal(spotifyMatch([row('EP-1', '保釈', '2026/11/25 04:00', 832)], data([ep('A', '保釈', '2026-11-17', 832)]), SHOWS)[0].status, 'CANDIDATE');
  assert.equal(spotifyMatch([row('EP-1', '保釈', '2026/11/18 04:00', 832)], data([ep('A', '保釈', '2026-11-17', 832)], id('X')), SHOWS)[0].status, 'HOLD');
});
test('既存値は上書きしない・同じ題名が複数なら保留・1対1', () => {
  assert.equal(spotifyMatch([row('EP-1', '保釈', '2026/11/18 04:00', 832, 'https://open.spotify.com/episode/' + id('B'))], data([ep('A', '保釈', '2026-11-17', 832)]), SHOWS)[0].status, 'HOLD');
  assert.equal(spotifyMatch([row('EP-1', '保釈', '2026/11/18 04:00', 832), row('EP-2', '保釈', '2026/11/18 04:00', 832)], data([ep('A', '保釈', '2026-11-17', 832)]), SHOWS)[0].status, 'HOLD');
  const r = spotifyMatch([row('EP-1', '保釈', '2026/11/18 04:00', 832)], data([ep('A', '保釈', '2026-11-17', 832), ep('B', '保 釈', '2026-11-17', 832)]), SHOWS);
  assert.ok(r.every((x) => x.status === 'HOLD'));
});
test('埋め込み・番組ページのJSONから回を拾う', () => {
  const eps = extractEpisodes({ a: [{ uri: 'spotify:episode:' + id('C'), name: '題', releaseDate: { isoString: '2026-11-17T19:00:00Z' }, duration: { totalMilliseconds: 1000 } }] });
  assert.equal(eps.length, 1); assert.equal(eps[0].url, 'https://open.spotify.com/episode/' + id('C')); assert.equal(eps[0].date, '2026-11-17'); assert.equal(eps[0].durationMs, 1000);
});
