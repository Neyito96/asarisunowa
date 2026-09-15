// 自動更新プレイリストの運用段階（設計用・Spotifyアクセスなし）
// 申請から本番増分更新までを明示し、申請直後に本番書き込みへ進まないための共通定義。

const AUTO_PLAYLIST_LIFECYCLE_ = {
  REQUESTED: "requested",
  BOOTSTRAP: "bootstrap",
  REVIEW: "review",
  INCREMENTAL: "incremental",
  PAUSED: "paused"
};

function getAutoPlaylistLifecycleLabel_(status) {
  const labels = {};
  labels[AUTO_PLAYLIST_LIFECYCLE_.REQUESTED] = "申請受付";
  labels[AUTO_PLAYLIST_LIFECYCLE_.BOOTSTRAP] = "初回構築中";
  labels[AUTO_PLAYLIST_LIFECYCLE_.REVIEW] = "確認待ち";
  labels[AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL] = "増分自動更新";
  labels[AUTO_PLAYLIST_LIFECYCLE_.PAUSED] = "停止中";
  return labels[String(status || "")] || "未設定";
}

function isAutoPlaylistProductionReady_(status) {
  return String(status || "") === AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL;
}

function normalizeAutoPlaylistRequestRuleType_(value) {
  const requestedType = String(value || "").trim().toLowerCase();

  if (
    requestedType === "series" ||
    requestedType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_
  ) {
    return AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_;
  }

  if (requestedType === "speaker") {
    return AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  }

  // theme はタイトルだけを見るか概要欄も見るかの仕様が未確定。
  // 安全のため title-text へ黙って変換せず、未対応として止める。
  if (requestedType === "theme") {
    return "unsupported-theme";
  }

  return "unsupported";
}

function buildAutoPlaylistRequestPlan_(request) {
  const source = request || {};
  const requestedType = String(source.ruleType || source.updateType || "").trim();
  const ruleType = normalizeAutoPlaylistRequestRuleType_(requestedType);
  const supported =
    ruleType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ ||
    ruleType === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;

  return {
    dryRun: true,
    status: AUTO_PLAYLIST_LIFECYCLE_.REQUESTED,
    statusLabel: getAutoPlaylistLifecycleLabel_(AUTO_PLAYLIST_LIFECYCLE_.REQUESTED),
    requestedType: requestedType,
    ruleType: ruleType,
    supported: supported,
    playlistUrl: String(source.url || "").trim(),
    playlistTitle: String(source.title || "").trim(),
    keywords: String(source.keywords || "").trim(),
    nextStep: supported ? "bootstrap" : "manual-review",
    productionWriteAllowed: false
  };
}
