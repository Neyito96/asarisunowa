// 05_自動プレイリスト（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: PlaylistAutoRules.js, PlaylistAutoRuleValidation.js, PlaylistAutoRequestRule.js, PlaylistAutoLifecycle.js, PlaylistAutoActivation.js, PlaylistAutoScopedState.js, PlaylistAutoScopedStateStore.js, PlaylistAutoSheetLink.js, PlaylistAutoPageMatching.js, PlaylistAutoEpisodes.js, PlaylistAutoSpotify.js, PlaylistAutoWrite.js, PlaylistAuto.js, PlaylistAutoDryRun.js, PlaylistAutoDryRunOtaAuditV2.js, PlaylistAutoV2DryRunEngine.js, PlaylistAutoSatoYoLaunch.js, PlaylistAutoSatoYoIndividual.js

// ---- PlaylistAutoRules.js ----
const ASAHI_PRIMARY_SHOW_IDS = [
  "7euH6hzudIdp61JRSi9E8w",
  "0341I5UOUrJgm7KEvNGInZ",
  "0yhef9ORZkUZs9ZeotdCSY",
  "392h0MYfvMTndEVzf2cOvC",
  "5Dt1uyQaJpM6hPV8aEMP3R",
  "1KExdSsjQnatS4TdseGoC0",
  "2uG9W6CnsaNi87AfSuGe8r"
];

// 自動更新ルールは3種類。
// title-text: エピソードタイトル(name)内だけで指定文字列を判定する。
// speaker: 出演者・ゲスト用。タイトルと概要欄を対象にし、必要なら専用matchStrategyで安全判定する。
// theme: テーマ用。タイトルと概要欄を対象にキーワード判定し、初回構築後のreviewを必須とする。
const AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ = "title-text";
const AUTO_PLAYLIST_RULE_TYPE_SPEAKER_ = "speaker";
const AUTO_PLAYLIST_RULE_TYPE_THEME_ = "theme";

