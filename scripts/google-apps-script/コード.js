// ======================================================
// 朝リスの輪 API
// 朝リスト・おすすめPodcast 保存 / JSONP / 番組URL解析
// ======================================================

const SPREADSHEET_ID = "1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ";
const LOG_SHEET_NAME = "投稿受付";
const WORK_SHEET_NAME = "作業台　 ";
const PUBLIC_SHEET_NAME = "サイト公開用";
const PODCAST_SHEET_NAME = "おすすめPodcast";
const LISTENER_PODCAST_SHEET_NAME = "朝リスPodcast";

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    console.log(JSON.stringify(data));
   
    const url = String(data.url || "").trim();
    const title = String(data.title || "").trim();
    const maker = String(data.maker || "").trim();
    const comment = String(data.comment || "").trim();
    const introducedDate = String(data.introducedDate || "").trim();
    let artwork = String(data.artwork || "").trim();
    const kind = String(data.kind || "playlist").trim();
    
    const website = String(data.website || "").trim();

    if (website) return jsonResponse({ ok: true });
    if (kind === "autoUpdateRequest") {
  const updateType = String(data.updateType || "").trim();
  const inviteUrl = String(data.inviteUrl || "").trim();
  const keywords = String(data.keywords || "").trim();
  const ruleNote = String(data.ruleNote || "").trim();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);

  if (!logSheet) {
    throw new Error("投稿受付シートが見つかりません");
  }

  const memo = [
    "方式: " + updateType,
    "キーワード: " + keywords,
    "共同編集URL: " + inviteUrl,
    ruleNote ? "ルール: " + ruleNote : ""
  ].filter(Boolean).join("\n");

  logSheet.appendRow([
    new Date(),
    url,
    title,
    maker,
    "自動更新申請",
    memo
  ]);

  SpreadsheetApp.flush();

  return jsonResponse({
    ok: true,
    kind: "autoUpdateRequest",
    message: "自動更新申請を受け付けました"
  });
}
    if (!url || !title || !maker) return jsonResponse({ ok: false, error: "必須項目が不足しています" });

    if (!artwork && (kind === "podcast" || kind === "listenerPodcast")) {
      artwork = findPodcastArtworkByTitle(title);
    }

    if (kind !== "playlist" && kind !== "podcast" && kind !== "listenerPodcast") {
      return jsonResponse({ ok: false, error: "投稿の種類が正しくありません" });
    }

    const isPlaylistUrl =
      /^https:\/\/open\.spotify\.com\/playlist\//i.test(url) ||
      /^https:\/\/music\.youtube\.com\/playlist\?/i.test(url);

    const isPodcastUrl =
      /^https:\/\/open\.spotify\.com\/show\//i.test(url) ||
      /^https:\/\/open\.spotify\.com\/episode\//i.test(url) ||
      /^https:\/\/podcasts\.apple\.com\//i.test(url) ||
      /^https:\/\/music\.amazon\./i.test(url) ||
      /^https:\/\/www\.amazon\./i.test(url) ||
      /^https:\/\/listen\.style\//i.test(url) ||
      /^https:\/\/stand\.fm\//i.test(url) ||
      /^https:\/\/pca\.st\//i.test(url) ||
      /^https:\/\/pocketcasts\.com\//i.test(url) ||
      /^https:\/\/(www\.)?youtube\.com\//i.test(url) ||
      /^https:\/\/youtu\.be\//i.test(url);

    if (kind === "playlist" && !isPlaylistUrl) {
      return jsonResponse({
        ok: false,
        error: "朝リストにはSpotifyまたはYouTube MusicのプレイリストURLを入力してください"
      });
    }

    if ((kind === "podcast" || kind === "listenerPodcast") && !isPodcastUrl) {
      return jsonResponse({
        ok: false,
        error: "Podcastの番組URLを確認してください"
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);
    const workSheet = getSheetLoose(ss, WORK_SHEET_NAME);
    const podcastSheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
    const listenerPodcastSheet = getSheetLoose(ss, LISTENER_PODCAST_SHEET_NAME);

    if (!logSheet) throw new Error("投稿受付シートが見つかりません");
    if (!workSheet) throw new Error("作業台シートが見つかりません");
    if (!podcastSheet) throw new Error("おすすめPodcastシートが見つかりません");
    if (!listenerPodcastSheet) throw new Error("朝リスPodcastシートが見つかりません");

    logSheet.appendRow([
      new Date(),
      url,
      title,
      maker,
      kind === "listenerPodcast"
        ? "朝リスPodcast"
        : kind === "podcast"
        ? "おすすめPodcast"
        : "朝ポキプレイリスト",
      comment
    ]);

    const targetSheet =
      kind === "listenerPodcast"
        ? listenerPodcastSheet
        : kind === "podcast"
        ? podcastSheet
        : workSheet;

    const lastRow = targetSheet.getLastRow();

    const existingRows =
      lastRow > 1
        ? targetSheet
            .getRange(
              2,
              1,
              lastRow - 1,
              Math.max(2, targetSheet.getLastColumn())
            )
            .getDisplayValues()
        : [];

    const normalized = normalizeUrl(url);
    const normalizedTitle = normalizeTitle(title);

    const duplicateByUrl = existingRows.some(function(row) {
      return normalizeUrl(row[0]) === normalized;
    });

    const duplicateByTitle =
      kind === "podcast" || kind === "listenerPodcast"
        ? existingRows.some(function(row) {
            return normalizeTitle(row[1]) === normalizedTitle;
          })
        : false;

    let added = false;
    let duplicateReason = "";

    if (!duplicateByUrl && !duplicateByTitle) {
      if (kind === "listenerPodcast") {
        const provider = detectProvider(url);
        targetSheet.appendRow([
          url,
          title,
          maker,
          introducedDate || "",
          comment,
          provider === "Spotify" ? url : "",
          provider === "Apple Podcasts" ? url : "",
          provider === "LISTEN" ? url : "",
          provider === "stand.fm" ? url : "",
          provider === "Amazon Music" ? url : "",
          provider === "YouTube" ? url : "",
          provider && provider !== "Spotify" && provider !== "Apple Podcasts" &&
            provider !== "LISTEN" && provider !== "stand.fm" &&
            provider !== "Amazon Music" && provider !== "YouTube" ? url : "",
          artwork || ""
        ]);
      } else if (kind === "podcast") {
        targetSheet.appendRow([
          url,
          title,
          maker,
          new Date(),
          comment,
          artwork || ""
        ]);
      } else {
        targetSheet.appendRow([
          url,
          title,
          maker
        ]);
      }

      added = true;
    } else {
      duplicateReason = duplicateByTitle ? "title" : "url";
    }

    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      kind: kind,
      added: added,
      duplicateReason: duplicateReason,
      message: added ? "保存しました" : "すでに登録されています"
    });

  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function doGet(e) {

  if (e && e.parameter && e.parameter.code) {
    return handleSpotifyUserOAuthCallback_(e);
  }

  if (e && e.parameter && e.parameter.error) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証がキャンセルされました</h2>"
    );
  }

  const callback =
    e && e.parameter && e.parameter.callback
      ? String(e.parameter.callback)
      : "";

  try {
    if (callback && !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
      return jsonResponse({
        ok: false,
        error: "callback名が正しくありません"
      });
    }

    const type =
      e && e.parameter && e.parameter.type
        ? String(e.parameter.type)
        : "status";

    if (type === "status") {
      return apiResponse({
        ok: true,
        service: "asarisunowa-api",
        version: "2026.09.08-resolve12-artwork-persist"
      }, callback);
    }

    if (type === "resolve") {
      const url =
        e && e.parameter && e.parameter.url
          ? String(e.parameter.url).trim()
          : "";

      const kind =
        e && e.parameter && e.parameter.kind
          ? String(e.parameter.kind).trim()
          : "listenerPodcast";

      if (!url) {
        return apiResponse({
          ok: false,
          error: "URLを入力してください"
        }, callback);
      }

      const ssForResolve =
        SpreadsheetApp.openById(SPREADSHEET_ID);

      const targetSheetName =
        kind === "podcast"
          ? PODCAST_SHEET_NAME
          : LISTENER_PODCAST_SHEET_NAME;

      const targetSheet =
        getSheetLoose(ssForResolve, targetSheetName);

      const known =
        targetSheet
          ? findPodcastDuplicate(targetSheet, url, "")
          : null;

      if (known && known.urlMatch) {
        return apiResponse({
          ok: true,
          title: known.title,
          maker: known.maker || "",
          artwork: "",
          provider: detectProvider(url),
          duplicate: true,
          duplicateId: known.id,
          duplicateReason: "url",
          url: url
        }, callback);
      }

      const resolved =
        resolvePodcastUrl(url);

      if (resolved && resolved.ok && targetSheet) {
        const duplicate =
          findPodcastDuplicate(
            targetSheet,
            url,
            resolved.title || ""
          );

        if (duplicate) {
          resolved.duplicate = true;
          resolved.duplicateId = duplicate.id;
          resolved.duplicateReason =
            duplicate.titleMatch ? "title" : "url";
        } else {
          resolved.duplicate = false;
        }
      }

      return apiResponse(resolved, callback);
    }

    const ss =
      SpreadsheetApp.openById(SPREADSHEET_ID);

    if (type === "playlist") {
      const sheet =
        getSheetLoose(ss, PUBLIC_SHEET_NAME);

      if (!sheet) {
        throw new Error("サイト公開用シートが見つかりません");
      }

      return apiResponse(
        readPlaylistSheet(sheet),
        callback
      );
    }

    if (type === "listenerPodcast") {
      const sheet =
        getSheetLoose(
          ss,
          LISTENER_PODCAST_SHEET_NAME
        );

      if (!sheet) {
        throw new Error("朝リスPodcastシートが見つかりません");
      }

      return apiResponse(
        readListenerPodcastSheet(sheet),
        callback
      );
    }

    if (type === "podcast") {
      const sheet =
        getSheetLoose(
          ss,
          PODCAST_SHEET_NAME
        );

      if (!sheet) {
        throw new Error("おすすめPodcastシートが見つかりません");
      }

      return apiResponse(
        readPodcastSheet(sheet),
        callback
      );
    }

    return apiResponse({
      ok: false,
      error:
        "type は playlist / podcast / listenerPodcast / resolve を指定してください"
    }, callback);

  } catch (error) {
    return apiResponse({
      ok: false,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    }, callback);
  }
}

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

