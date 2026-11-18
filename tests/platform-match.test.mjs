// P27 配信先URLロボの照合（合成データのみ）
import test from 'node:test';
import assert from 'node:assert/strict';
import { podyEpisodesFromHtml, PODY_EPISODE_URL, audioKey, omnyClipId, matchPlatform, pcEpisodesFromJson, pcEpisodeUrl, pcUuidOf, PC_EPISODE_URL } from '../scripts/ledger-v2/platform-match.mjs';

const ORG = '1e3bd144-9b57-451a-93cf-ac0e00e74446', PRG = '50382bb4-3af3-4250-8ddc-ac0f0033ceb5';
const omny = (clip, q = '?utm_source=Podcast') => `https://traffic.omny.fm/d/clips/${ORG}/${PRG}/${clip}/audio.mp3${q}`;
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pcOpts = { urlOf: (e) => pcEpisodeUrl(e.id), isValidUrl: (u) => PC_EPISODE_URL.test(u), idOfUrl: pcUuidOf };
const row = (n, extra) => Object.assign({ ep: 'EP-' + n, show: '番組', title: '合成の回' + n, published: '2026/10/01 04:00', guid: U(100 + n), audio: '', duration: 1200, current: '' }, extra || {});
const ep = (n, extra) => Object.assign({ id: U(900 + n), title: '合成の回' + n, published: '2026-09-30T19:00:00Z', duration: 1200, audio: omny(U(100 + n)) }, extra || {});

test('音声キー: Omnyはクリップ番号、megaphoneはTASC番号、計測の前置きとクエリは外す', () => {
  assert.equal(omnyClipId(omny(U(1))), U(1));
  assert.equal(audioKey('https://pdst.fm/e/traffic.megaphone.fm/TASC3264735488.mp3'), 'megaphone:TASC3264735488');
  assert.equal(audioKey('https://traffic.megaphone.fm/TASC3264735488.mp3?updated=1'), 'megaphone:TASC3264735488');
  assert.equal(audioKey('https://pdst.fm/e/chrt.fm/track/ABC/example.com/a.mp3?x=1'), 'file:example.com/a.mp3');
});
test('GUID一致（Omnyクリップ＝公式GUID）で確定、URLは pca.st/episode/<ID>', () => {
  const r = matchPlatform([row(1)], [ep(1)], pcOpts);
  assert.equal(r.rows[0].verdict, '確定（空欄に書ける）'); assert.equal(r.rows[0].method, 'GUID'); assert.equal(r.rows[0].url, 'https://pca.st/episode/' + U(901));
});
test('音声URL一致（megaphone）で確定', () => {
  const r = matchPlatform([row(2, { guid: 'x', audio: 'https://traffic.megaphone.fm/TASC0000000002.mp3' })], [ep(2, { audio: 'https://pdst.fm/e/traffic.megaphone.fm/TASC0000000002.mp3' })], pcOpts);
  assert.equal(r.rows[0].method, 'AUDIO'); assert.equal(r.rows[0].action, 'WRITE');
});
test('題名・時刻±60秒・長さ±2秒の一致（META）。1つでも外れたら候補なし', () => {
  const base = row(3, { guid: '', audio: '' }), e = ep(3, { audio: 'https://example.com/other.mp3' });
  assert.equal(matchPlatform([base], [e], pcOpts).rows[0].method, 'META');
  assert.equal(matchPlatform([base], [Object.assign({}, e, { duration: 1203 })], pcOpts).rows[0].verdict, '不一致（候補なし）');
  assert.equal(matchPlatform([base], [Object.assign({}, e, { published: '2026-09-30T19:01:01Z' })], pcOpts).rows[0].verdict, '不一致（候補なし）');
  assert.equal(matchPlatform([base], [Object.assign({}, e, { title: '別の回' })], pcOpts).rows[0].verdict, '不一致（候補なし）');
});
test('音声は一致でも題名も日時も離れていれば保留', () => {
  const r = matchPlatform([row(4)], [ep(4, { title: '全く別の題名', published: '2026-12-01T00:00:00Z' })], pcOpts);
  assert.equal(r.rows[0].action, 'HOLD'); assert.match(r.rows[0].verdict, /離れている/);
});
test('既存URLと同じ→一致、違う→既存URL競合（上書きしない）', () => {
  assert.equal(matchPlatform([row(5, { current: 'https://pca.st/episode/' + U(905) })], [ep(5)], pcOpts).rows[0].verdict, '一致（既存URLと同じ）');
  const r = matchPlatform([row(6, { current: 'https://pca.st/episode/' + U(777) })], [ep(6)], pcOpts);
  assert.equal(r.rows[0].verdict, '既存URL競合（上書きしない）'); assert.equal(r.summary.existingUrlNotInPlatform, 1);
});
test('1対1にならないもの（同じ配信先の回が2行に当たる・2回が1行に当たる）は全部保留', () => {
  const a = matchPlatform([row(7), row(8, { guid: U(107) })], [ep(7)], pcOpts);
  assert.deepEqual(a.rows.map((x) => x.verdict), ['重複（1対1にならない）', '重複（1対1にならない）']);
  const b = matchPlatform([row(9)], [ep(9), ep(9, { id: U(999) })], pcOpts);
  assert.equal(b.rows[0].verdict, '重複（1対1にならない）');
});
test('配信先側の余り（V2に無い回）を数える／公開データの形を読む', () => {
  const r = matchPlatform([row(10)], [ep(10), ep(11, { audio: omny(U(555)), title: '余り' })], pcOpts);
  assert.equal(r.summary.platformUnmatched, 1);
  const eps = pcEpisodesFromJson({ podcast: { episodes: [{ uuid: U(1).toUpperCase(), title: 't', published: '2026-11-16T19:00:00Z', duration: 10, url: omny(U(2)) }] } });
  assert.equal(eps[0].url, 'https://pca.st/episode/' + U(1)); assert.equal(eps[0].id, U(1));
});
test('URLの形の検証: pca.st/episode/<UUID> 以外は書かない', () => {
  assert.equal(pcUuidOf('https://pca.st/episode/' + U(1)), U(1));
  assert.equal(pcUuidOf('https://pocketcasts.com/episode/' + U(1)), '');
  assert.equal(pcUuidOf('https://pca.st/24ocahla'), '');
});