// 新しい自動更新プレイリストは、原則ここへルールを1件追加する。
// enabled:false は syncAllAutoPlaylists() と個別同期の両方から停止する。
// CELAC 33 countries plus geographical aliases. These are review candidates,
// never automatic Spotify approval. No bare "ラテン" or "ドミニカ" aliases.
const SOUTH_AMERICA_COUNTRY_KEYWORDS_V1_ = [
  "メキシコ", "ベリーズ", "グアテマラ", "エルサルバドル", "ホンジュラス", "ニカラグア", "コスタリカ", "パナマ",
  "コロンビア", "ベネズエラ", "ガイアナ", "スリナム", "エクアドル", "ペルー", "ボリビア", "ブラジル",
  "パラグアイ", "ウルグアイ", "アルゼンチン", "チリ",
  "キューバ", "ハイチ", "ドミニカ共和国", "ドミニカ国", "ジャマイカ", "バハマ", "バルバドス",
  "トリニダード・トバゴ", "グレナダ", "セントルシア", "セントビンセントおよびグレナディーン諸島",
  "セントクリストファー・ネービス", "アンティグア・バーブーダ"
];
const SOUTH_AMERICA_REGION_KEYWORDS_V1_ = [
  "中南米", "中米", "中央アメリカ", "南米", "南アメリカ", "ラテンアメリカ", "ラテン・アメリカ",
  "カリブ", "カリブ海", "カリブ諸国"
];
const SOUTH_AMERICA_NAME_ALIASES_V1_ = [
  "セントビンセント及びグレナディーン諸島", "セントビンセント", "セントクリストファー", "アンティグア"
];
const AUTO_PLAYLIST_RULES = [
  {
    key: "issho-shinbun",
    enabled: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "一緒に新聞をめくろう！",
    showIds: ["392h0MYfvMTndEVzf2cOvC"],
    playlistId: "4tY0lHoV8IemMBp4iTnKnl",
keyword: "めくろう",
addIndividually: true,
updateLatestDateOnAdd: true,
requireSheetLinkBeforeWrite: true
  },
  {
    key: "kino-douga",
    enabled: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "木下君、あの動画みた？ #きのどう",
    showIds: ["0yhef9ORZkUZs9ZeotdCSY"],
    playlistId: "6nDhZQG75F1wU62sdcYJMq",
    keywords: ["動画みた？", "動画見た？"],
    matchMode: "any",
    updateLatestDateOnAdd: true
  },
  {
    key: "toyohide",
    enabled: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_SPEAKER_,
    name: "豊秀一",
    showIds: ASAHI_PRIMARY_SHOW_IDS,
    playlistId: "4Ri6rxTGFimTm0KkZtKfBZ",
    keywords: ["豊秀一", "豊 秀一"],
    fields: ["name", "description", "html_description"],
    fetchAllPages: true,
    continueOnShowFetchError: true,
    addIndividually: true,
    updateLatestDateOnAdd: true
  },
  {
    key: "ota-masahiko",
    enabled: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_SPEAKER_,
    name: "太田匡彦",
    showIds: ASAHI_PRIMARY_SHOW_IDS,
    playlistId: "7jLXrZ0JUNOnsSeFEFbw9S",
    keywords: ["太田匡彦", "太田 匡彦"],
    fields: ["name", "description", "html_description"],
    matchStrategy: "ota-safe-confirmed",
    fetchAllPages: true,
    continueOnShowFetchError: true,
    addIndividually: true,
    updateLatestDateOnAdd: true
  },
  {
    key: "no-mirai",
    enabled: true,
    lifecycleStatus: "incremental",
    productionWriteAllowed: true,
    reviewRequired: false,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "農MUSIC 猟ライフ（ノーミライ）",
    showIds: ["0341I5UOUrJgm7KEvNGInZ"],
    playlistId: "4FBXSFf2nLjLb3qaRoSdoD",
    keywords: ["ノーミライ", "農MUSIC", "猟LIFE"],
    matchStrategy: "no-mirai-title-keywords",
    fetchAllPages: true,
    addIndividually: true,
    updateLatestDateOnAdd: true,
    requireSheetLinkBeforeWrite: true
  },
  {
    key: "sato-yo",
    enabled: true,
    lifecycleStatus: "incremental",
    productionWriteAllowed: true,
    reviewRequired: false,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_SPEAKER_,
    name: "佐藤陽",
    showIds: ASAHI_PRIMARY_SHOW_IDS,
    playlistId: "73ppqrTcsjVgl1xwIZa4SY",
    keywords: ["佐藤陽", "佐藤 陽"],
    fields: ["name", "description", "html_description"],
    matchStrategy: "sato-yo-safe-confirmed",
    fetchAllPages: true,
    continueOnShowFetchError: false,
    addIndividually: true,
    updateLatestDateOnAdd: true,
    requireSheetLinkBeforeWrite: true
  },
  {
    key: "south-america",
    enabled: true,
    lifecycleStatus: "incremental",
    productionWriteAllowed: true,
    reviewRequired: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_THEME_,
    name: "南米 中南米",
    showIds: ASAHI_PRIMARY_SHOW_IDS,
    playlistId: "2Org6cCBgVas4d9OwzzxAv",
    keywords: SOUTH_AMERICA_COUNTRY_KEYWORDS_V1_.concat(SOUTH_AMERICA_REGION_KEYWORDS_V1_, SOUTH_AMERICA_NAME_ALIASES_V1_),
    matchMode: "any",
    fields: ["name", "description", "html_description"],
    fetchAllPages: true,
    continueOnShowFetchError: true,
    addIndividually: true,
    updateLatestDateOnAdd: true,
    requireSheetLinkBeforeWrite: true
  },
 {
  key: "polirebi",
  enabled: true,
  lifecycleStatus: "incremental",
  productionWriteAllowed: true,
  reviewRequired: false,
  ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
  name: "ポリレビ",
  showIds: ["392h0MYfvMTndEVzf2cOvC"],
  playlistId: "6hNrobOVHmYaQT5C7hPkNa",
  keyword: "ポリレビ",
  fields: ["name"],
  fetchAllPages: true,
  addIndividually: true,
  updateLatestDateOnAdd: true,
  requireSheetLinkBeforeWrite: true
},
 {
    key: "polirebi-rebuild-audit",
    enabled: false,
    lifecycleStatus: "audit",
    productionWriteAllowed: false,
    reviewRequired: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "ポリレビ 完全再構築監査",
    showIds: ["392h0MYfvMTndEVzf2cOvC"],
    playlistId: "6hNrobOVHmYaQT5C7hPkNa",
    keyword: "ポリレビ",
    fields: ["name"],
    fetchAllPages: true
  }
];
function getEnabledAutoPlaylistRules_() {
  return AUTO_PLAYLIST_RULES.filter(function(rule) {
    return rule && rule.enabled !== false;
  });
}
function getAutoPlaylistRuleByKey_(key) {
  const wantedKey = String(key || "").trim();
  return AUTO_PLAYLIST_RULES.find(function(rule) {
    return String(rule && rule.key ? rule.key : "") === wantedKey;
  }) || null;
}
function getAutoPlaylistRuleType_(rule) {
  const explicitType = String(rule && rule.ruleType ? rule.ruleType : "").trim();
  if (explicitType) return explicitType;

  // 既存・移行途中のルールとの互換性。
  const fields = Array.isArray(rule && rule.fields) ? rule.fields : [];
  if (
    String(rule && rule.matchStrategy ? rule.matchStrategy : "") ||
    fields.indexOf("description") >= 0 ||
    fields.indexOf("html_description") >= 0
  ) {
    return AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  }
  return AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_;
}
function getAutoPlaylistShowIds_(rule) {
  if (Array.isArray(rule.showIds) && rule.showIds.length) {
    return rule.showIds.map(function(showId) {
      return String(showId || "").trim();
    }).filter(Boolean);
  }

  const showId = String(rule.showId || "").trim();
  return showId ? [showId] : [];
}
function getAutoPlaylistEpisodeText_(episode, rule) {
  const ruleType = getAutoPlaylistRuleType_(rule);
  const fields = ruleType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_
    ? ["name"]
    : Array.isArray(rule.fields) && rule.fields.length
    ? rule.fields
    : ["name", "description", "html_description"];

  return fields.map(function(field) {
    return String(
      episode && episode[field] != null
        ? episode[field]
        : ""
    );
  }).join("\n");
}
function isSpeakerAutoUpdateHumanBlocked_(rule, episodeId) {
  if (getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_) return false;
  const id = String(episodeId || "").trim();
  const decisions = rule && rule.manualEpisodeDecisions;
  return Boolean(id && decisions &&
    ["除外", "訂正済み", "反映済み"].indexOf(String(decisions[id] || "")) >= 0);
}
function isTerashitaAutoUpdateRule_(rule) {
  return String(rule && rule.playlistId || "") === "1qhNqjSTfwvJP3cQaXg9bn" &&
    getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
}
function matchesAutoPlaylistRule_(episode, rule) {
  if (rule && rule.matchStrategy === "no-mirai-title-keywords") {
    const title = String(episode?.name || "")
      .normalize("NFKC").toLowerCase();

    return ["ノーミライ", "農music", "猟life"].some(
      keyword => title.includes(keyword)
    ) || extractNoMiraiEpisodeNumber_(episode?.name) !== null;
  }

  // 以下は既存コードをそのまま残す
  if (isSpeakerAutoUpdateHumanBlocked_(rule, episode && episode.id)) return false;
  if (isSaitoKenichiroAutoUpdateRule_(rule)) {
    return classifySaitoKenichiroAutoEpisode_(episode).classification === "confirmed";
  }
  if (isTerashitaAutoUpdateRule_(rule)) {
    const title = String(episode && episode.name || "");
    if (/(イベント|公開収録|登壇|告知|お知らせ)/.test(title)) return false;
    return classifyTerashitaAutoEpisode_(episode).classification === "confirmed";
  }
  if (String(rule && rule.matchStrategy ? rule.matchStrategy : "") === "no-mirai-title-prefix") {
    return extractNoMiraiEpisodeNumber_(episode && episode.name) !== null;
  }

  if (String(rule && rule.matchStrategy ? rule.matchStrategy : "") === "ota-safe-confirmed") {
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
    return classification && classification.classification === "confirmed";
  }

  if (String(rule && rule.matchStrategy ? rule.matchStrategy : "") === "sato-yo-safe-confirmed") {
    const classification = classifySatoYoAutoPlaylistEpisode_(episode);
    return isSpeakerGuardrailConfirmed_(classification);
  }

  const text = getAutoPlaylistEpisodeText_(episode, rule);

  const seriesTitleCode = String(rule && rule.seriesTitleCode ? rule.seriesTitleCode : "");
  if (seriesTitleCode) {
    const escapedCode = seriesTitleCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const title = String(episode && episode.name ? episode.name : "");
    if (new RegExp(escapedCode + "[0-9]+").test(title)) return true;
  }

  const includeKeywords =
    Array.isArray(rule.keywords) && rule.keywords.length
      ? rule.keywords
      : rule.keyword
      ? [rule.keyword]
      : [];

  const excludeKeywords =
    Array.isArray(rule.excludeKeywords)
      ? rule.excludeKeywords
      : [];

  const excluded = excludeKeywords.some(function(keyword) {
    return hasAutoPlaylistCandidateKeywordV1_(text, keyword, rule);
  });

  if (excluded) {
    return false;
  }

  if (!includeKeywords.length) {
    return true;
  }

  const mode = String(rule.matchMode || "any").toLowerCase();

  if (mode === "all") {
    return includeKeywords.every(function(keyword) {
      return hasAutoPlaylistCandidateKeywordV1_(text, keyword, rule);
    });
  }

  return includeKeywords.some(function(keyword) {
    return hasAutoPlaylistCandidateKeywordV1_(text, keyword, rule);
  });
}
function extractNoMiraiEpisodeNumber_(title) {
  const normalized = String(title || "").normalize("NFKC");
  const match = normalized.match(
    /^\((?:ノーミライ|農M\s*[,、]\s*猟L)\s*#\s*(\d+)\)/
  );
  return match ? Number(match[1]) : null;
}

// Keep all other AUTO matching unchanged; normalize only the regional dictionary.
function hasAutoPlaylistCandidateKeywordV1_(text, keyword, rule) {
  if (!rule || rule.key !== "south-america") return text.indexOf(String(keyword)) >= 0;
  const normalize = function(value) {
    return String(value).normalize("NFKC").replace(/[・･\s]/g, "");
  };
  const normalized = normalize(text).replace(/バッチリ|ばっちり|チリチリ|チリ紙|チリ取り|カリブー/g, " ");
  return normalized.indexOf(normalize(keyword)) >= 0;
}

// ---- PlaylistAutoRuleValidation.js ----
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

// ---- PlaylistAutoRequestRule.js ----
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

// ---- PlaylistAutoLifecycle.js ----
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

  if (requestedType === "theme") {
    return AUTO_PLAYLIST_RULE_TYPE_THEME_;
  }

  return "unsupported";
}
function buildAutoPlaylistRequestPlan_(request) {
  const source = request || {};
  const requestedType = String(source.ruleType || source.updateType || "").trim();
  const ruleType = normalizeAutoPlaylistRequestRuleType_(requestedType);
  const supported =
    ruleType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ ||
    ruleType === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_ ||
    ruleType === AUTO_PLAYLIST_RULE_TYPE_THEME_;

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

// ---- PlaylistAutoActivation.js ----
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

// ---- PlaylistAutoScopedState.js ----
const AUTO_PLAYLIST_SCOPED_STATE_VERSION_ = 2;
const AUTO_PLAYLIST_SCOPED_STATE_PREFIX_ = "AUTO_PLAYLIST_V2_";
function normalizeAutoPlaylistStateKeyPart_(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_");
}
function buildAutoPlaylistScopedStateKey_(ruleKey, showId) {
  const safeRuleKey = normalizeAutoPlaylistStateKeyPart_(ruleKey);
  const safeShowId = normalizeAutoPlaylistStateKeyPart_(showId);
  if (!safeRuleKey) throw new Error("scoped stateにはrule.keyが必要です");
  if (!safeShowId) throw new Error("scoped stateにはshowIdが必要です");
  return AUTO_PLAYLIST_SCOPED_STATE_PREFIX_ + safeRuleKey + "__" + safeShowId;
}
function createAutoPlaylistScopedShowState_(rule, showId, mode, previousBoundaryId) {
  const ruleKey = String(rule && rule.key ? rule.key : "").trim();
  const normalizedShowId = String(showId || "").trim();
  if (!ruleKey) throw new Error("scoped state作成にはrule.keyが必要です");
  if (!normalizedShowId) throw new Error("scoped state作成にはshowIdが必要です");

  return {
    version: AUTO_PLAYLIST_SCOPED_STATE_VERSION_,
    ruleKey: ruleKey,
    showId: normalizedShowId,
    mode: String(mode || "bootstrap"),
    previousBoundaryId: String(previousBoundaryId || "").trim(),
    pendingBoundaryId: "",
    nextUrl: "",
    pagesFetched: 0,
    inspectedCount: 0,
    candidateIds: [],
    candidateCount: 0,
    reachedBoundary: false,
    retryNotBeforeMs: 0,
    complete: false
  };
}

// ---- PlaylistAutoScopedStateStore.js ----
function getAutoPlaylistScopedStateStore_() {
  return PropertiesService.getUserProperties();
}
function loadAutoPlaylistScopedState_(ruleKey, showId) {
  const key = buildAutoPlaylistScopedStateKey_(ruleKey, showId);
  const raw = getAutoPlaylistScopedStateStore_().getProperty(key);
  if (!raw) return null;

  let state;
  try {
    state = JSON.parse(raw);
  } catch (error) {
    throw new Error("V2 scoped state JSONが壊れています: " + key);
  }

  if (Number(state.version) !== AUTO_PLAYLIST_SCOPED_STATE_VERSION_) {
    throw new Error("V2 scoped state versionが一致しません: " + key);
  }
  if (String(state.ruleKey || "") !== String(ruleKey || "").trim()) {
    throw new Error("V2 scoped state ruleKeyが一致しません: " + key);
  }
  if (String(state.showId || "") !== String(showId || "").trim()) {
    throw new Error("V2 scoped state showIdが一致しません: " + key);
  }
  return state;
}
function saveAutoPlaylistScopedState_(state) {
  const source = state || {};
  if (Number(source.version) !== AUTO_PLAYLIST_SCOPED_STATE_VERSION_) {
    throw new Error("保存対象のV2 scoped state versionが不正です");
  }
  const key = buildAutoPlaylistScopedStateKey_(source.ruleKey, source.showId);
  getAutoPlaylistScopedStateStore_().setProperty(key, JSON.stringify(source));
  return key;
}
function deleteAutoPlaylistScopedState_(ruleKey, showId) {
  const key = buildAutoPlaylistScopedStateKey_(ruleKey, showId);
  getAutoPlaylistScopedStateStore_().deleteProperty(key);
  return key;
}

// ---- PlaylistAutoSheetLink.js ----
function classifyAutoPlaylistSheetRows_(rows, playlistId) {
  const wantedId = String(playlistId || "").trim();
  const matches = [];

  (Array.isArray(rows) ? rows : []).forEach(function(row, index) {
    const url = String(row && row[0] ? row[0] : "").trim();
    if (wantedId && url.indexOf(wantedId) >= 0) {
      matches.push({
        row: index + 2,
        url: url,
        title: String(row && row[1] ? row[1] : "").trim(),
        maker: String(row && row[2] ? row[2] : "").trim(),
        latestDate: String(row && row[5] ? row[5] : "").trim()
      });
    }
  });

  return {
    found: matches.length === 1,
    duplicate: matches.length > 1,
    count: matches.length,
    match: matches.length === 1 ? matches[0] : null
  };
}
function validateAutoPlaylistSheetHeaders_(headers) {
  const values = (Array.isArray(headers) ? headers : []).map(function(value) {
    return String(value || "").trim();
  });
  const required = [
    { column: 1, name: "Spotifyプレイリストのリンク" },
    { column: 6, name: "最終更新日" }
  ];
  const missing = required.filter(function(item) {
    return values[item.column - 1] !== item.name;
  }).map(function(item) { return item.name; });
  return { valid: missing.length === 0, missing: missing };
}
function inspectAutoPlaylistSheetLink_(playlistId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, WORK_SHEET_NAME);
  if (!sheet) throw new Error("作業台シートが見つかりません");

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(6, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rows = lastRow < 2
    ? []
    : sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const result = classifyAutoPlaylistSheetRows_(rows, playlistId);
  result.headerCheck = validateAutoPlaylistSheetHeaders_(headers);
  return result;
}
function assertAutoPlaylistSheetLinkBeforeWrite_(rule) {
  const playlistId = String(rule && rule.playlistId ? rule.playlistId : "").trim();
  const result = inspectAutoPlaylistSheetLink_(playlistId);

  if (!result.headerCheck || !result.headerCheck.valid) {
    throw new Error(
      "作業台の列見出しが想定と異なるためSpotify追加前に停止しました: " +
      String(result.headerCheck && result.headerCheck.missing ? result.headerCheck.missing.join(", ") : "確認不能")
    );
  }
  if (result.duplicate) {
    throw new Error(
      String(rule && rule.name ? rule.name : playlistId) +
      " の作業台行が複数あるためSpotify追加前に停止しました"
    );
  }
  if (!result.found) {
    throw new Error(
      String(rule && rule.name ? rule.name : playlistId) +
      " が作業台にないためSpotify追加前に停止しました"
    );
  }
  return result.match;
}

// ---- PlaylistAutoPageMatching.js ----
const AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_ = 500;
function mergeAutoPlaylistCandidateIds_(existingIds, newIds, maxIds) {
  const limit = Math.max(1, Number(maxIds) || AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_);
  const seen = {};
  const merged = [];

  (Array.isArray(existingIds) ? existingIds : [])
    .concat(Array.isArray(newIds) ? newIds : [])
    .forEach(function(value) {
      const id = String(value || "").trim();
      if (!id || seen[id]) return;
      if (merged.length >= limit) {
        throw new Error(
          "候補IDが安全上限 " + limit + " 件を超えました。reviewして候補を整理してから再開してください。"
        );
      }
      seen[id] = true;
      merged.push(id);
    });

  return merged;
}

// ---- PlaylistAutoEpisodes.js ----
function fetchSpotifyReadWithRetry_(url, options, contextLabel) {
  // Preserve the response contract; defer 429 instead of shortening Retry-After.
  return spotifyLegacyFetchV2_(url, options);
}
function getAutoPlaylistEpisodeCacheKey_(rule) {
  return JSON.stringify({
    showIds: getAutoPlaylistShowIds_(rule),
    fetchAllPages: rule.fetchAllPages === true,
    continueOnShowFetchError: rule.continueOnShowFetchError === true
  });
}
function fetchAutoPlaylistEpisodesCached_(rule, token, cache) {
  const key = getAutoPlaylistEpisodeCacheKey_(rule);

  if (Object.prototype.hasOwnProperty.call(cache, key)) {
    Logger.log("エピソード取得キャッシュ利用: " + rule.name);
    return cache[key];
  }

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  cache[key] = episodes;
  return episodes;
}
function fetchAutoPlaylistEpisodes_(rule, token) {
  const showIds = getAutoPlaylistShowIds_(rule);

  if (!showIds.length) {
    throw new Error(rule.name + " のShow IDが設定されていません");
  }

  const episodesByUri = {};
  const fetchAllPages = rule.fetchAllPages === true;
  const continueOnShowFetchError =
    rule.continueOnShowFetchError === true;

  showIds.forEach(function(showId) {
    let nextUrl =
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(showId) +
      "/episodes?market=JP&limit=50";

    while (nextUrl) {
      const showRes = fetchSpotifyReadWithRetry_(
        nextUrl,
        {
          muteHttpExceptions: true,
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json"
          }
        },
        "Show " + showId
      );

      if (showRes.getResponseCode() !== 200) {
        Logger.log(
          "Show取得失敗: " +
          showId +
          " | status=" +
          showRes.getResponseCode() +
          " | " +
          showRes.getContentText()
        );

        if (continueOnShowFetchError) {
          break;
        }

        throw new Error(rule.name + " のShow取得に失敗しました: " + showId);
      }

      const showData = JSON.parse(showRes.getContentText());
      const episodes = Array.isArray(showData.items) ? showData.items : [];

      episodes.forEach(function(episode) {
        const uri = String(episode && episode.uri ? episode.uri : "");
        const key = uri || (showId + "::" + String(episode && episode.id ? episode.id : ""));

        if (key) {
          episodesByUri[key] = episode;
        }
      });

      nextUrl = fetchAllPages && showData.next
        ? String(showData.next)
        : null;
    }
  });

  return Object.keys(episodesByUri).map(function(key) {
    return episodesByUri[key];
  });
}

