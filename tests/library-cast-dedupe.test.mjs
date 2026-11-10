import test from 'node:test';
import assert from 'node:assert/strict';
import {dedupeCast, publicEpisode} from '../public/library/library-core.mjs';
test('X column and AT-AX columns for the same people are shown once', () => {
  assert.equal(dedupeCast(['宮沢賢一 / 神田大介 / 安田桂子', '宮沢賢一', '神田大介', '安田桂子', '', '']), '宮沢賢一 / 神田大介 / 安田桂子');
  assert.equal(dedupeCast(['五十嵐大介,編集委員 / 真海喬生,経済部', '五十嵐大介,編集委員', '真海喬生,経済部']), '五十嵐大介,編集委員 / 真海喬生,経済部');
});
test('keeps the titled entry that appears first and does not drop different people', () => {
  assert.equal(dedupeCast(['中島晋也,デジタル編成本部次長', '中島晋也', '飯島啓史']), '中島晋也,デジタル編成本部次長 / 飯島啓史');
  assert.equal(dedupeCast(['', '', '山田', '田中']), '山田 / 田中');
  assert.equal(dedupeCast([]), '');
});
test('publicEpisode uses person-level de-duplication', () => {
  const row = Array(55).fill(''); row[0]='EP-00001'; row[1]='番組'; row[2]='題'; row[3]='2026/10/13 4:00'; row[23]='A / B'; row[45]='A'; row[46]='B'; row[47]='C';
  assert.equal(publicEpisode(row).cast, 'A / B / C');
});
test('single-digit hour in ledger date keeps its time', () => {
  const row = Array(55).fill(''); row[0]='EP-00001'; row[1]='番組'; row[2]='題'; row[3]='2026/11/10 4:00';
  assert.equal(publicEpisode(row).date, '2026-11-10T04:00:00+09:00');
});
