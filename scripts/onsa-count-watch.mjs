#!/usr/bin/env node
// おんさ検索サイトの件数を、画面と同じ計数定義（scripts/lib/onsa-count.mjs）で集計して記録する。READ_ONLY。
// 取得失敗・HTTP非200・schema不一致・古い取得時刻は status:"unavailable"。過去の数字（5,512等）は決して現在値として再利用しない。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { projectApi } from "./lib/onsa-count.mjs";

export const DEFAULT_URL = "https://asapoki.yoshimoto.workers.dev/";            // 提供者指定: 1サイト1日1万アクセスまで。6時間毎=1日4回
export const BASELINE = { comparison: 5219, decisionDate: "2026-10-22", note: "朝リスの田 旧比較対象（10/22凍結）。最新値ではない" };

export const LIMITS = { providerDailyCap: 10000, selfDailyCap: 24, minIntervalHours: 5 };   // 提供者上限は1サイト1日1万。自己上限はその1/400以下。1回の実行で1リクエスト、再試行なし

export async function watchOnce({ fetchImpl = fetch, url = DEFAULT_URL, now = () => new Date(), previous = null, maxStaleHours = 13, minIntervalHours = LIMITS.minIntervalHours } = {}) {
  const asOf = now().toISOString(), day = asOf.slice(0, 10);
  const base = { schema: 1, asOf, url, countingSpec: "scripts/lib/onsa-count.mjs", baseline: BASELINE };
  const hours = previous?.asOf ? (Date.parse(asOf) - Date.parse(previous.asOf)) / 3600000 : null;
  const monitor = { previousAsOf: previous?.asOf || null, hoursSincePrevious: hours === null ? null : Math.round(hours * 10) / 10, monitorGap: hours !== null && hours > maxStaleHours };
  const lastOk = previous?.status === "ok" ? summarize(previous) : previous?.lastOk || null;     // unavailable を挟んでも直近の成功値を保持（現在値としては使わない）
  const used = previous?.requests?.date === day ? previous.requests.count : 0;
  // 提供者の利用上限の遵守: 直近の試行から最短間隔未満、または自己上限到達なら取得しない（古い値は現在値にしない）
  if (hours !== null && hours >= 0 && hours < minIntervalHours) return { ...base, status: "skipped", reason: "RATE_GUARD_MIN_INTERVAL", monitor, lastOk, requests: { date: day, count: used }, previousAttempt: previous };
  if (used >= LIMITS.selfDailyCap) return { ...base, status: "skipped", reason: "RATE_GUARD_DAILY_CAP", monitor, lastOk, requests: { date: day, count: used } };
  const requests = { date: day, count: used + 1 };                                                // 取得を試みた時点で1件消費（失敗も数える）
  let res;
  try { res = await fetchImpl(url, { headers: { accept: "application/json" } }); }
  catch (e) { return { ...base, status: "unavailable", reason: "FETCH_ERROR:" + (e && e.message ? e.message : "unknown"), monitor, lastOk, requests }; }
  if (!res || res.status !== 200) return { ...base, status: "unavailable", reason: "HTTP_" + (res && res.status), monitor, lastOk, requests };
  let json; try { json = await res.json(); } catch { return { ...base, status: "unavailable", reason: "INVALID_JSON", monitor, lastOk, requests }; }
  const p = projectApi(json, { asOf });
  if (p.status !== "ok") return { ...base, status: "unavailable", reason: p.reason, monitor, lastOk, requests };
  const { items, ...counts } = p;
  const delta = lastOk ? { uiCounter: counts.uiCounter - lastOk.uiCounter, rawArrayCount: counts.rawArrayCount - lastOk.rawArrayCount, byCategory: Object.fromEntries(Object.keys(counts.byCategory).map((c) => [c, counts.byCategory[c].counted - (lastOk.byCategory?.[c]?.counted ?? 0)])), lastOkAsOf: lastOk.asOf } : null;
  return { ...base, ...counts, status: "ok", monitor, requests, lastOk: null, delta, changed: !!delta && (delta.uiCounter !== 0 || delta.rawArrayCount !== 0), vsBaseline: { uiCounterMinusBaseline: counts.uiCounter - BASELINE.comparison, note: "基準日時が異なるため収蔵漏れとは判定しない" } };
}
const summarize = (r) => ({ asOf: r.asOf, uiCounter: r.uiCounter, rawArrayCount: r.rawArrayCount, byCategory: r.byCategory });

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), arg = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const out = arg("--out", "onsa-count.json"), prevPath = arg("--previous"), fixture = arg("--fixture");       // --fixture: ネットワークを使わないローカル再現用
  const previous = prevPath && existsSync(prevPath) ? (() => { try { return JSON.parse(readFileSync(prevPath, "utf8")); } catch { return null; } })() : null;
  const fetchImpl = fixture ? async () => ({ status: 200, json: async () => JSON.parse(readFileSync(fixture, "utf8")) }) : fetch;
  const r = await watchOnce({ fetchImpl, url: process.env.ONSA_API_URL || DEFAULT_URL, previous, now: process.env.ONSA_NOW ? () => new Date(process.env.ONSA_NOW) : undefined, minIntervalHours: Number(arg("--min-interval-hours", LIMITS.minIntervalHours)) });
  // skipped（レート保護）のときは前回の状態ファイルを上書きしない＝試行履歴(asOf/requests)を保つ
  const stateOut = arg("--state");
  if (stateOut) { mkdirSync(dirname(stateOut), { recursive: true }); writeFileSync(stateOut, JSON.stringify(r.status === "skipped" && previous ? { ...previous, requests: r.requests } : r, null, 1)); }
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ status: r.status, reason: r.reason, uiCounter: r.uiCounter, rawArrayCount: r.rawArrayCount, changed: r.changed, monitorGap: r.monitor.monitorGap, requestsToday: r.requests?.count }));
  if (a.includes("--fail-on-unavailable") && r.status === "unavailable") process.exit(1);
}