// ---- PlaylistAutoSpotify.js ----
function getAllSpotifyPlaylistItems_(playlistId, token) {
  const allItems = [];

  let url =
    "https://api.spotify.com/v1/playlists/" +
    encodeURIComponent(playlistId) +
    "/items?market=JP&limit=100";

  while (url) {
    const response = fetchSpotifyReadWithRetry_(
      url,
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Playlist " + playlistId
    );

    const status = response.getResponseCode();
    Logger.log("Playlist page status: " + status);

    if (status !== 200) {
      Logger.log(response.getContentText());
      throw new Error("プレイリスト全件取得に失敗しました");
    }

    const data = JSON.parse(response.getContentText());

    if (Array.isArray(data.items)) {
      allItems.push.apply(allItems, data.items);
    }

    url = data.next ? String(data.next) : "";
  }

  return allItems;
}

// ---- PlaylistAutoWrite.js ----
function addAutoPlaylistEpisodesIndividually_(rule, token, episodes) {
  assertSaitoKenichiroEpisodesBeforeWrite_(rule, episodes);
  const themeWrite = assertThemeReviewSpotifyWriteV1_(rule, episodes);
  let addedCount = 0;
  let failedCount = 0;
  const addedEpisodes = [];

  episodes.forEach(function(ep) {
    assertSaitoKenichiroEpisodesBeforeWrite_(rule, [ep]);
    const addRes = spotifyLegacyFetchV2_(
      "https://api.spotify.com/v1/playlists/" +
        encodeURIComponent(rule.playlistId) +
        "/items",
      {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        headers: {
          Authorization: "Bearer " + token
        },
        payload: JSON.stringify({
          uris: [String(ep.uri)]
        })
      }
    );

    const status = addRes.getResponseCode();
    if (themeWrite && (status === 429 || status === 403)) {
      throw new Error("theme Spotify追加停止 status=" + status);
    }

    if (status === 200 || status === 201) {
      addedCount++;
      addedEpisodes.push(ep);
      Logger.log("追加成功 ✅ " + ep.name);
    } else {
      failedCount++;
      Logger.log(
        "追加不可 ⚠️ " +
        ep.name +
        " | status=" +
        status +
        " | " +
        addRes.getContentText()
      );
    }
  });

  Logger.log("追加成功件数: " + addedCount);
  Logger.log("追加不可件数: " + failedCount);

  return {
    addedCount: addedCount,
    failedCount: failedCount,
    addedEpisodes: addedEpisodes
  };
}
function addAutoPlaylistEpisodesBatch_(rule, token, episodes) {
  assertSaitoKenichiroEpisodesBeforeWrite_(rule, episodes);
  const themeWrite = assertThemeReviewSpotifyWriteV1_(rule, episodes);
  const uris = episodes.map(function(ep) {
    return String(ep.uri);
  });

  const addRes = spotifyLegacyFetchV2_(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(rule.playlistId) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({ uris: uris })
    }
  );

  Logger.log("Add status: " + addRes.getResponseCode());
  Logger.log(addRes.getContentText());

  if (
    addRes.getResponseCode() !== 200 &&
    addRes.getResponseCode() !== 201
  ) {
    throw new Error(rule.name + " への追加に失敗しました");
  }

  episodes.forEach(function(ep) {
    Logger.log("追加完了 ✅ " + ep.name);
  });
  // #412: サイトの「最終新着」を、追加した回の配信日で更新する（Spotify には問い合わせない）
  if (typeof plmNoteAdded_ === "function") plmNoteAdded_(rule.playlistId, episodes);

  const responseBody = JSON.parse(addRes.getContentText() || "{}");
  return {
    addedCount: episodes.length,
    failedCount: 0,
    addedEpisodes: episodes.slice(),
    snapshotId: String(responseBody.snapshot_id || "")
  };
}

