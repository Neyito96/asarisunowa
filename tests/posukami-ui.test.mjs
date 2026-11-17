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
  assert.equal(data.submitEnabled, true);   // #315: 本番の受付（専用デプロイ）で投稿→承認→表示を確かめたので有効
});
test('カードとデータは ID と番組名の両方で結ぶ（並びが変わってIDがずれても別番組に付かない）', () => {
  assert.equal(findPosukamiCard(data, { id: '16', title: '別の番組' }), undefined);
  assert.ok(findPosukamiCard(data, { id: '015', title: 'おんすた 【NOW AND THEN】' }));   // 先頭の0・空白差は同じ
  assert.equal(findPosukamiCard(data, { id: '4', title: '僕たちの吹奏楽部を作ろう ～地域が支える新しい部活動のカタチ' }).introductions[0].epId, 'EP-05473');   // 概要の「紹介したポッドキャストは「僕たちの吹部を作ろう…」」で確定
  assert.equal(findPosukamiCard(data, { id: '12', title: 'ネジネジ低空飛行 — ゆるバイポーラー thinking aloud —' }).introductions[0].epId, 'EP-00286');   // 管理人判断: 紹介配信日のドーナツ側の日曜版
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
  assert.ok(section.includes('if (sending || !mode) return'), '二重送信の防止');
});
test('生成: CSV（引用符・改行）を読み、見出しを外す', () => {
  assert.deepEqual(parseCsv('a,"b,c","d""e"\n1,"x\ny",3'), [['a', 'b,c', 'd"e'], ['1', 'x\ny', '3']]);
  assert.equal(rowsFrom('種別,番組ID\nINTRO,1').length, 1);
  const j = build({ rows: [['SPECIAL', '1', 'A', 't', '', '2026-01-01', 'https://x.example/a', 'other', '', '2026-01-02', '', 'k', ''], ['SPECIAL', '1', 'A', 't', '', '2026-01-01', 'https://x.example/a', 'other', '', '2026-01-02', '', 'k', '']], podcasts: [{ id: '1', title: 'A' }], library: {}, submitEnabled: false });
  assert.equal(j.cards[0].specials.length, 1);   // 同じ照合キーは一度だけ
});

test('3種類とも、回のタイトル自体がリンク（冗長な「→ …」の文言は出さない）', () => {
  for (const label of ['🎙 紹介された回', '💬 ポすすめ返し', '✨ ポす神回']) assert.ok(section.includes(label), label);
  assert.ok(!/→ 朝ポキの蔵でこの回を見る|→ この回を聴く/.test(section));
  assert.ok(/className="posukamiTitleLink" href=\{posukamiHref\(episode\.href\)\}/.test(section));
  assert.ok(/\{episode\.title\}/.test(section.slice(section.indexOf('posukamiTitleLink'))));
  const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.posukamiTitleLink:focus-visible') && css.includes('.posukamiTitleLink:hover'));
});
test('ポすすめ返し: 奥会津、風のラジオ #25 と クリエイティブの反対語 #407（公式の回ページ）。既存の紹介回・ポす神回はそのまま', () => {
  const c13 = findPosukamiCard(data, { id: '13', title: '奥会津、風のラジオ' }), c16 = findPosukamiCard(data, { id: '16', title: 'クリエイティブの反対語' });
  assert.deepEqual(c13.replies.map((r) => [r.title, r.date, r.href]), [['#25 [番外編]ポすすめ返し、ポすすめ送り', '2026-09-19', 'https://podcasts.apple.com/jp/podcast/id1893309443?i=1000790701683']]);
  assert.deepEqual(c16.replies.map((r) => [r.title, r.date]), [['#407 朝ポキで紹介してもらった！！', '2026-10-25']]);
  assert.equal(c13.introductions[0].epId, 'EP-00120'); assert.equal(c16.introductions[0].epId, 'EP-06605'); assert.equal(c16.specials.length, 2);
  const all = data.cards.flatMap((c) => [...c.introductions, ...c.replies, ...c.specials].map((e) => c.podcastId + '|' + e.href));
  assert.equal(new Set(all).size, all.length);   // 重複なし
});
test('URL一発投稿: URL欄と投稿ボタンだけ。種類はボタンで自動（reply / other）、番組はカードから。名前・メールは聞かない', () => {
  assert.ok(section.includes('💬 この番組の「ポすすめ返し」を教える') && section.includes('✨ ポす神回を教える'));
  assert.ok(section.includes('placeholder="エピソードのURLを貼り付け"') && section.includes('"投稿する"'));
  assert.ok(!/<select|<textarea|type="date"|type="email"/.test(section));
  assert.ok(/relation: mode/.test(section) && /podcastId: podcast\.id, podcastTitle: podcast\.title/.test(section));
  assert.ok(section.includes('sent.includes(u)'));   // 同じURLの二重送信を止める
  for (const u of ['https://stand.fm/episodes/69df8fe3828ab6b195a8cd0f', 'https://music.amazon.co.jp/podcasts/0b4f1c2e-1111-2222-3333-444455556666/episodes/0b4f1c2e-1111-2222-3333-444455556667', 'https://youtu.be/abcdefghijk', 'https://pca.st/episode/b6bf1bce-30a6-405c-a6f7-7da3e13f5c3a']) assert.equal(looksLikeEpisodeUrl(u), true, u);
  assert.equal(data.submitEnabled, true);
});
test('本番接続: 投稿先は専用デプロイ、同期ジョブは本番GASの公開データを読む。ながらcast の返しは実機試験で承認済み', () => {
  const ts = fs.readFileSync(new URL('../app/posukami.ts', import.meta.url), 'utf8'), wf = fs.readFileSync(new URL('../.github/workflows/sync-playlists.yml', import.meta.url), 'utf8');
  const ep = ts.match(/POSUKAMI_SUBMIT_ENDPOINT = "([^"]+)"/)[1];
  assert.match(ep, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  assert.ok(tsx.includes('endpoint={POSUKAMI_SUBMIT_ENDPOINT}'));
  assert.ok(wf.includes(ep + '?type=posukamiPublic') && wf.includes('--submit-enabled'));
  const c20 = findPosukamiCard(data, { id: '20', title: 'ながらcast' });
  assert.equal(c20.replies[0].href, 'https://podcasts.apple.com/jp/podcast/id1489885503?i=1000801226425');
});
