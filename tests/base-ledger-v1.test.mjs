import test from 'node:test'; import assert from 'node:assert/strict';
import { buildPlatformLinks, buildBaseView, classifyExclusion, classifyRedistribution, checkInvariants, mapP15State, LINK_STATUS, BASE_V1_HEADERS, classifyColumn, scanSource } from '../scripts/lib/base-ledger.mjs';

const U1 = '1e3bd144-9b57-451a-93cf-ac0e00e74446', U2 = '50382bb4-3af3-4250-8ddc-ac0f0033ceb5';
const mk = (o = {}) => { const r = new Array(45).fill(''); r[0] = o.id || 'EP-00001'; r[1] = o.show || 'ニュースの現場から'; r[2] = o.title || 't'; r[3] = '2026-10-01 05:00'; r[6] = o.guid ?? 'g1'; for (const [k, v] of Object.entries(o.cols || {})) r[k] = v; return r; };
const by = (links, ep, pf) => links.find((l) => l.ep_id === ep && l.platform === pf);

test('既存の有効な個別URLは全て保全され confirmed になる', () => {
  const r = mk({ cols: { 10: 'https://listen.style/p/abc/xyz', 11: 'https://open.spotify.com/episode/4vMq8EDz2Hv9uUCKenQvhF', 12: 'https://podcasts.apple.com/jp/podcast/x/id1?i=1000', 40: 'https://music.amazon.co.jp/podcasts/7337408b/episodes/e1/slug', 41: `https://pocketcasts.com/podcasts/${U1}/${U2}`, 42: 'https://pody.jp/player/4UD5sHilP15gqAc0clXN/11r512DKMzQEFY4V5RVl', 14: 'https://www.omnycontent.com/d/clips/a/b/c/audio.mp3' } });
  const l = buildPlatformLinks([r]);
  for (const p of ['listen', 'spotify', 'apple', 'amazon', 'pocketcasts', 'pody', 'omny']) assert.equal(by(l, 'EP-00001', p).status, 'confirmed', p);
  assert.ok(checkInvariants([r], [r], { links: l }).ok);
});
test('誤リンク(番組URL・別ホスト)は自動confirmedにならずholdで原文保持', () => {
  const r = mk({ cols: { 11: 'https://open.spotify.com/show/392h0MYfvMTndEVzf2cOvC', 12: 'https://example.com/x' } });
  const l = buildPlatformLinks([r]);
  assert.equal(by(l, 'EP-00001', 'spotify').status, 'hold'); assert.equal(by(l, 'EP-00001', 'spotify').url, r[11]);
  assert.equal(by(l, 'EP-00001', 'apple').status, 'hold');
  assert.ok(checkInvariants([r], [r], { links: l }).ok, '不正URLでも消失しない');
});
test('空欄は存在しない扱いにせず再探索可能(not_found, probed=false)', () => {
  const l = buildPlatformLinks([mk()]); const x = by(l, 'EP-00001', 'spotify');
  assert.equal(x.status, 'not_found'); assert.equal(x.retryable, true); assert.equal(x.probed, false);
});
test('P15状態: 一時エラー/未対応/未発見を区別', () => {
  assert.deepEqual(mapP15State('UNAVAILABLE', 'HTTP_403'), { status: 'unavailable', retryable: true });
  assert.deepEqual(mapP15State('UNAVAILABLE', 'BUDGET_DEFERRED'), { status: 'unavailable', retryable: true });
  assert.deepEqual(mapP15State('UNAVAILABLE', 'NO_MATCH_IN_DISCOVERED_PAGE'), { status: 'not_found', retryable: true });
  assert.deepEqual(mapP15State('UNAVAILABLE', 'NOT_SUPPORTED'), { status: 'not_supported', retryable: false });
  assert.equal(mapP15State('EXISTING_VERIFIED', '').status, 'confirmed');
  for (const s of ['confirmed', 'candidate', 'hold', 'not_found', 'unavailable', 'not_supported']) assert.ok(LINK_STATUS.includes(s));
});
test('P15の探索記録(根拠・最終確認)がlinksに反映される', () => {
  const l = buildPlatformLinks([mk()], [{ 'EP-ID': 'EP-00001', SERVICE: 'Spotify', STATE: 'UNAVAILABLE', REASON: 'HTTP_403', URL: 'https://open.spotify.com/show/x', EVIDENCE_URL: 'https://e', CHECKED_UTC: '2026-10-29T00:00:00Z' }]);
  const x = by(l, 'EP-00001', 'spotify'); assert.equal(x.status, 'unavailable'); assert.equal(x.last_checked, '2026-10-29T00:00:00Z'); assert.equal(x.probed, true);
});
test('#274回帰: ポッドキャスト茶会 Spotify遅延は番組URLのみ→confirmedにせず後で再探索、個別URL到着後にconfirmed', () => {
  const before = buildPlatformLinks([mk({ show: 'ポッドキャスト茶会', cols: { 11: 'https://open.spotify.com/show/abc' } })]);
  assert.notEqual(by(before, 'EP-00001', 'spotify').status, 'confirmed');
  assert.equal(by(before, 'EP-00001', 'spotify').retryable, true);
  const after = buildPlatformLinks([mk({ show: 'ポッドキャスト茶会', cols: { 11: 'https://open.spotify.com/episode/Zz9' } })]);
  assert.equal(by(after, 'EP-00001', 'spotify').status, 'confirmed');
});
test('除外: アルキキ/AJW/朝ポキTVは番組除外、音声EPの補助YouTube URLは除外理由にせず保持', () => {
  for (const s of ['アルキキ', 'AJW', '朝ポキTV']) assert.equal(classifyExclusion(mk({ show: s })).kind, 'show');
  const aux = classifyExclusion(mk({ cols: { 14: 'https://www.omnycontent.com/d/clips/a/b/c/audio.mp3', 43: 'https://www.youtube.com/watch?v=1' } }));
  assert.equal(aux.excluded, false); assert.equal(aux.auxVideoUrls.length, 1);
  assert.equal(classifyExclusion(mk({ cols: { 43: 'https://youtu.be/abc' } })).kind, 'youtube_origin');
});
test('再配信: ルール一致のみ→HOLD候補、証拠(GUID/元URL/凍結判定)があって初めて通常表示から除外', () => {
  assert.equal(classifyRedistribution({ title: '（再）あの話' }).flag, '再配信候補(HOLD)');
  assert.equal(classifyRedistribution({ title: '（再）あの話' }).hideFromNormalDisplay, false);
  assert.equal(classifyRedistribution({ title: '（再）あの話' }, { sameGuidAs: 'EP-1' }).flag, '再配信');
  assert.equal(classifyRedistribution({ title: 'x', durationSec: 0 }).rules[0], 'duration<=0');
  for (const m of ['（ふりかえり）', '（深掘り）', '再放送です']) assert.ok(classifyRedistribution({ title: `a${m}` }).rules.includes(m));
  assert.equal(classifyRedistribution({ title: '通常回', durationSec: 600 }).flag, '');
});
test('View: 13列・EP-ID不変・入力非破壊', () => {
  const rows = [mk({ id: 'EP-00002', cols: { 11: 'https://open.spotify.com/episode/Q1', 22: '清掃済み概要' } })]; const snap = JSON.stringify(rows);
  const links = buildPlatformLinks(rows); const v = buildBaseView(rows, { links });
  assert.equal(BASE_V1_HEADERS.length, 13); assert.equal(v[0].length, 13); assert.equal(v[0][0], 'EP-00002'); assert.equal(v[0][6], 'https://open.spotify.com/episode/Q1'); assert.equal(v[0][7], '清掃済み概要');
  assert.equal(JSON.stringify(rows), snap);
});
test('不変条件: EP-ID消失/重複/URL消失/GUID重複を検出', () => {
  const a = mk({ id: 'EP-1', guid: 'G', cols: { 11: 'https://open.spotify.com/episode/Q1' } }), b = mk({ id: 'EP-2', guid: 'G' });
  const links = buildPlatformLinks([a, b]);
  assert.ok(checkInvariants([a, b], [a], { links }).errors.some((e) => /EP-ID消失/.test(e)));
  assert.ok(checkInvariants([a, b], [a, b], { links }).errors.some((e) => /GUID/.test(e)));
  assert.ok(checkInvariants([a], [a], { links: [] }).errors.some((e) => /URL消失/.test(e)));
});
test('依存棚卸し: URL関連列は削除候補/不要に分類されない', () => {
  for (const c of [8, 9, 10, 11, 12, 14, 28, 40, 41, 42, 43, 44]) assert.equal(classifyColumn(c, 0).cls, '運用必須');
  assert.notEqual(classifyColumn(30, 0).cls, '削除候補');
  assert.deepEqual(scanSource('x', "const a=row[11]; ss.getSheetByName('エピソード台帳')").tabs, ['エピソード台帳']);
});

