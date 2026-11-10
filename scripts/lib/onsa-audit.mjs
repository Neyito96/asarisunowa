// おんさ比較の母集団分離・重複根拠・強識別子による再照合・調査キュー。READ_ONLY・純粋関数。
import { projectApi, strongKeys, dedupeByLink, buildLedgerIndex, matchItem } from "./onsa-count.mjs";
import { categorizeAgainstBaseline } from "./ledger-increment.mjs";

// 台帳側の強識別子索引。records: [{id, show, title, publishedAt, links?:[url], guid?}]。キー→EP集合（一対多を検出するため集合で持つ）
export function buildStrongIndex(records) {
  const ix = new Map(), keysOf = new Map();
  for (const r of records) {
    if (r.duplicateOf) { keysOf.set(r.id, []); continue; }   // 重複確定行(新側)は強IDの持ち主にしない＝旧EPが唯一の持ち主
    const ks = [];
    for (const u of r.links || []) ks.push(...strongKeys({ link: u, spotify: u, clipId: u }));
    if (r.guid) ks.push(...strongKeys({ guid: r.guid }));
    const uniq = [...new Map(ks.map((k) => [k.join(":"), k])).values()];
    keysOf.set(r.id, uniq);
    for (const k of uniq) { const key = k.join(":"); (ix.get(key) || ix.set(key, new Set()).get(key)).add(r.id); }
  }
  return { ix, keysOf };
}
export function matchStrong(item, sx) {
  const ks = strongKeys(item), hits = [];
  for (const k of ks) { const set = sx.ix.get(k.join(":")); if (set) hits.push({ key: k.join(":"), eps: [...set] }); }
  if (!ks.length) return { tier: "NO_KEY", ep: "", hits };
  if (!hits.length) return { tier: "KEY_NO_HIT", ep: "", hits };
  if (hits.some((h) => h.eps.length > 1)) return { tier: "AMBIGUOUS", ep: "", hits };                  // 1つのキーが複数EPに対応
  const eps = new Set(hits.map((h) => h.eps[0]));
  return eps.size === 1 ? { tier: "STRONG", ep: [...eps][0], hits } : { tier: "CONFLICT", ep: "", hits };  // キー同士が別EPを指す
}

