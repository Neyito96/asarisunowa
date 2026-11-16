// 清掃品質監査の回帰試験。比較基準は原文のみ（合成fixture）。監査が誤りを見逃さないこと、清掃案が fixture の条件を守ることを確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from './fixtures/summary-quality-fixtures.mjs';
import { auditPair, classifyRawLines, coverage, joinKey, stratifiedSample, summarize, QUALITY_STATES } from '../scripts/ledger-v2/summary-quality-audit.mjs';
import { v2CleanSummary } from '../scripts/ledger-v2/v2-enrich.mjs';
const SEVERE = /OVER_DELETION|EMPTY_OUTPUT|LOST_ARTICLE_URL|CAST_CONTAMINATED|STAFF_IN_BODY|HTML_RESIDUE|RELATED_CONTAMINATED|UNDER_DELETION|URL_IN_BODY|TRACKING_PARAM/;
const types = (r) => r.findings.map((f) => f.type);

test('品質状態は「処理済み」と「品質確認済」を分ける（自動検査合格は目視未確認）', () => {
  assert.deepEqual([...QUALITY_STATES], ['未処理', '自動処理済・未検証', '自動検査合格・目視未確認', '品質確認済', '要確認', '不合格']);
  const r = auditPair('<p>本文です。合成の話。</p>', { description: '本文です。合成の話。' });
  assert.equal(r.verdict, '自動検査合格・目視未確認');   // 自動検査では「品質確認済」にならない
});

for (const f of FIXTURES) test(`v2清掃案の回帰: ${f.id}（必要な本文・固有名詞・関連記事・出演者を落とさず、定型と追跡URLを残さない）`, () => {
  const v = v2CleanSummary(f.raw);
  const a = auditPair(f.raw, { description: v.text, cast: v.staff, related: v.related });
  assert.deepEqual(types(a).filter((t) => SEVERE.test(t)), [], JSON.stringify(a.findings));
  for (const k of f.keep) assert.ok(v.text.includes(k), `本文に残すべき: ${k}`);
  for (const r of f.related) assert.ok(v.related.some((x) => x.url === r.url && x.title === r.title), `関連記事: ${r.title}`);
  for (const n of f.staff) assert.ok(v.staff.some((x) => x.includes(n)), `出演者候補: ${n}`);
  assert.ok(!/https?:|&nbsp;|<|CDATA|iref=/.test(v.text));
});

test('曖昧な非記事リンクは関連記事に入れず HOLD（原文は残す）', () => {
  const v = v2CleanSummary(FIXTURES.find((f) => f.id === 'multi-articles-and-url-only').raw);
  assert.ok(v.holds.includes('RELATED_NONARTICLE_REVIEW')); assert.ok(v.related.every((r) => /asahi\.com\/articles/.test(r.url)));
});

test('監査は誤った清掃文を見逃さない（誤削除・削除漏れ・記事URL消失・見出し結合ミス・出演者混入・残骸・改行破壊）', () => {
  const raw = FIXTURES[0].raw, good = v2CleanSummary(raw);
  const base = { description: good.text, cast: good.staff, related: good.related };
  const chk = (cand, t) => assert.ok(types(auditPair(raw, { ...base, ...cand })).includes(t), t);
  chk({ description: '※2026年1月1日に収録しました。' }, 'OVER_DELETION');
  chk({ description: good.text + '\n番組継続のため、会員登録をお願いします！' }, 'UNDER_DELETION');
  chk({ related: [] }, 'LOST_ARTICLE_URL');
  chk({ related: [{ url: good.related[0].url, title: '番組継続のため、会員登録をお願いします！' }] }, 'ARTICLE_TITLE_MISMATCH');
  chk({ cast: [...good.staff, '交流はdiscord'] }, 'CAST_CONTAMINATED');
  chk({ cast: ['合成花子'] }, 'CAST_MISSING');
  chk({ description: good.text + '&nbsp;' }, 'HTML_RESIDUE');
  chk({ description: good.text + ' https://www.asahi.com/articles/X.html?iref=omny' }, 'TRACKING_PARAM');
  chk({ description: good.text.replace('「合成の話」', '話') }, 'LOST_PROPER_NOUN');
  chk({ description: good.text + '\n合成太郎（記者）' }, 'STAFF_IN_BODY');
  const mp = FIXTURES.find((f) => f.id === 'multi-paragraph-body').raw;
  assert.ok(types(auditPair(mp, { description: v2CleanSummary(mp).text.replace(/\n/g, ' ') })).includes('LINEBREAK_LOST'));
  assert.equal(auditPair(raw, base).verdict, '自動検査合格・目視未確認');
});

test('定型に似た本文の行は「消してよい」と判定しない（消し過ぎ防止）', () => {
  const lines = classifyRawLines(FIXTURES.find((f) => f.id === 'body-looks-like-boilerplate').raw);
  assert.equal(lines[0].expect, 'KEEP'); assert.notEqual(lines[1].expect, 'DROP');
});

test('空欄・原文なしは HOLD、部分一致は PARTIAL_DELETION、照合鍵と層化サンプルは決定的', () => {
  assert.equal(auditPair('', { description: 'x' }).verdict, 'HOLD');
  const r = auditPair('<p>あいうえおかきくけこさしすせそたちつてと</p>', { description: 'あいうえおかきくけこ' });
  assert.ok(types(r).includes('PARTIAL_DELETION')); assert.ok(coverage('同じ文', '同じ文') === 1);
  assert.equal(joinKey('https://traffic.omny.fm/d/clips/o/s/38da5e5a-96ce-4113-9c7e-b4db000e82d2/audio.mp3?x=1'), '38da5e5a-96ce-4113-9c7e-b4db000e82d2');
  assert.equal(joinKey('https://pdst.fm/e/traffic.megaphone.fm/TASC3807330963.mp3'), 'TASC3807330963');
  const pairs = [{ epId: 'EP-2', item: { show: 'A', rss: 'omny', descLen: 100, date: '2026/11/01' }, results: { x: { verdict: '不合格', findings: [{ type: 'OVER_DELETION' }] } } },
    { epId: 'EP-1', item: { show: 'A', rss: 'omny', descLen: 100, date: '2026/11/02' }, results: { x: { verdict: '自動検査合格・目視未確認', findings: [] } } }];
  assert.deepEqual(stratifiedSample(pairs, 1), [{ stratum: 'A/Omny/短/新着', epIds: ['EP-1'] }]);
  const s = summarize(pairs); assert.equal(s.byCandidate.x.itemsWithType.OVER_DELETION, 1); assert.equal(s.byCandidate.x.strata.A.fail, 1);
});
