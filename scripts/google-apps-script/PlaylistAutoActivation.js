// 自動更新ルール候補の本番有効化条件を判定する純粋関数。
// このファイル自体はSpotify API・スプレッドシート・ルール配列を書き換えない。

function canActivateAutoPlaylistRule_(rule) {
  const validation = validateAutoPlaylistRule_(rule);
  const lifecycleStatus = String(rule && rule.lifecycleStatus ? rule.lifecycleStatus : "");
  const productionWriteAllowed = rule && rule.productionWriteAllowed === true;

  const blockers = validation.errors.slice();
  if (lifecycleStatus !== AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL) {
    blockers.push("lifecycleStatus が incremental ではありません");
  }
  if (!productionWriteAllowed) {
    blockers.push("productionWriteAllowed が true ではありません");
  }

  return {
    canActivate: blockers.length === 0,
    blockers: blockers,
    validation: validation
  };
}

function assertAutoPlaylistRuleActivationSafe_(rule) {
  const result = canActivateAutoPlaylistRule_(rule);
  if (!result.canActivate) {
    throw new Error("本番自動更新を有効化できません: " + result.blockers.join(" / "));
  }
  return true;
}
