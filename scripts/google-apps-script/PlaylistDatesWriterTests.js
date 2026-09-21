// Read-only mock tests for the real updatePlaylistLatestDate_ function.
// Run manually in a test Apps Script project; never run against production sheets.
function testPlaylistDateWriterWithMocks_() {
  const originalSpreadsheetApp = SpreadsheetApp;
  const originalGetSheetLoose = getSheetLoose;
  const originalSpreadsheetId = SPREADSHEET_ID;
  const writes = [];
  const rows = [
    ["https://open.spotify.com/playlist/EXACT123", "", "", "", "", "2026-09-13"],
    ["https://open.spotify.com/playlist/EXACT1234", "", "", "", "", "2026-09-20"]
  ];
  const sheet = {
    getLastRow: function() { return rows.length + 1; },
    getRange: function(row, col, height, width) {
      if (height) return {getDisplayValues: function() { return rows.map(function(item) { return item.slice(); }); }};
      return {setValue: function(value) { writes.push({row: row, col: col, value: value}); rows[row - 2][col - 1] = value; }};
    }
  };
  function check(condition, message) { if (!condition) throw new Error(message); }
  try {
    SpreadsheetApp = {openById: function(id) { check(id === originalSpreadsheetId, "unexpected sheet ID"); return {}; }};
    getSheetLoose = function() { return sheet; };
    check(updatePlaylistLatestDate_("EXACT123", "") === false, "missing date should skip");
    check(updatePlaylistLatestDate_("EXACT123", "2023-01-26") === false, "backfill should skip");
    check(updatePlaylistLatestDate_("EXACT123", "2026-09-21") === true, "new release should advance");
    check(writes.length === 1 && writes[0].row === 2 && writes[0].col === 6 && writes[0].value === "2026-09-21", "only exact playlist F2 should change");
    check(rows[1][5] === "2026-09-20", "similar playlist ID must remain untouched");
    check(updatePlaylistLatestDate_("MISSING", "2026-09-21") === false, "missing ID should not write");
    Logger.log("PASS: playlist date writer mock tests (6 checks)");
  } finally {
    SpreadsheetApp = originalSpreadsheetApp;
    getSheetLoose = originalGetSheetLoose;
  }
}
