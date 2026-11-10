#!/usr/bin/env node
// READ_ONLY 単一CLI: 台帳CSV(+任意のfixture)から 6社URL探索→proposals/日次レポート/manifest を出力。台帳・シート・Spotifyへ書き込まない。
// usage: node scripts/platform-url-bot.mjs --ledger ledger.csv --fixtures fixtures.json --out dir [--state state.json] [--previous report.json] [--now ISO]
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { LEDGER_COL, PLATFORMS } from './lib/base-ledger.mjs';
import { runBot, planFills, nextState, buildReport, BOT_PLATFORMS } from './lib/platform-resolver.mjs';
import { ROUTES } from './lib/platform-adapters.mjs';
function parseCsv(t) { const rows = []; let r = [], f = '', q = false; t = t.replace(/^﻿/, ''); for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (c !== '\r') f += c; } if (f || r.length) { r.push(f); rows.push(r); } return rows; }
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ledger = arg('--ledger'), out = arg('--out'); if (!ledger || !out) { console.error('usage: --ledger <csv> --out <dir> [--fixtures json] [--state json] [--previous json] [--now ISO]'); process.exit(2); }
const raw = fs.readFileSync(ledger); const rows = parseCsv(raw.toString('utf8')).slice(1).filter((r) => r[0]);
const fx = arg('--fixtures') ? JSON.parse(fs.readFileSync(arg('--fixtures'), 'utf8')) : { showUrls: {}, candidates: {} };
const state = arg('--state') ? JSON.parse(fs.readFileSync(arg('--state'), 'utf8')) : {}; const previous = arg('--previous') ? JSON.parse(fs.readFileSync(arg('--previous'), 'utf8')) : null;
const now = arg('--now') ? Date.parse(arg('--now')) : Date.now();
const colOf = Object.fromEntries(PLATFORMS.filter((p) => BOT_PLATFORMS.includes(p.key)).map((p) => [p.key, p.cols[0]]));
const inputs = rows.map((r) => ({ epId: r[0], showTitle: r[1], title: r[2], publishedAt: r[3], guid: r[LEDGER_COL.guid], officialUrl: r[LEDGER_COL.officialPage], showUrls: fx.showUrls?.[r[1]] || {}, existing: Object.fromEntries(BOT_PLATFORMS.map((p) => [p, r[colOf[p]] || ''])) }));
const fetchers = Object.fromEntries(Object.entries(fx.candidates || {}).map(([p, byEp]) => [p, { candidates: async (i) => { const v = byEp[i.epId]; if (v?.error) { const { classifyHttp } = await import('./lib/platform-resolver.mjs'); throw classifyHttp(v.error, v.retryAfter); } return { candidates: v?.candidates || [] }; } }]));
const result = await runBot(inputs, { fetchers, now, state, limit: Number(arg('--limit')) || Infinity, backfillLimit: Number(arg('--backfill-limit')) || 50 });
const cells = {}; for (const i of inputs) for (const p of BOT_PLATFORMS) if (i.existing[p]) cells[`${i.epId}|${p}`] = i.existing[p];
const fills = planFills(result.records, cells); const report = buildReport(inputs, result, { previous, routes: ROUTES, now });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'proposals.json'), JSON.stringify(fills, null, 2)); fs.writeFileSync(path.join(out, 'records.json'), JSON.stringify(result.records, null, 2));
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); fs.writeFileSync(path.join(out, 'state.json'), JSON.stringify(nextState(state, result.records), null, 2));
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ readOnly: true, write: false, inputSha256: crypto.createHash('sha256').update(raw).digest('hex'), rows: rows.length, proposals: fills.length, warnings: report.warnings.length }, null, 2));
console.log(JSON.stringify({ rows: rows.length, proposals: fills.length, warnings: report.warnings.length, readOnly: true }));
