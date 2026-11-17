// HA-1 概要欄HOLD監査（#308）: GAS に貼る生成ファイルを vm で読み、判定を確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../scripts/summary-hold-audit/dist/HoldAudit.gs', import.meta.url), 'utf8');
const ctx = { module: { exports: {} } }; vm.runInNewContext(src, ctx);
const H = ctx.module.exports, J = (x) => JSON.parse(JSON.stringify(x));
const raw = '新年度の旅行の話です。 ※2026年4月10日に収録しました 【関連記事】 本屋大賞に朝井リョウさん 書店員が投票 https://www.asahi.com/articles/ASV490PH4V49UCVL01MM.html?iref=omny 【出演・スタッフ】 神田大介（MC） https://bit.ly/4k4ZKwA';
test('原文が空なら原文未取得（推測で埋めない）', () => {
  const j = H.haJudge({ ep: 'EP-1', raw: '' }, '');
  assert.equal(j.cls, '原文未取得');
});
test('保存SHAと違えば人間確認', () => {
  assert.equal(H.haJudge({ ep: 'EP-1', raw, rawSha: 'abc' }, 'def').cls, '人間確認必要');
});
test('整形できて、本文・関連記事が原文の中にあり、SC4-18と記事が一致すれば自動修正可能', () => {
  const j = H.haJudge({ ep: 'EP-1', raw, rawSha: '', cast: '神田大介', sc418Json: JSON.stringify([{ title: '本屋大賞に朝井リョウさん 書店員が投票', url: 'https://www.asahi.com/articles/ASV490PH4V49UCVL01MM.html' }]) }, 'x');
  assert.equal(j.cls, '自動修正可能', j.fails && j.fails.join());
  assert.equal(j.tidy.recordedAt, '2026年4月10日');
  assert.equal(j.tidy.related[0].title, '本屋大賞に朝井リョウさん 書店員が投票');
});
test('SC4-18にある記事を落とした・出演者の重複は人間確認', () => {
  const a = H.haJudge({ ep: 'EP-1', raw, sc418Json: JSON.stringify([{ url: 'https://www.asahi.com/articles/OTHER.html' }]) }, 'x');
  assert.equal(a.cls, '人間確認必要'); assert.ok(a.fails.includes('SC4-18にある記事を整形が落とした'));
  const b = H.haJudge({ ep: 'EP-1', raw, cast: '神田大介；神田 大介（MC）' }, 'x');
  assert.deepEqual(J(b.castDup), ['神田大介']);
});
test('集計は分類と原因ごとの件数と代表例', () => {
  const js = [{ ep: 'A', cls: 'X', cause: 'c' }, { ep: 'B', cls: 'X', cause: 'c' }, { ep: 'C', cls: 'Y', cause: 'd' }];
  const s = J(H.haSummary(js, 3));
  assert.deepEqual(s.byClass, { X: 2, Y: 1 }); assert.deepEqual(s.byCause[0], ['X｜c', 2, 'A B']);
  assert.equal(H.haRowOut(H.haJudge({ ep: 'E', raw: '' }, ''), 'HA-1', 't').length, H.HA_ROW_H.length);
});
test('HA-2: 原文のHTML（Omnyの分割リンク）を文字列にしてから整形する。原文に無い字を足さない', () => {
  const html = '<p>においの話です&hellip;。<br><br>【関連記事】<br>米作りを教える側に　言葉のグルーヴ <a href="https://www.asahi.com/articles/ASV1.html?iref=omny">https://www.asahi.com/articles/ASV1.html</a><a href="https://www.asahi.com/articles/ASV1.html?iref=omny">?iref=omny</a><a href="https://www.asahi.com/articles/ASV1.html?iref=omny"></a><br>痛み包み込み癒やす、真珠貝<br><a href="https://www.asahi.com/articles/ASV2.html?iref=omny"> https://www.asahi.com/articles/ASV2.html</a><a href="https://www.asahi.com/articles/ASV2.html?iref=omny">?iref=omny</a><br><br></p> <p>【出演・スタッフ】<br>近藤康太郎（MC）<a href="https://bit.ly/x">https://bit.ly/x</a></p>';
  const text = H.haHtmlToText(html);
  assert.ok(!/<|&hellip;/.test(text)); assert.equal((text.match(/ASV1\.html/g) || []).length, 1);
  const j = H.haJudge({ ep: 'EP-00106', raw: html }, 'x');
  assert.equal(j.cls, '自動修正可能', (j.fails || []).join());
  assert.deepEqual(J(j.tidy.related.map((r) => r.title)), ['米作りを教える側に 言葉のグルーヴ', '痛み包み込み癒やす、真珠貝']);
  assert.equal(j.tidy.body, 'においの話です…。');
});
