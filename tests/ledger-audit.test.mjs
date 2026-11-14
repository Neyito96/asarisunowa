import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlatformUrl, officialUrlCandidate, verifyOfficialPage, auditSdgs, relatedRows, playlistCounts, officialItemId } from '../scripts/ledger-v2/ledger-audit.mjs';
import { SDGS_OFFICIAL } from '../scripts/ledger-v2/sdgs-official-1092.mjs';

test('各サービスURL: 個別EPと番組トップを区別（番組トップで個別EPを代用しない）', () => {
  assert.equal(classifyPlatformUrl('Spotify', 'https://open.spotify.com/episode/7CqHaZnKM5bGq6rhjuW1ka'), 'EPISODE');
  assert.equal(classifyPlatformUrl('Spotify', 'https://open.spotify.com/show/2rNtRw2rNtRw2rNtRw2rNt'), 'SHOW_TOP');
  assert.equal(classifyPlatformUrl('Apple', 'https://podcasts.apple.com/jp/podcast/x/id1526773927?i=1000794517780&uo=4'), 'EPISODE');
  assert.equal(classifyPlatformUrl('Apple', 'https://podcasts.apple.com/jp/podcast/x/id1526773927'), 'SHOW_TOP');
  assert.equal(classifyPlatformUrl('LISTEN', 'https://listen.style/p/tvzppbdm/7m1rzjhs'), 'EPISODE'); assert.equal(classifyPlatformUrl('LISTEN', 'https://listen.style/p/tvzppbdm'), 'SHOW_TOP');
  assert.equal(classifyPlatformUrl('Pocket Casts', 'https://pca.st/episode/17496f9e-d20a-4b32-9c66-85954538a1d0'), 'EPISODE'); assert.equal(classifyPlatformUrl('Amazon', ''), 'EMPTY'); assert.equal(classifyPlatformUrl('Pody', 'https://example.com/x'), 'OTHER');
});

test('公式個別URL: 候補はGUIDがある空欄だけ・canonicalのitemidが一致した時だけ確認済み', () => {
  const g = '27b37ff5-5c04-4e90-b3f6-b4dc00603b06';
  assert.deepEqual(officialUrlCandidate({ officialUrl: '', guid: g }), { status: 'CANDIDATE', url: 'https://www.asahi.com/special/podcasts/item/?itemid=' + g, key: g, guid: g, kind: '公式GUID' });
  // Megaphone の回は UUID の GUID ではなく配信ホストIDを使う・おんさの記録URLがあれば最優先（ただし必ずこちらで確かめる）
  const mg = officialUrlCandidate({ officialUrl: '', guid: 'cfdd6178-c3bc-11f1-a625-db6a01e1862b', audioUrl: 'https://pdst.fm/e/traffic.megaphone.fm/TASC4073670976.mp3?updated=1' });
  assert.equal(mg.url, 'https://www.asahi.com/special/podcasts/item/?itemid=TASC4073670976'); assert.equal(mg.kind, 'Megaphone配信ID');
  assert.equal(officialUrlCandidate({ officialUrl: '', guid: g, onsaAsahiUrl: 'https://www.asahi.com/special/podcasts/item/?itemid=TASC1234567890' }).key, 'TASC1234567890');
  const pg = (id, body = '') => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '"><h1>' + body + '</h1>';
  assert.equal(verifyOfficialPage(200, pg('TASC4073670976', 'ICC赤根知子所長への制裁'), 'TASC4073670976', 'ICC赤根知子所長への制裁').status, 'VERIFIED');
  assert.equal(verifyOfficialPage(200, pg('TASC4073670976', '別の回'), 'TASC4073670976', 'ICC赤根知子所長への制裁').reason, 'TITLE_NOT_ON_PAGE');   // ID が合ってもタイトルが無ければ HOLD
  assert.equal(officialUrlCandidate({ officialUrl: 'https://www.asahi.com/special/podcasts/item/?itemid=' + g, guid: g }).status, 'HAS_VALUE'); assert.equal(officialUrlCandidate({ officialUrl: 'https://x', guid: g }).replaces, true); assert.equal(officialUrlCandidate({ officialUrl: '', guid: '' }).status, 'NO_GUID');
  const page = (id) => '<html><link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '"></html>';
  assert.equal(verifyOfficialPage(200, page(g), g).status, 'VERIFIED'); assert.equal(verifyOfficialPage(200, page('00000000-0000-4000-8000-000000000000'), g).status, 'HOLD');
  assert.equal(verifyOfficialPage(200, '<html>no canonical</html>', g).status, 'HOLD'); assert.equal(verifyOfficialPage(404, '', g).status, 'NOT_FOUND'); assert.equal(verifyOfficialPage(500, '', g).status, 'ERROR');
  assert.equal(officialItemId('https://www.asahi.com/special/podcasts/item/?itemid=' + g + '&iref=x'), g);
});

