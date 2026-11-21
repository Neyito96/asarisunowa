// #432 最終新着の日本時間化と、利用制限で飛ばされた日次処理の代わり実行（純粋関数のみ）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = (f) => { const c = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/' + f, import.meta.url), 'utf8'), c); return c; };
const J = ctx('PlaylistJstDate.js').module.exports;
const A = ctx('AutoUpdateAutomationV1.js');

test('日本時間 04:00 配信の回は、Spotify の前日の日付を蔵の日付（翌日）に直す', () => {
  const idx = J.pjdIndex_([['EP-06760', 0, '2026-11-21T04:00', '（ポリレビ #20）米中ロで新ヤルタ会談？'], ['EP-1', 0, '2026-10-01T04:00', '別の回']]);
  assert.equal(J.pjdJstDate_({ name: '（ポリレビ #20）米中ロで新ヤルタ会談？', release_date: '2026-11-20' }, idx), '2026-11-21');
});
test('蔵に同じ題名が無い・日付が離れている回は Spotify の日付のまま', () => {
  const idx = J.pjdIndex_([['EP-1', 0, '2026-11-25T04:00', '回A']]);
  assert.equal(J.pjdJstDate_({ name: '回B', release_date: '2026-11-20' }, idx), '2026-11-20');
  assert.equal(J.pjdJstDate_({ name: '回A', release_date: '2026-11-20' }, idx), '2026-11-20');
  assert.equal(J.pjdJstDate_({ name: '回A', release_date: '' }, idx), '');
});
test('日次処理の代わり実行は、その日に飛ばされて、まだ実行していないときだけ', () => {
  const f = A.auShouldCatchUpDaily_;
  assert.equal(f('2026-11-21', '2026-11-20', '2026-11-21', false), true);
  assert.equal(f('2026-11-21', '2026-11-21', '2026-11-21', false), false);   // もう実行した
  assert.equal(f('', '2026-11-20', '2026-11-21', false), false);             // 飛ばされていない
  assert.equal(f('2026-11-20', '2026-11-19', '2026-11-21', false), false);   // 前日の印（翌朝の日次に任せる）
  assert.equal(f('2026-11-21', '2026-11-20', '2026-11-21', true), false);    // 日次の時間帯
});
