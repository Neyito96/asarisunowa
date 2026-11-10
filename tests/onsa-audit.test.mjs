import test from "node:test";
import assert from "node:assert/strict";
import { auditOnsa, matchStrong, buildStrongIndex } from "../scripts/lib/onsa-audit.mjs";
import { projectApi } from "../scripts/lib/onsa-count.mjs";

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rec = (id, show, title, date, n, o = {}) => ({ id, show, title, publishedAt: date, links: n ? [`https://omny.fm/shows/asahi/${U(n)}`, `https://open.spotify.com/episode/SP${n}`, `https://www.asahi.com/special/podcasts/item/?itemid=${U(n)}`] : [], ...o });
const E = (title, date, n, o = {}) => ({ title, pubDate: date, link: `https://omny.fm/shows/asahi/${U(n)}`, spotify: `https://open.spotify.com/episode/SP${n}`, clipId: `https://www.asahi.com/special/podcasts/item/?itemid=${U(n)}`, duration: 600, mc: [], speakers: [], ...o });
const api = (o) => ({ genba: [], media: [], sdgs: [], houdan: [], donuts: [], sports: [], ...o });
const dec = (id, show, publication, classification, comparison) => ({ id, show, publication, classification, comparison, review: "確認済み" });
const run = ({ items, records, decisions, base, extra = {} }) => auditOnsa({ projection: projectApi(api(items), { asOf: "2026-11-10T09:14:00+09:00" }), extra, records, decisions, baselineComparisonIds: base, screenshot: { value: 5512, asOf: "2026-11-10T09:14:00+09:00", kind: "スクショ" }, sheetMeta: {}, asOf: "2026-11-10T12:00:00+09:00" });

