// ポッドキャストアワード投票の呼びかけ（2025年11月末〜2026年1月の配信回）を表示整形で外す
import test from 'node:test';
import assert from 'node:assert/strict';
import { tidyDescription, withoutAwardPlea } from '../public/library/description-tidy.mjs';

test('★★見出し＋呼びかけ＋「報談へ」の括弧書きを外す', () => {
  const t = tidyDescription('★★あなたの1分で朝ポキを延命★★ ポッドキャストアワードに投票してください！ （分散を避けるため、今回は「報談」へ投票をお願いします） 公訴時効とは、犯罪から一定期間が過ぎると刑罰が与えられなくなる制度です。');
  assert.equal(t.status, 'TIDY');
  assert.equal(t.body, '公訴時効とは、犯罪から一定期間が過ぎると刑罰が与えられなくなる制度です。');
});

test('投票用URLつきの形（SDGsを話そう）も外す', () => {
  const t = tidyDescription('★★あなたの1分で朝ポキを延命★★ ポッドキャストアワードに投票してください！ https://yoshimotomasahir.github.io/asapoki_vis/award2025.html （分散を避けるため、今回は「報談」へ投票をお願いします） 【番組内容】 あなたには友達は何人いますか？');
  assert.doesNotMatch(t.body, /アワード|award2025|報談/);
  assert.match(t.body, /友達は何人/);
});

test('括弧書きのない形（報談）も外す', () => {
  const t = tidyDescription('★★所用1分、報談を推せます★★ ポッドキャストアワードに投票してください！ きちんとテーマを設けて真面目に話す回が続いてしまったので、今回は雑談をします。');
  assert.equal(t.body, 'きちんとテーマを設けて真面目に話す回が続いてしまったので、今回は雑談をします。');
});

test('番組の中身としてアワードに触れる文は残す', () => {
  const s = 'ご愛聴ありがとうございます。ポッドキャストアワードへの投票をお願いする理由について番組内で紹介しました。';
  assert.match(tidyDescription(s).body, /アワードへの投票をお願いする理由/);
  assert.match(tidyDescription('ポッドキャストアワードのベストパーソナリティ賞に輝いた経験のあるVAJAさんをお迎えしました。').body, /ベストパーソナリティ賞/);
});

test('整形を保留する回の元の文面からも呼びかけだけ外す', () => {
  assert.equal(withoutAwardPlea('★★番組継続にご協力を★★ ポッドキャストアワードに投票してください！ （票の分散を避けるため、「報談」を統一候補としています） 本文です。'), '本文です。');
});

// ★で始まる中身（訂正・ネタバレ注意・番組名）は残し、告知の消し残しは外す
test('★の訂正文は文が途中で切れていても丸ごと残す（EP-03569）', () => {
  const t = tidyDescription('元祖・SNSだったのでは？ ★映画「ソーシャルネットワーク」の監督は、オリバー・ストーンではなく、 デヴィッド・フィンチャーでした。お詫びして訂正します。 ※2025年12月30日に収録しました');
  assert.match(t.body, /映画「ソーシャルネットワーク」の監督は、オリバー・ストーンではなく、 デヴィッド・フィンチャーでした。/);
  assert.doesNotMatch(t.body, /★/);
});

test('★ネタバレあり★の本文を残す（EP-05216）', () => {
  assert.match(tidyDescription('★ネタバレあり★ビターな結末に心震える、恋愛映画を3本紹介します。').body, /^ネタバレあり ビターな結末/);
});

test('番組名の「★the Letter」は the を残す（EP-00918）', () => {
  assert.match(tidyDescription('★the Letter「森澤恭子の地方自治の現場から」 品川区長の森澤恭子さんをゲストに迎えます。').body, /^the Letter「森澤恭子/);
});

test('告知のあとの「19時から」と「＼締め切り迫る！…まで」を外す（EP-05217）', () => {
  const t = tidyDescription('＼締め切り迫る！4/24（木）まで ★1億DLを記念した生配信を行います！4/25 19時から みなさん、ゲームはやりますか？');
  assert.equal(t.body, 'みなさん、ゲームはやりますか？');
});

test('告知の★は今まで通り外す', () => {
  assert.doesNotMatch(tidyDescription('★空気階段に悩みを相談しよう★ 番組の本文です。').body, /空気階段/);
});
