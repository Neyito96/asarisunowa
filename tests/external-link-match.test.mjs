import test from 'node:test';
import assert from 'node:assert/strict';
import { matchExternalLinks, summarize, omnySlug, asahiItemId, spotifyEpisodeId, pocketEpisodeId, extDateJst } from '../public/library/external-link-match.mjs';

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';
const G3 = '33333333-3333-4333-8333-333333333333';
const SP = (c) => `https://open.spotify.com/episode/${c.repeat(22)}`;
const PC = (g) => `https://pca.st/episode/${g}`;
const prod = (id, show, title, date, guid, page, spotify = '', pocket = '') => {
  const r = Array(44).fill('');
  r[0] = id; r[1] = show; r[2] = title; r[3] = date; r[6] = guid; r[8] = page;
  r[9] = `https://www.asahi.com/special/podcasts/item/?itemid=${guid}`; r[11] = spotify; r[41] = pocket;
  return r;
};
const ext = (omny, date, title, spotify, asahi, pocket) => [omny, date, title, '', '', '', '', '', '', '', '', spotify, asahi, pocket];
const asahi = (g) => `https://www.asahi.com/special/podcasts/item/?itemid=${g}`;

test('URL parsers', () => {
  assert.equal(omnySlug('https://omny.fm/shows/asahi/abc?x=1'), 'asahi/abc');
  assert.equal(asahiItemId(asahi(G1)), G1);
  assert.equal(spotifyEpisodeId(SP('a')), 'a'.repeat(22));
  assert.equal(spotifyEpisodeId('https://open.spotify.com/show/xxxx'), '');
  assert.equal(pocketEpisodeId(PC(G1)), G1);
  assert.equal(pocketEpisodeId('https://pca.st/podcast/abc'), '');
  assert.equal(extDateJst('Fri, 18 Aug 2023 19:00:00 +0000'), '2023-08-19');
});