test("母集団の分離: 画面エントリ/ユニークlink/スクショ/旧比較対象/API(unavailable)を別キーで保持し、差を『未説明』『暫定』と明示", () => {
  const r = run({ items: { genba: [E("a", "2026-05-01", 1), E("b", "2026-05-02", 2)], sports: [E("a", "2026-05-01", 1)] }, records: [rec("EP-1", "MEDIA TALK", "a", "2026-05-01", 1)], decisions: [dec("EP-1", "MEDIA TALK", "対象", "通常", "対象")], base: ["EP-1"] });
  const p = r.populations;
  assert.deepEqual([p.sheetUiEntries, p.uniqueLinkCount, p.duplicateEntries, p.screenshot.value, p.baselineComparison.count], [3, 2, 1, 5512, 1]);
  assert.equal(p.api.status, "unavailable"); assert.equal(r.status, "provisional"); assert.match(r.label, /暫定分析/);
  assert.equal(p.gaps[0].value, 3 - 5512); assert.equal(p.gaps[0].status, "未説明");
  assert.ok(p.gaps.every((g) => !/確定/.test(g.status) || /未確定/.test(g.status)));
});
test("重複の根拠: タブ間ペア別の件数・同一日付/同一Spotify ID・サンプルを保存", () => {
  const r = run({ items: { genba: [E("x", "2026-05-01", 1)], sports: [E("（相撲）x", "2026-05-01", 1)] }, records: [], decisions: [], base: [] });
  const d = r.duplicates; assert.equal(d.duplicateLinks, 1); assert.equal(d.duplicateEntriesBeyondFirst, 1);
  const pr = d.byCategoryPair["genba+sports"]; assert.deepEqual([pr.links, pr.entries, pr.sameDateAll, pr.sameSpotifyAll, pr.sameTitleIgnoringBrackets], [1, 2, 1, 1, 1]);
  assert.equal(pr.samples[0].entries.length, 2); assert.match(d.note, /重複を除かない/);
});
test("強識別子(Omny/Spotify/朝日item/GUID)で一致し、題名+日付と一致すれば『強=弱』", () => {
  const r = run({ items: { genba: [E("題", "2026-05-01T04:00:00+09:00", 1)] }, records: [rec("EP-1", "ニュースの現場から", "題", "2026-05-01T04:00:00+09:00", 1)], decisions: [dec("EP-1", "ニュースの現場から", "対象", "通常", "対象")], base: ["EP-1"] });
  assert.equal(r.matching.agreement["強=弱(一致)"], 1); assert.equal(r.matching.byQuality["強一致"], 1);
});
test("強ID一致で題名が違っても(題名+日付が無一致)強一致として採る。逆に弱一致だけで旧側に強IDがあり不一致ならHOLD", () => {
  const a = run({ items: { genba: [E("別名の題", "2026-05-01", 1)] }, records: [rec("EP-1", "x", "元の題", "2026-05-01", 1)], decisions: [dec("EP-1", "x", "対象", "通常", "対象")], base: ["EP-1"] });
  assert.equal(a.matching.agreement["強のみ"], 1);
  const b = run({ items: { genba: [E("同題", "2026-05-01", 9)] }, records: [rec("EP-1", "x", "同題", "2026-05-01", 1)], decisions: [dec("EP-1", "x", "対象", "通常", "対象")], base: ["EP-1"] });
  assert.equal(b.matching.agreement["弱のみ(旧側に強IDあるが不一致→HOLD)"], 1); assert.equal(b.hold.count, 1); assert.equal(b.oldComparisonOnly.count, 1);    // HOLDは確定一致に入れない
});
test("弱一致のみ(旧側に強IDが無い618件等)は『弱一致』として強一致と分けて数える", () => {
  const r = run({ items: { genba: [E("題", "2026-05-01", 9)] }, records: [rec("EP-1", "x", "題", "2026-05-01", 0)], decisions: [dec("EP-1", "x", "保留", "同一性保留", "保留")], base: [] });
  assert.equal(r.matching.byQuality["弱一致"], 1); assert.deepEqual(r.diffCategoriesByTier["旧保留(同一性保留)"], { strong: 0, weak: 1 });
});
test("強一致EPと弱一致EPが違い、弱側が10/22に『重複』確定で題名・日付が同一なら台帳の重複行として解消。そうでなければHOLD", () => {
  const records = [rec("EP-1", "x", "題", "2026-05-01", 1), rec("EP-2", "報談", "題", "2026-05-01", 0)];
  const ok = run({ items: { houdan: [E("題", "2026-05-01", 1)] }, records, decisions: [dec("EP-1", "x", "対象", "通常", "対象"), dec("EP-2", "報談", "対象外", "重複", "対象外")], base: ["EP-1"] });
  assert.equal(ok.matching.agreement["強=弱(旧重複行を解消)"], 1); assert.equal(ok.matching.resolvedLedgerDuplicateRows.count, 1); assert.equal(ok.hold.count, 0);
  const ng = run({ items: { houdan: [E("題", "2026-05-01", 1)] }, records: [records[0], rec("EP-2", "報談", "題", "2026-05-01", 0)], decisions: [dec("EP-1", "x", "対象", "通常", "対象"), dec("EP-2", "報談", "保留", "同一性保留", "保留")], base: ["EP-1"] });
  assert.equal(ng.hold.count, 1);
});
test("1つの強IDが複数EPに対応(一対多)・強ID同士が別EPを指す場合は確定せずHOLD。重複確定行(duplicateOf)は持ち主から除く", () => {
  const sx = buildStrongIndex([rec("EP-1", "x", "a", "d", 1), rec("EP-2", "x", "b", "d", 1)]);
  assert.equal(matchStrong(E("a", "2026-05-01", 1), sx).tier, "AMBIGUOUS");
  const sx2 = buildStrongIndex([rec("EP-1", "x", "a", "d", 1), rec("EP-2", "x", "b", "d", 1, { duplicateOf: "EP-1" })]);
  const m = matchStrong(E("a", "2026-05-01", 1), sx2); assert.deepEqual([m.tier, m.ep], ["STRONG", "EP-1"]);
  const sx3 = buildStrongIndex([rec("EP-1", "x", "a", "d", 1), { id: "EP-3", show: "x", title: "c", publishedAt: "d", links: [`https://open.spotify.com/episode/SP7`] }]);
  assert.equal(matchStrong({ ...E("a", "2026-05-01", 1), spotify: "https://open.spotify.com/episode/SP7" }, sx3).tier, "CONFLICT");
});
test("調査キュー: 強IDがあるのに台帳に無い=P1、同題が別日付で台帳にある=P2、強IDも題名も無い=P3（未一致onsa）", () => {
  const r = run({ items: { genba: [E("新", "2026-05-01", 5), { ...E("既存題", "2026-05-09", 6) }] }, records: [rec("EP-9", "x", "既存題", "2026-04-01", 0)], decisions: [dec("EP-9", "x", "保留", "同一性保留", "保留")], base: [] });
  const q = r.unmatchedOnsa.queue; assert.equal(q.length, 2); assert.ok(q.every((x) => x.priority === "P1"));   // どちらも強IDを持つがKEY_NO_HIT
  const nk = run({ items: { genba: [{ ...E("題だけ", "2026-05-01", 5), link: "https://example.com/x", spotify: "", clipId: "" }] }, records: [rec("EP-9", "x", "題だけ", "2026-04-01", 0)], decisions: [], base: [] });
  assert.equal(nk.unmatchedOnsa.queue[0].priority, "P2");
});
test("旧比較対象のみ(おんさ側で未一致): 強IDが計数対象外タブにある/画面規則で非計数/全く無い、を区別して理由を記録", () => {
  const records = [rec("EP-1", "x", "a", "2026-05-01", 1), rec("EP-2", "x", "b", "2026-05-02", 2), rec("EP-3", "x", "c", "2026-05-03", 3)];
  const r = run({ items: { genba: [E("（再）b", "2026-05-02", 2)] }, records, decisions: records.map((x) => dec(x.id, "x", "対象", "通常", "対象")), base: ["EP-1", "EP-2", "EP-3"], extra: { ニュースの学校: [E("a", "2026-05-01", 1)] } });
  const by = Object.fromEntries(r.oldComparisonOnly.queue.map((x) => [x.ep, x]));
  assert.match(by["EP-1"].reason, /計数対象外タブ\(ニュースの学校\)/); assert.match(by["EP-2"].reason, /画面規則で非計数/); assert.match(by["EP-3"].reason, /存在しない/);
  assert.deepEqual(r.oldComparisonOnly.byPriority, { P2: 2, P1: 1 });
});
test("集計の整合: ユニークlink = 旧比較に含まれる分 + 要因カテゴリ + 未一致 + HOLD", () => {
  const records = [rec("EP-1", "x", "a", "2026-05-01", 1), rec("EP-2", "x", "b", "2026-05-02", 2)];
  const r = run({ items: { genba: [E("a", "2026-05-01", 1), E("b", "2026-05-02", 2), E("zz", "2026-05-03", 8)] }, records, decisions: [dec("EP-1", "x", "対象", "通常", "対象"), dec("EP-2", "x", "保留", "同一性保留", "保留")], base: ["EP-1"] });
  const cats = Object.values(r.diffCategoriesByTier).reduce((a, v) => a + v.strong + v.weak, 0);
  assert.equal(r.populations.uniqueLinkCount, 1 + cats + r.unmatchedOnsa.count + r.hold.count);
});
