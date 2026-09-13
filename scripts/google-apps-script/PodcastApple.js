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
