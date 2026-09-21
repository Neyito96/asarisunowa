// Spotify エピソードの配信日だけを採用する。取得日時は代用しない。
function normalizePlaylistReleaseDate_(value) {
  let date = "";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    date = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  } else {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return "";
    date = match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
  }
  const parsed = new Date(date + "T00:00:00Z");
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

function maxPlaylistReleaseDate_(existing, candidate) {
  const oldDate = normalizePlaylistReleaseDate_(existing);
  const newDate = normalizePlaylistReleaseDate_(candidate);
  return newDate && (!oldDate || newDate > oldDate) ? newDate : oldDate;
}

function latestPlaylistReleaseDateFromItems_(items) {
  return (items || []).reduce(function(latest, row) {
    return maxPlaylistReleaseDate_(latest, row && row.item && row.item.release_date);
  }, "");
}

function updatePlaylistLatestDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, "作業台");
  if (!sheet) throw new Error("作業台シートが見つかりません");
  const values = sheet.getDataRange().getValues();
  if (!values.length) return;
  const headers = values[0].map(function(v) { return String(v || "").trim(); });
  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const profileCol = headers.indexOf("プロフィール");
  const latestCol = headers.indexOf("最終更新日");
  if ([urlCol, titleCol, profileCol, latestCol].some(function(i) { return i < 0; })) {
    throw new Error("必要な列見出しが見つかりません");
  }
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できません");
  const methodCol = findPlaylistUpdateStatusColumn_(headers);
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const url = String(row[urlCol] || "").trim();
    const title = String(row[titleCol] || "").trim();
    const profile = String(row[profileCol] || "").trim();
    const collaboratorUrl = String(row[3] || "").trim();
    if (profile.toUpperCase() !== "NEYITO" && !collaboratorUrl) continue;
    const match = url.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
    if (!match) continue;
    try {
      const latest = latestPlaylistReleaseDateFromItems_(getAllSpotifyPlaylistItems_(match[1], token));
      const previous = normalizePlaylistReleaseDate_(row[latestCol]);
      if (!latest) {
        Logger.log("日付取得できず・既存値維持: " + title);
        continue;
      }
      if (latest > previous) sheet.getRange(i + 1, latestCol + 1).setValue(latest);
      if (methodCol >= 0) sheet.getRange(i + 1, methodCol + 1).setValue("AUTO");
      Logger.log("配信日確認: " + title + " → " + maxPlaylistReleaseDate_(previous, latest));
    } catch (err) {
      Logger.log("取得失敗・既存値維持: " + title + " | " + String(err));
    }
  }
  Logger.log("最終配信日の確認完了");
}

function scanBlankPlaylistDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets().find(function(s) {
    return String(s.getName()).trim() === "作業台";
  });
  if (!sheet) throw new Error("作業台シートが見つかりません");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(v) { return String(v || "").trim(); });
  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const latestCol = headers.indexOf("最終更新日");
  const methodCol = findPlaylistUpdateStatusColumn_(headers);
  if ([urlCol, titleCol, latestCol, methodCol].some(function(i) { return i < 0; })) {
    throw new Error("必要な列見出しが見つかりません");
  }
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できません");
  let autoCount = 0, checkCount = 0, excludedCount = 0;
  for (let i = 1; i < values.length; i++) {
    const url = String(values[i][urlCol] || "").trim();
    const title = String(values[i][titleCol] || "").trim();
    const method = String(values[i][methodCol] || "").trim();
    if (method) continue;
    const match = url.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
    if (!match) {
      sheet.getRange(i + 1, methodCol + 1).setValue("対象外");
      Logger.log("対象外: " + title);
      excludedCount++;
      continue;
    }
    try {
      const latest = latestPlaylistReleaseDateFromItems_(getAllSpotifyPlaylistItems_(match[1], token));
      if (latest) {
        const previous = normalizePlaylistReleaseDate_(values[i][latestCol]);
        if (latest > previous) sheet.getRange(i + 1, latestCol + 1).setValue(latest);
        sheet.getRange(i + 1, methodCol + 1).setValue("AUTO");
        Logger.log("AUTO 配信日確認: " + title + " → " + maxPlaylistReleaseDate_(previous, latest));
        autoCount++;
      } else {
        sheet.getRange(i + 1, methodCol + 1).setValue("要確認");
        Logger.log("要確認: " + title);
        checkCount++;
      }
    } catch (err) {
      sheet.getRange(i + 1, methodCol + 1).setValue("要確認");
      Logger.log("要確認: " + title + " | " + String(err));
      checkCount++;
    }
  }
  Logger.log("完了 AUTO=" + autoCount + " / 要確認=" + checkCount + " / 対象外=" + excludedCount);
}

function findPlaylistUpdateStatusColumn_(headers) {
  const current = headers.indexOf("更新日取得状況");
  return current >= 0 ? current : headers.indexOf("更新日取得方法");
}

function updatePlaylistLatestDate_(playlistId, releaseDate) {
  const candidate = normalizePlaylistReleaseDate_(releaseDate);
  if (!candidate) {
    Logger.log("配信日未取得・書き込み省略: " + playlistId);
    return false;
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, "作業台");
  if (!sheet) throw new Error("作業台シートが見つかりません");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("作業台シートにデータがありません");
  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const targetRowIndex = values.findIndex(function(row) {
    const match = String(row[0] || "").match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
    return match && match[1] === playlistId;
  });
  if (targetRowIndex < 0) throw new Error("対象プレイリストが作業台に見つかりません: " + playlistId);
  const rowNumber = targetRowIndex + 2;
  const previous = normalizePlaylistReleaseDate_(values[targetRowIndex][5]);
  if (previous && candidate <= previous) {
    Logger.log("配信日維持: 作業台 row=" + rowNumber + " date=" + previous);
    return false;
  }
  sheet.getRange(rowNumber, 6).setValue(candidate);
  Logger.log("最新配信日反映: 作業台 row=" + rowNumber + " date=" + candidate);
  return true;
}
