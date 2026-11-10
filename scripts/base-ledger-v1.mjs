#!/usr/bin/env node
// READ-ONLY / オフライン。入力: 台帳エクスポートCSV(ヘッダ付き)。出力: 基本台帳v1 View・EP_PLATFORM_LINKS・除外集計・依存棚卸し。
// 台帳・GAS・シートへは一切書き込まない。使い方: node scripts/base-ledger-v1.mjs --ledger ledger.csv [--p15 p15.json] [--decisions decisions.json.gz] --out dir
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import crypto from 'node:crypto';
import { buildBaseView, buildPlatformLinks, checkInvariants, BASE_V1_HEADERS, classifyColumn, scanSource } from './lib/base-ledger.mjs';

function parseCsv(t) { const rows = []; let r = [], f = '', q = false; t = t.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (c !== '\r') f += c; }
  if (f || r.length) { r.push(f); rows.push(r); } return rows; }
const esc = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const toCsv = (h, rows) => '﻿' + [h, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

const ledgerPath = arg('--ledger'), out = arg('--out');
if (!ledgerPath || !out) { console.error('usage: --ledger <csv> --out <dir> [--p15 json] [--decisions gz]'); process.exit(2); }
const raw = fs.readFileSync(ledgerPath); const all = parseCsv(raw.toString('utf8')); const rows = all.slice(1);
const p15 = arg('--p15') ? JSON.parse(fs.readFileSync(arg('--p15'), 'utf8')) : [];
const decisions = new Map();
if (arg('--decisions')) for (const d of JSON.parse(zlib.gunzipSync(fs.readFileSync(arg('--decisions')))).decisions) decisions.set(d.id, d);
const links = buildPlatformLinks(rows, p15); const view = buildBaseView(rows, { links, decisions });
const inv = checkInvariants(rows, rows, { links });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'base-ledger-v1.csv'), toCsv(BASE_V1_HEADERS, view));
fs.writeFileSync(path.join(out, 'ep-platform-links.csv'), toCsv(['EP_ID', 'platform', 'url', 'status', 'retryable', 'evidence', 'last_checked', 'probed'], links.map((l) => [l.ep_id, l.platform, l.url, l.status, l.retryable, l.evidence, l.last_checked, l.probed])));
const manifest = { generatedBy: 'scripts/base-ledger-v1.mjs', readOnly: true, inputSha256: crypto.createHash('sha256').update(raw).digest('hex'), rows: rows.length, invariants: inv, statusCounts: links.reduce((a, l) => (a[`${l.platform}:${l.status}`] = (a[`${l.platform}:${l.status}`] || 0) + 1, a), {}) };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ rows: rows.length, invariants: inv.ok, links: links.length }));
process.exit(inv.ok ? 0 : 1);
