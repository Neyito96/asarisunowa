import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceOf, auditInternal, titleMatches, summarize } from '../scripts/audit/quality-audit.mjs';

test('URL の形: 各サービスの個別回の形を見分ける', () => {
  assert.deepEqual(serviceOf('https://open.spotify.com/episode/0ZbG92Q53KUKBBYecMoMA2'), { key: 'spotify', ok: true });
  assert.equal(serviceOf('https://open.spotify.com/show/7vuSolzvNiNwu7UR4lVIwU').ok, false);
  assert.equal(serviceOf('https://www.asahi.com/special/podcasts/item/?itemid=TASC3901369213').ok, true);
  assert.equal(serviceOf('https://pody.jp/player/4UD5sHilP15gqAc0clXN/11r512DKMzQEFY4V5RVl').ok, true);
  assert.equal(serviceOf('https://podcasts.apple.com/jp/podcast/id1592938106').ok, false);   // 番組トップ
  assert.equal(serviceOf('not a url').key, 'invalid');
});

test('内部監査: 別の回と同じ URL・空欄・既知の移転を判定し、未検証を正常にしない', () => {
  const eps = [
    { id: 'EP-1', show: 'A', title: 'あ #1', date: '2026-01-01', cast: '甲', description: '本文です。'.repeat(10), duration: 100, links: ['https://podcasts.apple.com/jp/podcast/x/id1?i=1000'] },
    { id: 'EP-2', show: 'A', title: 'い #2', date: '2026-01-02', cast: '', description: '', duration: 0, links: ['https://podcasts.apple.com/jp/podcast/x/id1?i=1000'] },
    { id: 'EP-3', show: 'SDGsを話そう', title: 'う', date: '2025-01-01', cast: '乙', description: '本文です。'.repeat(10), duration: 9, links: ['https://open.spotify.com/episode/0ZbG92Q53KUKBBYecMoMA2'] },
  ];
  const r = auditInternal({ eps, manifest: { total: 3, version: 'v' }, uchu: { libraryVersion: 'old' } });
  const kinds = r.items.map((x) => `${x.ep}:${x.kind}:${x.status}`);
  assert.ok(kinds.includes('EP-2:別の回と同じ URL:FAIL'));
  assert.ok(kinds.includes('EP-2:概要欄が空:REVIEW') && kinds.includes('EP-2:出演者が空:REVIEW') && kinds.includes('EP-2:再生時間が0または空:REVIEW'));
  assert.ok(kinds.includes('EP-3:配信先の移転:FAIL'));
  assert.ok(!r.items.some((x) => x.status === 'PASS'));   // 確かめていない URL を PASS にしない
  assert.equal(r.global.find((g) => g.check === '宇宙と蔵の版').status, 'FAIL');
  const s = summarize({ eps, manifest: { snapshotDate: 'd', version: 'v' } }, r, [], null);
  assert.equal(s.urlRegistration.find((x) => x.key === 'amazon').rate, 0);
});

test('題名の照合: 番号・記号の違いは同じ、別の回は違う', () => {
  assert.ok(titleMatches('（World Insight #8）「VIVANT」はリアルだった？ タイ警察、', '（World Insight #8）「VIVANT」はリアルだった？ タイ警察、汚職文化の現実'));
  assert.ok(!titleMatches('ハチ #21【本編】どうしてハチはかっこいいの？', '保釈'));
});

test('P2 #403: 表示される概要欄（整形後）と出演者欄を見る', () => {
  const body = '本編の説明です。'.repeat(12);
  const eps = [
    { id: 'EP-10', show: 'A', title: 'か', date: '2026-01-01', cast: '甲', description: body + ' 見逃しはこちら &darr;', duration: 1, links: [] },
    { id: 'EP-11', show: 'A', title: 'き', date: '2026-01-02', cast: '乙 / 【シリーズ「カガク」】 過去の番組一覧はこちら', description: body, duration: 1, links: [] },
    { id: 'EP-12', show: 'B', title: 'く', date: '2026-01-03', cast: '丙', description: body, duration: 1, links: [] },
    { id: 'EP-13', show: 'B', title: 'け', date: '2026-01-04', cast: '松原由幸（編集長）、大木理恵子（MC）、杢田光（音源編集）', description: '別の本文。'.repeat(20), duration: 1, links: [] },
    { id: 'EP-14', show: 'B', title: 'こ', date: '2026-01-05', cast: '丁', description: '別の本文二。'.repeat(20), duration: 1, links: [] },
  ];
  const r = auditInternal({ eps, manifest: { total: 5, version: 'v' } });
  const k = r.items.map((x) => `${x.ep}:${x.kind}`);
  assert.ok(k.includes('EP-10:表示される概要欄に HTML の記号（&…;）'));
  assert.ok(k.includes('EP-11:出演者欄に見出し・説明文が混入'));
  assert.ok(k.includes('EP-11:別の回と概要が同じ（取り違えの疑い）') && k.includes('EP-12:別の回と概要が同じ（取り違えの疑い）'));
  assert.ok(!k.some((x) => x.startsWith('EP-13:読点')));   // 「名前（肩書）、名前（肩書）」は1人ずつ読めるので対象外
  assert.ok(!k.some((x) => x.startsWith('EP-14:')));
});
