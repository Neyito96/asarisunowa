// SC4-17 回帰試験（2026-11-16 最終指令「概要欄清掃・関連記事保全GASの完成」）。
// 実在の本文は使わず、実データで見つかった壊れ方（HTMLの形）だけを合成で再現する。EP-ID は「どの事故の再現か」の目印。
// 実データでの同じ確認は GAS「概要欄_R_回帰確認_READ_ONLY」が V2 の原文で行う（結果は件数と合否だけ）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanV4, judgeEpisode, relatedCell, relatedKind, splitHiddenAnchors, CLEANER_VERSION } from '../scripts/ledger-v2/summary-cleaner-v4.mjs';
import { auditPair, cleanUrl } from '../scripts/ledger-v2/summary-quality-audit.mjs';

const A = (u, label = u) => `<a href="${u}">${label}</a>`;
const FOOT = '<p>【朝ポキ情報】<br>アプリで記者と対話 ' + A('http://t.asahi.com/won1') + '&nbsp;<br>交流はdiscord ' + A('https://bit.ly/asapoki_discord') + '</p><p>See ' + A('https://omnystudio.com/listener', 'omnystudio.com/listener') + ' for privacy information.</p>';
const arts = (rel) => rel.filter((r) => r.kind === 'article');

test('版は SC4-17', () => { assert.match(CLEANER_VERSION, /^SC4-17/); });

test('EP-06630型: 告知が冒頭にあっても関連記事3件を見出し＋URLの組で全部残す', () => {
  const raw = '<p><strong>★「PODCAST MEETING 2099」12/6（日）&nbsp;</strong><br>合成イベントの案内文です。&nbsp;<br>対象はデジタル版有料会員と紙面購読者です。&nbsp;<br>https://t.asahi.com/wr7n&nbsp;<br>&nbsp;<br><strong>★ お得なキャンペーンでイベントに参加&nbsp;</strong><br>スタンダードコース（月額1,980円）が2カ月間は月額100円！※初回限定&nbsp;<br>' + A('https://digital.asahi.com/pr/cp/2099/?ref=x') + '&nbsp;</p> <p>朝ポキは、みなさまからの購読料で配信しています。</p> <p>【番組内容】<br>合成の本文です。三つの話題について話します。<br>※2099年10月8日に収録しました。</p> <p>【関連記事】<br>合成見出しA　攻撃者の思うつぼ<br>' + A('https://www.asahi.com/articles/ASZ0001AAAA.html?iref=omny') + '&nbsp;<br>合成見出しB　妖怪研究<br>' + A('https://www.asahi.com/articles/ASZ0002BBBB.html?iref=omny') + '&nbsp;<br>（合成のｂｅ会議）繰り返し読む本は？<br>' + A('https://www.asahi.com/articles/DA3S00000003.html?iref=omny') + '</p> <p>【出演・スタッフ】<br>合成理恵子<br>合成愛実　' + A('http://t.asahi.com/wqog') + '&nbsp;<br>MC・音源編集　合成賢一　' + A('https://t.asahi.com/wqnu') + '&nbsp;</p>' + FOOT;
  const r = cleanV4(raw);
  assert.deepEqual(arts(r.related).map((x) => [x.title, x.url]), [
    ['合成見出しA 攻撃者の思うつぼ', 'https://www.asahi.com/articles/ASZ0001AAAA.html'],
    ['合成見出しB 妖怪研究', 'https://www.asahi.com/articles/ASZ0002BBBB.html'],
    ['（合成のｂｅ会議）繰り返し読む本は？', 'https://www.asahi.com/articles/DA3S00000003.html'],
  ]);
  assert.equal(r.related.every((x) => x.originalUrl), true);
  assert.equal(relatedCell(r.related).split(' ').length, 3);
  assert.match(r.text, /合成の本文です/); assert.doesNotMatch(r.text, /PODCAST MEETING|月額|購読料/);
  assert.equal(r.cast.length, 3);
});

