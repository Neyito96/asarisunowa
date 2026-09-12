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

function testSpotifyApi() {
  const props = PropertiesService.getScriptProperties();

  const clientId =
    String(props.getProperty("SPOTIFY_CLIENT_ID") || "").trim();

  const clientSecret =
    String(props.getProperty("SPOTIFY_CLIENT_SECRET") || "").trim();

  Logger.log("Client ID exists: " + Boolean(clientId));
  Logger.log("Client Secret exists: " + Boolean(clientSecret));
  Logger.log("Client ID length: " + clientId.length);
  Logger.log("Client Secret length: " + clientSecret.length);

  if (!clientId || !clientSecret) {
    Logger.log("ERROR: Script Properties are missing.");
    return;
  }

  const tokenResponse =
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

  Logger.log("Token status: " + tokenResponse.getResponseCode());

  if (tokenResponse.getResponseCode() !== 200) {
    Logger.log("Token error: " + tokenResponse.getContentText());
    return;
  }

  const tokenData =
    JSON.parse(tokenResponse.getContentText());

  const token =
    tokenData.access_token;

  Logger.log("Token acquired: " + Boolean(token));

  const showId =
    "7dDe6pPYCdUUDQ2AL40xtE";

  const showResponse =
    UrlFetchApp.fetch(
      "https://api.spotify.com/v1/shows/" +
      showId +
      "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization:
            "Bearer " + token
        }
      }
    );

  Logger.log("Show status: " + showResponse.getResponseCode());

  if (showResponse.getResponseCode() === 200) {
    const show =
      JSON.parse(showResponse.getContentText());

    Logger.log("Show name: " + show.name);
    Logger.log("Publisher: " + show.publisher);
    Logger.log(
      "Artwork exists: " +
      Boolean(show.images && show.images.length)
    );
  } else {
    Logger.log("Show error: " + showResponse.getContentText());
  }
}
function testSyncIsshoShinbunPlaylist() {
  const SHOW_ID = "392h0MYfvMTndEVzf2cOvC";
  const PLAYLIST_ID = "4tY0lHoV8IemMBp4iTnKnl";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotify access token を取得できませんでした");
  }

  // 公式Showの新着エピソードを取得
  const showRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(SHOW_ID) +
      "/episodes?market=JP&limit=50",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("Show status: " + showRes.getResponseCode());

  if (showRes.getResponseCode() !== 200) {
    Logger.log(showRes.getContentText());
    throw new Error("公式Showの取得に失敗しました");
  }

  const showData = JSON.parse(showRes.getContentText());
  const episodes = Array.isArray(showData.items) ? showData.items : [];

  // 追加先プレイリストの現在の中身を取得
 
const playlistItems = getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);
  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  // 最近の「（めくろう）」回だけ候補にする
  const candidates = episodes.filter(function(ep) {
    const name = String(ep && ep.name ? ep.name : "");
    return /[（(]めくろう[）)]/.test(name);
  });

  Logger.log("公式Show取得件数: " + episodes.length);
  Logger.log("プレイリスト取得件数: " + playlistItems.length);
  Logger.log("めくろう候補件数: " + candidates.length);

  candidates.forEach(function(ep) {
    const uri = String(ep.uri || "");
    const exists = existingUris.has(uri);

    Logger.log(
      (exists ? "既存 ✅ " : "未登録 ➕ ") +
      ep.name +
      " | " +
      uri
    );
  });

  Logger.log("※ この関数は確認専用です。追加・削除はしていません。");
}


