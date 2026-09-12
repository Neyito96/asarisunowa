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
