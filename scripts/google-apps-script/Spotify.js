const SPOTIFY_USER_REDIRECT_URI =
  "https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec";
function startSpotifyUserAuth() {
  const props = PropertiesService.getScriptProperties();
  const clientId = String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  if (!clientId) {
    throw new Error("SPOTIFY_CLIENT_ID がありません");
  }

  const state = Utilities.getUuid();
  props.setProperty("SPOTIFY_OAUTH_STATE", state);

  const scopes = [
    "playlist-read-private",
    "playlist-modify-public",
    "playlist-modify-private"
  ].join(" ");

  const url =
    "https://accounts.spotify.com/authorize" +
    "?response_type=code" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&scope=" + encodeURIComponent(scopes) +
    "&redirect_uri=" + encodeURIComponent(SPOTIFY_USER_REDIRECT_URI) +
    "&state=" + encodeURIComponent(state) +
    "&show_dialog=true";

  Logger.log("Spotify認証URL:");
  Logger.log(url);

  return url;
}

function handleSpotifyUserOAuthCallback_(e) {
  const props = PropertiesService.getScriptProperties();

  const code = String(
    e && e.parameter && e.parameter.code
      ? e.parameter.code
      : ""
  ).trim();

  const state = String(
    e && e.parameter && e.parameter.state
      ? e.parameter.state
      : ""
  ).trim();

  const expectedState =
    String(props.getProperty("SPOTIFY_OAUTH_STATE") || "").trim();

  if (!code) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証エラー</h2><p>認証コードがありません。</p>"
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証エラー</h2><p>state が一致しません。</p>"
    );
  }

  const clientId =
    String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  const clientSecret =
    String(props.getProperty("SPOTIFY_CLIENT_SECRET") || "").trim();

  if (!clientId || !clientSecret) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証エラー</h2><p>Client ID / Secret がありません。</p>"
    );
  }

  const response = UrlFetchApp.fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "post",
      muteHttpExceptions: true,
      headers: {
        Authorization:
          "Basic " +
          Utilities.base64Encode(clientId + ":" + clientSecret)
      },
      payload: {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_USER_REDIRECT_URI
      }
    }
  );

  const status = response.getResponseCode();
  const body = response.getContentText();

  Logger.log("Spotify OAuth status: " + status);
  Logger.log(body);

  if (status !== 200) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証に失敗しました</h2><p>Status: " +
      status +
      "</p>"
    );
  }

  const data = JSON.parse(body);

  if (data.refresh_token) {
    props.setProperty(
      "SPOTIFY_USER_REFRESH_TOKEN",
      String(data.refresh_token)
    );
  }

  if (data.access_token) {
    CacheService.getScriptCache().put(
      "SPOTIFY_USER_ACCESS_TOKEN",
      String(data.access_token),
      Math.max(60, Number(data.expires_in || 3600) - 120)
    );
  }

  props.deleteProperty("SPOTIFY_OAUTH_STATE");

  return HtmlService.createHtmlOutput(
    "<h2>Spotify認証成功 ✅</h2>" +
    "<p>NEYITOのプレイリストを自動更新できる準備ができました。</p>" +
    "<p>この画面は閉じて大丈夫です。</p>"
  );
}
function getSpotifyUserAccessToken() {
  const cache = CacheService.getScriptCache();

  const cached =
    String(cache.get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();

  if (cached) {
    return cached;
  }

  const props = PropertiesService.getScriptProperties();

  const clientId =
    String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  const clientSecret =
    String(props.getProperty("SPOTIFY_CLIENT_SECRET") || "").trim();

  const refreshToken =
    String(
      props.getProperty("SPOTIFY_USER_REFRESH_TOKEN") || ""
    ).trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return "";
  }

  const response = UrlFetchApp.fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "post",
      muteHttpExceptions: true,
      headers: {
        Authorization:
          "Basic " +
          Utilities.base64Encode(clientId + ":" + clientSecret)
      },
      payload: {
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }
    }
  );

  if (response.getResponseCode() !== 200) {
    Logger.log(
      "Spotify refresh error: " +
      response.getContentText()
    );
    return "";
  }

  const data = JSON.parse(response.getContentText());

  const accessToken =
    String(data.access_token || "").trim();

  if (accessToken) {
    cache.put(
      "SPOTIFY_USER_ACCESS_TOKEN",
      accessToken,
      Math.max(60, Number(data.expires_in || 3600) - 120)
    );
  }

  return accessToken;
}
function getAllSpotifyPlaylistItems_(playlistId, token) {
  const allItems = [];

  let url =
    "https://api.spotify.com/v1/playlists/" +
    encodeURIComponent(playlistId) +
    "/items?market=JP&limit=100";

  while (url) {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    });

    const status = response.getResponseCode();
    Logger.log("Playlist page status: " + status);

    if (status !== 200) {
      Logger.log(response.getContentText());
      throw new Error("プレイリスト全件取得に失敗しました");
    }

    const data = JSON.parse(response.getContentText());

    if (Array.isArray(data.items)) {
      allItems.push.apply(allItems, data.items);
    }

    url = data.next ? String(data.next) : "";
  }

  return allItems;
}
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