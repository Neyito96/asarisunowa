// 寺下真理加AUTOの投入前診断。Properties / Spotify / Sheetへの書き込みをしない。
function diagnoseTerashitaAutoReadOnly() {
  const playlistId = "1qhNqjSTfwvJP3cQaXg9bn";
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "") === playlistId;
  });
  if (rules.length !== 1) {
    return { status: "RULE_NOT_UNIQUE", playlistId: playlistId, ruleCount: rules.length };
  }
  const rule = rules[0];
  const ruleKey = String(rule.key || "");
  const keywords = Array.isArray(rule.keywords) ? rule.keywords.map(String) : [];
  if (rule.ruleType !== "speaker" || keywords.indexOf("寺下真理加") < 0 || !ruleKey) {
    return { status: "RULE_MISMATCH", playlistId: playlistId,
      ruleKey: ruleKey, ruleType: rule.ruleType, keywords: keywords };
  }
  // 既存本番コードだけで動くよう、申請行の補足をこの診断内で読み取る。
  const requestSheet = getSheetLoose(
    SpreadsheetApp.openById(SPREADSHEET_ID), AUTO_UPDATE_REQUEST_SHEET_NAME
  );
  if (!requestSheet || !rule.requestSheetRow) {
    return { status: "REQUEST_ROW_UNAVAILABLE", playlistId: playlistId, ruleKey: ruleKey };
  }
  const requestRow = requestSheet.getRange(Number(rule.requestSheetRow), 1, 1, 7)
    .getDisplayValues()[0];
  if (extractAutoUpdateSpotifyPlaylistId_(String(requestRow[1] || "")) !== playlistId ||
      String(requestRow[5] || "").trim() !== "寺下真理加") {
    return { status: "REQUEST_ROW_MISMATCH", playlistId: playlistId, ruleKey: ruleKey };
  }
  const note = String(requestRow[6] || "").normalize("NFKC");
  const exclusion = note.match(/([^()（）、\s]+)の名に入る.+を除外/);
  if (!exclusion || !exclusion[1]) {
    return { status: "EXCLUSION_NOTE_UNPARSEABLE", playlistId: playlistId, ruleKey: ruleKey };
  }
  const excludedTitle = exclusion[1];

  const showIds = getAutoPlaylistShowIds_(rule);
  const states = listAutoPlaylistScopedStatesForRule_(ruleKey);
  const stateByShow = {};
  states.forEach(function(state) {
    if (state.invalid === true || state.ruleKey !== ruleKey || !state.showId ||
        stateByShow[state.showId]) {
      throw new Error("初回補完状態が不正です");
    }
    stateByShow[state.showId] = state;
  });
  const missingShowIds = showIds.filter(function(id) { return !stateByShow[id]; });
  const candidateIds = Array.from(new Set(states.reduce(function(all, state) {
    return all.concat(Array.isArray(state.candidateIds) ? state.candidateIds.map(String) : []);
  }, []))).filter(Boolean);
  const decisions = rule.manualEpisodeDecisions || {};
  const manualEpisodeDecisions = {};
  Object.keys(decisions).forEach(function(id) {
    manualEpisodeDecisions[id] = String(decisions[id] || "");
  });
  const base = {
    playlistId: playlistId, ruleKey: ruleKey, ruleType: rule.ruleType,
    keywords: keywords, excludeTitleKeywords: [excludedTitle],
    showIds: showIds, missingShowIds: missingShowIds,
    bootstrapPending: rule.bootstrapPending === true,
    candidateIds: candidateIds, manualEpisodeDecisions: manualEpisodeDecisions
  };

  // CacheService.get のみ。getSpotifyUserAccessToken() は refresh / cache.put し得るため使わない。
  const token = String(CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || "").trim();
  if (!token) return Object.assign({ status: "NO_VALID_CACHED_TOKEN" }, base);

  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  const existingEpisodeIds = Array.from(new Set(playlistItems.map(function(item) {
    const episode = item && (item.item || item.track);
    return String(episode && episode.id || "").trim();
  }).filter(Boolean)));
  const existing = new Set(existingEpisodeIds);
  const rows = candidateIds.map(function(id) {
    let episode = null;
    let detailError = "";
    try {
      episode = fetchThemeReviewEpisodeDetails_([id], token)[0] || null;
    } catch (error) {
      detailError = String(error && error.message || error);
    }
    const title = String(episode && episode.name || "");
    const description = String(episode &&
      (episode.description || episode.html_description) || "");
    const human = manualEpisodeDecisions[id] || "";
    let decision = "判定不能";
    let reason = detailError || "エピソード詳細を取得できません";
    if (["除外", "訂正済み", "反映済み"].indexOf(human) >= 0) {
      decision = "人間判定「" + human + "」を優先";
      reason = "保存済みルールのepisode ID判定";
    } else if (existing.has(id)) {
      decision = "Spotify登録済みで除外";
      reason = "現在のプレイリストに同じepisode IDがあります";
    } else if (episode && title.indexOf(excludedTitle) >= 0) {
      decision = "イベント告知で除外";
      reason = "タイトルが除外語に一致";
    } else if (episode &&
      [title, description].join("\n").indexOf("寺下真理加") < 0) {
      reason = "保存済みspeaker判定条件に一致しません";
    } else if (episode && missingShowIds.length === 0) {
      decision = "追加予定";
      reason = "待機候補・未登録・人間の除外判定なし";
    } else if (episode) {
      reason = "Showの初回補完状態が不足しています";
    }
    return { id: id, title: title, description: description,
      decision: decision, reason: reason };
  });
  return Object.assign({ status: missingShowIds.length ? "INCOMPLETE_STATE" : "OK",
    existingEpisodeIds: existingEpisodeIds, rows: rows }, base);
}
// 保存済みstateには触れず、Showの実データから初回補完の件数を見積もる。
function dryRunTerashitaBootstrapReadOnly() {
  const playlistId = "1qhNqjSTfwvJP3cQaXg9bn";
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "") === playlistId;
  });

  if (rules.length !== 1 || rules[0].ruleType !== "speaker" ||
      (rules[0].keywords || []).indexOf("寺下真理加") < 0) {
    return { status: "RULE_MISMATCH", playlistId: playlistId };
  }

  const rule = rules[0];
  const seedDate = String(rule.bootstrapSeedDate || rule.seedDateOverride || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) {
    return { status: "INVALID_SEED_DATE", playlistId: playlistId };
  }

  const token = String(
    CacheService.getScriptCache().get("SPOTIFY_USER_ACCESS_TOKEN") || ""
  ).trim();

  if (!token) {
    return { status: "NO_VALID_CACHED_TOKEN", playlistId: playlistId };
  }

  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);

  const existing = new Set(
    playlistItems.map(function(row) {
      const item = row && (row.item || row.track);
      return String(item && item.id || "");
    }).filter(Boolean)
  );

  const byId = {};
  const showIds = getAutoPlaylistShowIds_(rule);
  const maxPagesPerShow = 100;
  const incompleteShowIds = [];

  showIds.forEach(function(showId) {
    let url = buildAutoPlaylistV2InitialUrl_(showId);
    let pages = 0;

    while (url && pages < maxPagesPerShow) {
      const response = fetchSpotifyReadWithRetry_(
        url,
        {
          muteHttpExceptions: true,
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json"
          }
        },
        "Terashita dry-run " + showId
      );

      if (response.getResponseCode() !== 200) {
        throw new Error(
          "Showの読取失敗: " + showId +
          " status=" + response.getResponseCode()
        );
      }

      const data = JSON.parse(response.getContentText());
      let beforeSeed = false;

      (Array.isArray(data.items) ? data.items : []).forEach(function(ep) {
        const date = String(ep && ep.release_date || "");

        if (date && date < seedDate) beforeSeed = true;

        if (date > seedDate && ep && ep.id && !byId[ep.id]) {
          byId[ep.id] = ep;
        }
      });

      pages += 1;
      url = beforeSeed ? "" : String(data.next || "");
    }

    if (url) incompleteShowIds.push(showId);
  });

  const counts = {
    addCandidates: 0,
    eventExcluded: 0,
    spotifyExistingExcluded: 0,
    humanDecisionExcluded: 0,
    noSpeakerMatch: 0
  };

  const rows = Object.keys(byId).sort().map(function(id) {
    const ep = byId[id];
    const title = String(ep.name || "");
    const human = String(
      (rule.manualEpisodeDecisions || {})[id] || ""
    );

    let decision;

    if (["除外", "訂正済み", "反映済み"].indexOf(human) >= 0) {
      decision = "humanDecisionExcluded";

    } else if ((rule.excludeTitleKeywords || []).some(function(word) {
      return title.indexOf(String(word)) >= 0;
    })) {
      decision = "eventExcluded";

    } else if (!matchesAutoPlaylistRule_(ep, rule)) {
      decision = "noSpeakerMatch";

    } else if (existing.has(id)) {
      decision = "spotifyExistingExcluded";

    } else {
      decision = "addCandidates";
    }

    counts[decision] += 1;

    return {
      id: id,
      title: title,
      decision: decision
    };
  });

  const result = {
    status: incompleteShowIds.length ? "INCOMPLETE_SCAN" : "OK",
    playlistId: playlistId,
    seedDate: seedDate,
    existingSpotifyEpisodeCount: existing.size,
    scannedEpisodeCount: rows.length,
    incompleteShowIds: incompleteShowIds,
    counts: counts,
    rows: rows
  };

  Logger.log(JSON.stringify(result));
  return result;
}
function finalizeTerashitaBootstrapFromCurrentPlaylist() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";
  const EXPECTED_CURRENT_EPISODE_COUNT = 18;
  const EXPECTED_REGISTRATION_DATE = "2026-09-25";

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error("別の自動更新処理が実行中です。少し待って再実行してください");
  }

  try {
    // ------------------------------------------------------------
    // 1. 寺下のruntime ruleを一意に確認
    // ------------------------------------------------------------
    const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
      return String(rule && rule.playlistId || "").trim() === PLAYLIST_ID;
    });

    if (rules.length !== 1) {
      throw new Error(
        "寺下runtime ruleの一致件数が不正です: " + rules.length
      );
    }

    const rule = rules[0];

    if (String(rule.key || "").trim() !== "request-" + PLAYLIST_ID) {
      throw new Error("寺下runtime ruleのkeyが想定と異なります");
    }

    const keywords = Array.isArray(rule.keywords)
      ? rule.keywords.map(String)
      : [String(rule.keyword || "")];

    if (!keywords.some(function(value) {
      return value.indexOf("寺下真理加") >= 0;
    })) {
      throw new Error("寺下真理加のspeaker ruleではありません");
    }

    // すでに完了済みなら境界を動かさない。
    if (rule.bootstrapPending === false) {
      const ssAlready = SpreadsheetApp.openById(SPREADSHEET_ID);
      const workAlready = getSheetLoose(ssAlready, "作業台");

      if (workAlready) {
        const values = workAlready
          .getRange(2, 1, Math.max(0, workAlready.getLastRow() - 1), 8)
          .getDisplayValues();

        const matches = [];

        values.forEach(function(row, index) {
          const m = String(row[0] || "").match(
            /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
          );
          if (m && m[1] === PLAYLIST_ID) {
            matches.push(index + 2);
          }
        });

        if (matches.length === 1) {
          workAlready.getRange(matches[0], 7).setValue("AUTO");
        }
      }

      const already = {
        status: "ALREADY_FINALIZED",
        playlistId: PLAYLIST_ID,
        bootstrapPending: false
      };

      Logger.log(JSON.stringify(already));
      return already;
    }

    // ------------------------------------------------------------
    // 2. Spotifyは読み取りだけ。
    //    現在18件であることを安全ゲートにする
    // ------------------------------------------------------------
    const token = getSpotifyUserAccessToken();

    if (!token) {
      throw new Error("Spotifyユーザー認証トークンを取得できません");
    }

    const playlistItems =
      getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

    const currentEpisodeIds = playlistItems
      .map(function(row) {
        const ep = row && (row.item || row.track)
          ? (row.item || row.track)
          : null;
        return String(ep && ep.id || "").trim();
      })
      .filter(Boolean);

    const uniqueEpisodeIds =
      Array.from(new Set(currentEpisodeIds));

    if (uniqueEpisodeIds.length !== EXPECTED_CURRENT_EPISODE_COUNT) {
      throw new Error(
        "安全停止: Spotifyの現在件数が想定と違います。expected=" +
        EXPECTED_CURRENT_EPISODE_COUNT +
        " actual=" +
        uniqueEpisodeIds.length
      );
    }

    // ------------------------------------------------------------
    // 3. 7 Showの現在先頭をすべて取得
    //    ここではまだ何も書き込まない
    // ------------------------------------------------------------
    const showIds = getAutoPlaylistShowIds_(rule);
    const EXCLUDED_EMPTY_SHOW_ID = "5Dt1uyQaJpM6hPV8aEMP3R";

