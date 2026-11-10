import test from "node:test";
import assert from "node:assert/strict";
import { auditCsv, parseCsv } from "../scripts/podcast-spotify-gaps.mjs";
const H = "A,B,C,D,E,F,G,H,I,J,K,L,M,N\n";
const row = (t, sp, ls) => `u,${t},mk,,,,,,,${sp},,,,${ls}\n`;
test("offline audit: 母数/LISTENあり/欠落/未分類を別々に出す", () => {
  const r = auditCsv(H + row("a", "", "https://l/1") + row("b", "https://s", "https://l/2") + row("c", "", "") + row('"d,1"', "", "https://l/3"), "2026-11-10T00:00:00Z");
  assert.equal(r.total, 4); assert.equal(r.withListen, 3); assert.equal(r.missingSpotify, 2);
  assert.equal(r.classified, 0); assert.equal(r.unclassified, 2); assert.equal(r.asOf, "2026-11-10T00:00:00Z");
  assert.equal(r.rows[1].title, "d,1");
});
test("parseCsv: 引用符・改行・二重引用符", () => {
  assert.deepEqual(parseCsv('a,"b\nc","d""e"\n'), [["a", "b\nc", 'd"e']]);
});
test("offline script has no network/GAS access", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../scripts/podcast-spotify-gaps.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|https?\.request|UrlFetchApp|SpreadsheetApp/);
});
