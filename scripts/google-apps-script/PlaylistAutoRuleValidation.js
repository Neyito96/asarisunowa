// 自動更新ルールの静的検証。Spotify API・スプレッドシートにはアクセスしない。

function validateAutoPlaylistRule_(rule) {
  const errors = [];
  const warnings = [];
  const source = rule || {};
  const ruleType = getAutoPlaylistRuleType_(source);
  const showIds = getAutoPlaylistShowIds_(source);
  const playlistId = String(source.playlistId || "").trim();
  const key = String(source.key || "").trim();
  const name = String(source.name || "").trim();
  const keywords = Array.isArray(source.keywords)
    ? source.keywords.map(function(value) { return String(value || "").trim(); }).filter(Boolean)
    : String(source.keyword || "").trim()
    ? [String(source.keyword).trim()]
    : [];

  if (!key) errors.push("key がありません");
  if (!name) errors.push("name がありません");
  if (!playlistId) errors.push("playlistId がありません");
  if (!showIds.length) errors.push("showId/showIds がありません");
  if (!keywords.length && !String(source.matchStrategy || "").trim()) {
    errors.push("keyword(s) または matchStrategy がありません");
  }

  if (
    ruleType !== AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ &&
    ruleType !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_ &&
    ruleType !== AUTO_PLAYLIST_RULE_TYPE_THEME_
  ) {
    errors.push("未対応の ruleType: " + ruleType);
  }

  if (
    ruleType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ &&
    Array.isArray(source.fields) &&
    source.fields.some(function(field) { return String(field) !== "name"; })
  ) {
    warnings.push("title-text は fields 指定に関係なく episode.name のみを検索します");
  }

  if (ruleType === AUTO_PLAYLIST_RULE_TYPE_THEME_ && source.reviewRequired !== true) {
    errors.push("theme は初回構築後の reviewRequired:true が必要です");
  }

  if (source.enabled !== false && source.lifecycleStatus) {
    if (!isAutoPlaylistProductionReady_(source.lifecycleStatus)) {
      errors.push("enabled ですが lifecycleStatus が incremental ではありません");
    }
  }

  return {
    key: key,
    name: name,
    ruleType: ruleType,
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

function validateAllAutoPlaylistRules_() {
  const results = AUTO_PLAYLIST_RULES.map(validateAutoPlaylistRule_);
  const invalid = results.filter(function(result) { return !result.valid; });

  return {
    valid: invalid.length === 0,
    total: results.length,
    invalidCount: invalid.length,
    results: results
  };
}

function dryRunValidateAutoPlaylistRules() {
  const report = validateAllAutoPlaylistRules_();
  Logger.log(JSON.stringify(report, null, 2));
  if (!report.valid) {
    throw new Error("自動更新ルールの静的検証でエラーがあります: " + report.invalidCount + "件");
  }
  return report;
}
