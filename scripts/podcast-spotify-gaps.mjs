#!/usr/bin/env node
// READ_ONLY offline audit: 「おすすめPodcast」を CSV 書き出しした実ファイルから Spotify 欠落を数える。
// ネットワーク・Sheets・GAS には一切触れない。使い方: node scripts/podcast-spotify-gaps.mjs export.csv [--json]
import { readFileSync } from "node:fs";

export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// 列: A(0)=URL B(1)=タイトル C(2)=制作 J(9)=spotify N(13)=listen。1行目は見出し。
export function auditCsv(text, asOf = new Date().toISOString()) {
  const rows = parseCsv(text).slice(1).filter((r) => r.some((x) => String(x).trim()));
  const withListen = rows.filter((r) => String(r[13] || "").trim());
  const missing = withListen.filter((r) => !String(r[9] || "").trim());
  return {
    asOf, readOnly: true, total: rows.length, withListen: withListen.length, missingSpotify: missing.length,
    classified: 0, unclassified: missing.length,   // 分類（Spotify検索）はオフラインでは行わない
    rows: missing.map((r) => ({ title: r[1] || "", maker: r[2] || "", listen: r[13] || "" })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error("usage: podcast-spotify-gaps.mjs export.csv [--json]"); process.exit(2); }
  const r = auditCsv(readFileSync(file, "utf8"));
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else console.log(`as-of ${r.asOf} 母数 ${r.total} / LISTENあり ${r.withListen} / Spotify欠落 ${r.missingSpotify} / 分類済み ${r.classified} / 未分類 ${r.unclassified}`);
}
