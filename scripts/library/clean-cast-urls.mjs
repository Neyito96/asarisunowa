#!/usr/bin/env node
// #309: 蔵の出演者欄に残っている URL（旧データの X プロフィールなど）を外す。台帳（V2）は変えない。
// 人名・所属の文字はそのまま。URL と、URL を外した後に残る区切り（, や空白）だけを整える。
import fs from 'node:fs';
const DIR = process.argv[2] || 'public/library/data/details';
export function stripCastUrls(cast) {
  return String(cast || '').split(' / ').map((part) => part
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s*[,、]\s*(?=[,、]|$)/g, '')   // 外した後に残った区切り
    .replace(/\s{2,}/g, ' ').trim()).filter(Boolean).join(' / ');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  let changed = 0; const samples = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
    const p = `${DIR}/${f}`, raw = fs.readFileSync(p, 'utf8'), data = JSON.parse(raw); let dirty = false;
    for (const e of data) {
      if (!/https?:\/\//.test(String(e.cast || ''))) continue;
      const next = stripCastUrls(e.cast);
      if (next !== e.cast) { if (samples.length < 6) samples.push([e.id, e.cast, next]); e.cast = next; changed++; dirty = true; }
    }
    if (dirty) fs.writeFileSync(p, JSON.stringify(data) + (raw.endsWith('\n') ? '\n' : ''));
  }
  console.log(JSON.stringify({ changed, samples }, null, 1));
}
