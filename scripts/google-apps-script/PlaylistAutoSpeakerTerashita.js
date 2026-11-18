// 寺下真理加 出演回：安全判定 v2
// おんささんツールの18本を教師データとして回帰確認する。
// Spotify / スプレッドシートへの書き込みは行わない。

const TERASHITA_MARIKA_PLAYLIST_ID_ = "1qhNqjSTfwvJP3cQaXg9bn";

const TERASHITA_MARIKA_GOLD_EPISODE_IDS_ = [
  "2yegbN9oiNnHKkIteH9zYx",
  "37imZCxynSwuXXZ0sGx4sX",
  "2SfupTguGDr7AHDSeLPOxd",
  "3CaXbjwWd7Rn2LqmnXycrC",
  "4DDhBYUyqjPabW3yR6TMvK",
  "0VZfh55Ei3nFtHlF5zHerZ",
  "7LkOQ1nxlfNpbbeSVjlM1I",
  "3iDFO9rVrYUgmHC95u5Yla",
  "3f81O9lPfCEstIxloOr6TS",
  "3qaWoz8qlcUZDxa4OPdXsT",
  "5MfBUujHIorYNmkholT6kO",
  "1QfU3kQxTOSqKEB7B5zBPz",
  "3FPIn7EVJ98V9HU6Zd0axi",
  "7FGfBUs9P9qBi4MXxTDjbN",
  "62KVBDypYUOWJdKJiErEpL",
  "680Sn41gAKfjsV25yXLa7m",
  "1IrdVnYtC4CUSlVtgLCg2c",
  "5KE1POQTtQmWxv3WV4nYss"
];


function classifyTerashitaMarikaAutoPlaylistEpisodeV2_(episode) {
  return classifySpeakerEpisodeWithGuardrail_(
    episode,
    { requireEpisodeIdentity: true },
    classifyTerashitaMarikaEpisodeEvidenceV2_
  );
}


function classifyTerashitaMarikaEpisodeEvidenceV2_(episode) {
  const title = String(episode && episode.name || "").trim();

  // 1on1で本人名がタイトルにある場合は出演確定。
  if (
    /(?:^|[（(])1on1[）)]?/.test(title) &&
    /寺下[\s　]*真理加/.test(title)
  ) {
    return terashitaMarikaClassificationV2_(
      "confirmed",
      "name_confirmed_in_1on1_title",
      title
    );
  }

  const description = normalizeTerashitaMarikaTextV2_(
    episode && episode.description,
    false
  );
  const htmlDescription = normalizeTerashitaMarikaTextV2_(
    episode && episode.html_description,
    true
  );

  if (!description && !htmlDescription) {
    return terashitaMarikaClassificationV2_(
      "unresolved",
      "description_missing",
      ""
    );
  }

  const analyses = [description, htmlDescription]
    .filter(Boolean)
    .map(analyzeTerashitaMarikaTextV2_);

  const confirmed = analyses.find(function(result) {
    return result.confirmedExcerpt;
  });

  if (confirmed) {
    return terashitaMarikaClassificationV2_(
      "confirmed",
      "appearance_confirmed",
      confirmed.confirmedExcerpt
    );
  }

  const mentionCount = analyses.reduce(function(sum, result) {
    return sum + result.mentionCount;
  }, 0);

  const announcementMentionCount = analyses.reduce(function(sum, result) {
    return sum + result.announcementMentionCount;
  }, 0);

  const firstExcerpt = analyses.reduce(function(found, result) {
    return found || result.firstExcerpt;
  }, "");

  if (mentionCount > 0 && mentionCount === announcementMentionCount) {
    return terashitaMarikaClassificationV2_(
      "false_positive",
      "announcement_only",
      firstExcerpt
    );
  }

  if (mentionCount > 0) {
    return terashitaMarikaClassificationV2_(
      "review",
      "name_found_without_appearance_confirmation",
      firstExcerpt
    );
  }

  // 1on1以外でタイトルだけに名前がある場合は自動採用しない。
  if (/寺下[\s　]*真理加/.test(title)) {
    return terashitaMarikaClassificationV2_(
      "review",
      "name_in_title_without_description_confirmation",
      title
    );
  }

  return terashitaMarikaClassificationV2_(
    "false_positive",
    "name_not_found_after_announcement_filter",
    ""
  );
}