function findPodcastDuplicate(sheet, url, title) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        Math.max(
          2,
          sheet.getLastColumn()
        )
      )
      .getDisplayValues();

  const wantedUrl =
    normalizeUrl(url);

  const wantedTitle =
    normalizeTitle(title);

  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    const rowUrl =
      normalizeUrl(
        values[i][0] || ""
      );

    const rowTitle =
      normalizeTitle(
        values[i][1] || ""
      );

    const urlMatch =
      !!wantedUrl &&
      rowUrl === wantedUrl;

    const titleMatch =
      !!wantedTitle &&
      rowTitle === wantedTitle;

    if (
      urlMatch ||
      titleMatch
    ) {
      return {
        id:
          String(i + 1)
            .padStart(2, "0"),

        title:
          String(
            values[i][1] || ""
          ).trim(),

        maker:
          String(
            values[i][2] || ""
          ).trim(),

        urlMatch:
          urlMatch,

        titleMatch:
          titleMatch
      };
    }
  }

  return null;
}

function readPlaylistSheet(sheet) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      type: "playlist",
      count: 0,
      items: []
    };
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        4
      )
      .getDisplayValues();

  const items =
    values
      .filter(
        r =>
          r[0] ||
          r[1]
      )
      .map(
        (r, i) => ({
          id:
            String(i + 1),
          url:
            r[0] || "",
          title:
            r[1] || "",
          maker:
            r[2] || "",
          
            latestDate:
  r[3] || ""
        })
      );

  return {
    ok: true,
    type: "playlist",
    count:
      items.length,
    items:
      items
  };
}

