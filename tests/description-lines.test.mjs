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

test('文の途中の【関連記事】（直後が助詞）は見出しにしない／元の文面でも &hellip; &darr; を戻す（EP-06733）', async () => {
  const { tidyDescription, withoutAwardPlea } = await import('../public/library/description-tidy.mjs');
  const raw = 'なかなか厳しい道です&hellip;。この概要欄の続きにある【関連記事】の１つめは、奇跡のコラボです。 【関連記事】 湯屋で会った老人 https://www.asahi.com/articles/ASVBZ0SCQVBZTLVB003M.html?iref=omny 【出演・スタッフ】 近藤康太郎（MC）http://t.asahi.com/wqrp';
  const t = tidyDescription(raw);
  assert.equal(t.status, 'TIDY');
  assert.equal(t.body, 'なかなか厳しい道です…。この概要欄の続きにある【関連記事】の１つめは、奇跡のコラボです。');
  assert.equal(withoutAwardPlea('こちらから&darr; と&hellip;'), 'こちらから↓ と…');
});
