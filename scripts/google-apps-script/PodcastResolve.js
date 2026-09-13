// Spotify episode URLから番組情報へ解決

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
