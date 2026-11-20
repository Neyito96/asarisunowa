#!/usr/bin/env node
// #395: 台帳で置き換えた旧URLを蔵の公開データから取り除く（蔵の同期はリンクを足すだけで消さないため）。
// 対象は記録ファイルの changes[].old と完全一致し、かつ同じ回に changes[].new が入っているものだけ。
import fs from 'node:fs';
const REC = process.argv[2] || 'docs/audits/sdgs-archive/2026-11-20-pocketcasts-ledger-update.json';
const DIR = 'public/library/data/details';
const rec = JSON.parse(fs.readFileSync(REC, 'utf8'));
const byId = new Map(rec.changes.map((c) => [c.id, c]));
let removed = 0, skipped = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const p = `${DIR}/${f}`, raw = fs.readFileSync(p, 'utf8'), data = JSON.parse(raw);
  let changed = false;
  for (const e of data) {
    const c = byId.get(e.id);
    if (!c || !c.old || !(e.links || []).includes(c.old)) continue;
    if (!e.links.includes(c.new)) { skipped++; continue; }   // 新URLが無い回は触らない
    e.links = e.links.filter((u) => u !== c.old); removed++; changed = true;
  }
  if (changed) fs.writeFileSync(p, JSON.stringify(data) + (raw.endsWith('\n') ? '\n' : ''));
}
console.log(JSON.stringify({ removed, skipped }));
