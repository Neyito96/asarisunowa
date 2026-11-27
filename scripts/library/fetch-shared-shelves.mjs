#!/usr/bin/env node
// みんなの蔵書（#463）: 本番GAS（type=shelfPublic）が返す「公開OK」の蔵書を public/library/shelves.json に保存する。
// 返事の形がおかしい時は保存しない（前回の版を残す）。回番号は蔵の公開データにあるものだけ残す（無い回は捨てる）。
import fs from 'node:fs';
export function cleanShelves(j, knownIds) {
  if (!j || j.ok !== true || j.type !== 'shelfPublic' || !Array.isArray(j.shelves)) throw new Error('形が違う');
  const t = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  return j.shelves.filter((x) => /^SH-\d{14}-\d{3}$/.test(x?.id)).map((x) => ({
    id: x.id, date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : '', title: t(x.title, 60), description: t(x.description, 300), nick: t(x.nick, 30),
    ids: [...new Set((x.ids || []).filter((id) => /^EP-\d{5}$/.test(id) && (!knownIds || knownIds.has(id))))].slice(0, 50),
  })).filter((x) => x.ids.length).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
if (process.argv[1]?.endsWith('fetch-shared-shelves.mjs')) {
  const url = process.argv[2], out = process.argv[3] || 'public/library/shelves.json';
  const text = await (await fetch(url, { redirect: 'follow' })).text();
  let shelves;
  try {
    const known = new Set();
    for (const f of fs.readdirSync('public/library/data/details')) for (const e of JSON.parse(fs.readFileSync('public/library/data/details/' + f, 'utf8'))) known.add(e.id);
    shelves = cleanShelves(JSON.parse(text), known);
  } catch (e) { console.error('保存しない: ' + e.message + ' ' + text.slice(0, 200)); process.exit(1); }
  const next = JSON.stringify({ shelves }) + '\n';
  if (fs.existsSync(out) && fs.readFileSync(out, 'utf8') === next) { console.log('変化なし'); process.exit(0); }
  fs.writeFileSync(out, next); console.log(JSON.stringify({ shelves: shelves.length }));
}
