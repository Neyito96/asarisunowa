// P27 PM-2: Amazon の証拠照合・7サービス集計・Pody のURL（合成データのみ）
import test from 'node:test';
import assert from 'node:assert/strict';
import { amazonCanonical, amazonIdsOf, amazonDurationRange, amazonEvidenceMatch, cellShape, serviceTally, podyIdOf, AMAZON_EPISODE_URL } from '../scripts/ledger-v2/platform-match.mjs';

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SHOW = U(1), OTHER = U(2);
const am = (show, n, slug = '/null--1') => `https://music.amazon.co.jp/podcasts/${show}/episodes/${U(500 + n)}${slug}`;
const row = (n, x) => Object.assign({ ep: 'EP-' + n, show: '番組', title: '（めくろう#20' + n + '）合成の回', published: '2026/10/10 04:00', duration: 3797, current: '' }, x || {});
const ev = (n, x) => Object.assign({ ep: 'EP-' + n, url: am(SHOW, n), date: '2026年10月9日', title: '（めくろう #20' + n + '）合成の回', duration: '1時間3分' }, x || {});

test('URL: 画面リンクの飾りを外す・番号は変えない・形が違えば空', () => {
  assert.equal(amazonCanonical(am(SHOW, 1)), `https://music.amazon.co.jp/podcasts/${SHOW}/episodes/${U(501)}`);
  assert.ok(AMAZON_EPISODE_URL.test(amazonCanonical(am(SHOW, 1))));
  assert.equal(amazonCanonical('https://music.amazon.co.jp/podcasts/' + SHOW), '');
  assert.equal(amazonIdsOf(amazonCanonical(am(SHOW, 1))).show, SHOW);
});
test('長さ表示: 分までは切り捨て表示として範囲、秒までは±2秒', () => {
  assert.deepEqual(amazonDurationRange('1時間3分'), { min: 3780, max: 3839 });
  assert.deepEqual(amazonDurationRange("'47分1秒"), { min: 2819, max: 2823 });
  assert.equal(amazonDurationRange(''), null);
});
test('確定: 番組ID・題名（空白差は同じ扱い）・日付(UTCの日)・長さが合う', () => {
  const r = amazonEvidenceMatch([row(1), row(2)], [ev(1)], SHOW)[0];
  assert.equal(r.status, 'VERIFIED'); assert.equal(r.ep, 'EP-1');
});
test('似た題名（番号違い）は別の回として扱い、取り違えない', () => {
  const r = amazonEvidenceMatch([row(1), row(2)], [ev(1, { title: '（めくろう #203）合成の回' })], SHOW)[0];
  assert.equal(r.status, 'CANDIDATE');
});
test('番組IDが違う（再放送の別番組など）・未確認なら確定しない', () => {
  assert.equal(amazonEvidenceMatch([row(1)], [ev(1, { url: am(OTHER, 1) })], SHOW)[0].status, 'CANDIDATE');
  assert.equal(amazonEvidenceMatch([row(1)], [ev(1)], '')[0].status, 'CANDIDATE');
});
test('日付・長さが合わなければ候補どまり', () => {
  assert.equal(amazonEvidenceMatch([row(1)], [ev(1, { date: '2026年9月1日' })], SHOW)[0].status, 'CANDIDATE');
  assert.equal(amazonEvidenceMatch([row(1)], [ev(1, { duration: '47分1秒' })], SHOW)[0].status, 'CANDIDATE');
});
test('見つからない・既存URL競合・重複・調べた回と違う', () => {
  assert.equal(amazonEvidenceMatch([row(1)], [ev(1, { url: '' })], SHOW)[0].status, 'UNAVAILABLE');
  assert.equal(amazonEvidenceMatch([row(1, { current: 'https://music.amazon.co.jp/podcasts/' + SHOW + '/episodes/' + U(999) })], [ev(1)], SHOW)[0].status, 'HOLD');
  const d = amazonEvidenceMatch([row(1)], [ev(1), ev(1)], SHOW); assert.ok(d.every((x) => x.status === 'HOLD'));
  assert.equal(amazonEvidenceMatch([row(1)], [ev(1, { ep: 'EP-9' })], SHOW)[0].status, 'HOLD');
  assert.equal(amazonEvidenceMatch([row(1, { current: amazonCanonical(am(SHOW, 1)) })], [ev(1)], SHOW)[0].status, 'VERIFIED_SAME');
});
test('7サービス集計: 個別URL・番組トップのみ・空欄を形で分ける', () => {
  assert.equal(cellShape('Spotify', 'https://open.spotify.com/episode/7CqHaZnKM5bGq6rhjuW1ka'), 'EPISODE');
  assert.equal(cellShape('Apple', 'https://podcasts.apple.com/jp/podcast/x/id1526773927?i=1000794517780&uo=4'), 'EPISODE');
  assert.equal(cellShape('Apple', 'https://podcasts.apple.com/jp/podcast/x/id1526773927'), 'SHOW_ONLY');
  assert.equal(cellShape('Pocket Casts', 'https://pca.st/episode/17496f9e-d20a-4b32-9c66-85954538a1d0'), 'EPISODE');
  assert.equal(cellShape('LISTEN', 'https://listen.style/p/tvzppbdm/7m1rzjhs'), 'EPISODE');
  assert.equal(cellShape('Amazon', ''), 'EMPTY');
  assert.equal(cellShape('YouTube', 'https://www.youtube.com/watch?v=abcdefghijk'), 'EPISODE');
  const t = serviceTally([{ show: 'A', values: { Spotify: 'https://open.spotify.com/episode/7CqHaZnKM5bGq6rhjuW1ka' } }, { show: 'A', values: {} }]);
  assert.equal(t.Spotify.EPISODE, 1); assert.equal(t.Spotify.EMPTY, 1); assert.equal(t.Amazon.byShow.A.EMPTY, 2);
});
test('Pody: 回URLから回IDを取り出す', () => {
  assert.equal(podyIdOf('https://pody.jp/player/to04ABW3puiCBtAvp6Wx/abcdefghij0123456789'), 'abcdefghij0123456789');
  assert.equal(podyIdOf('https://pody.jp/player/to04ABW3puiCBtAvp6Wx'), '');
});
test('照合: 配信先が公式GUIDを持つ（Pody）なら GUID 経路で結ぶ', async () => {
  const { matchPlatform, PODY_EPISODE_URL } = await import('../scripts/ledger-v2/platform-match.mjs');
  const v2 = [{ ep: 'EP-1', show: 'S', title: 'あ', published: '2026/10/01 04:00', guid: 'g-1', audio: '', duration: 100, current: '' }];
  const url = 'https://pody.jp/player/' + 'A'.repeat(20) + '/' + 'b'.repeat(20);
  const m = matchPlatform(v2, [{ id: 'b'.repeat(20), title: 'あ', published: '2026-09-30T19:00:00Z', duration: 100, audio: 'https://x/y.mp3', guid: 'G-1', url }], { urlOf: (e) => e.url, isValidUrl: (u) => PODY_EPISODE_URL.test(u), idOfUrl: podyIdOf });
  assert.equal(m.rows[0].method, 'GUID'); assert.equal(m.rows[0].action, 'WRITE');
});
