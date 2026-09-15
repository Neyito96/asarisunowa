// 申請から増分更新までの設計状態をSpotify通信なしで確認するdry-run。

function dryRunAutoPlaylistWorkflowFromRequest(request) {
  const prepared = prepareAutoPlaylistRuleCandidate_(request || {});
  const bootstrap = buildAutoPlaylistBootstrapPlan_(prepared.candidate);

  const result = {
    dryRun: true,
    request: prepared,
    bootstrap: bootstrap,
    reviewRequired: true,
    incrementalActivationAllowed: false,
    spotifyAccessed: false,
    playlistWritten: false
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
