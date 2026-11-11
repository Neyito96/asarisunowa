#!/usr/bin/env node
// READ-ONLY: repo(+任意の本番GAS read-only export)を静的走査し、列/タブ参照表を出力。削除はしない。
// usage: node scripts/base-ledger-deps.mjs [--extra <dir-of-exported-gas>] --out docs/base-ledger-v1/dependency-inventory.json
import fs from 'node:fs'; import path from 'node:path';
import { scanSource, classifyColumn } from './lib/base-ledger.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const roots = ['scripts', 'lib', 'tests', 'public/library', ...(arg('--extra') ? [arg('--extra')] : [])];
const files = []; const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.git$/.test(e.name)) walk(p); } else if (/\.(m?js|gs|cjs|py)$/.test(e.name)) files.push(p); } };
roots.forEach(walk);
const colTotals = new Map(), tabs = new Map(), perFile = [];
for (const f of files) { const r = scanSource(f, fs.readFileSync(f, 'utf8')); if (!r.columns.length && !r.tabs.length) continue; perFile.push(r);
  for (const c of r.columns) colTotals.set(c.col0, (colTotals.get(c.col0) || 0) + c.refs); for (const t of r.tabs) (tabs.get(t) || tabs.set(t, []).get(t)).push(f); }
const columns = [...colTotals].sort((a, b) => a[0] - b[0]).map(([c, n]) => ({ col0: c, colLetter: c < 26 ? String.fromCharCode(65 + c) : 'A' + String.fromCharCode(65 + c - 26), refs: n, ...classifyColumn(c, n) }));
const result = { readOnly: true, scannedFiles: files.length, limitation: '本番GAS(ALIB_AUTO_tick/P15)はrepo外。--extraで読み取り専用exportを渡すまで55列/44タブの網羅棚卸しは不可。', columns, tabs: [...tabs].map(([t, f]) => ({ tab: t, files: f })), perFile };
const o = arg('--out'); if (o) fs.writeFileSync(o, JSON.stringify(result, null, 2)); console.log(JSON.stringify({ scannedFiles: files.length, referencedColumns: columns.length, tabs: tabs.size }));
