#!/usr/bin/env node
// #395: 台帳で置き換えたリンクを蔵の公開データにも反映する（旧URL → 新URL）。蔵の同期はリンクを足すだけで消さないため、
// 置き換えは記録ファイル（changes[].old / changes[].new）にある回だけ、旧URLと完全一致するものだけを入れ替える。
// その後、正規の writePublicLibrarySnapshot で書き直し、データの版番号も更新する（ブラウザが古いデータを使い続けないように）。
// 使い方: node scripts/library/apply-replaced-links.mjs docs/audits/sdgs-archive/2026-11-21-spotify-ledger-update.json
import fs from 'node:fs';
import path from 'node:path';
import { loadPublic } from '../library-sync-v2.mjs';
import { writePublicLibrarySnapshot } from '../library-publication-files.mjs';
const REC = process.argv[2]; if (!REC) { console.error('記録ファイルを指定してください'); process.exit(2); }
const dest = path.resolve('public/library/data');
const rec = JSON.parse(fs.readFileSync(REC, 'utf8'));
const pub = loadPublic(dest);
let replaced = 0, already = 0, missing = 0;
for (const c of rec.changes) {
  const e = pub.get(c.id); if (!e) { missing++; continue; }
  const links = e.links || [];
  if (!links.includes(c.old)) { if (links.includes(c.new)) already++; else missing++; continue; }
  e.links = [...new Set(links.map((u) => (u === c.old ? c.new : u)))]; replaced++;
}
if (missing) { console.error(JSON.stringify({ stop: '旧URLも新URLも無い回がある', missing })); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
const scope = JSON.parse(fs.readFileSync(path.join(dest, 'scope.json'), 'utf8'));
const result = await writePublicLibrarySnapshot({ episodes: [...pub.values()], counts: manifest.counts, publicationScope: scope, snapshotDate: manifest.snapshotDate, operations: { ...(manifest.operations || {}), replacedLinks: { record: REC, replaced, already, at: new Date().toISOString() } }, destination: dest });
console.log(JSON.stringify({ replaced, already, version: result?.version ?? null }));
