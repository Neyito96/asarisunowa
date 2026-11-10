// 増分判定: 10/22凍結基準（decisions.json.gz）に無い新着EP-IDを、同じ基準で判定する。READ_ONLY・純粋関数。
// 原本の物理削除・再採番・本番書込は行わない。未確認は無条件で公開対象にしない（保留）。
export const POLICY_VERSION = "REVIEWED_D_TARGET/increment-1";
export const EXCLUDED_SHOWS = new Set(["アルキキ", "AJW", "朝ポキTV"]);        // 10/22: 対象外番組
export const SCHOOL = "ニュースの学校";                                     // 宇宙候補として保護／おんさ比較からは除外
export const SUCCESSOR = "こどもそうだんしつ";                                // 後継番組: 掲載採用、比較外
export const COMPARISON_OUT_SHOWS = new Set([SCHOOL, SUCCESSOR]);
const REAIR = /再配信|再放送|リピート|アンコール配信|【再】|\[再\]/;
const ENCORE_OK = /アンコールの舞台/;                                          // EP04305: 再配信ではない採用話（10/22 誤除外防止）
export const validId = (id) => /^EP-\d{5}$/.test(id || "");
const s = (v) => String(v ?? "").trim();
const norm = (t) => s(t).normalize("NFKC").toLowerCase().replace(/[\s　"'“”‘’「」『』【】\[\]()（）・,、。.!！?？~〜\-_:：|｜/／]/g, "");

// ledger: [{id, show, title, publishedAt, guid, audioUrl}]  baseline: decisions.json の decisions 配列
export function judgeIncrement(ledger, baseline, opts = {}) {
  const baseIds = new Map(baseline.map((d) => [d.id, d]));
  const ids = new Set(), dupIds = [], malformed = [];
  for (const r of ledger) { if (!validId(r.id)) malformed.push(r.id); else if (ids.has(r.id)) dupIds.push(r.id); ids.add(r.id); }
  const missingBaseline = baseline.filter((d) => !ids.has(d.id)).map((d) => d.id);    // 旧EP-IDの消失
  if (missingBaseline.length || dupIds.length || malformed.length) {
    return { ok: false, stop: "LEDGER_INTEGRITY", missingBaseline, dupIds, malformed };
  }
  const guidSeen = new Map(), titleSeen = new Map();
  for (const r of ledger) {
    if (s(r.guid)) { const g = s(r.guid); if (!guidSeen.has(g)) guidSeen.set(g, r.id); }
    const k = r.show + "\u0000" + norm(r.title) + "\u0000" + s(r.publishedAt).slice(0, 10);
    if (norm(r.title) && !titleSeen.has(k)) titleSeen.set(k, r.id);
  }
  const rows = [];
  for (const r of ledger) {
    if (baseIds.has(r.id)) continue;
    rows.push(judgeOne(r, { guidSeen, titleSeen, knownShows: opts.knownShows || new Set(baseline.map((d) => d.show)) }));
  }
  return { ok: true, policy: POLICY_VERSION, rows };
}

function out(r, publication, comparison, classification, review, reason, evidence) {
  return { id: r.id, show: r.show, title: r.title, publishedAt: r.publishedAt, guid: r.guid || "", publication, comparison, classification, review, reason, evidence };
}

export function judgeOne(r, ctx) {
  const show = s(r.show), title = s(r.title);
  const comparisonDefault = COMPARISON_OUT_SHOWS.has(show) ? "対象外" : "保留";   // 比較対象は旧おんさ照合が取れるまで保留
  if (EXCLUDED_SHOWS.has(show)) return out(r, "対象外", "対象外", "対象外番組", "確認済み", "10/22基準の公開対象外番組", { rule: "EXCLUDED_SHOW" });
  const missing = ["title", "publishedAt", "guid"].filter((k) => !s(r[k]));
  if (!show || !ctx.knownShows.has(show)) return out(r, "保留", "保留", "同一性保留", "要照合", "未知の番組（基準に無い番組は自動採用しない）", { rule: "UNKNOWN_SHOW" });
  if (missing.length) return out(r, "保留", comparisonDefault, "同一性保留", "要照合", `未確認: ${missing.join(",")} 欠落`, { rule: "MISSING_FIELDS", missing });
  const g = ctx.guidSeen.get(s(r.guid));
  if (g && g !== r.id) return out(r, "対象外", "対象外", "重複", "確認済み", `GUID一致: ${g}`, { rule: "GUID_DUP", of: g });
  const k = show + "\u0000" + norm(title) + "\u0000" + s(r.publishedAt).slice(0, 10);
  const t = ctx.titleSeen.get(k);
  if (t && t !== r.id) return out(r, "保留", comparisonDefault, "同一性保留", "要照合", `同番組・同題・同日の別ID ${t}（GUID不一致のため自動除外しない）`, { rule: "TITLE_DATE_DUP", of: t });
  if (REAIR.test(title) && !ENCORE_OK.test(title)) return out(r, "保留", comparisonDefault, "再配信候補", "要照合", "題名に再配信/再放送語", { rule: "REAIR_TITLE" });
  if (show === SCHOOL) return out(r, "対象", "対象外", "日時差分", "確認済み", "ニュースの学校: 宇宙候補として保護、おんさ比較からは除外", { rule: "SCHOOL_PROTECTED" });
  if (show === SUCCESSOR) return out(r, "対象", "対象外", "通常", "確認済み", "後継番組: 掲載採用・比較外", { rule: "SUCCESSOR" });
  return out(r, "対象", "保留", "通常", "確認済み", "公式識別子(GUID)・題名・日時が揃い重複/再配信語なし。おんさ比較は照合データ待ち", { rule: "NORMAL_COMPLETE" });
}

const tally = (rows, key) => rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {});
// 掲載件数の再計算。基準(5,848)から「新規に掲載可能」「保留/除外へ移動」を分離。旧判定を最新値として出さない。
export function recountPublication({ baselineAdopted, baselineSource, baselineDate, judged, asOf, movedFromBaseline = [] }) {
  const added = judged.filter((r) => r.publication === "対象");
  const toHold = judged.filter((r) => r.publication === "保留"), toExcl = judged.filter((r) => r.publication === "対象外");
  const demoted = movedFromBaseline.length;
  return {
    asOf, baseline: { adopted: baselineAdopted, source: baselineSource, decisionDate: baselineDate, label: "凍結済み旧基準（最新件数ではない）" },
    newRows: judged.length, newlyAdoptable: added.length, newHold: toHold.length, newExcluded: toExcl.length, movedFromAdoptedToHoldOrExcluded: demoted,
    latestAdoptable: baselineAdopted + added.length - demoted, latestSource: baselineSource + judged.length,
    note: "latestAdoptable は『凍結基準 + 新規採用 − 基準からの移動』。本番反映・公開は別承認。",
    byClassification: tally(judged, "classification"), byShow: judged.reduce((a, r) => { (a[r.show] ||= { 対象: 0, 保留: 0, 対象外: 0 })[r.publication]++; return a; }, {})
  };
}

// おんさ比較差分の分類。onsa: [{show, guid?, title?, publishedAt?}]（外部実測側）, comparisonSet: 旧比較対象 EP-ID 集合
// 差分を「説明可能」「未解明」に分ける。基準日時が違うため差を収蔵漏れと断定しない。
export function classifyOnsaDiff({ onsaItems, ledger, baselineComparisonIds, baselineSnapshotDate, onsaAsOf, decisions }) {
  const byGuid = new Map(ledger.filter((r) => s(r.guid)).map((r) => [s(r.guid), r]));
  const byKey = new Map(ledger.map((r) => [r.show + "\u0000" + norm(r.title), r]));
  const baseSet = new Set(baselineComparisonIds);
  const dec = new Map((decisions || []).map((d) => [d.id, d]));
  const cats = {}; const rows = [];
  const put = (cat, it, ep, why) => { (cats[cat] ||= []).push(it); rows.push({ category: cat, explained: cat !== "未解明", show: it.show, title: it.title || "", ep: ep?.id || "", why }); };
  for (const it of onsaItems) {
    const ep = (s(it.guid) && byGuid.get(s(it.guid))) || byKey.get(it.show + "\u0000" + norm(it.title));
    if (!ep) { put("未解明", it, null, "原本に照合できない（収蔵漏れとは断定しない）"); continue; }
    if (baseSet.has(ep.id)) continue;                                               // 旧比較対象5,219に含まれる＝差分ではない
    const d = dec.get(ep.id);
    const n = Number(ep.id.slice(3));
    if (!d && n > 6591) put("新着(EP-06592以降)", it, ep, "10/22判定後の新規収蔵");
    else if (d && ["再配信", "再配信候補"].includes(d.classification)) put("再配信", it, ep, `旧判定 ${d.classification}`);
    else if (/SDGs/.test(it.show) && d && d.publication !== "対象") put("旧SDGs", it, ep, `旧判定 ${d.publication}/${d.classification}`);
    else if (d && d.comparison === "保留" && d.publication === "対象") put("期間・日時差分", it, ep, "旧比較は保留、掲載は日時差分で採用(113件群)");
    else if (d && COMPARISON_OUT_SHOWS.has(ep.show)) put("番組構成", it, ep, "旧比較外番組");
    else if (d && ["対象外番組", "重複"].includes(d.classification)) put("番組構成", it, ep, `旧判定 ${d.classification}`);
    else put("未解明", it, ep, "旧判定上は説明できない");
  }
  const summary = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v.length]));
  return { onsaAsOf, baselineSnapshotDate, baselineComparison: baseSet.size, onsaItems: onsaItems.length, diff: onsaItems.length - baseSet.size, explained: rows.filter((r) => r.explained).length, unexplained: rows.filter((r) => !r.explained).length, summary, rows,
    note: "基準日時が異なるため差分を収蔵漏れとは判定しない。未解明は個別調査対象。" };
}
