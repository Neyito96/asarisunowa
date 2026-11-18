// Legacy scheduled handlers retain write-by-default and summary contracts.
const LISTENER_PODCAST_PLATFORM_SYNC_SHEET = "朝リスPodcast";
function podcastLegacySummaryV2_(result) {
  return Object.assign({}, result, { checked: result.scanned,
    updatedRows: result.results.filter(r => r.writes > 0).length,
    updatedCells: result.results.reduce((n, r) => n + r.writes, 0) });
}
function syncListenerPodcastPlatforms(argument) {
  return podcastLegacySummaryV2_(syncPodcastMissingPlatformsV2(argument === true, "listenerPodcast"));
}
function syncRecommendedPodcastPlatforms(argument) {
  return podcastLegacySummaryV2_(syncPodcastMissingPlatformsV2(argument === true, "podcast"));
}
function syncAllPodcastPlatforms(argument) {
  const result = syncPodcastMissingPlatformsV2(argument === true);
  const subset = kind => podcastLegacySummaryV2_(Object.assign({}, result, {
    scanned: result.countsByKind ? result.countsByKind[kind] : 0,
    results: result.results.filter(r => r.kind === kind) }));
  return Object.assign({}, result, {listenerPodcasts: subset("listenerPodcast"), recommendedPodcasts: subset("podcast")});
}
// One recurring worker, never a Pody-specific or per-submission trigger.
function runPodcastPlatformCompletionV2(event) {
  return syncPodcastMissingPlatformsV2(false);
}
function previewPodcastPlatformCompletionV2() { return syncPodcastMissingPlatformsV2(true); }

function listenerPodcastPlatformRowComplete_(existing) {
  return !!(
    existing.spotify &&
    existing.apple &&
    existing.listen &&
    existing.standfm &&
    existing.amazon &&
    existing.youtube &&
    existing.website &&
    existing.artwork &&
    existing.rss &&
    existing.pocketcasts &&
    existing.genre
  );
}

function queuePodcastCellUpdate_(updates, row, column, currentValue, candidateValue) {
  const current = String(currentValue || "").trim();
  const candidate = String(candidateValue || "").trim();

  if (!current && candidate) {
    updates.push({ row: row, column: column, value: candidate });
  }
}