import { classifyHumanExclude, buildParticipants, buildRelatedArticles, buildSearchIndex, searchIndex, buildDetail, lossReport, PLATFORM_ORDER, isEpisodeLevel } from '../scripts/lib/base-ledger.mjs';

test('人間除外: 本番実値「未指定」(6,511行)・空欄(120行)は除外しない(大量誤除外の回帰)', () => {
  const rows = [...Array(6511)].map((_, i) => mk({ id: `EP-${i}`, guid: `g${i}`, cols: { 38: '未指定' } })).concat([...Array(120)].map((_, i) => mk({ id: `EP-b${i}`, guid: `h${i}`, cols: { 38: '' } })));
  assert.equal(rows.filter((r) => classifyExclusion(r).excluded).length, 0);
  assert.equal(classifyExclusion(mk({ cols: { 38: '未指定' } })).holdReason, '');
  const view = buildBaseView(rows.slice(0, 3)); assert.notEqual(view[0][10], '対象外');
});
test('人間除外: 明示allowlistのみ除外、未知値は除外せずHOLD理由を付す', () => {
  assert.equal(classifyHumanExclude('除外'), 'excluded'); assert.equal(classifyHumanExclude(' なし '), 'none');
  const unk = classifyExclusion(mk({ cols: { 38: '要確認？' } })); assert.equal(unk.excluded, false); assert.match(unk.holdReason, /未知値/);
  assert.equal(buildBaseView([mk({ cols: { 38: '要確認？' } })])[0][10], '保留');
  assert.equal(classifyExclusion(mk({ cols: { 38: '除外' } })).kind, 'human');
});
test('除外: Spotify等の個別URLがあればYouTube補助のみでも youtube_origin にしない', () => {
  assert.equal(classifyExclusion(mk({ cols: { 11: 'https://open.spotify.com/episode/Q1', 43: 'https://www.youtube.com/watch?v=1' } })).excluded, false);
});
test('番組URL・RSS・チャンネル等は全プラットフォームで confirmed にならない(holdで原文保持)', () => {
  const bad = { listen: 'https://listen.style/p/tvzppbdm', spotify: 'https://open.spotify.com/show/392h0M', apple: 'https://podcasts.apple.com/jp/podcast/x/id123',
    amazon: 'https://music.amazon.co.jp/podcasts/7337408b-4752-4a85-8f27-4208a2ca8b1d/slug', pocketcasts: `https://pocketcasts.com/podcasts/${U1}`, pody: 'https://pody.jp/player/4UD5sHilP15gqAc0clXN',
    omny: 'https://www.omnycontent.com/d/playlist/1e3bd144/50382bb4/684015f9/podcast.rss', asahi: 'https://digital.asahi.com/pr/cp/2026/aut/?ref=x', youtube: 'https://www.youtube.com/channel/UCxxxx' };
  for (const [k, u] of Object.entries(bad)) assert.equal(isEpisodeLevel(k, u), false, k);
  const r = mk({ cols: { 10: bad.listen, 11: bad.spotify, 12: bad.apple, 40: bad.amazon, 41: bad.pocketcasts, 42: bad.pody, 14: bad.omny, 43: bad.youtube, 9: bad.asahi } });
  const l = buildPlatformLinks([r]);
  for (const l1 of l.filter((x) => x.url)) assert.notEqual(l1.status, 'confirmed', l1.platform);
  assert.ok(checkInvariants([r], [r], { links: l }).ok);
  for (const k of Object.keys(bad)) assert.ok(l.some((x) => x.platform === k && x.retryable), `${k} 再探索可能`);
});
test('個別EP URLの実例形は confirmed(Omny音声/Megaphone/Asahi/YouTube)', () => {
  assert.ok(isEpisodeLevel('omny', 'https://traffic.megaphone.fm/ABC123.mp3'));
  assert.ok(isEpisodeLevel('asahi', 'https://www.asahi.com/articles/ASVB64TL1VB6UTFL01CM.html'));
  assert.ok(isEpisodeLevel('youtube', 'https://youtu.be/abc123'));
  assert.ok(isEpisodeLevel('pocketcasts', 'https://pca.st/episode/' + U1));
});
test('URLは固定順(朝日→Omny→LISTEN→Spotify→Apple→Amazon→PocketCasts→Pody→YouTube)で出力', () => {
  assert.deepEqual(PLATFORM_ORDER, ['asahi', 'omny', 'listen', 'spotify', 'apple', 'amazon', 'pocketcasts', 'pody', 'youtube']);
  const l = buildPlatformLinks([mk()]); assert.deepEqual(l.map((x) => x.platform), PLATFORM_ORDER);
});
test('出演者: AT〜AX優先+AY根拠保持、Xは原文を別保持、個別列が空ならX候補。同名異人を推測統合しない', () => {
  const r = mk({ cols: { 23: 'ゲスト 山田太郎 https://x.example/p', 45: '山田太郎', 46: '山田太郎(別人・同姓同名)', 47: '佐藤花子', 50: '公式ページ記載' } });
  const p = buildParticipants(r); assert.deepEqual(p.names, ['山田太郎', '山田太郎(別人・同姓同名)', '佐藤花子']);
  assert.equal(p.evidence, '公式ページ記載'); assert.match(p.castRaw, /ゲスト/); assert.equal(p.source, 'AT-AX');
  assert.equal(buildParticipants(mk({ cols: { 23: '解説 田中' } })).source, 'X-raw-candidate');
  assert.equal(buildBaseView([r])[0][8], '山田太郎 / 山田太郎(別人・同姓同名) / 佐藤花子');
});
const DESC = '本日の話題です。\n【関連記事】\n高市首相の所信表明\nhttps://www.asahi.com/articles/AAA111.html\nAI規制の行方\nhttps://www.asahi.com/articles/BBB222.html\nご意見はこちら';
test('関連記事: 見出し↔URLの対応と順序を維持、AC列URLも失わない', () => {
  const r = mk({ cols: { 21: DESC, 28: 'https://www.asahi.com/articles/AAA111.html https://www.asahi.com/articles/CCC333.html' } });
  const a = buildRelatedArticles(r);
  assert.deepEqual(a.map((x) => [x.title, x.url.replace(/\?.*/, '')]), [['高市首相の所信表明', 'https://www.asahi.com/articles/AAA111.html'], ['AI規制の行方', 'https://www.asahi.com/articles/BBB222.html'], ['', 'https://www.asahi.com/articles/CCC333.html']]);
  assert.deepEqual(a.map((x) => x.order), [0, 1, 2]); assert.ok(a.every((x) => x.source));
});
test('検索: タイトルに無い語でも概要・出演者・関連記事見出しでヒット。除外EPは外せる', () => {
  const a = mk({ id: 'EP-A', title: '朝のニュース', cols: { 22: '宇宙ステーションの話', 21: DESC, 45: '田中一郎' } }), b = mk({ id: 'EP-B', guid: 'g2', title: '別の回', cols: { 22: '料理' } });
  const idx = buildSearchIndex([a, b]);
  assert.deepEqual(searchIndex(idx, '宇宙ステーション'), ['EP-A']); assert.deepEqual(searchIndex(idx, '田中一郎'), ['EP-A']);
  assert.deepEqual(searchIndex(idx, 'ＡＩ規制'), ['EP-A'], '全角→NFKC正規化'); assert.deepEqual(searchIndex(idx, '所信表明 朝のニュース'), ['EP-A']);
  assert.deepEqual(searchIndex(idx, '料理', { excludedIds: new Set(['EP-B']) }), []);
  assert.deepEqual(searchIndex(idx, 'AAA111'), ['EP-A'], 'URL/IDは別フィールドで引ける');
  assert.deepEqual(searchIndex(idx, '田中二郎'), [], '同姓違いで混線しない');
});
test('概要: 原文・清掃済みの双方を保持・索引化(清掃で失われた語も原文から検索可)', () => {
  const r = mk({ cols: { 21: '原文だけにある固有名詞「ゼータ計画」 https://forms.gle/x', 22: '清掃済み本文' } });
  const d = buildDetail([r]); assert.equal(d[0].descRaw, r[21]); assert.equal(d[0].descClean, r[22]);
  assert.deepEqual(searchIndex(buildSearchIndex([r]), 'ゼータ計画'), ['EP-00001']);
});
test('情報損失0: タイトル/概要/出演者/根拠/関連URL/配信先URLの非空セルが全て生成物にある。欠損は検出される', () => {
  const rows = [mk({ id: 'EP-1', title: 'T', cols: { 21: DESC, 22: 'W', 23: 'X役割', 45: 'A', 46: 'B', 50: 'E', 28: 'https://www.asahi.com/articles/CCC333.html', 11: 'https://open.spotify.com/episode/Q1', 9: 'https://www.asahi.com/articles/ASVB64TL1VB6UTFL01CM.html' } }), mk({ id: 'EP-2', guid: 'g2' })];
  const links = buildPlatformLinks(rows), detail = buildDetail(rows, links), index = buildSearchIndex(rows), view = buildBaseView(rows, { links });
  const rep = lossReport(rows, { links, detail, index, view }); assert.equal(rep.totalLoss, 0, JSON.stringify(rep.lossExamples)); assert.ok(rep.ok);
  const broken = detail.map((d) => ({ ...d, descRaw: '', participants: { ...d.participants, names: [] } }));
  assert.ok(lossReport(rows, { links, detail: broken, index, view }).totalLoss > 0);
  assert.ok(lossReport(rows, { links: [], detail, index, view }).loss.platformUrls > 0);
});
test('原本非破壊: 全生成関数は入力の55列を変更しない', () => {
  const rows = [mk({ id: 'EP-1', cols: { 21: DESC, 45: 'A', 11: 'https://open.spotify.com/episode/Q1' } })]; const snap = JSON.stringify(rows), len = rows[0].length;
  const links = buildPlatformLinks(rows); buildDetail(rows, links); buildSearchIndex(rows); buildBaseView(rows, { links }); buildRelatedArticles(rows[0]);
  assert.equal(JSON.stringify(rows), snap); assert.equal(rows[0].length, len);
});

