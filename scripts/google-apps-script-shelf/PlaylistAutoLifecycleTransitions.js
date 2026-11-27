// 自動更新ライフサイクルの許可遷移。純粋関数のみ。

function canTransitionAutoPlaylistLifecycle_(fromStatus, toStatus) {
  const from = String(fromStatus || "");
  const to = String(toStatus || "");
  const allowed = {};
  allowed[AUTO_PLAYLIST_LIFECYCLE_.REQUESTED] = [AUTO_PLAYLIST_LIFECYCLE_.BOOTSTRAP, AUTO_PLAYLIST_LIFECYCLE_.PAUSED];
  allowed[AUTO_PLAYLIST_LIFECYCLE_.BOOTSTRAP] = [AUTO_PLAYLIST_LIFECYCLE_.REVIEW, AUTO_PLAYLIST_LIFECYCLE_.PAUSED];
  allowed[AUTO_PLAYLIST_LIFECYCLE_.REVIEW] = [AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL, AUTO_PLAYLIST_LIFECYCLE_.BOOTSTRAP, AUTO_PLAYLIST_LIFECYCLE_.PAUSED];
  allowed[AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL] = [AUTO_PLAYLIST_LIFECYCLE_.PAUSED];
  allowed[AUTO_PLAYLIST_LIFECYCLE_.PAUSED] = [AUTO_PLAYLIST_LIFECYCLE_.BOOTSTRAP, AUTO_PLAYLIST_LIFECYCLE_.REVIEW];
  return (allowed[from] || []).indexOf(to) >= 0;
}

function assertAutoPlaylistLifecycleTransition_(fromStatus, toStatus) {
  if (!canTransitionAutoPlaylistLifecycle_(fromStatus, toStatus)) {
    throw new Error("許可されていない自動更新状態遷移です: " + fromStatus + " -> " + toStatus);
  }
  return true;
}
