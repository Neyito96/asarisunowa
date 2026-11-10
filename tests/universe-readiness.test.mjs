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

import { stripKnownFooters } from '../scripts/lib/readiness.mjs';
test('段階1: 既知の定型フッターだけを完全一致で除去(本文・URL付き関連記事は不変)、原文は変更しない', () => {
  const body = '本日のテーマは宇宙です。 【関連記事】 記事A https://www.asahi.com/articles/AAA.html';
  const src = `${body} ご意見・感想・リクエスト https://bit.ly/x ほかにも多彩な番組を配信中！ http://t.asahi.com/y See omnystudio.com/listener for privacy information.`;
  const r = stripKnownFooters(src); assert.equal(r.text, body); assert.deepEqual(r.removed.map((x) => x.id).sort(), ['asapoki-feedback', 'omny-privacy']);
  assert.equal(src.includes('omnystudio'), true, '入力文字列は不変');
  assert.equal(stripKnownFooters(`${body} Learn more about your ad choices. Visit megaphone.fm/adchoices`).text, body);
  assert.equal(stripKnownFooters(`${body} 【おねがい】 朝日新聞ポッドキャストは、みなさまからの購読料で配信しています。 番組継続のため、会員登録をお願いします！`).text, body);
  assert.equal(stripKnownFooters(`${body} ご意見・感想・リクエスト ⁠⁠https://bit.ly/x ⁠ほかにも多彩な番組を配信中！ ⁠https://t.asahi.com/y`).text.includes('ご意見'), false, 'ゼロ幅文字入りも除去');
});
test('段階1: フッターだけの概要は空にせず元のまま(blockedEmpty)、イベント告知のフォームURLなど本文中のURLは触らない', () => {
  const only = 'See omnystudio.com/listener for privacy information.'; const r = stripKnownFooters(only); assert.equal(r.text, only); assert.equal(r.blockedEmpty, true);
  const ev = 'グッズ配布中 https://forms.gle/AbC123 ※収録しました'; assert.equal(stripKnownFooters(ev).text, ev); assert.deepEqual(stripKnownFooters(ev).removed, []);
});
