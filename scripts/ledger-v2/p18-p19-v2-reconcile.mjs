/**
 * P18/P19 -> V2 candidate reconciliation (pure JS; no GAS side effects).
 * Input rows are normalized by a separate, audited header adapter.
 * This module never guesses episode URLs or rewrites existing URLs.
 */
export const SERVICES = Object.freeze(["Spotify", "Apple", "Amazon", "Pocket Casts", "LISTEN", "Pody"]);
const norm = v => String(v ?? "").trim();
const key = r => [norm(r.show), norm(r.guid)].join("\u001f");
const isEpisodeUrl = (service, value) => {
  const raw = norm(value);
  if (!raw || !/^https:\/\//i.test(raw)) return false;
  let u;
  try { u = new URL(raw); } catch { return false; }
  const host = u.hostname.toLowerCase();
  const path = decodeURIComponent(u.pathname);
  switch (service) {
    case "Spotify": return host === "open.spotify.com" && /^\/episode\/[^/]+\/?$/.test(path);
    case "Apple": return /(^|\.)podcasts\.apple\.com$/.test(host) && /[?&]i=\d+/.test(u.search);
    case "Pocket Casts": return host === "pca.st" && path.length > 1;
    case "LISTEN": return host === "listen.style" && /^\/p\/[^/]+\/[^/]+/.test(path);
    // No independently verified episode URL schema yet: hold rather than fabricate.
    case "Amazon": case "Pody": return false;
    default: return false;
  }
};
/**
 * rows: [{epId,show,guid,urls:{Spotify:...}}]
 * candidates: [{show,guid,service,url,sourceEpId?}]
 * Output: proposals and holds; does not write any spreadsheet.
 */
export function planV2UrlCandidates(rows, candidates) {
  const index = new Map();
  for (const row of rows) {
    if (!norm(row.guid) || !norm(row.show)) continue;
    const k = key(row);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(row);
  }
  const proposals = [], holds = [], seen = new Map();
  for (const candidate of candidates) {
    const service = norm(candidate.service), url = norm(candidate.url);
    const k = key(candidate);
    const matches = index.get(k) ?? [];
    const fail = reason => holds.push({candidate,reason});
    if (!norm(candidate.guid) || !norm(candidate.show)) { fail("MISSING_IDENTITY"); continue; }
    if (!SERVICES.includes(service)) { fail("UNKNOWN_SERVICE"); continue; }
    if (matches.length !== 1) { fail(matches.length ? "AMBIGUOUS_GUID" : "GUID_NOT_FOUND"); continue; }
    if (!isEpisodeUrl(service,url)) { fail("EPISODE_URL_NOT_VERIFIED"); continue; }
    // URL syntax does not prove this URL belongs to this GUID.
    if (candidate.identityVerified !== true) { fail("IDENTITY_NOT_INDEPENDENTLY_VERIFIED"); continue; }
    const row = matches[0], current = norm(row.urls?.[service]);
    if (current && current !== url) { fail("EXISTING_URL_CONFLICT"); continue; }
    if (current === url) continue;
    const slot = norm(row.epId) + "\u001f" + service;
    if (seen.has(slot) && seen.get(slot) !== url) { fail("MULTIPLE_CANDIDATES"); seen.set(slot, null); continue; }
    if (seen.has(slot) && seen.get(slot) === null) { fail("MULTIPLE_CANDIDATES"); continue; }
    if (seen.has(slot)) continue;
    seen.set(slot,url);
    proposals.push({epId:row.epId,show:row.show,guid:row.guid,service,url});
  }
  // A conflict invalidates every proposal for that EP-ID/service slot.
  const accepted = proposals.filter(p => seen.get(norm(p.epId) + "\u001f" + p.service) !== null);
  for (const p of proposals) if (!accepted.includes(p)) holds.push({candidate:p,reason:"MULTIPLE_CANDIDATES"});
  return {proposals:accepted,holds};
}

// ===== 2026-11-15 実GAS調査に基づく入口（Claude）。P19 が書く候補シート P15_PLATFORM_CANDIDATES には GUID が無い
// （列: SHOW / SERVICE / LABEL / URL / DISCOVERY_URL）。そこで V2 の行に「番組＋題名の完全一致・1件だけ」で結び、
// GUID を V2 側から付ける。題名一致は本人確認ではないので identityVerified は false のまま（P15_PLATFORMS.resolve の VERIFIED だけが true にできる）。
export const SERVICE_ALIASES = Object.freeze({ "Apple Podcasts": "Apple", "Amazon Music": "Amazon", Spotify: "Spotify", Apple: "Apple", Amazon: "Amazon", "Pocket Casts": "Pocket Casts", LISTEN: "LISTEN", Pody: "Pody" });
const nz = (v) => String(v ?? "").normalize("NFKC").replace(/\s+/g, "");
// V2・統合台帳を見出し名で読む（列番号を固定しない）
export function v2RowsFromSheet(values) {
  const [h = [], ...rows] = values || [], at = (n) => h.indexOf(n);
  const need = ["EP-ID", "番組", "タイトル", "公式GUID", ...SERVICES];
  const missing = need.filter((n) => at(n) < 0); if (missing.length) throw new Error("V2_HEADER_MISSING:" + missing.join(","));
  return rows.filter((r) => norm(r[at("EP-ID")])).map((r) => ({ epId: norm(r[at("EP-ID")]), show: norm(r[at("番組")]), title: norm(r[at("タイトル")]), guid: norm(r[at("公式GUID")]), urls: Object.fromEntries(SERVICES.map((s) => [s, norm(r[at(s)])])) }));
}
// P15_PLATFORM_CANDIDATES → 計画用の候補（GUID は V2 の一致行から）。一致しないもの・複数一致は理由つきで返す
export function candidatesFromP15Sheet(values, v2Rows) {
  const [h = [], ...rows] = values || [], at = (n) => h.indexOf(n);
  for (const n of ["SHOW", "SERVICE", "LABEL", "URL"]) if (at(n) < 0) throw new Error("CANDIDATE_HEADER_MISSING:" + n);
  const byTitle = new Map(); for (const r of v2Rows) { const k = nz(r.show) + "\u001f" + nz(r.title); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(r); }
  const candidates = [], unmatched = [];
  for (const r of rows) {
    const show = norm(r[at("SHOW")]), service = SERVICE_ALIASES[norm(r[at("SERVICE")])] || norm(r[at("SERVICE")]), label = norm(r[at("LABEL")]), url = norm(r[at("URL")]);
    const ms = byTitle.get(nz(show) + "\u001f" + nz(label)) || [];
    if (ms.length !== 1) { unmatched.push({ show, service, label, url, reason: ms.length ? "TITLE_AMBIGUOUS" : "TITLE_NOT_IN_V2" }); continue; }
    candidates.push({ show, guid: ms[0].guid, service, url, sourceLabel: label, matchedBy: "show+title", identityVerified: false });
  }
  return { candidates, unmatched };
}
