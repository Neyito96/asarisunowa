// 03_Spotify（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: SpotifyCooldown.js, SpotifyBudgetV2.js, SpotifyAuth.js, Spotify.js

// ---- SpotifyCooldown.js ----
var SPOTIFY_COOLDOWN_KEY_ = 'SPOTIFY_COOLDOWN_UNTIL';

// 待機中なら解除予定時刻（ISO）、そうでなければ ''
function spotifyCooldownUntil_() {
  var v = PropertiesService.getScriptProperties().getProperty(SPOTIFY_COOLDOWN_KEY_) || '';
  return v && new Date(v).getTime() > Date.now() ? v : '';
}

// 応答が 429 なら待機を記録して true（Retry-After が無ければ 60 秒）。
// 2026-11-20 #412: いつ・どの処理で・何秒待てと言われたかをログと SPOTIFY_COOLDOWN_LAST に残す（原因を後から確かめるため）
function spotifyCooldownNote_(response, caller) {
  if (!response || response.getResponseCode() !== 429) return false;
  var h = response.getAllHeaders() || {}, sec = Number(h['Retry-After'] || h['retry-after'] || 60) || 60;
  var until = new Date(Date.now() + Math.max(60, sec) * 1000).toISOString();
  var props = PropertiesService.getScriptProperties();
  if (until > (props.getProperty(SPOTIFY_COOLDOWN_KEY_) || '')) props.setProperty(SPOTIFY_COOLDOWN_KEY_, until);
  var rec = { event: 'spotify429', at: new Date().toISOString(), retryAfterSec: sec, until: until, caller: String(caller || '') };
  try { props.setProperty('SPOTIFY_COOLDOWN_LAST', JSON.stringify(rec)); } catch (e) {}
  Logger.log(JSON.stringify(rec));
  return true;
}

// 旧（SPOTIFY_COOLDOWN_UNTIL）・新（SPOTIFY_COOLDOWN_V2）どちらかで待機中なら解除予定（ISO）、そうでなければ ''
function spotifyAnyCooldown_() {
  var a = spotifyCooldownUntil_(), b = '';
  try { var v2 = typeof spotifyCooldownV2_ === 'function' ? spotifyCooldownV2_() : 0; if (v2 > Date.now()) b = new Date(v2).toISOString(); } catch (e) {}
  return a > b ? a : b;
}

// 定時処理の入口で使う: 待機中なら記録して true（その回は Spotify を一切呼ばずに終える）
function spotifySkipIfCooldown_(jobName) {
  var until = spotifyAnyCooldown_();
  if (!until) return false;
  Logger.log(JSON.stringify({ event: 'spotifyCooldownSkip', job: String(jobName || ''), until: until }));
  return true;
}
function SPOTIFY_COOLDOWN_STATUS() {
  var u = spotifyAnyCooldown_(), last = PropertiesService.getScriptProperties().getProperty('SPOTIFY_COOLDOWN_LAST') || '';
  Logger.log((u ? '待機中: ' + u + ' まで' : '待機なし') + (last ? ' / 直近の429: ' + last : ''));
  return u;
}

// ---- SpotifyBudgetV2.js ----
const SPOTIFY_COOLDOWN_V2_ = "SPOTIFY_COOLDOWN_V2";
let spotifyReadCacheV2_ = {};
function spotifyCooldownStateV2_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty(SPOTIFY_COOLDOWN_V2_) || "{}");
}
function spotifyCooldownV2_() { return Number(spotifyCooldownStateV2_().until || 0); }
function spotifyWaitingReportV2_() {
  return { waiting: true, reason: "SPOTIFY_429", nextAttemptAt: spotifyCooldownV2_() };
}
function spotifyRetryDelayV2_(header, attempt, now) {
  const raw = String(header == null ? "" : header).trim();
  const seconds = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
  const date = seconds === null && raw ? Date.parse(raw) : NaN;
  const requested = seconds !== null ? seconds * 1000 : Number.isFinite(date) ? Math.max(0, date - now) : 0;
  // The exponential component is capped; Retry-After is NEVER capped.
  return Math.max(requested, Math.min(3600000, 30000 * Math.pow(2, Math.min(attempt - 1, 7)))) + 1000;
}
function spotifyRecord429V2_(response, target) {
  const props = PropertiesService.getScriptProperties(), now = Date.now();
  const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
  const key = Object.keys(headers).find(function(k) { return k.toLowerCase() === "retry-after"; });
  const retryAfter = key ? String(headers[key]) : "";
  const prior = spotifyCooldownStateV2_();
  let body = {}; try { body = JSON.parse(response.getContentText()); } catch (_) {}
  const attempt = Number(prior.attempt || 0) + 1;
  const state = { until: Math.max(Number(prior.until || 0), now + spotifyRetryDelayV2_(retryAfter, attempt, now)),
    attempt: attempt, count: Number(prior.count || 0) + 1, retryAfter: retryAfter,
    reason: String(body.reason || body.error && body.error.reason || "RATE_LIMITED"), target: String(target || ""), at: now };
  props.setProperty(SPOTIFY_COOLDOWN_V2_, JSON.stringify(state));
  Logger.log(JSON.stringify({ event: "spotify429", retryAfter: retryAfter, count: state.count,
    reason: state.reason, resumeTarget: state.target, nextAttemptAt: state.until }));
  return state;
}
function spotifyLegacyFetchV2_(url, options, context) {
  if (!/^https:\/\/api\.spotify\.com\/v1\//.test(String(url))) return UrlFetchApp.fetch(url, options);
  if (spotifyCooldownV2_() > Date.now()) throw new Error("SPOTIFY_429_WAIT_UNTIL_" + spotifyCooldownV2_());
  const method = String(options && options.method || "get").toLowerCase();
  const authorization = String(options && options.headers && options.headers.Authorization || "");
  const cacheKey = authorization + "|" + url;
  if (method === "get" && spotifyReadCacheV2_[cacheKey]) {
    if (context) context.cacheHits += 1;
    return spotifyReadCacheV2_[cacheKey];
  }
  if (context && (context.calls >= context.maxCalls || Date.now() >= context.deadline)) throw new Error("THEME_BUDGET_YIELD");
  if (context) context.calls += 1;
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 429) {
    spotifyRecord429V2_(response, context && context.target || method + " " + String(url).split("?")[0]);
    if (context) context.rateLimits += 1;
    throw new Error("SPOTIFY_429_WAIT_UNTIL_" + spotifyCooldownV2_());
  }
  if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
    if (method === "get") spotifyReadCacheV2_[cacheKey] = response;
    else {
      const prefix=String(url).split("/items")[0];
      Object.keys(spotifyReadCacheV2_).forEach(function(key) { if(key.indexOf(prefix)>=0)delete spotifyReadCacheV2_[key]; });
    } // A playlist write leaves shared show/profile reads reusable.
    const prior = spotifyCooldownStateV2_();
    if (prior.attempt) {
      prior.attempt = 0;
      PropertiesService.getScriptProperties().setProperty(SPOTIFY_COOLDOWN_V2_, JSON.stringify(prior));
    }
  }
  return response;
}

