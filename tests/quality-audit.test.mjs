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
