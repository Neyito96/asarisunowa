import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { judgeIncrement, recountPublication, classifyOnsaDiff, judgeOne } from "../scripts/lib/ledger-increment.mjs";
import { ledgerFromRows } from "../scripts/ledger-increment-judge.mjs";
import { parseCsv } from "../scripts/lib/ledger-csv.mjs";
import { projectApi, actualDurationZero, SPEC } from "../scripts/lib/onsa-count.mjs";

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
const API = (o = {}) => ({ genba: [], media: [], sdgs: [], houdan: [], donuts: [], sports: [], ...o });
const A = (title, pubDate, link = "", extra = {}) => ({ title, pubDate, link, duration: 600, spotify: "", clipId: "", ...extra });
const omny = (g) => `https://omny.fm/shows/x/playlists/p/clips/${g}`;
test("おんさ差分: 新着/旧SDGs/再配信/日時差分/番組構成/未解明/不足/重複をEP単位で分類", () => {
  const cmp = base.filter((d) => d.comparison === "対象" && d.publication === "対象").map((d) => d.id);
  const pick = (f) => base.find(f);
  const sd = pick((d) => /SDGs/.test(d.show) && d.classification === "同一性保留"), re = pick((d) => d.classification === "再配信"),
    jd = pick((d) => d.classification === "日時差分" && d.comparison === "保留"), dupOld = base.find((d) => d.id === cmp[0]);
  const G = (d) => "00000000-0000-4000-8000-" + d.id.slice(3).padStart(12, "0");
  const ledger = [...baseLedger.map((r) => ({ ...r, guid: "00000000-0000-4000-8000-" + r.id.slice(3).padStart(12, "0") })), ep(6592, "MEDIA TALK", { guid: "00000000-0000-4000-8000-000000006592" })];
  const api = API({
    sdgs: [A("t", "2026-01-01", omny(G(sd))), A("t", "2026-01-01", omny(G(re)))],
    genba: [ A("t", "2026-01-01", omny(G(jd))), A("新着6592", "2026-11-01", omny("00000000-0000-4000-8000-000000006592")),
      A("どこにも無い", "2026-02-02", omny("ffffffff-ffff-4fff-8fff-ffffffffffff")), A("x", "2020-01-01", omny(G(dupOld))), A("x", "2020-01-01", omny(G(dupOld)))],
  });
  const projection = projectApi(api, { asOf: "2026-11-10" });
  const r = classifyOnsaDiff({ projection, ledger, baselineComparisonIds: cmp, baselineSnapshotDate: "2026-10-21", decisions: base });
  assert.equal(r.status, "ok");
  assert.equal(r.summary["新着(EP-06592以降)"], 1); assert.equal(r.summary["再配信"], 1); assert.equal(r.summary["旧SDGs"], 1);
  assert.equal(r.summary["期間・日時差分"], 1); assert.equal(r.summary["未解明"], 1);
  assert.deepEqual(r.duplicateMatches, [{ ep: dupOld.id, count: 2 }]);
  assert.equal(r.missingFromOnsa.length, cmp.length - 1);                      // 旧比較対象のうちおんさ側で照合できたのは1件だけ
  assert.match(r.note, /収蔵漏れとは判定しない/);
});
test("おんさ差分: 旧比較対象に含まれる項目は差分に数えない", () => {
  const d = base.find((x) => x.comparison === "対象" && x.publication === "対象");
  const g = "00000000-0000-4000-8000-aaaaaaaaaaaa";
  const ledger = baseLedger.map((r) => (r.id === d.id ? { ...r, guid: g } : r));
  const projection = projectApi(API({ genba: [A("t", "2026-01-01", omny(g))] }), { asOf: "x" });
  const r = classifyOnsaDiff({ projection, ledger, baselineComparisonIds: [d.id], decisions: base });
  assert.equal(r.rows.length, 0); assert.equal(r.matchedBy.GUID, 1);
});
test("おんさ差分: 照合はGUID→Spotify ID→題名+日付の順", () => {
  const ledger = [{ id: "EP-90001", show: "MEDIA TALK", title: "題名A", publishedAt: "2026-05-05 07:00:00", guid: "", spotifyUrl: "https://open.spotify.com/episode/abc123" }, { id: "EP-90002", show: "ドーナツ", title: "ドーナツ回", publishedAt: "2026-05-06 07:00:00", guid: "" }];
  const p = projectApi(API({ media: [A("別題", "2026-05-05", "", { spotify: "https://open.spotify.com/episode/abc123" })], donuts: [A("ドーナツ回", "2026-05-05T22:00:00Z")] }), { asOf: "x" });
  const r = classifyOnsaDiff({ projection: p, ledger, baselineComparisonIds: [], decisions: [] });
  assert.deepEqual(r.matchedBy, { SPOTIFY_ID: 1, TITLE_DATE: 1 });
});
test("おんさ計数: 6番組のみ・SDGs 2026-06-30以降はカット・(再)/(ふりかえり)/(深掘り)/再放送は非計数、生配列件数と画面カウンタを分離", () => {
  const api = API({
    genba: [A("通常", "2026-05-01"), A("（再）過去回", "2026-05-02"), A("（ふりかえり）まとめ", "2026-05-03"), A("（深掘り）詳説", "2026-05-04"), A("今日は再放送です", "2026-05-05")],
    sdgs: [A("SDGs前", "2026-06-29T23:59:00+09:00"), A("SDGs後", "2026-06-30T00:00:00+09:00"), A("SDGs後2", "2026-08-01")],
    sports: [A("スポ", "2026-05-01")], 学校: [A("対象外", "2026-05-01")],
  });
  const p = projectApi(api, { asOf: "2026-11-10T00:00:00Z" });
  assert.equal(p.rawArrayCount, 9); assert.equal(p.readDataCount, 7); assert.equal(p.uiCounter, 3);   // 通常 + SDGs前 + スポ
  assert.equal(p.byCategory.sdgs.raw, 3); assert.equal(p.byCategory.sdgs.counted, 1);
  assert.equal(p.items.some((i) => i.show === "ニュースの学校"), false);
  assert.equal(p.items.find((i) => i.title.startsWith("（再）")).notCountedReason.includes("actualDuration=0"), true);
  assert.equal(actualDurationZero("通常（再）"), false);                                                // 先頭一致のみ
});
test("おんさAPI: schema不一致/取得不能は unavailable（古い数字を再利用しない）", () => {
  for (const bad of [null, {}, { genba: [] }, API({ genba: [{ title: 1 }] })]) assert.equal(projectApi(bad, { asOf: "x" }).status, "unavailable");
  const r = classifyOnsaDiff({ projection: projectApi(null, { asOf: "x" }), ledger: [], baselineComparisonIds: [], decisions: [] });
  assert.equal(r.status, "unavailable"); assert.equal("uiCounter" in r, false);
});
test("おんさ仕様はSPECの一箇所に集約され、ソースURLと6カテゴリを保持する", () => {
  assert.deepEqual(SPEC.categories, ["genba", "media", "sdgs", "houdan", "donuts", "sports"]); assert.match(SPEC.source, /speakers3\.js$/);
});
test("本番の実見出し(台帳ID/番組名/配信日時（JST）/外部ID)を読める", () => {
  const rows = ledgerFromRows(parseCsv(readFileSync(new URL("./fixtures/increment/ledger-real-headers.csv", import.meta.url), "utf8")));
  assert.equal(rows.length, 2); assert.deepEqual([rows[0].id, rows[0].show, rows[0].title, rows[0].publishedAt, rows[0].guid], ["EP-06592", "ニュースの現場から", "新着, 題名", "2026-11-01 07:00:00", "5218b5c5-7f21-4089-a5c7-b4ea00cf1bd3"]);
  const res = judgeIncrement([...baseLedger, ...rows], base);
  assert.equal(res.ok, true); assert.deepEqual(res.rows.map((r) => [r.id, r.publication, r.comparison]), [["EP-06592", "対象", "保留"], ["EP-06593", "保留", "対象外"]]);
});
test("CSV見出しの別名を解決し、必須列が無ければ停止", () => {
  const t = ledgerFromRows([["EP-ID", "番組", "タイトル", "配信日時", "GUID"], ["EP-06592", "MEDIA TALK", "a", "2026-11-01", "g"]]);
  assert.equal(t[0].guid, "g");
  assert.throws(() => ledgerFromRows([["EP-ID", "番組"]]), /LEDGER_HEADER_UNMAPPED/);
});
test("judgeOne は入力を変更しない", () => {
  const r = Object.freeze(ep(6592, "MEDIA TALK")); judgeOne(r, { guidSeen: new Map(), titleSeen: new Map(), knownShows: new Set(["MEDIA TALK"]) });
});