test('SDGs1092: 件数一致だけで合格にせず、1件ずつ採用・除外・保留・要確認と理由を出す', () => {
  assert.equal(SDGS_OFFICIAL.length, 1092); assert.equal(new Set(SDGS_OFFICIAL.map((r) => r[0])).size, 1092);
  const [a, b, c, d] = SDGS_OFFICIAL; const off = [a, b, c, d];
  const rows = [
    { row: 2, ep: 'EP-1', show: 'SDGsを話そう', title: a[1], date: a[2], judge: '対象', rep: 'EP-1', guid: a[0], officialUrl: a[3] },
    { row: 3, ep: 'EP-2', show: 'SDGsを話そう', title: b[1] + '（改題）', date: b[2], judge: '対象外', rep: 'EP-2', guid: '', officialUrl: b[3], reason: '再配信' },
    { row: 4, ep: '', show: 'SDGsを話そう', title: c[1], date: c[2], judge: '保留', rep: '', guid: c[0], officialUrl: c[3] },
    { row: 5, ep: 'EP-9', show: 'SDGsを話そう', title: '旧回 #1048', date: '2026/3/13 4:00', judge: '保留', rep: 'EP-9', guid: '', officialUrl: '' },
  ];
  const r = auditSdgs(rows, off), by = (u) => r.rows.find((x) => x[3] === u);
  assert.equal(by(a[0])[1], '採用'); assert.equal(by(b[0])[1], '除外'); assert.equal(by(b[0])[17], '公式個別URL'); assert.match(by(b[0])[18], /タイトル/);
  assert.equal(by(c[0])[1], '要確認'); assert.match(by(c[0])[2], /EP-IDのない行/); assert.equal(by(d[0])[1], '要確認'); assert.match(by(d[0])[2], /該当行なし/);
  const only = r.rows.find((x) => x[0] === '台帳のみ'); assert.equal(only[8], 'EP-9'); assert.equal(only[4], '1048');
});

test('関連記事索引: 見出しは原文から・無ければ「未取得」・URLは原文と台帳の両方を残す／番組別件数は代表EPだけ公開対象に数える', () => {
  const rr = relatedRows('EP-1', [{ title: '見出し"A"', url: 'https://a/1', originalUrl: 'https://a/1?iref=omny' }, { title: '', url: 'https://a/2' }], 'https://a/1 https://a/3');
  assert.deepEqual(rr.map((r) => [r[1], r[2], r[3], r[5]]), [['1', '見出し"A"', 'https://a/1', '概要原文（公式RSS）'], ['2', '未取得', 'https://a/2', '概要原文（公式RSS）'], ['3', '未取得', 'https://a/3', '統合台帳 関連記事URL（既存値）']]);
  assert.equal(rr[0][4], '=HYPERLINK("https://a/1","見出し""A""")'); assert.equal(rr[0][6], 'https://a/1?iref=omny');
  const pc = playlistCounts([{ ep: 'E1', show: 'X', judge: '対象', rep: 'E1', date: '2026/1/2' }, { ep: 'E2', show: 'X', judge: '対象', rep: 'E1', date: '2026/1/3' }, { ep: 'E3', show: 'X', judge: '対象外', rep: 'E3' }, { ep: '', show: 'X', judge: '保留' }]);
  assert.deepEqual(pc[0], ['X', 4, 1, 1, 1, 0, 0, 0, 1, '2026-01-02', '2026-01-03']);
});

test('関連記事の照合キー: iref・ref=omny・utm・#は外すが、id= など記事を分ける ? は残す／先頭のアポストロフィは二重にして書く', async () => {
  const { articleKey, relatedRows, sheetText } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  assert.equal(articleKey('https://www.asahi.com/articles/A.html?iref=omny'), 'https://www.asahi.com/articles/A.html'); assert.equal(articleKey('http://www.asahi.com/articles/A.html?irefomny#x'), 'https://www.asahi.com/articles/A.html');
  assert.equal(articleKey('https://www.asahi.com/articles/A.html?ref=omny&utm_source=x'), 'https://www.asahi.com/articles/A.html'); assert.equal(articleKey('https://www.asahi.com/rensai/list.html?id=2019'), 'https://www.asahi.com/rensai/list.html?id=2019');
  const rr = relatedRows('E', [{ title: 'T', url: 'https://a/A.html', originalUrl: 'https://a/A.html?iref=omny' }], 'https://a/A.html?ref=omny https://a/B.html');
  assert.deepEqual(rr.map((r) => [r[2], r[3], r[6]]), [['T', 'https://a/A.html', 'https://a/A.html?iref=omny / 台帳: https://a/A.html?ref=omny'], ['未取得', 'https://a/B.html', 'https://a/B.html']]);
  assert.equal(sheetText("'abc"), "''abc"); assert.equal(sheetText('abc'), 'abc');
});