function analyzeTerashitaMarikaTextV2_(text) {
  const lines = String(text || "")
    .split(/\n/)
    .map(function(line) {
      return String(line || "").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);

  const namePattern = /寺下[\s　]*真理加/;

  const ambiguousCreditHeadingPattern =
    /^(?:【|\[|（|\()?\s*(出演\s*[・／/]\s*スタッフ|スタッフ\s*[・／/]\s*出演)(?:】|\]|）|\)|:|：|\s|$)/i;

  const confirmedHeadingPattern =
    /^(?:【|\[|（|\()?\s*(出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)(?:】|\]|）|\)|:|：|\s|$)/i;

  const announcementHeadingPattern =
    /^(?:【|\[|（|\()?\s*(イベント|お知らせ|番組からのお知らせ|次回|次回予告|関連記事|関連リンク|過去回|キャンペーン|応募|購読|配信|SNS|X|Twitter|お問い合わせ|朝日新聞デジタル)(?:】|\]|）|\)|:|：|\s|$)/i;

  const genericHeadingPattern =
    /^(?:(?:【[^】]{1,40}】|\[[^\]]{1,40}\]|（[^）]{1,40}）|\([^)]{1,40}\))\s*$|[^。！？\n]{1,24}[：:]\s*)/;

  const announcementContextPattern =
    /(イベント|告知|お知らせ|登壇|公開収録|会場|チケット|参加者|メンバーも多数参加|周年|記念グッズ|次回|次回予告|関連記事|関連リンク|過去回|申し込み|申込み|応募|キャンペーン|詳しくはこちら|購読|配信予定)/;

  const nonAppearanceRolePattern =
    /(編集|制作|音源|取材協力|構成|技術|デザイン|写真|撮影|執筆|記事)/;

  const appearanceByNamePattern =
    /寺下[\s　]*真理加(?:記者|さん|氏)?(?:が|に|と|を)?(?:話|聞|解説|説明|出演|登場|語|招|迎)/;

  const appearanceInSentencePattern =
    /寺下[\s　]*真理加(?:記者|さん|氏)?(?:(?![。！？\n]).){0,80}(?:話|聞|解説|説明|出演|登場|語|招|迎)/;

  const roleListPattern =
    /(?:出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)[^。\n]{0,50}寺下[\s　]*真理加/;

  let section = "other";
  let sectionLines = 0;
  let mentionCount = 0;
  let announcementMentionCount = 0;
  let confirmedExcerpt = "";
  let firstExcerpt = "";

  lines.forEach(function(line) {
    if (ambiguousCreditHeadingPattern.test(line)) {
      section = "ambiguous_credit";
      sectionLines = 0;
    } else if (confirmedHeadingPattern.test(line)) {
      section = "confirmed";
      sectionLines = 0;
    } else if (announcementHeadingPattern.test(line)) {
      section = "announcement";
      sectionLines = 0;
    } else if (genericHeadingPattern.test(line)) {
      section = "other";
      sectionLines = 0;
    } else {
      sectionLines += 1;
      if (sectionLines > 12) {
        section = "other";
        sectionLines = 0;
      }
    }

    const mentions =
      line.match(new RegExp(namePattern.source, "g")) || [];

    if (!mentions.length) return;

    mentionCount += mentions.length;

    if (!firstExcerpt) {
      firstExcerpt = line.substring(0, 240);
    }

    // 告知ブロック内の氏名は出演根拠にしない。
    if (
      section === "announcement" ||
      announcementContextPattern.test(line)
    ) {
      announcementMentionCount += mentions.length;
      return;
    }

    // 「出演・スタッフ」は太田匡彦ルールと同じく、
    // 非出演役割でなければ出演根拠として扱う。
    if (
      section === "ambiguous_credit" &&
      !nonAppearanceRolePattern.test(line)
    ) {
      if (!confirmedExcerpt) {
        confirmedExcerpt = line.substring(0, 240);
      }
      return;
    }

    if (
      section === "confirmed" &&
      !nonAppearanceRolePattern.test(line)
    ) {
      if (!confirmedExcerpt) {
        confirmedExcerpt = line.substring(0, 240);
      }
      return;
    }

    if (
      !nonAppearanceRolePattern.test(line) &&
      (
        appearanceByNamePattern.test(line) ||
        appearanceInSentencePattern.test(line) ||
        roleListPattern.test(line)
      )
    ) {
      if (!confirmedExcerpt) {
        confirmedExcerpt = line.substring(0, 240);
      }
    }
  });

  return {
    mentionCount: mentionCount,
    announcementMentionCount: announcementMentionCount,
    confirmedExcerpt: confirmedExcerpt,
    firstExcerpt: firstExcerpt
  };
}


