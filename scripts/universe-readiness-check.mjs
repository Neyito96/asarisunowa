#!/usr/bin/env node
// READ_ONLY: public/library/data を点検(件数・除外番組・重複・必須欠落・広告混入・リンク安全性)。usage: node scripts/universe-readiness-check.mjs [dataDir] [--out file]
import fs from 'node:fs'; import path from 'node:path'; import { checkPublicSnapshot } from './lib/readiness.mjs';
const dir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'public/library/data'; const oi = process.argv.indexOf('--out');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const eps = fs.readdirSync(path.join(dir, 'details')).filter((f) => f.endsWith('.json')).flatMap((f) => { const j = JSON.parse(fs.readFileSync(path.join(dir, 'details', f), 'utf8')); return Array.isArray(j) ? j : Object.values(j); });
const rep = { dataDir: dir, snapshotDate: manifest.snapshotDate, ...checkPublicSnapshot(eps, manifest) };
if (oi > 0) fs.writeFileSync(process.argv[oi + 1], JSON.stringify(rep, null, 2)); console.log(JSON.stringify({ total: rep.total, ok: rep.ok, counts: rep.counts }));
process.exit(rep.ok ? 0 : 1);
