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

    if (typeof ensurePodcastMetadataHeaders_ === "function") {
      ensurePodcastMetadataHeaders_(sheet, "listenerPodcast");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { checked: 0, updatedRows: 0, updatedCells: 0 };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 17).getDisplayValues();
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
        artwork: String(row[12] || "").trim(),
        rss: String(row[13] || "").trim(),
        pocketcasts: String(row[14] || "").trim(),
        pody: String(row[15] || "").trim(),
        genre: String(row[16] || "").trim()
      };

      if (listenerPodcastPlatformRowComplete_(existing)) continue;

      const resolved = resolveListenerPodcastPlatforms_(title, maker, existing.sourceUrl, existing.rss);
      if (!resolved) continue;

      const updates = [];

      podcastRepairUpdates_(existing, resolved).forEach(function(repair) {
        updates.push({ row: rowNumber, column: repair.column, value: repair.value });
        console.log("朝リスPodcast修復: 行" + rowNumber + " " + repair.field + " " + repair.from + " → " + repair.value);
      });
      queuePodcastCellUpdate_(updates, rowNumber, 6, existing.spotify, resolved.spotify);
      queuePodcastCellUpdate_(updates, rowNumber, 7, existing.apple, resolved.apple);
      queuePodcastCellUpdate_(updates, rowNumber, 8, existing.listen, resolved.listen);
      queuePodcastCellUpdate_(updates, rowNumber, 9, existing.standfm, resolved.standfm);
      queuePodcastCellUpdate_(updates, rowNumber, 10, existing.amazon, resolved.amazon);
      queuePodcastCellUpdate_(updates, rowNumber, 11, existing.youtube, resolved.youtube);
      queuePodcastCellUpdate_(updates, rowNumber, 12, existing.website, resolved.website);
      queuePodcastCellUpdate_(updates, rowNumber, 13, existing.artwork, resolved.artwork);
      queuePodcastCellUpdate_(updates, rowNumber, 14, existing.rss, resolved.rss);
      queuePodcastCellUpdate_(updates, rowNumber, 15, existing.pocketcasts, resolved.pocketcasts);
      queuePodcastCellUpdate_(updates, rowNumber, 16, existing.pody, resolved.pody);
      queuePodcastCellUpdate_(updates, rowNumber, 17, existing.genre, resolved.genre);

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

function syncRecommendedPodcastPlatforms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("おすすめPodcast配信先同期を開始できませんでした。少し待って再実行してください。");
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
    if (!sheet) throw new Error("おすすめPodcastシートが見つかりません");

    if (typeof ensurePodcastMetadataHeaders_ === "function") {
      ensurePodcastMetadataHeaders_(sheet, "podcast");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { checked: 0, updatedRows: 0, updatedCells: 0 };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 18).getDisplayValues();
    let updatedRows = 0;
    let updatedCells = 0;
    const spotifyUnresolved = [];

    for (let i = 0; i < values.length; i++) {
      const rowNumber = i + 2;
      const row = values[i];
      const sourceUrl = String(row[0] || "").trim();
      const title = String(row[1] || "").trim();
      if (!title) continue;

      let host = String(row[6] || "").trim();
      let rss = String(row[7] || "").trim();
      let artwork = String(row[5] || "").trim();
      let genre = String(row[17] || "").trim();

      let identity = null;
      try {
        identity = resolvePodcastUrl(sourceUrl);
      } catch (_) {
        identity = null;
      }

      if (identity && identity.ok) {
        if (!host) host = String(identity.maker || "").trim();
        if (!rss) rss = String(identity.rss || "").trim();
        if (!artwork) artwork = String(identity.artwork || "").trim();
        if (!genre) genre = String(identity.genre || "").trim();
      }

      const resolved = resolveListenerPodcastPlatforms_(title, host, sourceUrl, rss);
      const updates = [];
      if (!String(row[9] || "").trim() && !resolved.spotify && resolved.spotifyStatus) {
        spotifyUnresolved.push({ row: rowNumber, title: title, status: resolved.spotifyStatus });
      }

      queuePodcastCellUpdate_(updates, rowNumber, 6, row[5], artwork || resolved.artwork);
      queuePodcastCellUpdate_(updates, rowNumber, 7, row[6], host);
      queuePodcastCellUpdate_(updates, rowNumber, 8, row[7], rss || resolved.rss);
      queuePodcastCellUpdate_(updates, rowNumber, 9, row[8], resolved.youtube);
      queuePodcastCellUpdate_(updates, rowNumber, 10, row[9], resolved.spotify);
      queuePodcastCellUpdate_(updates, rowNumber, 11, row[10], resolved.amazon);
      queuePodcastCellUpdate_(updates, rowNumber, 12, row[11], resolved.apple);
      queuePodcastCellUpdate_(updates, rowNumber, 13, row[12], resolved.pocketcasts);
      queuePodcastCellUpdate_(updates, rowNumber, 14, row[13], resolved.listen);
      queuePodcastCellUpdate_(updates, rowNumber, 15, row[14], resolved.standfm);
      queuePodcastCellUpdate_(updates, rowNumber, 16, row[15], resolved.pody);
      queuePodcastCellUpdate_(updates, rowNumber, 17, row[16], resolved.website);
      queuePodcastGenreUpdate_(updates, rowNumber, 18, row[17], genre || resolved.genre);

      if (!updates.length) continue;
      updates.forEach(function(update) {
        sheet.getRange(update.row, update.column).setValue(update.value);
      });
      updatedRows++;
      updatedCells += updates.length;
    }

    console.log(
      "おすすめPodcast配信先同期: checked=" + values.length +
      " updatedRows=" + updatedRows +
      " updatedCells=" + updatedCells +
      " spotifyUnresolved=" + spotifyUnresolved.length
    );

    return {
      checked: values.length,
      updatedRows: updatedRows,
      updatedCells: updatedCells,
      spotifyUnresolved: spotifyUnresolved
    };
  } finally {
    lock.releaseLock();
  }
}

