const SAITO_AUTO_RECOVERY_V1_ = {
  playlistId: "7FBbaBPpGDSJUIXN4L2iYi",
  targetEpisodeId: "3Qhcx3wDl9anbIiGQsaCDk",
  name: "斎藤健一郎"
};

function diagnoseSaitoAutoUpdateRecoveryV1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const requestSheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!requestSheet) throw new Error("自動更新申請シートが見つかりません");

  const lastRow = requestSheet.getLastRow();
  const rows = lastRow >= 2
    ? requestSheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues()
    : [];

  const matches = [];
  rows.forEach(function(row, index) {
    const playlistId = extractAutoUpdateSpotifyPlaylistId_(String(row[1] || ""));
    if (playlistId !== SAITO_AUTO_RECOVERY_V1_.playlistId) return;

    const request = autoUpdateRequestFromSheetRowV1_(row);
    const plan = buildAutoPlaylistRequestPlan_(request);

    matches.push({
      rowNumber: index + 2,
      status: String(row[7] || "").trim(),
      title: String(row[2] || "").trim(),
      updateType: String(request.updateType || "").trim(),
      ruleType: String(plan.ruleType || "").trim(),
      keywords: String(request.keywords || "").trim(),
      validationError: validateAutoUpdateRequest_(request) || "",
      inactive: isInactiveAutoUpdateRequestStatus_(row[7]) === true
    });
  });

  const runtime = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return rule &&
      String(rule.playlistId || "") === SAITO_AUTO_RECOVERY_V1_.playlistId;
  }).map(function(rule) {
    return {
      key: rule.key,
      enabled: rule.enabled !== false,
      productionWriteAllowed: rule.productionWriteAllowed === true,
      bootstrapPending: rule.bootstrapPending === true,
      lifecycleStatus: String(rule.lifecycleStatus || ""),
      requestSheetRow: Number(rule.requestSheetRow || 0),
      updateType: String(rule.updateType || ""),
      ruleType: String(getAutoPlaylistRuleType_(rule) || "")
    };
  });

  const sheetLink = inspectAutoPlaylistSheetLink_(
    SAITO_AUTO_RECOVERY_V1_.playlistId
  );

  const report = {
    dryRun: true,
    spotifyWrite: false,
    spreadsheetWrite: false,
    playlistId: SAITO_AUTO_RECOVERY_V1_.playlistId,
    targetEpisodeId: SAITO_AUTO_RECOVERY_V1_.targetEpisodeId,
    requestMatches: matches,
    runtimeRules: runtime,
    sheetLink: sheetLink
  };

  Logger.log(JSON.stringify(report));
  return report;
}