test('L2 全台帳差分: 計算式が一致・再配信はタイトル一致だけでは確定しない（DUPLICATE候補）・同じGUIDの別EP・旧本番にだけある回・11/13以降の新着は別枠', async () => {
  const { ledgerDiff } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const P = (ep, o = {}) => ({ ep, show: 'S', title: 't' + ep, date: '2026/10/01 04:00', judge: '対象', rep: ep, guid: 'g' + ep, ...o });
  const v2 = [P('EP-1'), P('EP-2', { title: '原回 #4' }), P('EP-3', { title: '（再）原回 #4', guid: 'x3' }), P('EP-4', { title: '（再）無い話 #9', guid: 'x4' }), P('EP-5', { date: '2026/11/13 04:00' }), P('EP-6', { date: '2026/10/20 04:00' }), P('EP-7', { guid: 'gEP-1' }), P('EP-8', { judge: '対象外' })];
  const oldPub = [{ id: 'EP-1', show: 'S', title: 'tEP-1', date: '2026-10-01T04:00:00+09:00' }, { id: 'EP-2', show: 'S', title: '原回 #4', date: '2026-10-01' }, { id: 'EP-8', show: 'S', title: 'tEP-8', date: '2026-10-01' }];
  const v1 = [{ id: 'EP-1', title: 'tEP-1', date: '2026/10/01', guid: 'gEP-1' }, { id: 'EP-9', title: '旧だけ', date: '2026/09/01', guid: 'g9' }];
  const r = ledgerDiff({ oldPub, v2, v1, since: '2026-11-13' }), by = (ep) => r.rows.filter((x) => x[0] === ep).map((x) => x[1] + '/' + x[2]);
  assert.ok(Object.values(r.equation).every(Boolean)); assert.deepEqual(r.n, { oldPublic: 3, v2Public: 7, both: 2, added: 5, oldOnly: 1 });
  assert.deepEqual(by('EP-3'), ['V2にあり旧公開にない・再配信/DUPLICATE候補']); assert.deepEqual(by('EP-4'), ['V2にあり旧公開にない・再配信/HOLD']);
  assert.deepEqual(by('EP-5'), ['V2にあり旧公開にない・2026-11-13以降の新着/HOLD']); assert.deepEqual(by('EP-6'), ['V2にあり旧公開にない・新規/HOLD']);
  assert.ok(by('EP-7').includes('同じGUIDが別EP-ID/DUPLICATE')); assert.deepEqual(by('EP-8'), ['旧公開にありV2で非公開/EXCLUDE']); assert.deepEqual(by('EP-9'), ['旧本番台帳にありV2にない/ERROR']);
});

test('L2: 旧本番台帳は読むだけ（la2V1ReadOnly_ に書込・挿入・削除の呼び出しが無い）', async () => {
  const fs = await import('node:fs'); const src = fs.readFileSync('gas/summary-cleaner/src/CleanerMain.js', 'utf8');
  const body = src.slice(src.indexOf('function la2V1ReadOnly_'), src.indexOf('function L2_全台帳_差分監査'));
  assert.ok(body.length > 200); assert.ok(!/\.set[A-Z]|insert|delete|clear|appendRow|copyTo|protect/.test(body));
});

