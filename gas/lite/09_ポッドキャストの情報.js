// 09_ポッドキャストの情報（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: PodcastResolveCommon.js, PodcastIdentity.js, PodcastUrlResolve.js, PodcastApple.js, PodcastPody.js, PodcastResolve.js, PodcastResolveHandler.js, PodcastSubmission.js, PodcastPlatformPipeline.js, PodcastPlatformSync.js

// ---- PodcastResolveCommon.js ----
function normalizePodcastInputUrl(value) {
  let clean =
    String(value || "").trim();

  // URL全体がエンコードされて貼られた場合に備えて、最大2回だけデコード。
  for (let i = 0; i < 2; i++) {
    try {
      const decoded =
        decodeURIComponent(clean);

      if (decoded === clean) {
        break;
      }

      clean = decoded;

    } catch (_) {
      break;
    }
  }

  // テキストの中にURLが含まれていた場合はURL部分だけ抜き出す。
  const m =
    clean.match(/https?:\/\/[^\s]+/i);

  if (m && m[0]) {
    clean = m[0];
  }

  return clean.trim();
}
function looksLikeEpisodeTitle(title) {
  const value =
    String(title || "").trim();

  if (!value) {
    return false;
  }

  return (
    /^(ep(?:isode)?[\s._-]*\d+)/i.test(value) ||
    /^#\s*\d+/.test(value) ||
    /^第\s*\d+\s*(回|話|章)/.test(value) ||
    /\bepisode\b/i.test(value)
  );
}
function firstMeta(html, patterns) {
  for (
    let i = 0;
    i < patterns.length;
    i++
  ) {
    const m =
      html.match(
        patterns[i]
      );

    if (
      m &&
      m[1]
    ) {
      return String(
        m[1]
      ).trim();
    }
  }

  return "";
}
function cleanupTitle(title) {
  return String(
    title || ""
  )
    .replace(
      /\s*[|｜]\s*Podcast on Spotify.*$/i,
      ""
    )
    .replace(
      /\s*[|｜]\s*(Spotify|Apple Podcasts?|LISTEN|stand\.fm|YouTube|Amazon Music).*$/i,
      ""
    )
    .replace(
      /\s+-\s+(Spotify|Apple Podcasts?|LISTEN|stand\.fm).*$/i,
      ""
    )
    .trim();
}
function cleanupMaker(maker) {
  return String(maker || "")
    .replace(/^Spotify$/i, "")
    .replace(/^Apple Podcasts?$/i, "")
    .replace(/^LISTEN$/i, "")
    .replace(/^stand\.fm$/i, "")
    .replace(/^YouTube$/i, "")
    .replace(/^Amazon Music$/i, "")
    .trim();
}
function decodeHtml(value) {
  return String(
    value || ""
  )
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&#39;/g,
      "'"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    )
    .replace(
  /\\u([0-9a-fA-F]{4})/g,
  function(_, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  }
);
}
function detectProvider(url) {
  if (
    /spotify\.com/i.test(url)
  ) {
    return "Spotify";
  }

  if (
    /podcasts\.apple\.com/i.test(url)
  ) {
    return "Apple Podcasts";
  }

  if (
    /listen\.style/i.test(url)
  ) {
    return "LISTEN";
  }

  if (
    /stand\.fm/i.test(url)
  ) {
    return "stand.fm";
  }

  if (
    /amazon/i.test(url)
  ) {
    return "Amazon Music";
  }

  if (
    /youtube\.com|youtu\.be/i.test(url)
  ) {
    return "YouTube";
  }

  if (
    /pca\.st|pocketcasts\.com/i.test(url)
  ) {
    return "Pocket Casts";
  }

  return "";
}

// ---- PodcastIdentity.js ----
function normalizePodcastIdentityText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s　・･\-—–_()（）「」『』【】!！?？:：]/g, "");
}
function podcastIdentityFromResolved_(resolved) {
  const source = resolved || {};
  return {
    title: normalizePodcastIdentityText_(source.title),
    maker: normalizePodcastIdentityText_(
      source.maker || source.author || source.publisher || ""
    )
  };
}
function podcastIdentityMatch_(left, right) {
  const a = podcastIdentityFromResolved_(left);
  const b = podcastIdentityFromResolved_(right);

  if (!a.title || !b.title || a.title !== b.title) {
    return { duplicate: false, candidate: false, reason: "" };
  }

  if (a.maker && b.maker) {
    return {
      duplicate: a.maker === b.maker,
      candidate: a.maker !== b.maker,
      reason: a.maker === b.maker ? "title_maker" : "title_only"
    };
  }

  return { duplicate: false, candidate: true, reason: "title_only" };
}
function isSamePodcastIdentity_(left, right) {
  return podcastIdentityMatch_(left, right).duplicate;
}
function findPodcastDuplicateByIdentity_(items, resolved) {
  const list = Array.isArray(items) ? items : [];
  for (var i = 0; i < list.length; i += 1) {
    if (isSamePodcastIdentity_(list[i], resolved)) return list[i];
  }
  return null;
}
function canonicalPodcastIdentityUrl_(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    parsed.search = "";
    parsed.hash = "";
    let normalized = parsed.toString();
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized.toLowerCase();
  } catch (_) {
    return raw.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}
function listenerPodcastRowFromValues_(row, index) {
  return {
    id: String(index + 1).padStart(2, "0"),
    url: String(row[0] || "").trim(),
    title: String(row[1] || "").trim(),
    maker: String(row[2] || "").trim(),
    urls: [row[0], row[5], row[6], row[7], row[8], row[9], row[10], row[11]]
      .map(canonicalPodcastIdentityUrl_)
      .filter(Boolean)
  };
}
function findListenerPodcastDuplicateByAnyUrlInSheet_(sheet, urls) {
  if (!sheet) return null;

  const wanted = (Array.isArray(urls) ? urls : [urls])
    .map(canonicalPodcastIdentityUrl_)
    .filter(Boolean);
  if (!wanted.length) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues();
  for (var i = 0; i < values.length; i += 1) {
    const item = listenerPodcastRowFromValues_(values[i], i);
    if (item.urls.some(function(url) { return wanted.indexOf(url) >= 0; })) {
      return item;
    }
  }
  return null;
}
function podcastPlatformUrlsFromResolved_(resolved) {
  const source = resolved || {};
  return [
    source.url,
    source.spotify,
    source.apple,
    source.listen,
    source.standfm,
    source.amazon,
    source.youtube,
    source.website
  ].filter(Boolean);
}
function findListenerPodcastDuplicateByIdentityInSheet_(sheet, resolved) {
  if (!sheet || !resolved || !resolved.title) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues();
  const items = values.map(listenerPodcastRowFromValues_);

  return findPodcastDuplicateByIdentity_(items, resolved);
}

