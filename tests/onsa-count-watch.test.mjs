import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync as rf, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchOnce, LIMITS } from "../scripts/onsa-count-watch.mjs";
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
  assert.equal((await watchOnce({ fetchImpl: ok(body(5)), now: at("2026-11-10T12:00:00Z"), previous: { status: "unavailable", asOf: "2026-11-10T00:00:00Z" } })).delta, null);
});
test("監視空白: 前回から13時間超で monitorGap", async () => {
  const r = await watchOnce({ fetchImpl: ok(body(1)), now: at("2026-11-10T20:00:00Z"), previous: { status: "ok", asOf: "2026-11-10T00:00:00Z", uiCounter: 1, byCategory: {} } });
  assert.equal(r.monitor.monitorGap, true); assert.equal(r.monitor.hoursSincePrevious, 20);
});
test("workflow: 6時間毎+手動、最小権限、秘密値を使わない、Issue #275へ記録", () => {
  const y = readFileSync(new URL("../.github/workflows/onsa-count-watch.yml", import.meta.url), "utf8");
  assert.match(y, /cron: "17 \*\/6 \* \* \*"/); assert.match(y, /workflow_dispatch/); assert.match(y, /contents: read/); assert.match(y, /issues: write/);
  assert.doesNotMatch(y, /secrets\./); assert.match(y, /gh issue comment 275/);
  // キャッシュ: 復元先と保存先が同一パス、キーは毎回ユニーク、復元は接頭辞
  const paths = [...y.matchAll(/actions\/cache\/(restore|save)@v4\s*\n\s*with: \{ path: (\S+),/g)].map((m) => m[2]);
  assert.deepEqual(paths, ["state", "state"]); assert.match(y, /restore-keys: "onsa-count-state-"/); assert.match(y, /key: "onsa-count-state-\$\{\{ github\.run_id \}\}/);
  assert.match(y, /--previous state\/onsa-count\.json --state state\/onsa-count\.json/);
});

test("提供者上限: 最短間隔未満は取得せず skipped、1回の実行で1リクエスト、自己上限(24/日)に達したら取得しない", async () => {
  let calls = 0; const f = async () => { calls++; return { status: 200, json: async () => body(1) }; };
  const first = await watchOnce({ fetchImpl: f, now: at("2026-11-10T00:00:00Z") });
  assert.equal(calls, 1); assert.equal(first.requests.count, 1);
  const early = await watchOnce({ fetchImpl: f, now: at("2026-11-10T01:00:00Z"), previous: first });
  assert.equal(early.status, "skipped"); assert.equal(early.reason, "RATE_GUARD_MIN_INTERVAL"); assert.equal(calls, 1);
  const capped = await watchOnce({ fetchImpl: f, now: at("2026-11-10T20:00:00Z"), previous: { status: "ok", asOf: "2026-11-10T10:00:00Z", requests: { date: "2026-11-10", count: LIMITS.selfDailyCap } } });
  assert.equal(capped.reason, "RATE_GUARD_DAILY_CAP"); assert.equal(calls, 1);
  assert.ok(LIMITS.selfDailyCap * 400 <= LIMITS.providerDailyCap);                                   // 提供者上限の1/400以下
});
test("失敗した試行も1日の消費に数え、日付が変われば数え直す。unavailableを挟んでも直近の成功値を保持", async () => {
  const okRun = await watchOnce({ fetchImpl: ok(body(2)), now: at("2026-11-10T00:00:00Z") });
  const bad = await watchOnce({ fetchImpl: async () => ({ status: 500 }), now: at("2026-11-10T06:00:00Z"), previous: okRun });
  assert.equal(bad.requests.count, 2); assert.equal(bad.lastOk.uiCounter, 2); assert.equal("uiCounter" in bad, false);
  const next = await watchOnce({ fetchImpl: ok(body(4)), now: at("2026-11-11T00:00:00Z"), previous: bad });
  assert.equal(next.requests.count, 1); assert.equal(next.delta.uiCounter, 2);
});
test("Actionsキャッシュの保存→復元をローカルで再現: state/ を次回の --previous に使い、変化と監視履歴が成立する", () => {
  const dir = mkdtempSync(join(tmpdir(), "onsa-"));
  const fx1 = join(dir, "a.json"), fx2 = join(dir, "b.json"); writeFileSync(fx1, JSON.stringify(body(2))); writeFileSync(fx2, JSON.stringify(body(5)));
  const run = (fx, now) => JSON.parse(execFileSync("node", ["scripts/onsa-count-watch.mjs", "--fixture", fx, "--previous", join(dir, "state/onsa-count.json"), "--state", join(dir, "state/onsa-count.json"), "--out", join(dir, "out/onsa-count.json")], { env: { ...process.env, ONSA_NOW: now }, encoding: "utf8", cwd: new URL("..", import.meta.url).pathname }));
  const r1 = run(fx1, "2026-11-10T00:00:00Z"); assert.equal(r1.status, "ok"); assert.equal(existsSync(join(dir, "state/onsa-count.json")), true);
  const r2 = run(fx2, "2026-11-10T06:00:00Z"); assert.equal(r2.changed, true);
  const saved = JSON.parse(rf(join(dir, "state/onsa-count.json"), "utf8")); assert.equal(saved.uiCounter, 5); assert.equal(saved.delta.uiCounter, 3);
  const r3 = run(fx2, "2026-11-10T07:00:00Z"); assert.equal(r3.status, "skipped");                      // 最短間隔内は取得しない
  assert.equal(JSON.parse(rf(join(dir, "state/onsa-count.json"), "utf8")).asOf, saved.asOf);        // skipped は試行履歴を壊さない
});