const activeShowIds = showIds.filter(function(showId) {
  return String(showId) !== EXCLUDED_EMPTY_SHOW_ID;
});

if (activeShowIds.length !== 6) {
  throw new Error(
    "安全停止: 有効Show数が想定と違います: " +
    activeShowIds.length
  );
}

// runtime rule自体も6 Showに絞る
rule.showIds = activeShowIds;

   if (showIds.length !== 7) {
  throw new Error(
    "安全停止: 元のShow数が想定と違います: " +
    showIds.length
  );
}
    const nextBoundaries = {};

    activeShowIds.forEach(function(showId) {
  let headId = "";

  // まずSpotifyの現在先頭を使う
  try {
    const page =
      fetchAutoUpdateShowFirstPageV1_(showId, token);

    const items =
      page && Array.isArray(page.items)
        ? page.items
        : [];

    headId =
      String(items[0] && items[0].id || "").trim();

  } catch (error) {
    Logger.log(
      "現在先頭取得失敗。初回補完stateを確認: " +
      showId + " / " + String(error)
    );
  }

  // Spotifyが空を返すShowだけ、
  // すでに全件走査済みの初回補完stateの境界を使う
  if (!headId) {
    const state =
      loadAutoPlaylistScopedState_(
        rule.key,
        showId
      );

    if (
      !state ||
      state.complete !== true
    ) {
      throw new Error(
        "安全停止: 完了済み初回stateがありません: " +
        showId
      );
    }

    headId =
      String(
        state.pendingBoundaryId || ""
      ).trim();

    if (!headId) {
      throw new Error(
        "安全停止: 保存済み境界もありません: " +
        showId
      );
    }

    Logger.log(
      "保存済み境界を採用: " +
      showId + " -> " + headId
    );
  }

  nextBoundaries[showId] = headId;
});
   

    // ------------------------------------------------------------
    // 4. スプレッドシートの寺下行を確認
    // ------------------------------------------------------------
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    const workSheet = getSheetLoose(ss, "作業台");
    if (!workSheet) {
      throw new Error("作業台シートが見つかりません");
    }

    const workValues = workSheet
      .getRange(
        2,
        1,
        Math.max(0, workSheet.getLastRow() - 1),
        8
      )
      .getDisplayValues();

    const workRows = [];

    workValues.forEach(function(row, index) {
      const m = String(row[0] || "").match(
        /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
      );

      if (m && m[1] === PLAYLIST_ID) {
        workRows.push({
          rowNumber: index + 2,
          row: row
        });
      }
    });

    if (workRows.length !== 1) {
      throw new Error(
        "作業台の寺下行の一致件数が不正です: " +
        workRows.length
      );
    }

    const workTarget = workRows[0];

    if (
      String(workTarget.row[1] || "").indexOf("寺下真理加") < 0
    ) {
      throw new Error(
        "作業台の対象タイトルが寺下真理加ではありません"
      );
    }

    if (
      String(workTarget.row[7] || "").trim() !==
      EXPECTED_REGISTRATION_DATE
    ) {
      throw new Error(
        "安全停止: H列登録日が想定と異なります: " +
        String(workTarget.row[7] || "")
      );
    }

    // F列は一切変更しない。
    // G列だけ後で AUTO にする。

    // ------------------------------------------------------------
    // 5. 自動更新申請行を確認
    // ------------------------------------------------------------
    const requestSheet =
      getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);

    if (!requestSheet) {
      throw new Error("自動更新申請シートが見つかりません");
    }

    const requestRowNumber =
      Number(rule.requestSheetRow || 0);

    if (
      !Number.isInteger(requestRowNumber) ||
      requestRowNumber < 2
    ) {
      throw new Error(
        "自動更新申請のrow番号が不正です"
      );
    }

    const requestRow = requestSheet
      .getRange(requestRowNumber, 1, 1, 9)
      .getDisplayValues()[0];

    const requestPlaylistId =
      extractAutoUpdateSpotifyPlaylistId_(
        String(requestRow[1] || "")
      );

    if (requestPlaylistId !== PLAYLIST_ID) {
      throw new Error(
        "自動更新申請行のplaylistIdが一致しません"
      );
    }

    const oldRequestStatus =
      String(requestRow[7] || "");

    const oldRequestNote =
      String(requestRow[8] || "");

    if (
      ["初回補完中", "増分自動更新"]
        .indexOf(oldRequestStatus.trim()) < 0
    ) {
      throw new Error(
        "安全停止: 自動更新申請状態が想定外です: " +
        oldRequestStatus
      );
    }

    // ------------------------------------------------------------
    // 6. ロールバック用に現在値を保存
    // ------------------------------------------------------------
    const oldRule =
      JSON.parse(JSON.stringify(rule));

    const oldWorkG =
      workSheet
        .getRange(workTarget.rowNumber, 7)
        .getDisplayValue();

    const oldBoundaries = {};

    showIds.forEach(function(showId) {
      oldBoundaries[showId] =
        loadAutoUpdateBoundaryV1_(
          PLAYLIST_ID,
          showId
        );
    });

    // ------------------------------------------------------------
    // 7. ここから本番書き込み
    //    Spotifyには一切書かない
    // ------------------------------------------------------------
    try {
      // まず全Showの「現在」を新しい境界にする
      activeShowIds.forEach(function(showId) {
        saveAutoUpdateBoundaryV1_(
          PLAYLIST_ID,
          showId,
          nextBoundaries[showId]
        );
      });

      // 自動更新申請を増分モードへ
      setAutoUpdateRequestStatusV1_(
        requestSheet,
        requestRowNumber,
        "増分自動更新",
        "現在のSpotify内容18件を人間確認済みの初回確定版として採用。以後は新着回のみ巡回します"
      );

      // runtime ruleを正式に増分運転へ
      rule.bootstrapPending = false;
      rule.lifecycleStatus = "incremental";
      delete rule.bootstrapResumeAfterMs;
      delete rule.bootstrapLatestAddedDate;

      saveAutoUpdateRuntimeRuleV1_(rule);

      // 作業台G列をAUTOにする
      workSheet
        .getRange(workTarget.rowNumber, 7)
        .setValue("AUTO");

      SpreadsheetApp.flush();

    } catch (writeError) {
      // ----------------------------------------------------------
      // 途中失敗時は可能な範囲で元に戻す
      // ----------------------------------------------------------
      try {
        const props =
          PropertiesService.getScriptProperties();

        showIds.forEach(function(showId) {
          const oldValue =
            String(oldBoundaries[showId] || "");

          if (oldValue) {
            saveAutoUpdateBoundaryV1_(
              PLAYLIST_ID,
              showId,
              oldValue
            );
          } else {
            props.deleteProperty(
              autoUpdateBoundaryKeyV1_(
                PLAYLIST_ID,
                showId
              )
            );
          }
        });

        saveAutoUpdateRuntimeRuleV1_(oldRule);

        requestSheet
          .getRange(requestRowNumber, 8, 1, 2)
          .setValues([[
            oldRequestStatus,
            oldRequestNote
          ]]);

        workSheet
          .getRange(workTarget.rowNumber, 7)
          .setValue(oldWorkG);

        SpreadsheetApp.flush();

      } catch (rollbackError) {
        Logger.log(
          "ROLLBACK ERROR: " +
          String(rollbackError)
        );
      }

      throw writeError;
    }

    // ------------------------------------------------------------
    // 8. 初回補完用stateを掃除
    //    ここは失敗してもAUTO移行を巻き戻さない
    // ------------------------------------------------------------
    const cleanupErrors = [];

    showIds.forEach(function(showId) {
      try {
        deleteAutoPlaylistScopedState_(
          rule.key,
          showId
        );
      } catch (error) {
        cleanupErrors.push(
          showId + ": " + String(error)
        );
      }
    });

    const result = {
      status: "FINALIZED",
      playlistId: PLAYLIST_ID,
      currentSpotifyEpisodeCount:
        uniqueEpisodeIds.length,
      showCount: showIds.length,
      bootstrapPending: rule.bootstrapPending,
      lifecycleStatus: rule.lifecycleStatus,
      requestStatus: "増分自動更新",
      workSheetRow: workTarget.rowNumber,
      workSheetG: "AUTO",
      registrationDate:
        EXPECTED_REGISTRATION_DATE,
      spotifyWrites: 0,
      cleanupErrors: cleanupErrors
    };

    Logger.log(
      JSON.stringify(result, null, 2)
    );

    return result;

  } finally {
    lock.releaseLock();
  }
}
function inspectTerashitaProblemShowReadOnly() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";
  const SHOW_ID = "5Dt1uyQaJpM6hPV8aEMP3R";

  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "").trim() === PLAYLIST_ID;
  });

  if (rules.length !== 1) {
    throw new Error("寺下ruleの一致件数が不正です: " + rules.length);
  }

  const rule = rules[0];

  const state = loadAutoPlaylistScopedState_(
    rule.key,
    SHOW_ID
  );

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyトークンを取得できません");
  }

  const playlistItems =
    getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const retainedEpisodesFromShow = [];

  playlistItems.forEach(function(row) {
    const ep = row && (row.item || row.track)
      ? (row.item || row.track)
      : null;

    if (!ep) return;

    const epShowId =
      String(
        ep.show && ep.show.id
          ? ep.show.id
          : ""
      ).trim();

    if (epShowId === SHOW_ID) {
      retainedEpisodesFromShow.push({
        id: String(ep.id || ""),
        title: String(ep.name || "")
      });
    }
  });

  const result = {
    showId: SHOW_ID,
    stateExists: Boolean(state),
    stateComplete: state ? state.complete === true : false,
    candidateCount: state ? Number(state.candidateCount || 0) : null,
    candidateIds: state && Array.isArray(state.candidateIds)
      ? state.candidateIds
      : [],
    pendingBoundaryId: state
      ? String(state.pendingBoundaryId || "")
      : "",
    retainedPlaylistEpisodeCount:
      retainedEpisodesFromShow.length,
    retainedPlaylistEpisodes:
      retainedEpisodesFromShow
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function inspectTerashitaPlaylistAllItemsReadOnly() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyトークンを取得できません");
  }

  const playlistItems =
    getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const items = [];

  playlistItems.forEach(function(row) {
    const ep = row && (row.item || row.track)
      ? (row.item || row.track)
      : null;

    if (!ep) return;

    items.push({
      id: String(ep.id || ""),
      title: String(ep.name || ""),
      showId: String(
        ep.show && ep.show.id
          ? ep.show.id
          : ""
      ),
      showName: String(
        ep.show && ep.show.name
          ? ep.show.name
          : ""
      )
    });
  });

  const result = {
    playlistId: PLAYLIST_ID,
    count: items.length,
    items: items
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function inspectTerashitaPlaylistClassificationReadOnly() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";

  // 0 → 20 → 40 → 60 と変えて4回実行
  const START = 60;
  const LIMIT = 20;

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyトークンを取得できません");

  const playlistItems =
    getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const slice = playlistItems.slice(START, START + LIMIT);
  const results = [];

  slice.forEach(function(row, index) {
    const ep0 = row && (row.item || row.track)
      ? (row.item || row.track)
      : null;

    if (!ep0 || !ep0.id) return;

    const id = String(ep0.id);

    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" +
        encodeURIComponent(id) +
        "?market=JP",
      {
        method: "get",
        headers: {
          Authorization: "Bearer " + token
        },
        muteHttpExceptions: true
      }
    );

    const status = response.getResponseCode();

    if (status !== 200) {
      results.push({
        position: START + index + 1,
        id: id,
        title: String(ep0.name || ""),
        classification: "fetch_error",
        reason: "HTTP_" + status
      });
      return;
    }

    const episode = JSON.parse(response.getContentText());
    const judged = classifyTerashitaAutoEpisode_(episode);

    results.push({
      position: START + index + 1,
      id: id,
      title: String(episode.name || ""),
      classification: judged.classification,
      reason: judged.reason,
      excerpt: String(judged.excerpt || "").slice(0, 160)
    });
  });

  results.forEach(function(row) {
    Logger.log(JSON.stringify(row));
  });

  Logger.log(
    "=== inspected " +
      START +
      " - " +
      (START + results.length - 1) +
      " / total " +
      playlistItems.length +
      " ==="
  );

  return results;
}
function recordTerashitaFalsePositiveExclusions() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";

  const EXCLUSIONS = {
    "3hfiC6UrgL2fKxOZUMCvsP": "除外",
    "4mPlghRW1t6AXTGmVIDaKy": "除外"
  };

  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "").trim() === PLAYLIST_ID;
  });

  if (rules.length !== 1) {
    throw new Error("寺下真理加ルールの一致件数が不正です: " + rules.length);
  }

  const rule = rules[0];

  const existing =
    rule.manualEpisodeDecisions &&
    typeof rule.manualEpisodeDecisions === "object"
      ? rule.manualEpisodeDecisions
      : {};

  rule.manualEpisodeDecisions = Object.assign({}, existing, EXCLUSIONS);

  saveAutoUpdateRuntimeRuleV1_(rule);

  Logger.log(JSON.stringify({
    playlistId: PLAYLIST_ID,
    added: EXCLUSIONS,
    totalManualDecisions:
      Object.keys(rule.manualEpisodeDecisions).length
  }, null, 2));

  return rule.manualEpisodeDecisions;
}


