function resolvePodcastUrl(url) {
  try {
    const cleanUrl =
      normalizePodcastInputUrl(url);

    let title = "";
    let maker = "";
    let artwork = "";
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
    if (title && (!maker || !artwork)) {
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
      provider:
        provider,
      url:
        resolvedUrl
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