test('EP-06631型: ゲスト固有のXリンクを保全し、本文に「Xから」だけの行を残さない', () => {
  const raw = '<p>合成の漫画家さんをゲストに迎え、創作論について聞きました。表現と傷つく人についても話しました。</p> <p>★合成さんの作品や近況はXから ' + A('https://x.com/GouseiGuest') + '&nbsp;</p> <p>※2099年10月20日に収録しました</p> <p>【出演・スタッフ】<br>合成さん（漫画家）<br>MC、音源編集　合成大介 ' + A('https://bit.ly/4k4ZKwA') + '&nbsp;</p>' + FOOT;
  const r = cleanV4(raw);
  assert.ok(r.socials.includes('https://x.com/GouseiGuest'));
  assert.doesNotMatch(r.text, /Xから/);
  assert.match(r.text, /創作論/); assert.match(r.text, /収録しました/);
  assert.equal(r.cast.length, 2);
});

test('URLの直後に日本語や次のURLが続いても、そこで切る（EP-01176・EP-00365型）', () => {
  const raw = '<p>合成の本文です。</p><p>【関連リンク】<br>合成見出しA<br>https://withnews.jp/article/f0000000001qq000000000000000W0b810101qq000000001A合成見出しB<br>https://withnews.jp/article/f0000000002qq000000000000000W0b810101qq000000002A</p><p>【関連記事】合成見出しC（https://www.asahi.com/articles/ASZ0003CCCChttps://www.asahi.com/articles/ASZ0003CCCC.html?iref=omny）</p>';
  const r = cleanV4(raw), urls = arts(r.related).map((x) => x.url);
  assert.ok(urls.includes('https://withnews.jp/article/f0000000001qq000000000000000W0b810101qq000000001A'));
  assert.ok(urls.includes('https://withnews.jp/article/f0000000002qq000000000000000W0b810101qq000000002A'));
  assert.ok(urls.includes('https://www.asahi.com/articles/ASZ0003CCCC.html'));
  assert.equal(urls.some((u) => /[^\x00-\x7F]/.test(u)), false);
  assert.equal(arts(r.related).find((x) => x.url.endsWith('002A')).title, '合成見出しB');
});

test('★告知の段落の中でも【番組内容】【関連記事】で告知を終える（EP-03025型: 本文と関連記事が消えていた）', () => {
  const raw = '<p>【リアルで新聞をめくろう】<br>9月23日は「PODCAST MEETING 2099」！<br>入場無料、朝日IDで申し込めます。<br>https://ciy.digital.asahi.com/ciy/11014641 <br><br>【番組内容】<br>合成の本文です。五輪について話します。<br>※2099年8月7日に収録しました。<br><br>【関連記事】<br>合成見出しA<br>https://www.asahi.com/articles/ASZ0004DDDD.html?ref=omny <br>合成見出しB<br>https://www.asahi.com/articles/ASZ0005EEEE.html?ref=omny <br><br>【出演・スタッフ】<br>合成慶子<br>MC　合成諒</p>';
  const r = cleanV4(raw);
  assert.match(r.text, /合成の本文です/); assert.doesNotMatch(r.text, /PODCAST MEETING|申し込め/);
  assert.equal(arts(r.related).length, 2); assert.equal(r.cast.length, 2);
  assert.equal(r.holds.includes('CONTENT_EMPTY'), false);
});

test('名前の決まっていない告知見出しの後でも、宣伝語のない長い本文の段落は本文に戻す（EP-00605型）', () => {
  const raw = '<p>【2カ月間無料キャンペーン】<br>全記事が読み放題！11/25まで実施中<br>' + A('https://digital.asahi.com/pr/cp/2099/?ref=x') + '</p> <p>合成ケアは、妊娠前の女性とカップルに医学的・行動学的・社会的な保健介入を行うことと定義されています。健康な妊娠や出産を目指すために重要とされてきました。</p> <p>（いちからわかる！）合成ケア、なぜいま推進するの？<br>' + A('https://www.asahi.com/articles/DA3S00000006.html?iref=omny') + '</p>';
  const r = cleanV4(raw);
  assert.match(r.text, /合成ケアは、妊娠前/); assert.doesNotMatch(r.text, /読み放題/);
  assert.deepEqual(arts(r.related).map((x) => x.title), ['（いちからわかる！）合成ケア、なぜいま推進するの？']);
});

