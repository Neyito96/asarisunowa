function getSpotifyAccessToken() {
  const props =
    PropertiesService.getScriptProperties();

  const clientId =
    String(
      props.getProperty("SPOTIFY_CLIENT_ID") ||
      ""
    ).trim();

  const clientSecret =
    String(
      props.getProperty("SPOTIFY_CLIENT_SECRET") ||
      ""
    ).trim();

  if (
    !clientId ||
    !clientSecret
  ) {
    return "";
  }

  const cache =
    CacheService.getScriptCache();

  const cached =
    cache.get("spotify_access_token");

  if (cached) {
    return cached;
  }

  try {
    const res =
      UrlFetchApp.fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "post",
          muteHttpExceptions: true,
          contentType:
            "application/x-www-form-urlencoded",
          payload: {
            grant_type:
              "client_credentials",
            client_id:
              clientId,
            client_secret:
              clientSecret
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 300
    ) {
      return "";
    }

    const data =
      JSON.parse(
        res.getContentText()
      );

    const token =
      String(
        data.access_token ||
        ""
      ).trim();

    if (!token) {
      return "";
    }

    const expiresIn =
      Number(
        data.expires_in ||
        3600
      );

    cache.put(
      "spotify_access_token",
      token,
      Math.max(
        60,
        Math.min(
          3500,
          expiresIn - 60
        )
      )
    );

    return token;

  } catch (_) {
    return "";
  }
}
function fetchSpotifyShowFromWebApi(showId) {
  const id =
    String(showId || "").trim();

  if (!id) {
    return null;
  }

  const token =
    getSpotifyAccessToken();

  if (!token) {
    return null;
  }

  try {
    const res =
      UrlFetchApp.fetch(
        "https://api.spotify.com/v1/shows/" +
        encodeURIComponent(id) +
        "?market=JP",
        {
          muteHttpExceptions: true,
          headers: {
            Authorization:
              "Bearer " + token,
            Accept:
              "application/json"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 300
    ) {
      return null;
    }

    const data =
      JSON.parse(
        res.getContentText()
      );

    const images =
      Array.isArray(data.images)
        ? data.images
        : [];

    const title =
      String(
        data.name ||
        ""
      ).trim();

    const artwork =
      images.length
        ? String(
            images[0].url ||
            ""
          ).trim()
        : "";

    // Spotifyは2026年2月にShowのpublisherをWeb APIから削除。
    // そのため配信者名だけは公開番組ページの埋め込みJSON/メタ情報から補完を試す。
    let maker = "";

    const publicHtml =
      fetchSpotifyText(
        "https://open.spotify.com/show/" +
        encodeURIComponent(id)
      );

    if (publicHtml) {
      maker =
        firstMeta(publicHtml, [
          /"publisherName"\s*:\s*"([^"]+)"/i,
          /"creatorName"\s*:\s*"([^"]+)"/i,
          /"authorName"\s*:\s*"([^"]+)"/i,
          /"publisher"\s*:\s*"([^"]+)"/i,
          /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i
        ]);
    }

    return {
      title: title,
      maker:
        cleanupMaker(
          decodeHtml(maker)
        ),
      artwork: artwork
    };

  } catch (_) {
    return null;
  }
}

