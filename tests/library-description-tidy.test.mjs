// #315 概要欄の表示整形（EP-05468 を回帰テストに使う）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tidyDescription } from '../public/library/description-tidy.mjs';
// EP-05468 の旧V1概要（#333 で V2 清掃済みに置き換わる前の本文）を固定の材料として使う
const ep = (id) => ({ id, description: fs.readFileSync(new URL('./fixtures/' + id + '-description-v1.txt', import.meta.url), 'utf8') });

test('EP-05468: 本編・収録日・紹介したポッドキャスト・関連記事3件は残し、イベント告知・スタッフ情報は外す', () => {
  const t = tidyDescription(ep('EP-05468').description);
  assert.equal(t.status, 'TIDY');
  assert.ok(t.body.startsWith('新年度が始まって早々、家族旅行に行ってきました。'));
  assert.ok(t.body.includes('紹介したポッドキャストは「そえたとおもちの美容室トーク」'));
  assert.equal(t.recordedAt, '2026年4月10日');
  assert.deepEqual(t.related.map((r) => r.url), [
    'https://www.asahi.com/articles/ASV490PH4V49UCVL01MM.html?iref=omny',
    'https://www.asahi.com/articles/ASV461DN4V46UTFK009M.html?iref=omny',
    'https://www.asahi.com/articles/ASV461FRBV46UTIL01GM.html?iref=omny']);
  assert.equal(t.related[0].title, '本屋大賞に朝井リョウさん「イン・ザ・メガチャーチ」 書店員が投票');
  for (const gone of ['大報談', '申し込み', 'ciy.digital', '締め切り', '神田大介（MC', 'bit.ly']) assert.ok(!t.body.includes(gone), gone);
});
test('関連記事のURLは概要にあるものだけ（作らない）。URLのない関連記事・知らない形は HOLD で元のまま', () => {
  const noUrl = tidyDescription('本編です。 【関連記事】 ガザの死者、停戦後に1千人超え 8歳息子奪われた父 【出演・スタッフ】 A');
  assert.equal(noUrl.status, 'HOLD'); assert.equal(noUrl.related.length, 0);
  const odd = tidyDescription('本編です。 【未知の見出し】 なにか');
  assert.equal(odd.status, 'HOLD');
});
test('宣伝の★ブロックの後の本文は残す・宣伝URLだけの行は外す', () => {
  const t = tidyDescription('★6月27日、高松総局でお会いしましょう 無料、要申し込み。締め切りは6月14日です ああ、泣きたい。 ※2026年6月4日に収録しました');
  assert.equal(t.body, 'ああ、泣きたい。'); assert.equal(t.recordedAt, '2026年6月4日');
});
test('本文中の「記事タイトル URL」は関連記事へ移し、SNS・フォームの案内は外す', () => {
  const t = tidyDescription('亡くなりました。 「ミスタープロ野球」長嶋茂雄さんとは 国民的スーパースターの歩み https://www.asahi.com/articles/AST6311P4T63UTQP00K.html ご意見はこちらのフォームから https://forms.gle/x');
  assert.equal(t.body, '亡くなりました。');
  assert.deepEqual(t.related, [{ title: '「ミスタープロ野球」長嶋茂雄さんとは 国民的スーパースターの歩み', url: 'https://www.asahi.com/articles/AST6311P4T63UTQP00K.html' }]);
});
test('公開データ全件で落ちない・関連記事のURLはすべて https', () => {
  const dir = new URL('../public/library/data/details/', import.meta.url);
  let n = 0;
  for (const f of fs.readdirSync(dir)) for (const e of JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'))) { const t = tidyDescription(e.description); n++; for (const r of t.related) assert.match(r.url, /^https:\/\//, e.id); }
  assert.ok(n >= 5990);
});