test('見えないリンク（文字なし・URLの切れ端・表示URLと違うhref）に近くの見出しを推測で付けない（EP-04021・EP-06651型）', () => {
  const raw = '<p>【関連記事】<br>合成見出しA<br>' + A('https://www.asahi.com/articles/ASZ0007AAAA.html') + A('https://www.asahi.com/articles/ASZ0008HIDE.html?iref=omny', '?iref=omny') + A('https://www.asahi.com/articles/ASZ0009HIDE.html', '') + '<br>合成見出しB<br>' + A('https://www.asahi.com/articles/ASZ0010BBBB.html?iref=omny') + A('https://www.asahi.com/articles/ASZ0010BBBB.html', '') + '</p>';
  const h = splitHiddenAnchors(raw); assert.equal(h.hidden.length, 2);
  const r = cleanV4(raw), by = Object.fromEntries(arts(r.related).map((x) => [x.url.split('/').pop(), x]));
  assert.equal(by['ASZ0007AAAA.html'].title, '合成見出しA');
  assert.equal(by['ASZ0010BBBB.html'].title, '合成見出しB');
  assert.equal(by['ASZ0008HIDE.html'].title, ''); assert.equal(by['ASZ0008HIDE.html'].hiddenLink, true);
  assert.equal(by['ASZ0009HIDE.html'].title, ''); assert.equal(by['ASZ0009HIDE.html'].hiddenLink, true);
  assert.equal(arts(r.related).length, 4);   // 見えないリンクも消さずに保存
  assert.equal(r.holds.includes('RELATED_URL_WITHOUT_TITLE'), false);   // 見えないリンクは見出しが無いのが正しい（要確認にしない）
});

test('本文の文章の中にある記事リンクは、文章を本文に残し、記事は見出し不明で要確認（EP-01271型）', () => {
  const raw = '<p>合成の編集委員が人事の裏側を読み解きます。関連記事は' + A('https://digital.asahi.com/articles/ASZ0011AAAA.html', '朝日新聞デジタル') + 'から読んでいただけます。</p>';
  const r = cleanV4(raw);
  assert.match(r.text, /人事の裏側を読み解きます/);
  assert.deepEqual(arts(r.related).map((x) => [x.title, x.url]), [['', 'https://digital.asahi.com/articles/ASZ0011AAAA.html']]);
  assert.ok(r.holds.includes('RELATED_URL_WITHOUT_TITLE'));
});

test('関連記事の種類: 記事・動画・参考文献・リンク・宣伝・SNS を区別し、台帳の関連記事URL欄には記事だけ', () => {
  assert.equal(relatedKind('https://www.asahi.com/articles/ASZ1.html', 'x'), 'article');
  assert.equal(relatedKind('https://smbiz.asahi.com/article/123', 'x'), 'article');
  assert.equal(relatedKind('https://www.asahi.com/sdgs/article/123', 'x'), 'article');
  assert.equal(relatedKind('https://www.youtube.com/watch?v=abc', '解説'), 'video');
  assert.equal(relatedKind('https://publications.asahi.com/product/1.html', '新刊'), 'reference');
  assert.equal(relatedKind('https://example.com/report.pdf', '報告書'), 'reference');
  assert.equal(relatedKind('https://example.com/', '【SPONSORED】合成'), 'promo');
  assert.equal(relatedKind('https://example.com/page', '特集ページ'), 'link');
  const raw = '<p>合成の本文です。</p><p>【関連リンク】<br>合成見出し記事<br>' + A('https://www.asahi.com/articles/ASZ0012AAAA.html') + '<br>合成の解説動画<br>' + A('https://www.youtube.com/watch?v=zzz') + '<br>合成白書（参考文献）<br>' + A('https://www.example.go.jp/hakusho.pdf') + '<br>合成フェスの参加申し込み ' + A('https://ciy.digital.asahi.com/ciy/1') + '<br>合成記者のX ' + A('https://x.com/gousei') + '</p>';
  const r = cleanV4(raw), kinds = r.related.map((x) => x.kind);
  assert.deepEqual(kinds, ['article', 'video', 'reference', 'promo', 'sns']);
  assert.equal(relatedCell(r.related), 'https://www.asahi.com/articles/ASZ0012AAAA.html');
  assert.equal(r.related.every((x) => x.url), true);
});