// ---- PlaylistAuto.js ----
function syncAllAutoPlaylists() {
  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const episodeCache = {};

  getEnabledAutoPlaylistRules_().forEach(function(rule) {
    if (getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_) return;
    syncOneAutoPlaylist_(rule, token, episodeCache);
  });
}
function syncAutoPlaylistByPlaylistId_(playlistId) {
  const wantedId = String(playlistId || "").trim();
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === wantedId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + wantedId);
  }

  syncConfiguredAutoPlaylist_(rule);
}
function syncConfiguredAutoPlaylist_(rule) {
  if (getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    throw new Error("themeは候補確認・人間承認経路を使用してください");
  }
  if (rule && rule.enabled === false) {
    throw new Error("自動更新を停止中です: " + String(rule.name || rule.key || "unknown"));
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  syncOneAutoPlaylist_(rule, token);
}
function getLatestReleaseDate_(episodes) {
  // #432: 日本時間の配信日にそろえる（PlaylistJstDate.js）。無ければ従来通り Spotify の release_date
  if (typeof pjdWithJstDates_ === "function") episodes = pjdWithJstDates_(episodes);
  return (episodes || [])
    .map(function(ep) {
      return String(ep && ep.release_date ? ep.release_date : "").trim();
    })
    .filter(Boolean)
    .sort()
    .pop() || "";
}
function syncOneAutoPlaylist_(rule, token, episodeCache) {
  if (getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    throw new Error("themeのキーワード一致による直接追加は禁止です");
  }
  Logger.log("=== " + rule.name + " ===");

  const episodes = episodeCache
    ? fetchAutoPlaylistEpisodesCached_(rule, token, episodeCache)
    : fetchAutoPlaylistEpisodes_(rule, token);

  const playlistItems =
    getAllSpotifyPlaylistItems_(rule.playlistId, token);

  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  const candidates = episodes.filter(function(ep) {
    return matchesAutoPlaylistRule_(ep, rule);
  });

  const newEpisodes = candidates.filter(function(ep) {
    const uri = String(ep && ep.uri ? ep.uri : "");
    return uri && !existingUris.has(uri);
  });

  Logger.log("判定通過件数: " + candidates.length);
  Logger.log("新規追加対象: " + newEpisodes.length);

  if (!newEpisodes.length) {
    Logger.log(
      candidates.length
        ? "判定通過候補はすべて登録済みです ✅"
        : "追加対象なし ✅"
    );
    return;
  }

  if (rule.requireSheetLinkBeforeWrite === true) {
    assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  }

  const dateContext = rule.updateLatestDateOnAdd === true ? prepareAutoLatestDateReflectionV1_(rule) : null;
  if (rule.addIndividually === true) {
    const result =
      addAutoPlaylistEpisodesIndividually_(rule, token, newEpisodes);

    if (
      result.addedCount > 0 &&
      rule.updateLatestDateOnAdd === true
    ) {
      reflectAddedAutoLatestDateV1_(rule, result.addedEpisodes, dateContext);
    }

    return;
  }

  addAutoPlaylistEpisodesBatch_(rule, token, newEpisodes);

  if (rule.updateLatestDateOnAdd === true) {
    reflectAddedAutoLatestDateV1_(rule, newEpisodes, dateContext);
  }
}

// ---- PlaylistAutoDryRun.js ----
function otaMasahikoExistingPlaylistAuditClassification_(
  classification,
  reasons,
  matchedField,
  matchedSection,
  excerpt
) {
  return {
    classification: classification,
    reasons: reasons,
    matchedField: matchedField,
    matchedSection: matchedSection,
    excerpt: excerpt
  };
}
function extractOtaMasahikoExistingPlaylistAuditCreditSections_(text) {
  const lines = String(text || "").split(/\n/).map(function(line) {
    return String(line || "").trim();
  });
  const namePattern = /太田[\s　]*匡彦/;
  const ambiguousCreditHeadingPattern =
    /^[\s　]*[【\[（(■◆●▼▽◇・]*[\s　]*(出演[\s　]*[・／/][\s　]*スタッフ|スタッフ[\s　]*[・／/][\s　]*出演)(?=[\s　]*(?:[】\]）):：■◆●▼▽◇・]|$)|[\s　]+)/i;
  const confirmedCreditHeadingPattern =
    /^[\s　]*[【\[（(■◆●▼▽◇・]*[\s　]*(出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)(?=[\s　]*(?:[】\]）):：■◆●▼▽◇・]|$)|[\s　]+)/i;
  const announcementHeadingPattern =
    /^[\s　]*[【\[（(■◆●▼▽◇・]*[\s　]*(イベント|お知らせ|番組からのお知らせ|次回|次回予告|関連記事|関連リンク|過去回|キャンペーン|応募|購読|配信|SNS|X|Twitter|お問い合わせ|朝日新聞デジタル)(?=[\s　]*(?:[】\]）):：■◆●▼▽◇・]|$)|[\s　]+)/i;
  const nonAppearanceRolePattern = /(編集|制作|音源|取材協力|構成|技術|デザイン|写真|撮影)/;
  const announcementContextPattern =
    /(イベント|告知|お知らせ|登壇|次回|次回予告|関連記事|関連リンク|過去回|申し込み|申込み|応募|キャンペーン|詳しくはこちら|購読|配信予定)/;
  let sectionType = "other";
  let sectionName = "";
  let sectionLineCount = 0;
  let mentionCount = 0;
  let announcementMentionCount = 0;
  let confirmedMatch = null;
  let ambiguousCreditMatch = null;
  let announcementMatch = null;
  let otherMatch = null;

  lines.forEach(function(line) {
    if (!line) return;

    let headingMatch = line.match(ambiguousCreditHeadingPattern);
    if (headingMatch) {
      sectionType = "ambiguous_credit";
      sectionName = String(headingMatch[1] || "出演・スタッフ");
      sectionLineCount = 0;
    } else {
      headingMatch = line.match(confirmedCreditHeadingPattern);
      if (headingMatch) {
        sectionType = "confirmed_credit";
        sectionName = String(headingMatch[1] || "出演");
        sectionLineCount = 0;
      } else {
        headingMatch = line.match(announcementHeadingPattern);
        if (headingMatch) {
          sectionType = "announcement";
          sectionName = String(headingMatch[1] || "announcement");
          sectionLineCount = 0;
        } else {
          sectionLineCount++;
          if (sectionType !== "other" && sectionLineCount > 12) {
            sectionType = "other";
            sectionName = "";
            sectionLineCount = 0;
          }
        }
      }
    }

    const mentions = line.match(new RegExp(namePattern.source, "g"));
    if (!mentions || !mentions.length) return;

    mentionCount += mentions.length;
    const match = {
      section: sectionName || sectionType,
      excerpt: createOtaMasahikoExistingPlaylistAuditExcerpt_(line)
    };

    if (sectionType === "confirmed_credit") {
      if (nonAppearanceRolePattern.test(line)) {
        if (!ambiguousCreditMatch) ambiguousCreditMatch = match;
      } else if (!confirmedMatch) {
        confirmedMatch = match;
      }
      return;
    }

    if (sectionType === "ambiguous_credit") {
      if (!ambiguousCreditMatch) ambiguousCreditMatch = match;
      return;
    }

    if (sectionType === "announcement" || announcementContextPattern.test(line)) {
      announcementMentionCount += mentions.length;
      if (!announcementMatch) announcementMatch = match;
      return;
    }

    if (!otherMatch) otherMatch = match;
  });

  return {
    mentionCount: mentionCount,
    announcementMentionCount: announcementMentionCount,
    confirmedMatch: confirmedMatch,
    ambiguousCreditMatch: ambiguousCreditMatch,
    announcementMatch: announcementMatch,
    otherMatch: otherMatch
  };
}
function normalizeOtaMasahikoExistingPlaylistAuditText_(value, isHtml) {
  let text = String(value || "");

  if (isHtml) {
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|section|article)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "");
  }

  return text
    .replace(/\r\n?/g, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, function(_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-f]+);/gi, function(_, code) {
      return String.fromCharCode(parseInt(code, 16));
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function createOtaMasahikoExistingPlaylistAuditExcerpt_(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= 240) return text;

  const match = text.match(/太田[\s　]*匡彦/);
  if (!match) return text.substring(0, 240);

  const start = Math.max(0, match.index - 100);
  const end = Math.min(text.length, match.index + match[0].length + 100);

  return (
    (start > 0 ? "…" : "") +
    text.substring(start, end) +
    (end < text.length ? "…" : "")
  );
}

