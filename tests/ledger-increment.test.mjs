import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { judgeIncrement, recountPublication, classifyOnsaDiff, judgeOne } from "../scripts/lib/ledger-increment.mjs";
import { ledgerFromRows } from "../scripts/ledger-increment-judge.mjs";
import { parseCsv } from "../scripts/lib/ledger-csv.mjs";
import { projectApi, actualDurationZero, SPEC } from "../scripts/lib/onsa-count.mjs";

const base = JSON.parse(gunzipSync(readFileSync(new URL("../docs/audits/2026-10-22-publication-scope/decisions.json.gz", import.meta.url))).toString()).decisions;
const baseLedger = base.map((d) => ({ id: d.id, show: d.show, title: "t" + d.id, publishedAt: "2021-01-01 00:00:00", guid: "g-" + d.id }));
const ep = (n, show, o = {}) => ({ id: "EP-" + String(n).padStart(5, "0"), show, title: "新着" + n, publishedAt: "2026-11-01 07:00:00", guid: "g-" + n, ...o });
const run = (news) => judgeIncrement([...baseLedger, ...news], base);

test("基準: 6591 / 採用5848 / 対象外377 / 保留366 を維持", () => {
  assert.equal(base.length, 6591); assert.equal(base.filter((d) => d.publication === "対象").length, 5848);
});
const EVID = "司令塔READ_ONLY実測 2026-11-10: 旧6,591存在・ID一意";
const inc = (news, o = {}) => judgeIncrement(news, base, { auditEvidence: EVID, ...o });
const full = (news, o = {}) => judgeIncrement([], base, { fullLedger: [...baseLedger, ...news], ...o });
test("完全照合モード: 旧EP-ID消失・重複・不正IDで停止（判定しない）", () => {
  assert.equal(judgeIncrement([], base, { fullLedger: baseLedger.slice(1) }).stop, "LEDGER_INTEGRITY");
  assert.deepEqual(judgeIncrement([], base, { fullLedger: [...baseLedger, baseLedger[0]] }).dupIds, [baseLedger[0].id]);
  assert.deepEqual(judgeIncrement([], base, { fullLedger: [...baseLedger, ep(1, "x", { id: "EP-1" })] }).malformed, ["EP-1"]);
});
test("増分モード: 新100行だけで判定でき、外部監査証拠が無ければ停止、既判定ID・不正ID・重複IDも停止", () => {
  assert.equal(inc([ep(6592, "MEDIA TALK")]).ok, true);
  assert.equal(judgeIncrement([ep(6592, "MEDIA TALK")], base, {}).stop, "AUDIT_EVIDENCE_REQUIRED");
  assert.equal(inc([ep(6592, "MEDIA TALK"), ep(6592, "MEDIA TALK")]).stop, "INCREMENT_INTEGRITY");
  assert.equal(inc([{ ...ep(1, "MEDIA TALK"), id: baseLedger[0].id }]).stop, "INCREMENT_INTEGRITY");
  assert.equal(inc([{ ...ep(1, "MEDIA TALK"), id: "EP-1" }]).stop, "INCREMENT_INTEGRITY");
  assert.match(inc([ep(6592, "MEDIA TALK")]).auditEvidence, /旧6,591/);
});
test("増分モードと完全照合モードは同じ判定を返す", () => {
  const news = [ep(6592, "ニュースの学校"), ep(6593, "MEDIA TALK", { guid: "" }), ep(6594, "アルキキ")];
  assert.deepEqual(inc(news).rows, full(news).rows);
});
test("ニュースの学校: 宇宙候補として保護・おんさ比較は対象外だが、新側は未審査候補で公式採用にしない", () => {
  const [r] = inc([ep(6592, "ニュースの学校")]).rows;
  assert.deepEqual([r.status, r.publication, r.comparison, r.review], ["candidate", "保留", "対象外", "未審査(候補)"]);
});
test("対象外番組(アルキキ/AJW/朝ポキTV)は採用しない", () => {
  for (const s of ["アルキキ", "AJW", "朝ポキTV"]) assert.equal(inc([ep(6592, s)]).rows[0].status, "excluded");
});
test("未確認(GUID/題名/日時欠落)は保留で、公開候補にもしない", () => {
  for (const k of ["guid", "title", "publishedAt"]) {
    const [r] = inc([ep(6592, "MEDIA TALK", { [k]: "" })]).rows;
    assert.equal(r.status, "hold"); assert.equal(r.review, "要照合");
  }
});
test("未知の番組は自動採用しない", () => assert.equal(inc([ep(6592, "新番組X")]).rows[0].status, "hold"));
test("通常の新着も『未審査の掲載候補』止まりで、確認済み・対象にはしない", () => {
  const [r] = inc([ep(6592, "ニュースの現場から")]).rows;
  assert.deepEqual([r.status, r.publication, r.review], ["candidate", "保留", "未審査(候補)"]);
});
test("新側内のGUID重複は対象外(重複)、同題同日でGUID違いは保留", () => {
  const rows = inc([ep(6592, "MEDIA TALK", { guid: "00000000-0000-4000-8000-000000000001" }), ep(6593, "MEDIA TALK", { guid: "00000000-0000-4000-8000-000000000001", title: "別題" }), ep(6594, "MEDIA TALK", { title: "同じ題", guid: "00000000-0000-4000-8000-0000000000a1" }), ep(6595, "MEDIA TALK", { title: "同じ題", guid: "00000000-0000-4000-8000-0000000000b1" })]).rows;
  assert.deepEqual([rows[1].status, rows[1].classification], ["excluded", "重複"]); assert.equal(rows[3].status, "hold");
});
test("★司令塔指摘の3件: 旧EP-03857/03858/03861と公式GUIDが一致する新06595/06596/06597は、旧台帳G列が空でも旧判定H列のGUIDで重複検出", () => {
  const pairs = [["EP-06595", "EP-03857", "dd169c36-40c0-4cf4-9b1d-ac14008566ab"], ["EP-06596", "EP-03858", "1545b33c-84e9-4302-806a-ac1400858106"], ["EP-06597", "EP-03861", "3303d8d0-a941-488e-ab22-ac1700443eaa"]];
  const oldGuids = new Map(pairs.map(([, o, g]) => [g, { id: o, source: "旧判定タブH列「公式GUID=」" }]));
  const news = [...pairs.map(([n, , g]) => ({ ...ep(Number(n.slice(3)), "MEDIA TALK"), guid: g })), ep(6600, "MEDIA TALK")];
  const rows = inc(news, { oldGuids }).rows;
  pairs.forEach(([n, o], i) => { const r = rows[i]; assert.deepEqual([r.id, r.status, r.publication, r.classification, r.evidence.rule, r.evidence.of], [n, "excluded", "対象外", "重複", "OLD_GUID_DUP", o]); assert.match(r.evidence.oldDecision, /対象\/対象\/確認済み|\//); });
  assert.equal(rows[3].status, "candidate");
  // 旧GUID証拠が無ければ（G列だけの照合では）検出漏れする＝証拠CSVを使う理由
  assert.equal(inc(news).rows[0].status, "candidate");
  // 旧EPの判定は変わらない（旧3件は採用のまま）
  for (const [, o] of pairs) assert.equal(base.find((d) => d.id === o).publication, "対象");
});
test("旧側の題名+日付が一致しGUIDで確認できない場合は自動除外せず保留（旧公開データ補助照合）", () => {
  const rows = inc([ep(6592, "MEDIA TALK", { title: "旧と同じ題", publishedAt: "2020/8/12 10:00", guid: "00000000-0000-4000-8000-0000000000c1" })], { oldTitles: [{ id: "EP-03857", show: "MEDIA TALK", title: "旧と同じ題", publishedAt: "2020-08-12T10:00:00+09:00" }] }).rows;
  assert.deepEqual([rows[0].status, rows[0].evidence.rule, rows[0].evidence.of], ["hold", "OLD_TITLE_DATE", "EP-03857"]);
});
test("過去分取込(配信日が10/22より前)を区別して記録する", () => {
  const rows = inc([ep(6592, "MEDIA TALK", { publishedAt: "2020/8/12 10:00" }), ep(6593, "MEDIA TALK", { publishedAt: "2026/10/23 4:00", guid: "00000000-0000-4000-8000-0000000000d1" })]).rows;
  assert.deepEqual(rows.map((r) => r.pastImport), [true, false]);
});
test("再配信語は保留、ただしアンコールの舞台は誤除外しない", () => {
  assert.equal(inc([ep(6592, "MEDIA TALK", { title: "【再配信】あの日" })]).rows[0].classification, "再配信候補");
  assert.equal(inc([ep(6592, "MEDIA TALK", { title: "アンコールの舞台裏" })]).rows[0].status, "candidate");
});
test("掲載件数: 承認済み確定分(5848)と審査後最大候補分を分離し、新側を確定に加算しない", () => {
  const judged = inc([ep(6592, "ニュースの現場から"), ep(6593, "アルキキ"), ep(6594, "MEDIA TALK", { guid: "" })]).rows;
  const c = recountPublication({ baselineAdopted: 5848, baselineSource: 6591, baselineDate: "2026-10-22", judged, asOf: "2026-11-10T00:00:00Z" });
  assert.equal(c.newCandidates, 1); assert.equal(c.newHold, 1); assert.equal(c.newExcluded, 1);
  assert.equal(c.confirmedAdoptable, 5848); assert.equal(c.maxAdoptableAfterReview, 5849); assert.equal(c.latestSource, 6594); assert.match(c.note, /上限であり確定値ではない/);
});
test("実CSV(新100件): 3件重複・97候補・確定5,848/最大5,945・番組別件数、97を確認済みにしない", async () => {
  const { readFileSync: rf } = await import("node:fs");
  const rows = ledgerFromRows(parseCsv(rf(new URL("../docs/audits/2026-11-10-increment/ledger-new-100-public-metadata.csv", import.meta.url), "utf8").replace(/^\uFEFF/, "")));
  const { oldGuidsFromCsv } = await import("../scripts/ledger-increment-judge.mjs");
  const oldGuids = oldGuidsFromCsv(rf(new URL("../docs/audits/2026-11-10-increment/old-guid-evidence.csv", import.meta.url), "utf8"));
  const res = judgeIncrement(rows, base, { auditEvidence: EVID, oldGuids });
  assert.equal(rows.length, 100); assert.equal(res.ok, true);
  const by = (k) => res.rows.filter((r) => r.status === k).length;
  assert.deepEqual([by("candidate"), by("hold"), by("excluded")], [97, 0, 3]);
  assert.deepEqual(res.rows.filter((r) => r.status === "excluded").map((r) => [r.id, r.evidence.of]), [["EP-06595", "EP-03857"], ["EP-06596", "EP-03858"], ["EP-06597", "EP-03861"]]);
  assert.equal(res.rows.some((r) => r.review === "確認済み" && r.status === "candidate"), false);
  const c = recountPublication({ baselineAdopted: 5848, baselineSource: 6591, baselineDate: "2026-10-22", judged: res.rows, asOf: "t" });
  assert.deepEqual([c.confirmedAdoptable, c.maxAdoptableAfterReview, c.latestSource, c.pastImportRows], [5848, 5945, 6691, 22]);
  assert.deepEqual(c.byShow["ニュースの学校"], { candidate: 14, hold: 0, excluded: 0 }); assert.equal(c.byShow["こどもそうだんしつ"].candidate, 7);
  assert.equal(res.rows.length, new Set(res.rows.map((r) => r.id)).size);
});
const API = (o = {}) => ({ genba: [], media: [], sdgs: [], houdan: [], donuts: [], sports: [], ...o });
const A = (title, pubDate, link = "", extra = {}) => ({ title, pubDate, link, duration: 600, spotify: "", clipId: "", mc: [], speakers: [], ...extra });
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
      A("どこにも無い", "2026-02-02", omny("ffffffff-ffff-4fff-8fff-ffffffffffff")), A("x", "2021-01-01", omny(G(dupOld))), A("x", "2021-01-01", omny(G(dupOld)))],
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
  const res = judgeIncrement([], base, { fullLedger: [...baseLedger, ...rows] });
  assert.equal(res.ok, true); assert.deepEqual(res.rows.map((r) => [r.id, r.status, r.comparison]), [["EP-06592", "candidate", "保留"], ["EP-06593", "hold", "対象外"]]);
});
test("CSV見出しの別名を解決し、必須列が無ければ停止", () => {
  const t = ledgerFromRows([["EP-ID", "番組", "タイトル", "配信日時", "GUID"], ["EP-06592", "MEDIA TALK", "a", "2026-11-01", "g"]]);
  assert.equal(t[0].guid, "g");
  assert.throws(() => ledgerFromRows([["EP-ID", "番組"]]), /LEDGER_HEADER_UNMAPPED/);
});
test("judgeOne は入力を変更しない", () => {
  const r = Object.freeze(ep(6592, "MEDIA TALK")); judgeOne(r, { guidSeen: new Map(), titleSeen: new Map(), oldGuids: new Map(), oldByTitle: new Map(), baseIds: new Map(), pastBefore: "2026-10-22", knownShows: new Set(["MEDIA TALK"]) });
});

