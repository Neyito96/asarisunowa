#!/usr/bin/env node
// READ_ONLY: 共同編集シート書き出し(または今後のAPI生JSON)と台帳側の識別子から、母集団分離・重複根拠・強識別子照合・調査キューを出力する。
// 使い方: node scripts/onsa-audit.mjs --onsa-sheet <書き出し.txt> [--onsa <API生JSON>] --screenshot 5512 --screenshot-at 2026-11-10T09:14:00+09:00 [--out dir]
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "./lib/ledger-csv.mjs";
import { projectApi, sheetExportToApiJson } from "./lib/onsa-count.mjs";
import { auditOnsa, applyLedgerColumns, compareSources } from "./lib/onsa-audit.mjs";
import { oldGuidsFromCsv } from "./ledger-increment-judge.mjs";

export function repoRecords(root = ".") {
  const out = [], dir = `${root}/public/library/data/details`;
  for (const f of readdirSync(dir)) if (f.endsWith(".json")) for (const e of JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))) out.push({ id: e.id, show: e.show, title: e.title, publishedAt: e.date, links: e.links || [] });
  const rem = `${root}/docs/audits/2026-10-22-publication-scope/removed-from-publication.csv.gz`;                 // 公開から外れた618: 強IDなし（題名+日付のみ）
  for (const r of parseCsv(gunzipSync(readFileSync(rem)).toString("utf8").replace(/^﻿/, "")).slice(1)) if (r[0]) out.push({ id: r[0], show: r[1], title: r[2], publishedAt: r[3], links: [] });
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), arg = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const root = arg("--repo", "."), asOf = arg("--as-of", new Date().toISOString()), outDir = arg("--out", `${root}/docs/audits/2026-11-10-increment`);
  const snap = JSON.parse(gunzipSync(readFileSync(`${root}/docs/audits/2026-10-22-publication-scope/decisions.json.gz`)).toString());
  const records = repoRecords(root);
  const newCsv = parseCsv(readFileSync(`${root}/docs/audits/2026-11-10-increment/ledger-new-100-public-metadata.csv`, "utf8").replace(/^﻿/, ""));
  for (const r of newCsv.slice(1)) records.push({ id: r[0], show: r[1], title: r[2], publishedAt: r[3], links: [], guid: r[6] });   // 新100件: 外部ID(GUID)のみ
  for (const [g, o] of oldGuidsFromCsv(readFileSync(`${root}/docs/audits/2026-11-10-increment/old-guid-evidence.csv`, "utf8"))) { const r = records.find((x) => x.id === o.id); if (r) r.guid = g; }
  const evidence = oldGuidsFromCsv(readFileSync(`${root}/docs/audits/2026-11-10-increment/old-guid-evidence.csv`, "utf8"));
  for (const r of records) { const g = (r.guid || "").toLowerCase(); const o = g && evidence.get(g); if (o && o.id !== r.id) r.duplicateOf = o.id; }     // 新06595-97 は旧03857/58/61 の重複確定行
  let apiJson, extra = {}, source;
  if (arg("--onsa")) { apiJson = JSON.parse(readFileSync(arg("--onsa"), "utf8")); source = "API生JSON"; }
  else { const s = sheetExportToApiJson(readFileSync(arg("--onsa-sheet"), "utf8"), parseCsv); apiJson = s.api; extra = s.extra; source = "共同編集シート書き出し（API本体ではない）"; }
  const projection = projectApi(apiJson, { asOf: arg("--screenshot-at", asOf) });
  const baseCmp = snap.decisions.filter((d) => d.comparison === "対象" && d.publication === "対象").map((d) => d.id);
  const mk = (recs) => auditOnsa({ projection, extra, records: recs, decisions: snap.decisions, baselineComparisonIds: baseCmp, asOf,
    screenshot: arg("--screenshot") ? { value: Number(arg("--screenshot")), asOf: arg("--screenshot-at"), kind: "管理人スクショ（画面カウンタ）" } : null, sheetMeta: { source, exportedAt: arg("--sheet-exported-at", "不明（添付ファイルに時刻情報なし）"), note: "シート書き出し・スクショ・API実取得は別時点。API実取得は未取得" } });
  const clone = (rs) => rs.map((r) => ({ ...r, links: [...(r.links || [])] }));
  const publicOnly = mk(clone(records));
  // 本番台帳の識別子（READ_ONLYで得た根拠）: ①司令塔が本番台帳で直接確認した照合証拠CSV ②本番台帳の書き出し(G/I/J/L列)
  const enrichedRecords = clone(records); const ev = { lookupEvidence: [], ledgerColumns: null };
  if (arg("--lookup-evidence")) for (const r of parseCsv(readFileSync(arg("--lookup-evidence"), "utf8").replace(/^\uFEFF/, "")).slice(1)) { const rec = enrichedRecords.find((x) => x.id === r[0]); if (rec && r[2]) { rec.links.push(r[2]); ev.lookupEvidence.push({ ep: r[0], column: r[1], url: r[2], source: r[3] }); } }
  if (arg("--ledger-columns")) { const res = applyLedgerColumns(enrichedRecords, parseCsv(readFileSync(arg("--ledger-columns"), "utf8").replace(/^\uFEFF/, "")), (arg("--ledger-cols", "G,I,J,L")).split(",")); ev.ledgerColumns = { rowsUsed: res.added.length, unknownIds: res.unknownIds, cols: arg("--ledger-cols", "G,I,J,L") }; }
  const report = mk(enrichedRecords);
  report.sourceComparison = ev.lookupEvidence.length || ev.ledgerColumns ? { evidence: ev, ...compareSources(publicOnly, report) } : { status: "unavailable", note: "本番台帳の列(G/I/J/L)も照合証拠も未提供。公開JSON由来の識別子のみで照合" };
  mkdirSync(outDir, { recursive: true }); writeFileSync(`${outDir}/onsa-audit.json`, JSON.stringify(report, null, 1));
  const { populations: p, matching: m } = report;
  console.log(JSON.stringify({ sourceComparison: report.sourceComparison?.changedItems, holdKinds: report.hold.byKind, label: report.label, populations: { ui: p.sheetUiEntries, unique: p.uniqueLinkCount, dup: p.duplicateEntries, screenshot: p.screenshot?.value, baseline: p.baselineComparison.count }, gaps: p.gaps, matching: { quality: m.byQuality, agreement: m.agreement, keys: m.strongKeyAvailability }, tiers: report.diffCategoriesByTier, unmatched: report.unmatchedOnsa.count, unmatchedP: report.unmatchedOnsa.byPriority, oldOnly: report.oldComparisonOnly.count, oldOnlyP: report.oldComparisonOnly.byPriority, hold: report.hold.count }, null, 1));
}