test('おんさ照合: Omny・Asahi itemid・Spotify のどれかが一致した時だけ同じ回／おんさに無い・おんさにだけある回は除外理由にしない', async () => {
  const { onsaMatch } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const v2 = [{ ep: 'EP-1', title: 'A回', sourceUrl: 'https://omny.fm/shows/asahi/a1', seconds: '600' }, { ep: 'EP-2', title: 'B回', guid: 'x', audioUrl: 'https://traffic.megaphone.fm/TASC1111111111.mp3' }, { ep: 'EP-3', title: 'C回' }, { ep: 'EP-4', title: '同じ題', sourceUrl: '' }];
  const onsa = [{ sheet: 'S', row: 3, omny: 'https://omny.fm/shows/asahi/a1/', title: 'A回', seconds: '650' }, { sheet: 'S', row: 4, asahi: 'https://www.asahi.com/special/podcasts/item/?itemid=TASC1111111111', title: 'B回' }, { sheet: 'S', row: 5, omny: 'https://omny.fm/shows/asahi/zz', title: '同じ題' }];
  const r = onsaMatch(v2, onsa), by = (k) => r.rows.filter((x) => x[1] === k).map((x) => x[0] || x[4]);
  assert.deepEqual(by('一致（差異あり）'), ['EP-1']); assert.deepEqual(by('一致'), ['EP-2']); assert.deepEqual(by('おんさに無い'), ['EP-3', 'EP-4']); assert.deepEqual(by('おんさにあり台帳に無い'), ['5']);   // タイトルが同じでも識別子が無ければ結び付けない
  assert.match(r.rows.find((x) => x[0] === 'EP-3')[11], /これだけで除外しない/);
});

test('公式ページはID・タイトル・番組・配信日の4つで照合（どれか欠けたらHOLD、日付は±1日まで）', async () => {
  const { verifyOfficialPage } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const id = 'aaaaaaaa-0000-4000-8000-000000000001', page = (d, s) => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '"><script type="application/ld+json">{"name":"' + s + '"}</script><h1>合成の回のタイトル</h1><p>' + d + '</p>';
  const v = (d, s, o) => verifyOfficialPage(200, page(d, s), id, '合成の回のタイトル', o);
  assert.equal(v('2026/10/10', 'ニュースの現場から', { show: 'ニュースの現場から', date: '2026-10-10 06:00' }).reason, 'ID_TITLE_SHOW_DATE_MATCH');
  assert.equal(v('2026/10/11', 'ニュースの現場から', { show: 'ニュースの現場から', date: '2026-10-10' }).status, 'VERIFIED');
  assert.match(v('2026/10/13', 'ニュースの現場から', { show: 'ニュースの現場から', date: '2026-10-10' }).reason, /^DATE_MISMATCH/);
  assert.equal(v('2026/10/10', 'メディアトーク', { show: 'ニュースの現場から', date: '2026-10-10' }).reason, 'SHOW_NOT_ON_PAGE');
  assert.equal(v('2026/10/10', 'ニュースの現場から', { show: 'ニュースの現場から', date: '' }).reason, 'NO_DATE_TO_MATCH');
  assert.equal(v('', 'ニュースの現場から', { show: 'ニュースの現場から', date: '2026-10-10' }).reason, 'NO_DATE_ON_PAGE');
});

test('番組照合: パンくずの番組名と前方一致、または公式ページで確かめた親番組（スポンジ等→ニュースの現場から）だけ一致。別番組はHOLD', async () => {
  const { verifyOfficialPage } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const id = 'aaaaaaaa-0000-4000-8000-000000000002', page = (prog) => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '"><script type="application/ld+json">{"itemListElement":[{"@type":"ListItem","position":4,"name":"' + prog + '","item":"x"}]}</script><p>2026/10/10</p>';
  const v = (prog, show) => verifyOfficialPage(200, page(prog), id, '', { show, date: '2026-10-10' });
  assert.equal(v('ドーナツ ～このポッドキャストはSNSです', 'ドーナツ').reason, 'ID_SHOW_DATE_MATCH');
  assert.equal(v('ニュースの現場から', 'スポンジ').reason, 'ID_SHOW_DATE_MATCH (親番組:ニュースの現場から)');
  assert.equal(v('MEDIA TALK', 'スポンジ').reason, 'SHOW_MISMATCH MEDIA TALK');
  assert.equal(v('ニュースの現場から', 'MEDIA TALK').status, 'HOLD');
});

test('おんさの日付（RFC形式・UTC）は日本時間の日付で照合／おんさ内の重複行は「台帳に無い」にしない', async () => {
  const { verifyOfficialPage, onsaMatch } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const id = 'aaaaaaaa-0000-4000-8000-000000000003', page = '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '"><p>2023/5/5</p>';
  assert.equal(verifyOfficialPage(200, page, id, '', { date: 'Thu, 04 May 2023 19:05:00 +0000' }).status, 'VERIFIED');   // UTC 5/4 19:05 = JST 5/5
  assert.match(verifyOfficialPage(200, page, id, '', { date: 'Wed, 03 May 2023 10:00:00 +0000' }).reason, /^DATE_MISMATCH/);
  const url = 'https://www.asahi.com/special/podcasts/item/?itemid=' + id;
  const r = onsaMatch([{ ep: 'EP-1', title: 't', officialUrl: url }], [{ sheet: '報談', row: 3, asahi: url, title: 't' }, { sheet: 'ニュースの現場から', row: 9, asahi: url, title: 't' }, { sheet: 'スポンジ', row: 4, asahi: 'https://www.asahi.com/special/podcasts/item/?itemid=TASC1111111111', title: 'x' }]);
  assert.deepEqual(r.count, { '一致': 1, 'おんさ内の重複（台帳にあり）': 1, 'おんさにあり台帳に無い': 1 });
});