// ---- PlaylistAutoDryRunOtaAuditV2.js ----
function classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode) {
  if (!episode) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "unresolved", ["playlist_episode_missing"], "", "", ""
    );
  }

  const name = String(episode.name || "").trim();
  const description = normalizeOtaMasahikoExistingPlaylistAuditText_(
    episode.description,
    false
  );
  const htmlDescription = normalizeOtaMasahikoExistingPlaylistAuditText_(
    episode.html_description,
    true
  );

  if (!name && !description && !htmlDescription) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "unresolved", ["episode_metadata_missing"], "", "", ""
    );
  }

  if (!description && !htmlDescription) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "unresolved", ["episode_description_missing"], "", "", ""
    );
  }

  const fields = [
    { name: "description", text: description },
    { name: "html_description", text: htmlDescription }
  ];

  let confirmedMatch = null;
  let narrativeAppearanceMatch = null;
  let otherMatch = null;
  let promoMatch = null;
  let keptMentionCount = 0;
  let promoMentionCount = 0;

  fields.forEach(function(field) {
    if (!field.text) return;

    const stripped = stripOtaMasahikoKnownAnnouncementLines_(field.text);
    promoMentionCount += stripped.removedMentionCount;
    if (!promoMatch && stripped.firstRemovedExcerpt) {
      promoMatch = {
        field: field.name,
        section: "known_event_announcement",
        excerpt: stripped.firstRemovedExcerpt
      };
    }

    const analysis = extractOtaMasahikoExistingPlaylistAuditCreditSections_(
      stripped.text
    );
    keptMentionCount += analysis.mentionCount;

    if (!confirmedMatch && analysis.confirmedMatch) {
      confirmedMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.confirmedMatch
      );
    }

    // 「出演・スタッフ」欄は、既知の告知行を先に除外した後なら
    // 太田匡彦本人のクレジットとして扱う。
    if (!confirmedMatch && analysis.ambiguousCreditMatch) {
      confirmedMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.ambiguousCreditMatch
      );
    }

    if (!narrativeAppearanceMatch && analysis.otherMatch &&
        isOtaMasahikoNarrativeAppearanceContext_(analysis.otherMatch.excerpt)) {
      narrativeAppearanceMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.otherMatch
      );
    }

    if (!otherMatch && analysis.otherMatch) {
      otherMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.otherMatch
      );
    }
  });

  if (confirmedMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "confirmed",
      ["name_found_in_credit_section_after_known_announcement_removed"],
      confirmedMatch.field,
      confirmedMatch.section,
      confirmedMatch.excerpt
    );
  }

  if (narrativeAppearanceMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "confirmed",
      ["name_found_in_narrative_appearance_context"],
      narrativeAppearanceMatch.field,
      narrativeAppearanceMatch.section,
      narrativeAppearanceMatch.excerpt
    );
  }

  if (promoMentionCount > 0 && keptMentionCount === 0 && promoMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "false_positive",
      ["all_name_mentions_are_in_known_event_announcement"],
      promoMatch.field,
      promoMatch.section,
      promoMatch.excerpt
    );
  }

  if (otherMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review",
      ["name_found_outside_credit_section", "appearance_not_confirmed"],
      otherMatch.field,
      otherMatch.section,
      otherMatch.excerpt
    );
  }

  if (/太田[\s　]*匡彦/.test(name)) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review",
      ["name_found_in_episode_title", "appearance_not_confirmed_in_description"],
      "name",
      "episode_title",
      createOtaMasahikoExistingPlaylistAuditExcerpt_(name)
    );
  }

  if (promoMentionCount > 0 && promoMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "false_positive",
      ["known_event_announcement_only_after_cleanup"],
      promoMatch.field,
      promoMatch.section,
      promoMatch.excerpt
    );
  }

  return otaMasahikoExistingPlaylistAuditClassification_(
    "review",
    ["name_not_found", "existing_playlist_membership_requires_manual_review"],
    "",
    "",
    ""
  );
}
function stripOtaMasahikoKnownAnnouncementLines_(text) {
  const lines = String(text || "").split(/\n/);
  const namePattern = /太田[\s　]*匡彦/g;
  const kept = [];
  let removedMentionCount = 0;
  let firstRemovedExcerpt = "";

  lines.forEach(function(rawLine) {
    const line = String(rawLine || "");
    const nameMatches = line.match(namePattern) || [];
    const isKnownPromo = isOtaMasahikoKnownAnnouncementLine_(line);

    if (isKnownPromo) {
      removedMentionCount += nameMatches.length;
      if (!firstRemovedExcerpt && nameMatches.length) {
        firstRemovedExcerpt = createOtaMasahikoExistingPlaylistAuditExcerpt_(line);
      }
      return;
    }

    kept.push(line);
  });

  return {
    text: kept.join("\n"),
    removedMentionCount: removedMentionCount,
    firstRemovedExcerpt: firstRemovedExcerpt
  };
}
function isOtaMasahikoKnownAnnouncementLine_(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text) return false;

  // 2025年5月末の1億DL記念イベント告知で、多数の無関係回に
  // 同じ出演者列が差し込まれたケースを明示的に除外する。
  if (/朝ポキメンバーも多数参加/.test(text) && /太田[\s　]*匡彦/.test(text)) {
    return true;
  }

  // 装飾付き見出し「【祝・1億DL！ 5\/31（土）イベント】」等も
  // 告知ブロックとして扱う。ただし氏名がない見出し自体は、
  // この関数では削除しても判定結果に影響しない。
  if (/1億DL/.test(text) && /5\s*\/\s*31/.test(text) && /イベント/.test(text)) {
    return true;
  }

  return false;
}
function isOtaMasahikoNarrativeAppearanceContext_(excerpt) {
  const text = String(excerpt || "");
  if (!/太田[\s　]*匡彦/.test(text)) return false;

  return /(記者に聞きました|記者に聞く|記者と考えます|記者が警鐘|記者が解説|太田[\s　]*匡彦記者|太田[\s　]*匡彦さん|太田[\s　]*匡彦氏)/.test(text);
}
function wrapOtaMasahikoAuditMatchV2_(fieldName, match) {
  return {
    field: fieldName,
    section: String(match && match.section ? match.section : ""),
    excerpt: String(match && match.excerpt ? match.excerpt : "")
  };
}

