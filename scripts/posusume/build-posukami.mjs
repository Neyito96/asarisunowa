#!/usr/bin/env node
// ポす神回（#312）: 公開シート（承認済み・照合済みの行だけ）→ サイト用 public/posusume/posukami.json
// 使い方:
//   node scripts/posusume/build-posukami.mjs --rows <公開シートの CSV か JSON（ファイル or URL）> --podcasts <朝リスPodcast一覧 JSON（ファイル or URL）> [--submit-enabled] [--out public/posusume/posukami.json]
// 安全: 番組名が一致しない行は捨てる（posuBuildPublic）。蔵に公開中の回だけ蔵の個別ページへ、無い回は公式ページへ。
//       前回より大きく減る結果（カード数が半分未満）は書かない＝最後に正常だった版を残す。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function loadCore() { const ctx = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'scripts/google-apps-script/Posukami.js'), 'utf8'), ctx); return ctx.module.exports; }
// 素直な CSV 読み（" で囲まれた値・"" の中の " ・改行に対応）
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function libraryIds(dir) {
  const ids = {}, d = path.join(dir, 'details');
  if (!fs.existsSync(d)) return ids;
  for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) for (const e of JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) if (e && e.id) ids[e.id] = true;
  return ids;
}
async function readSource(src) { return /^https:\/\//.test(src) ? (await fetch(src)).text() : fs.readFileSync(src, 'utf8'); }
export function rowsFrom(text) {
  const t = String(text).trim();
  if (t.startsWith('[')) return JSON.parse(t);
  const rows = parseCsv(t); if (!rows.length) return [];
  return rows[0][0] === '種別' ? rows.slice(1) : rows;   // 見出し行があれば外す
}
export function build({ rows, podcasts, library, submitEnabled, generatedAt }) {
  const P = loadCore();
  return JSON.parse(JSON.stringify(P.posuBuildPublic(rows.filter((r) => r && r.length >= 12), podcasts, library, { submitEnabled: !!submitEnabled, generatedAt })));
}
async function main() {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const rowsSrc = arg('--rows'), podSrc = arg('--podcasts'), out = path.resolve(ROOT, arg('--out', 'public/posusume/posukami.json'));
  if (!rowsSrc || !podSrc) { console.error('使い方: --rows <CSV|JSON> --podcasts <JSON>'); process.exit(2); }
  const pj = JSON.parse(await readSource(podSrc)), podcasts = (pj.items || pj).map((x) => ({ id: String(x.id), title: String(x.title || '') }));
  if (!podcasts.length) throw new Error('停止: 朝リスPodcast一覧が空です');
  const json = build({ rows: rowsFrom(await readSource(rowsSrc)), podcasts, library: libraryIds(path.join(ROOT, 'public/library/data')), submitEnabled: a.includes('--submit-enabled'), generatedAt: new Date().toISOString() });
  if (fs.existsSync(out)) { const prev = JSON.parse(fs.readFileSync(out, 'utf8')); if (prev.cards && prev.cards.length >= 4 && json.cards.length < prev.cards.length / 2) throw new Error(`停止: カードが ${prev.cards.length} → ${json.cards.length} に急減。前回の版を残します`); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(json, null, 1) + '\n');
  console.log(`posukami.json: カード ${json.cards.length}・紹介回 ${json.cards.reduce((n, c) => n + c.introductions.length, 0)}・ポす神回 ${json.cards.reduce((n, c) => n + c.specials.length, 0)}・投稿受付 ${json.submitEnabled ? '有効' : '無効'}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
