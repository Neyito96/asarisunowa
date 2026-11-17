#!/usr/bin/env node
// Validate the published snapshot without changing the V2 ledger.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public/library/data');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const errors = [];
const seen = new Map();
let total = 0;
for (const show of manifest.shows) {
  let count = 0;
  for (const rel of show.pages) {
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep)) { errors.push('unsafe page path: ' + rel); continue; }
    if (!fs.existsSync(file)) { errors.push('missing page: ' + rel); continue; }
    const records = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(records)) { errors.push('not an array: ' + rel); continue; }
    for (const ep of records) {
      count++; total++;
      if (!/^EP-\d{5}$/.test(String(ep.id || ''))) errors.push('invalid EP-ID: ' + ep.id);
      if (ep.show !== show.name) errors.push('show mismatch: ' + ep.id);
      if (seen.has(ep.id)) errors.push('duplicate EP-ID: ' + ep.id + ' (' + seen.get(ep.id) + ', ' + rel + ')');
      seen.set(ep.id, rel);
    }
  }
  if (count !== show.count) errors.push(show.name + ': manifest=' + show.count + ' actual=' + count);
}
if (total !== manifest.total) errors.push('total: manifest=' + manifest.total + ' actual=' + total);
const c = manifest.counts || {};
if (Number.isFinite(c.source) && Number.isFinite(c.scopeExcluded) && Number.isFinite(c.scopeHeld) &&
    c.source - c.scopeExcluded - c.scopeHeld !== manifest.total) {
  errors.push('source/scope totals differ; inspect policy and generation metadata');
}
const summary = { generatedAt: manifest.generatedAt, total, uniqueIds: seen.size, shows: manifest.shows.length, errors };
console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