test('確定一致: 空欄のみ補完候補、既存値は上書きしない', () => {
  const P = [
    prod('EP-1', 'ドーナツ', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a'),
    prod('EP-2', 'ドーナツ', 'B', '2026/11/11 4:00', G2, 'https://omny.fm/shows/asahi/b', SP('x'), PC(G2)),
  ];
  const before = JSON.stringify(P);
  const res = matchExternalLinks(P, { 'ドーナツ': [
    ext('https://omny.fm/shows/asahi/a', 'Mon, 09 Nov 2026 19:00:00 +0000', 'A', SP('p'), asahi(G1), PC(G3)),
    ext('https://omny.fm/shows/asahi/b', 'Tue, 10 Nov 2026 19:00:00 +0000', 'B', SP('x'), asahi(G2), PC(G2)),
  ] });
  assert.equal(JSON.stringify(P), before, '入力を変更しない');
  assert.equal(res[0].cls, 'CONFIRMED'); assert.equal(res[0].spotify, 'FILL'); assert.equal(res[0].pocket, 'FILL');
  assert.equal(res[1].cls, 'CONFIRMED'); assert.equal(res[1].spotify, 'SAME'); assert.equal(res[1].pocket, 'SAME');
});

test('既存値と異なる → URL_CONFLICT（補完しない）／別フィードは URL_CONFLICT_FEED', () => {
  const P = [
    prod('EP-1', 'SDGsを話そう', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a', SP('x'), PC(G1)),
    prod('EP-2', 'SDGsを話そう', 'B', '2026/11/11 4:00', G2, 'https://omny.fm/shows/asahi/b', SP('x'), ''),
  ];
  const res = matchExternalLinks(P, { SDGs: [
    ext('https://omny.fm/shows/arukiki-ajw/a', 'Mon, 09 Nov 2026 19:00:00 +0000', 'A', SP('y'), asahi(G1), PC(G3)),
    ext('https://omny.fm/shows/asahi/b', 'Tue, 10 Nov 2026 19:00:00 +0000', 'B', SP('y'), asahi(G2), ''),
  ] });
  assert.equal(res[0].spotify, 'URL_CONFLICT_FEED'); assert.equal(res[0].pocket, 'URL_CONFLICT_FEED');
  assert.equal(res[1].spotify, 'URL_CONFLICT'); assert.equal(res[1].pocket, 'NO_EXT_URL');
});

test('強キーなし（タイトル+日付のみ）は曖昧で補完しない', () => {
  const P = [prod('EP-1', '報談', 'T', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/zzz')];
  const res = matchExternalLinks(P, { '報談': [ext('https://omny.fm/shows/asahi/other', 'Mon, 09 Nov 2026 19:00:00 +0000', 'T', SP('p'), '', PC(G3))] });
  assert.equal(res[0].cls, 'AMBIGUOUS'); assert.equal(res[0].spotify, 'HOLD_AMBIGUOUS'); assert.equal(res[0].pocket, 'HOLD_AMBIGUOUS');
});

test('強キーが複数の台帳行を指す → 競合（補完しない）', () => {
  const P = [
    prod('EP-1', 'ニュースの学校', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a'),
    prod('EP-2', 'ニュースの学校', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a'),
  ];
  const res = matchExternalLinks(P, { 'ニュースの学校': [ext('https://omny.fm/shows/asahi/a', 'Mon, 09 Nov 2026 19:00:00 +0000', 'A', SP('p'), asahi(G1), PC(G3))] });
  assert.equal(res[0].cls, 'CONFLICT'); assert.equal(res[0].prodId, ''); assert.equal(res[0].spotify, 'NO_PROD_ROW');
});

test('番組が違う台帳行には一致させない／同じ配信が別番組に2行ある場合は番組ごとに解決', () => {
  const P = [
    prod('EP-1', 'スポンジ', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a'),
    prod('EP-2', 'ニュースの現場から', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a'),
  ];
  const row = ext('https://omny.fm/shows/asahi/a', 'Mon, 09 Nov 2026 19:00:00 +0000', 'A', SP('p'), asahi(G1), PC(G3));
  const res = matchExternalLinks(P, { 'スポンジ': [row], 'ニュースの現場から': [row] });
  assert.deepEqual(res.map((r) => [r.tab, r.cls, r.prodId]), [['スポンジ', 'CONFIRMED', 'EP-1'], ['ニュースの現場から', 'CONFIRMED', 'EP-2']]);
  // 台帳に別番組名の行しか無い場合は強キー一致として認め、showMismatch を立てる
  const only = matchExternalLinks([P[0]], { 'ドーナツ': [row] });
  assert.equal(only[0].cls, 'CONFIRMED'); assert.equal(only[0].showMismatch, true); assert.equal(only[0].prodShow, 'スポンジ');
  // 別番組名の行が2つ以上あり、同じ番組名が無い → 競合
  const two = matchExternalLinks(P, { 'ドーナツ': [row] });
  assert.equal(two[0].cls, 'CONFLICT');
});

test('外部URLの形式不正（番組ページ等）は補完しない', () => {
  const P = [prod('EP-1', 'ドーナツ', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a')];
  const res = matchExternalLinks(P, { 'ドーナツ': [ext('https://omny.fm/shows/asahi/a', 'Mon, 09 Nov 2026 19:00:00 +0000', 'A', 'https://open.spotify.com/show/abc', asahi(G1), 'https://pca.st/podcast/abc')] });
  assert.equal(res[0].spotify, 'EXT_URL_INVALID'); assert.equal(res[0].pocket, 'EXT_URL_INVALID');
});

test('summarize', () => {
  const P = [prod('EP-1', 'ドーナツ', 'A', '2026/11/10 4:00', G1, 'https://omny.fm/shows/asahi/a')];
  const s = summarize(matchExternalLinks(P, { 'ドーナツ': [ext('https://omny.fm/shows/asahi/a', 'Mon, 09 Nov 2026 19:00:00 +0000', 'A', SP('p'), asahi(G1), PC(G3))] }));
  assert.equal(s.total.CONFIRMED, 1); assert.equal(s.byTab['ドーナツ'].spotifyFill, 1); assert.equal(s.byTab['ドーナツ'].pocketFill, 1);
});
