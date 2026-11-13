import test from 'node:test';
import assert from 'node:assert/strict';
import { personKey, personHold, personRows, buildPersonIndex } from '../scripts/ledger-v2/person-index.mjs';
import { cleanV4 } from '../scripts/ledger-v2/summary-cleaner-v4.mjs';
// 合成の原文（Issue #309 の3例の「型」を再現。実在の本文は使わない）
const PROMO_IN_SAME_PARA = '<p>本編の説明です。</p><p>【関連記事】<br>記事A<br><a href="https://www.asahi.com/articles/ASX1.html">https://www.asahi.com/articles/ASX1.html</a><br> 【出演・スタッフ】<br>山田花子さん（大学教授） <a href="https://x.com/hanako">https://x.com/hanako</a><br>鈴木一郎（チーフパーソナリティ）&nbsp;<a href="https://bit.ly/aaa">https://bit.ly/aaa</a><br>MC 佐藤次郎（編成部）<a href="https://bit.ly/bbb">https://bit.ly/bbb</a><br><br>★「PODCAST MEETING 2026」12/6（日）<br>番組でおなじみの17人超の出演者が登場します。<br>対象はデジタル版有料会員と紙面購読者です。<br><a href="https://ciy.digital.asahi.com/ciy/x">https://ciy.digital.asahi.com/ciy/x</a></p>';
const PLATFORM_LINKS = '<p>本編の説明です。</p><p>この番組は各サービスでも聴けます<br>Spotify <a href="https://buff.ly/1">https://buff.ly/1</a><br>Apple <a href="https://buff.ly/2">https://buff.ly/2</a><br>Pocket Casts <a href="https://buff.ly/3">https://buff.ly/3</a><br>Amazon music <a href="https://buff.ly/4">https://buff.ly/4</a></p><p>【出演・スタッフ】<br>田中三郎（スポーツ部） <a href="https://twitter.com/x">https://twitter.com/x</a><br>MC　高橋四郎　<a href="https://buff.ly/5">https://buff.ly/5</a><br>音源編集　伊藤五郎</p>';
const NO_NAMES = '<p>ニュースの用語をやさしく解説します。</p><p>ご意見・感想・リクエスト <a href="https://forms.gle/x">https://forms.gle/x</a></p>';
const HEADER_LOST = '<p>説明。</p><p> 【関連記事】<br>記事B<br><a href="https://www.asahi.com/articles/ASX2.html">https://www.asahi.com/articles/ASX2.html</a> </p><p> 【出演・スタッフ】<br>宋六郎（パリ支局長）<br>MC　神田七子<br>音源編集　飯島八郎 </p><p> 【朝ポキ情報】<br>ご感想はおたよりフォーム → <a href="https://bit.ly/o">https://bit.ly/o</a></p>';
test('#309 例2: 同じ段落の後ろに告知があっても、前の【出演・スタッフ】3人を取りこぼさない', () => {
  assert.deepEqual(personRows('EP-T2', PROMO_IN_SAME_PARA).rows.map((r) => r.key), ['山田花子', '鈴木一郎', '佐藤次郎']);
});
test('#309 例3: 配信サービス名（Spotify/Apple/Pocket Casts/Amazon music）を人物にしない。URLは失わない', () => {
  const c = cleanV4(PLATFORM_LINKS); assert.deepEqual(c.cast.map((x) => x.name), ['田中三郎', '高橋四郎', '伊藤五郎']);
  const n = cleanV4('<p>本編。</p><p>【お知らせ】アプリでも聴けます<br>Spotify <a href="https://buff.ly/1">https://buff.ly/1</a><br>Apple <a href="https://buff.ly/2">https://buff.ly/2</a></p><p>【出演・スタッフ】<br>MC　高橋四郎</p>');
  assert.deepEqual(n.cast.map((x) => x.name), ['高橋四郎']); assert.ok(n.socials.includes('https://buff.ly/1') || n.removed.some((r) => /NOTICE|PLATFORM/.test(r.reason)));
});
test('#309 例1: 原文に人名が無い回は空のまま（番組から推測して埋めない）、状態は NO_NAMES_IN_RAW', () => {
  const r = personRows('EP-T1', NO_NAMES); assert.equal(r.rows.length, 0); assert.equal(r.status, 'NO_NAMES_IN_RAW');
});
test('#309 見出し行が段落区切りで消える型でも出演者を拾う（予備経路）', () => {
  assert.deepEqual(cleanV4(HEADER_LOST).cast.map((x) => x.name), ['宋六郎', '神田七子', '飯島八郎']);
});
test('#309 索引名: 空白・敬称を除いて重複判定、役割は列にしない', () => {
  assert.equal(personKey('竹端 寛さん'), '竹端寛'); assert.equal(personKey('山田花子氏'), '山田花子');
  assert.equal(personHold('Spotify'), 'PLATFORM_NAME'); assert.equal(personHold('https://x.com/a'), 'LINK_OR_ACCOUNT');
  const ix = buildPersonIndex([{ ep: 'E1', raw: PROMO_IN_SAME_PARA }, { ep: 'E2', raw: PLATFORM_LINKS }, { ep: 'E3', raw: NO_NAMES }, { ep: 'E4', raw: '' }]);
  assert.equal(ix.stat.rows, 6); assert.equal(ix.stat.noNamesInRaw, 1); assert.equal(ix.stat.rawNone, 1);
  assert.ok(ix.rows.every((r) => !('role' in r)));
});
test('#309 原文に名前が無い回の台帳既存値は消さず「出典なし・未検証」で載せる／役割語つき氏名は同じ索引名', async () => {
  const { parseCastLine } = await import('../scripts/ledger-v2/summary-cleaner-v4.mjs');
  const ix = buildPersonIndex([{ ep: 'E9', raw: NO_NAMES, ledgerCast: '神田七子\nSpotify https://buff.ly/1', parse: parseCastLine }]);
  assert.deepEqual(ix.rows.map((r) => [r.key, r.state]), [['神田七子', '原文に出典なし・未検証']]);
  assert.equal(personKey('ナビゲーター・石倉七郎'), personKey('ナビゲーター石倉七郎')); assert.equal(personKey('ナビゲーター石倉七郎'), '石倉七郎');
});
