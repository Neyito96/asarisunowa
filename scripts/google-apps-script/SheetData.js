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

function isAutoPlaylistUpdateStatus_(status) {
  return String(status || "").trim().toUpperCase() === "AUTO";
}

function readPlaylistUpdateStatusMap_(workSheet) {
  const result = {};
  if (!workSheet || workSheet.getLastRow() < 2) return result;

  const lastColumn = Math.max(7, workSheet.getLastColumn());
  const headers = workSheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function(value) { return String(value || "").trim(); });
  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const statusCol = findPlaylistUpdateStatusColumn_(headers);
  if (urlCol < 0 || statusCol < 0) return result;

  const rows = workSheet.getRange(2, 1, workSheet.getLastRow() - 1, lastColumn).getDisplayValues();
  rows.forEach(function(row) {
    const playlistId = playlistIdForPublicRead_(row[urlCol]);
    if (!playlistId) return;
    result[playlistId] = String(row[statusCol] || "").trim();
  });
  return result;
}

function readPlaylistSheet(sheet, workSheet) {
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
  // AUTO判定は作業台の「更新日取得状況／更新日取得方法」をURLで安全に照合する。
  const updateStatusByPlaylistId = readPlaylistUpdateStatusMap_(workSheet);
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
          const updateStatus = updateStatusByPlaylistId[playlistIdForPublicRead_(r[0])] || "";
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
          updateStatus:
            updateStatus,
          autoManaged:
            isAutoPlaylistUpdateStatus_(updateStatus)
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
