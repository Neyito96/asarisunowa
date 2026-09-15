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
    productionWriteAllowed: false
  };

  if (plan.ruleType === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_) {
    candidate.fields = ["name", "description", "html_description"];
    candidate.fetchAllPages = true;
    candidate.continueOnShowFetchError = true;
    candidate.addIndividually = true;
    candidate.updateLatestDateOnAdd = true;
  }

  return candidate;
}

function prepareAutoPlaylistRuleCandidate_(request) {
  const candidate = buildAutoPlaylistRuleCandidateFromRequest_(request);
  return {
    dryRun: true,
    candidate: candidate,
    validation: validateAutoPlaylistRule_(candidate),
    productionWriteAllowed: false,
    note: "key と playlistId を管理者が確定し、bootstrap・reviewを完了するまで本番有効化しません"
  };
}
