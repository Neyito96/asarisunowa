import { buildLedgerIndex, matchItem, dedupeByLink } from "./onsa-count.mjs";
// 増分判定: 10/22凍結基準（decisions.json.gz）に無い新着EP-IDを、同じ基準で判定する。READ_ONLY・純粋関数。
// 原本の物理削除・再採番・本番書込は行わない。新側の公開採用は停止し、採用可能なものは「掲載候補(未審査)」止まり。
export const POLICY_VERSION = "REVIEWED_D_TARGET/increment-2";
export const EXCLUDED_SHOWS = new Set(["アルキキ", "AJW", "朝ポキTV"]);        // 10/22: 対象外番組
export const SCHOOL = "ニュースの学校";                                     // 宇宙候補として保護／おんさ比較からは除外
export const SUCCESSOR = "こどもそうだんしつ";                                // 後継番組: 掲載候補、比較外
export const COMPARISON_OUT_SHOWS = new Set([SCHOOL, SUCCESSOR]);
const REAIR = /再配信|再放送|リピート|アンコール配信|【再】|\[再\]/;
const ENCORE_OK = /アンコールの舞台/;                                          // EP04305: 再配信ではない採用話（10/22 誤除外防止）
export const validId = (id) => /^EP-\d{5}$/.test(id || "");
const s = (v) => String(v ?? "").trim();
const norm = (t) => s(t).normalize("NFKC").toLowerCase().replace(/[\s\u3000"'“”‘’「」『』【】\[\]()（）・,、。.!！?？~〜\-_:：|｜/／]/g, "");
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const guidOf = (v) => ((s(v).match(UUID) || [""])[0]).toLowerCase();
// "2026/10/17 4:00" / "2026-10-17T04:00:00+09:00" 等 → "2026-10-17"（JSTの暦日）
export function dayOf(t) {
  const v = s(t), m = v.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v) + 9 * 3600000).toISOString().slice(0, 10) : v.slice(0, 10);
}
const key = (show, title, date) => show + "\u0000" + norm(title) + "\u0000" + dayOf(date);

// newRows: 新側の行 [{id, show, title, publishedAt, guid}]
// baseline: 凍結判定 decisions 配列（10/22）
// opts.oldGuids: Map<guid, {id, source}>  旧側の公式GUID（旧判定H列・旧台帳G列など。旧G列空白でも重複を見逃さない）
// opts.oldTitles: [{id, show, title, publishedAt}]  旧側の題名+日付（GUIDが無い旧EP向けの補助照合）
// opts.fullLedger: 旧+新の全行（完全照合モード）。指定時は旧EP-IDの存在・一意性を検証し、旧側GUID/題名もここから作る。
// opts.auditEvidence: 増分モードでは必須。旧全件存在・ID一意を外部でREAD_ONLY確認した証拠文字列。
export function judgeIncrement(newRows, baseline, opts = {}) {
  const baseIds = new Map(baseline.map((d) => [d.id, d]));
  const oldGuids = new Map(opts.oldGuids || []), oldTitles = [...(opts.oldTitles || [])];
  let rows = newRows, mode = "increment";
  if (opts.fullLedger) {
    mode = "full";
    const all = opts.fullLedger, ids = new Set(), dupIds = [], malformed = [];
    for (const r of all) { if (!validId(r.id)) malformed.push(r.id); else if (ids.has(r.id)) dupIds.push(r.id); ids.add(r.id); }
    const missingBaseline = baseline.filter((d) => !ids.has(d.id)).map((d) => d.id);
    if (missingBaseline.length || dupIds.length || malformed.length) return { ok: false, stop: "LEDGER_INTEGRITY", missingBaseline, dupIds, malformed };
    for (const r of all) if (baseIds.has(r.id)) { const g = guidOf(r.guid); if (g && !oldGuids.has(g)) oldGuids.set(g, { id: r.id, source: "旧台帳G列" }); oldTitles.push(r); }
    rows = all.filter((r) => !baseIds.has(r.id));
  } else {
    if (!s(opts.auditEvidence)) return { ok: false, stop: "AUDIT_EVIDENCE_REQUIRED", detail: "増分モードは旧全件の存在・ID一意を確認した外部監査証拠(auditEvidence)が必須" };
    const bad = rows.filter((r) => !validId(r.id) || baseIds.has(r.id)).map((r) => r.id);
    const dup = rows.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
    if (bad.length || dup.length) return { ok: false, stop: "INCREMENT_INTEGRITY", malformedOrAlreadyJudged: bad, dupIds: dup };
  }
  const guidSeen = new Map(), titleSeen = new Map();
  for (const r of rows) { const g = guidOf(r.guid); if (g && !guidSeen.has(g)) guidSeen.set(g, r.id); if (norm(r.title)) { const k = key(r.show, r.title, r.publishedAt); if (!titleSeen.has(k)) titleSeen.set(k, r.id); } }
  const oldByTitle = new Map(); for (const o of oldTitles) { if (norm(o.title)) { const k = key(o.show, o.title, o.publishedAt); if (!oldByTitle.has(k)) oldByTitle.set(k, o.id); } }
  const knownShows = opts.knownShows || new Set(baseline.map((d) => d.show));
  const ctx = { guidSeen, titleSeen, oldGuids, oldByTitle, knownShows, baseIds, pastBefore: opts.pastBefore || "2026-10-22" };
  return { ok: true, policy: POLICY_VERSION, mode, auditEvidence: s(opts.auditEvidence), rows: rows.map((r) => judgeOne(r, ctx)) };
}

