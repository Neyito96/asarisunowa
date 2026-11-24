import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteDate } from '../scripts/amazon/scrape-new.mjs';
test('Amazon の相対日付を UTC の日付に', () => {
  const now = new Date('2026-11-18T04:00:00Z');
  assert.equal(absoluteDate('1日前', now), '2026年11月17日');
  assert.equal(absoluteDate('2026年10月25日', now), '2026年10月25日');
  assert.equal(absoluteDate('3時間前', now), '2026年11月18日');
  assert.equal(absoluteDate('', now), '');
});

// 小さな偽の DOM（innerText・parentElement・closest・getAttribute だけ）
function el(text, parent, tag = 'div') { return { tag, innerText: text, parentElement: parent, closest(sel) { let n = this; while (n) { if (n.tag === sel) return n; n = n.parentElement; } return null; } }; }
function anchor(href, text, parent) { const a = el(text, parent, 'a'); a.getAttribute = () => href; return a; }
const S = '7337408b-4752-4a85-8f27-4208a2ca8b1d', E1 = '11111111-1111-1111-1111-111111111111', E2 = '22222222-2222-2222-2222-222222222222', E3 = '33333333-3333-3333-3333-333333333333';
const docOf = (anchors) => ({ querySelectorAll: () => anchors });

test('新しい画面: 親をたどって日付の行を回の行として読む', async () => {
  const { pickRows } = await import('../scripts/amazon/scrape-new.mjs');
  const row1 = el('2026年11月24日\n（カガク #28）新プレイリスト\n29分29秒', el('list', null));
  const row2 = el('1日前\n別の回\n1時間2分', el('list', null));
  const promo = el('おすすめ\n別の番組', null);   // 日付の行が無い枠は読まない
  const rows = pickRows(docOf([
    anchor(`/podcasts/${S}/episodes/${E1}?ref=x`, '（カガク #28）新プレイリスト', el('（カガク #28）新プレイリスト', row1)),
    anchor(`/podcasts/${S}/episodes/${E2}`, '別の回', el('別の回', row2)),
    anchor(`/podcasts/${S}/episodes/${E3}`, '別の番組', promo),
  ]), 'https://music.amazon.co.jp');
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
    { url: `https://music.amazon.co.jp/podcasts/${S}/episodes/${E1}`, title: '（カガク #28）新プレイリスト', date: '2026年11月24日', duration: '29分29秒' },
    { url: `https://music.amazon.co.jp/podcasts/${S}/episodes/${E2}`, title: '別の回', date: '1日前', duration: '1時間2分' },
  ]);
});

test('古い画面: music-episode-row-item の行も今までどおり読む', async () => {
  const { pickRows } = await import('../scripts/amazon/scrape-new.mjs');
  const row = el('2026年11月20日\n古い画面の回\n30 min', null, 'music-episode-row-item');
  const rows = pickRows(docOf([anchor(`/podcasts/${S}/episodes/${E1}`, '古い画面の回', row)]), 'https://music.amazon.co.jp');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026年11月20日');
  assert.equal(rows[0].duration, '30分');
});
