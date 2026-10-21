// Recovery helper for a submitted speaker request that is stuck in a non-pending
// status and therefore skipped by processPendingAutoUpdateRequestsV1().
// Branch-only staging. No trigger installation and no automatic invocation.

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
    return rule && String(rule.playlistId || "") === SAITO_AUTO_RECOVERY_V1_.playlistId;
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

  const sheetLink = inspectAutoPlaylistSheetLink_(SAITO_AUTO_RECOVERY_V1_.playlistId);
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

// Explicit management action. This function only reconstructs the runtime rule and
// enters the existing bootstrap flow; it does not directly add any Spotify episode.
// It refuses to proceed unless exactly one active request row exists and the rule is speaker.
function promoteSaitoAutoUpdateRecoveryV1() {
  const diagnosis = diagnoseSaitoAutoUpdateRecoveryV1();
  const active = diagnosis.requestMatches.filter(function(item) { return item.inactive !== true; });
  if (active.length !== 1) {
    throw new Error("斎藤健一郎の有効な自動更新申請行が一意ではありません: " + active.length);
  }
  if (diagnosis.runtimeRules.length) {
    throw new Error("斎藤健一郎のruntime ruleが既に存在するため自動復旧を停止しました");
  }
  if (!diagnosis.sheetLink || !diagnosis.sheetLink.found || diagnosis.sheetLink.duplicate) {
    throw new Error("斎藤健一郎の作業台行が一意に確認できません");
  }

  const rowNumber = active[0].rowNumber;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const requestSheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  const row = requestSheet.getRange(rowNumber, 1, 1, 9).getDisplayValues()[0];
  const request = autoUpdateRequestFromSheetRowV1_(row);
  const plan = buildAutoPlaylistRequestPlan_(request);

  if (plan.ruleType !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_) {
    throw new Error("斎藤健一郎の申請がspeaker型ではありません");
  }
  const validationError = validateAutoUpdateRequest_(request);
  if (validationError) throw new Error("申請内容エラー: " + validationError);

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const access = inspectAutoUpdatePlaylistAccessV1_(SAITO_AUTO_RECOVERY_V1_.playlistId, token);
  const invitedAndSaved = Boolean(request.inviteUrl) && access.presentInLibrary === true;
  if (!access.editable && !invitedAndSaved) {
    throw new Error("Spotify共同編集権限を確認できません");
  }

  const rule = buildAutoUpdateRuntimeRuleV1_(
    request,
    SAITO_AUTO_RECOVERY_V1_.playlistId,
    rowNumber
  );
  const ruleValidation = validateAutoPlaylistRule_(rule);
  if (!ruleValidation.valid) {
    throw new Error("runtime rule検証エラー: " + ruleValidation.errors.join(" / "));
  }
  assertAutoPlaylistRuleActivationSafe_(rule);
  assertAutoPlaylistSheetLinkBeforeWrite_(rule);

  let seed = findAutoUpdateSeedEpisodeV1_(
    getAllSpotifyPlaylistItems_(rule.playlistId, token),
    rule,
    token
  );
  if (!seed && rule.seedDateOverride) {
    seed = {
      id: "manual-date-boundary-" + rule.playlistId,
      releaseDate: rule.seedDateOverride,
      name: "申請で確認した最新既存回"
    };
  }
  if (!seed) {
    throw new Error("条件に合う起点エピソードがプレイリスト内にありません");
  }

  prepareAutoUpdateSeedBootstrapV1_(rule, seed);
  saveAutoUpdateRuntimeRuleV1_(rule);
  requestSheet.getRange(rowNumber, 5).clearContent();
  setAutoUpdateRequestStatusV1_(
    requestSheet,
    rowNumber,
    "初回補完中",
    "斎藤健一郎 speaker復旧: 起点 " + seed.releaseDate + " から既存経路で補完"
  );
  SpreadsheetApp.flush();

  return {
    promoted: true,
    directSpotifyWrite: false,
    playlistId: rule.playlistId,
    requestSheetRow: rowNumber,
    bootstrapPending: rule.bootstrapPending === true,
    seedEpisodeId: rule.bootstrapSeedEpisodeId,
    seedDate: rule.bootstrapSeedDate
  };
}
