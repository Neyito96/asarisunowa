/** Phase 22: Public HTML inspection only. No production writes. */
function P22_APPLE_PUBLIC_PAGE_PROBE() {
  const targets = [
    { show: "ニュースの現場から", id: "1526773927" },
    { show: "MEDIA TALK", id: "1527037575" },
    { show: "報談", id: "1822960480" }
  ];
  const results = [];
  targets.forEach(function(t) {
    const url = "https://podcasts.apple.com/jp/podcast/id" + t.id;
    try {
      const res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true, followRedirects: true,
        headers: { Accept: "text/html,application/xhtml+xml" }
      });
      const html = res.getContentText();
      const normalized = html.replace(/&amp;/g, "&")
        .replace(/\\u0026/gi, "&").replace(/\\u003d/gi, "=")
        .replace(/\\\//g, "/");
      const ids = new Set();
      (normalized.match(/https?:\/\/podcasts\.apple\.com\/[^\s"'<>\\]{1,1400}/g) || [])
        .forEach(function(link) {
          const hit = link.match(/[?&]i=(\d{7,18})(?:\D|$)/);
          if (hit && link.indexOf("/id" + t.id) >= 0) ids.add(hit[1]);
        });
      results.push({
        show: t.show, showId: t.id, http: res.getResponseCode(),
        htmlBytes: html.length, foundEpisodeIds: ids.size,
        sampleIds: Array.from(ids).slice(0, 8),
        structuredData: /application\/ld\+json/i.test(html),
        status: ids.size ? "CANDIDATES_ONLY_NOT_GUID_VERIFIED" : "NO_PUBLIC_HTML_IDS"
      });
    } catch (err) {
      results.push({ show:t.show, showId:t.id,
        status:"FETCH_FAILED", error:String(err).slice(0,200) });
    }
  });
  Logger.log(JSON.stringify({ mode:"READ_ONLY", phase:"P22_PUBLIC_HTML_PROBE",
    results:results, writes:0 }));
}
