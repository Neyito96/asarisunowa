// U1-A: read-only Universe candidate audit. Does not modify the library snapshot.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'public/library/data');
const output = resolve(process.argv[3] || 'universe-u1a-audit.json');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const excludedShows = new Set(['アルキキ', 'AJW', '朝ポキTV']);
const replayPattern = /(?:^|[（(【\[「『\\s])(?:再配信|再放送|アンコール)(?:[）)】\]」』\\s:：#]|$)/u;
const all = [];
for (const file of manifest.pages) {
  const rows = JSON.parse(await readFile(join(root, file), 'utf8'));
  all.push(...rows);
}
const seen = new Set();
const report = {sourceVersion: manifest.version, snapshotDate: manifest.snapshotDate,
  manifestTotal: manifest.total, loaded: all.length, excludedShows: {},
  replayCount: 0, replayCandidates: [], included: 0, duplicateIds: [], invalidDates: []};
for (const row of all) {
  if (seen.has(row.id)) report.duplicateIds.push(row.id);
  seen.add(row.id);
  if (!row.date || Number.isNaN(Date.parse(row.date))) report.invalidDates.push(row.id);
  if (excludedShows.has(row.show)) {
    report.excludedShows[row.show] = (report.excludedShows[row.show] || 0) + 1;
    continue;
  }
  if (replayPattern.test(row.title || '')) {
    report.replayCount++;
    report.replayCandidates.push({id: row.id, show: row.show, title: row.title, date: row.date});
    continue;
  }
  report.included++;
}
if (report.loaded !== manifest.total || report.duplicateIds.length)
  throw new Error('Snapshot count/EP-ID validation failed; no report written');
await mkdir(resolve(output, '..'), {recursive:true});
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({loaded:report.loaded, excludedShows:report.excludedShows,
  replayCount:report.replayCount, included:report.included, invalidDates:report.invalidDates.length}));
