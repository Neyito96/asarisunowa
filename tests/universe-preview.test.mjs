import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPreview, classifyNewRow, parseCsv} from '../scripts/build-universe-preview.mjs';
const row = (id, show, title, date, over = {}) => { const r = Array(55).fill(''); r[0] = id; r[1] = show; r[2] = title; r[3] = date; r[11] = over.spotify || ''; r[21] = over.desc || '概要'; r[38] = over.hx || '未指定'; r[23] = over.cast || ''; return r; };
const ep = (id, show, title, links = []) => ({id, show, title, date: '2026-10-13T04:00:00+09:00', cast: '', description: 'd', descriptionSource: 'clean', duration: 0, audio: '', audioAvailable: false, links, related: []});
const snap = decisions => ({schema: 1, source: {rawReadSHA256: 'a'.repeat(64)}, decisions: decisions.map(([id, show, pub]) => ({id, show, comparison: pub, publication: pub, classification: '通常', review: '確認済み', decidedAt: '2026-10-22T00:00:00Z'}))});
test('csv parser keeps quoted commas, newlines and quotes', () => {
  assert.deepEqual(parseCsv('a,"b,c","d\ne""f"\n')[0], ['a', 'b,c', 'd\ne"f']);
});
test('classification: policy, exclusion, missing date, duplicate title, provisional target', () => {
  const t = new Set(['ドーナツ|同じ題']);
  assert.equal(classifyNewRow(row('EP-1', 'アルキキ', 'x', '2026/11/1'), t).publication, '対象外');
  assert.equal(classifyNewRow(row('EP-1', 'ドーナツ', 'x', ''), t).reason, 'MISSING_SHOW_TITLE_OR_DATE');
  assert.equal(classifyNewRow(row('EP-1', 'ドーナツ', '同じ 題', '2026/11/1'), t).reason, 'SAME_SHOW_TITLE_AS_EXISTING');
  assert.equal(classifyNewRow(row('EP-1', 'ドーナツ', '新', '2026/11/1'), t).publication, '対象');
});
test('preview adds only provisional rows, keeps existing, refreshes missing Spotify link, labels unreviewed', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'pv-')), 'out');
  const existing = [ep('EP-00001', 'ドーナツ', '既存', ['https://omny.fm/a']), ep('EP-00002', 'ドーナツ', '既存2', ['https://open.spotify.com/episode/abc'])];
  const s = snap([['EP-00001', 'ドーナツ', '対象'], ['EP-00002', 'ドーナツ', '対象']]);
  const rows = [row('EP-00001', 'ドーナツ', '既存', '2026/10/13 4:00', {spotify: 'https://open.spotify.com/episode/zzz111'}), row('EP-00002', 'ドーナツ', '既存2', '2026/10/13 4:00'),
    row('EP-00003', 'ドーナツ', '新着A', '2026/11/10 4:00'), row('EP-00004', 'ドーナツ', '既存', '2026/11/10 4:00'), row('EP-00005', 'AJW', 'p', '2026/11/10 4:00'), row('EP-00006', 'ドーナツ', '日付なし', '')];
  const {result, report} = await buildPreview({ledgerRows: rows, existingDetails: existing, decisionSnapshot: s, destination: dir, snapshotDate: '2026-11-10'});
  assert.equal(report.newTotal, 3); assert.equal(report.provisionalAdded, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(report.linkRefresh)), ['EP-00001']);
  assert.equal(report.holds.SAME_SHOW_TITLE_AS_EXISTING, 1); assert.equal(report.holds.POLICY_SHOW, 1); assert.equal(report.holds.MISSING_SHOW_TITLE_OR_DATE, 1);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.total, 3); assert.equal(manifest.counts.provisionalUnreviewed, 1); assert.ok(result.version);
});
test('existing ledger-derived ids are never dropped or renumbered', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'pv-')), 'out');
  const existing = [ep('EP-00001', 'ドーナツ', 'a'), ep('EP-00002', 'ドーナツ', 'b')];
  const {report} = await buildPreview({ledgerRows: [], existingDetails: existing, decisionSnapshot: snap([['EP-00001', 'ドーナツ', '対象'], ['EP-00002', 'ドーナツ', '対象']]), destination: dir, snapshotDate: '2026-11-10'});
  assert.equal(report.newTotal, 2);
});
test('compact 22-column export expands back to ledger positions', async () => {
  const {COMPACT_COLS, expandCompact} = await import('../scripts/build-universe-preview.mjs');
  const r = COMPACT_COLS.map((c, i) => 'v' + c); const full = expandCompact(r);
  assert.equal(full.length, 55); assert.equal(full[38], 'v38'); assert.equal(full[49], 'v49'); assert.equal(full[4], '');
});