function readListenerPodcastSheet(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      type: "listenerPodcast",
      count: 0,
      items: []
    };
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        13
      )
      .getDisplayValues();

  const items =
    values
      .filter(r => r[0] || r[1])
      .map((r, i) => ({
        id: String(i + 1),
        url: r[0] || "",
        title: r[1] || "",
        maker: r[2] || "",
        introduced: r[3] || "",
        comment: r[4] || "",
        spotify: r[5] || "",
        apple: r[6] || "",
        listen: r[7] || "",
        standfm: r[8] || "",
        amazon: r[9] || "",
        youtube: r[10] || "",
        website: r[11] || "",
        artwork: r[12] || ""
      }));

  return {
    ok: true,
    type: "listenerPodcast",
    count: items.length,
    items: items
  };
}

function readPodcastSheet(sheet) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      type: "podcast",
      count: 0,
      items: []
    };
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        6
      )
      .getDisplayValues();

  const items =
    values
      .filter(
        r =>
          r[0] ||
          r[1]
      )
      .map(
        (r, i) => ({
          id:
            String(i + 1),
          url:
            r[0] || "",
          title:
            r[1] || "",
          maker:
            r[2] || "",
          receivedAt:
            r[3] || "",
          comment:
            r[4] || "",
          artwork:
            r[5] || ""
        })
      );

  return {
    ok: true,
    type: "podcast",
    count:
      items.length,
    items:
      items
  };
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