function resolveListenerPodcastPlatforms_(title, maker, sourceUrl, explicitRss, explicitAppleUrl) {
  const resolved = {
    spotify: "",
    apple: "",
    pocketcasts: "",
    listen: "",
    standfm: "",
    amazon: "",
    youtube: "",
    pody: "",
    website: "",
    artwork: "",
    rss: "",
    genre: ""
  };

  applyKnownPodcastUrl_(resolved, sourceUrl);

  const knownAppleUrl = String(explicitAppleUrl || "").trim();
  if (/^https?:\/\//i.test(knownAppleUrl)) {
    resolved.apple = knownAppleUrl;
  }

  const manualRss = String(explicitRss || "").trim();
  if (/^https?:\/\//i.test(manualRss)) {
    resolved.rss = manualRss;
  }

  const listenSlug = String(sourceUrl || "").match(/^https?:\/\/listen\.style\/p\/([^/?#]+)/i);
  if (!resolved.rss && listenSlug && listenSlug[1]) {
    resolved.rss = "https://rss.listen.style/p/" + listenSlug[1] + "/rss";
  }

  // RSSに番組カテゴリがある場合は、それをジャンルの第一候補にする。
  if (resolved.rss) {
    const rssMeta = readPodcastFeedMetadata_(resolved.rss);
    if (rssMeta) {
      if (!resolved.artwork) resolved.artwork = rssMeta.artwork || "";
      if (rssMeta.genre && rssMeta.genre !== "その他") {
        resolved.genre = rssMeta.genre;
      }
    }
  }

  if (!resolved.spotify && typeof findSpotifyShowByTitle_ === "function") {
    const spotifyUrl = findSpotifyShowByTitle_(title, maker);
    if (spotifyUrl) resolved.spotify = spotifyUrl;
  }

  let apple = null;

  if (resolved.apple) {
    apple = lookupApplePodcastByUrl_(resolved.apple);
  }

  if (!apple) {
    apple = findExactApplePodcast_(title, maker);
  }
  if (!apple) {
    if (resolved.rss) {
      const rssLinks = readPodcastFeedLinks_(resolved.rss);
      rssLinks.forEach(function(url) {
        applyKnownPodcastUrl_(resolved, url);
      });
      if (isSafePublicPodcastRss_(resolved.rss)) {
        resolved.pocketcasts = pocketCastsFollowUrl_(resolved.rss);
      }
      const rssMeta = readPodcastFeedMetadata_(resolved.rss);
      if (rssMeta) {
        if (!resolved.artwork) resolved.artwork = rssMeta.artwork || "";
        if (!resolved.genre) resolved.genre = rssMeta.genre || "";
      }
    }
    return resolved;
  }

  resolved.apple = String(apple.collectionViewUrl || apple.trackViewUrl || "").trim();
  resolved.artwork = String(apple.artworkUrl600 || apple.artworkUrl100 || "").trim();
  // RSSで具体ジャンルが取れなかった場合だけAppleで補完する。
  if (!resolved.genre || resolved.genre === "その他") {
    resolved.genre = normalizePodcastGenre_(
      Array.isArray(apple.genres) ? apple.genres : [],
      apple.primaryGenreName || ""
    );
  }

  const feedUrl = String(apple.feedUrl || resolved.rss || "").trim();
  if (feedUrl) {
    resolved.rss = feedUrl;
    const rssLinks = readPodcastFeedLinks_(feedUrl);
    rssLinks.forEach(function(url) {
      applyKnownPodcastUrl_(resolved, url);
    });
    if (isSafePublicPodcastRss_(feedUrl)) {
      resolved.pocketcasts = pocketCastsFollowUrl_(feedUrl);
    }
  }

  return resolved;
}


function extractApplePodcastId_(value) {
  const url = String(value || "").trim();
  if (!url) return "";

  const match = url.match(/\/id(\d+)/i);
  return match ? match[1] : "";
}

function lookupApplePodcastByUrl_(appleUrl) {
  const id = extractApplePodcastId_(appleUrl);
  if (!id) return null;

  try {
    const data = fetchJson(
      "https://itunes.apple.com/lookup?id=" +
        encodeURIComponent(id) +
        "&entity=podcast&country=JP"
    );

    const results =
      data && Array.isArray(data.results)
        ? data.results
        : [];

    for (let i = 0; i < results.length; i++) {
      const item = results[i];

      if (
        String(item.wrapperType || "").toLowerCase() === "track" ||
        String(item.kind || "").toLowerCase() === "podcast"
      ) {
        return item;
      }

      if (
        item.collectionId ||
        item.trackId ||
        item.feedUrl ||
        item.collectionViewUrl
      ) {
        return item;
      }
    }
  } catch (_) {
    return null;
  }

  return null;
}

function findExactApplePodcast_(title, maker) {
  const terms =
    typeof podcastSearchTitleCandidates_ === "function"
      ? podcastSearchTitleCandidates_(title)
      : [String(title || "").trim()].filter(Boolean);

  if (!terms.length) return null;

  const cleanMaker = String(maker || "").trim();
  const baseTerms = terms.slice();

  if (cleanMaker) {
    baseTerms.forEach(function(term) {
      const combined = cleanMaker + " " + term;
      if (!terms.some(function(existing) {
        return normalizeTitle(existing) === normalizeTitle(combined);
      })) {
        terms.push(combined);
      }
    });
  }

  const wantedTitles = terms.map(function(term) {
    return normalizeTitle(term);
  });

  const wantedMaker = normalizeTitle(maker || "");

  for (let t = 0; t < terms.length; t++) {
    const term = terms[t];

    try {
      const data = fetchJson(
        "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=12&country=JP&term=" +
          encodeURIComponent(term)
      );

      const results =
        data && Array.isArray(data.results) ? data.results : [];

      for (let i = 0; i < results.length; i++) {
        const item = results[i];

        const itemTitle = normalizeTitle(
          item.collectionName || item.trackName || ""
        );

        if (!itemTitle || wantedTitles.indexOf(itemTitle) < 0) continue;

        if (wantedMaker) {
          const itemMaker = normalizeTitle(
            item.artistName || item.collectionArtistName || ""
          );

          if (
            itemMaker &&
            itemMaker !== wantedMaker &&
            itemMaker.indexOf(wantedMaker) < 0 &&
            wantedMaker.indexOf(itemMaker) < 0
          ) {
            continue;
          }
        }

        return item;
      }
    } catch (_) {
      // 次の検索候補を試す
    }
  }

  return null;
}

function readPodcastFeedLinks_(feedUrl) {
  const out = [];

  try {
    const response = fetchPodcastPlatformResource_(feedUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      return out;
    }

    const xml = response.getContentText();
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    const channel = root.getChild("channel");

    if (!channel) return out;

    const link = String(channel.getChildText("link") || "").trim();
    if (/^https?:\/\//i.test(link)) out.push(link);

    const atom = XmlService.getNamespace("atom", "http://www.w3.org/2005/Atom");
    const atomLinks = channel.getChildren("link", atom);
    atomLinks.forEach(function(element) {
      const href = String(element.getAttribute("href") ? element.getAttribute("href").getValue() : "").trim();
      if (/^https?:\/\//i.test(href)) out.push(href);
    });
  } catch (_) {
    return out;
  }

  return out;
}

function applyKnownPodcastUrl_(resolved, value) {
  const url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return;

  if (/open\.spotify\.com\/show\//i.test(url)) {
    resolved.spotify = resolved.spotify || canonicalPodcastUrl_(url);
    return;
  }

  if (/podcasts\.apple\.com\//i.test(url)) {
    resolved.apple = resolved.apple || canonicalPodcastUrl_(url);
    return;
  }

  if (/listen\.style\//i.test(url)) {
    resolved.listen = resolved.listen || canonicalPodcastUrl_(url);
    return;
  }

  if (/stand\.fm\//i.test(url)) {
    resolved.standfm = resolved.standfm || canonicalPodcastUrl_(url);
    return;
  }

  if (/music\.amazon\.|amazon\.[^/]+\/podcasts/i.test(url)) {
    resolved.amazon = resolved.amazon || canonicalPodcastUrl_(url);
    return;
  }

  if (/youtube\.com\/|youtu\.be\//i.test(url)) {
    resolved.youtube = resolved.youtube || canonicalPodcastUrl_(url);
    return;
  }

  if (/pocketcasts\.com\//i.test(url)) {
    resolved.pocketcasts = resolved.pocketcasts || canonicalPodcastUrl_(url);
    return;
  }

  if (/pody\.jp\//i.test(url)) {
    resolved.pody = resolved.pody || canonicalPodcastUrl_(url);
    return;
  }

  if (!/itunes\.apple\.com|spotify\.com|googleusercontent\.com|google\.com/i.test(url)) {
    resolved.website = resolved.website || canonicalPodcastUrl_(url);
  }
}

function canonicalPodcastUrl_(value) {
  const url = String(value || "").trim();
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch (_) {
    return url;
  }
}


function pocketCastsFollowUrl_(feedUrl) {
  const rss = String(feedUrl || "").trim();
  return rss ? "https://pocketcasts.com/follow/" + encodeURIComponent(rss) : "";
}

function isSafePublicPodcastRss_(feedUrl) {
  const value = String(feedUrl || "").trim();
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return false;
    const sensitive = ["token", "auth", "key", "signature", "sig", "access_token"];
    for (let i = 0; i < sensitive.length; i++) {
      if (parsed.searchParams.has(sensitive[i])) return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function readPodcastFeedMetadata_(feedUrl) {
  try {
    const response = fetchPodcastPlatformResource_(String(feedUrl || ""), {
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return null;

    const document = XmlService.parse(response.getContentText());
    const root = document.getRootElement();
    const channel = root.getChild("channel");
    if (!channel) return null;

    const itunes = XmlService.getNamespace("itunes", "http://www.itunes.com/dtds/podcast-1.0.dtd");
    const author = channel.getChildText("author", itunes) || "";
    const imageNode = channel.getChild("image", itunes);
    const imageAttr = imageNode && imageNode.getAttribute("href");
    const artwork = imageAttr ? imageAttr.getValue() : "";
    const categories = channel.getChildren("category", itunes).map(function(node) {
      const attr = node.getAttribute("text");
      return attr ? attr.getValue() : "";
    }).filter(Boolean);

    return {
      title: String(channel.getChildText("title") || "").trim(),
      maker: String(author || "").trim(),
      artwork: String(artwork || "").trim(),
      genre: normalizePodcastGenre_(categories, categories[0] || "")
    };
  } catch (_) {
    return null;
  }
}

function diagnoseListenerPodcastGenreResolution() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, LISTENER_PODCAST_PLATFORM_SYNC_SHEET);
  if (!sheet) throw new Error("朝リスPodcastシートが見つかりません");

  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, 17).getDisplayValues();

  values.forEach(function(row, index) {
    const rowNumber = index + 2;
    const title = String(row[1] || "").trim();
    const maker = String(row[2] || "").trim();
    const appleUrl = String(row[6] || "").trim();
    const rss = String(row[13] || "").trim();
    const currentGenre = String(row[16] || "").trim();

    if (!title) return;

    const appleId = extractApplePodcastId_(appleUrl);
    const appleItem = appleUrl ? lookupApplePodcastByUrl_(appleUrl) : null;

    let appleGenre = "";
    if (appleItem) {
      appleGenre = normalizePodcastGenre_(
        Array.isArray(appleItem.genres) ? appleItem.genres : [],
        appleItem.primaryGenreName || ""
      );
    }

    const rssMeta = rss ? readPodcastFeedMetadata_(rss) : null;

    const resolved = resolveListenerPodcastPlatforms_(
      title,
      maker,
      String(row[0] || "").trim(),
      rss,
      appleUrl
    );

    console.log(JSON.stringify({
      row: rowNumber,
      title: title,
      currentGenre: currentGenre,
      appleUrl: appleUrl,
      appleId: appleId,
      appleLookupOk: !!appleItem,
      primaryGenreName: appleItem ? appleItem.primaryGenreName || "" : "",
      appleGenre: appleGenre,
      rss: rss,
      rssGenre: rssMeta ? rssMeta.genre || "" : "",
      resolvedGenre: resolved ? resolved.genre || "" : ""
    }, null, 2));
  });
}
