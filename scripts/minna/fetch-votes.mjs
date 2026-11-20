#!/usr/bin/env node
// みんなで仕分け: 本番GAS（type=bunruiPublic）の集計を public/minna/votes.json に保存する。
// 返事の形がおかしい時は保存しない（前回の版を残す）。ニックネーム・ひとこと・端末は GAS 側で出していない
import fs from 'node:fs';
const url = process.argv[2], out = process.argv[3] || 'public/minna/votes.json';
const res = await fetch(url, { redirect: 'follow' });
const text = await res.text();
let j; try { j = JSON.parse(text); } catch { console.error('JSON ではない'); process.exit(1); }
if (!j || j.ok !== true || j.type !== 'bunruiPublic' || typeof j.votes !== 'object') { console.error('形が違う: ' + text.slice(0, 200)); process.exit(1); }
const votes = {};
for (const [ep, v] of Object.entries(j.votes)) {
  if (!/^EP-\d{5}$/.test(ep) || !v || typeof v.n !== 'number') continue;
  votes[ep] = { n: v.n, main: v.main || {}, sub: v.sub || {}, unsure: v.unsure || 0 };
}
const next = { generatedAt: j.generatedAt, episodes: Object.keys(votes).length, contributors: j.contributors || 0, votes };
const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
const body = JSON.stringify(next) + '\n';
if (prev && JSON.stringify({ ...JSON.parse(prev), generatedAt: 0 }) === JSON.stringify({ ...next, generatedAt: 0 })) { console.log('変化なし'); process.exit(0); }
fs.writeFileSync(out, body); console.log(JSON.stringify({ episodes: next.episodes, contributors: next.contributors }));