function out(r, ctx, status, publication, comparison, classification, review, reason, evidence) {
  return { id: r.id, show: r.show, title: r.title, publishedAt: r.publishedAt, guid: r.guid || "", status, publication, comparison, classification, review, reason, pastImport: dayOf(r.publishedAt) < ctx.pastBefore, evidence };
}

// status: candidate(掲載候補・未審査) / hold / excluded。candidate の publication は「保留」のまま＝公式採用ではない。
export function judgeOne(r, ctx) {
  const show = s(r.show), title = s(r.title), g = guidOf(r.guid);
  const cmpDefault = COMPARISON_OUT_SHOWS.has(show) ? "対象外" : "保留";
  const O = (...a) => out(r, ctx, ...a);
  if (EXCLUDED_SHOWS.has(show)) return O("excluded", "対象外", "対象外", "対象外番組", "確認済み", "10/22基準の公開対象外番組", { rule: "EXCLUDED_SHOW" });
  if (!show || !ctx.knownShows.has(show)) return O("hold", "保留", "保留", "同一性保留", "要照合", "未知の番組（基準に無い番組は自動採用しない）", { rule: "UNKNOWN_SHOW" });
  const old = g && ctx.oldGuids.get(g);                              // 旧EPの公式GUIDとの一致を最優先（旧G列が空でも旧H列で検出）
  if (old) { const od = ctx.baseIds.get(old.id); return O("excluded", "対象外", "対象外", "重複", "確認済み", `旧${old.id}と公式GUID一致（${old.source}）。旧EPを保持し新側は掲載対象外`, { rule: "OLD_GUID_DUP", of: old.id, oldSource: old.source, oldDecision: od ? `${od.comparison}/${od.publication}/${od.review}` : "" }); }
  const missing = ["title", "publishedAt", "guid"].filter((k) => !s(r[k]));
  if (missing.length) return O("hold", "保留", cmpDefault, "同一性保留", "要照合", `未確認: ${missing.join(",")} 欠落`, { rule: "MISSING_FIELDS", missing });
  const gi = ctx.guidSeen.get(g);
  if (gi && gi !== r.id) return O("excluded", "対象外", "対象外", "重複", "確認済み", `新側内でGUID一致: ${gi}`, { rule: "GUID_DUP", of: gi });
  const k = key(show, title, r.publishedAt), ot = ctx.oldByTitle.get(k);
  if (ot) return O("hold", "保留", cmpDefault, "同一性保留", "要照合", `旧${ot}と同番組・同題・同日（公式GUIDで確認できないため自動除外しない）`, { rule: "OLD_TITLE_DATE", of: ot });
  const t = ctx.titleSeen.get(k);
  if (t && t !== r.id) return O("hold", "保留", cmpDefault, "同一性保留", "要照合", `新側内で同番組・同題・同日の別ID ${t}`, { rule: "TITLE_DATE_DUP", of: t });
  if (REAIR.test(title) && !ENCORE_OK.test(title)) return O("hold", "保留", cmpDefault, "再配信候補", "要照合", "題名に再配信/再放送語", { rule: "REAIR_TITLE" });
  const base = { review: "未審査(候補)" };
  if (show === SCHOOL) return O("candidate", "保留", "対象外", "日時差分", base.review, "ニュースの学校: 宇宙候補として保護、おんさ比較からは除外。公式GUID・題名・日時は揃うが人の審査前", { rule: "SCHOOL_PROTECTED" });
  if (show === SUCCESSOR) return O("candidate", "保留", "対象外", "通常", base.review, "後継番組: 掲載候補・比較外。人の審査前", { rule: "SUCCESSOR" });
  return O("candidate", "保留", "保留", "通常", base.review, "公式GUID・題名・日時が揃い、旧GUID/題名重複・再配信語なし。人の審査前の掲載候補。おんさ比較は照合待ち", { rule: "NORMAL_COMPLETE" });
}