// ---- PlaylistAutoV2DryRunEngine.js ----
function buildAutoPlaylistV2InitialUrl_(showId) {
  return "https://api.spotify.com/v1/shows/" + encodeURIComponent(String(showId || "")) +
    "/episodes?market=JP&limit=50";
}

// ---- PlaylistAutoSatoYoLaunch.js ----
const SATOYO_LAUNCH_={playlistId:"73ppqrTcsjVgl1xwIZa4SY",ids:[
"3MPwacUdMc3xdp9AFSAf5B","6nRB54icoj8PieyRl6CQN2","4OiMLEbjxSdIreJ06M0kzR","2qpiFKzeVWLARvYQrV3L8u","3qaWoz8qlcUZDxa4OPdXsT","2flvxQlxyaVtKjuiL6Tlp7","2rfCZS0InpM2khFZDA1cEW","4UKrZ0TQxpNaVZISiEroaN","35jfqWmuiOCgvvB0dsgRoM","18uD3rbjLqIjNJlbX0wHrj","494udjmF1GLJ6LPWQJ11iq","7k1gIouQkeIjUPfyASIYo3","1kQLh01qZUmu65w3a8FCRu","3vCdfqVQcOcM19uukqoEky"]};
function buildSatoYoOnsaLaunchPlan_(token){
 const expectedUris=SATOYO_LAUNCH_.ids.map(function(id){return "spotify:episode:"+id;});
 const expectedSet=new Set(expectedUris);
 const items=getAllSpotifyPlaylistItems_(SATOYO_LAUNCH_.playlistId,token);
 const actualUris=items.map(function(row){return String(row&&row.item&&row.item.uri||"");}).filter(Boolean);
 const unexpectedUris=actualUris.filter(function(uri){return !expectedSet.has(uri);});
 const duplicateUris=actualUris.filter(function(uri,i){return actualUris.indexOf(uri)!==i;});
 const actualSet=new Set(actualUris);
 const missingUris=expectedUris.filter(function(uri){return !actualSet.has(uri);});
 const safeToRun=unexpectedUris.length===0&&duplicateUris.length===0;
 return {dryRun:true,spotifyWrite:false,spreadsheetWrite:false,safeToRun:safeToRun,reason:unexpectedUris.length?"unexpected existing item":duplicateUris.length?"duplicate existing item":"",currentCount:actualUris.length,expectedCount:expectedUris.length,missingCount:missingUris.length,missingUris:missingUris,unexpectedUris:unexpectedUris,duplicateUris:duplicateUris};
}

// ---- PlaylistAutoSatoYoIndividual.js ----
function launchSatoYoOnsaEpisodesIndividual(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw new Error("Another update is running");
 try{
  const token=getSpotifyUserAccessToken();
  const plan=buildSatoYoOnsaLaunchPlan_(token);
  if(!plan.safeToRun)throw new Error("Safety stop: "+plan.reason);
  const episodes=plan.missingUris.map(function(uri){return {uri:uri,name:uri};});
  const addResult=addAutoPlaylistEpisodesIndividually_({playlistId:SATOYO_LAUNCH_.playlistId},token,episodes);
  const after=buildSatoYoOnsaLaunchPlan_(token);
  if(after.missingCount!==0||after.unexpectedUris.length||after.duplicateUris.length)throw new Error("Post-check failed: "+JSON.stringify({addResult:addResult,after:after}));
  updatePlaylistLatestDate_(SATOYO_LAUNCH_.playlistId);
  const result={ok:true,spotifyAddedCount:plan.missingCount,expectedCount:14};
  Logger.log(JSON.stringify(result));
  return result;
 }finally{lock.releaseLock();}
}