// ---- PodcastUrlResolve.js ----
function resolvePodcastUrl(url) {
  try {
    const cleanUrl =
      normalizePodcastInputUrl(url);

    let title = "";
    let maker = "";
    let artwork = "";
    let rss = "";
    let genre = "";
    let provider =
      detectProvider(cleanUrl);

    let resolvedUrl =
      cleanUrl;

    // Spotify episode → 番組へ解決
    if (/^https:\/\/open\.spotify\.com\/episode\//i.test(cleanUrl)) {
      const spotifyEpisode =
        resolveSpotifyEpisode(cleanUrl);

      if (spotifyEpisode) {
        title =
          String(
            spotifyEpisode.title || ""
          ).trim();

        maker =
          String(
            spotifyEpisode.maker || ""
          ).trim();

        artwork =
          String(
            spotifyEpisode.artwork || ""
          ).trim();

        if (spotifyEpisode.showUrl) {
          resolvedUrl =
            String(spotifyEpisode.showUrl);
        }

        provider =
          "Spotify";
      }
    }

    // Spotify show
    if (
      !title &&
      /^https:\/\/open\.spotify\.com\/show\//i.test(cleanUrl)
    ) {
      const spotify =
        resolveSpotifyShow(cleanUrl);

      if (spotify) {
        title =
          String(
            spotify.title || ""
          ).trim();

        maker =
          String(
            spotify.maker || ""
          ).trim();

        artwork =
          String(
            spotify.artwork || ""
          ).trim();

        provider =
          "Spotify";
      }
    }

    // Apple Podcasts
    if (
      !title &&
      /^https:\/\/podcasts\.apple\.com\//i.test(cleanUrl)
    ) {
      const m =
        cleanUrl.match(/(?:\/|%2F)id(\d+)/i) ||
        cleanUrl.match(/\bid(\d+)\b/i);

      if (m) {
        const appleId =
          String(m[1]);

        const res =
          fetchJson(
            "https://itunes.apple.com/lookup?id=" +
            encodeURIComponent(appleId)
          );

        const item =
          res &&
          res.results &&
          res.results[0];

        if (item) {
          title =
            String(
              item.collectionName ||
              item.trackName ||
              ""
            ).trim();

          artwork =
            String(
              item.artworkUrl600 ||
              item.artworkUrl100 ||
              ""
            ).trim();

          maker =
            String(
              item.artistName ||
              item.collectionArtistName ||
              ""
            ).trim();

          rss = String(item.feedUrl || "").trim();
          genre = normalizePodcastGenre_(
            Array.isArray(item.genres) ? item.genres : [],
            item.primaryGenreName || ""
          );

          provider =
            "Apple Podcasts";
        }
      }

      // lookupで取れない場合は、Appleページ自体のメタ情報も確認する。
      if (!title) {
        const appleHtml =
          fetchText(cleanUrl);

        if (appleHtml) {
          title =
            firstMeta(appleHtml, [
              /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
              /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
              /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
              /<title[^>]*>([\s\S]*?)<\/title>/i
            ]);

          artwork =
            firstMeta(appleHtml, [
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
              /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
            ]);

          maker =
            firstMeta(appleHtml, [
              /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
              /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i
            ]);

          provider =
            "Apple Podcasts";
        }
      }
    }

    // LISTEN番組ページは公開RSSへ変換して番組情報を取得する。
    if (!title && /^https:\/\/listen\.style\/p\//i.test(cleanUrl)) {
      const listenMatch = cleanUrl.match(/^https:\/\/listen\.style\/p\/([^/?#]+)/i);
      if (listenMatch && listenMatch[1]) {
        rss = "https://rss.listen.style/p/" + listenMatch[1] + "/rss";
        const feedMeta = readPodcastFeedMetadata_(rss);
        if (feedMeta && feedMeta.title) {
          title = String(feedMeta.title || "").trim();
          maker = String(feedMeta.maker || "").trim();
          artwork = String(feedMeta.artwork || "").trim();
          genre = String(feedMeta.genre || "").trim();
          resolvedUrl = "https://listen.style/p/" + listenMatch[1];
          provider = "LISTEN";
        }
      }
    }

    // RSS URLを直接入力した場合も番組情報へ解決する。
    if (!title && looksLikePodcastRssUrl_(cleanUrl)) {
      const feedMeta = readPodcastFeedMetadata_(cleanUrl);
      if (feedMeta && feedMeta.title) {
        title = String(feedMeta.title || "").trim();
        maker = String(feedMeta.maker || "").trim();
        artwork = String(feedMeta.artwork || "").trim();
        genre = String(feedMeta.genre || "").trim();
        rss = cleanUrl;
        provider = "RSS";
      }
    }

    // YouTube
    if (
      !title &&
      (
        /youtube\.com/i.test(cleanUrl) ||
        /youtu\.be/i.test(cleanUrl)
      )
    ) {
      const res =
        fetchJson(
          "https://www.youtube.com/oembed?format=json&url=" +
          encodeURIComponent(cleanUrl)
        );

      if (res) {
        title =
          String(res.title || "").trim();

        artwork =
          String(res.thumbnail_url || "").trim();

        maker =
          String(res.author_name || "").trim();

        provider =
          "YouTube";
      }
    }

    // LISTEN / stand.fm / Amazon / Pocket Casts 等
    if (!title) {
      const html =
        fetchText(cleanUrl);

      if (html) {
        title =
          firstMeta(html, [
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
            /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
            /<title[^>]*>([\s\S]*?)<\/title>/i
          ]);

        artwork =
          firstMeta(html, [
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
            /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
          ]);

        if (!maker) {
          maker =
            firstMeta(html, [
              /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
              /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i,
              /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
              /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
            ]);
        }
      }
    }

    title =
      cleanupTitle(
        decodeHtml(title)
      );

    maker =
      cleanupMaker(
        decodeHtml(maker)
      );

    artwork =
      decodeHtml(artwork);

    // Spotify等で番組名だけ取れた場合、Apple Podcastカタログを
    // 「完全一致」で照合し、配信者名・アートワークを補完する。
    if (title) {
      const appleMeta =
        findPodcastMetadataByTitle(title);

      if (appleMeta) {
        if (!maker) {
          maker =
            String(appleMeta.maker || "").trim();
        }
        if (!artwork) {
          artwork =
            String(appleMeta.artwork || "").trim();
        }
        if (!rss) {
          rss =
            String(appleMeta.feedUrl || "").trim();
        }
        if (!genre) {
          genre =
            String(appleMeta.genre || "").trim();
        }
      }
    }

    if (!title) {
      return {
        ok: false,
        error:
          "番組タイトルを自動取得できませんでした。別の配信先URL（Apple Podcasts / LISTEN など）でも試せます。",
        provider:
          provider
      };
    }

    return {
      ok: true,
      title:
        title,
      maker:
        maker,
      artwork:
        artwork,
      rss:
        rss,
      genre:
        genre,
      provider:
        provider,
      url:
        resolvedUrl,
      upgradedFromEpisode:
        resolvedUrl !== cleanUrl &&
        (
          /^https:\/\/open\.spotify\.com\/episode\//i.test(cleanUrl) ||
          /^https:\/\/listen\.style\/p\/[^/?#]+\/[^/?#]+/i.test(cleanUrl)
        )
    };

  } catch (error) {
    return {
      ok: false,
      error:
        "番組情報を取得できませんでした。",
      detail:
        String(
          error &&
          error.message
            ? error.message
            : error
        )
    };
  }
}
function looksLikePodcastRssUrl_(value) {
  const url = String(value || "").trim();
  return (
    /^https?:\/\/[^\s]+\/(?:rss|feed)(?:[/?#]|$)/i.test(url) ||
    /^https?:\/\/[^\s]+\.(?:rss|xml)(?:[?#]|$)/i.test(url) ||
    /^https?:\/\/rss\.listen\.style\//i.test(url)
  );
}

// ---- PodcastApple.js ----
function findPodcastByEpisodeTitle(episodeTitle) {
  const term =
    String(episodeTitle || "").trim();

  if (!term) {
    return null;
  }

  try {
    const data =
      fetchJson(
        "https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&limit=30&country=JP&term=" +
        encodeURIComponent(term)
      );

    const results =
      data &&
      Array.isArray(data.results)
        ? data.results
        : [];

    if (!results.length) {
      return null;
    }

    const wanted =
      normalizeTitle(term);

    let best = null;

    for (let i = 0; i < results.length; i++) {
      const item =
        results[i];

      const episodeName =
        String(
          item.trackName ||
          item.episodeName ||
          ""
        ).trim();

      const normalized =
        normalizeTitle(episodeName);

      if (
        normalized === wanted
      ) {
        best = item;
        break;
      }

      if (
        !best &&
        normalized &&
        wanted &&
        (
          normalized.indexOf(wanted) >= 0 ||
          wanted.indexOf(normalized) >= 0
        )
      ) {
        best = item;
      }
    }

    if (!best) {
      return null;
    }

    const title =
      String(
        best.collectionName ||
        ""
      ).trim();

    if (!title) {
      return null;
    }

    return {
      title: title,
      maker:
        String(
          best.artistName ||
          best.collectionArtistName ||
          ""
        ).trim(),
      artwork:
        String(
          best.artworkUrl600 ||
          best.artworkUrl160 ||
          best.artworkUrl100 ||
          ""
        ).trim()
    };

  } catch (_) {
    return null;
  }
}
function findPodcastMetadataByTitle(title) {
  const term =
    String(title || "").trim();

  if (!term) {
    return null;
  }

  try {
    const data =
      fetchJson(
        "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=12&country=JP&term=" +
        encodeURIComponent(term)
      );

    const results =
      data &&
      Array.isArray(data.results)
        ? data.results
        : [];

    if (!results.length) {
      return null;
    }

    const wanted =
      normalizeTitle(term);

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      const name =
        String(
          item.collectionName ||
          item.trackName ||
          ""
        );

      if (
        normalizeTitle(name) === wanted
      ) {
        return {
          maker:
            String(
              item.artistName ||
              item.collectionArtistName ||
              ""
            ).trim(),
          artwork:
            String(
              item.artworkUrl600 ||
              item.artworkUrl100 ||
              ""
            ).trim(),
          feedUrl:
            String(item.feedUrl || "").trim(),
          appleUrl:
            String(item.collectionViewUrl || item.trackViewUrl || "").trim(),
          rawGenre:
            String(item.primaryGenreName || "").trim(),
          genre:
            normalizePodcastGenre_(
              Array.isArray(item.genres) ? item.genres : [],
              item.primaryGenreName || ""
            )
        };
      }
    }

    return null;

  } catch (_) {
    return null;
  }
}
function findPodcastArtworkByTitle(title) {
  const term =
    String(title || "").trim();

  if (!term) {
    return "";
  }

  try {
    const data =
      fetchJson(
        "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=8&country=JP&term=" +
        encodeURIComponent(term)
      );

    const results =
      data &&
      Array.isArray(data.results)
        ? data.results
        : [];

    if (!results.length) {
      return "";
    }

    const wanted =
      normalizeTitle(term);

    let best = null;

    for (
      let i = 0;
      i < results.length;
      i++
    ) {
      const name =
        String(
          results[i].collectionName ||
          results[i].trackName ||
          ""
        );

      const normalized =
        normalizeTitle(name);

      if (
        normalized === wanted
      ) {
        best =
          results[i];
        break;
      }

      if (
        !best &&
        normalized &&
        wanted &&
        (
          normalized.indexOf(wanted) >= 0 ||
          wanted.indexOf(normalized) >= 0
        )
      ) {
        best =
          results[i];
      }
    }

    if (!best) {
      return "";
    }

    return String(
      best.artworkUrl600 ||
      best.artworkUrl100 ||
      ""
    ).trim();

  } catch (_) {
    return "";
  }
}
function normalizePodcastGenre_(genres, primaryGenreName) {
  const normalizeValue = function(value) {
    return String(value || "").toLowerCase().trim();
  };

  const mapGenre = function(value) {
    const v = normalizeValue(value);
    if (!v) return "";

    if (/government|politic|政治/.test(v)) return "政治";
    if (/news|daily news|news commentary|ニュース|ニュース解説/.test(v)) return "ニュース・時事";
    if (/history|歴史/.test(v)) return "歴史";
    if (/education|courses|how to|教育/.test(v)) return "教育";

    if (
      /health|fitness|medicine|mental health|nutrition|健康|医療|フィットネス|メンタルヘルス/.test(v)
    ) {
      return "福祉・医療";
    }

    if (
      /tv|film|music|映画|映画レビュー|テレビ番組／映画|tv番組レビュー|音楽/.test(v)
    ) {
      return "映画・音楽";
    }

    if (/sports|スポーツ/.test(v)) return "スポーツ";

    if (
      /leisure|hobbies|home|garden|food|games|レジャー|趣味|家庭|フード|ゲーム|ファッション|美容|ブック|アート/.test(v)
    ) {
      return "趣味・暮らし";
    }

    if (/comedy|コメディ/.test(v)) return "雑談・トーク";

    if (/business|career|ビジネス|キャリア/.test(v)) {
      return "ビジネス";
    }

    if (
      /society|culture|personal journals|documentary|relationships|社会|文化|ドキュメンタリー|地域情報|トラベル|キリスト教|宗教|スピリチュアル/.test(v)
    ) {
      return "社会・文化";
    }

    return "";
  };

  const primary = mapGenre(primaryGenreName);
  if (primary) return primary;

  const values = Array.isArray(genres) ? genres : [];
  for (let i = 0; i < values.length; i++) {
    const mapped = mapGenre(values[i]);
    if (mapped) return mapped;
  }

  return "その他";
}

// ---- PodcastPody.js ----
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

// ---- PodcastResolve.js ----
function resolveSpotifyEpisode(cleanUrl) {
  const episodeMatch =
    String(cleanUrl || "").match(/open\.spotify\.com\/episode\/([A-Za-z0-9]+)/i);

  if (!episodeMatch) {
    return null;
  }

  const episodeId =
    String(episodeMatch[1]);

  const canonicalEpisode =
    "https://open.spotify.com/episode/" + episodeId;

  let episodeTitle = "";
  let showTitle = "";
  let maker = "";
  let artwork = "";
  let showUrl = "";

  // 0) Spotify公式Web APIから所属番組を取得する。
  const officialEpisode =
    typeof fetchSpotifyEpisodeFromWebApi === "function"
      ? fetchSpotifyEpisodeFromWebApi(episodeId)
      : null;

  if (officialEpisode && officialEpisode.showId) {
    episodeTitle = String(officialEpisode.episodeTitle || "").trim();
    showTitle = String(officialEpisode.title || "").trim();
    artwork = String(officialEpisode.artwork || "").trim();
    showUrl = "https://open.spotify.com/show/" + String(officialEpisode.showId);

    const show = resolveSpotifyShow(showUrl);
    if (show && show.title) {
      return {
        title: show.title,
        maker: show.maker || "",
        artwork: show.artwork || artwork,
        showUrl: showUrl,
        episodeTitle: episodeTitle
      };
    }
  }

  // 1) oEmbed
  const data =
    fetchSpotifyJson(
      "https://open.spotify.com/oembed?url=" +
      encodeURIComponent(canonicalEpisode)
    );

  if (data) {
    episodeTitle =
      String(data.title || "").trim();

    artwork =
      String(data.thumbnail_url || "").trim();

    // episode oEmbedのauthor_nameが番組名になる場合がある。
    const author =
      String(data.author_name || "").trim();

    if (
      author &&
      author.toLowerCase() !== "spotify" &&
      !looksLikeEpisodeTitle(author)
    ) {
      showTitle = author;
    }
  }

  // 2) 通常ページ / embedページから番組情報を探す
  const htmlCandidates = [
    fetchSpotifyText(canonicalEpisode),
    fetchSpotifyText(
      "https://open.spotify.com/embed/episode/" +
      episodeId
    )
  ];

  for (let h = 0; h < htmlCandidates.length; h++) {
    const html =
      htmlCandidates[h] || "";

    if (!html) continue;

    if (!showUrl) {
      const m =
        html.match(/https?:\/\/open\.spotify\.com\/show\/([A-Za-z0-9]+)/i) ||
        html.match(/\/show\/([A-Za-z0-9]+)/i);

      if (m && m[1]) {
        showUrl =
          "https://open.spotify.com/show/" +
          m[1];
      }
    }

    if (!showTitle) {
      showTitle =
        firstMeta(html, [
          /"showName"\s*:\s*"([^"]+)"/i,
          /"podcastName"\s*:\s*"([^"]+)"/i,
          /"contextName"\s*:\s*"([^"]+)"/i,
          /"publisherName"\s*:\s*"([^"]+)"/i
        ]);
    }

    if (!maker) {
      maker =
        firstMeta(html, [
          /"creatorName"\s*:\s*"([^"]+)"/i,
          /"authorName"\s*:\s*"([^"]+)"/i,
          /"publisher"\s*:\s*"([^"]+)"/i
        ]);
    }

    if (!artwork) {
      artwork =
        firstMeta(html, [
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
        ]);
    }
  }

  // show URLが取れたら、既存のshow resolverに引き渡すのが最も確実
  if (showUrl) {
    const show =
      resolveSpotifyShow(showUrl);

    if (show && show.title) {
      return {
        title: show.title,
        maker: show.maker || maker,
        artwork: show.artwork || artwork,
        showUrl: showUrl,
        episodeTitle: episodeTitle
      };
    }
  }

  // Spotify側から所属番組が取れない場合は、取得できたエピソード名を
  // Apple Podcastsのエピソード検索に渡して番組へ戻す。
  if (!showTitle && episodeTitle) {
    const appleEpisode =
      typeof findPodcastByEpisodeTitle === "function"
        ? findPodcastByEpisodeTitle(episodeTitle)
        : null;

    if (appleEpisode && appleEpisode.title) {
      showTitle = String(appleEpisode.title || "").trim();
      if (!maker) {
        maker = String(appleEpisode.maker || "").trim();
      }
      if (!artwork) {
        artwork = String(appleEpisode.artwork || "").trim();
      }
    }
  }

  showTitle =
    cleanupTitle(
      decodeHtml(showTitle)
    );

  maker =
    cleanupMaker(
      decodeHtml(maker)
    );

  artwork =
    decodeHtml(artwork);

  if (showTitle && (!maker || !artwork)) {
    const appleMeta =
      findPodcastMetadataByTitle(showTitle);

    if (appleMeta) {
      if (!maker) {
        maker =
          String(appleMeta.maker || "").trim();
      }
      if (!artwork) {
        artwork =
          String(appleMeta.artwork || "").trim();
      }
    }
  }

  if (!showTitle) {
    return null;
  }

  return {
    title: showTitle,
    maker: maker,
    artwork: artwork,
    showUrl: showUrl,
    episodeTitle: episodeTitle
  };
}

