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
test('前回「同一性保留」でV2が解決済みの回だけ回収する。再配信・対象外は戻さない', () => {
  const ds = [{ id: 'EP-00011', publication: '保留', classification: '同一性保留' }, { id: 'EP-00012', publication: '保留', classification: '再配信候補' }, { id: 'EP-00013', publication: '対象外', classification: '再配信' }, { id: 'EP-00014', publication: '保留', classification: '同一性保留' }];
  const plan = planSync({ old: new Map(), decisions: ds, v2: [row('EP-00011'), row('EP-00012'), row('EP-00013'), row('EP-00014')], resolved: ['EP-00011', 'EP-00012', 'EP-00013'] });
  assert.deepEqual(plan.add.map((e) => e.id), ['EP-00011']);
  assert.deepEqual(plan.protectedIds.sort(), ['EP-00012', 'EP-00013', 'EP-00014']);
  const next = nextDecisions({ source: { rawReadSHA256: 'x' }, decisions: ds }, plan, 'h', 'now');
  assert.equal(next.decisions.find((d) => d.id === 'EP-00011').publication, '対象');
  assert.equal(next.decisions.find((d) => d.id === 'EP-00012').publication, '保留');
});
