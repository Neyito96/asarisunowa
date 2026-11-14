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