test('実値形(本番台帳I/J/L列の実測形): 朝日item(UUID/TASC)・Omny/pdst・Spotifyは個別EPとconfirmed、YouTube元ページ/Apple番組はholdで保持', () => {
  const r = mk({ cols: { 9: 'https://www.asahi.com/special/podcasts/item/?itemid=2f7b650a-34a7-44ab-b232-b471005d6654', 8: 'https://omny.fm/shows/asahi/polirebi14', 11: 'https://open.spotify.com/episode/7CqHaZnKM5bGq6rhjuW1ka' } });
  const l = buildPlatformLinks([r]); assert.equal(by(l, 'EP-00001', 'asahi').status, 'confirmed'); assert.equal(by(l, 'EP-00001', 'omny').url, r[8]); assert.equal(by(l, 'EP-00001', 'omny').status, 'confirmed');
  assert.ok(isEpisodeLevel('asahi', 'https://www.asahi.com/special/podcasts/item/?itemid=TASC5101610336'));
  assert.ok(!isEpisodeLevel('asahi', 'https://www.asahi.com/special/podcasts/item/?itemid=')); assert.ok(isEpisodeLevel('omny', 'https://pdst.fm/e/traffic.megaphone.fm/TASC1.mp3'));
  const y = mk({ cols: { 8: 'https://www.youtube.com/watch?v=abc', 9: '' } }); const ly = buildPlatformLinks([y]);
  assert.ok(ly.some((x) => x.url === y[8] && x.status === 'hold')); assert.ok(checkInvariants([y], [y], { links: ly }).ok);
});