// ---- PodcastResolveHandler.js ----
function handlePodcastResolve_(e, callback) {
  const rawUrl =
    e && e.parameter && e.parameter.url
      ? String(e.parameter.url).trim()
      : "";

  const url = normalizePodcastInputUrl(rawUrl);

  const kind =
    e && e.parameter && e.parameter.kind
      ? String(e.parameter.kind).trim()
      : "listenerPodcast";

  if (!url) {
    return apiResponse({ ok: false, error: "URLを入力してください" }, callback);
  }

  if (kind !== "podcast" && kind !== "listenerPodcast") {
    return apiResponse({
      ok: false,
      error: "kind は podcast / listenerPodcast を指定してください"
    }, callback);
  }

  const ssForResolve = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targetSheetName = kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME;
  const targetSheet = getSheetLoose(ssForResolve, targetSheetName);

  if (kind === "listenerPodcast" && targetSheet) {
    // A列だけでなく、Spotify / Apple / LISTEN / stand.fm / Amazon / YouTube / 公式サイトも照合する。
    const knownPlatform = findListenerPodcastDuplicateByAnyUrlInSheet_(targetSheet, [url]);
    if (knownPlatform) {
      return apiResponse({
        ok: true,
        title: knownPlatform.title,
        maker: knownPlatform.maker || "",
        artwork: "",
        provider: detectProvider(url),
        duplicate: true,
        duplicateId: knownPlatform.id,
        duplicateReason: "platform_url",
        duplicateTitle: knownPlatform.title,
        duplicateMaker: knownPlatform.maker || "",
        url: url
      }, callback);
    }
  }

  const known = targetSheet ? findPodcastDuplicate(targetSheet, url, "") : null;
  if (known && known.urlMatch) {
    return apiResponse({
      ok: true,
      title: known.title,
      maker: kind === "podcast" ? (known.host || "") : (known.maker || ""),
      artwork: "",
      provider: detectProvider(url),
      duplicate: true,
      duplicateId: known.id,
      duplicateReason: "url",
      url: url
    }, callback);
  }

  const resolved = resolvePodcastUrl(url);

  if (resolved && resolved.ok && targetSheet) {
    if (kind === "listenerPodcast") {
      // まず、入力URLから確認できる他配信先も含めて既存行と照合する。
      let discovered = null;
      try {
        discovered = resolveListenerPodcastPlatforms_(
          resolved.title || "",
          resolved.maker || resolved.author || resolved.publisher || "",
          url
        );
      } catch (_) {
        discovered = null;
      }

      const platformDuplicate = findListenerPodcastDuplicateByAnyUrlInSheet_(
        targetSheet,
        [url].concat(podcastPlatformUrlsFromResolved_(discovered))
      );

      const identityDuplicate = platformDuplicate
        ? null
        : findListenerPodcastDuplicateByIdentityInSheet_(targetSheet, resolved);
      const duplicate = platformDuplicate || identityDuplicate;

      if (duplicate) {
        resolved.duplicate = true;
        resolved.duplicateId = duplicate.id;
        resolved.duplicateReason = platformDuplicate ? "platform_url" : "identity";
        resolved.duplicateTitle = duplicate.title;
        resolved.duplicateMaker = duplicate.maker || "";
      } else {
        resolved.duplicate = false;
      }
    } else {
      const duplicate = findPodcastDuplicate(
        targetSheet,
        String(resolved.url || url),
        resolved.title || ""
      );
      if (duplicate) {
        resolved.duplicate = true;
        resolved.duplicateId = duplicate.id;
        resolved.duplicateReason = duplicate.titleMatch ? "title" : "url";
      } else {
        resolved.duplicate = false;
      }
    }
  }

  if (resolved && resolved.ok) {
    resolved.inputUrl = url;
    if (!resolved.url) resolved.url = url;
  }
  return apiResponse(resolved, callback);
}

