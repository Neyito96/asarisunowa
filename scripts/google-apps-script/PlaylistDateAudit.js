function diagnoseThreePlaylistDatesReadOnly() {
  const targets = [
    { name: "太田匡彦", id: "7jLXrZ0JUNOnsSeFEFbw9S" },
    { name: "豊秀一", id: "4Ri6rxTGFimTm0KkZtKfBZ" },
    { name: "南米 中南米", id: "2Org6cCBgVas4d9OwzzxAv" }
  ];

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証失敗");

  const sheet = getSheetLoose(
    SpreadsheetApp.openById(SPREADSHEET_ID),
    "作業台"
  );
  if (!sheet) throw new Error("作業台が見つかりません");

  const rows = sheet.getDataRange().getDisplayValues();

  const result = targets.map(function(target) {
    const matchingRows = rows.map(function(row, i) {
      return { row: row, rowNumber: i + 1 };
    }).filter(function(entry) {
      return String(entry.row[0] || "").indexOf(target.id) >= 0;
    });

    const items = getAllSpotifyPlaylistItems_(
      target.id, token
    );

    const episodes = items.map(function(row) {
      return row && (row.item || row.track);
    }).filter(Boolean);

    const dated = episodes.filter(function(ep) {
      return /^\d{4}-\d{2}-\d{2}$/.test(
        String(ep.release_date || "")
      );
    }).sort(function(a, b) {
      return b.release_date.localeCompare(a.release_date);
    });

    return {
      name: target.name,
      playlistId: target.id,
      sheetMatches: matchingRows.map(function(entry) {
        return {
          rowNumber: entry.rowNumber,
          currentDateF: entry.row[5],
          registeredDateH: entry.row[7]
        };
      }),
      playlistCount: items.length,
      episodesWithReleaseDate: dated.length,
      latestDateFromPlaylistResponse:
        dated.length ? dated[0].release_date : null,
      latestTitleFromPlaylistResponse:
        dated.length ? dated[0].name : null,
      sampleEpisodeIds: episodes.slice(0, 3).map(function(ep) {
        return {
          id: ep.id,
          title: ep.name,
          releaseDate: ep.release_date || null
        };
      })
    };
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function testThreePlaylistEpisodeDatesReadOnly() {
  const targets = [
    { name: "太田匡彦", id: "7jLXrZ0JUNOnsSeFEFbw9S" },
    { name: "豊秀一", id: "4Ri6rxTGFimTm0KkZtKfBZ" },
    { name: "南米 中南米", id: "2Org6cCBgVas4d9OwzzxAv" }
  ];

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証失敗");

  const results = targets.map(function(target) {
    const items = getAllSpotifyPlaylistItems_(target.id, token);

    const first = items.map(function(row) {
      return row && (row.item || row.track);
    }).find(function(ep) {
      return ep && ep.id;
    });

    if (!first) throw new Error(target.name + "：エピソードなし");

    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" +
      encodeURIComponent(first.id) + "?market=JP",
      {
        method: "get",
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error(target.name + "：取得失敗 status=" + status);
    }

    const ep = JSON.parse(response.getContentText());

    return {
      name: target.name,
      id: ep.id,
      title: ep.name,
      releaseDate: ep.release_date,
      datePrecision: ep.release_date_precision,
      httpStatus: status
    };
  });

  Logger.log(JSON.stringify(results, null, 2));
}
function auditThreePlaylistDatesBatch() {
  const targets = [
    {name:"太田匡彦", id:"7jLXrZ0JUNOnsSeFEFbw9S"},
    {name:"豊秀一", id:"4Ri6rxTGFimTm0KkZtKfBZ"},
    {name:"南米 中南米", id:"2Org6cCBgVas4d9OwzzxAv"}
  ];

  const token = getSpotifyUserAccessToken();
  const result = [];

  targets.forEach(function(target) {
    const items = getAllSpotifyPlaylistItems_(target.id, token);
    const episodes = items.map(function(row) {
      return row && (row.item || row.track);
    }).filter(function(ep) {
      return ep && ep.id;
    });

    let latest = null;
    let checked = 0;

    episodes.forEach(function(ep) {
      const response = UrlFetchApp.fetch(
        "https://api.spotify.com/v1/episodes/" +
        encodeURIComponent(ep.id) + "?market=JP",
        {
          muteHttpExceptions: true,
          headers: {Authorization:"Bearer " + token}
        }
      );

      if (response.getResponseCode() !== 200) {
        throw new Error(
          target.name + " 取得失敗: " + ep.id
        );
      }

      const detail = JSON.parse(response.getContentText());
      checked++;

      if (!latest ||
          detail.release_date > latest.releaseDate) {
        latest = {
          id: detail.id,
          title: detail.name,
          releaseDate: detail.release_date
        };
      }
    });

    result.push({
      name: target.name,
      playlistCount: episodes.length,
      checked: checked,
      latest: latest
    });
  });

  Logger.log(JSON.stringify(result, null, 2));
}
function verifyThreePlaylistCountsReadOnly() {
  const targets = [
    { name: "太田匡彦", id: "7jLXrZ0JUNOnsSeFEFbw9S" },
    { name: "豊秀一", id: "4Ri6rxTGFimTm0KkZtKfBZ" },
    { name: "南米 中南米", id: "2Org6cCBgVas4d9OwzzxAv" }
  ];

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証失敗");

  const results = targets.map(function(target) {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" +
      target.id + "/items?market=JP&limit=100",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error(target.name + " status=" + status);
    }

    const data = JSON.parse(response.getContentText());
    const all = getAllSpotifyPlaylistItems_(target.id, token);

    const ids = all.map(function(row) {
      const ep = row && (row.item || row.track);
      return String(ep && ep.id || "");
    }).filter(Boolean);

    return {
      name: target.name,
      httpStatus: status,
      spotifyTotal: data.total,
      firstPageCount: (data.items || []).length,
      fetchedCount: all.length,
      validIds: ids.length,
      uniqueIds: new Set(ids).size,
      hasNextPage: Boolean(data.next)
    };
  });

  Logger.log(JSON.stringify(results, null, 2));
}
function inspectMissingEpisodeIdsReadOnly() {
  const targets = [
    { name: "太田匡彦", id: "7jLXrZ0JUNOnsSeFEFbw9S" },
    { name: "豊秀一", id: "4Ri6rxTGFimTm0KkZtKfBZ" }
  ];

  const token = getSpotifyUserAccessToken();

  targets.forEach(function(target) {
    const items = getAllSpotifyPlaylistItems_(target.id, token);

    const missing = [];

    items.forEach(function(row, index) {
      const ep = row && (row.item || row.track);

      if (ep && ep.id) return;

      missing.push({
        position: index + 1,
        rowIsNull: row === null,
        rowKeys: row ? Object.keys(row) : [],
        itemIsNull: ep == null,
        itemType: ep ? ep.type || null : null,
        itemName: ep ? ep.name || null : null,
        itemUri: ep ? ep.uri || null : null,
        itemId: ep ? ep.id || null : null,
        isLocal: row ? row.is_local || false : false,
        addedAt: row ? row.added_at || null : null
      });
    });

    Logger.log(JSON.stringify({
      name: target.name,
      total: items.length,
      missingCount: missing.length,
      missing: missing
    }, null, 2));
  });
}
function fixTwoPlaylistDatesOnce() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, "作業台");

  const targets = [
    {
      row: 15,
      playlistId: "7jLXrZ0JUNOnsSeFEFbw9S",
      before: "2026-09-15",
      after: "2026-09-09"
    },
    {
      row: 51,
      playlistId: "4Ri6rxTGFimTm0KkZtKfBZ",
      before: "2026-09-11",
      after: "2026-05-15"
    }
  ];

  // 変更前に全条件を検証。1件でも異なれば書き込まない。
  targets.forEach(function(t) {
    const url = String(
      sheet.getRange(t.row, 1).getDisplayValue()
    );

    const current = String(
      sheet.getRange(t.row, 6).getDisplayValue()
    ).replace(/\//g, "-");

    if (url.indexOf(t.playlistId) < 0 ||
        current !== t.before) {
      throw new Error(
        "変更中止：行 " + t.row +
        " のIDまたは現在の日付が一致しません。" +
        " current=" + current
      );
    }
  });

  targets.forEach(function(t) {
    sheet.getRange(t.row, 6).setValue(t.after);
  });

  SpreadsheetApp.flush();

  Logger.log(JSON.stringify(
    targets.map(function(t) {
      return {
        row: t.row,
        newDate: sheet.getRange(t.row, 6).getDisplayValue()
      };
    }),
    null,
    2
  ));
}
function diagnosePublicDateMismatchReadOnly() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const work = getSheetLoose(ss, "作業台");
  const pub = getSheetLoose(ss, "サイト公開用");

  if (!work || !pub) {
    throw new Error("必要なシートが見つかりません");
  }

  const targets = [
    "7jLXrZ0JUNOnsSeFEFbw9S",
    "4Ri6rxTGFimTm0KkZtKfBZ",
    "2Org6cCBgVas4d9OwzzxAv",
    "まなび場天声人語"
  ];

  function inspect(sheet, dateCol, registerCol) {
    return sheet.getDataRange().getDisplayValues()
      .map(function(r, i) {
        return { row: r, number: i + 1 };
      })
      .filter(function(x) {
        const text = x.row.join(" ");
        return targets.some(function(t) {
          return text.indexOf(t) >= 0;
        });
      })
      .map(function(x) {
        return {
          row: x.number,
          title: x.row[1],
          url: x.row[0],
          date: x.row[dateCol - 1],
          registered: registerCol
            ? x.row[registerCol - 1] : null,
          formula: sheet
            .getRange(x.number, dateCol)
            .getFormula()
        };
      });
  }

  Logger.log(JSON.stringify({
    mode: "READ_ONLY",
    work: inspect(work, 6, 8),
    public: inspect(pub, 4, 5)
  }, null, 2));
}