function syncIsshoShinbunPlaylist() {
  const SHOW_ID = "392h0MYfvMTndEVzf2cOvC";
  const PLAYLIST_ID = "4tY0lHoV8IemMBp4iTnKnl";

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 公式Showの最近50件を取得
  const showRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(SHOW_ID) +
      "/episodes?market=JP&limit=50",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  if (showRes.getResponseCode() !== 200) {
    Logger.log(showRes.getContentText());
    throw new Error("公式Showの取得に失敗しました");
  }

  const showData = JSON.parse(showRes.getContentText());
  const episodes = Array.isArray(showData.items)
    ? showData.items
    : [];

  // プレイリストを全件取得
  const playlistItems =
    getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  // 最近の（めくろう）回だけ対象
  const candidates = episodes.filter(function(ep) {
    const name = String(ep && ep.name ? ep.name : "");
    return /[（(]めくろう[）)]/.test(name);
  });

  // まだ入っていないものだけ
  const newEpisodes = candidates.filter(function(ep) {
    const uri = String(ep && ep.uri ? ep.uri : "");
    return uri && !existingUris.has(uri);
  });

  Logger.log("めくろう候補: " + candidates.length);
  Logger.log("新規追加候補: " + newEpisodes.length);

  if (!newEpisodes.length) {
    Logger.log("追加なし。すべて登録済みです ✅");
    return;
  }

  const uris = newEpisodes.map(function(ep) {
    return String(ep.uri);
  });

  const addRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(PLAYLIST_ID) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: uris
      })
    }
  );

  Logger.log("Add status: " + addRes.getResponseCode());
  Logger.log(addRes.getContentText());

  if (
    addRes.getResponseCode() !== 200 &&
    addRes.getResponseCode() !== 201
  ) {
    throw new Error("Spotifyプレイリストへの追加に失敗しました");
  }

  newEpisodes.forEach(function(ep) {
    Logger.log("追加完了 ✅ " + ep.name);
  });
}

function testPlaylistLatestDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheets().find(function(s) {
    return String(s.getName()).trim() === "作業台";
  });

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const values = sheet.getDataRange().getValues();

  const headers = values[0].map(function(v) {
    return String(v || "").trim();
  });

  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const profileCol = headers.indexOf("プロフィール");
  const latestCol = headers.indexOf("最終更新日");

  if (
    urlCol < 0 ||
    titleCol < 0 ||
    profileCol < 0 ||
    latestCol < 0
  ) {
    throw new Error("必要な列見出しが見つかりません");
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できません");
  }

  let checked = 0;

  for (let i = 1; i < values.length && checked < 10; i++) {
    const url = String(values[i][urlCol] || "").trim();
    const title = String(values[i][titleCol] || "").trim();
    const profile = String(values[i][profileCol] || "").trim();

    // NEYITO管理、または共同編集URLがあるプレイリストを試す
const collaboratorUrl = String(values[i][3] || "").trim();

const shouldTry =
  profile.toUpperCase() === "NEYITO" ||
  Boolean(collaboratorUrl);

if (!shouldTry) {
  continue;
}

    if (!url || !/open\.spotify\.com\/playlist\//i.test(url)) {
      continue;
    }

    const match = url.match(
      /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
    );

    if (!match) continue;

    const playlistId = match[1];

    try {
      const items = getAllSpotifyPlaylistItems_(playlistId, token);

      let latestAddedAt = "";

      items.forEach(function(row) {
        const addedAt =
          row && row.added_at
            ? String(row.added_at)
            : "";

        if (
          addedAt &&
          (!latestAddedAt || addedAt > latestAddedAt)
        ) {
          latestAddedAt = addedAt;
        }
      });

      const latestDate =
        latestAddedAt
          ? latestAddedAt.slice(0, 10)
          : "";

      Logger.log(
        title +
        " | 件数: " + items.length +
        " | 最終更新: " +
        (latestDate || "取得できず")
      );

    } catch (err) {
      Logger.log(
        title +
        " | スキップ: " +
        String(err)
      );
    }

    checked++;
  }

  Logger.log("※確認専用。シートには書き込んでいません。");
}
function updatePlaylistLatestDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheets().find(function(s) {
    return String(s.getName()).trim() === "作業台";
  });

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const values = sheet.getDataRange().getValues();

  const headers = values[0].map(function(v) {
    return String(v || "").trim();
  });

  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const profileCol = headers.indexOf("プロフィール");
  const latestCol = headers.indexOf("最終更新日");

  if (
    urlCol < 0 ||
    titleCol < 0 ||
    profileCol < 0 ||
    latestCol < 0
  ) {
    throw new Error("必要な列見出しが見つかりません");
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できません");
  }

  for (let i = 1; i < values.length; i++) {
    const url = String(values[i][urlCol] || "").trim();
    const title = String(values[i][titleCol] || "").trim();
    const profile = String(values[i][profileCol] || "").trim();

    // NEYITO管理プレイリストだけ自動更新
   const collaboratorUrl = String(values[i][3] || "").trim();

const shouldTry =
  profile.toUpperCase() === "NEYITO" ||
  Boolean(collaboratorUrl);

if (!shouldTry) {
  continue;
}

    if (!url || !/open\.spotify\.com\/playlist\//i.test(url)) {
      continue;
    }

    const match = url.match(
      /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
    );

    if (!match) continue;

    const playlistId = match[1];

    try {
      const items = getAllSpotifyPlaylistItems_(playlistId, token);

      let latestAddedAt = "";

      items.forEach(function(row) {
        const addedAt =
          row && row.added_at
            ? String(row.added_at)
            : "";

        if (
          addedAt &&
          (!latestAddedAt || addedAt > latestAddedAt)
        ) {
          latestAddedAt = addedAt;
        }
      });

      const latestDate =
        latestAddedAt
          ? latestAddedAt.slice(0, 10)
          : "";

      if (latestDate) {
  // F列：最終更新日
  sheet
    .getRange(i + 1, latestCol + 1)
    .setValue(latestDate);

  // 「更新日取得方法」列を見出し名から探して AUTO と記録
  const methodCol = headers.indexOf("更新日取得方法");

  if (methodCol >= 0) {
    sheet
      .getRange(i + 1, methodCol + 1)
      .setValue("AUTO");
  }
        Logger.log(
          "更新 ✅ " +
          title +
          " → " +
          latestDate
        );
      } else {
        Logger.log(
          "日付取得できず: " + title
        );
      }

    } catch (err) {
      Logger.log(
        "スキップ: " +
        title +
        " | " +
        String(err)
      );
    }
  }

  Logger.log("最終更新日の書き込み完了");
}
function scanBlankPlaylistDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheets().find(function(s) {
    return String(s.getName()).trim() === "作業台";
  });

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const values = sheet.getDataRange().getValues();

  const headers = values[0].map(function(v) {
    return String(v || "").trim();
  });

  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const latestCol = headers.indexOf("最終更新日");
  const methodCol = headers.indexOf("更新日取得方法");

  if (
    urlCol < 0 ||
    titleCol < 0 ||
    latestCol < 0 ||
    methodCol < 0
  ) {
    throw new Error("必要な列見出しが見つかりません");
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できません");
  }

  let autoCount = 0;
  let checkCount = 0;
  let excludedCount = 0;

  for (let i = 1; i < values.length; i++) {
    const url = String(values[i][urlCol] || "").trim();
    const title = String(values[i][titleCol] || "").trim();
    const method = String(values[i][methodCol] || "").trim();

    // すでに処理済みなら触らない
    if (method) {
      continue;
    }

    // Spotifyプレイリスト以外
    if (!url || !/open\.spotify\.com\/playlist\//i.test(url)) {
      sheet.getRange(i + 1, methodCol + 1).setValue("対象外");
      Logger.log("対象外: " + title);
      excludedCount++;
      continue;
    }

    const match = url.match(
      /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
    );

    if (!match) {
      sheet.getRange(i + 1, methodCol + 1).setValue("対象外");
      excludedCount++;
      continue;
    }

    const playlistId = match[1];

    try {
      const items = getAllSpotifyPlaylistItems_(playlistId, token);

      let latestAddedAt = "";

      items.forEach(function(row) {
        const addedAt =
          row && row.added_at
            ? String(row.added_at)
            : "";

        if (
          addedAt &&
          (!latestAddedAt || addedAt > latestAddedAt)
        ) {
          latestAddedAt = addedAt;
        }
      });

      const latestDate =
        latestAddedAt
          ? latestAddedAt.slice(0, 10)
          : "";

      if (latestDate) {
        sheet
          .getRange(i + 1, latestCol + 1)
          .setValue(latestDate);

        sheet
          .getRange(i + 1, methodCol + 1)
          .setValue("AUTO");

        Logger.log(
          "AUTO ✅ " +
          title +
          " → " +
          latestDate
        );

        autoCount++;
      } else {
        sheet
          .getRange(i + 1, methodCol + 1)
          .setValue("要確認");

        Logger.log("要確認: " + title);
        checkCount++;
      }

    } catch (err) {
      sheet
        .getRange(i + 1, methodCol + 1)
        .setValue("要確認");

      Logger.log(
        "要確認: " +
        title +
        " | " +
        String(err)
      );

      checkCount++;
    }
  }

  Logger.log(
    "完了 AUTO=" + autoCount +
    " / 要確認=" + checkCount +
    " / 対象外=" + excludedCount
  );
}
function testSpeakerSearch() {
  const KEYWORD = "豊秀一";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const searchRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/search?" +
      "q=" + encodeURIComponent(KEYWORD) +
      "&type=episode&market=JP&limit=10",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("Search status: " + searchRes.getResponseCode());

  if (searchRes.getResponseCode() !== 200) {
    Logger.log(searchRes.getContentText());
    throw new Error("Spotify検索に失敗しました");
  }

  const data = JSON.parse(searchRes.getContentText());
  const episodes =
    data &&
    data.episodes &&
    Array.isArray(data.episodes.items)
      ? data.episodes.items
      : [];
episodes.forEach(function(ep, index) {
  Logger.log(
    "検索結果" + (index + 1) + ": " +
    String(ep.name || "") +
    " | " +
    String(ep.description || "").substring(0, 150)
     );
});
  const matches = episodes.filter(function(ep) {
    const text = [
      ep && ep.name ? ep.name : "",
      ep && ep.description ? ep.description : "",
      ep && ep.html_description ? ep.html_description : ""
    ].join(" ");

    return text.indexOf(KEYWORD) >= 0;
  });

  Logger.log("検索取得件数: " + episodes.length);
  Logger.log("豊秀一一致件数: " + matches.length);

  matches.forEach(function(ep, index) {
    Logger.log(
      (index + 1) +
      ". " +
      ep.name +
      " | " +
      (ep.release_date || "") +
      " | " +
      (ep.external_urls && ep.external_urls.spotify
        ? ep.external_urls.spotify
        : "")
    );
  });

  Logger.log("※確認専用です。プレイリストへの追加はしていません。");
}
function testOfficialShows() {
  const SHOW_IDS = [
    "7euH6hzudIdp61JRSi9E8w",
    "0341I5UOUrJgm7KEvNGInZ",
    "0yhef9ORZkUZs9ZeotdCSY",
    "392h0MYfvMTndEVzf2cOvC",
    "5Dt1uyQaJpM6hPV8aEMP3R",
    "1KExdSsjQnatS4TdseGoC0",
    "2uG9W6CnsaNi87AfSuGe8r"
  ];

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  SHOW_IDS.forEach(function(showId) {
    const res = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/shows/" +
        encodeURIComponent(showId) +
        "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    if (res.getResponseCode() !== 200) {
      Logger.log(
        "取得失敗: " +
        showId +
        " | status=" +
        res.getResponseCode() +
        " | " +
        res.getContentText()
      );
      return;
    }

    const show = JSON.parse(res.getContentText());

    Logger.log(
      show.name +
        " | " +
        showId +
        " | episodes=" +
        (show.total_episodes || "")
    );
  });
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
function testToyohideEpisodeInfo() {
  const EPISODE_ID = "21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();

  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/episodes/" +
      encodeURIComponent(EPISODE_ID) +
      "?market=JP",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("status: " + res.getResponseCode());

  const ep = JSON.parse(res.getContentText());

  Logger.log("name: " + ep.name);
  Logger.log("uri: " + ep.uri);
  Logger.log(
    "url: " +
      (ep.external_urls && ep.external_urls.spotify
        ? ep.external_urls.spotify
        : "")
  );
}
function testFind2244Uri() {
  const SHOW_ID = "392h0MYfvMTndEVzf2cOvC";
  const token = getSpotifyUserAccessToken();

  let nextUrl =
    "https://api.spotify.com/v1/shows/" +
    SHOW_ID +
    "/episodes?market=JP&limit=50";

  while (nextUrl) {
    const res = UrlFetchApp.fetch(nextUrl, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    });

    const data = JSON.parse(res.getContentText());
    const episodes = Array.isArray(data.items) ? data.items : [];

    for (const ep of episodes) {
      if (String(ep.name || "").indexOf("#2244") >= 0) {
        Logger.log("name: " + ep.name);
        Logger.log("id: " + ep.id);
        Logger.log("uri: " + ep.uri);
        Logger.log("href: " + ep.href);
        Logger.log(
          "url: " +
          (ep.external_urls && ep.external_urls.spotify
            ? ep.external_urls.spotify
            : "")
        );
        return;
      }
    }

    nextUrl = data.next || null;
  }

  Logger.log("#2244 が見つかりませんでした");
}
function addToyohideNewEpisodeQueryTest() {
  const PLAYLIST_ID = "4Ri6rxTGFimTm0KkZtKfBZ";
  const EPISODE_URI = "spotify:episode:21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 重複チェック
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

  const url =
    "https://api.spotify.com/v1/playlists/" +
    encodeURIComponent(PLAYLIST_ID) +
    "/items?uris=" +
    encodeURIComponent(EPISODE_URI);

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  });

  Logger.log("追加 status: " + res.getResponseCode());
  Logger.log(res.getContentText());

  if (
    res.getResponseCode() !== 200 &&
    res.getResponseCode() !== 201
  ) {
    throw new Error("Spotifyへの追加に失敗しました");
  }

  Logger.log("追加成功：#2244");
}
function testCreatePlaylistAndAdd2244() {
  const EPISODE_URI = "spotify:episode:21Bx1Naz0iJebxLUWPD8yV";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 1. 自分のSpotifyユーザーIDを取得
  const meRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/me",
    {
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  Logger.log("me status: " + meRes.getResponseCode());

  if (meRes.getResponseCode() !== 200) {
    Logger.log(meRes.getContentText());
    throw new Error("Spotifyユーザー情報の取得に失敗しました");
  }

  const me = JSON.parse(meRes.getContentText());
  Logger.log("user: " + me.display_name);
  Logger.log("userId: " + me.id);

  // 2. 非公開テストプレイリストを作成
  const createRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/me/playlists",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        name: "朝リス自動更新 APIテスト",
        description: "Spotify API動作確認用。削除可。",
        public: false
      })
    }
  );

  Logger.log(
    "playlist create status: " +
    createRes.getResponseCode()
  );

  Logger.log(createRes.getContentText());

  if (
    createRes.getResponseCode() !== 200 &&
    createRes.getResponseCode() !== 201
  ) {
    throw new Error("テストプレイリスト作成に失敗しました");
  }

  const playlist =
    JSON.parse(createRes.getContentText());

  Logger.log("作成成功: " + playlist.name);
  Logger.log("playlistId: " + playlist.id);

  // 3. 作ったばかりのプレイリストへ #2244 を追加
  const addRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(playlist.id) +
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

  Logger.log(
    "episode add status: " +
    addRes.getResponseCode()
  );

  Logger.log(addRes.getContentText());

  if (
    addRes.getResponseCode() === 200 ||
    addRes.getResponseCode() === 201
  ) {
    Logger.log("★★ #2244 追加成功 ★★");
  } else {
    Logger.log("★★ #2244 追加失敗 ★★");
  }
}
function testAddMusicTrack() {
  const PLAYLIST_ID = "7xR7H5e5ZcQ5pL87ZcicPj";

  // Spotify公式ドキュメントの例にある音楽Track URI
  const TRACK_URI = "spotify:track:4iV5W9uYEdYUVa79Axb7Rh";

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(PLAYLIST_ID) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: [TRACK_URI]
      })
    }
  );

  Logger.log("track add status: " + res.getResponseCode());
  Logger.log(res.getContentText());

  if (
    res.getResponseCode() === 200 ||
    res.getResponseCode() === 201
  ) {
    Logger.log("★★ 音楽Track追加成功 ★★");
  } else {
    Logger.log("★★ 音楽Track追加失敗 ★★");
  }
}
function testGetMekurouEpisodeUri() {
  const PLAYLIST_ID = AUTO_PLAYLIST_RULES[0].playlistId;

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const items = getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  for (const item of items) {
    const ep = item && item.item ? item.item : null;

    if (
      ep &&
      ep.uri &&
      String(ep.uri).indexOf("spotify:episode:") === 0
    ) {
      Logger.log("name: " + ep.name);
      Logger.log("uri: " + ep.uri);
      Logger.log(
        "url: " +
        (ep.external_urls && ep.external_urls.spotify
          ? ep.external_urls.spotify
          : "")
      );
      return;
    }
  }

  Logger.log("episodeが見つかりませんでした");
}
function testAddKnownEpisode() {
  const SOURCE_PLAYLIST_ID = AUTO_PLAYLIST_RULES[0].playlistId;
  const TEST_PLAYLIST_ID = "7xR7H5e5ZcQ5pL87ZcicPj";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  // 「一緒に新聞をめくろう！」から実在episodeを1本取得
  const items = getAllSpotifyPlaylistItems_(
    SOURCE_PLAYLIST_ID,
    token
  );

  const episodeItem = items.find(function(item) {
    return (
      item &&
      item.item &&
      item.item.uri &&
      String(item.item.uri).indexOf("spotify:episode:") === 0
    );
  });

  if (!episodeItem) {
    throw new Error("テスト用episodeが見つかりませんでした");
  }

  const episode = episodeItem.item;

  Logger.log("テストepisode: " + episode.name);
  Logger.log("URI: " + episode.uri);

  // テストプレイリストへ追加
  const res = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(TEST_PLAYLIST_ID) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        uris: [episode.uri]
      })
    }
  );

  Logger.log("known episode add status: " + res.getResponseCode());
  Logger.log(res.getContentText());

  if (
    res.getResponseCode() === 200 ||
    res.getResponseCode() === 201
  ) {
    Logger.log("★★ 既存episode追加成功 ★★");
  } else {
    Logger.log("★★ 既存episode追加失敗 ★★");
  }
}
function testCompareEpisodes() {
  const IDS = [
    {
      label: "#2244",
      id: "21Bx1Naz0iJebxLUWPD8yV"
    },
    {
      label: "#980",
      id: "1CyMwuqTxKU0XKMSZfMqut"
    }
  ];

  const token = getSpotifyUserAccessToken();

  IDS.forEach(function(x) {
    const res = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" +
        encodeURIComponent(x.id) +
        "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    Logger.log(
      x.label +
      " status: " +
      res.getResponseCode()
    );

    Logger.log(res.getContentText());
  });
}

function updatePlaylistLatestDate_(playlistId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 更新元は「作業台」
  const sheet = getSheetLoose(ss, "作業台");

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error("作業台シートにデータがありません");
  }

  // 作業台 A〜F列を取得
  const values = sheet
    .getRange(2, 1, lastRow - 1, 6)
    .getDisplayValues();

  // A列のSpotifyプレイリストURLから対象を探す
  const targetRowIndex = values.findIndex(function(row) {
    const url = String(row[0] || "");
    return url.indexOf(playlistId) >= 0;
  });

  if (targetRowIndex < 0) {
    throw new Error(
      "対象プレイリストが作業台に見つかりません: " +
      playlistId
    );
  }

  const rowNumber = targetRowIndex + 2;

  const today = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

  // 作業台 F列 = 最終更新日
  sheet.getRange(rowNumber, 6).setValue(today);

  Logger.log(
    "更新日反映 ✅ 作業台 row=" +
    rowNumber +
    " date=" +
    today
  );
}
function testUpdateToyohideLatestDate() {
  updatePlaylistLatestDate_(
    "4Ri6rxTGFimTm0KkZtKfBZ"
  );
}