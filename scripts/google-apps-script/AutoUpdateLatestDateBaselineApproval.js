// Manual, read-only approval roster for the eleven managed AUTO playlists.
// Missing dates and snapshots are deliberately blank; never infer them from F.
const AUTO_LATEST_DATE_APPROVAL_ROSTER_V1_ = [
  { playlistId: "4tY0lHoV8IemMBp4iTnKnl", name: "一緒に新聞をめくろう！",
    latestDate: "2026-09-27", snapshotId: "AAAAyLl4HCvYuC9PovtOuxnoNFcXE+7t",
    source: "ユーザー確認済みの最新配信日と作業台F列訂正（2026-09-29）" },
  { playlistId: "6nDhZQG75F1wU62sdcYJMq", name: "#きのどう", latestDate: "", snapshotId: "", source: "" },
  { playlistId: "4Ri6rxTGFimTm0KkZtKfBZ", name: "豊秀一", latestDate: "", snapshotId: "", source: "",
    nullCount: 4, nullOffsets: [0, 1, 6, 7] },
  { playlistId: "7jLXrZ0JUNOnsSeFEFbw9S", name: "太田匡彦", latestDate: "", snapshotId: "", source: "",
    nullCount: 10, nullOffsets: [9, 10, 11, 12, 15, 16, 21, 23, 29, 30] },
  { playlistId: "4FBXSFf2nLjLb3qaRoSdoD", name: "ノーミライ", latestDate: "", snapshotId: "", source: "" },
  { playlistId: "73ppqrTcsjVgl1xwIZa4SY", name: "佐藤陽", latestDate: "", snapshotId: "", source: "" },
  { playlistId: "2Org6cCBgVas4d9OwzzxAv", name: "中南米", latestDate: "", snapshotId: "", source: "" },
  { playlistId: "1u1qT0BxRZT1OeNM0LDA72", name: "楽屋裏", latestDate: "", snapshotId: "", source: "" },
  { playlistId: "1qhNqjSTfwvJP3cQaXg9bn", name: "寺下真理加 出演回", latestDate: "", snapshotId: "", source: "" },
  { playlistId: "7aKDEfAdCjTxiqiv19Grar", name: "まなび場 天声人語", latestDate: "", snapshotId: "", source: "",
    nullCount: 1, nullOffsets: [63] },

 { playlistId: "6hNrobOVHmYaQT5C7hPkNa", name: "ポリレビ",
    latestDate: "", snapshotId: "", source: "" }
];
const AUTO_LATEST_DATE_APPROVAL_EXPECTED_COUNT_V1_ = 11;

function buildAutoLatestDateApprovalEvidenceV1_(roster) {
  const byId = {};
  roster.forEach(function(item) {
    if (item.latestDate && item.snapshotId && item.source) {
      byId[item.playlistId] = { latestDate: item.latestDate,
        snapshotId: item.snapshotId, source: item.source };
    }
  });
  return byId;
}

function buildAutoLatestDateApprovalReportV1_(roster, baseline, runtimeRules, readSavedState) {
  const listed = {};
  const duplicates = {};
  roster.forEach(function(item) {
    if (listed[item.playlistId]) duplicates[item.playlistId] = true;
    listed[item.playlistId] = item;
  });
  const countMatches = runtimeRules.length === AUTO_LATEST_DATE_APPROVAL_EXPECTED_COUNT_V1_ &&
    baseline.count === runtimeRules.length;
  const results = baseline.results.map(function(row) {
    const approved = listed[row.playlistId];
    const result = { playlistId: row.playlistId, name: approved && approved.name || "未登録ルール",
      latestDate: approved && approved.latestDate || null,
      snapshotId: approved && approved.snapshotId || null,
      source: approved && approved.source || null,
      currentSnapshotId: row.currentSnapshotId, sheetDate: row.sheetDate,
      snapshotMatches: Boolean(approved && approved.snapshotId &&
        approved.snapshotId === row.currentSnapshotId),
      sheetDateMatches: Boolean(approved && approved.latestDate &&
        approved.latestDate === row.sheetDate),
      itemCount: row.itemCount, uniqueIdCount: row.uniqueIdCount,
      nullCount: row.nullCount, nullOffsets: row.nullItems &&
        row.nullItems.map(function(item) { return item.offset; }) || null,
      expectedNullCount: approved && approved.nullCount !== undefined ? approved.nullCount : null,
      expectedNullOffsets: approved && approved.nullOffsets || null,
      ownerKnown: row.ownerKnown, classification: row.classification === "BASELINE_UNAVAILABLE" ?
        "BLOCKED" : row.classification, reason: row.reason };
    if (!countMatches) return Object.assign(result, { classification: "BLOCKED", reason: "RULE_COUNT_CHANGED" });
    if (!approved || duplicates[row.playlistId]) return Object.assign(result, {
      classification: "BLOCKED", reason: approved ? "ROSTER_DUPLICATE" : "UNLISTED_RULE" });
    if (result.classification !== "BLOCKED" && approved.nullOffsets && row.nullItems &&
        (approved.nullCount !== row.nullItems.length ||
        approved.nullOffsets.join(",") !== result.nullOffsets.join(","))) {
      result.classification = "HUMAN_CONFIRM";
      result.reason = "NULL_COMPOSITION_CHANGED";
    }
    if (result.classification === "BLOCKED") return result;
    const raw = readSavedState(row.playlistId);
    if (raw) {
      let saved;
      try { saved = JSON.parse(raw); } catch (error) {
        return Object.assign(result, { classification: "BLOCKED", reason: "INVALID_SAVED_STATE" });
      }
      const same = saved && saved.snapshotId === row.currentSnapshotId &&
        saved.latestDate === approved.latestDate && saved.itemCount === row.itemCount;
      result.classification = "HUMAN_CONFIRM";
      result.reason = same && Array.isArray(saved.ids) ? "ALREADY_BASELINED" :
        same ? "EXISTING_LEGACY_STATE" : "EXISTING_STATE_CONFLICT";
    }
    return result;
  });
  return { count: baseline.count, expectedCount: AUTO_LATEST_DATE_APPROVAL_EXPECTED_COUNT_V1_,
    rosterCount: roster.length, results: results,
    missingEvidenceIds: results.filter(function(item) {
      return !item.latestDate || !item.snapshotId || !item.source;
    }).map(function(item) { return item.playlistId; }),
    missingRosterIds: roster.filter(function(item) {
      return !runtimeRules.some(function(rule) { return rule.playlistId === item.playlistId; });
    }).map(function(item) { return item.playlistId; }) };
}

// GAS editor entry point: no parameters, no refresh, no Sheet/Properties writes.
function runAutoLatestDateApprovalDryRunV1() {
  const runtimeRules = collectAutoPlaylistLatestDateRulesV1_();
  const evidence = buildAutoLatestDateApprovalEvidenceV1_(AUTO_LATEST_DATE_APPROVAL_ROSTER_V1_);
  const baseline = runAutoLatestDateBaselineDryRunV1(evidence);
  const properties = PropertiesService.getScriptProperties();
  const report = buildAutoLatestDateApprovalReportV1_(
    AUTO_LATEST_DATE_APPROVAL_ROSTER_V1_, baseline, runtimeRules,
    function(id) { return properties.getProperty(AUTO_LATEST_DATE_STATE_PREFIX_V1_ + id) || ""; }
  );
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
