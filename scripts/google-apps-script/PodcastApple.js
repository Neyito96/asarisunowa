// Apple Podcastsカタログ補完

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
