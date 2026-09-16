// 太田匡彦の現行分類器と共通ガードレール候補の比較。
// matchesAutoPlaylistRule_ からは呼ばず、本番の判定経路は変更しない。

function classifyOtaMasahikoAutoPlaylistEpisodeGuardedCandidate_(episode) {
  return classifySpeakerEpisodeWithGuardrail_(episode, {
    requireEpisodeIdentity: true,
    knownReviewTitleIncludes: [SPEAKER_GUARDRAIL_KNOWN_REVIEW_TITLES_.BE_FOUR_KINGS]
  }, classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_);
}

function compareOtaMasahikoCurrentAndGuardedClassification_(episode) {
  const current = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
  const guarded = classifyOtaMasahikoAutoPlaylistEpisodeGuardedCandidate_(episode);
  const currentReasons = Array.isArray(current.reasons) ? current.reasons : [];
  const guardedReasons = Array.isArray(guarded.reasons) ? guarded.reasons : [];

  return {
    sameClassification: current.classification === guarded.classification,
    sameReasons: JSON.stringify(currentReasons) === JSON.stringify(guardedReasons),
    sameEvidence:
      String(current.matchedField || "") === String(guarded.matchedField || "") &&
      String(current.matchedSection || "") === String(guarded.matchedSection || "") &&
      String(current.excerpt || "") === String(guarded.excerpt || ""),
    current: current,
    guarded: guarded
  };
}

function dryRunOtaMasahikoGuardrailComparison() {
  const rule = getAutoPlaylistRuleByKey_("ota-masahiko");
  if (!rule) throw new Error("太田匡彦の自動更新ルールが見つかりません");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const items = episodes.map(function(episode) {
    const comparison = compareOtaMasahikoCurrentAndGuardedClassification_(episode);
    const expectedGuardrailOverride = comparison.guarded.reason === "known_manual_review_episode";
    const unexpectedDifference =
      !comparison.sameClassification ||
      (!expectedGuardrailOverride && (!comparison.sameReasons || !comparison.sameEvidence));

    return {
      id: String(episode && episode.id ? episode.id : ""),
      uri: String(episode && episode.uri ? episode.uri : ""),
      name: String(episode && episode.name ? episode.name : ""),
      currentClassification: comparison.current.classification,
      guardedClassification: comparison.guarded.classification,
      currentReasons: comparison.current.reasons || [],
      guardedReasons: comparison.guarded.reasons || [],
      expectedGuardrailOverride: expectedGuardrailOverride,
      unexpectedDifference: unexpectedDifference
    };
  });
  const unexpectedDifferences = items.filter(function(item) {
    return item.unexpectedDifference;
  });
  const expectedOverrides = items.filter(function(item) {
    return item.expectedGuardrailOverride;
  });

  const report = {
    dryRun: true,
    spotifyWrite: false,
    spreadsheetWrite: false,
    playlistId: rule.playlistId,
    episodeCount: episodes.length,
    expectedOverrideCount: expectedOverrides.length,
    unexpectedDifferenceCount: unexpectedDifferences.length,
    expectedOverrides: expectedOverrides,
    unexpectedDifferences: unexpectedDifferences
  };
  report.migrationReadiness = evaluateOtaMasahikoGuardrailMigrationReadiness_(report);

  Logger.log("=== OTA GUARDRAIL COMPARISON DRY RUN ===");
  Logger.log("取得エピソード数: " + episodes.length);
  Logger.log("既知review上書き: " + expectedOverrides.length);
  Logger.log("想定外差分: " + unexpectedDifferences.length);
  Logger.log("移行可能: " + report.migrationReadiness.ready);
  Logger.log("移行停止理由: " + report.migrationReadiness.reasons.join(","));
  Logger.log("Spotify書き込み: なし");
  Logger.log("スプレッドシート書き込み: なし");

  unexpectedDifferences.forEach(function(item) {
    Logger.log(
      "DIFF | " + item.name + " | " + item.uri +
      " | current=" + item.currentClassification +
      " | guarded=" + item.guardedClassification +
      " | currentReasons=" + item.currentReasons.join(",") +
      " | guardedReasons=" + item.guardedReasons.join(",")
    );
  });

  return report;
}

function evaluateOtaMasahikoGuardrailMigrationReadiness_(report) {
  const reasons = [];
  const safeReport = report || {};

  if (safeReport.dryRun !== true) reasons.push("dry_run_not_confirmed");
  if (safeReport.spotifyWrite !== false) reasons.push("spotify_write_not_disabled");
  if (safeReport.spreadsheetWrite !== false) reasons.push("spreadsheet_write_not_disabled");
  if (!(Number(safeReport.episodeCount) > 0)) reasons.push("episode_count_missing");
  if (Number(safeReport.unexpectedDifferenceCount) !== 0) {
    reasons.push("unexpected_difference_found");
  }

  return {
    ready: reasons.length === 0,
    reasons: reasons
  };
}

