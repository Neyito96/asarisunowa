// プレイリスト自動更新ルール定義・判定

// 朝日新聞ポッドキャスト公式の一次ソース番組群。
// 二次プレイリストの自動更新は、原則としてこの共通ソースから検索する。
// アルキキ / AJW は対象外。
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
const AUTO_PLAYLIST_RULES = [
  {
    key: "issho-shinbun",
    enabled: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "一緒に新聞をめくろう！",
    showIds: ["392h0MYfvMTndEVzf2cOvC"],
    playlistId: "4tY0lHoV8IemMBp4iTnKnl",
    keyword: "めくろう"
  },
  {
    key: "kino-douga",
    enabled: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "木下君、あの動画みた？ #きのどう",
    showIds: ["0yhef9ORZkUZs9ZeotdCSY"],
    playlistId: "6nDhZQG75F1wU62sdcYJMq",
    keyword: "動画みた？"
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
    enabled: false,
    lifecycleStatus: "requested",
    productionWriteAllowed: false,
    reviewRequired: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    name: "農MUSIC 猟ライフ（ノーミライ）",
    showIds: ["0341I5UOUrJgm7KEvNGInZ"],
    playlistId: "4FBXSFf2nLjLb3qaRoSdoD",
    keyword: "（ノーミライ #",
    matchStrategy: "no-mirai-title-prefix",
    fetchAllPages: true
  },
  {
    key: "sato-yo",
    enabled: false,
    lifecycleStatus: "requested",
    productionWriteAllowed: false,
    reviewRequired: true,
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
    enabled: false,
    lifecycleStatus: "requested",
    productionWriteAllowed: false,
    reviewRequired: true,
    ruleType: AUTO_PLAYLIST_RULE_TYPE_THEME_,
    name: "南米 中南米",
    showIds: ASAHI_PRIMARY_SHOW_IDS,
    playlistId: "2Org6cCBgVas4d9OwzzxAv",
    keywords: ["南米", "中南米", "メキシコ", "ブラジル", "ベネズエラ", "キューバ"],
    fields: ["name", "description", "html_description"],
    fetchAllPages: true,
    continueOnShowFetchError: true,
    addIndividually: true,
    updateLatestDateOnAdd: true,
    requireSheetLinkBeforeWrite: true
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

function matchesAutoPlaylistRule_(episode, rule) {
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
    return text.indexOf(String(keyword)) >= 0;
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
      return text.indexOf(String(keyword)) >= 0;
    });
  }

  return includeKeywords.some(function(keyword) {
    return text.indexOf(String(keyword)) >= 0;
  });
}

function extractNoMiraiEpisodeNumber_(title) {
  const normalized = String(title || "").normalize("NFKC");
  const match = normalized.match(
    /^\((?:ノーミライ|農M\s*[,、]\s*猟L)\s*#\s*(\d+)\)/
  );
  return match ? Number(match[1]) : null;
}
