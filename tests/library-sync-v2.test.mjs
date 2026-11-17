import test from 'node:test';
import assert from 'node:assert/strict';
import { planSync, nextDecisions, platformLinks, LIMITS } from '../scripts/library-sync-v2.mjs';

const row = (id, extra = {}) => ({ 'EP-ID': id, 番組: 'A', タイトル: 't' + id, '配信日時 JST': '2026-11-16 05:00', 掲載判定: '対象', Spotify: 'https://open.spotify.com/episode/' + id, ...extra });
const pub = (id, links = []) => [id, { id, show: 'A', title: 'old' + id, date: '2026-01-01', links }];

test('既存の公開内容は書き換えず、新着だけ足す。前回保留・対象外の回は出さない', () => {
  const old = new Map([pub('EP-00001')]);
  const plan = planSync({ old, decisions: [{ id: 'EP-00003', publication: '保留' }], v2: [row('EP-00001'), row('EP-00002'), row('EP-00003')] });
  assert.ok(plan.ok);
  assert.equal(plan.keep[0].title, 'oldEP-00001');
  assert.deepEqual(plan.add.map((e) => e.id), ['EP-00002']);
  assert.deepEqual(plan.protectedIds, ['EP-00003']);
});
test('台帳から大量に消えたら止まる', () => {
  const old = new Map(Array.from({ length: LIMITS.maxRemovals + 5 }, (_, i) => pub('EP-' + String(i + 1).padStart(5, '0'))));
  const plan = planSync({ old, decisions: [], v2: [] });
  assert.equal(plan.ok, false);
});
test('重複EP-ID・対象以外の行・番組名の変化で止まる', () => {
  assert.equal(planSync({ old: new Map(), decisions: [], v2: [row('EP-00001'), row('EP-00001')] }).ok, false);
  assert.equal(planSync({ old: new Map(), decisions: [], v2: [row('EP-00001', { 掲載判定: '保留' })] }).ok, false);
  assert.equal(planSync({ old: new Map([pub('EP-00001')]), decisions: [], v2: [row('EP-00001', { 番組: 'B' })] }).ok, false);
});
test('2回目は変化なし（同じ台帳なら同じ結果）', () => {
  const p1 = planSync({ old: new Map(), decisions: [], v2: [row('EP-00002')] });
  const old = new Map(p1.add.map((e) => [e.id, e]));
  const p2 = planSync({ old, decisions: nextDecisions({ source: { rawReadSHA256: 'x' }, decisions: [] }, p1, 'h', 'now').decisions, v2: [row('EP-00002')] });
  assert.equal(p2.add.length, 0); assert.equal(p2.linkAdded.length, 0); assert.equal(p2.removed.length, 0);
});
test('配信リンクは台帳にある実URLだけ（推測で作らない）', () => {
  const links = platformLinks(row('EP-00009', { Apple: 'javascript:alert(1)', 公式個別URL: '' }));
  assert.deepEqual(links, ['https://open.spotify.com/episode/EP-00009']);
});