function fetchJson(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return null;
    }

    return JSON.parse(
      res.getContentText()
    );

  } catch (_) {
    return null;
  }
}

function fetchText(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return "";
    }

    return res.getContentText();

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

function getSheetLoose(ss, wanted) {
  const exact =
    ss.getSheetByName(
      wanted
    );

  if (exact) {
    return exact;
  }

  const target =
    String(
      wanted || ""
    ).trim();

  const sheets =
    ss.getSheets();

  for (
    let i = 0;
    i < sheets.length;
    i++
  ) {
    if (
      String(
        sheets[i].getName()
      ).trim() === target
    ) {
      return sheets[i];
    }
  }

  return null;
}

function normalizeUrl(url) {
  return String(
    url || ""
  )
    .trim()
    .split("?")[0]
    .replace(
      /\/+$/,
      ""
    );
}

function normalizeTitle(title) {
  return String(
    title || ""
  )
    .toLowerCase()
    .replace(
      /[\s　・･\-—–_()（）「」『』【】\[\]！!？?：:]/g,
      ""
    )
    .trim();
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        payload
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function apiResponse(payload, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(
        callback +
        "(" +
        JSON.stringify(
          payload
        ) +
        ");"
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return jsonResponse(
    payload
  );
}

function syncIsshoShinbunPlaylist() {
  syncAutoPlaylistByPlaylistId_("4tY0lHoV8IemMBp4iTnKnl");
}

function addToyohideNewEpisode() {
  const PLAYLIST_ID = "4Ri6rxTGFimTm0KkZtKfBZ";

  // 今回見つかった #2244
  const EPISODE_URI = "spotify:episode:21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 念のため重複チェック
  const existingItems =
    getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const alreadyExists = existingItems.some(function(item) {
    return (
      item &&
      item.item &&
      item.item.uri === EPISODE_URI
    );
  });

  if (alreadyExists) {
    Logger.log("すでに登録済みです。追加しません。");
    return;
  }

  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
     encodeURIComponent(PLAYLIST_ID)+
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: [EPISODE_URI]
      })
    }
  );

  const status = res.getResponseCode();

  Logger.log("追加 status: " + status);
  Logger.log(res.getContentText());

  if (status !== 200 && status !== 201) {
    throw new Error("Spotifyへの追加に失敗しました");
  }

  Logger.log(
    "追加成功：9条があるから平和、ではない　4つの視点で考えてみた #2244"
  );
}
