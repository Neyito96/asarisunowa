// Theme picker: applicants choose episodes from the library (蔵) and attach them to a theme playlist
// request. Server side re-checks every selection against the LEDGER (EP-ID, GUID, Spotify ID, human
// exclusion, admin hold) before anything is saved. Spotify is never called here.
//
// One playlist = one management sheet (ThemeV3SingleSheet.js). Row meaning (no new columns):
//   判定 (採用/除外/未確認) + 判定元 (投稿者選択 / 人間 / AUTO / AUTO新着) + 追加日時 (set once added)
const THEME_PICKER_MAX_EPISODES_ = 100;
const THEME_PICKER_SOURCE_ = "投稿者選択";
const THEME_PICKER_NEW_ARRIVAL_SOURCE_ = "AUTO新着";
const THEME_PICKER_REQUEST_COLUMN_ = 10; // request sheet column J: JSON of the validated selection

// -> { accepted:[{epId,guid,spotifyId,show,title,date}], rejected:[{epId,reason}] }
function validateThemePickerSelectionV1_(epIds) {
  if (!Array.isArray(epIds)) throw new Error("選択内容が正しくありません");
  const unique = Array.from(new Set(epIds.map(function(id) { return String(id || "").trim(); }).filter(Boolean)));
  if (unique.length > THEME_PICKER_MAX_EPISODES_) throw new Error("選べるのは最大" + THEME_PICKER_MAX_EPISODES_ + "件までです");
  if (!unique.length) return { accepted: [], rejected: [] };
  const index = p25ProdIndex_(); // fails closed when AM column / exclusion sheet are missing
  const byEp = {};
  index.rows.forEach(function(e) { byEp[e.epId] = e; });
  const accepted = [], rejected = [];
  unique.forEach(function(epId) {
    const e = byEp[epId];
    if (!/^EP-\d{5}$/.test(epId) || !e) { rejected.push({ epId: epId, reason: "NOT_IN_LEDGER" }); return; }
    if (e.humanExcluded) { rejected.push({ epId: epId, reason: "HUMAN_EXCLUDED" }); return; }
    if (e.reason) { rejected.push({ epId: epId, reason: e.reason }); return; }
    accepted.push({ epId: e.epId, guid: e.guid, spotifyId: e.spotifyId, show: e.show, title: e.title, date: e.date });
  });
  return { accepted: accepted, rejected: rejected };
}

function serializeThemePickerSelectionV1_(accepted) {
  return JSON.stringify({ v: 1, source: THEME_PICKER_SOURCE_, episodes: accepted.map(function(e) { return e.epId; }) });
}

// Tolerant reader for request-sheet column J. Anything unexpected = no selection (never a crash).
function parseThemePickerSelectionV1_(cell) {
  try {
    const data = JSON.parse(String(cell || ""));
    if (!data || data.v !== 1 || !Array.isArray(data.episodes)) return [];
    return data.episodes.map(String).filter(function(id) { return /^EP-\d{5}$/.test(id); }).slice(0, THEME_PICKER_MAX_EPISODES_);
  } catch (_) { return []; }
}

// Meaning of one management-sheet row, derived from the existing 14 columns.
function themeV3RowStateV1_(row) {
  const decision = String(row && row[8] || "").trim();
  const source = String(row && row[12] || "").trim();
  const added = Boolean(row && row[10]);
  if (decision === "除外") return "除外";
  if (decision === "採用" && added) return "Spotify追加済み";
  if (decision === "採用") {
    if (source === THEME_PICKER_SOURCE_) return "管理者採用";
    if (source === THEME_PICKER_NEW_ARRIVAL_SOURCE_) return "新着候補";
    if (source === "AUTO") return "AUTO初稿";
    return "管理者採用";
  }
  if (source === THEME_PICKER_SOURCE_) return "手動選択(採用待ち)";
  return source === THEME_PICKER_NEW_ARRIVAL_SOURCE_ ? "新着候補" : "未確認";
}

// Writes the applicant's selection into the theme's management sheet as 未確認 / 投稿者選択 rows: the existing writer only posts 採用, so an admin must
// set 判定=採用 by hand (onEdit stamps 確認日時) before anything can reach Spotify.
// Re-validates against the ledger now (exclusions may have changed since the request). Existing rows
// (including human exclusions and manual deletions) are never overwritten: a known episode is skipped.
function importThemePickerSelectionV1_(sheet, rule, epIds) {
  const result = { imported: 0, skippedKnown: 0, rejected: [] };
  if (!epIds || !epIds.length) return result;
  const checked = validateThemePickerSelectionV1_(epIds);
  result.rejected = checked.rejected;
  const known = new Set(readThemeV3Rows_(sheet).map(getThemeV3EpisodeId_).filter(Boolean));
  const now = new Date();
  const rows = [];
  checked.accepted.forEach(function(e) {
    if (known.has(e.spotifyId)) { result.skippedKnown += 1; return; }
    known.add(e.spotifyId);
    rows.push([
      String(rule.key || ""), e.spotifyId, e.date, e.show, e.title, "", "",
      "https://open.spotify.com/episode/" + e.spotifyId,
      "未確認", "", "", "", THEME_PICKER_SOURCE_,
      "投稿者が蔵から選択(管理者の採用待ち) / " + e.epId
    ]);
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 14).setValues(rows);
  result.imported = rows.length;
  return result;
}

// Reads the selection the applicant attached to this rule's request row.
function loadThemePickerSelectionForRuleV1_(rule) {
  const row = Number(rule && rule.requestSheetRow || 0);
  if (!row || row < 2) return [];
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!sheet || sheet.getLastColumn() < THEME_PICKER_REQUEST_COLUMN_) return [];
  return parseThemePickerSelectionV1_(sheet.getRange(row, THEME_PICKER_REQUEST_COLUMN_).getDisplayValue());
}
