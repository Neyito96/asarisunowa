// スプレッドシート読取・重複判定補助

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

        host:
          String(
            values[i][6] || ""
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

function playlistIdForPublicRead_(url) {
  const match = String(url || "").match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  return match ? match[1] : "";
}

// Form-submitted playlists become 🌱 only after bootstrap has finished and the
// matching application row confirms incremental updates. Fixed rules keep their
// existing eligibility policy; a stale runtime rule cannot change their badge.
function isAutoUpdateRuntimeRuleGrowingV1_(rule, requestRows) {
  if (!rule || rule.enabled === false || rule.productionWriteAllowed !== true ||
      rule.bootstrapPending !== false ||
      String(rule.lifecycleStatus || "").trim().toLowerCase() !== "incremental") return false;
  const rowNumber = Number(rule.requestSheetRow);
  const rows = Array.isArray(requestRows) ? requestRows : [];
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > rows.length + 1) return false;
  const row = rows[rowNumber - 2];
  return playlistIdForPublicRead_(row[1]) === String(rule.playlistId || "").trim() &&
    String(row[7] || "").trim() === "増分自動更新";
}

function readAutoManagedPlaylistIdMap_(ss) {
  const result = {};
  // Preserve existing handling of explicitly configured, fixed playlists.
  if (typeof AUTO_PLAYLIST_RULES !== "undefined" && Array.isArray(AUTO_PLAYLIST_RULES)) {
    AUTO_PLAYLIST_RULES.forEach(function(rule) {
      if (!rule || rule.enabled === false || rule.productionWriteAllowed === false) return;
      const lifecycle = String(rule.lifecycleStatus || "").trim().toLowerCase();
      if (["requested", "audit", "paused"].indexOf(lifecycle) >= 0) return;
      const playlistId = String(rule.playlistId || "").trim();
      if (playlistId) result[playlistId] = true;
    });
  }
  const runtimeRules = typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_() : [];
  if (!runtimeRules.length) return result;
  const requestSheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!requestSheet) return result; // Fail closed for new submissions.
  const lastRow = requestSheet.getLastRow();
  const requestRows = lastRow >= 2
    ? requestSheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues() : [];
  runtimeRules.forEach(function(rule) {
    if (isAutoUpdateRuntimeRuleGrowingV1_(rule, requestRows)) {
      result[String(rule.playlistId).trim()] = true;
    }
  });
  return result;
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

  // サイト公開用: A=URL, B=タイトル, C=制作者, D=最終更新日, E=新規登録日。
  // 「楽育ち」は更新日の取得方法ではなく、実際に有効な自動更新ルールだけを示す。
  const autoManagedPlaylistIds = readAutoManagedPlaylistIdMap_(sheet.getParent());
  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        5
      )
      .getDisplayValues();

  const items =
    values
      .filter(
        r => {
          const url = String(r[0] || "").trim();
          const title = String(r[1] || "").trim();
          if (!url && !title) return false;
          if (/\bTEST\b/i.test(url) || /^[\s\u3000]*[【\[]?TEST[】\]]?/i.test(title)) return false;
          return true;
        }
      )
      .map(
        (r, i) => {
          const playlistId = playlistIdForPublicRead_(r[0]);
          return ({
          id:
            String(i + 1),
          url:
            r[0] || "",
          title:
            r[1] || "",
          maker:
            r[2] || "",
          latestDate:
            r[3] || "",
          introducedDate:
            r[4] || "",
          autoManaged:
            autoManagedPlaylistIds[playlistId] === true
          });
        }
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
        7
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
            r[5] || "",
          host:
            r[6] || ""
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