// ---- PodcastSubmission.js ----
const PODCAST_RECEIPT_PREFIX_V2_ = "PODCAST_RECEIPT_V2_";
const PODCAST_RECEIPT_TTL_V2_ = 3 * 86400000;
function podcastReceiptKey_(requestId) {
  const id = String(requestId || "").trim();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw new Error("投稿受付番号が正しくありません。ページを再読み込みしてください。");
  return PODCAST_RECEIPT_PREFIX_V2_ + id;
}
function readPodcastReceipt_(requestId) {
  const value = PropertiesService.getScriptProperties().getProperty(podcastReceiptKey_(requestId));
  if (!value) return null;
  try { const item = JSON.parse(value); return Date.now() - item.created <= PODCAST_RECEIPT_TTL_V2_ ? item : null; }
  catch (_) { return null; }
}
function beginPodcastReceipt_(requestId, kind, url, title) {
  const key = podcastReceiptKey_(requestId);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("投稿受付が混み合っています。再度お試しください。");
  try {
    const store = PropertiesService.getScriptProperties();
    const previous = readPodcastReceipt_(requestId);
    if (previous) {
      if (previous.kind !== kind || previous.url !== url || previous.title !== title) throw new Error("受付番号に対応する投稿内容が異なります。");
      return;
    }
    const records = Object.keys(store.getProperties()).filter(k => k.indexOf(PODCAST_RECEIPT_PREFIX_V2_) === 0)
      .map(k => { try { return { key: k, item: JSON.parse(store.getProperty(k)) }; } catch (_) { return { key: k, item: { created: 0 } }; } })
      .sort((a, b) => a.item.created - b.item.created);
    records.forEach((record, index) => {
      if (Date.now() - record.item.created > PODCAST_RECEIPT_TTL_V2_ || index < records.length - 99) store.deleteProperty(record.key);
    });
    // Persist identity BEFORE appending: even if completion fails, a read-only status
    // request can verify the committed row. Maximum 100 bounded receipts.
    podcastSetPropertySafeV2_(store, key, JSON.stringify({ kind: kind, url: url, title: title, created: Date.now(), status: "pending" }));
  } finally { lock.releaseLock(); }
}
function completePodcastReceipt_(requestId, added, duplicateReason) {
  const record = readPodcastReceipt_(requestId);
  if (!record || record.status === "saved") return; // Same request retains its original outcome.
  record.status = "saved"; record.added = added; record.duplicateReason = duplicateReason || "";
  podcastSetPropertySafeV2_(PropertiesService.getScriptProperties(), podcastReceiptKey_(requestId), JSON.stringify(record));
}
function findPodcastReceiptRow_(record) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const name = record.kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME;
  const sheet = getSheetLoose(ss, name);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  const index = rows.findIndex(row => normalizeUrl(row[0]) === normalizeUrl(record.url) || normalizeTitle(row[1]) === normalizeTitle(record.title));
  return index < 0 ? null : { row: index + 2, sourceUrl: String(rows[index][0]).trim(), title: String(rows[index][1]).trim() };
}
function handlePodcastRequestStatus_(e, callback) {
  try {
    const record = readPodcastReceipt_(e && e.parameter && e.parameter.requestId);
    if (!record) return apiResponse({ ok: true, accepted: false, status: "unknown" }, callback);
    const row = findPodcastReceiptRow_(record);
    if (!row) return apiResponse({ ok: true, accepted: false, status: "pending" }, callback);
    return apiResponse({ ok: true, accepted: true, status: "saved", kind: record.kind,
      added: record.status === "saved" ? record.added : null,
      duplicateReason: record.duplicateReason || "", sourceUrl: row.sourceUrl, title: row.title }, callback);
  } catch (_) { return apiResponse({ ok: false, accepted: false, status: "unavailable" }, callback); }
}
function newPodcastPriorityIdentities_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(properties).filter(k => k.indexOf(PODCAST_RECEIPT_PREFIX_V2_) === 0).map(k => {
    try { return JSON.parse(properties[k]); } catch (_) { return null; }
  }).filter(r => r && ((r.status === "saved" && r.added) || r.status === "pending") && Date.now() - r.created < PODCAST_RECEIPT_TTL_V2_)
    .filter(r => {
      // Read exactly the public API projection before prioritizing any saved job.
      try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = getSheetLoose(ss, r.kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME);
        const data = r.kind === "podcast" ? readPodcastSheet(sheet) : readListenerPodcastSheet(sheet);
        return data.ok && data.items.some(item => normalizeUrl(item.url) === normalizeUrl(r.url) && normalizeTitle(item.title) === normalizeTitle(r.title));
      } catch (_) { return false; }
    }).sort((a, b) => b.created - a.created);
}

