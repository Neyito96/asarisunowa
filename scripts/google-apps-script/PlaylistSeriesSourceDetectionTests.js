// 連載プレイリストの親番組判定を、Spotify通信なしで確認する純粋テスト。

function testSeriesSourceDetectionPure() {
  const noMetadata = detectSeriesSourceShows_([
    { item: { id: "episode-1", name: "番組情報なし" } }
  ]);
  if (noMetadata.detected || noMetadata.reason !== "no-show-metadata") {
    throw new Error("番組情報なしの判定が正しくありません");
  }

  const belowThreshold = detectSeriesSourceShows_([
    {
      item: {
        id: "episode-a",
        name: "A",
        release_date: "2026-09-16",
        show: { id: "show-a", name: "番組A" }
      }
    },
    {
      item: {
        id: "episode-b",
        name: "B",
        release_date: "2026-09-15",
        show: { id: "show-b", name: "番組B" }
      }
    }
  ], { minimumRecentCount: 2 });

  if (
    belowThreshold.detected ||
    belowThreshold.reason !== "no-candidate-meets-threshold" ||
    belowThreshold.showIds.length !== 0
  ) {
    throw new Error("閾値未満の候補0件判定が正しくありません");
  }

  const migrated = [];
  for (let index = 0; index < 12; index++) {
    migrated.push({
      item: {
        id: "new-" + index,
        name: "新番組 " + index,
        release_date: "2026-09-" + String(16 - index).padStart(2, "0"),
        show: { id: "show-new", name: "新しい親番組" }
      }
    });
  }
  migrated.push({
    item: {
      id: "old-1",
      name: "旧番組",
      release_date: "2025-01-01",
      show: { id: "show-old", name: "古い親番組" }
    }
  });

  const migrationResult = detectSeriesSourceShows_(migrated, { recentLimit: 12 });
  if (
    !migrationResult.detected ||
    migrationResult.reason !== "recent-source-show" ||
    migrationResult.showIds.length !== 1 ||
    migrationResult.showIds[0] !== "show-new"
  ) {
    throw new Error("番組移行後の直近親番組を優先できません");
  }

  const multiple = detectSeriesSourceShows_([
    {
      item: {
        id: "episode-a2",
        name: "A2",
        release_date: "2026-09-16",
        show: { id: "show-a", name: "番組A" }
      }
    },
    {
      item: {
        id: "episode-b2",
        name: "B2",
        release_date: "2026-09-15",
        show: { id: "show-b", name: "番組B" }
      }
    }
  ]);

  if (
    !multiple.detected ||
    multiple.reason !== "multiple-recent-source-shows" ||
    multiple.showIds.length !== 2
  ) {
    throw new Error("複数の親番組候補を保持できません");
  }

  if (
    extractSpotifyPlaylistId_("https://open.spotify.com/playlist/4tY0lHoV8IemMBp4iTnKnl?si=test") !==
      "4tY0lHoV8IemMBp4iTnKnl" ||
    extractSpotifyPlaylistId_("spotify:playlist:6nDhZQG75F1wU62sdcYJMq") !==
      "6nDhZQG75F1wU62sdcYJMq"
  ) {
    throw new Error("SpotifyプレイリストIDを抽出できません");
  }

  Logger.log("Series source detection pure tests: PASS");
  return true;
}
