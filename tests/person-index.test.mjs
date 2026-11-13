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

test('PI-3 差分更新: 変わった話だけ差し替え・新しい話は末尾・消えた話は削除・同じ内容なら変更なし・重複0', async () => {
  const { mergeIndex } = await import('../scripts/ledger-v2/person-index.mjs');
  const R = (ep, key, state = '原文で確認') => ({ ep, key, display: key, note: '', links: '', source: 's', state });
  const cur = [R('E1', '甲'), R('E1', '乙'), R('E2', '丙'), R('E3', '丁')];
  const up = new Map([['E1', [R('E1', '甲'), R('E1', '乙')]], ['E2', [R('E2', '戊')]], ['E9', [R('E9', '己')]]]);
  const m = mergeIndex(cur, up, ['E3']);
  assert.deepEqual(m.rows.map((r) => r.ep + r.key), ['E1甲', 'E1乙', 'E2戊', 'E9己']);
  assert.equal(m.stat.unchangedEpisodes, 1); assert.equal(m.stat.duplicatePairs, 0); assert.equal(m.changed, true);
  const again = mergeIndex(m.rows, new Map([['E2', [R('E2', '戊')]]]), []); assert.equal(again.changed, false);   // 再実行で差分0
});
test('PI-3 出演者欄との差は記録するだけ（人の値を直さない）', async () => {
  const { castDifference } = await import('../scripts/ledger-v2/person-index.mjs');
  const { parseCastLine } = await import('../scripts/ledger-v2/summary-cleaner-v4.mjs');
  assert.equal(castDifference('E', ['山田花子'], '山田花子（教授）', parseCastLine), null);
  assert.equal(castDifference('E', ['山田花子', '鈴木一郎'], '山田花子', parseCastLine).missingInLedger, '鈴木一郎');
  assert.equal(castDifference('E', [], '神田七子', parseCastLine).kind, '台帳にだけ名前（原文に出典なし）');
});

test('PI-4 氏名と肩書きの分離（EP-00005「ナビゲーター／科学記者 石倉徹也」ほか）・誤統合しない', async () => {
  const { personKey, splitPersonTitle, personHold, personRows } = await import('../scripts/ledger-v2/person-index.mjs');
  assert.deepEqual(splitPersonTitle('ナビゲーター／科学記者 石倉徹也'), { name: '石倉徹也', title: 'ナビゲーター / 科学記者' });
  const r = personRows('EP-X', '<p>本文。</p><p>【出演者】<br>ナビゲーター／科学記者 石倉徹也&nbsp;<a href="https://buff.ly/x">https://buff.ly/x</a><br>MC・音源編集 下地達也</p>');
  assert.deepEqual(r.rows.map((x) => x.key), ['石倉徹也', '下地達也']); assert.match(r.rows[0].note, /科学記者/); assert.equal(r.rows[0].display.includes('科学記者'), true);   // 表記原文は残す
  const cases = { '中小路徹編集委員': '中小路徹', '副島英樹・編集委員': '副島英樹', '清水唯一朗・慶応大教授': '清水唯一朗', '矢守克也・京都大防災研究所教授': '矢守克也', '筒井次郎記者': '筒井次郎', '芳賀竜也デスク': '芳賀竜也',
    'MC・音源編集岸上渉': '岸上渉', '音源編集久保智祥': '久保智祥', 'ゲスト佐久間道大': '佐久間道大', '下地達也 MC 音源編集': '下地達也', '朝日新聞松山総局戸田拓記者': '戸田拓', 'サンパウロ支局長軽部理人': '軽部理人', 'KSB瀬戸内海放送山下洋平記者': '山下洋平',
    '清水祐司さん ※番組第一回放送出演者': '清水祐司', '小林直子/ニュースレター:': '小林直子', 'ジョン・スミス': 'ジョン・スミス', 'ナビゲーター石倉徹也': '石倉徹也', '神田大介さん': '神田大介' };
  for (const [k, v] of Object.entries(cases)) assert.equal(personKey(k), v, k);
  assert.equal(personKey('中小路編集委員'), '中小路');   // 名字だけは「中小路徹」と同一と断定しない（別の索引名のまま）
  assert.equal(personKey('ふらいと先生/小児科医・今西洋介'), 'ふらいと先生/小児科医・今西洋介');   // どちらが名前か決められない時は外さない
  assert.equal(personKey('記者'), '記者'); assert.equal(personHold('記者'), 'ROLE_WORD_ONLY'); assert.equal(personHold('・ゲスト】'), 'ROLE_WORD_ONLY'); assert.equal(personHold('・スタッフ】'), 'ROLE_WORD_ONLY');
});

test('PI-4 出演者欄の1行に並んだ複数人は1人ずつ（未検証の名前を1つにまとめない）・決められない行はそのまま', async () => {
  const { ledgerRows } = await import('../scripts/ledger-v2/person-index.mjs'); const { parseCastLine } = await import('../scripts/ledger-v2/summary-cleaner-v4.mjs');
  const k = (c) => ledgerRows('E', c, parseCastLine).map((r) => r.key);
  assert.deepEqual(k('今永諒 / 神田大介 / 安田桂子'), ['今永諒', '神田大介', '安田桂子']); assert.deepEqual(k('飯沼優仁、杢田光（MC）、望月愛実（音源編集）'), ['飯沼優仁', '杢田光', '望月愛実']);
  assert.deepEqual(k('下地達也 / 石倉徹也,科学記者'), ['下地達也', '石倉徹也']); assert.deepEqual(k('大野由衣 / 井上翔太,朝日新聞スポーツ部 / 松林康徳,常総学院野球部部長'), ['大野由衣', '井上翔太', '松林康徳']); assert.deepEqual(k('ふらいと先生/小児科医・今西洋介'), ['ふらいと先生/小児科医・今西洋介']);
  assert.ok(ledgerRows('E', '飯沼優仁、杢田光（MC）', parseCastLine).every((r) => r.state === '原文に出典なし・未検証'));
});
