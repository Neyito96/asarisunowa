// 朝リスPodcastの配信先URLを補完する定期同期
// 既存値は上書きせず、確度の高い候補だけ空欄へ追記する。

const LISTENER_PODCAST_PLATFORM_SYNC_SHEET = "朝リスPodcast";

function syncListenerPodcastPlatforms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("Podcast配信先同期を開始できませんでした。少し待って再実行してください。");
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetLoose(ss, LISTENER_PODCAST_PLATFORM_SYNC_SHEET);

    if (!sheet) {
      throw new Error("朝リスPodcastシートが見つかりません");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { checked: 0, updatedRows: 0, updatedCells: 0 };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 13).getDisplayValues();
    let updatedRows = 0;
    let updatedCells = 0;

    for (let i = 0; i < values.length; i++) {
      const rowNumber = i + 2;
      const row = values[i];
      const title = String(row[1] || "").trim();
      const maker = String(row[2] || "").trim();

      if (!title) continue;

      const existing = {
        sourceUrl: String(row[0] || "").trim(),
        spotify: String(row[5] || "").trim(),
        apple: String(row[6] || "").trim(),
        listen: String(row[7] || "").trim(),
        standfm: String(row[8] || "").trim(),
        amazon: String(row[9] || "").trim(),
        youtube: String(row[10] || "").trim(),
        website: String(row[11] || "").trim(),
        artwork: String(row[12] || "").trim()
      };

      if (listenerPodcastPlatformRowComplete_(existing)) continue;

      const resolved = resolveListenerPodcastPlatforms_(title, maker, existing.sourceUrl);
      if (!resolved) continue;

      const updates = [];

      queuePodcastCellUpdate_(updates, rowNumber, 6, existing.spotify, resolved.spotify);
      queuePodcastCellUpdate_(updates, rowNumber, 7, existing.apple, resolved.apple);
      queuePodcastCellUpdate_(updates, rowNumber, 8, existing.listen, resolved.listen);
      queuePodcastCellUpdate_(updates, rowNumber, 9, existing.standfm, resolved.standfm);
      queuePodcastCellUpdate_(updates, rowNumber, 10, existing.amazon, resolved.amazon);
      queuePodcastCellUpdate_(updates, rowNumber, 11, existing.youtube, resolved.youtube);
      queuePodcastCellUpdate_(updates, rowNumber, 12, existing.website, resolved.website);
      queuePodcastCellUpdate_(updates, rowNumber, 13, existing.artwork, resolved.artwork);

      if (!updates.length) continue;

      updates.forEach(function(update) {
        sheet.getRange(update.row, update.column).setValue(update.value);
      });

      updatedRows++;
      updatedCells += updates.length;
    }

    console.log(
      "朝リスPodcast配信先同期: checked=" + values.length +
      " updatedRows=" + updatedRows +
      " updatedCells=" + updatedCells
    );

    return {
      checked: values.length,
      updatedRows: updatedRows,
      updatedCells: updatedCells
    };
  } finally {
    lock.releaseLock();
  }
}

function listenerPodcastPlatformRowComplete_(existing) {
  return !!(
    existing.spotify &&
    existing.apple &&
    existing.listen &&
    existing.standfm &&
    existing.amazon &&
    existing.youtube &&
    existing.website &&
    existing.artwork
  );
}

function queuePodcastCellUpdate_(updates, row, column, currentValue, candidateValue) {
  const current = String(currentValue || "").trim();
  const candidate = String(candidateValue || "").trim();

  if (!current && /^https?:\/\//i.test(candidate)) {
    updates.push({ row: row, column: column, value: candidate });
  }
}

function resolveListenerPodcastPlatforms_(title, maker, sourceUrl) {
  const resolved = {
    spotify: "",
    apple: "",
    listen: "",
    standfm: "",
    amazon: "",
    youtube: "",
    website: "",
    artwork: ""
  };

  applyKnownPodcastUrl_(resolved, sourceUrl);

  const apple = findExactApplePodcast_(title, maker);
  if (!apple) {
    return resolved;
  }

  resolved.apple = String(apple.collectionViewUrl || apple.trackViewUrl || "").trim();
  resolved.artwork = String(apple.artworkUrl600 || apple.artworkUrl100 || "").trim();

  const feedUrl = String(apple.feedUrl || "").trim();
  if (feedUrl) {
    applyKnownPodcastUrl_(resolved, feedUrl);
    const rssLinks = readPodcastFeedLinks_(feedUrl);
    rssLinks.forEach(function(url) {
      applyKnownPodcastUrl_(resolved, url);
    });
  }

  return resolved;
}

function findExactApplePodcast_(title, maker) {
  const term = String(title || "").trim();
  if (!term) return null;

  try {
    const data = fetchJson(
      "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=12&country=JP&term=" +
      encodeURIComponent(term)
    );

    const results = data && Array.isArray(data.results) ? data.results : [];
    const wantedTitle = normalizeTitle(term);
    const wantedMaker = normalizeTitle(maker || "");

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      const itemTitle = normalizeTitle(item.collectionName || item.trackName || "");
      if (!itemTitle || itemTitle !== wantedTitle) continue;

      if (wantedMaker) {
        const itemMaker = normalizeTitle(item.artistName || item.collectionArtistName || "");
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
    return null;
  }

  return null;
}

function readPodcastFeedLinks_(feedUrl) {
  const out = [];

  try {
    const response = UrlFetchApp.fetch(feedUrl, {
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
