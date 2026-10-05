// Theme V3 single-sheet workflow.
// One theme = one sheet. Human decisions are authoritative.
// Spotify writes are explicit; this file never removes items automatically.

const THEME_V3_CONFIG_ = {
  "中南米": {
    playlistId: "2Org6cCBgVas4d9OwzzxAv"
  },
  "北欧": {
    playlistId: "5OwJ6qphlx7kSlpdnk3AXJ"
  }
};

function getThemeV3Config_(sheetName) {
  return THEME_V3_CONFIG_[String(sheetName || "").trim()] || null;
}

function getThemeV3EpisodeId_(row) {
  return String(row && row[1] ? row[1] : "").trim();
}

function getThemeV3Decision_(row) {
  return String(row && row[8] ? row[8] : "").trim();
}

function getThemeV3ConfirmedAt_(row) {
  return row && row[9] ? row[9] : "";
}

function getThemeV3AddedAt_(row) {
  return row && row[10] ? row[10] : "";
}

// Build a safe plan from the current sheet and current Spotify membership.
// - 採用 + not on Spotify + never previously added => add
// - 採用 + previously added + now missing => interpret as human Spotify removal;
//   do NOT re-add automatically (tombstone candidate)
// - 除外 + still on Spotify => removal candidate only; never auto-remove
function buildThemeV3SpotifyPlan_(rows, currentSpotifyEpisodeIds) {
  const current = new Set((currentSpotifyEpisodeIds || []).map(String));
  const additions = [];
  const alreadyPresent = [];
  const manualRemovalTombstones = [];
  const removalReview = [];

  (Array.isArray(rows) ? rows : []).forEach(function(row, index) {
    const episodeId = getThemeV3EpisodeId_(row);
    if (!episodeId) return;

    const decision = getThemeV3Decision_(row);
    const addedAt = getThemeV3AddedAt_(row);
    const present = current.has(episodeId);

    if (decision === "採用") {
      if (present) {
        alreadyPresent.push({ rowNumber: index + 2, episodeId: episodeId });
      } else if (addedAt) {
        manualRemovalTombstones.push({
          rowNumber: index + 2,
          episodeId: episodeId,
          reason: "spotify_manual_removal"
        });
      } else {
        additions.push({ rowNumber: index + 2, episodeId: episodeId });
      }
      return;
    }

    if (decision === "除外" && present) {
      removalReview.push({
        rowNumber: index + 2,
        episodeId: episodeId,
        action: "REVIEW_REMOVAL"
      });
    }
  });

  return {
    additions: additions,
    alreadyPresent: alreadyPresent,
    manualRemovalTombstones: manualRemovalTombstones,
    removalReview: removalReview
  };
}

function applyThemeV3DecisionTimestamp_(sheet, rowNumber, decision, sourceLabel) {
  if (!sheet || rowNumber < 2) return;
  const confirmedCell = sheet.getRange(rowNumber, 10);
  const sourceCell = sheet.getRange(rowNumber, 13);

  if (decision === "採用" || decision === "除外") {
    if (!confirmedCell.getValue()) confirmedCell.setValue(new Date());
    if (sourceLabel && !sourceCell.getValue()) sourceCell.setValue(sourceLabel);
  } else if (decision === "未確認") {
    confirmedCell.clearContent();
    if (sourceLabel === "人間") sourceCell.clearContent();
  }
}

// Simple trigger. Human edits always override prior automatic draft decisions.
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const config = getThemeV3Config_(sheet.getName());
  if (!config) return;
  if (e.range.getRow() < 2 || e.range.getColumn() !== 9 || e.range.getNumRows() !== 1) return;

  const decision = String(e.range.getDisplayValue() || "").trim();
  if (["未確認", "採用", "除外"].indexOf(decision) < 0) return;
  applyThemeV3DecisionTimestamp_(sheet, e.range.getRow(), decision, "人間");
}

// Read-only preview. No Spotify or Sheet writes.
function previewThemeV3SpotifyPlan_(sheetName, currentSpotifyEpisodeIds) {
  const config = getThemeV3Config_(sheetName);
  if (!config) throw new Error("テーマV3設定が見つかりません: " + sheetName);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("テーマタブが見つかりません: " + sheetName);

  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, 14).getValues()
    : [];

  return buildThemeV3SpotifyPlan_(rows, currentSpotifyEpisodeIds || []);
}
