// Universe V0.4 link adapter: EP-ID is the sole join key.
// Public library details are read-only. Missing URLs are never guessed.
const DEFAULT_BASE = "https://neyito96.github.io/asarisunowa/library/";
const EP_RE = /^EP-\d{5}$/;
export function libraryEpisodeUrl(id, base = DEFAULT_BASE) {
  if (!EP_RE.test(id)) return null;
  const url = new URL(base);
  url.searchParams.set("ep", id);
  return url.href;
}
export function classifyPlatform(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const h = url.hostname.toLowerCase();
  const is = domain => h === domain || h.endsWith("." + domain);
  if (is("spotify.com")) return "Spotify";
  if (is("pocketcasts.com")) return "Pocket Casts";
  if (is("asahi.com")) return "朝日新聞";
  if (is("apple.com")) return "Apple Podcasts";
  if (is("youtube.com") || is("youtu.be")) return "YouTube";
  if (is("omny.fm")) return "Omny";
  return "その他";
}
export function platformLinks(detail) {
  const links = Array.isArray(detail?.links) ? detail.links : [];
  const seen = new Set();
  return links.flatMap(raw => {
    const platform = classifyPlatform(raw);
    if (!platform || seen.has(raw)) return [];
    seen.add(raw);
    return [{platform, url:raw}];
  });
}
export async function fetchEpisodeLinks(id, {base="https://neyito96.github.io/asarisunowa/library/data/", fetcher=fetch}={}) {
  if (!EP_RE.test(id)) throw new Error("Invalid EP-ID");
  const manifestResponse = await fetcher(new URL("manifest.json",base),{cache:"no-store"});
  if (!manifestResponse.ok) throw new Error("Manifest unavailable");
  const manifest = await manifestResponse.json();
  const size = manifest.detailBucketSize;
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Invalid detail bucket size");
  const bucket = Math.floor(Number(id.slice(3))/size);
  const response = await fetcher(new URL(`details/${bucket}.json`,base),{cache:"no-store"});
  if (!response.ok) throw new Error("Detail unavailable");
  const rows = await response.json();
  const detail = rows.find(row=>row.id===id);
  if (!detail) return {id,links:[],found:false};
  return {id,links:platformLinks(detail),found:true};
}