const tally = (rows, k) => rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
// 掲載件数: 承認済み確定分（凍結5,848）と、審査後の最大候補分を分けて出す。新側は審査完了まで確定に加算しない。
export function recountPublication({ baselineAdopted, baselineSource, baselineDate, judged, asOf, movedFromBaseline = [] }) {
  const cand = judged.filter((r) => r.status === "candidate"), hold = judged.filter((r) => r.status === "hold"), excl = judged.filter((r) => r.status === "excluded");
  const show = {}; for (const r of judged) (show[r.show] ||= { candidate: 0, hold: 0, excluded: 0 })[r.status]++;
  return {
    asOf, baseline: { adopted: baselineAdopted, source: baselineSource, decisionDate: baselineDate, label: "承認済み凍結基準（10/22）" },
    newRows: judged.length, newCandidates: cand.length, newHold: hold.length, newExcluded: excl.length, pastImportRows: judged.filter((r) => r.pastImport).length,
    movedFromAdoptedToHoldOrExcluded: movedFromBaseline.length,
    confirmedAdoptable: baselineAdopted - movedFromBaseline.length,                           // 承認済み確定分（新側は審査前なので加算しない）
    maxAdoptableAfterReview: baselineAdopted - movedFromBaseline.length + cand.length,        // 全候補が審査で採用された場合の上限
    latestSource: baselineSource + judged.length,
    note: "maxAdoptableAfterReview は上限であり確定値ではない。本番反映・公開は別承認。",
    byClassification: tally(judged, "classification"), byStatus: tally(judged, "status"), byShow: show,
  };
}

