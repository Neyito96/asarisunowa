// Podcast URL解析・番組メタデータ取得補助

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
            ).trim()
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