function syncAllPodcastPlatforms() {
  return {
    listenerPodcasts: syncListenerPodcastPlatforms(),
    recommendedPodcasts: syncRecommendedPodcastPlatforms()
  };
}

// 既にある値の修復（空欄の補完とは別）。直すのは次の2つだけで、どちらも確かめた値でしか置き換えない:
//  ① LISTEN 欄にフィードURL（rss.listen.style など）が入っていて、RSS の <link> から LISTEN の番組ページが取れた時
//  ② Spotify 欄が短縮URLで、たどった先が open.spotify.com/show/ だった時
function podcastRepairUpdates_(existing, resolved, shortResolver) {
  const out = [];
  if (existing.listen && isPodcastFeedUrl_(existing.listen) && /^https:\/\/listen\.style\/p\/[^/?#]+\/?$/i.test(String(resolved.listen || ""))) {
    out.push({ field: "LISTEN", column: 8, from: existing.listen, value: resolved.listen });
    existing.listen = resolved.listen;
    if (!existing.rss) existing.rss = "";
  }
  if (existing.spotify && PODCAST_SHORT_URL_HOSTS_.test(existing.spotify)) {
    const target = (shortResolver || resolvePodcastShortUrl_)(existing.spotify);
    if (/^https:\/\/open\.spotify\.com\/show\/[A-Za-z0-9]{22}/.test(target)) {
      const value = canonicalPodcastUrl_(target);
      out.push({ field: "Spotify", column: 6, from: existing.spotify, value: value });
      existing.spotify = value;
    }
  }
  return out;
}

// 定期巡回（1日1回）。旧コードには巡回を設置する処理が無く、投稿時に見つからなかった Spotify などは、誰かが手で同期を実行しない限り補完されなかった。
// 設置は管理人の承認（スクリプトプロパティ APPROVE_PODCAST_PLATFORM_DAILY=yes）の後だけ。同じ関数のトリガーが既にあれば作らない。
const PODCAST_PLATFORM_DAILY_HANDLER_ = "syncAllPodcastPlatforms";
function installPodcastPlatformDailyTrigger() {
  if (PropertiesService.getScriptProperties().getProperty("APPROVE_PODCAST_PLATFORM_DAILY") !== "yes") {
    return { status: "NOT_APPROVED", note: "スクリプトプロパティ APPROVE_PODCAST_PLATFORM_DAILY=yes を管理人が設定してから実行" };
  }
  const existing = ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === PODCAST_PLATFORM_DAILY_HANDLER_; });
  if (existing.length) return { status: "ALREADY_INSTALLED", count: existing.length };
  ScriptApp.newTrigger(PODCAST_PLATFORM_DAILY_HANDLER_).timeBased().everyDays(1).atHour(5).nearMinute(10).create();
  return { status: "INSTALLED", handler: PODCAST_PLATFORM_DAILY_HANDLER_, at: "毎日5時台" };
}
function podcastPlatformTriggerStatus() {
  const all = ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction() + ":" + String(t.getEventType()); });
  const mine = all.filter(function(x) { return x.indexOf(PODCAST_PLATFORM_DAILY_HANDLER_ + ":") === 0; });
  console.log(JSON.stringify({ podcastDaily: mine, allTriggers: all }));
  return { podcastDaily: mine, allTriggers: all };
}
function removePodcastPlatformDailyTrigger() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction() === PODCAST_PLATFORM_DAILY_HANDLER_) { ScriptApp.deleteTrigger(t); n++; } });
  return { status: "OK", deleted: n };
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

