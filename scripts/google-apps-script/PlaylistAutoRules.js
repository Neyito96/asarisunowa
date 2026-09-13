// プレイリスト自動更新ルール定義・判定

const AUTO_PLAYLIST_RULES = [
  {
    name: "一緒に新聞をめくろう！",
    showId: "392h0MYfvMTndEVzf2cOvC",
    playlistId: "4tY0lHoV8IemMBp4iTnKnl",
    keyword: "めくろう"
  },
  {
    name: "木下君、あの動画みた？ #きのどう",
    showId: "0yhef9ORZkUZs9ZeotdCSY",
    playlistId: "6nDhZQG75F1wU62sdcYJMq",
    keyword: "動画みた？"
  },
  {
    name: "豊秀一",
    showIds: [
      "7euH6hzudIdp61JRSi9E8w",
      "0341I5UOUrJgm7KEvNGInZ",
      "0yhef9ORZkUZs9ZeotdCSY",
      "392h0MYfvMTndEVzf2cOvC",
      "5Dt1uyQaJpM6hPV8aEMP3R",
      "1KExdSsjQnatS4TdseGoC0",
      "2uG9W6CnsaNi87AfSuGe8r"
    ],
    playlistId: "4Ri6rxTGFimTm0KkZtKfBZ",
    keywords: ["豊秀一", "豊 秀一"],
    fields: ["name", "description", "html_description"],
    fetchAllPages: true,
    continueOnShowFetchError: true,
    addIndividually: true,
    updateLatestDateOnAdd: true
  }
];

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
  const fields =
    Array.isArray(rule.fields) && rule.fields.length
      ? rule.fields
      : ["name"];

  return fields.map(function(field) {
    return String(
      episode && episode[field] != null
        ? episode[field]
        : ""
    );
  }).join("\n");
}

function matchesAutoPlaylistRule_(episode, rule) {
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
