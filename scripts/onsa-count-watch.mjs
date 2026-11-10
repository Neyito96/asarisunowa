#!/usr/bin/env node
// おんさ検索サイトの件数を、画面と同じ計数定義（scripts/lib/onsa-count.mjs）で集計して記録する。READ_ONLY。
// 取得失敗・HTTP非200・schema不一致・古い取得時刻は status:"unavailable"。過去の数字（5,512等）は決して現在値として再利用しない。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { projectApi } from "./lib/onsa-count.mjs";

export const DEFAULT_URL = "https://asapoki.yoshimoto.workers.dev/";            // 提供者指定: 1サイト1日1万アクセスまで。6時間毎=1日4回
export const BASELINE = { comparison: 5219, decisionDate: "2026-10-22", note: "朝リスの田 旧比較対象（10/22凍結）。最新値ではない" };

export async function watchOnce({ fetchImpl = fetch, url = DEFAULT_URL, now = () => new Date(), previous = null, maxStaleHours = 13 } = {}) {
  const asOf = now().toISOString();
  const base = { schema: 1, asOf, url, countingSpec: "scripts/lib/onsa-count.mjs", baseline: BASELINE };
  const stale = previous?.asOf ? (Date.parse(asOf) - Date.parse(previous.asOf)) / 3600000 : null;
  const monitor = { previousAsOf: previous?.asOf || null, hoursSincePrevious: stale === null ? null : Math.round(stale * 10) / 10, monitorGap: stale !== null && stale > maxStaleHours };
  let res;
  try { res = await fetchImpl(url, { headers: { accept: "application/json" } }); }
  catch (e) { return { ...base, status: "unavailable", reason: "FETCH_ERROR:" + (e && e.message ? e.message : "unknown"), monitor }; }
  if (!res || res.status !== 200) return { ...base, status: "unavailable", reason: "HTTP_" + (res && res.status), monitor };
  let json; try { json = await res.json(); } catch { return { ...base, status: "unavailable", reason: "INVALID_JSON", monitor }; }
  const p = projectApi(json, { asOf });
  if (p.status !== "ok") return { ...base, status: "unavailable", reason: p.reason, monitor };
  const { items, ...counts } = p;
  const prev = previous?.status === "ok" ? previous : null;                       // 直近の成功値との差分のみ。unavailableの間は持ち越さない
  const delta = prev ? { uiCounter: counts.uiCounter - prev.uiCounter, rawArrayCount: counts.rawArrayCount - prev.rawArrayCount, byCategory: Object.fromEntries(Object.keys(counts.byCategory).map((c) => [c, counts.byCategory[c].counted - (prev.byCategory?.[c]?.counted ?? 0)])), previousAsOf: prev.asOf } : null;
  return { ...base, ...counts, status: "ok", monitor, delta, changed: !!delta && (delta.uiCounter !== 0 || delta.rawArrayCount !== 0), vsBaseline: { uiCounterMinusBaseline: counts.uiCounter - BASELINE.comparison, note: "基準日時が異なるため収蔵漏れとは判定しない" } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), arg = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const out = arg("--out", "onsa-count.json"), prevPath = arg("--previous");
  const previous = prevPath && existsSync(prevPath) ? (() => { try { return JSON.parse(readFileSync(prevPath, "utf8")); } catch { return null; } })() : null;
  const r = await watchOnce({ url: process.env.ONSA_API_URL || DEFAULT_URL, previous });
  writeFileSync(out, JSON.stringify(r, null, 1)); console.log(JSON.stringify({ status: r.status, reason: r.reason, uiCounter: r.uiCounter, rawArrayCount: r.rawArrayCount, changed: r.changed, monitorGap: r.monitor.monitorGap }));
  if (a.includes("--fail-on-unavailable") && r.status !== "ok") process.exit(1);
}
