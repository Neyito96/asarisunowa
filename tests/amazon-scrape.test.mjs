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
