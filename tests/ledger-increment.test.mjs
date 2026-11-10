import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { judgeIncrement, recountPublication, classifyOnsaDiff, judgeOne } from "../scripts/lib/ledger-increment.mjs";
import { ledgerFromRows } from "../scripts/ledger-increment-judge.mjs";

const base = JSON.parse(gunzipSync(readFileSync(new URL("../docs/audits/2026-10-22-publication-scope/decisions.json.gz", import.meta.url))).toString()).decisions;
const baseLedger = base.map((d) => ({ id: d.id, show: d.show, title: "t" + d.id, publishedAt: "2020-01-01 00:00:00", guid: "g-" + d.id }));
const ep = (n, show, o = {}) => ({ id: "EP-" + String(n).padStart(5, "0"), show, title: "新着" + n, publishedAt: "2026-11-01 07:00:00", guid: "g-" + n, ...o });
const run = (news) => judgeIncrement([...baseLedger, ...news], base);

test("基準: 6591 / 採用5848 / 対象外377 / 保留366 を維持", () => {
  assert.equal(base.length, 6591); assert.equal(base.filter((d) => d.publication === "対象").length, 5848);
});
test("台帳整合: 旧EP-ID消失・重複・不正IDで停止（判定しない）", () => {
  assert.equal(judgeIncrement(baseLedger.slice(1), base).stop, "LEDGER_INTEGRITY");
  assert.deepEqual(judgeIncrement([...baseLedger, baseLedger[0]], base).dupIds, [baseLedger[0].id]);
  assert.deepEqual(judgeIncrement([...baseLedger, ep(1, "x", { id: "EP-1" })], base).malformed, ["EP-1"]);
});
test("新着のみ判定され、旧IDの判定は変えない", () => {
  const r = run([ep(6592, "ニュースの現場から"), ep(6593, "ドーナツ")]);
  assert.equal(r.rows.length, 2);
});
test("ニュースの学校は宇宙採用・おんさ比較は対象外", () => {
  const [r] = run([ep(6592, "ニュースの学校")]).rows;
  assert.deepEqual([r.publication, r.comparison, r.review], ["対象", "対象外", "確認済み"]);
});
test("対象外番組(アルキキ/AJW/朝ポキTV)は採用しない", () => {
  for (const s of ["アルキキ", "AJW", "朝ポキTV"]) assert.equal(run([ep(6592, s)]).rows[0].publication, "対象外");
});
test("未確認(GUID/題名/日時欠落)は保留で、公開対象にしない", () => {
  for (const k of ["guid", "title", "publishedAt"]) {
    const [r] = run([ep(6592, "MEDIA TALK", { [k]: "" })]).rows;
    assert.equal(r.publication, "保留"); assert.equal(r.review, "要照合");
  }
});
test("未知の番組は自動採用しない", () => assert.equal(run([ep(6592, "新番組X")]).rows[0].publication, "保留"));
test("GUID重複は対象外(重複)、同題同日でGUID違いは保留", () => {
  const rows = run([ep(6592, "MEDIA TALK", { guid: "g-EP-00001" }), ep(6593, "MEDIA TALK", { title: "同じ題", guid: "a" }), ep(6594, "MEDIA TALK", { title: "同じ題", guid: "b" })]).rows;
  assert.deepEqual([rows[0].publication, rows[0].classification], ["対象外", "重複"]);
  assert.equal(rows[2].publication, "保留");
});
test("再配信語は保留、ただしアンコールの舞台は誤除外しない", () => {
  assert.equal(run([ep(6592, "MEDIA TALK", { title: "【再配信】あの日" })]).rows[0].classification, "再配信候補");
  assert.equal(run([ep(6592, "MEDIA TALK", { title: "アンコールの舞台裏" })]).rows[0].publication, "対象");
});
test("掲載件数: 基準5848・新規採用・保留/除外を分離し、旧判定を最新値として出さない", () => {
  const judged = run([ep(6592, "ニュースの現場から"), ep(6593, "アルキキ"), ep(6594, "MEDIA TALK", { guid: "" })]).rows;
  const c = recountPublication({ baselineAdopted: 5848, baselineSource: 6591, baselineDate: "2026-10-22", judged, asOf: "2026-11-10T00:00:00Z" });
  assert.equal(c.newlyAdoptable, 1); assert.equal(c.newHold, 1); assert.equal(c.newExcluded, 1);
  assert.equal(c.latestAdoptable, 5849); assert.equal(c.latestSource, 6594); assert.match(c.baseline.label, /最新件数ではない/);
});
test("おんさ差分: 新着/旧SDGs/再配信/日時差分/番組構成/未解明に分類し、断定しない", () => {
  const cmp = base.filter((d) => d.comparison === "対象" && d.publication === "対象").map((d) => d.id);
  const pick = (f) => base.find(f);
  const sd = pick((d) => /SDGs/.test(d.show) && d.classification === "同一性保留"), re = pick((d) => d.classification === "再配信"),
    jd = pick((d) => d.classification === "日時差分" && d.comparison === "保留"), sc = pick((d) => d.show === "ニュースの学校" && d.publication === "対象");
  const ledger = [...baseLedger, ep(6592, "MEDIA TALK")];
  const L = (d) => ledger.find((r) => r.id === d.id);
  const items = [{ show: "MEDIA TALK", guid: "g-6592" }, { show: sd.show, guid: L(sd).guid }, { show: re.show, guid: L(re).guid }, { show: jd.show, guid: L(jd).guid }, { show: sc.show, guid: L(sc).guid }, { show: "X", title: "どこにも無い" }];
  const r = classifyOnsaDiff({ onsaItems: items, ledger, baselineComparisonIds: cmp, baselineSnapshotDate: "2026-10-21", onsaAsOf: "2026-11-10", decisions: base });
  assert.deepEqual(r.summary, { "新着(EP-06592以降)": 1, "旧SDGs": 1, "再配信": 1, "期間・日時差分": 1, "番組構成": 1, "未解明": 1 });
  assert.equal(r.unexplained, 1); assert.match(r.note, /収蔵漏れとは判定しない/);
});
test("おんさ差分: 旧比較対象に含まれる項目は差分に数えない", () => {
  const d = base.find((x) => x.comparison === "対象" && x.publication === "対象");
  const r = classifyOnsaDiff({ onsaItems: [{ show: d.show, guid: "g-" + d.id }], ledger: baseLedger, baselineComparisonIds: [d.id], decisions: base });
  assert.equal(r.rows.length, 0);
});
test("CSV見出しの別名を解決し、必須列が無ければ停止", () => {
  const t = ledgerFromRows([["EP-ID", "番組", "タイトル", "配信日時", "GUID"], ["EP-06592", "MEDIA TALK", "a", "2026-11-01", "g"]]);
  assert.equal(t[0].guid, "g");
  assert.throws(() => ledgerFromRows([["EP-ID", "番組"]]), /LEDGER_HEADER_UNMAPPED/);
});
test("judgeOne は入力を変更しない", () => {
  const r = Object.freeze(ep(6592, "MEDIA TALK")); judgeOne(r, { guidSeen: new Map(), titleSeen: new Map(), knownShows: new Set(["MEDIA TALK"]) });
});