export function auditOnsa({ projection, extra = {}, records, decisions, baselineComparisonIds, screenshot, sheetMeta, asOf }) {
  const dec = new Map(decisions.map((d) => [d.id, d])), baseSet = new Set(baselineComparisonIds), byId = new Map(records.map((r) => [r.id, r]));
  const sx = buildStrongIndex(records), weakIx = buildLedgerIndex(records);
  const counted = projection.items.filter((i) => i.counted), uniq = dedupeByLink(counted);

  // ① 母集団（混ぜない）
  const populations = {
    sheetRawEntries: projection.rawArrayCount, sheetReadDataEntries: projection.readDataCount, sheetUiEntries: counted.length, uniqueLinkCount: uniq.length, duplicateEntries: counted.length - uniq.length,
    screenshot: screenshot || null, api: { status: "unavailable", note: "おんさAPI実データ未取得。画面値を現時点のAPI実数として扱わない" }, baselineComparison: { count: baseSet.size, decisionDate: "2026-10-22", definition: "旧判定 C=対象 かつ D=対象" },
    sheetMeta: sheetMeta || null,
  };
  const gap = (name, v, status, note) => ({ name, value: v, status, note });
  populations.gaps = [
    gap("sheetUiEntries − screenshot", counted.length - (screenshot?.value ?? NaN), "未説明", "同一基準(画面ルール)のシート再現と画面スクショの差。原因未確定"),
    gap("uniqueLinkCount − baselineComparison", uniq.length - baseSet.size, "暫定(シート基準)", "ユニークlinkと旧比較対象のEP単位照合の差"),
    gap("uniqueLinkCount − screenshot", uniq.length - (screenshot?.value ?? NaN), "原因未確定", "母集団が異なる（重複除去あり/なし）。更新時刻差と断定しない"),
    gap("screenshot − baselineComparison", (screenshot?.value ?? NaN) - baseSet.size, "母集団が異なる", "画面カウンタと旧判定は定義・時点が違う。293を収蔵漏れとしない"),
  ];

  // ② 重複根拠
  const byLink = new Map(); for (const i of counted) (byLink.get(i.link) || byLink.set(i.link, []).get(i.link)).push(i);
  const dups = [...byLink.values()].filter((v) => v.length > 1);
  const pair = {}, rows = [];
  for (const v of dups) {
    const cats = v.map((i) => i.category).sort().join("+"); const sameTitle = new Set(v.map((i) => i.title.normalize("NFKC").replace(/[（(][^）)]*[）)]/g, "").replace(/\s/g, ""))).size === 1;
    const sameDate = new Set(v.map((i) => i.publishedAt)).size === 1, sameSp = new Set(v.map((i) => i.spotifyId)).size === 1;
    (pair[cats] ||= { entries: 0, links: 0, sameDateAll: 0, sameSpotifyAll: 0, sameTitleIgnoringBrackets: 0, samples: [] });
    const p = pair[cats]; p.links++; p.entries += v.length; p.sameDateAll += sameDate; p.sameSpotifyAll += sameSp; p.sameTitleIgnoringBrackets += sameTitle;
    if (p.samples.length < 5) p.samples.push({ link: v[0].link, entries: v.map((i) => ({ category: i.category, title: i.title })), publishedAt: v[0].publishedAt });
    rows.push({ link: v[0].link, categories: cats, titles: v.map((i) => i.title), publishedAt: [...new Set(v.map((i) => i.publishedAt))], spotifyIds: [...new Set(v.map((i) => i.spotifyId))] });
  }
  const duplicates = { duplicateLinks: dups.length, duplicateEntriesBeyondFirst: dups.reduce((a, v) => a + v.length - 1, 0), byCategoryPair: pair, rows,
    note: "画面(speakers3.js)は重複を除かない。APIが除くかは未確認。ここでの除去は比較用のユニークlinkであり、画面件数ではない。" };

  // ③ 強識別子での再照合（ユニークlink 単位）と、題名+日付との突き合わせ
  const verdict = { STRONG: 0, AMBIGUOUS: 0, CONFLICT: 0, KEY_NO_HIT: 0, NO_KEY: 0 }, agree = { "強=弱(一致)": 0, "強=弱(旧重複行を解消)": 0, "強≠弱(矛盾→HOLD)": 0, "強のみ": 0, "弱のみ(旧側に強ID無し)": 0, "弱のみ(旧側に強IDあるが不一致→HOLD)": 0, "どちらも無し": 0 };
  const final = [], hold = [];
  for (const it of uniq) {
    const sm = matchStrong(it, sx); verdict[sm.tier]++;
    const wm = matchItem(it, weakIx), weakEp = wm?.ep?.id || "";
    let tier, ep = "";
    let resolvedDup = "";
    if (sm.tier === "STRONG") {
      ep = sm.ep;
      // 弱照合が別EPを指す場合: そのEPが10/22に「重複」と確定済みで、題名・日付が強一致EPと同一なら、台帳上の重複行とみなして強一致を採る（証拠を記録）
      const dupOfStrong = weakEp && weakEp !== sm.ep && dec.get(weakEp)?.classification === "重複" && sameTitleDay(byId.get(weakEp), byId.get(sm.ep));
      if (dupOfStrong) resolvedDup = weakEp;
      tier = weakEp === sm.ep ? "強=弱(一致)" : dupOfStrong ? "強=弱(旧重複行を解消)" : weakEp ? "強≠弱(矛盾→HOLD)" : "強のみ";
    }
    else if (sm.tier === "AMBIGUOUS" || sm.tier === "CONFLICT") tier = "強≠弱(矛盾→HOLD)";
    else if (weakEp) tier = (sx.keysOf.get(weakEp) || []).length ? "弱のみ(旧側に強IDあるが不一致→HOLD)" : "弱のみ(旧側に強ID無し)";
    else tier = "どちらも無し";
    agree[tier]++;
    const usable = tier === "強=弱(一致)" || tier === "強=弱(旧重複行を解消)" || tier === "強のみ" ? ep : tier === "弱のみ(旧側に強ID無し)" ? weakEp : "";
    const quality = tier === "強=弱(一致)" || tier === "強=弱(旧重複行を解消)" || tier === "強のみ" ? "強一致" : tier === "弱のみ(旧側に強ID無し)" ? "弱一致" : tier.includes("HOLD") ? "HOLD" : "未一致";
    final.push({ it, ep: usable, quality, tier, strongTier: sm.tier, weakEp, resolvedDup });
    if (quality === "HOLD") hold.push({ show: it.show, title: it.title, publishedAt: it.publishedAt, link: it.link, strong: sm.tier, strongHits: sm.hits, weakEp });
  }
  const resolved = final.filter((f) => f.resolvedDup).map((f) => ({ strongEp: f.ep, duplicateLedgerRow: f.resolvedDup, show: f.it.show, title: f.it.title }));
  const matching = { population: "uniqueLink", items: uniq.length, resolvedLedgerDuplicateRows: { count: resolved.length, byShow: resolved.reduce((a, r) => ((a[r.show] = (a[r.show] || 0) + 1), a), {}), rows: resolved }, strongKeyAvailability: verdict, agreement: agree,
    byQuality: final.reduce((a, f) => ((a[f.quality] = (a[f.quality] || 0) + 1), a), {}), holdCount: hold.length,
    note: "強一致=Omny URL/Spotify episode ID/朝日公式item ID/GUID。弱一致=題名+JST日付のみ（旧側に強IDが無い618件等）。HOLDは確定数に入れない。" };

  // ④ 差分カテゴリ（強/弱の別）
  const catTier = {}; const hits = new Map(); const unmatched = [];
  for (const f of final) {
    if (f.quality === "HOLD") continue;
    if (!f.ep) { unmatched.push(f); continue; }
    hits.set(f.ep, (hits.get(f.ep) || 0) + 1);
    if (baseSet.has(f.ep)) continue;
    const [cat] = categorizeAgainstBaseline(byId.get(f.ep) || { id: f.ep }, f.it, dec.get(f.ep));
    ((catTier[cat] ||= { strong: 0, weak: 0 })[f.quality === "強一致" ? "strong" : "weak"])++;
  }
  const allEntries = projection.items;  // 計数・非計数・重複を含む全シートエントリ（旧側のみ190の「他の場所にあるか」調査用）
  const entryIx = buildStrongIndexFromItems(allEntries, extra);
  const oldOnly = baselineComparisonIds.filter((id) => !hits.has(id)).map((id) => {
    const rec = byId.get(id) || { id }; const ks = sx.keysOf.get(id) || [];
    const found = []; for (const k of ks) for (const e of entryIx.get(k.join(":")) || []) found.push(e);
    const uniqFound = [...new Map(found.map((e) => [e.link + e.tab, e])).values()];
    let reason, priority;
    if (!ks.length) { reason = "旧側に強IDが無い（題名+日付のみ。弱照合でも不一致）"; priority = "P3"; }
    else if (uniqFound.length) { const e = uniqFound[0]; reason = e.tab ? `強IDが計数対象外タブ(${e.tab})に存在` : !e.counted ? `強IDがシートにあるが画面規則で非計数(${e.notCountedReason})` : "強IDがシートにあるが他EP/重複除去側と対応"; priority = e.tab || !e.counted ? "P2" : "P1"; }
    else { reason = "旧側の強IDがシートの全エントリに存在しない（シート書き出し時点で未掲載・削除・ID相違の可能性）"; priority = "P1"; }
    return { ep: id, show: rec.show || "", title: rec.title || "", strongKeysKnown: ks.length, foundIn: uniqFound.map((e) => e.tab || e.category), reason, priority };
  });
  const unmatchedQueue = unmatched.map((f) => {
    const sameTitle = records.filter((r) => r.title && f.it.title && r.title.normalize("NFKC").replace(/\s/g, "") === f.it.title.normalize("NFKC").replace(/\s/g, ""));
    return { show: f.it.show, title: f.it.title, publishedAt: f.it.publishedAt, link: f.it.link, strongTier: f.strongTier, priority: f.strongTier === "KEY_NO_HIT" ? "P1" : sameTitle.length ? "P2" : "P3",
      reason: f.strongTier === "KEY_NO_HIT" ? "強IDはあるが台帳側に対応EPなし（台帳未収蔵 or ID相違）" : sameTitle.length ? `同題が台帳に存在(${sameTitle.map((r) => r.id).slice(0, 3).join(",")})・日付/ID不一致→HOLD候補` : "強IDも題名も台帳に無い", candidates: sameTitle.slice(0, 3).map((r) => ({ id: r.id, date: r.publishedAt })) };
  });
  const prio = (q) => q.reduce((a, x) => ((a[x.priority] = (a[x.priority] || 0) + 1), a), {});
  return {
    status: "provisional", label: "暫定分析（おんさAPI実データ未取得。共同編集シート書き出し基準）", asOf,
    populations, duplicates, matching, diffCategoriesByTier: catTier,
    unmatchedOnsa: { count: unmatchedQueue.length, byPriority: prio(unmatchedQueue), queue: unmatchedQueue },
    oldComparisonOnly: { count: oldOnly.length, byPriority: prio(oldOnly), queue: oldOnly },
    hold: { count: hold.length, rows: hold },
  };
}
function buildStrongIndexFromItems(items, extra) {
  const m = new Map(); const add = (e, tab) => { for (const k of strongKeys(e)) { const key = k.join(":"); (m.get(key) || m.set(key, []).get(key)).push({ link: e.link, tab, category: e.category, counted: e.counted, notCountedReason: e.notCountedReason }); } };
  for (const i of items) add(i, "");
  for (const [tab, list] of Object.entries(extra)) for (const e of list) add(e, tab);
  return m;
}

const nt = (s) => String(s || "").normalize("NFKC").replace(/[\s\u3000]/g, "");
const dayJ = (v) => { const m = String(v || "").match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : ""; };
function sameTitleDay(a, b) { return !!a && !!b && nt(a.title) === nt(b.title) && dayJ(a.publishedAt) === dayJ(b.publishedAt); }
