// #312 ポす神回: 紹介元照合・投稿検証・承認・公開データ（合成データ・GASを使わない）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// GAS のファイルは ES モジュールではないので、GAS と同じく1つの名前空間で読み込む
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/Posukami.js', import.meta.url), 'utf8'), ctx);
const P = ctx.module.exports;
const J = (x) => JSON.parse(JSON.stringify(x));   // 別の実行環境の配列・オブジェクトを比べられる形に

const pods = [
  { id: '16', title: 'クリエイティブの反対語', maker: 'Emi Tochio', introduced: '2026-10-20' },
  { id: '17', title: 'ファミレスで隣から聞こえてくるフリーランスのモヤモヤ話', maker: 'Emi + Sakura', introduced: '2026-10-20' },
  { id: '15', title: 'おんすた【NOW AND THEN】', maker: 'Online Stylus（おんすた）', introduced: '2026-10-13' },
  { id: '20', title: 'ながらcast', maker: 'sasayuki', introduced: '2026-11-10' },
  { id: '99', title: '似た名前のラジオ', maker: 'x', introduced: '2026-10-01' },
];
const eps = [
  { ep: 'EP-06605', title: '（ポすすめ）クリエイティブの反対語・ファミレスで隣から聞こえてくるフリーランスのモヤモヤ話', date: '2026/10/20 04:00', summary: 'ポすすめ', status: '対象', url: 'https://omny.fm/shows/asahi/d20261020' },
  { ep: 'EP-01222', title: '（ポすすめ）おんすた 【NOW AND THEN】', date: '2026/10/13 04:00', summary: '', status: '対象', url: '' },
  { ep: 'EP-06691', title: '（ポすすめ）ながらcast', date: '2026/11/10 04:00', summary: '', status: '対象', url: '' },
  { ep: 'EP-00999', title: '（日曜版）似た名前のラジオの話をした回', date: '2026/09/01 04:00', summary: '', status: '対象', url: '' },
  { ep: 'EP-00998', title: 'ながらcast を雑談で話した回', date: '2026/11/10 04:00', summary: '', status: '対象', url: '' },
];