function resolveSpotifyShow(cleanUrl) {
  const showMatch =
    String(cleanUrl || "").match(/open\.spotify\.com\/show\/([A-Za-z0-9]+)/i);

  if (!showMatch) {
    return null;
  }

  const showId =
    String(showMatch[1]);

  const canonical =
    "https://open.spotify.com/show/" + showId;

  // 最優先: Spotify公式Web API。
  // Script PropertiesのClient ID / Secretを使うため、Spotifyだけの番組でも取得できる。
  const official =
    fetchSpotifyShowFromWebApi(showId);

  if (
    official &&
    official.title
  ) {
    return {
      title:
        official.title,
      maker:
        official.maker,
      artwork:
        official.artwork
    };
  }

  // Web APIが一時的に失敗した時だけ従来の公開情報ルートへフォールバック。
  let data = null;

  // 1) Spotify公式oEmbed（正規URLをURLエンコード）
  data =
    fetchSpotifyJson(
      "https://open.spotify.com/oembed?url=" +
      encodeURIComponent(canonical)
    );

  // 2) 同じoEmbedを非エンコードURLでも試す
  if (!data || !data.title) {
    data =
      fetchSpotifyJson(
        "https://open.spotify.com/oembed?url=" +
        canonical
      );
  }

  // 3) Spotifyページから公式oEmbed URLを発見して、そのURLを使う
  let pageHtml = "";

  if (!data || !data.title) {
    pageHtml =
      fetchSpotifyText(canonical);

    if (pageHtml) {
      const discovered =
        firstMeta(pageHtml, [
          /<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["']/i,
          /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/json\+oembed["']/i
        ]);

      if (discovered) {
        data =
          fetchSpotifyJson(
            decodeHtml(discovered)
          );
      }
    }
  }

  let title =
    data
      ? String(data.title || "").trim()
      : "";

  let artwork =
    data
      ? String(data.thumbnail_url || "").trim()
      : "";

  let maker =
    data
      ? String(data.author_name || "").trim()
      : "";

  let episodeTitleHint = "";

  // show URLなのにoEmbedが最新エピソード名を返すケースがある。
  // 番組名には採用しないが、Apple Podcastsのepisode検索用の手がかりとして残す。
  if (looksLikeEpisodeTitle(title)) {
    episodeTitleHint = title;
    title = "";
    maker = "";
  }

  // 4) oEmbedが落ちた時は通常ページ / embedページをHTML解析
  if (!pageHtml) {
    pageHtml =
      fetchSpotifyText(canonical);
  }

  if (pageHtml) {
    if (!title) {
      title =
        firstMeta(pageHtml, [
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
          /<title[^>]*>([\s\S]*?)<\/title>/i
        ]);

      if (looksLikeEpisodeTitle(title)) {
        title = "";
      }
    }

    if (!artwork) {
      artwork =
        firstMeta(pageHtml, [
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
          /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
        ]);
    }

    if (!maker) {
      maker =
        firstMeta(pageHtml, [
          /"publisherName"\s*:\s*"([^"]+)"/i,
          /"creatorName"\s*:\s*"([^"]+)"/i,
          /"authorName"\s*:\s*"([^"]+)"/i,
          /"publisher"\s*:\s*"([^"]+)"/i
        ]);
    }
  }

  if (!title || !artwork || !maker) {
    const embedHtml =
      fetchSpotifyText(
        "https://open.spotify.com/embed/show/" +
        showId
      );

    if (embedHtml) {
      if (!title) {
        title =
          firstMeta(embedHtml, [
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
            /<title[^>]*>([\s\S]*?)<\/title>/i
          ]);

        if (looksLikeEpisodeTitle(title)) {
          title = "";
        }
      }

      if (!artwork) {
        artwork =
          firstMeta(embedHtml, [
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
            /"coverArt"[\s\S]{0,500}?"url"\s*:\s*"([^"]+)"/i
          ]);
      }

      if (!maker) {
        maker =
          firstMeta(embedHtml, [
            /"publisherName"\s*:\s*"([^"]+)"/i,
            /"creatorName"\s*:\s*"([^"]+)"/i,
            /"authorName"\s*:\s*"([^"]+)"/i,
            /"publisher"\s*:\s*"([^"]+)"/i
          ]);
      }
    }
  }

  // Spotifyがshow URLに対して最新エピソード名しか返さない場合、
  // Apple Podcastsのepisode検索で同じ回を見つけ、collectionNameから番組を逆引きする。
  if (!title && episodeTitleHint) {
    const fromEpisode =
      findPodcastByEpisodeTitle(
        episodeTitleHint
      );

    if (fromEpisode) {
      title =
        String(
          fromEpisode.title || ""
        ).trim();

      if (!maker) {
        maker =
          String(
            fromEpisode.maker || ""
          ).trim();
      }

      if (!artwork) {
        artwork =
          String(
            fromEpisode.artwork || ""
          ).trim();
      }
    }
  }

  title =
    cleanupTitle(
      decodeHtml(title)
    );

  if (looksLikeEpisodeTitle(title)) {
    title = "";
  }

  maker =
    cleanupMaker(
      decodeHtml(maker)
    );

  artwork =
    decodeHtml(artwork);

  if (!title) {
    return null;
  }

  // Spotify oEmbedは配信者名を返さないケースがあるので、
  // 番組名が取れた時点でApple Podcastsカタログの完全一致で補完する。
  if (!maker || !artwork) {
    const appleMeta =
      findPodcastMetadataByTitle(title);

    if (appleMeta) {
      if (!maker) {
        maker =
          String(
            appleMeta.maker || ""
          ).trim();
      }

      if (!artwork) {
        artwork =
          String(
            appleMeta.artwork || ""
          ).trim();
      }
    }
  }

  return {
    title: title,
    maker: maker,
    artwork: artwork
  };
}
function fetchSpotifyJson(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; Asarisunowa/1.0)",
            "Accept":
              "application/json, text/plain, */*",
            "Accept-Language":
              "ja,en-US;q=0.8,en;q=0.6"
          }
        }
      );

    const code =
      res.getResponseCode();

    if (
      code < 200 ||
      code >= 400
    ) {
      return null;
    }

    const body =
      res.getContentText();

    if (!body) {
      return null;
    }

    return JSON.parse(body);

  } catch (_) {
    return null;
  }
}
function fetchSpotifyText(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language":
              "ja,en-US;q=0.8,en;q=0.6"
          }
        }
      );

    const code =
      res.getResponseCode();

    if (
      code < 200 ||
      code >= 400
    ) {
      return "";
    }

    return res.getContentText();

  } catch (_) {
    return "";
  }
}