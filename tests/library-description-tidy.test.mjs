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

test('告知だけの概要（ポすすめ回など）は PROMO_ONLY', async () => {
  const { tidyDescription } = await import('../public/library/description-tidy.mjs');
  assert.equal(tidyDescription('★番組での紹介を希望する方は、朝日新聞アプリで「おたより」を送ってください\n朝リスの田 byネジートさん').status, 'PROMO_ONLY');
});

test('#500 知らない見出しでも中身が宣伝だけなら外す・見出しが題名のURL1本は関連記事にする', () => {
  const t = tidyDescription('撮影のリアルに迫ります。 【関連記事】 輪島の大家族 https://www.asahi.com/articles/ASS3Y62HJS3PPISC01Z.html 【遠藤デスクがスマホ撮影のコツを動画で紹介！】 7月31日まで公開中！デジタル会員は無料でご覧いただけます。 記者サロン「スマホ旅」 https://t.asahi.com/woru?ref=omny 【祝・1億DL！ 5/31（土）イベント】 寺下真理加、斎藤健一郎に朝ポキメンバーも多数参加。 https://ciy.digital.asahi.com/ciy/11016611');
  assert.equal(t.status, 'TIDY');
  assert.equal(t.body, '撮影のリアルに迫ります。');
  assert.doesNotMatch(JSON.stringify([t.body, t.related]), /斎藤|スマホ旅/);
  const s = tidyDescription('「声」編集部に聞きました。 【特設サイト：声 語りつぐ戦争】 https://www.asahi.com/special/koe-senso/');
  assert.equal(s.status, 'TIDY');
  assert.deepEqual(s.related, [{ title: '特設サイト：声 語りつぐ戦争', url: 'https://www.asahi.com/special/koe-senso/' }]);
  // 本物の記事URLが混ざる知らない見出しは、これまでどおり保留
  assert.equal(tidyDescription('本文です。 【ニュースの学校】予算委員会 https://bit.ly/43idkHk ご意見 https://bit.ly/asapoki_discord').status, 'HOLD');
});

test('#501 古い回の定型（番組一覧リンク・mailto・「この番組は…収録しました」）を片付ける', () => {
  const t = tidyDescription('ドイツの消費減税を解説します。 【関連記事】 消費減税の街 https://www.asahi.com/articles/ASN9A.html 朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/?iref=omny ）では他にも様々な番組を配信、テキストでも読めます。この番組は2021年7月14日に収録しました。 メール podcast@asahi.com mailto:podcast@asahi.com');
  assert.equal(t.status, 'TIDY');
  assert.equal(t.body, 'ドイツの消費減税を解説します。');
  assert.equal(t.recordedAt, '2021年7月14日');
  assert.deepEqual(t.related, [{ title: '消費減税の街', url: 'https://www.asahi.com/articles/ASN9A.html' }]);
  // URLのない題名が番組一覧リンクの前に付く形は、リンクを作れないので保留
  assert.equal(tidyDescription('本文です。 【関連記事】題名だけ▽もう一つ 朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/ ）では他にも様々な番組を配信しています。').status, 'HOLD');
});
test('#501 「関連記事：URL ／ URL」は本文を題名にしない・Spotify／Apple の組は Spotify 1本', () => {
  const t = tidyDescription('夏の旅行を話し合う。出演：杢田光。関連記事：https://www.asahi.com/articles/A1.html?iref=omny ／ https://www.asahi.com/articles/A2.html');
  assert.equal(t.status, 'TIDY');
  assert.equal(t.body, '夏の旅行を話し合う。出演：杢田光。');
  assert.deepEqual(t.related.map((r) => [r.title, r.url]), [['', 'https://www.asahi.com/articles/A1.html?iref=omny'], ['', 'https://www.asahi.com/articles/A2.html']]);
  const s = tidyDescription('振り返りました。 【関連エピソード】方言の話 #52-81（ Spotify https://open.spotify.com/episode/x1 ／ApplePodcasts https://apple.co/y1 ） ▽推しの話 #52-77（ Spotify https://open.spotify.com/episode/x2 ／ApplePodcasts https://apple.co/y2 ）');
  assert.deepEqual(s.related, [{ title: '方言の話 #52-81', url: 'https://open.spotify.com/episode/x1' }, { title: '推しの話 #52-77', url: 'https://open.spotify.com/episode/x2' }]);
  // URLの直後に日本語が続いても、URLに飲み込まない
  const u = tidyDescription('本文。 【関連リンク】 兄の話 https://withnews.jp/article/f01A同人誌の話 https://withnews.jp/article/f02B');
  assert.deepEqual(u.related.map((r) => r.title), ['兄の話', '同人誌の話']);
});