// Read-only audit: never return names or values of secret properties.
function inspectPodcastPropertiesV2() {
  const values = PropertiesService.getScriptProperties().getProperties();
  const bytes = value => Utilities.newBlob(String(value)).getBytes().length;
  let used = 0, largest = 0, owned = 0;
  Object.keys(values).forEach(key => { const n = bytes(key) + bytes(values[key]); used += n; largest = Math.max(largest, bytes(values[key])); if (/^PODCAST_(RECEIPT|PIPELINE)_/.test(key)) owned += n; });
  return {readable: true, usedBytes: used, largestValueBytes: largest, podcastBytes: owned,
    limitBytes: 500 * 1024, reserveBytes: 64 * 1024, writablePermission: "not probed"};
}
function podcastSetPropertySafeV2_(store, key, value) {
  const audit = inspectPodcastPropertiesV2();
  const bytes = value => Utilities.newBlob(String(value)).getBytes().length;
  const old = store.getProperty(key);
  const projected = audit.usedBytes - (old === null ? 0 : bytes(key) + bytes(old)) + bytes(key) + bytes(value);
  if (bytes(value) > 9 * 1024 || projected > audit.limitBytes - audit.reserveBytes) throw new Error("Podcast Properties capacity reserve reached");
  store.setProperty(key, value);
}