// おんさ比較差分のEP単位照合。projection = projectApi() の結果（画面のカウンタ定義で計数される項目 counted のみを比較母集団にする）。
// 旧比較対象(baselineComparisonIds)との差を、説明可能（新着/旧SDGs/再配信/日時差分/番組構成）と未解明に分け、
// 逆方向（旧比較対象なのにおんさ側に無い＝不足）と同一EPへの多重対応（重複）も出す。基準日時が違うため収蔵漏れとは断定しない。
export function classifyOnsaDiff({ projection, ledger, baselineComparisonIds, baselineSnapshotDate, decisions, dedupe = false }) {
  if (!projection || projection.status !== "ok") return { status: "unavailable", reason: projection?.reason || "NO_PROJECTION", asOf: projection?.asOf || null };
  const ix = buildLedgerIndex(ledger), baseSet = new Set(baselineComparisonIds), dec = new Map((decisions || []).map((d) => [d.id, d]));
  const all = dedupe ? dedupeByLink(projection.items.filter((i) => i.counted)).concat(projection.items.filter((i) => !i.counted)) : projection.items;
  const counted = all.filter((i) => i.counted), rows = [], hits = new Map(), summary = {}, by = {};
  const put = (cat, it, ep, why, how) => { summary[cat] = (summary[cat] || 0) + 1; rows.push({ category: cat, explained: cat !== "未解明", show: it.show, title: it.title, publishedAt: it.publishedAt, ep: ep?.id || "", matchedBy: how || "", why }); };
  for (const it of counted) {
    const m = matchItem(it, ix);
    if (!m) { put("未解明", it, null, "原本に照合できない（GUID/Spotify ID/題名+日付のいずれも不一致）。収蔵漏れとは断定しない"); continue; }
    const ep = m.ep; by[m.by] = (by[m.by] || 0) + 1; hits.set(ep.id, (hits.get(ep.id) || 0) + 1);
    if (baseSet.has(ep.id)) continue;                                               // 旧比較対象5,219に含まれる＝差分ではない
    const d = dec.get(ep.id), n = Number(ep.id.slice(3));
    if (!d && n > 6591) put("新着(EP-06592以降)", it, ep, "10/22判定後の新規収蔵", m.by);
    else if (d && ["再配信", "再配信候補"].includes(d.classification)) put("再配信", it, ep, `旧判定 ${d.classification}`, m.by);
    else if (/SDGs/.test(it.show) && d && d.publication !== "対象") put("旧SDGs", it, ep, `旧判定 ${d.publication}/${d.classification}`, m.by);
    else if (d && d.comparison === "保留" && d.publication === "対象") put("期間・日時差分", it, ep, "旧比較は保留、掲載は日時差分で採用(113件群)", m.by);
    else if (d && ["対象外番組", "重複"].includes(d.classification)) put("番組構成", it, ep, `旧判定 ${d.classification}`, m.by);
    else if (d && d.publication === "保留") put(`旧保留(${d.classification})`, it, ep, `旧判定 保留/${d.classification}/比較${d.comparison}。10/22時点で比較・掲載とも確定していない`, m.by);
    else if (d && d.publication === "対象外") put(`旧対象外(${d.classification})`, it, ep, `旧判定 対象外/${d.classification}`, m.by);
    else put("未解明", it, ep, d ? `旧判定 ${d.publication}/${d.classification}/比較${d.comparison} では説明できない` : "旧判定なし", m.by);
  }
  const matchedEp = new Set(hits.keys()), allByKey = new Map(all.map((i) => [i, matchItem(i, ix)]));
  const notCountedHit = new Map(); for (const [i, m] of allByKey) if (m && !i.counted) notCountedHit.set(m.ep.id, i.notCountedReason);
  const missing = baselineComparisonIds.filter((id) => !matchedEp.has(id)).map((id) => ({ ep: id, show: (ledger.find((r) => r.id === id) || {}).show || "", why: notCountedHit.get(id) || "おんさ側に照合できる項目なし（API取得時点・番組範囲・識別子差のいずれか）" }));
  const dups = [...hits].filter(([, n]) => n > 1).map(([ep, n]) => ({ ep, count: n }));
  return { status: "ok", asOf: projection.asOf, baselineSnapshotDate, baselineComparison: baseSet.size, uiCounter: projection.uiCounter, rawArrayCount: projection.rawArrayCount, dedupe, duplicateEntriesRemoved: dedupe ? projection.items.filter((i) => i.counted).length - counted.length : 0, diff: counted.length - baseSet.size,
    explained: rows.filter((r) => r.explained).length, unexplained: rows.filter((r) => !r.explained).length, summary, matchedBy: by,
    missingFromOnsa: missing, duplicateMatches: dups, rows,
    note: "基準日時が異なるため差分を収蔵漏れとは判定しない。画面カウンタ(6番組・SDGsカット・actualDuration>0)とAPI生配列件数は別物。未解明は個別調査対象。" };
}