// ---- speakers3.js で確認した画面の既定条件 ----
import { dedupeByLink, sheetExportToApiJson, inUiRange } from "../scripts/lib/onsa-count.mjs";
test("画面カウンタ: duration<=0・月範囲(2020-08〜閲覧月)外・長さ1000分以上は数えない", () => {
  const api = API({ genba: [A("ok", "2026-05-01"), A("長さ0", "2026-05-02", "", { duration: 0 }), A("範囲前", "2020-07-31T00:00:00+09:00"), A("範囲内", "2020-08-01T00:00:00+09:00"), A("未来", "2027-01-01"), A("長すぎ", "2026-05-03", "", { duration: 60000 })] });
  const p = projectApi(api, { asOf: "2026-11-10T09:14:00+09:00" });
  assert.deepEqual(p.items.map((i) => i.counted), [true, false, false, true, false, false]);
  assert.equal(inUiRange("2020-08-01T00:00:00+09:00", 60, "2026-11-10T00:00:00+09:00"), true);
});
test("API schema: mc/speakers 欠落は画面側で例外になるため unavailable 扱い", () => {
  assert.equal(projectApi(API({ genba: [{ title: "t", pubDate: "2026-05-01", duration: 1 }] }), { asOf: "x" }).status, "unavailable");
});
test("共同編集シート書き出し: 6番組タブのみ、先頭2行(見出し・注意書き)は除外、行数をEP件数とみなさない", () => {
  const row = (l) => l.join(",");
  const txt = ["## Sheet name: ニュースの現場から", "h1,h2,h3,h4", "note,,,", 'https://omny.fm/shows/asahi/a,"Thu, 06 Aug 2020 02:06:00 +0000",題A,100', "## Sheet name: ニュースの学校", "h", "n", 'https://omny.fm/shows/asahi/b,"Thu, 06 Aug 2020 02:06:00 +0000",学校,100', ""].join("\n");
  const { api, sheets } = sheetExportToApiJson(txt, parseCsv);
  assert.deepEqual(sheets, { "ニュースの現場から": 1 }); assert.equal(api.genba.length, 1); assert.equal(api.genba[0].pubDate, "2020-08-06T02:06:00.000Z");
});
test("同一linkのカテゴリ重複は専用番組側を残して1件にする（現場タブは総合フィード）", () => {
  const mk = (category, link) => ({ category, link, counted: true });
  const r = dedupeByLink([mk("genba", "L1"), mk("sports", "L1"), mk("genba", "L2")]);
  assert.deepEqual(r.map((i) => i.category + i.link).sort(), ["genbaL2", "sportsL1"]);
});
test("旧判定が保留/対象外だった項目は『旧保留(分類)』『旧対象外(分類)』として説明し、未解明にしない", () => {
  const hold = base.find((d) => d.publication === "保留" && d.classification === "同一性保留" && !/SDGs/.test(d.show));
  const g = "00000000-0000-4000-8000-0000000000e1";
  const ledger = baseLedger.map((r) => (r.id === hold.id ? { ...r, guid: g } : r));
  const r = classifyOnsaDiff({ projection: projectApi(API({ genba: [A("t", "2026-01-01", omny(g))] }), { asOf: "2026-11-10" }), ledger, baselineComparisonIds: [], decisions: base });
  assert.equal(r.summary["旧保留(同一性保留)"], 1); assert.equal(r.unexplained, 0);
});