// ---- SpotifyAuth.js ----
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

// ---- Spotify.js ----
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
    const basic =
      Utilities.base64Encode(
        clientId + ":" + clientSecret
      );

    const res =
      UrlFetchApp.fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "post",
          muteHttpExceptions: true,
          contentType:
            "application/x-www-form-urlencoded",
          headers: {
            Authorization:
              "Basic " + basic,
            Accept:
              "application/json"
          },
          payload: {
            grant_type:
              "client_credentials"
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
function podcastSearchTitleCandidates_(title) {
  const raw = String(title || "").trim();
  if (!raw) return [];

  const stripped = raw
    .replace(/^(?:ポッドキャスト|podcast)\s*[：:・\-—–]?\s*/i, "")
    .replace(/^[\s　「『【\[(]+|[\s　」』】\])]+$/g, "")
    .trim();

  const candidates = [];

  [raw, stripped].forEach(function(value) {
    const clean = String(value || "").trim();
    if (!clean) return;

    if (!candidates.some(function(existing) {
      return normalizeTitle(existing) === normalizeTitle(clean);
    })) {
      candidates.push(clean);
    }
  });

  return candidates;
}
function findSpotifyShowByTitle_(title, maker) {
  const terms = podcastSearchTitleCandidates_(title);
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
  if (!terms.length) return null;

  const token = getSpotifyAccessToken();
  if (!token) return null;

  const wantedTitles = terms.map(function(term) {
    return normalizeTitle(term);
  });

  for (let t = 0; t < terms.length; t++) {
    const term = terms[t];

    try {
      const res = UrlFetchApp.fetch(
        "https://api.spotify.com/v1/search?q=" +
          encodeURIComponent(term) +
          "&type=show&market=JP&limit=10",
        {
          muteHttpExceptions: true,
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json"
          }
        }
      );

      if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
        continue;
      }

      const data = JSON.parse(res.getContentText());
      const items =
        data && data.shows && Array.isArray(data.shows.items)
          ? data.shows.items
          : [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemTitle = normalizeTitle(
          item && item.name ? item.name : ""
        );

        if (wantedTitles.indexOf(itemTitle) < 0) continue;

        const external =
          item && item.external_urls && item.external_urls.spotify
            ? String(item.external_urls.spotify)
            : "";

        if (external) return external;

        if (item && item.id) {
          return "https://open.spotify.com/show/" + String(item.id);
        }
      }
    } catch (_) {
      // 次の検索候補を試す
    }
  }

  return null;
}
function fetchSpotifyEpisodeFromWebApi(episodeId) {
  const id = String(episodeId || "").trim();
  if (!id) return null;

  const token = getSpotifyAccessToken();
  if (!token) return null;

  try {
    const res = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" + encodeURIComponent(id) + "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
      return null;
    }

    const data = JSON.parse(res.getContentText());
    const show = data && data.show ? data.show : null;
    if (!show || !show.id || !show.name) return null;

    const images = Array.isArray(show.images) ? show.images : [];
    return {
      episodeTitle: String(data.name || "").trim(),
      showId: String(show.id || "").trim(),
      title: String(show.name || "").trim(),
      artwork: images.length ? String(images[0].url || "").trim() : ""
    };
  } catch (_) {
    return null;
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
