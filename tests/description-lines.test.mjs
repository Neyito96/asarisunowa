import test from 'node:test'; import assert from 'node:assert/strict';
import { descriptionLines } from '../public/library/description-tidy.mjs';

test('◆の見出しの前と、回番号（#1194）のあとで改行する（EP-02595 月刊朝ポキ）', () => {
  const s = '月刊朝ポキ。8月号です。 。 ◆望月愛実セレクト 激レア恐竜化石 #1194 現代は「第6の絶滅期」？ #1202 ◆そのほか紹介したエピソード 縄文の犬 #427 アヘンの闇 #50-234';
  assert.equal(descriptionLines(s), '月刊朝ポキ。8月号です。\n◆望月愛実セレクト\n激レア恐竜化石 #1194\n現代は「第6の絶滅期」？ #1202\n◆そのほか紹介したエピソード\n縄文の犬 #427\nアヘンの闇 #50-234');
});
test('◆の見出しの途中では切らない（「◆何もかも値上げ なのに…」）', () => {
  assert.equal(descriptionLines('今回は… ◆何もかも値上げ なのにシャインマスカットは(7:07) ◆体育館 ととのわない(20:24)'), '今回は…\n◆何もかも値上げ なのにシャインマスカットは(7:07)\n◆体育館 ととのわない(20:24)');
});
test('◆の無い本文は、URLの消えた跡「（ ）。」だけ整える', () => {
  assert.equal(descriptionLines('収録しました。（ ）。'), '収録しました。');
  assert.equal(descriptionLines('ふつうの本文 #12 です。'), 'ふつうの本文 #12 です。');
});