// ---- PodcastPlatformPipeline.js ----
const PODCAST_PLATFORMS_V2_ = ["youtube", "spotify", "amazon", "apple", "pocketcasts", "listen", "standfm", "pody"];
var podcastFetchContextV2_ = null;
function podcastPipelineHash_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)).replace(/=+$/, "");
}
function podcastPipelineIdentity_(kind, row) {
  return kind + ":" + podcastPipelineHash_(String(row[0]) + "\n" + String(row[1]));
}
function podcastColumnMapV2_(kind) {
  return kind === "podcast" ? { youtube: 9, spotify: 10, amazon: 11, apple: 12, pocketcasts: 13, listen: 14, standfm: 15, pody: 16, artwork: 6, rss: 8, genre: 18 }
    : { youtube: 11, spotify: 6, amazon: 10, apple: 7, pocketcasts: 15, listen: 8, standfm: 9, pody: 16, artwork: 13, rss: 14, genre: 17 };
}
function newPodcastFetchContextV2_() {
  return { remaining: 20, rowRemaining: 6, requests: 0, deadline: Date.now() + 90000, memo: {}, errors: [] };
}
function fetchPodcastPlatformResource_(url, options) {
  const context = podcastFetchContextV2_;
  if (!context) return UrlFetchApp.fetch(url, options || {}); // Legacy helpers unchanged outside V2.
  const key = String(url) + "\n" + JSON.stringify(options || {});
  if (context.memo[key]) {
    if (context.memo[key].error) throw new Error(context.memo[key].error);
    return context.memo[key].response;
  }
  if (context.remaining <= 0 || context.rowRemaining <= 0 || Date.now() >= context.deadline) {
    context.errors.push("Podcast lookup budget exhausted");
    throw new Error("Podcast lookup budget exhausted");
  }
  context.remaining--; context.rowRemaining--; context.requests++;
  try {
    Utilities.sleep(250);
    const response = UrlFetchApp.fetch(url, options || {});
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) throw new Error("HTTP " + code);
    if (response.getContentText().length > 3000000) throw new Error("Response too large");
    context.memo[key] = { response: response };
    return response;
  } catch (error) {
    const message = String(error && error.message || error);
    context.errors.push(message); context.memo[key] = { error: message }; throw error;
  }
}
function podcastSafeFeedV2_(value) {
  return /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/|$)/.test(String(value || "")) &&
    !/[?&](?:token|auth|key|signature|sig|access_token)=/i.test(value);
}
function podcastKnownLinkV2_(url) {
  const match = String(url || "").trim().match(/^https:\/\/([^/?#]+)(\/[^#]*)?$/i);
  if (!match || match[1].indexOf("@") >= 0) return null;
  const host = match[1].toLowerCase(), path = match[2] || "/";
  const rules = [
    ["spotify", host === "open.spotify.com" && /^\/show\/[A-Za-z0-9]+(?:[/?]|$)/.test(path)],
    ["apple", host === "podcasts.apple.com" && /\/id\d+(?:[/?]|$)/.test(path)],
    ["youtube", (host === "youtube.com" || host === "www.youtube.com") && /^\/(?:@|channel\/|playlist\?list=)/.test(path)],
    ["amazon", /^(?:music\.|www\.)?amazon\.[a-z.]+$/.test(host) && /^\/podcasts\//.test(path)],
    ["listen", host === "listen.style" && /^\/p\/[^/?]+/.test(path)],
    ["standfm", host === "stand.fm" && /^\/channels\/[^/?]+/.test(path)],
    ["pocketcasts", /^(?:pca\.st|(?:www\.)?pocketcasts\.com)$/.test(host)],
    ["pody", host === "pody.jp" && /^\/player\/[A-Za-z0-9]+(?:[/?]|$)/.test(path)]
  ];
  const found = rules.find(rule => rule[1]);
  return found ? { platform: found[0], url: String(url).trim() } : null;
}
function podcastTitleMatchesV2_(actual, wanted) {
  const terms = typeof podcastSearchTitleCandidates_ === "function" ? podcastSearchTitleCandidates_(wanted) : [wanted];
  return terms.some(term => normalizeTitle(term) === normalizeTitle(actual));
}
function podcastMakerMatchesV2_(actual, wanted) {
  const a = normalizeTitle(actual || ""), w = normalizeTitle(wanted || "");
  return !a || !w || a === w || a.indexOf(w) >= 0 || w.indexOf(a) >= 0;
}
function readPodcastFeedV2_(url, title, maker) {
  if (!podcastSafeFeedV2_(url)) return { status: "mismatch" };
  try {
    // These existing parsers share a single fetched response through the V2 memo.
    const meta = readPodcastFeedMetadata_(url);
    if (!meta) return { status: "retryableError" };
    if (!podcastTitleMatchesV2_(meta.title, title) || !podcastMakerMatchesV2_(meta.maker, maker)) return { status: "mismatch" };
    return { status: "verified", meta: meta, links: readPodcastFeedLinks_(url),
      audio: extractPodyAudioUrls_(fetchPodcastPlatformResource_(url, { muteHttpExceptions: true, followRedirects: true }).getContentText()) };
  } catch (_) { return { status: "retryableError" }; }
}
function resolveMissingPodcastPlatformsV2_(job, due) {
  const current = {};
  Object.keys(job.columns).forEach(key => { current[key] = String(job.row[job.columns[key] - 1] || "").trim(); });
  const values = {}, statuses = {};
  due.forEach(key => { statuses[key] = "notFound"; });
  const title = String(job.row[1] || "").trim();
  const maker = job.kind === "podcast" ? String(job.row[6] || "").trim() : String(job.row[2] || "").trim();
  const accept = (key, value) => {
    const known = podcastKnownLinkV2_(value);
    if (!current[key] && due.indexOf(key) >= 0 && known && known.platform === key) {
      values[key] = known.url; statuses[key] = "verified";
    }
  };
  const source = podcastKnownLinkV2_(job.row[0]);
  if (source && source.platform !== "pody") accept(source.platform, source.url);
  let rss = current.rss;
  if (!rss && podcastSafeFeedV2_(job.row[0]) && /(?:\/(?:rss|feed)(?:[/?#]|$)|\.(?:rss|xml)(?:[?#]|$))/i.test(job.row[0])) rss = job.row[0];
  if (!rss) {
    const listen = podcastKnownLinkV2_(current.listen || job.row[0]);
    if (listen && listen.platform === "listen") rss = "https://rss.listen.style/p/" + listen.url.match(/\/p\/([^/?]+)/)[1] + "/rss";
  }
  const needsFeed = due.some(key => key !== "spotify" && key !== "apple");
  let apple = null;
  // Existing Apple URL may supply a missing RSS dependency; never search/replace it.
  if (!rss && needsFeed && current.apple) apple = lookupApplePodcastByUrl_(current.apple);
  if (!current.apple && due.indexOf("apple") >= 0 && !values.apple) {
    apple = findUniqueApplePodcastV2_(title, maker);
    if (apple) accept("apple", apple.collectionViewUrl || apple.trackViewUrl || "");
  }
  if (apple && !rss) rss = String(apple.feedUrl || "").trim();
  if (due.indexOf("spotify") >= 0 && !current.spotify && !values.spotify) {
    try { accept("spotify", findMissingSpotifyPodcastV2_(title, maker) || ""); }
    catch (_) { statuses.spotify = "retryableError"; }
  }
  let feed = null;
  if (needsFeed && rss) feed = readPodcastFeedV2_(rss, title, maker);
  if (feed && feed.status === "verified") {
    (feed.links || []).forEach(url => { const known = podcastKnownLinkV2_(url); if (known && known.platform !== "pody") accept(known.platform, known.url); });
    if (!current.artwork && due.indexOf("artwork") >= 0 && /^https:\/\//.test(feed.meta.artwork || "")) { values.artwork = feed.meta.artwork; statuses.artwork = "verified"; }
    if (!current.rss && due.indexOf("rss") >= 0) { values.rss = rss; statuses.rss = "verified"; }
    if (due.indexOf("pody") >= 0 && !current.pody) {
      const result = resolvePodyFromVerifiedFeedV2_(title, feed.audio || [], source && source.platform === "pody" ? source.url : "");
      if (result.url) { values.pody = result.url; statuses.pody = "verified"; }
      else statuses.pody = result.status;
    }
  } else if (needsFeed) {
    due.filter(key => key !== "spotify" && key !== "apple").forEach(key => { if (!values[key]) statuses[key] = feed ? feed.status : "retryableError"; });
  }
  return { values: values, statuses: statuses };
}
function findMissingSpotifyPodcastV2_(title, maker) {
  // Use the existing token accessor but route its HTTP (including auth) through the
  // shared request budget in this candidate's Spotify helper adapter.
  const token = getPodcastLookupTokenV2_();
  if (!token) throw new Error("Spotify lookup credentials unavailable");
  const terms = typeof podcastSearchTitleCandidates_ === "function" ? podcastSearchTitleCandidates_(title) : [title];
  const matches = {};
  const titleOnly = {};
  for (let i = 0; i < Math.min(terms.length, 3); i++) {
    const response = fetchPodcastPlatformResource_("https://api.spotify.com/v1/search?q=" + encodeURIComponent(terms[i]) + "&type=show&market=JP&limit=10",
      { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
    const data = JSON.parse(response.getContentText());
    ((data.shows || {}).items || []).forEach(show => {
      if (!(podcastTitleMatchesV2_(show.name, title) && show.external_urls && show.external_urls.spotify)) return;
      titleOnly[show.external_urls.spotify] = true;
      if (podcastExactMakerV2_(show.publisher, maker)) matches[show.external_urls.spotify] = true;
    });
  }
  const urls = Object.keys(matches);
  if (urls.length === 1) return urls[0];
  // 配信者名が朝リスネームと違っても、番組名が完全一致する番組がSpotifyに1つだけなら採用（2026-11-18）
  const only = Object.keys(titleOnly);
  return urls.length === 0 && only.length === 1 ? only[0] : "";
}
function getPodcastLookupTokenV2_() {
  // No cache write in dry-run, and no token refresh outside the shared HTTP budget.
  const cached = CacheService.getScriptCache().get("spotify_access_token");
  if (cached) return cached;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SPOTIFY_CLIENT_ID"), secret = props.getProperty("SPOTIFY_CLIENT_SECRET");
  if (!id || !secret) return "";
  const response = fetchPodcastPlatformResource_("https://accounts.spotify.com/api/token", {
    method: "post", muteHttpExceptions: true, headers: { Authorization: "Basic " + Utilities.base64Encode(id + ":" + secret) },
    payload: { grant_type: "client_credentials" }
  });
  return String(JSON.parse(response.getContentText()).access_token || "");
}
function podcastPipelineJobsV2_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID), jobs = [];
  ["listenerPodcast", "podcast"].forEach(kind => {
    const sheet = getSheetLoose(ss, kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME);
    if (!sheet) throw new Error("Podcast sheet missing");
    validatePodcastColumnsV2_(sheet, kind);
    if (sheet.getLastRow() < 2) return;
    const columns = podcastColumnMapV2_(kind);
    const projection = kind === "podcast" ? readPodcastSheet(sheet) : readListenerPodcastSheet(sheet);
    if (!projection || !projection.ok || !Array.isArray(projection.items)) throw new Error("Podcast public projection unavailable");
    const width = kind === "podcast" ? 18 : 17;
    sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues().forEach((row, index) => {
      if (String(row[1] || "").trim() && projection.items.some(item => normalizeUrl(item.url) === normalizeUrl(row[0]) && normalizeTitle(item.title) === normalizeTitle(row[1]))) jobs.push({ kind: kind, sheet: sheet, row: row, number: index + 2, columns: columns, identity: podcastPipelineIdentity_(kind, row) });
    });
  });
  return jobs;
}
function commitPodcastPipelineValuesV2_(job, values) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { writes: 0, retry: true };
  try {
    validatePodcastColumnsV2_(job.sheet, job.kind);
    const rows = job.sheet.getRange(2, 1, job.sheet.getLastRow() - 1, job.kind === "podcast" ? 18 : 17).getDisplayValues();
    const matches = rows.map((row, index) => ({ row: row, number: index + 2 })).filter(item => podcastPipelineIdentity_(job.kind, item.row) === job.identity);
    if (matches.length !== 1) return { writes: 0, retry: true };
    const current = matches[0]; let writes = 0;
    Object.keys(values).forEach(key => {
      if (!job.columns[key] || key === "genre" || !values[key]) return;
      // Includes human edits and moved rows; no destructive replacement.
      if (!String(job.sheet.getRange(current.number, job.columns[key]).getDisplayValue() || "").trim()) {
        job.sheet.getRange(current.number, job.columns[key]).setValue(values[key]); writes++;
      }
    });
    return { writes: writes, retry: false };
  } finally { lock.releaseLock(); }
}
function syncPodcastMissingPlatformsV2(dryRun, onlyKind) {
  const preview = dryRun !== false;
  const store = PropertiesService.getScriptProperties();
  const lease = preview ? null : acquirePodcastRunnerLeaseV2_(store);
  if (!preview && !lease) return { dryRun:false, busy:true, scanned:0, processed:0, requests:0, results:[] };
  try {
  const now = Date.now(), all = podcastPipelineJobsV2_().filter(job => !onlyKind || job.kind === onlyKind);
  const cursor = Number(store.getProperty("PODCAST_PIPELINE_CURSOR_V2") || 0) % Math.max(all.length, 1);
  const rotated = all.slice(cursor).concat(all.slice(0, cursor));
  const priorities = newPodcastPriorityIdentities_();
  const isPriority = job => priorities.some(p => p.kind === job.kind && p.url === job.row[0] && p.title === job.row[1]);
  const context = newPodcastFetchContextV2_();
  const results = []; let processed = 0, priorityCount = 0;
  const ordered = rotated.filter(isPriority).concat(rotated.filter(job => !isPriority(job)));
  podcastFetchContextV2_ = context;
  try {
    for (let i = 0; i < ordered.length; i++) {
      const job = ordered[i];
      if (processed >= 8 || context.remaining <= 0 || Date.now() >= context.deadline) break;
      if (isPriority(job) && priorityCount >= 1) continue;
      const reservedForExisting = rotated.some(item => !isPriority(item)) ? 6 : 0;
      if (isPriority(job) && context.remaining <= reservedForExisting) continue;
      const stateKey = "PODCAST_PIPELINE_STATE_V2_" + job.identity;
      let state = {}; try { state = JSON.parse(store.getProperty(stateKey) || "{}"); } catch (_) {}
      const targets = PODCAST_PLATFORMS_V2_.concat(["artwork", "rss"]);
      const due = targets.filter(key => !String(job.row[job.columns[key] - 1] || "").trim() && (!state[key] || state[key].next <= now));
      if (!due.length) continue;
      processed++; if (isPriority(job)) priorityCount++;
      context.errors = [];
      context.rowRemaining = isPriority(job) ? Math.min(6, context.remaining - reservedForExisting) : 6;
      let outcome;
      try { outcome = resolveMissingPodcastPlatformsV2_(job, due); }
      catch (_) { outcome = { values: {}, statuses: Object.fromEntries(due.map(key => [key, "retryableError"])) }; }
      // Swallowed helper failures must not masquerade as confirmed absence.
      due.forEach(key => {
        if (!outcome.values[key] && context.errors.length && outcome.statuses[key] === "notFound") outcome.statuses[key] = "retryableError";
      });
      let commit = { writes: 0, retry: false };
      if (!preview) commit = commitPodcastPipelineValuesV2_(job, outcome.values);
      results.push({ kind: job.kind, title: job.row[1], priority: isPriority(job), missing: due, values: outcome.values, statuses: outcome.statuses, writes: commit.writes });
      if (!preview) {
        due.forEach(key => {
          let status = outcome.statuses[key] || "retryableError";
          if (commit.retry) status = "retryableError";
          state[key] = { status: status, next: now + (status === "retryableError" ? 3600000 : 7 * 86400000) };
        });
        state.updated = now;
        try { podcastSetPropertySafeV2_(store, stateKey, JSON.stringify(state)); } catch (_) { Logger.log("Podcast backoff deferred: Properties unavailable"); }
        // Cursor points AFTER the actual row processed, not after a hypothetical batch.
        podcastSetPropertySafeV2_(store, "PODCAST_PIPELINE_CURSOR_V2", String((all.findIndex(item => item.identity === job.identity) + 1) % Math.max(all.length, 1)));
      }
    }
    if (!preview) prunePodcastPipelineStateV2_(store, now);
    return { dryRun: preview, scanned: all.length, countsByKind: {listenerPodcast: all.filter(j => j.kind === "listenerPodcast").length, podcast: all.filter(j => j.kind === "podcast").length}, processed: processed, requests: context.requests, results: results };
  } finally { podcastFetchContextV2_ = null; }
  } finally { if (lease) releasePodcastRunnerLeaseV2_(store, lease); }
}
function prunePodcastPipelineStateV2_(store, now) {
  const props = store.getProperties();
  const records = Object.keys(props).filter(key => key.indexOf("PODCAST_PIPELINE_STATE_V2_") === 0).map(key => {
    try { return { key: key, updated: JSON.parse(props[key]).updated || 0 }; } catch (_) { return { key: key, updated: 0 }; }
  }).sort((a, b) => a.updated - b.updated);
  records.forEach((record, i) => { if (now - record.updated > 30 * 86400000 || i < records.length - 200) store.deleteProperty(record.key); });
}
function podcastExactMakerV2_(actual, wanted) {
  return !!normalizeTitle(wanted || "") && normalizeTitle(actual || "") === normalizeTitle(wanted);
}
function findUniqueApplePodcastV2_(title, maker) {
  const matches = {};
  const terms = typeof podcastSearchTitleCandidates_ === "function" ? podcastSearchTitleCandidates_(title) : [title];
  for (let i = 0; i < Math.min(terms.length, 3); i++) {
    const data = fetchJson("https://itunes.apple.com/search?media=podcast&entity=podcast&limit=12&country=JP&term=" + encodeURIComponent(terms[i]));
    if (!data || !Array.isArray(data.results)) throw new Error("Apple search unavailable");
    (data.results || []).forEach(item => {
      const url = item.collectionViewUrl || item.trackViewUrl;
      if (url && podcastTitleMatchesV2_(item.collectionName || item.trackName, title) && podcastExactMakerV2_(item.artistName || item.collectionArtistName, maker)) matches[url] = item;
    });
  }
  const urls = Object.keys(matches); return urls.length === 1 ? matches[urls[0]] : null;
}
function validatePodcastColumnsV2_(sheet, kind) {
  const columns = podcastColumnMapV2_(kind);
  const allowed = {youtube:["youtube"],spotify:["spotify"],amazon:["amazon","amazonmusic"],apple:["apple","applepodcasts"],pocketcasts:["pocketcasts"],listen:["listen"],standfm:["standfm"],pody:["pody"],rss:["rss"],artwork:["画像","画像url","アートワーク","artwork","artworkurl"]};
  const headers = sheet.getRange(1, 1, 1, kind === "podcast" ? 18 : 17).getDisplayValues()[0];
  Object.keys(allowed).forEach(key => {
    const clean = String(headers[columns[key] - 1] || "").normalize("NFKC").toLowerCase().replace(/[\s._-]/g, "");
    if (allowed[key].indexOf(clean) < 0) throw new Error("Podcast column header mismatch: " + kind + " / " + key + " / " + columns[key]);
  });
  return {kind:kind, verified:true};
}
function acquirePodcastRunnerLeaseV2_(store) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return null;
  try {
    let previous = {}; try { previous = JSON.parse(store.getProperty("PODCAST_PIPELINE_LEASE_V2") || "{}"); } catch (_) {}
    if (previous.until > Date.now()) return null;
    const lease = {id: Utilities.getUuid(), until: Date.now() + 7 * 60000};
    podcastSetPropertySafeV2_(store, "PODCAST_PIPELINE_LEASE_V2", JSON.stringify(lease));
    return lease;
  } finally { lock.releaseLock(); }
}
function releasePodcastRunnerLeaseV2_(store, lease) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    let current = {}; try { current = JSON.parse(store.getProperty("PODCAST_PIPELINE_LEASE_V2") || "{}"); } catch (_) {}
    if (current.id === lease.id) store.deleteProperty("PODCAST_PIPELINE_LEASE_V2");
  } finally { lock.releaseLock(); }
}

// 確認用（書き込みなし）
function PODCAST_PREVIEW_LOG() { const r = syncPodcastMissingPlatformsV2(true); Logger.log(JSON.stringify(r).slice(0, 8000)); return r; }

// ---- PodcastPlatformSync.js ----
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
