// 原文の補完・更新の判定（RawSource）。合成データのみ。
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRaw, normRaw, looksTruncated, rawFromOfficialPage } from '../scripts/ledger-v2/raw-source.mjs';

const FULL = '<p>合成の本文です。三つの話題について話します。</p> <p>【関連記事】<br>合成見出し<br><a href="https://www.asahi.com/articles/ASZ1.html">https://www.asahi.com/articles/ASZ1.html</a></p>';
test('空欄は公式原文で埋める（FILL）／両方なしは要確認', () => {
  assert.equal(classifyRaw('', FULL).action, 'FILL');
  assert.equal(classifyRaw('', '').action, 'HOLD');
  assert.equal(classifyRaw('', 'x'.repeat(50001)).action, 'HOLD');
});
test('保存が公式の途中で切れている（不完全）は更新（UPDATE）。「…」付きでも', () => {
  assert.equal(classifyRaw(FULL.slice(0, 60), FULL).action, 'UPDATE');
  assert.equal(classifyRaw(FULL.slice(0, 60) + '…', FULL).action, 'UPDATE');
});
test('一致・空白だけの差・保存の方が長い・公式に無い は書かない（KEEP）', () => {
  assert.equal(classifyRaw(FULL, FULL).verdict, '一致');
  assert.equal(classifyRaw(FULL.replace(/ /g, '\n'), FULL).action, 'KEEP');
  assert.equal(classifyRaw(FULL + '<p>追記</p>', FULL).verdict, '保存の方が長い');
  assert.equal(classifyRaw(FULL, '').action, 'KEEP');
});
test('中身が違う（公式の後日修正など）は書かずに要確認（HOLD）', () => {
  assert.equal(classifyRaw(FULL.replace('三つ', '四つ'), FULL).action, 'HOLD');
  assert.equal(classifyRaw('短い', FULL).action, 'HOLD');   // 20字未満の先頭一致では「途中切れ」と決めない
});
test('途中切れの形の検出', () => {
  assert.equal(looksTruncated('<p>合成の文が途中で…'), true);
  assert.equal(looksTruncated('<p>合成の文です。</p>'), false);
  assert.equal(looksTruncated('<p>合成の文 <a href="x'), true);
  assert.equal(normRaw('<![CDATA[a&nbsp; b\n\nc]]>'), 'a b c');
});
test('公式個別ページ: JSONの本文（HTML付き優先）だけを採る。og:description は使わない', () => {
  const html = '<meta property="og:description" content="短縮"><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { clip: { Title: 't', Description: '合成の本文です（プレーン）。'.repeat(3), DescriptionHtml: FULL } } }) + '</script>';
  assert.equal(rawFromOfficialPage(html), FULL);
  assert.equal(rawFromOfficialPage('<meta property="og:description" content="短縮">'), '');
  assert.equal(rawFromOfficialPage('<script id="__NEXT_DATA__">{壊れた</script>'), '');
});