function verifyTerashitaFalsePositiveExclusionsReadOnly() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";

  const IDS = [
    "3hfiC6UrgL2fKxOZUMCvsP",
    "4mPlghRW1t6AXTGmVIDaKy"
  ];

  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "").trim() === PLAYLIST_ID;
  });

  if (rules.length !== 1) {
    throw new Error("寺下真理加ルールの一致件数が不正です: " + rules.length);
  }

  const decisions = rules[0].manualEpisodeDecisions || {};

  const result = IDS.map(function(id) {
    return {
      id: id,
      decision: String(decisions[id] || ""),
      excluded: String(decisions[id] || "") === "除外"
    };
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function removeTerashitaConfirmedFalsePositivesFromSpotify() {
  const PLAYLIST_ID = "1qhNqjSTfwvJP3cQaXg9bn";

  const IDS = [
    "3hfiC6UrgL2fKxOZUMCvsP",
    "4mPlghRW1t6AXTGmVIDaKy"
  ];

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyトークンを取得できません");
  }

  // 先に現在のプレイリストを読み取り、対象2件が本当に存在するか確認
  const playlistItems = getAllSpotifyPlaylistItems_(PLAYLIST_ID, token);

  const existingIds = new Set(
    playlistItems.map(function(row) {
      const ep = row && (row.item || row.track)
        ? (row.item || row.track)
        : null;
      return ep && ep.id ? String(ep.id) : "";
    }).filter(Boolean)
  );

  const found = IDS.filter(function(id) {
    return existingIds.has(id);
  });

  if (found.length !== IDS.length) {
    throw new Error(
      "削除対象2件の存在確認に失敗しました: " +
      JSON.stringify({
        expected: IDS,
        found: found
      })
    );
  }

  const body = {
    items: IDS.map(function(id) {
      return {
        uri: "spotify:episode:" + id
      };
    })
  };

  const response = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(PLAYLIST_ID) +
      "/items",
    {
      method: "delete",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const text = response.getContentText();

  Logger.log(JSON.stringify({
    status: status,
    removedIds: IDS,
    response: text
  }, null, 2));

  if (status < 200 || status >= 300) {
    throw new Error(
      "Spotify削除に失敗しました: HTTP " + status + " " + text
    );
  }

  return {
    ok: true,
    status: status,
    removedIds: IDS
  };
}