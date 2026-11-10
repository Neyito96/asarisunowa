import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { watchOnce } from "../scripts/onsa-count-watch.mjs";
const body = (n) => ({ genba: Array.from({ length: n }, (_, i) => ({ title: "t" + i, pubDate: "2026-05-01", link: "", duration: 1 })), media: [], sdgs: [], houdan: [], donuts: [], sports: [] });
const ok = (b) => async () => ({ status: 200, json: async () => b });
const at = (iso) => () => new Date(iso);
test("成功: 画面カウンタと生配列件数を別に記録し、基準との差に収蔵漏れ断定をしない", async () => {
  const r = await watchOnce({ fetchImpl: ok(body(3)), now: at("2026-11-10T00:00:00Z") });
  assert.equal(r.status, "ok"); assert.equal(r.uiCounter, 3); assert.equal(r.rawArrayCount, 3); assert.equal(r.vsBaseline.uiCounterMinusBaseline, 3 - 5219); assert.match(r.vsBaseline.note, /収蔵漏れとは判定しない/);
});
test("取得失敗・非200・不正JSON・schema不一致は unavailable で、数値フィールドを持たない（5,512等を再利用しない）", async () => {
  for (const f of [async () => { throw new Error("net"); }, async () => ({ status: 503 }), async () => ({ status: 200, json: async () => { throw new Error("x"); } }), ok({ genba: [] })]) {
    const r = await watchOnce({ fetchImpl: f, previous: { status: "ok", asOf: "2026-11-09T00:00:00Z", uiCounter: 5512 } });
    assert.equal(r.status, "unavailable"); assert.equal("uiCounter" in r, false); assert.ok(r.reason);
  }
});
test("前回成功値との差分と変化フラグ。前回がunavailableなら差分を作らない", async () => {
  const prev = (await watchOnce({ fetchImpl: ok(body(2)), now: at("2026-11-10T00:00:00Z") }));
  const r = await watchOnce({ fetchImpl: ok(body(5)), now: at("2026-11-10T06:00:00Z"), previous: prev });
  assert.equal(r.delta.uiCounter, 3); assert.equal(r.changed, true); assert.equal(r.monitor.monitorGap, false);
  assert.equal((await watchOnce({ fetchImpl: ok(body(5)), previous: { status: "unavailable", asOf: "2026-11-10T00:00:00Z" } })).delta, null);
});
test("監視空白: 前回から13時間超で monitorGap", async () => {
  const r = await watchOnce({ fetchImpl: ok(body(1)), now: at("2026-11-10T20:00:00Z"), previous: { status: "ok", asOf: "2026-11-10T00:00:00Z", uiCounter: 1, byCategory: {} } });
  assert.equal(r.monitor.monitorGap, true); assert.equal(r.monitor.hoursSincePrevious, 20);
});
test("workflow: 6時間毎+手動、最小権限、秘密値を使わない、Issue #275へ記録", () => {
  const y = readFileSync(new URL("../.github/workflows/onsa-count-watch.yml", import.meta.url), "utf8");
  assert.match(y, /cron: "17 \*\/6 \* \* \*"/); assert.match(y, /workflow_dispatch/); assert.match(y, /contents: read/); assert.match(y, /issues: write/);
  assert.doesNotMatch(y, /secrets\./); assert.match(y, /gh issue comment 275/);
});
