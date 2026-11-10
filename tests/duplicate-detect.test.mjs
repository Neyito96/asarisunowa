import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findDuplicateCandidates, comparePair, checkIncoming, minuteUtc, spotifyId} from '../public/library/duplicate-detect.mjs';
import {auditRow} from '../public/library/gap-audit.mjs';
const fx = JSON.parse(readFileSync(new URL('./fixtures/duplicate-icc-2026-11-10.json', import.meta.url), 'utf8')).records;
test('ICC case: EP-00418 canonical, EP-06591 duplicate-hold (one-kanji title diff, GUID missing, date notation differs)', () => {
  const r = findDuplicateCandidates(fx, {decisions: {'EP-06591': '保留'}});
  assert.equal(r.pairs.length, 1); const p = r.pairs[0];
  assert.equal(p.verdict, 'CANDIDATE_DUPLICATE'); assert.equal(p.canonical, 'EP-00418'); assert.equal(p.duplicateHold, 'EP-06591');
  assert.ok(p.evidence.spotifyEqual && p.evidence.dateEqual && p.evidence.guidMissing && p.evidence.titleDistance === 1);
  assert.ok(p.reasons.includes('TITLE_ONE_CHAR_DIFF') && p.reasons.includes('GUID_MISSING'));
  assert.match(p.note, /削除・統合・ID変更・公開追加はしない/);
});
test('dates: JST ledger notation equals ISO with +09:00; timezone-only offsets are suspects not duplicates', () => {
  assert.equal(minuteUtc('2026/8/26 4:00'), minuteUtc('2026-08-25T19:00:00Z'));
  const a = {id: 'A', show: 'S', title: '同じ題名の回です', date: '2026-08-26T04:00:00+09:00'}, b = {id: 'B', show: 'S', title: '同じ題名の回です', date: '2026-08-26T04:00:00Z'};
  const c = comparePair(a, b); assert.equal(c.verdict, 'HOLD_AMBIGUOUS'); assert.ok(c.reasons.includes('TZ_OFFSET_SUSPECT'));
});
test('ambiguous / distinct cases never become candidates; human double-confirmation is left alone', () => {
  const x = {id: 'A', show: 'S', title: '夏の特集 前編', date: '2026-08-26T04:00:00+09:00', guid: 'g1'}, y = {id: 'B', show: 'S', title: '夏の特集 後編', date: '2026-08-27T04:00:00+09:00', guid: 'g2'};
  assert.equal(findDuplicateCandidates([x, y]).pairs.length, 0);
  const s = 'https://open.spotify.com/episode/02JGdAOh1TT4QxGbFDDXRq'; assert.equal(spotifyId(s), '02JGdAOh1TT4QxGbFDDXRq');
  const r = findDuplicateCandidates(fx, {decisions: {'EP-00418': '確定', 'EP-06591': '確定'}}); assert.equal(r.pairs[0].verdict, 'HOLD_CONFLICT_NEEDS_HUMAN');
});
test('incoming guard: a second feed copy with missing GUID is held, unrelated item is added', () => {
  assert.equal(checkIncoming({id: 'NEW', show: 'ニュースの学校', title: 'ICC赤根知子所長への制裁', date: '2026/8/26 4:00', spotify: 'https://open.spotify.com/episode/02JGdAOh1TT4QxGbFDDXRq'}, fx).action, 'HOLD_DUPLICATE_CANDIDATE');
  assert.equal(checkIncoming({id: 'NEW', show: 'ニュースの学校', title: '全く別の回', date: '2026/9/1 4:00', guid: 'zz'}, fx).action, 'ADD');
});
test('Phase26: duplicate-hold rows are not treated as new missing-description episodes', () => {
  const row = new Array(55).fill(''); row[0] = 'EP-06591';
  const au = auditRow(row, {now: Date.now(), pubDate: Date.now() - 9e9, duplicateOf: 'EP-00418'});
  const miss = au.filter(c => c.status !== 'FILLED'); assert.ok(miss.length > 0);
  assert.ok(miss.every(c => c.status === 'HOLD' && c.reason === 'DUPLICATE_HOLD' && c.duplicateOf === 'EP-00418'));
});
test('same EP-ID appearing twice is never paired with itself', () => {
  assert.equal(findDuplicateCandidates([fx[0], {...fx[0]}]).pairs.length, 0);
});