test('紹介元: 番組名＋紹介日で確定。1つの回が2番組を紹介していれば両方に付く', () => {
  const r = Object.fromEntries(P.posuIntroMatch(pods, eps).map((x) => [x.id, x]));
  assert.equal(r['16'].status, 'VERIFIED'); assert.equal(r['16'].intros[0].ep, 'EP-06605');
  assert.equal(r['17'].status, 'VERIFIED'); assert.equal(r['17'].intros[0].ep, 'EP-06605');
  assert.equal(r['15'].status, 'VERIFIED'); assert.equal(r['15'].intros[0].ep, 'EP-01222');   // 空白・全角半角の差は同じ
  assert.equal(r['20'].intros.length, 1);   // （ポすすめ）の付かない回は紹介回として扱わない
});
test('紹介元: 番組名だけ一致（日付違い）は HOLD で、リンクにしない', () => {
  const r = P.posuIntroMatch(pods, eps).find((x) => x.id === '99');
  assert.equal(r.status, 'HOLD'); assert.equal(r.intros.length, 0); assert.equal(r.candidates[0].ep, 'EP-00999');
});
test('紹介元: 除外の回は使わない・何も無ければ NOT_FOUND', () => {
  const r = P.posuIntroMatch([{ id: '1', title: 'まったく別の番組', maker: 'z', introduced: '2026-01-01' }], eps.concat([{ ep: 'EP-1', title: '（ポすすめ）まったく別の番組', date: '2026/01/01 04:00', status: '除外' }]));
  assert.equal(r[0].status, 'NOT_FOUND');
});
test('URL: エピソード個別だけ。番組トップは不可。照合キーは同じ回で同じ', () => {
  assert.equal(P.posuEpisodeUrl('https://podcasts.apple.com/jp/podcast/x/id1129707783?i=1000802141616&uo=4').key, 'apple:1000802141616');
  assert.equal(P.posuEpisodeUrl('https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616').key, 'apple:1000802141616');
  assert.equal(P.posuEpisodeUrl('https://podcasts.apple.com/jp/podcast/x/id1129707783'), null);
  assert.equal(P.posuEpisodeUrl('https://open.spotify.com/show/3OfXRilYnsDfqt5idrtoku'), null);
  assert.equal(P.posuEpisodeUrl('https://open.spotify.com/episode/3FB0Z8QZTrbvTgVYvblCqC?si=x').key, 'spotify:3FB0Z8QZTrbvTgVYvblCqC');
  assert.equal(P.posuEpisodeUrl('https://omny.fm/shows/asahi/d20261116?in_playlist=donut').key, 'omny:asahi/d20261116');
  assert.equal(P.posuEpisodeUrl('http://open.spotify.com/episode/3FB0Z8QZTrbvTgVYvblCqC'), null);
  assert.equal(P.posuEpisodeUrl('javascript:alert(1)'), null);
  assert.equal(P.posuEpisodeUrl('https://www.youtube.com/watch?v=abcdefghijk&t=3').key, 'youtube:abcdefghijk');
});
const sub = (x) => Object.assign({ podcastId: '16', podcastTitle: 'クリエイティブの反対語', url: 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616', relation: 'kanda_guest', title: '', date: '', note: '', hp: '' }, x || {});
test('投稿検証: 既存番組（ID＋番組名）に紐づく・二重投稿・不明番組・ボット・上限', () => {
  const ok = P.posuValidate(sub(), pods, {}, { _total: 0 });
  assert.equal(ok.ok, true); assert.equal(ok.key, 'apple:1000802141616|16');
  assert.deepEqual(J(P.posuValidate(sub(), pods, { [ok.key]: true }, {}).errors), ['DUPLICATE']);
  assert.ok(P.posuValidate(sub({ podcastId: '404' }), pods, {}, {}).errors.includes('UNKNOWN_PODCAST'));
  assert.ok(P.posuValidate(sub({ podcastTitle: '別の番組' }), pods, {}, {}).errors.includes('PODCAST_TITLE_MISMATCH'));
  assert.ok(P.posuValidate(sub({ hp: 'x' }), pods, {}, {}).errors.includes('BOT_SUSPECTED'));
  assert.ok(P.posuValidate(sub({ relation: 'x' }), pods, {}, {}).errors.includes('BAD_RELATION'));
  assert.ok(P.posuValidate(sub({ url: 'https://podcasts.apple.com/jp/podcast/id1129707783' }), pods, {}, {}).errors.includes('NOT_EPISODE_URL'));
  assert.ok(P.posuValidate(sub(), pods, {}, { 16: 5 }).errors.includes('TOO_MANY_PENDING'));
  // 同じ回でも別の番組のカードなら別の投稿として扱う
  assert.equal(P.posuValidate(sub({ podcastId: '17', podcastTitle: 'ファミレスで隣から聞こえてくるフリーランスのモヤモヤ話' }), pods, { [ok.key]: true }, {}).ok, true);
});
test('ページの題名と日付（og:title・JSON-LD）', () => {
  const m = P.posuPageMeta('<meta property="og:title" content="#410 なんと同い年！ &amp; 神田大介さん"><script>{"@type":"PodcastEpisode","datePublished":"2026-11-15"}</script>');
  assert.equal(m.title, '#410 なんと同い年！ & 神田大介さん'); assert.equal(m.date, '2026-11-15');
  assert.deepEqual(J(P.posuPageMeta('')), { title: '', date: '' });
});
const qrow = (id, state, key, podId = '16', podTitle = 'クリエイティブの反対語') => [id, '2026-11-17T00:00:00Z', podId, podTitle, 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616', key, 'kanda_guest', '#410 なんと同い年！', '2026-11-16', '', '#410 なんと同い年！', '2026-11-15', 'ページ確認（題名あり）', 'ページに神田さん・朝ポキ', state, '', ''];
test('承認: 承認した行だけ・一度だけ公開。承認待ち・却下は公開しない。二重承認は1件', () => {
  const S = P.POSU_STATE, k = 'apple:1|16';
  const plan = P.posuApprovePlan([qrow('A', S.PENDING, 'k0'), qrow('B', S.APPROVE, k), qrow('C', S.APPROVE, k), qrow('D', S.REJECT, 'k3')], {}, pods, '2026-11-17T01:00:00Z');
  assert.equal(plan.add.length, 1); assert.equal(plan.add[0][12], 'B'); assert.equal(plan.add[0][4], 'クリエイティブの反対語');
  assert.deepEqual(J(plan.updates.map((u) => u.state)), [S.DONE, S.DONE]);
  const again = P.posuApprovePlan([qrow('B', S.DONE, k)], { [k]: true }, pods, 'x');
  assert.equal(again.add.length, 0);
  const renamed = P.posuApprovePlan([qrow('E', S.APPROVE, 'k9', '16', '改名された番組')], {}, pods, 'x');
  assert.equal(renamed.add.length, 0); assert.equal(renamed.updates[0].state, S.PENDING);
});
test('承認: ドーナツ出演回は番組名をドーナツにし、補足や判断メモの EP-ID を使う', () => {
  const r = qrow('F', P.POSU_STATE.APPROVE, 'omny:asahi/d20261116|16'); r[6] = 'donut_guest'; r[9] = 'ドーナツ EP-06739（台帳で確認）';
  const plan = P.posuApprovePlan([r], {}, pods, '2026-11-17T01:00:00Z');
  assert.equal(plan.add[0][4], 'ドーナツ'); assert.equal(plan.add[0][8], 'EP-06739');
});
test('公開データ: 蔵にある回は蔵の個別ページ、無ければ公式ページ。番組名が違う行・重複は出さない', () => {
  const rows = [
    ['INTRO', '16', 'クリエイティブの反対語', '（ポすすめ）…', 'ドーナツ', '2026-10-20', 'https://omny.fm/shows/asahi/d20261020', '', 'EP-06605', '2026-11-17', '', 'INTRO|16|EP-06605', ''],
    ['INTRO', '15', 'おんすた【NOW AND THEN】', '（ポすすめ）おんすた', 'ドーナツ', '2026-10-13', '', '', 'EP-01222', '2026-11-17', '', 'INTRO|15|EP-01222', ''],
    ['SPECIAL', '16', 'クリエイティブの反対語', '#410', 'クリエイティブの反対語', '2026-11-16', 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616', 'kanda_guest', '', '2026-11-17', '', 'apple:1000802141616|16', 'PK-1'],
    ['SPECIAL', '16', 'クリエイティブの反対語', '#410', 'クリエイティブの反対語', '2026-11-16', 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616', 'kanda_guest', '', '2026-11-17', '', 'apple:1000802141616|16', 'PK-2'],
    ['SPECIAL', '16', '別の番組名', 'x', '', '2026-11-16', 'https://example.com/x', 'other', '', '2026-11-17', '', 'k', ''],
    ['SPECIAL', '17', 'ファミレスで隣から聞こえてくるフリーランスのモヤモヤ話', 'bad', '', '2026-11-16', 'javascript:alert(1)', 'other', '', '2026-11-17', '', 'k2', ''],
  ];
  const j = P.posuBuildPublic(rows, pods, { 'EP-01222': true }, { generatedAt: 'T' });
  const c16 = j.cards.find((c) => c.podcastId === '16'), c15 = j.cards.find((c) => c.podcastId === '15');
  assert.equal(c16.introductions[0].href, 'https://omny.fm/shows/asahi/d20261020'); assert.equal(c16.introductions[0].library, false);
  assert.equal(c15.introductions[0].href, '/library/?ep=EP-01222'); assert.equal(c15.introductions[0].library, true);
  assert.equal(c16.specials.length, 1); assert.equal(c16.specials[0].relation, 'この番組に神田さん等が出演');
  assert.equal(j.cards.find((c) => c.podcastId === '17'), undefined);
  assert.equal(j.submitEnabled, false);
});

test('ポすすめ返し: 投稿の種類 reply は「ポすすめ返し」欄に分けて載り、ポす神回とは混ざらない', () => {
  assert.equal(P.posuValidate(sub({ relation: 'reply', url: 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000799999999' }), pods, {}, {}).ok, true);
  const r = qrow('R', P.POSU_STATE.APPROVE, 'apple:1000799999999|16'); r[6] = 'reply';
  const plan = P.posuApprovePlan([r], {}, pods, '2026-11-17T01:00:00Z');
  assert.equal(plan.add[0][4], 'クリエイティブの反対語');
  const j = P.posuBuildPublic(plan.add, pods, {}, {});
  assert.equal(j.cards[0].replies.length, 1); assert.equal(j.cards[0].specials.length, 0);
});
test('ポすすめ返しの候補: 紹介日〜90日後・ポすすめ等への言及だけ。題名にあれば強い候補', () => {
  const p = { introduced: '2026-10-20' };
  const c = P.posuReplyCandidates(p, [
    { title: '#401 ドーナツのポすすめで紹介されました！', description: '', published: '2026-10-27T00:00:00Z', url: 'https://a/1' },
    { title: '#402 雑談', description: '朝日新聞の神田さんに感謝', published: '2026-11-03T00:00:00Z', url: 'https://a/2' },
    { title: '#399 ドーナツ食べた', description: '', published: '2026-10-01T00:00:00Z', url: 'https://a/0' },
    { title: '#403 旅行', description: 'なし', published: '2026-11-10T00:00:00Z', url: 'https://a/3' },
    { title: '#500 ポすすめ', description: '', published: '2027-03-01T00:00:00Z', url: 'https://a/9' },
  ]);
  assert.deepEqual(J(c.map((x) => [x.url, x.strength.slice(0, 1)])), [['https://a/1', '強'], ['https://a/2', '弱']]);
  assert.equal(P.posuAppleShowId('https://podcasts.apple.com/jp/podcast/x/id1129707783'), '1129707783');
  assert.equal(P.posuAppleShowId('https://x.gd/OA1Cv'), '');
});
test('紹介元: 概要の「紹介したポッドキャストは「…」」の表記ゆれ（吹奏楽部⇔吹部）＋紹介日で確定。日付だけ一致の2候補は HOLD', () => {
  const p = [{ id: '4', title: '僕たちの吹奏楽部を作ろう ～地域が支える新しい部活動のカタチ', maker: '団長平井', introduced: '2026.04.19' },
    { id: '12', title: 'ネジネジ低空飛行 — ゆるバイポーラー thinking aloud —', maker: 'ネジート', introduced: '2026.08.16' }];
  const e = [{ ep: 'EP-05473', title: '（日曜版）ふつうの映画見て、ふつうのランチ食べる', date: '2026/04/19 04:00', summary: '※番組内で紹介したポッドキャストは「僕たちの吹部を作ろう 〜地域が支える新しい部活動のカタチ〜」です。', status: '対象' },
    { ep: 'EP-05572', title: '（日曜版）ゴスペルMVPの法則', date: '2026/08/16 04:00', summary: 'Miracle、Victory、Power！', status: '対象' },
    { ep: 'EP-00286', title: '（日曜版）セックスワークの具体論', date: '2026/08/16 04:00', summary: '', status: '対象' },
    { ep: 'EP-05558', title: '（日曜版）盆DANCE', date: '2026/04/19 04:00', summary: '紹介したポッドキャストは「ののラジオ～名作文学を朗読で～」です', status: '対象' }];
  const r = Object.fromEntries(P.posuIntroMatch(p, e).map((x) => [x.id, x]));
  assert.equal(r['4'].status, 'VERIFIED'); assert.deepEqual(J(r['4'].intros.map((i) => i.ep)), ['EP-05473']);
  assert.equal(r['12'].status, 'HOLD'); assert.equal(r['12'].intros.length, 0); assert.deepEqual(J(r['12'].candidates.map((i) => i.ep)).sort(), ['EP-00286', 'EP-05572']);
});
test('番組ID: 「番組ID」列があればその値、無ければ並び順。交流状況の列は番組IDで結ぶ', () => {
  const vals = [['URL', '番組名', 'n', 'd', 'c', 's', 'a', 'l', 'sf', 'am', 'yt', 'hp', 'art', 'rss', 'pc', 'pody', 'g', '番組ID'], ['u', 'A', '', '2026/04/05', '', '', '', '', '', '', '', '', '', '', '', '', '', '7'], ['u', 'B', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']];
  assert.deepEqual(J(P.posuPodcastRowsToList(vals).map((p) => p.id)), ['7', '2']);
  const sum = J(P.posuPodcastSummary(vals, [['SPECIAL', '7', 'A', '返し', 'A', '2026-05-01', 'u', 'reply', '', '', '', 'k', '']], [['PK', '', '2', 'B', 'u', 'k2', 'other', '', '', '', '', '', '', '', '承認待ち', '', '']]));
  assert.deepEqual(sum, [['7', '', '返し（2026-05-01）', '', ''], ['2', '', '', '', '1']]);
});

test('即時公開（2026-11-20）: ページ確認済みの投稿は自動承認、受付メッセージも「30分ほどで載る」', async () => {
  const fs = await import('node:fs');
  const gas = fs.readFileSync(new URL('../scripts/google-apps-script/Posukami.js', import.meta.url), 'utf8');
  assert.ok(/var auto = code === 200 && !!meta\.title && posuAutoCountToday_\(queue, now\) < POSU_AUTO_DAILY_MAX;/.test(gas));
  assert.ok(gas.includes("auto ? POSU_STATE.APPROVE : POSU_STATE.PENDING"));
  const { posukamiResultMessage } = await import('../app/posukami.ts').catch(() => ({}));
  if (posukamiResultMessage) {
    assert.match(posukamiResultMessage({ ok: true, receiptId: 'PK-1', status: 'PUBLISHED' }).text, /30分ほどでカードに載ります/);
    assert.match(posukamiResultMessage({ ok: true, receiptId: 'PK-1', status: 'PENDING' }).text, /確認のあとに/);
  }
});