function testOtaMasahikoGuardrailComparisonPure() {
  const otaRule = getAutoPlaylistRuleByKey_("ota-masahiko");
  if (
    !otaRule ||
    otaRule.enabled !== true ||
    otaRule.playlistId !== "7jLXrZ0JUNOnsSeFEFbw9S" ||
    otaRule.matchStrategy !== "ota-safe-confirmed"
  ) {
    throw new Error("稼働中の太田匡彦ルールが比較中に変更されています");
  }

  const fixtures = [
    {
      label: "出演欄",
      expected: "confirmed",
      episode: {
        name: "犬との暮らしを考える",
        uri: "spotify:episode:ota-credit",
        description: "【出演】\n太田匡彦記者\n犬との暮らしについて話します。",
        html_description: ""
      }
    },
    {
      label: "本文中の出演説明",
      expected: "confirmed",
      episode: {
        name: "ペットと社会",
        uri: "spotify:episode:ota-narrative",
        description: "文化部の太田匡彦記者に聞きました。",
        html_description: ""
      }
    },
    {
      label: "既知イベント告知だけ",
      expected: "false_positive",
      episode: {
        name: "別の出演者による回",
        uri: "spotify:episode:ota-known-event",
        description: "記念グッズを大放出。寺下真理加、太田匡彦、佐藤陽に朝ポキメンバーも多数参加。",
        html_description: ""
      }
    },
    {
      label: "タイトルだけ",
      expected: "review",
      episode: {
        name: "太田匡彦記者に聞く",
        uri: "spotify:episode:ota-title-only",
        description: "出演者の詳しい記載はありません。",
        html_description: ""
      }
    },
    {
      label: "BE四天王の既知要確認回",
      expected: "review",
      expectedGuardrailOverride: true,
      episode: {
        name: "遊びじゃない、ガチの付録だよ　BE四天王が集合",
        uri: "spotify:episode:ota-be-four-kings",
        description: "佐藤陽、太田匡彦ほか4人の名前がありますが、出演上の役割は確認できません。",
        html_description: ""
      }
    },
    {
      label: "概要欄欠落",
      expected: "unresolved",
      episode: {
        name: "メタデータ確認待ち",
        uri: "spotify:episode:ota-description-missing",
        description: "",
        html_description: ""
      }
    }
  ];

  fixtures.forEach(function(fixture) {
    const comparison = compareOtaMasahikoCurrentAndGuardedClassification_(fixture.episode);
    if (!comparison.sameClassification) {
      throw new Error(
        "太田匡彦の比較不一致: " + fixture.label +
        " current=" + comparison.current.classification +
        " guarded=" + comparison.guarded.classification
      );
    }
    if (comparison.guarded.classification !== fixture.expected) {
      throw new Error(
        "太田匡彦の期待分類不一致: " + fixture.label +
        " expected=" + fixture.expected +
        " actual=" + comparison.guarded.classification
      );
    }
    if (!fixture.expectedGuardrailOverride && (!comparison.sameReasons || !comparison.sameEvidence)) {
      throw new Error("太田匡彦の監査情報が共通ガードレール経由で変化しました: " + fixture.label);
    }
    if (
      fixture.expectedGuardrailOverride &&
      comparison.guarded.reason !== "known_manual_review_episode"
    ) {
      throw new Error("BE四天王の既知回に共通review理由が付きません");
    }
  });

  const missingIdentity = {
    name: "太田匡彦記者の出演回",
    description: "【出演】\n太田匡彦記者",
    html_description: ""
  };
  const currentMissingIdentity = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(missingIdentity);
  const guardedMissingIdentity = classifyOtaMasahikoAutoPlaylistEpisodeGuardedCandidate_(missingIdentity);
  if (currentMissingIdentity.classification !== "confirmed") {
    throw new Error("比較前の太田匡彦現行判定が想定外です");
  }
  if (
    guardedMissingIdentity.classification !== "unresolved" ||
    guardedMissingIdentity.reason !== "episode_identity_missing"
  ) {
    throw new Error("太田匡彦候補でURI・ID欠落を安全停止できません");
  }

  const ready = evaluateOtaMasahikoGuardrailMigrationReadiness_({
    dryRun: true,
    spotifyWrite: false,
    spreadsheetWrite: false,
    episodeCount: fixtures.length,
    unexpectedDifferenceCount: 0
  });
  if (!ready.ready || ready.reasons.length) {
    throw new Error("安全な太田匡彦比較結果を移行可能と判定できません");
  }

  const blocked = evaluateOtaMasahikoGuardrailMigrationReadiness_({
    dryRun: true,
    spotifyWrite: false,
    spreadsheetWrite: false,
    episodeCount: fixtures.length,
    unexpectedDifferenceCount: 1
  });
  if (blocked.ready || blocked.reasons.indexOf("unexpected_difference_found") < 0) {
    throw new Error("想定外差分がある太田匡彦比較結果を安全停止できません");
  }

  Logger.log("Ota Masahiko guardrail comparison pure tests: PASS");
  return true;
}