function queuePodcastGenreUpdate_(updates, row, column, currentValue, candidateValue) {
  const current = String(currentValue || "").trim();
  const candidate = String(candidateValue || "").trim();

  // 通常は既存値を守る。ただし旧ロジックで「その他」に落ちた行は、
  // Apple/RSSから具体的なジャンルが取れた場合だけ修正する。
  if (
    (!current && candidate) ||
    (current === "その他" && candidate && candidate !== "その他")
  ) {
    updates.push({ row: row, column: column, value: candidate });
  }
}

// Official links (source URL, RSS) are applied first; the Spotify search only runs when none gave a Spotify show link,
// and only an unambiguous exact match is accepted (PodcastSpotifyResolve.js). Failures are classified in resolved.spotifyStatus.
function resolveListenerPodcastPlatforms_(title, maker, sourceUrl, explicitRss) {
  const resolved = resolveListenerPodcastPlatformsBase_(title, maker, sourceUrl, explicitRss);
  return podSpCompleteResolved_(resolved, title, maker);
}

function resolveListenerPodcastPlatformsBase_(title, maker, sourceUrl, explicitRss) {
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

  const manualRss = String(explicitRss || "").trim();
  if (/^https?:\/\//i.test(manualRss)) {
    resolved.rss = manualRss;
  }

  const listenSlug = String(sourceUrl || "").match(/^https?:\/\/listen\.style\/p\/([^/?#]+)/i);
  if (!resolved.rss && listenSlug && listenSlug[1]) {
    resolved.rss = "https://rss.listen.style/p/" + listenSlug[1] + "/rss";
  }

  const apple = findExactApplePodcast_(title, maker);
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
  resolved.genre = normalizePodcastGenre_(
    Array.isArray(apple.genres) ? apple.genres : [],
    apple.primaryGenreName || ""
  );

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

// Issue #274（2026-11-14）: RSS で投稿された番組（例: ポッドキャスト茶会 https://rss.listen.style/p/podthakai/rss）は、
// 旧コードが /listen\.style\// に当たるため RSS を「LISTEN」欄に入れていた。その結果、正しい LISTEN 番組ページ（RSS の <link>）が後から来ても
// 「既に値あり」で入らなかった。フィードURLは RSS としてだけ扱い、LISTEN・Spotify・番組HP には入れない。
function isPodcastFeedUrl_(value) {
  const url = String(value || "").trim();
  return /^https?:\/\/rss\.listen\.style\//i.test(url) ||
    /^https?:\/\/(?:feeds?\.|rss\.)/i.test(url) ||
    /^https?:\/\/anchor\.fm\/s\/[^/]+\/podcast\/rss/i.test(url) ||
    /^https?:\/\/stand\.fm\/rss\//i.test(url) ||
    /\/podcast\.rss(?:[?#]|$)|\.(?:rss|rdf|xml)(?:[?#]|$)|\/feed(?:\/|$)|\/rss\/?(?:[?#]|$)/i.test(url);
}
// 短縮URL（x.gd・bit.ly など）は、転送先を3回まで実際にたどって確かめてから分類する。たどれなければ使わない（推測しない）
const PODCAST_SHORT_URL_HOSTS_ = /^https?:\/\/(?:x\.gd|bit\.ly|t\.co|buff\.ly|lnkd\.in|amzn\.to|spoti\.fi|tinyurl\.com|is\.gd|ow\.ly)\//i;
function resolvePodcastShortUrl_(value, fetcher) {
  let url = String(value || "").trim();
  if (!PODCAST_SHORT_URL_HOSTS_.test(url)) return url;
  const fetch = fetcher || function(u) { return UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: false }); };
  for (let hop = 0; hop < 3 && PODCAST_SHORT_URL_HOSTS_.test(url); hop++) {
    try {
      const response = fetch(url), code = response.getResponseCode();
      if (code < 300 || code >= 400) return "";
      const headers = response.getHeaders() || {}, location = String(headers.Location || headers.location || "").trim();
      if (!/^https?:\/\//i.test(location)) return "";
      url = location;
    } catch (_) {
      return "";
    }
  }
  return PODCAST_SHORT_URL_HOSTS_.test(url) ? "" : url;
}

function applyKnownPodcastUrl_(resolved, value) {
  let url = String(value || "").trim();
  if (!/^https?:\/\//i.test(url)) return;
  if (PODCAST_SHORT_URL_HOSTS_.test(url)) url = resolvePodcastShortUrl_(url);
  if (!url) return;
  if (isPodcastFeedUrl_(url)) {
    resolved.rss = resolved.rss || url;
    return;
  }

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
  // GAS（V8）には URL クラスが無く、旧コードは常に例外→元の値（?si= 付き）を返していた。番組URLの ? と # 以降だけを落とす
  return url.replace(/[?#].*$/, "");
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
    const response = UrlFetchApp.fetch(String(feedUrl || ""), {
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
