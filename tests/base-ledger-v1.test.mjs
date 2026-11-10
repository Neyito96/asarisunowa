import test from 'node:test'; import assert from 'node:assert/strict';
import { buildPlatformLinks, buildBaseView, classifyExclusion, classifyRedistribution, checkInvariants, mapP15State, LINK_STATUS, BASE_V1_HEADERS, classifyColumn, scanSource } from '../scripts/lib/base-ledger.mjs';

const mk = (o = {}) => { const r = new Array(45).fill(''); r[0] = o.id || 'EP-00001'; r[1] = o.show || 'ニュースの現場から'; r[2] = o.title || 't'; r[3] = '2026-10-01 05:00'; r[6] = o.guid ?? 'g1'; for (const [k, v] of Object.entries(o.cols || {})) r[k] = v; return r; };
const by = (links, ep, pf) => links.find((l) => l.ep_id === ep && l.platform === pf);

test('既存の有効な個別URLは全て保全され confirmed になる', () => {
  const r = mk({ cols: { 10: 'https://listen.style/p/abc/xyz', 11: 'https://open.spotify.com/episode/4vMq8EDz2Hv9uUCKenQvhF', 12: 'https://podcasts.apple.com/jp/podcast/x/id1?i=1000', 40: 'https://music.amazon.co.jp/podcasts/a/episodes/b', 41: 'https://pocketcasts.com/podcasts/a/b', 42: 'https://pody.jp/e/1', 14: 'https://www.omnycontent.com/d/x.mp3' } });
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
  const aux = classifyExclusion(mk({ cols: { 14: 'https://www.omnycontent.com/a.mp3', 28: 'https://www.youtube.com/watch?v=1' } }));
  assert.equal(aux.excluded, false); assert.equal(aux.auxVideoUrls.length, 1);
  assert.equal(classifyExclusion(mk({ cols: { 32: 'https://youtu.be/abc' } })).kind, 'youtube_origin');
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
  for (const c of [8, 9, 10, 11, 12, 14, 28, 32, 40, 41, 42]) assert.equal(classifyColumn(c, 0).cls, '運用必須');
  assert.notEqual(classifyColumn(30, 0).cls, '削除候補');
  assert.deepEqual(scanSource('x', "const a=row[11]; ss.getSheetByName('エピソード台帳')").tabs, ['エピソード台帳']);
});