function normalizeTerashitaMarikaTextV2_(value, isHtml) {
  let text = String(value || "");

  if (isHtml) {
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|section|article)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "");
  }

  text = text
    .replace(/\r\n?/g, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#xff01;/gi, "！")
    .replace(/&#xff08;/gi, "（")
    .replace(/&#xff09;/gi, "）");

  // Spotifyのplain descriptionでは各見出しが1行につながる場合がある。
  // 【番組内容】【関連記事】【出演・スタッフ】などを必ず独立行にする。
  text = text.replace(
    /\s*(【(?:番組内容|関連記事|出演・スタッフ|スタッフ・出演|出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター|イベント|お知らせ|番組からのお知らせ)[^】]*】)/g,
    "\n$1"
  );

  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function dryRunTerashitaMarikaRegressionV2() {
  const rules = loadAutoUpdateRuntimeRulesV1_();

  const rule = rules.find(function(r) {
    return String(r && r.playlistId || "") ===
      TERASHITA_MARIKA_PLAYLIST_ID_;
  });

  if (!rule) {
    throw new Error("寺下真理加ルールが見つかりません");
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error(
      "Spotifyユーザー認証トークンを取得できません"
    );
  }

  // 保存済み初回候補
  let candidateIds = [];

  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const state =
      loadAutoPlaylistScopedState_(rule.key, showId);

    if (!state || !Array.isArray(state.candidateIds)) return;

    candidateIds = candidateIds.concat(state.candidateIds);
  });

  // 起点回も評価対象に入れる
  candidateIds.push(rule.bootstrapSeedEpisodeId);

  candidateIds = Array.from(
    new Set(
      candidateIds
        .map(String)
        .filter(Boolean)
    )
  );

  const episodes =
  fetchTerashitaRegressionEpisodesBatchV3_(
    candidateIds,
    token
  );

  const gold = new Set(
    TERASHITA_MARIKA_GOLD_EPISODE_IDS_
  );

  const rows = episodes.map(function(ep) {
    const classification =
      classifyTerashitaMarikaAutoPlaylistEpisodeV2_(ep);

    const expected = gold.has(String(ep.id || ""));
    const actual =
      classification.classification === "confirmed";

    return {
      id: String(ep.id || ""),
      releaseDate: String(ep.release_date || ""),
      title: String(ep.name || ""),
      expectedConfirmed: expected,
      actualConfirmed: actual,
      classification: classification.classification,
      reason: classification.reason,
      pass: expected === actual
    };
  });

  const missingGold =
    TERASHITA_MARIKA_GOLD_EPISODE_IDS_
      .filter(function(id) {
        return !rows.some(function(row) {
          return row.id === id;
        });
      });

  const falseNegatives = rows.filter(function(row) {
    return row.expectedConfirmed && !row.actualConfirmed;
  });

  const falsePositives = rows.filter(function(row) {
    return !row.expectedConfirmed && row.actualConfirmed;
  });

  const review = rows.filter(function(row) {
    return row.classification === "review";
  });

  Logger.log(
    "=== 寺下真理加 REGRESSION V2 ==="
  );
  Logger.log("評価件数: " + rows.length);
  Logger.log(
    "正解18本の取得漏れ: " + missingGold.length
  );
  Logger.log(
    "false negative: " + falseNegatives.length
  );
  Logger.log(
    "false positive: " + falsePositives.length
  );
  Logger.log("review: " + review.length);

  falseNegatives.forEach(function(row) {
    Logger.log(
      "FN | " +
      row.releaseDate +
      " | " +
      row.title +
      " | " +
      row.id +
      " | " +
      row.reason
    );
  });

  falsePositives.forEach(function(row) {
    Logger.log(
      "FP | " +
      row.releaseDate +
      " | " +
      row.title +
      " | " +
      row.id +
      " | " +
      row.reason
    );
  });

  review.forEach(function(row) {
    Logger.log(
      "REVIEW | " +
      row.releaseDate +
      " | " +
      row.title +
      " | " +
      row.id +
      " | " +
      row.reason
    );
  });

  Logger.log(
    "Spotify書き込み: なし / シート書き込み: なし"
  );

  return {
    dryRun: true,
    spotifyWrite: false,
    spreadsheetWrite: false,
    evaluatedCount: rows.length,
    missingGoldCount: missingGold.length,
    falseNegativeCount: falseNegatives.length,
    falsePositiveCount: falsePositives.length,
    reviewCount: review.length,
    ready:
      missingGold.length === 0 &&
      falseNegatives.length === 0 &&
      falsePositives.length === 0
  };
}
function fetchTerashitaRegressionEpisodesV2_(episodeIds, token) {
  const ids = Array.from(new Set(
    (episodeIds || []).map(function(id) {
      return String(id || "").trim();
    }).filter(Boolean)
  ));

  const episodes = [];

  ids.forEach(function(id) {
    const response = fetchSpotifyReadWithRetry_(
      "https://api.spotify.com/v1/episodes/" +
        encodeURIComponent(id) +
        "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Terashita regression episode " + id
    );

    if (response.getResponseCode() !== 200) {
      Logger.log(
        "詳細取得失敗 | " +
        id +
        " | status=" +
        response.getResponseCode()
      );
      return;
    }

    const episode = JSON.parse(response.getContentText());

    if (!episode || episode.is_playable === false) return;

    episodes.push({
      id: String(episode.id || ""),
      uri: String(
        episode.uri ||
        ("spotify:episode:" + String(episode.id || ""))
      ),
      name: String(episode.name || ""),
      release_date: String(episode.release_date || ""),
      description: String(episode.description || ""),
      html_description: String(episode.html_description || "")
    });
  });

  Logger.log(
    "詳細取得確認: " +
    episodes.length +
    "件 / descriptionあり=" +
    episodes.filter(function(ep) {
      return String(ep.description || "").trim();
    }).length
  );

  return episodes;
}
function diagnoseTerashitaEpisodeDetailV2() {
  const token = getSpotifyUserAccessToken();

  const episodes = fetchTerashitaRegressionEpisodesV2_(
    ["4DDhBYUyqjPabW3yR6TMvK"],
    token
  );

  Logger.log(JSON.stringify(episodes, null, 2));
}
function diagnoseTerashitaFalseNegativeContextV2() {
  const token = getSpotifyUserAccessToken();

  const ids = [
    "3qaWoz8qlcUZDxa4OPdXsT",
    "4DDhBYUyqjPabW3yR6TMvK",
    "0VZfh55Ei3nFtHlF5zHerZ",
    "7LkOQ1nxlfNpbbeSVjlM1I",
    "3iDFO9rVrYUgmHC95u5Yla",
    "3f81O9lPfCEstIxloOr6TS",
    "5MfBUujHIorYNmkholT6kO",
    "1QfU3kQxTOSqKEB7B5zBPz",
    "3FPIn7EVJ98V9HU6Zd0axi",
    "7FGfBUs9P9qBi4MXxTDjbN",
    "62KVBDypYUOWJdKJiErEpL",
    "680Sn41gAKfjsV25yXLa7m",
    "1IrdVnYtC4CUSlVtgLCg2c",
    "5KE1POQTtQmWxv3WV4nYss"
  ];

  const episodes =
    fetchTerashitaRegressionEpisodesBatchV3_(ids, token);

  episodes.forEach(function(ep) {
    const text = [
      ep.description || "",
      ep.html_description || ""
    ].join("\n");
text = stripTerashitaKnownEventPromoV3_(text);
    const lines = text.split(/\n/);

    Logger.log(
      "\n=== " +
      ep.release_date +
      " | " +
      ep.name +
      " | " +
      ep.id +
      " ==="
    );

    let found = false;

    lines.forEach(function(line, index) {
      if (/寺下[\s　]*真理加/.test(line)) {
        found = true;

        const before =
          index > 0 ? lines[index - 1] : "";
        const after =
          index + 1 < lines.length
            ? lines[index + 1]
            : "";

        Logger.log(
          "前: " + before.substring(0, 300)
        );
        Logger.log(
          "該当: " + line.substring(0, 500)
        );
        Logger.log(
          "後: " + after.substring(0, 300)
        );
      }
    });

    if (!found) {
      Logger.log("寺下真理加の文字列なし");
    }
  });
}
function stripTerashitaKnownEventPromoV3_(value) {
  let text = String(value || "");

  // 2025年5月31日「1億DL / PODCAST MEETING」告知。
  // この告知に寺下真理加の氏名があっても、
  // そのエピソード自体への出演根拠にはしない。
  text = text.replace(
    /【寺下真理加[^】]*出演[^】]*】[\s\S]*?(?=【番組内容】|【関連記事】|【出演・スタッフ】|【スタッフ・出演】|$)/g,
    ""
  );

  // 名前入り見出しがない表記にも対応。
  text = text.replace(
    /(?:祝・1億DL|5\s*\/\s*31[^。\n]*(?:イベント|PODCAST MEETING))[\s\S]*?(?=【番組内容】|【関連記事】|【出演・スタッフ】|【スタッフ・出演】|$)/g,
    ""
  );

  return text.trim();
}
function fetchTerashitaRegressionEpisodesBatchV3_(episodeIds, token) {
  const ids = Array.from(new Set(
    (episodeIds || []).map(function(id) {
      return String(id || "").trim();
    }).filter(Boolean)
  ));

  const episodes = [];

  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);

    const response = fetchSpotifyReadWithRetry_(
      "https://api.spotify.com/v1/episodes?market=JP&ids=" +
        encodeURIComponent(batch.join(",")),
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Terashita regression batch " + String(offset / 50 + 1)
    );

    if (response.getResponseCode() !== 200) {
      throw new Error(
        "寺下真理加回帰テスト取得失敗: status=" +
        response.getResponseCode()
      );
    }

    const data = JSON.parse(response.getContentText());

    (Array.isArray(data.episodes) ? data.episodes : [])
      .forEach(function(episode) {
        if (!episode || episode.is_playable === false) return;

        episodes.push({
          id: String(episode.id || ""),
          uri: String(
            episode.uri ||
            ("spotify:episode:" + String(episode.id || ""))
          ),
          name: String(episode.name || ""),
          release_date: String(episode.release_date || ""),
          description: String(episode.description || ""),
          html_description: String(episode.html_description || "")
        });
      });
  }

  Logger.log(
    "回帰テスト一括取得: " +
    episodes.length +
    "件 / descriptionあり=" +
    episodes.filter(function(ep) {
      return String(ep.description || "").trim();
    }).length
  );

  return episodes;
}
function dryRunTerashitaMarikaRegressionChunkV3() {
  const rules = loadAutoUpdateRuntimeRulesV1_();

  const rule = rules.find(function(r) {
    return String(r && r.playlistId || "") ===
      TERASHITA_MARIKA_PLAYLIST_ID_;
  });

  if (!rule) {
    throw new Error("寺下真理加ルールが見つかりません");
  }

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できません");
  }

  let candidateIds = [];

  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const state = loadAutoPlaylistScopedState_(rule.key, showId);
    if (!state || !Array.isArray(state.candidateIds)) return;
    candidateIds = candidateIds.concat(state.candidateIds);
  });

  candidateIds.push(rule.bootstrapSeedEpisodeId);

  candidateIds = Array.from(
    new Set(candidateIds.map(String).filter(Boolean))
  );

  // まず先頭10件だけ
  const targetIds = candidateIds.slice(0, 10);

  const episodes =
    fetchTerashitaRegressionEpisodesV2_(
      targetIds,
      token
    );

  const gold = new Set(
    TERASHITA_MARIKA_GOLD_EPISODE_IDS_
  );

  episodes.forEach(function(ep) {
    const result =
      classifyTerashitaMarikaAutoPlaylistEpisodeV2_(ep);

    const expected = gold.has(String(ep.id || ""));
    const actual = result.classification === "confirmed";

    Logger.log(
      (expected === actual ? "PASS" : "FAIL") +
      " | expected=" + expected +
      " | actual=" + result.classification +
      " | " + ep.release_date +
      " | " + ep.name +
      " | " + ep.id +
      " | " + result.reason
    );
  });

  Logger.log(
    "10件のみ / Spotify書き込みなし / シート書き込みなし"
  );
}
function classifyTerashitaMarikaAutoPlaylistEpisodeV3_(episode) {
  return classifySpeakerEpisodeWithGuardrail_(
    episode,
    { requireEpisodeIdentity: true },
    classifyTerashitaMarikaEpisodeEvidenceV3_
  );
}


