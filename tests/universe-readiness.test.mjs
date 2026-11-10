import test from 'node:test'; import assert from 'node:assert/strict';
import { checkPublicSnapshot } from '../scripts/lib/readiness.mjs';
const ep = (o = {}) => ({ id: 'EP-1', show: 'ニュースの現場から', title: 't', date: '2026-10-01T04:00:00+09:00', description: '本文', links: ['https://www.asahi.com/articles/A.html'], related: [], ...o });
test('正常データはok', () => { const r = checkPublicSnapshot([ep()], { total: 1, shows: [{ count: 1 }] }); assert.ok(r.ok); assert.equal(r.fatal, 0); });
test('除外番組(アルキキ/AJW/朝ポキTV)の混入は致命', () => { for (const s of ['アルキキ', 'AJW', '朝ポキTV']) assert.ok(!checkPublicSnapshot([ep({ show: s })]).ok); });
test('重複ID・必須欠落・件数不一致・http/不正リンクは致命', () => {
  assert.equal(checkPublicSnapshot([ep(), ep()]).counts.duplicateIds, 1); assert.equal(checkPublicSnapshot([ep({ title: '' })]).counts.missingCore, 1);
  assert.equal(checkPublicSnapshot([ep()], { total: 2, shows: [{ count: 2 }] }).counts.countMismatch, 1);
  assert.equal(checkPublicSnapshot([ep({ links: ['http://x.example/a', 'javascript:alert(1)'] })]).counts.unsafeLinks, 2);
});
test('広告・連絡先の混入と概要欠損は警告として件数化(公開判断材料、致命ではない)', () => {
  const r = checkPublicSnapshot([ep({ description: 'ご連絡は a@asahi.com Learn more about your ad choices.' }), ep({ id: 'EP-2', description: '' })]);
  assert.equal(r.counts.adResidue, 1); assert.equal(r.counts.emptyDescription, 1); assert.ok(r.ok);
});
