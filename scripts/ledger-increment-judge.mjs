#!/usr/bin/env node
// READ_ONLY: 台帳書き出し(CSV/JSON) → 新着EP-IDの判定manifest・掲載件数・（任意）おんさ比較差分。本番シート/GAS/ネットワークに触れない。
// 完全照合: --ledger <旧+新の全行CSV>     増分: --increment <新100行CSV> --audit-evidence "<旧全件存在・ID一意の外部確認>" [--old-guids old-guid-evidence.csv]
// 共通: [--baseline decisions.json.gz] [--onsa onsa-api.json] [--out dir] [--as-of ISO]
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { parseCsv } from "./lib/ledger-csv.mjs";
import { projectApi, sheetExportToApiJson } from "./lib/onsa-count.mjs";
import { guidOf, judgeIncrement, recountPublication, classifyOnsaDiff } from "./lib/ledger-increment.mjs";

const ALIAS = { id: ["台帳ID", "EP-ID", "EPID", "エピソードID"], show: ["番組名", "番組"], title: ["タイトル", "エピソードタイトル", "題名"], publishedAt: ["配信日時（JST）", "配信日時(JST)", "配信日時", "配信日", "公開日時"], guid: ["外部ID", "GUID", "UUID", "GUID/UUID", "公式GUID", "公式識別子"], audioUrl: ["音声URL"], spotifyUrl: ["Spotify URL", "SpotifyURL", "SpotifyエピソードURL"] };
export function ledgerFromRows(table) {
  const head = table[0].map((h) => String(h).trim()), idx = {};
  for (const [k, names] of Object.entries(ALIAS)) idx[k] = head.findIndex((h) => names.includes(h));
  const missing = ["id", "show", "title", "publishedAt"].filter((k) => idx[k] < 0);
  if (missing.length) throw new Error("LEDGER_HEADER_UNMAPPED: " + missing.join(",") + " / headers=" + head.join("|"));
  return table.slice(1).filter((r) => String(r[idx.id] || "").trim()).map((r) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, i < 0 ? "" : String(r[i] ?? "").trim()])));
}
const load = (p) => { const b = readFileSync(p); return p.endsWith(".gz") ? gunzipSync(b).toString("utf8") : b.toString("utf8"); };

// 旧側の公式GUID証拠CSV（旧EP-ID,公式GUID,出典）
export function oldGuidsFromCsv(text) {
  const m = new Map();
  for (const r of parseCsv(text).slice(1)) { const g = guidOf(r[1]); if (g && /^EP-\d{5}$/.test(r[0])) m.set(g, { id: r[0], source: String(r[2] || "旧GUID証拠CSV") }); }
  return m;
}
// 旧側の題名+日付（GUIDが無い旧EP向けの補助照合）: 公開済み5,848 + 公開から外れた618（10/22監査）
export function oldTitlesFromRepo(root = ".") {
  const out = [], dir = `${root}/public/library/data/details`;
  for (const f of readdirSync(dir)) if (f.endsWith(".json")) for (const e of JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))) out.push({ id: e.id, show: e.show, title: e.title, publishedAt: e.date });
  const rem = `${root}/docs/audits/2026-10-22-publication-scope/removed-from-publication.csv.gz`;
  for (const r of parseCsv(gunzipSync(readFileSync(rem)).toString("utf8").replace(/^\uFEFF/, "")).slice(1)) if (r[0]) out.push({ id: r[0], show: r[1], title: r[2], publishedAt: r[3] });
  return out;
}

export function writeAll({ outDir, res, snap, asOf, ledgerForOnsa, onsaPath, onsaSheetPath, onsaFetchedAt }) {
  const recount = recountPublication({ baselineAdopted: snap.decisions.filter((d) => d.publication === "対象").length, baselineSource: snap.decisions.length, baselineDate: "2026-10-22", judged: res.rows, asOf });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/increment-manifest.json`, JSON.stringify({ schema: 1, policy: res.policy, mode: res.mode, auditEvidence: res.auditEvidence, asOf, rows: res.rows }, null, 1));
  writeFileSync(`${outDir}/publication-recount.json`, JSON.stringify(recount, null, 1));
  if (onsaPath || onsaSheetPath) {
    const baseCmp = snap.decisions.filter((d) => d.comparison === "対象" && d.publication === "対象").map((d) => d.id);
    let apiJson, source;
    try {
      if (onsaPath) { apiJson = JSON.parse(load(onsaPath)); source = "API生JSON"; }
      else { apiJson = sheetExportToApiJson(load(onsaSheetPath), parseCsv).api; source = "共同編集シート書き出し（API本体ではない参考再現）"; }
    } catch (e) { apiJson = null; }
    const projection = projectApi(apiJson, { asOf, fetchedAt: onsaFetchedAt || asOf });
    const common = { projection, ledger: ledgerForOnsa, baselineComparisonIds: baseCmp, baselineSnapshotDate: "2026-10-21", decisions: snap.decisions };
    const withDup = classifyOnsaDiff(common), noDup = classifyOnsaDiff({ ...common, dedupe: true });
    writeFileSync(`${outDir}/onsa-diff.json`, JSON.stringify({ source, asOf, withCrossTabDuplicates: withDup, dedupedByLink: noDup }, null, 1));
  }
  return recount;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), arg = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const ledgerPath = arg("--ledger"), incPath = arg("--increment");
  if (!ledgerPath && !incPath) { console.error("usage: --ledger <csv|json> | --increment <csv> --audit-evidence <text>  [--old-guids] [--baseline] [--onsa] [--out] [--as-of]"); process.exit(2); }
  const asOf = arg("--as-of", new Date().toISOString()), outDir = arg("--out", "docs/audits/2026-11-10-increment");
  const snap = JSON.parse(load(arg("--baseline", "docs/audits/2026-10-22-publication-scope/decisions.json.gz")));
  const readRows = (p) => { const text = load(p); return p.endsWith(".json") ? JSON.parse(text) : ledgerFromRows(parseCsv(text.replace(/^\uFEFF/, ""))); };
  const oldGuids = arg("--old-guids") ? oldGuidsFromCsv(load(arg("--old-guids"))) : new Map();
  const oldTitles = oldTitlesFromRepo(arg("--repo", "."));
  const full = ledgerPath ? readRows(ledgerPath) : null;
  const res = judgeIncrement(full ? [] : readRows(incPath), snap.decisions, { fullLedger: full, auditEvidence: arg("--audit-evidence", ""), oldGuids, oldTitles });
  if (!res.ok) { console.error("STOP", JSON.stringify(res)); process.exit(3); }
  const recount = writeAll({ outDir, res, snap, asOf, ledgerForOnsa: full || [...oldTitles, ...res.rows.map((r) => ({ id: r.id, show: r.show, title: r.title, publishedAt: r.publishedAt, guid: r.guid }))], onsaPath: arg("--onsa"), onsaSheetPath: arg("--onsa-sheet"), onsaFetchedAt: arg("--onsa-fetched-at") });
  console.log(JSON.stringify({ asOf, mode: res.mode, ...recount }, null, 1));
}