test('公式個別URL欄に Omny のURLが入っている行も GUID から候補を作る（replaces=true・空欄補完では書かない）／パンくず4段目が「記事」なら本文で番組照合', async () => {
  const { officialUrlCandidate, verifyOfficialPage } = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const g = '5218b5c5-7f21-4089-a000-000000000001';
  const c = officialUrlCandidate({ officialUrl: 'https://omny.fm/shows/asahi/puerta25', guid: g });
  assert.equal(c.status, 'CANDIDATE'); assert.equal(c.replaces, true); assert.equal(c.key, g); assert.match(c.kind, /omny\.fm/);
  assert.equal(officialUrlCandidate({ officialUrl: 'https://www.asahi.com/special/podcasts/item/?itemid=' + g, guid: g }).status, 'HAS_VALUE');
  const page = '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + g + '"><script>{"position":4,"name":"記事"}</script><p>ニュースの現場から 2023/1/5</p>';
  assert.equal(verifyOfficialPage(200, page, g, '', { show: 'ニュースの現場から', date: '2023-01-05' }).status, 'VERIFIED');
});

test('品質監査: 関連記事は複数の見出し＋URLを保持し、見出し違い（別記事との結合）を検出', async () => {
  const LA = await import('../scripts/ledger-v2/ledger-audit.mjs');
  const fromRaw = [{ title: '一', url: 'https://www.asahi.com/articles/A1.html' }, { title: '二', url: 'https://www.asahi.com/articles/A2.html' }];
  const ok = LA.qaRelated({ ep: 'E', fromRaw, ledgerUrls: 'https://www.asahi.com/articles/A1.html https://www.asahi.com/articles/A2.html', indexRows: [['E', '1', '一', 'https://www.asahi.com/articles/A1.html'], ['E', '2', '二', 'https://www.asahi.com/articles/A2.html']] });
  assert.equal(ok.verdict, '問題なし'); assert.equal(ok.row[3], 2); assert.equal(ok.row[5], 2);
  const bad = LA.qaRelated({ ep: 'E', fromRaw, ledgerUrls: 'https://www.asahi.com/articles/A1.html?iref=x https://www.asahi.com/articles/A2.html', indexRows: [['E', '1', '別の見出し', 'https://www.asahi.com/articles/A1.html'], ['E', '2', '未取得', 'https://www.asahi.com/articles/A2.html']] });
  assert.match(bad.causes.join(), /結合の疑い/); assert.match(bad.causes.join(), /見出し未取得/); assert.ok(!/台帳の関連記事URLにない/.test(bad.causes.join()));   // iref 付きは同じ記事
});
test('品質監査: 概要は文字数減だけでは異常にしない・HTML残り/空欄/未清掃を原因別に', async () => {
  const LA = await import('../scripts/ledger-v2/ledger-audit.mjs');
  assert.equal(LA.qaSummary({ ep: 'E', raw: '<p>長い本文。' + 'あ'.repeat(500) + '</p><p>告知</p>', ledger: '長い本文。', reclean: '長い本文。', shaOk: true }).verdict, '問題なし');
  assert.match(LA.qaSummary({ ep: 'E', raw: '<p>x</p>', ledger: '<p>x</p>', reclean: 'x' }).causes.join(), /HTMLタグ残り/);
  assert.match(LA.qaSummary({ ep: 'E', raw: '<p>x</p>', ledger: '', reclean: 'x' }).causes.join(), /清掃済みが空欄/);
  assert.match(LA.qaSummary({ ep: 'E', raw: 'abc', ledger: 'abc', reclean: 'ab' }).causes.join(), /原文のまま/);
  const u = LA.qaPlatformUrls([{ ep: 'A', rep: 'A', links: { Spotify: 'https://open.spotify.com/episode/AAAAAAAAAAAAAAAAAAAAAA' } }, { ep: 'B', rep: 'A', links: { Spotify: 'https://open.spotify.com/episode/AAAAAAAAAAAAAAAAAAAAAA' } }]);
  assert.equal(u.counts['Spotify/共有・束ね済み'], 2); assert.equal(u.counts['Spotify/EPISODE'], 2);
});