function classifyTerashitaMarikaEpisodeEvidenceV3_(episode) {
  const title = String(episode && episode.name || "").trim();

  // 1on1で本人名が明記されていれば出演確定
  if (
    /1on1/i.test(title) &&
    /寺下[\s　]*真理加/.test(title)
  ) {
    return terashitaMarikaClassificationV2_(
      "confirmed",
      "name_confirmed_in_1on1_title",
      title
    );
  }

  let description = normalizeTerashitaMarikaTextV2_(
    episode && episode.description,
    false
  );

  let htmlDescription = normalizeTerashitaMarikaTextV2_(
    episode && episode.html_description,
    true
  );

  if (!description && !htmlDescription) {
    return terashitaMarikaClassificationV2_(
      "unresolved",
      "description_missing",
      ""
    );
  }

  // 「寺下真理加も出演！ 5/31イベント」などの
  // 共通告知ブロックを、出演判定の前に除去する。
  description =
    stripTerashitaKnownEventPromoV3_(description);

  htmlDescription =
    stripTerashitaKnownEventPromoV3_(htmlDescription);

  const analyses = [description, htmlDescription]
    .filter(Boolean)
    .map(analyzeTerashitaMarikaTextV2_);

  const confirmed = analyses.find(function(result) {
    return result.confirmedExcerpt;
  });

  if (confirmed) {
    return terashitaMarikaClassificationV2_(
      "confirmed",
      "appearance_confirmed_after_promo_removed",
      confirmed.confirmedExcerpt
    );
  }

  const mentionCount = analyses.reduce(function(sum, result) {
    return sum + Number(result.mentionCount || 0);
  }, 0);

  const firstExcerpt = analyses.reduce(function(found, result) {
    return found || result.firstExcerpt;
  }, "");

  if (mentionCount > 0) {
    return terashitaMarikaClassificationV2_(
      "review",
      "name_found_without_appearance_confirmation",
      firstExcerpt
    );
  }

  // 告知を除去したら名前が消えた → 誤検出
  return terashitaMarikaClassificationV2_(
    "false_positive",
    "name_only_in_removed_promotion",
    ""
  );
}


