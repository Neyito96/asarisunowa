// ライフサイクル遷移の純粋テスト。

function testAutoPlaylistLifecycleTransitionsPure() {
  if (!canTransitionAutoPlaylistLifecycle_("requested", "bootstrap")) {
    throw new Error("requested -> bootstrap が拒否されました");
  }
  if (!canTransitionAutoPlaylistLifecycle_("bootstrap", "review")) {
    throw new Error("bootstrap -> review が拒否されました");
  }
  if (!canTransitionAutoPlaylistLifecycle_("review", "incremental")) {
    throw new Error("review -> incremental が拒否されました");
  }
  if (canTransitionAutoPlaylistLifecycle_("requested", "incremental")) {
    throw new Error("requested -> incremental が許可されています");
  }
  Logger.log("Auto playlist lifecycle transition pure tests: PASS");
  return true;
}
