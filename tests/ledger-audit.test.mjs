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
  assert.deepEqual(officialUrlCandidate({ officialUrl: '', guid: g }), { status: 'CANDIDATE', url: 'https://www.asahi.com/special/podcasts/item/?itemid=' + g, guid: g });
  assert.equal(officialUrlCandidate({ officialUrl: 'https://x', guid: g }).status, 'HAS_VALUE'); assert.equal(officialUrlCandidate({ officialUrl: '', guid: '' }).status, 'NO_GUID');
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
