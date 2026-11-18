// 楽屋裏専用。ほかのプレイリストは処理しない。
function runRakuyuraBackfillOnce() {
  const playlistId = "1u1qT0BxRZT1OeNM0LDA72";
  const showId = "0yhef9ORZkUZs9ZeotdCSY";

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("別の自動更新処理が実行中です");
  }

  try {
    const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
      return String(rule.playlistId) === playlistId;
    });

    if (rules.length !== 1) {
      throw new Error("楽屋裏のルールを一意に特定できません");
    }

    const rule = normalizeAutoUpdateRuntimeRuleV1_(rules[0]);

    if (rule.enabled === false ||
        rule.bootstrapPending !== true ||
        String(rule.seriesTitleCode) !== "#52-" ||
        getAutoPlaylistShowIds_(rule).join(",") !== showId) {
      throw new Error("楽屋裏の補完条件が一致しません");
    }

    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotify認証に失敗しました");

    const result = syncOneApprovedAutoUpdateRequestV1_(
      rule, token, 50
    );

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}
function diagnoseRakuyuraBoundaryReadOnly() {
  const playlistId = "1u1qT0BxRZT1OeNM0LDA72";
  const showId = "0yhef9ORZkUZs9ZeotdCSY";

  const rule = loadAutoUpdateRuntimeRulesV1_().find(function(r) {
    return r && r.playlistId === playlistId;
  });
  if (!rule) throw new Error("楽屋裏ルールなし");

  const token = getSpotifyUserAccessToken();

  const boundary = loadAutoUpdateBoundaryV1_(
    playlistId, showId
  );

  const page = fetchAutoUpdateShowFirstPageV1_(
    showId, token
  );

  const existingIds = new Set(
    getAllSpotifyPlaylistItems_(playlistId, token)
      .map(function(row) {
        const ep = row && (row.item || row.track);
        return String(ep && ep.id || "");
      })
      .filter(Boolean)
  );

  const episodes = page.items || [];

  Logger.log(JSON.stringify({
    playlistCount: existingIds.size,
    boundaryId: boundary,
    boundaryIndex: episodes.findIndex(function(ep) {
      return ep && ep.id === boundary;
    }),
    sourceLatest: episodes.slice(0, 10).map(function(ep) {
      return {
        id: ep.id,
        title: ep.name,
        releaseDate: ep.release_date,
        matchesRule: matchesAutoPlaylistRule_(ep, rule),
        alreadyAdded: existingIds.has(ep.id)
      };
    })
  }, null, 2));
}
function diagnoseRakuyuraGapReadOnly() {
  const playlistId = "1u1qT0BxRZT1OeNM0LDA72";
  const showId = "0yhef9ORZkUZs9ZeotdCSY";
  const startDate = "2026-06-23";
  const endDate = "2026-09-13";

  const rule = loadAutoUpdateRuntimeRulesV1_().find(function(r) {
    return r && r.playlistId === playlistId;
  });
  if (!rule) throw new Error("楽屋裏ルールがありません");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証失敗");

  // 既存317件のIDを読み取る。書き込みはしない。
  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  const existingIds = new Set(playlistItems.map(function(row) {
    const ep = row && (row.item || row.track);
    return String(ep && ep.id || "");
  }).filter(Boolean));

  const found = [];
  const seen = new Set();
  let url =
    "https://api.spotify.com/v1/shows/" + showId +
    "/episodes?market=JP&limit=50";
  let pages = 0;
  let reachedOlderDate = false;

  while (url && pages < 20) {
    const response = fetchSpotifyReadWithRetry_(
      url,
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Rakuyura gap READ ONLY"
    );

    if (response.getResponseCode() !== 200) {
      throw new Error(
        "配信元取得失敗 status=" + response.getResponseCode()
      );
    }

    const data = JSON.parse(response.getContentText());
    const items = Array.isArray(data.items) ? data.items : [];
    pages++;

    // 日付の順序が崩れた場合、取りこぼしを防ぐため停止する。
    for (let i = 1; i < items.length; i++) {
      if (String(items[i - 1].release_date || "") <
          String(items[i].release_date || "")) {
        throw new Error("配信日の順序が不正です。調査を停止します");
      }
    }

    items.forEach(function(ep) {
      if (!ep || !ep.id) return;

      const date = String(ep.release_date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("配信日を取得できない回があります");
      }

      if (date < startDate) reachedOlderDate = true;
      if (date < startDate || date > endDate) return;
      if (seen.has(ep.id)) return;
      seen.add(ep.id);

      const title = String(ep.name || "");
      const matchesRule = matchesAutoPlaylistRule_(ep, rule);
      const mentionsRakuyura = title.indexOf("楽屋裏") >= 0;

      // 既存ルールに合う回と、楽屋裏という名称を含む回を抽出。
      if (matchesRule || mentionsRakuyura) {
        found.push({
          id: ep.id,
          date: date,
          title: title,
          matchesRule: matchesRule,
          mentionsRakuyura: mentionsRakuyura,
          alreadyAdded: existingIds.has(ep.id)
        });
      }
    });

    if (reachedOlderDate) break;
    url = data.next || "";
  }

  if (url && !reachedOlderDate && pages >= 20) {
    throw new Error("20ページに到達。調査が完了していません");
  }

  const missing = found.filter(function(ep) {
    return !ep.alreadyAdded;
  });

  Logger.log(JSON.stringify({
    mode: "READ_ONLY",
    playlistCount: playlistItems.length,
    dateRange: startDate + " ～ " + endDate,
    pagesChecked: pages,
    searchCompleted: reachedOlderDate || !url,
    matchingEpisodes: found.length,
    missingEpisodes: missing.length,
    missing: missing,
    writePerformed: false
  }, null, 2));
}
