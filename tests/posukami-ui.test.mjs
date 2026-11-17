// #312 ポす神回: 画面の部品（app/posukami.ts）・公開データ・既存カードの保全（ビルド不要の静的試験）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { posukamiHref, parsePosukami, findPosukamiCard, isPosukamiNew, formatPosukamiDate, looksLikeEpisodeUrl, posukamiSubmitUrl, posukamiResultMessage } from '../app/posukami.ts';
import { parseCsv, rowsFrom, build } from '../scripts/posusume/build-posukami.mjs';

const data = parsePosukami(JSON.parse(fs.readFileSync(new URL('../public/posusume/posukami.json', import.meta.url), 'utf8')));
const tsx = fs.readFileSync(new URL('../app/community.tsx', import.meta.url), 'utf8');
const section = fs.readFileSync(new URL('../app/PosukamiCardSection.tsx', import.meta.url), 'utf8');

test('公開データ: 栃尾さんの実例（紹介回 EP-06605・ドーナツ対話・#410）がカード16に付く', () => {
  const c = findPosukamiCard(data, { id: '16', title: 'クリエイティブの反対語' });
  assert.ok(c);
  assert.equal(c.introductions[0].epId, 'EP-06605'); assert.equal(c.introductions[0].date, '2026-10-20');
  assert.deepEqual(c.specials.map((s) => s.href), ['/library/?ep=EP-06739', 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616']);
  assert.equal(c.specials[0].program, 'ドーナツ'); assert.equal(c.specials[0].epId, 'EP-06739');
});
test('公開データ: 1つの紹介回が2番組（16・17）に付く。紹介回は蔵の個別ページへ直接つながる', () => {
  assert.equal(findPosukamiCard(data, { id: '17', title: 'ファミレスで隣から聞こえてくるフリーランスのモヤモヤ話' }).introductions[0].epId, 'EP-06605');
  const c15 = findPosukamiCard(data, { id: '15', title: 'おんすた【NOW AND THEN】' });
  assert.equal(c15.introductions[0].href, '/library/?ep=EP-01222'); assert.equal(c15.introductions[0].library, true);
  const c16 = findPosukamiCard(data, { id: '16', title: 'クリエイティブの反対語' }).introductions[0];
  assert.equal(c16.library, true); assert.equal(c16.href, '/library/?ep=EP-06605');   // #315 の蔵の同期で EP-06605 が蔵に入った
  assert.ok(data.cards.every((c) => c.introductions.every((i) => i.library)));   // 紹介回16件はすべて蔵の個別ページへ
  assert.equal(data.submitEnabled, false);   // 本番の受付が配置されるまでは投稿ボタンを出さない
});
test('カードとデータは ID と番組名の両方で結ぶ（並びが変わってIDがずれても別番組に付かない）', () => {
  assert.equal(findPosukamiCard(data, { id: '16', title: '別の番組' }), undefined);
  assert.ok(findPosukamiCard(data, { id: '015', title: 'おんすた 【NOW AND THEN】' }));   // 先頭の0・空白差は同じ
  assert.equal(findPosukamiCard(data, { id: '4', title: '僕たちの吹奏楽部を作ろう ～地域が支える新しい部活動のカタチ' }), undefined);   // HOLD はリンクを出さない
});
test('ポすすめ返しの欄: 古い公開データ（replies なし）でも壊れない・投稿の種類にポすすめ返しがある', () => {
  const d = parsePosukami({ schema: 1, cards: [{ podcastId: '1', podcastTitle: 'A', introductions: [], specials: [] }] });
  assert.deepEqual(d.cards[0].replies, []);
  assert.ok(section.includes('💬 ポすすめ返し'));
  assert.ok(fs.readFileSync(new URL('../app/posukami.ts', import.meta.url), 'utf8').includes('["reply",'));
});
test('壊れた・危険なデータは捨てる', () => {
  assert.equal(parsePosukami(null).cards.length, 0);
  assert.equal(parsePosukami({ schema: 2, cards: [] }).cards.length, 0);
  const bad = parsePosukami({ schema: 1, cards: [{ podcastId: '1', podcastTitle: 'x', introductions: [{ title: 't', href: 'javascript:alert(1)' }], specials: [{ title: 't', href: '/library/?ep=../../x' }] }] });
  assert.equal(bad.cards[0].introductions.length + bad.cards[0].specials.length, 0);
});
test('GitHub Pages の /asarisunowa/ 配下でも開けるよう相対パスにする', () => {
  assert.equal(posukamiHref('/library/?ep=EP-01222'), 'library/?ep=EP-01222');
  assert.equal(posukamiHref('https://omny.fm/shows/asahi/d20261116'), 'https://omny.fm/shows/asahi/d20261116');
  assert.ok(!/href="\/library\//.test(tsx), 'サイト内の蔵リンクに先頭 / を使わない');
});
test('NEW は掲載・検証日から14日だけ', () => {
  assert.equal(isPosukamiNew('2026-11-17', new Date('2026-11-20T00:00:00+09:00')), true);
  assert.equal(isPosukamiNew('2026-10-01', new Date('2026-11-20T00:00:00+09:00')), false);
  assert.equal(isPosukamiNew('', new Date()), false);
  assert.equal(formatPosukamiDate('2026-10-20'), '2026年10月20日');
});
test('投稿: 回のURLだけ通す・送信先は別の種別・受付IDが無ければ完了と言わない', () => {
  assert.equal(looksLikeEpisodeUrl('https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616'), true);
  assert.equal(looksLikeEpisodeUrl('https://open.spotify.com/show/3OfXRilYnsDfqt5idrtoku'), false);
  const u = new URL(posukamiSubmitUrl('https://script.google.com/macros/s/X/exec', { podcastId: '016', podcastTitle: 'クリエイティブの反対語', url: ' https://omny.fm/shows/asahi/d20261116 ', relation: 'donut_guest' }));
  assert.equal(u.searchParams.get('type'), 'posukamiSubmit'); assert.equal(u.searchParams.get('podcastId'), '16'); assert.equal(u.searchParams.get('url'), 'https://omny.fm/shows/asahi/d20261116');
  assert.equal(posukamiResultMessage({ ok: true, receiptId: 'PK-1' }).ok, true);
  assert.equal(posukamiResultMessage({ ok: true }).ok, false);
  assert.equal(posukamiResultMessage({ ok: false, error: 'type は playlist / podcast / listenerPodcast / resolve を指定してください' }).ok, false);
  assert.equal(posukamiResultMessage(undefined).ok, false);
});
test('既存カードの保全: 番組名・配信者・アートワーク・紹介配信日・配信先リンク・並び替え・新規登録フォームがそのまま', () => {
  for (const s of ['<h3>{p.title}</h3>', '<p>by {p.maker}</p>', 'p.artwork ? <img src={p.artwork}', '紹介配信日 {p.introduced}', 'sortPodcastLinks(p.links).map', 'listenerPodcastSort === "new"', 'onSubmit={(e) => submitPlaylist(e, "listenerPodcast")}', 'view === "podcasts" ? (']) assert.ok(tsx.includes(s), s);
  assert.ok(!tsx.includes('POSUSUME_VERIFIED_EPISODES'), '紹介元のハードコードを恒久設計にしない');
  assert.ok(tsx.includes('<PosukamiCardSection'));
  assert.ok(!section.includes('submitPlaylist') && section.includes('posukamiSubmitUrl'), '新規番組登録とは別の経路');
  assert.ok(section.includes('if (sending) return'), '二重送信の防止');
});
test('生成: CSV（引用符・改行）を読み、見出しを外す', () => {
  assert.deepEqual(parseCsv('a,"b,c","d""e"\n1,"x\ny",3'), [['a', 'b,c', 'd"e'], ['1', 'x\ny', '3']]);
  assert.equal(rowsFrom('種別,番組ID\nINTRO,1').length, 1);
  const j = build({ rows: [['SPECIAL', '1', 'A', 't', '', '2026-01-01', 'https://x.example/a', 'other', '', '2026-01-02', '', 'k', ''], ['SPECIAL', '1', 'A', 't', '', '2026-01-01', 'https://x.example/a', 'other', '', '2026-01-02', '', 'k', '']], podcasts: [{ id: '1', title: 'A' }], library: {}, submitEnabled: false });
  assert.equal(j.cards[0].specials.length, 1);   // 同じ照合キーは一度だけ
});
