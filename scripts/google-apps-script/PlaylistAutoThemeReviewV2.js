// Theme review V2: one human-readable sheet per theme.
// This file contains migration/name helpers only. It does not write to Spotify
// or mutate spreadsheet tabs by itself.

const THEME_REVIEW_V2_SHEET_BY_PLAYLIST_ID_ = {
  "2Org6cCBgVas4d9OwzzxAv": "中南米",
  "5OwJ6qphlx7kSlpdnk3AXJ": "北欧"
};

function sanitizeThemeReviewV2SheetName_(value) {
  const normalized = String(value || "")
    .replace(/[\\\/\?\*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.substring(0, 100);
}

function getThemeReviewV2SheetName_(rule) {
  if (!rule) return "";
  const playlistId = String(rule.playlistId || "").trim();
  const mapped = THEME_REVIEW_V2_SHEET_BY_PLAYLIST_ID_[playlistId];
  if (mapped) return mapped;

  const explicit = sanitizeThemeReviewV2SheetName_(rule.themeSheetName);
  if (explicit) return explicit;

  const byName = sanitizeThemeReviewV2SheetName_(rule.name || rule.title);
  if (byName) return byName;

  return playlistId ? "テーマ_" + playlistId : "";
}

function normalizeThemeReviewV2Decision_(value) {
  const decision = String(value || "").trim();
  if (decision === "採用" || decision === "除外") return decision;
  if (decision === "未確認" || decision === "保留" || !decision) return "未確認";
  return "未確認";
}

function getThemeReviewV2RowKey_(row) {
  const episodeId = String(row && row[1] ? row[1] : "").trim();
  if (episodeId) return episodeId;
  const spotifyUrl = String(row && row[7] ? row[7] : "").trim();
  return spotifyUrl;
}

function scoreThemeReviewV2Row_(row, sourcePriority) {
  const decision = normalizeThemeReviewV2Decision_(row && row[8]);
  const confirmedAt = Boolean(row && row[9]);
  const addedAt = Boolean(row && row[10]);

  let score = 0;
  if (decision === "採用" || decision === "除外") score += 10;
  if (confirmedAt) score += 5;
  if (addedAt) score += 20;
  score += Number(sourcePriority || 0);
  return score;
}

function normalizeThemeReviewV2Row_(row) {
  const copy = Array.isArray(row) ? row.slice(0, 12) : [];
  while (copy.length < 12) copy.push("");
  copy[8] = normalizeThemeReviewV2Decision_(copy[8]);
  return copy;
}

function mergeThemeReviewV2Rows_(queueRows, historyRows) {
  const byKey = {};

  function ingest(rows, sourcePriority) {
    (Array.isArray(rows) ? rows : []).forEach(function(rawRow) {
      const row = normalizeThemeReviewV2Row_(rawRow);
      const key = getThemeReviewV2RowKey_(row);
      if (!key) return;

      const existing = byKey[key];
      const score = scoreThemeReviewV2Row_(row, sourcePriority);
      if (!existing || score > existing.score) {
        byKey[key] = { row: row, score: score };
      }
    });
  }

  // Queue first, history second. On equal substantive state, history wins.
  ingest(queueRows, 1);
  ingest(historyRows, 2);

  return Object.keys(byKey).map(function(key) {
    return byKey[key].row;
  }).sort(function(a, b) {
    const da = String(a[2] || "");
    const db = String(b[2] || "");
    if (da !== db) return da < db ? 1 : -1;
    return String(a[1] || "").localeCompare(String(b[1] || ""));
  });
}

function getKnownThemeReviewV2SourceTabs_(rule) {
  const id = String(rule && rule.playlistId ? rule.playlistId : "").trim();

  if (id === "2Org6cCBgVas4d9OwzzxAv") {
    return {
      queue: "テーマ候補確認",
      history: "テーマ判定履歴",
      obsoleteCopies: ["テーマ候補確認 のコピー"]
    };
  }

  if (id === "5OwJ6qphlx7kSlpdnk3AXJ") {
    return {
      queue: "テーマ候補_" + id,
      history: "テーマ履歴_" + id,
      obsoleteCopies: []
    };
  }

  return {
    queue: "テーマ候補_" + id,
    history: "テーマ履歴_" + id,
    obsoleteCopies: []
  };
}

function buildThemeReviewV2MigrationPlan_(rule, queueRows, historyRows) {
  const targetSheetName = getThemeReviewV2SheetName_(rule);
  if (!targetSheetName) throw new Error("V2テーマタブ名を決定できません");

  const sourceTabs = getKnownThemeReviewV2SourceTabs_(rule);
  const mergedRows = mergeThemeReviewV2Rows_(queueRows, historyRows);

  return {
    dryRun: true,
    playlistId: String(rule && rule.playlistId || ""),
    ruleKey: String(rule && rule.key || ""),
    targetSheetName: targetSheetName,
    sourceTabs: sourceTabs,
    mergedRowCount: mergedRows.length,
    mergedRows: mergedRows,
    spotifyWrite: false,
    spreadsheetWrite: false
  };
}


// Human review helper for the new one-sheet theme tabs.
// When column I (判定) changes on 中南米 / 北欧:
// - 採用 or 除外 => stamp column J (確認日時) if blank
// - 未確認 => clear column J
// Column K (追加日時) is reserved for successful Spotify addition only.
function handleThemeReviewV2Edit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const name = String(sheet.getName() || "");
  if (name !== "中南米" && name !== "北欧") return;
  if (e.range.getRow() < 2 || e.range.getColumn() !== 9 || e.range.getNumRows() !== 1) return;

  const decision = String(e.range.getDisplayValue() || "").trim();
  const confirmedCell = sheet.getRange(e.range.getRow(), 10);

  if (decision === "採用" || decision === "除外") {
    if (!confirmedCell.getValue()) confirmedCell.setValue(new Date());
    return;
  }

  if (decision === "未確認" || !decision) {
    confirmedCell.clearContent();
  }
}

function onEdit(e) {
  handleThemeReviewV2Edit_(e);
}

// Read-only diagnostics for the trusted Nordic reference set supplied by the user.
// The list is intentionally ID-based; it is not used to auto-write Spotify.
const NORDIC_TRUSTED_EPISODE_IDS_V2_ = [
  "2aP6Vr8NjS6uQNnr2rh4Ka",
  "1wJB2t5RvHId3ENbZuSvwi",
  "7vHzUBJw5FVVKAE9N5Pwt4",
  "4OtKo7LsQ1KEF2k9bA5Wpu",
  "24FrufOivF7CIGEzZOFv4J",
  "5QyPjzIB9h4vvYRKJTBDiN",
  "0NBBvRoRzWFkViCyo7GhDn",
  "702ZHPZkrEZdb7JtPVL12q",
  "0GabfxiQpFs1tUJ4luNS2J",
  "0Afp0GsOsTbK1wdZMIlpYE",
  "0TWuU4I2BgibCPSOfeCvq2",
  "58TZyIy6Wsa3gGQUU9KMzw",
  "2KoYaGRoTOTSFC0a9klcvc"
];

function auditNordicTrustedCoverageV2_(rows) {
  const present = new Set((Array.isArray(rows) ? rows : []).map(function(row) {
    return String(row && row[1] ? row[1] : "").trim();
  }).filter(Boolean));

  const missing = NORDIC_TRUSTED_EPISODE_IDS_V2_.filter(function(id) {
    return !present.has(id);
  });

  return {
    trustedCount: NORDIC_TRUSTED_EPISODE_IDS_V2_.length,
    presentCount: NORDIC_TRUSTED_EPISODE_IDS_V2_.length - missing.length,
    missingCount: missing.length,
    missingIds: missing
  };
}