function stripTerashitaKnownEventPromoV3_(value) {
  let text = String(value || "");

  // 見出しを改行して、Spotify plain description の
  // 「全部1行問題」を先に正規化。
  text = text.replace(
    /\s*(【(?:番組内容|関連記事|出演・スタッフ|スタッフ・出演|出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)[^】]*】)/g,
    "\n$1"
  );

  // 5/31・1億DLイベント告知。
  // 次の番組本文・クレジット見出しまでを除去する。
  text = text.replace(
    /【寺下真理加[^】]*(?:出演|参加)[^】]*】[\s\S]*?(?=【番組内容】|【関連記事】|【出演・スタッフ】|【スタッフ・出演】|【出演者】|$)/g,
    ""
  );

  text = text.replace(
    /(?:祝[・!！]?\s*1億DL|5\s*\/\s*31[^。\n]*(?:イベント|PODCAST\s*MEETING))[\s\S]*?(?=【番組内容】|【関連記事】|【出演・スタッフ】|【スタッフ・出演】|【出演者】|$)/gi,
    ""
  );

  return text.trim();
}

function classifyTerashitaAutoEpisode_(episode) {
  const name = /寺下[\s　]*真理加/;
  const title = String(episode && episode.name || "");
  if (/(イベント|公開収録|登壇|参加者|告知|お知らせ)/.test(title)) {
    return { classification: "false_positive", reason: "announcement_title" };
  }
  const raw = [episode && episode.description, episode && episode.html_description]
    .map(function(value) { return String(value || ""); }).join("\n");
  const text = raw.replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/gi, " ");
  if (!name.test(title + "\n" + text)) return { classification: "review", reason: "name_not_found" };
  // The named 1on1 title itself identifies the guest; generic name mentions do not.
  if (/^[（(]\s*1on1\s*[）)]\s*寺下[\s　]*真理加/i.test(title)) {
    return { classification: "confirmed", reason: "named_1on1_title", excerpt: title.slice(0, 180) };
  }
  const announcement = /(イベント|お知らせ|告知|登壇|参加|会場|公開収録|関連記事|記事はこちら|執筆|チケット|申込|応募|メンバー|記念グッズ)/;
  const heading = /^\s*(?:【[^】]+】|\[[^\]]+\]|[^。！？]{1,25}[：:])\s*$/;
  const appearanceHeading = /^\s*(?:【|\[)?(?:出演者?|ゲスト|MC)(?:】|\])?\s*(?:[：:]\s*)?$/i;
  const lines = text.split(/\n/).map(function(line) { return line.replace(/\s+/g, " ").trim(); }).filter(Boolean);
  let inAppearance = false;
  let inAnnouncement = false;
  let sectionLines = 0;
  let announcementOnly = false;
  let outsideAnnouncement = name.test(title);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (heading.test(line)) {
      inAppearance = appearanceHeading.test(line);
      inAnnouncement = announcement.test(line);
      sectionLines = 0;
    } else {
      sectionLines += 1;
      if (sectionLines > 12) inAppearance = false;
    }
    if (!name.test(line)) continue;
    if (inAnnouncement || announcement.test(line)) {
      announcementOnly = true;
      continue;
    }
    outsideAnnouncement = true;
    if (inAppearance) return { classification: "confirmed", reason: "appearance_section", excerpt: line.slice(0, 180) };
    const explicit = /寺下[\s　]*真理加(?:さん|記者|氏)?(?:を|さんを|記者を)?\s*(?:ゲストに迎え|招き|迎え|が話します|が語ります|が出演します|さんが話します|出演します)/;
    const role = /(?:出演者?|ゲスト|MC)[^。！？\n]{0,32}寺下[\s　]*真理加/;
    if (explicit.test(line) || role.test(line)) {
      return { classification: "confirmed", reason: "explicit_appearance", excerpt: line.slice(0, 180) };
    }
  }
  if (announcementOnly && !outsideAnnouncement) {
    return { classification: "false_positive", reason: "announcement_only" };
  }
  return { classification: "review", reason: "appearance_not_confirmed" };
}
