import test from 'node:test';
import assert from 'node:assert/strict';
import { tidyDescription } from '../public/library/description-tidy.mjs';

test('GOOD LIFEフェア告知を本文に混ぜず、原文には触れない', () => {
  const raw = '本編の話です。【GOOD LIFEフェア2026】イベント会場でお会いしましょう。';
  const out = tidyDescription(raw);
  assert.equal(out.status, 'TIDY');
  assert.equal(out.body, '本編の話です。');
  assert.equal(raw.includes('GOOD LIFEフェア2026'), true);
});
test('未知見出しは自動削除しない', () => {
  const out = tidyDescription('本文です。【未知の大事な項目】内容があります。');
  assert.equal(out.status, 'HOLD');
});
test('関連リンクの不完全な項目はHOLDを維持', () => {
  const out = tidyDescription('本文です。【関連リンク】記事名だけ');
  assert.equal(out.status, 'HOLD');
});