test('「….html/」と「….html」は同じ記事として1件', () => {
  const raw = '<p>【関連記事】合成見出し（ https://www.asahi.com/articles/ASZ0013AAAA.html/?iref=omny ）▽合成見出し2（https://www.asahi.com/articles/ASZ0013AAAA.html）</p>';
  const r = cleanV4(raw); assert.equal(arts(r.related).length, 1);
  assert.equal(cleanUrl('https://www.asahi.com/articles/X.html/?iref=omny'), 'https://www.asahi.com/articles/X.html');
});

test('文の後ろに付いた指差し（…収録しました。…の過去回はこちら URL）は、文を残してリンクを見出し付きで保存', () => {
  const raw = '<p>合成の本文です。</p><p>※2099年9月30日に収録しました。シリーズ「合成スタジオ」の過去回はこちら ' + A('https://www.asahi.com/special/podcasts/?pgid=hub') + '</p><p>合成のエピソードはこちら（ ' + A('https://omny.fm/shows/asahi/x') + ' ）</p>';
  const r = cleanV4(raw);
  assert.match(r.text, /※2099年9月30日に収録しました。/); assert.doesNotMatch(r.text, /こちら|（\s*）/);
  assert.equal(r.related.filter((x) => x.kind === 'link').length, 2);
});

test('行頭の「URL＋次の人名」はURLを前の人へ戻す（EP-01110型）', () => {
  const raw = '<p>合成の本文です。</p><p>【出演・スタッフ】<br>合成次朗（スポーツ部）<br>MC 合成梓' + A('https://bit.ly/4kepWoO', '') + '<br>https://bit.ly/4kepWoO音源編集・合成愛実</p>';
  const r = cleanV4(raw);
  assert.ok(r.cast.some((c) => /^音源編集・合成愛実$/.test(c.raw)));
  assert.equal(r.cast.some((c) => /^https?:/.test(c.raw)), false);
});

test('「朝日新聞アプリで〇〇をフォロー URL」は出演者に重ねない（同じリンクの出演者がいる）', () => {
  const raw = '<p>★おたより、お待ちしています！ ' + A('https://bit.ly/43wSTFg') + '朝日新聞アプリで合成大介をフォロー ' + A('https://bit.ly/4k4ZKwA') + '</p><p>【番組内容】<br>合成の本文です。</p><p>【出演・スタッフ】<br>合成大介（MC、音源編集） ' + A('https://bit.ly/4k4ZKwA') + '</p>';
  const r = cleanV4(raw);
  assert.deepEqual(r.cast.map((c) => c.name), ['合成大介']);
  assert.doesNotMatch(r.text, /フォロー/);
});

test('安全網: どの節にあっても記事URLは関連記事に残る（落ちた所にあったものは回収して要確認）', () => {
  const raw = '<p>【おねがい】<br>朝日新聞ポッドキャストは購読料で配信しています。今回のリポートは記事でも読めます（ https://www.asahi.com/articles/ASZ0014AAAA.html ）</p><p>【番組内容】<br>合成の本文です。</p>';
  const r = cleanV4(raw);
  assert.ok(arts(r.related).some((x) => x.url === 'https://www.asahi.com/articles/ASZ0014AAAA.html'));
  assert.ok(r.holds.includes('RELATED_RECOVERED_REVIEW'));
});

test('判定: 新しい清掃値が監査で記事URLの欠落・関連の混入を起こさない（宣伝・SNSは監査の関連記事から外す）', () => {
  const raw = '<p>合成の本文です。十分な長さの本文として二つ目の文も置きます。</p><p>【関連リンク】<br>合成見出し記事<br>' + A('https://www.asahi.com/articles/ASZ0015AAAA.html') + '<br>合成記者のX ' + A('https://x.com/gousei') + '</p><p>【出演・スタッフ】<br>合成一郎</p>';
  const j = judgeEpisode(raw, { summary: '', cast: '', related: '' });
  assert.doesNotMatch(j.reason, /LOST_ARTICLE_URL|RELATED_CONTAMINATED/);
});

test('冪等: 同じ原文は何度清掃しても同じ結果', () => {
  const raw = '<p>合成の本文です。</p><p>【関連記事】<br>見出し<br>https://www.asahi.com/articles/ASZ0016AAAA.html</p>';
  assert.deepEqual(cleanV4(raw), cleanV4(raw));
});
