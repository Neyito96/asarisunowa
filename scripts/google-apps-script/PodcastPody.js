// Pody verification is an adapter in the common V2 pipeline, not a separate scheduler.
function resolvePodyFromVerifiedFeedV2_(title, audio, explicitUrl) {
  if (!audio.length) return { url: "", status: "retryableError" };
  try {
    let candidates = explicitUrl ? [explicitUrl] : [];
    if (!explicitUrl) {
      const search = fetchPodcastPlatformResource_("https://pody.jp/search?q=" + encodeURIComponent(title), { muteHttpExceptions: true, followRedirects: true }).getContentText();
      candidates = Array.from(new Set(Array.from(search.matchAll(/href=["'](?:https:\/\/pody\.jp)?(\/player\/[A-Za-z0-9]+)["']/g), m => "https://pody.jp" + m[1])));
    }
    if (candidates.length > 3) return { url: "", status: "mismatch" };
    const matches = candidates.filter(url => {
      const page = fetchPodcastPlatformResource_(url, { muteHttpExceptions: true, followRedirects: true }).getContentText();
      return isVerifiedPodyPage_(page, title, audio, url);
    });
    return matches.length === 1 ? { url: matches[0], status: "verified" } : { url: "", status: candidates.length ? "mismatch" : "notFound" };
  } catch (_) { return { url: "", status: "retryableError" }; }
}

function extractPodyAudioUrls_(xml) {
  return Array.from(new Set(Array.from(
    String(xml).matchAll(/<enclosure\b[^>]*\burl=["']([^"']+)["']/g),
    m => m[1].replace(/&amp;/g, "&")
  ))).filter(url => /^https:\/\//.test(url)).slice(0, 5);
}

function isVerifiedPodyPage_(html, title, audio, url) {
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (!canonical || canonical[1] !== url) return false;
  const blocks = Array.from(html.matchAll(/self\.__next_f\.push\(\[1,(".*?")\]\)/g));
  const data = blocks.map(m => { try { return JSON.parse(m[1]); } catch (_) { return ""; } }).join("\n");
  const titles = Array.from(data.matchAll(/"feedTitle":("(?:[^"\\]|\\.)*")/g), m => {
    try { return JSON.parse(m[1]); } catch (_) { return ""; }
  });
  if (!titles.includes(title)) return false;
  return audio.some(value => data.includes(JSON.stringify(value).slice(1, -1)));
}
