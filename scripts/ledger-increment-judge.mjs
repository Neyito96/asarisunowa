#!/usr/bin/env node
// READ_ONLY: 台帳書き出し(CSV/JSON) → 新着EP-IDの判定manifest・掲載件数・（任意）おんさ比較差分。本番シート/GAS/ネットワークに触れない。
// 使い方: node scripts/ledger-increment-judge.mjs --ledger ledger.csv [--baseline decisions.json.gz] [--onsa onsa.json] [--out dir] [--as-of ISO]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "./lib/ledger-csv.mjs";
import { judgeIncrement, recountPublication, classifyOnsaDiff } from "./lib/ledger-increment.mjs";

const ALIAS = { id: ["EP-ID", "EPID", "エピソードID"], show: ["番組", "番組名"], title: ["タイトル", "エピソードタイトル", "題名"], publishedAt: ["配信日時", "配信日", "公開日時"], guid: ["GUID", "UUID", "GUID/UUID", "公式GUID", "公式識別子"], audioUrl: ["音声URL"] };
export function ledgerFromRows(table) {
  const head = table[0].map((h) => String(h).trim()), idx = {};
  for (const [k, names] of Object.entries(ALIAS)) idx[k] = head.findIndex((h) => names.includes(h));
  const missing = ["id", "show", "title", "publishedAt"].filter((k) => idx[k] < 0);
  if (missing.length) throw new Error("LEDGER_HEADER_UNMAPPED: " + missing.join(",") + " / headers=" + head.join("|"));
  return table.slice(1).filter((r) => String(r[idx.id] || "").trim()).map((r) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, i < 0 ? "" : String(r[i] ?? "").trim()])));
}
const load = (p) => { const b = readFileSync(p); return p.endsWith(".gz") ? gunzipSync(b).toString("utf8") : b.toString("utf8"); };

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), arg = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const ledgerPath = arg("--ledger");
  if (!ledgerPath) { console.error("usage: --ledger <csv|json> [--baseline] [--onsa] [--out] [--as-of]"); process.exit(2); }
  const asOf = arg("--as-of", new Date().toISOString()), outDir = arg("--out", "docs/audits/2026-11-10-increment");
  const snap = JSON.parse(load(arg("--baseline", "docs/audits/2026-10-22-publication-scope/decisions.json.gz")));
  const text = load(ledgerPath), ledger = ledgerPath.endsWith(".json") ? JSON.parse(text) : ledgerFromRows(parseCsv(text));
  const res = judgeIncrement(ledger, snap.decisions);
  if (!res.ok) { console.error("STOP", JSON.stringify(res)); process.exit(3); }
  const recount = recountPublication({ baselineAdopted: snap.decisions.filter((d) => d.publication === "対象").length, baselineSource: snap.decisions.length, baselineDate: "2026-10-22", judged: res.rows, asOf });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/increment-manifest.json`, JSON.stringify({ schema: 1, policy: res.policy, asOf, rows: res.rows }, null, 1));
  writeFileSync(`${outDir}/publication-recount.json`, JSON.stringify(recount, null, 1));
  if (arg("--onsa")) {
    const baseCmp = snap.decisions.filter((d) => d.comparison === "対象" && d.publication === "対象").map((d) => d.id);
    const diff = classifyOnsaDiff({ onsaItems: JSON.parse(load(arg("--onsa"))), ledger, baselineComparisonIds: baseCmp, baselineSnapshotDate: "2026-10-21", onsaAsOf: asOf, decisions: snap.decisions });
    writeFileSync(`${outDir}/onsa-diff.json`, JSON.stringify(diff, null, 1));
  }
  console.log(JSON.stringify({ asOf, newRows: res.rows.length, ...recount }, null, 1));
}