test('Pody: 番組ページに埋め込まれた episodes から 回ID・GUID・音声・日時・長さ・題名を取り出す（別番組の要素は除く）', () => {
  const S = 'SHOWAAAAAAAAAAAAAAAA', O = 'OTHERBBBBBBBBBBBBBBB';
  const obj = (id, feed, guid, extra) => '{\\"id\\":\\"' + id + '\\",\\"pubDateIso\\":\\"2026-11-16T19:00:00.000Z\\",\\"title\\":\\"合成の回\\",\\"duration\\":\\"1369\\",\\"feedId\\":\\"' + feed + '\\",\\"guid\\":\\"' + guid + '\\",\\"audio\\":\\"' + omny(guid) + '\\"' + (extra || '') + '}';
  const html = '<script>self.__next_f.push([1,"[{\\"episodes\\":[' + obj('EPIDAAAAAAAAAAAAAAAA', S, U(1)) + ',' + obj('EPIDBBBBBBBBBBBBBBBB', O, U(2)) + ',' + obj('EPIDAAAAAAAAAAAAAAAA', S, U(1)) + ']}]"])</script>';
  const eps = podyEpisodesFromHtml(html, S);
  assert.equal(eps.length, 1);
  assert.deepEqual([eps[0].id, eps[0].guid, eps[0].duration, eps[0].title, eps[0].url], ['EPIDAAAAAAAAAAAAAAAA', U(1), 1369, '合成の回', 'https://pody.jp/player/' + S + '/EPIDAAAAAAAAAAAAAAAA']);
  assert.ok(PODY_EPISODE_URL.test(eps[0].url)); assert.equal(omnyClipId(eps[0].audio), U(1));
});
