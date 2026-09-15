// 自動更新申請からルール候補を組み立てる純粋関数。
// Spotify API・スプレッドシートへのアクセスや本番有効化は行わない。

function splitAutoPlaylistRequestKeywords_(value) {
  return String(value || "")
    .split(/[\n,、]+/)
    .map(function(item) { return item.trim(); })
    .filter(Boolean);
}

function buildAutoPlaylistRuleCandidateFromRequest_(request) {
  const plan = buildAutoPlaylistRequestPlan_(request || {});
  const keywords = splitAutoPlaylistRequestKeywords_(plan.keywords);

  const candidate = {
    key: "",
    enabled: false,
    lifecycleStatus: AUTO_PLAYLIST_LIFECYCLE_.REQUESTED,
    ruleType: plan.ruleType,
    name: plan.playlistTitle,
    playlistId: "",
    showIds: ASAHI_PRIMARY_SHOW_IDS.slice(),
    keywords: keywords,
    productionWriteAllowed: false,
    requestSupported: plan.supported === true
  };

  if (
    plan.ruleType === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_ ||
    plan.ruleType === AUTO_PLAYLIST_RULE_TYPE_THEME_
  ) {
    candidate.fields = ["name", "description", "html_description"];
    candidate.fetchAllPages = true;
    candidate.continueOnShowFetchError = true;
    candidate.addIndividually = true;
    candidate.updateLatestDateOnAdd = true;
  }

  if (plan.ruleType === AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    candidate.reviewRequired = true;
  }

  return candidate;
}

function prepareAutoPlaylistRuleCandidate_(request) {
  const plan = buildAutoPlaylistRequestPlan_(request || {});
  const candidate = buildAutoPlaylistRuleCandidateFromRequest_(request);
  const validation = validateAutoPlaylistRule_(candidate);

  if (!plan.supported) {
    validation.valid = false;
    validation.errors.push(
      "申請方式 " + String(plan.requestedType || "(未指定)") + " は自動ルール化の仕様確認が必要です"
    );
  }

  return {
    dryRun: true,
    requestPlan: plan,
    candidate: candidate,
    validation: validation,
    productionWriteAllowed: false,
    note: plan.supported
      ? "key と playlistId を管理者が確定し、bootstrap・reviewを完了するまで本番有効化しません"
      : "未対応の申請方式は自動構築せず、管理者確認へ送ります"
  };
}
