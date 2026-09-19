// 「今あるリストを育てる」申請の安全な自動運用 v1。
// プレイリスト内の最古の対象回から初回補完し、完了後は新着差分だけを追加する。

const AUTO_UPDATE_V1_RULE_IDS_KEY_ = "AUTO_UPDATE_V1_RULE_IDS";
const AUTO_UPDATE_V1_RULE_PREFIX_ = "AUTO_UPDATE_V1_RULE_";
const AUTO_UPDATE_V1_BOUNDARY_PREFIX_ = "AUTO_UPDATE_V1_BOUNDARY_";
const AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_ = 10;
const AUTO_UPDATE_V1_BOOTSTRAP_MAX_ADDITIONS_PER_RUN_ = 50;
const AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_ = 20;
const AUTO_UPDATE_V1_BOOTSTRAP_MAX_PAGES_PER_RUN_ = 5;
const AUTO_UPDATE_V1_BOOTSTRAP_MAX_CANDIDATES_PER_SHOW_ = 500;
const AUTO_UPDATE_V1_IMMEDIATE_HANDLER_ = "runAutoUpdateAutomationSoonV1";
const AUTO_UPDATE_V1_DAILY_HANDLER_ = "runAutoUpdateAutomationV1";
const AUTO_UPDATE_V1_BACKFILL_HANDLER_ = "runAutoUpdateBackfillHourlyV1";
const AUTO_UPDATE_V1_BACKFILL_CURSOR_KEY_ = "AUTO_UPDATE_V1_BACKFILL_CURSOR";
const AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_ = 60 * 1000;
const AUTO_UPDATE_V1_WAITING_RETRY_DELAY_MS_ = 15 * 60 * 1000;
const AUTO_UPDATE_V1_WAITING_RETRY_WINDOW_MS_ = 6 * 60 * 60 * 1000;
const AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_ = "AUTO_UPDATE_V1_WAITING_RETRY_STARTED";
const AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_ = "0yhef9ORZkUZs9ZeotdCSY";
const AUTO_UPDATE_V1_MANAGED_FIXED_RULE_KEYS_ = [
  "issho-shinbun",
  "kino-douga",
  "toyohide",
  "ota-masahiko",
  "no-mirai",
  "polirebi",
  "sato-yo"
];

// フォーム受付直後の1回だけを予約する。同じ予約があれば新規作成しない。
function scheduleImmediateAutoUpdateAutomationV1_() {
  PropertiesService.getScriptProperties().setProperty(
    AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_,
    String(Date.now())
  );
  return scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_);
}

function scheduleAutoUpdateAutomationV1_(delayMs) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const alreadyScheduled = triggers.some(function(trigger) {
      return trigger.getHandlerFunction() === AUTO_UPDATE_V1_IMMEDIATE_HANDLER_;
    });
    if (alreadyScheduled) return { scheduled: true, reason: "already-scheduled" };

    ScriptApp.newTrigger(AUTO_UPDATE_V1_IMMEDIATE_HANDLER_)
      .timeBased()
      .after(Math.max(60 * 1000, Number(delayMs) || AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_))
      .create();
    return { scheduled: true, reason: "created" };
  } catch (error) {
    if (!isAutoUpdateTriggerPermissionErrorV1_(error)) throw error;
    Logger.log("継続トリガー予約を見送り、翌朝の日次巡回へ繰り越します: " + String(error));
    return { scheduled: false, reason: "authorization-required" };
  }
}

function isAutoUpdateTriggerPermissionErrorV1_(error) {
  return /permission|script\.scriptapp|権限/i.test(String(error && error.message ? error.message : error));
}

function scheduleWaitingAutoUpdateRetryV1_() {
  const props = PropertiesService.getScriptProperties();
  const started = Number(props.getProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_) || 0) || Date.now();
  if (Date.now() - started >= AUTO_UPDATE_V1_WAITING_RETRY_WINDOW_MS_) {
    props.deleteProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_);
    return { scheduled: false, reason: "retry-window-ended" };
  }
  props.setProperty(AUTO_UPDATE_V1_WAITING_RETRY_STARTED_KEY_, String(started));
  return scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_WAITING_RETRY_DELAY_MS_);
}

// 1回限りの時間主導トリガーから呼ばれる公開関数。
function runAutoUpdateAutomationSoonV1() {
  // 1回限りのトリガーは実行中も getProjectTriggers() に残ることがある。
  // 先に自分自身を削除しないと、処理後の継続予約が
  // "already-scheduled" と誤判定され、初回補完が5ページで止まる。
  deleteAutoUpdateAutomationSoonTriggersV1_();
  return runAutoUpdateAutomationV1();
}

function deleteAutoUpdateAutomationSoonTriggersV1_() {
  let deleted = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() !== AUTO_UPDATE_V1_IMMEDIATE_HANDLER_) return;
    ScriptApp.deleteTrigger(trigger);
    deleted += 1;
  });
  return deleted;
}

// 日次巡回を4時台に1本だけ維持する管理用関数。
function installAutoUpdateAutomationDailyTriggerV1() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === AUTO_UPDATE_V1_DAILY_HANDLER_) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  const trigger = ScriptApp.newTrigger(AUTO_UPDATE_V1_DAILY_HANDLER_)
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .create();
  return { installed: true, handler: trigger.getHandlerFunction(), hour: 4 };
}

// 初回補完と新規申請の確認を1時間ごとに行う。プレイリスト別のトリガーは作らない。
function installAutoUpdateBackfillHourlyTriggerV1() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === AUTO_UPDATE_V1_BACKFILL_HANDLER_) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  const trigger = ScriptApp.newTrigger(AUTO_UPDATE_V1_BACKFILL_HANDLER_)
    .timeBased()
    .everyHours(1)
    .create();
  return { installed: true, handler: trigger.getHandlerFunction(), everyHours: 1 };
}

// 管理用：日次巡回と初回補完の2本をまとめて設定し、旧直後実行トリガーを片付ける。
function installAutoUpdateAutomationTriggersV1() {
  deleteAutoUpdateAutomationSoonTriggersV1_();
  return {
    daily: installAutoUpdateAutomationDailyTriggerV1(),
    backfill: installAutoUpdateBackfillHourlyTriggerV1()
  };
}

// 初回だけGASエディタから実行し、時間主導トリガー権限を承認するための管理用関数。
function authorizeAutoUpdateAutomationV1() {
  return scheduleAutoUpdateAutomationV1_(AUTO_UPDATE_V1_IMMEDIATE_DELAY_MS_);
}

// 毎朝4時台：初回補完は行わず、前回境界より新しい回だけを確認する。
function runAutoUpdateAutomationV1() {
  const activation = processPendingAutoUpdateRequestsV1();
  const sync = syncApprovedAutoUpdateRequestsV1();
  // 既存の日次トリガーを共用する。テーマ運用が停止中でも、
  // 固定ルール（ノーミライ）まで巻き込んで止めない。
  const themeEnabled = typeof isThemeReviewSpotifyWriteEnabled_ === "function" &&
    isThemeReviewSpotifyWriteEnabled_();
  const theme = themeEnabled && typeof runThemeReviewAutomation === "function"
    ? runThemeReviewAutomation()
    : { skipped: true, reason: "disabled" };
  const managed = syncDailyManagedAutoPlaylistsV1_();
  return { activation: activation, sync: sync, theme: theme, managed: managed };
}

// 1時間ごと：新規申請を確認し、補完中のリストを順番に最大50件ずつ処理する。
// 朝の日次巡回と重なる時間帯は日次処理を優先する。
function runAutoUpdateBackfillHourlyV1() {
  if (isAutoUpdateDailyWindowV1_(Date.now())) {
    return { skipped: true, reason: "daily-window" };
  }
  const activation = processPendingAutoUpdateRequestsV1();
  const backfill = syncNextAutoUpdateBootstrapV1_();
  return { activation: activation, backfill: backfill };
}

function isAutoUpdateDailyWindowV1_(nowMs) {
  const timeZone = Session.getScriptTimeZone() || "Asia/Tokyo";
  const hhmm = Utilities.formatDate(new Date(Number(nowMs || Date.now())), timeZone, "HHmm");
  return hhmm >= "0330" && hhmm < "0530";
}

// フォーム由来の実行ルールとは別に、初回登録済みの固定ルールを同じ日次巡回で育てる。
function syncDailyManagedAutoPlaylistsV1_() {
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const recentEpisodeCache = {};
  return getDailyManagedAutoPlaylistKeysV1_().map(function(key) {
    try {
      const rule = getAutoPlaylistRuleByKey_(key);
      const result = syncRecentManagedAutoPlaylistV1_(rule, token, recentEpisodeCache) || {};
      return {
        key: key,
        ok: true,
        addedCount: Number(result.addedCount || 0),
        failedCount: Number(result.failedCount || 0)
      };
    } catch (error) {
      Logger.log("固定ルール巡回失敗: " + key + " | " + String(error));
      return { key: key, ok: false, error: String(error) };
    }
  });
}

// 毎朝の巡回は各Showの最新20件だけを見る。
// 全件走査と初回補完は1時間ごとの別処理へ分離し、朝のAPI負荷を抑える。
function syncRecentManagedAutoPlaylistV1_(rule, token, episodeCache) {
  if (!rule || rule.enabled === false) throw new Error("有効な固定ルールがありません");
  const episodesById = {};
  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const cacheKey = String(showId);
    const page = episodeCache[cacheKey] || fetchAutoUpdateShowFirstPageV1_(showId, token);
    episodeCache[cacheKey] = page;
    page.items.forEach(function(episode) {
      if (episode && episode.id && matchesAutoPlaylistRule_(episode, rule)) {
        episodesById[String(episode.id)] = episode;
      }
    });
  });

  const existingUris = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const missing = Object.keys(episodesById).map(function(id) {
    return episodesById[id];
  }).filter(function(episode) {
    return !existingUris.has(String(episode.uri || ("spotify:episode:" + episode.id)));
  }).sort(function(a, b) {
    const left = String(a.release_date || "");
    const right = String(b.release_date || "");
    return left === right
      ? String(a.id).localeCompare(String(b.id))
      : left < right ? -1 : 1;
  });

  if (missing.length > AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_) {
    throw new Error("朝の追加候補が上限を超えました: " + missing.length);
  }
  if (!missing.length) return { addedCount: 0, failedCount: 0 };
  assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const result = addAutoPlaylistEpisodesIndividually_(rule, token, missing);
  if (result.failedCount > 0) throw new Error("Spotify追加に一部失敗しました");
  if (result.addedCount > 0 && rule.updateLatestDateOnAdd === true) {
    updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(result.addedEpisodes));
  }
  return result;
}

function getDailyManagedAutoPlaylistKeysV1_() {
  return AUTO_UPDATE_V1_MANAGED_FIXED_RULE_KEYS_.filter(function(key) {
    const rule = getAutoPlaylistRuleByKey_(key);
    return rule && rule.enabled !== false;
  });
}

function processPendingAutoUpdateRequestsV1() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別の自動更新処理が実行中です");

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
    if (!sheet) throw new Error("自動更新申請シートが見つかりません");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { checked: 0, activated: 0, waiting: 0, review: 0 };

    const rows = sheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues();
    const result = { checked: 0, activated: 0, waiting: 0, review: 0 };
    const latestPendingRowByPlaylistId = {};
    rows.forEach(function(row, index) {
      const status = String(row[7] || "").trim();
      if (["申請受付", "受付", "招待承認待ち"].indexOf(status) < 0) return;
      const playlistId = extractAutoUpdateSpotifyPlaylistId_(String(row[1] || ""));
      if (playlistId) latestPendingRowByPlaylistId[playlistId] = index + 2;
    });

    rows.forEach(function(row, index) {
      const rowNumber = index + 2;
      const status = String(row[7] || "").trim();
      if (["申請受付", "受付", "招待承認待ち"].indexOf(status) < 0) return;
      result.checked += 1;

      const request = autoUpdateRequestFromSheetRowV1_(row);
      const requestPlaylistId = extractAutoUpdateSpotifyPlaylistId_(request.url);
      if (requestPlaylistId && latestPendingRowByPlaylistId[requestPlaylistId] !== rowNumber) {
        sheet.getRange(rowNumber, 5).clearContent();
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "重複申請", "同じプレイリストの新しい申請を採用しました");
        return;
      }
      const validationError = validateAutoUpdateRequest_(request);
      if (validationError) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "確認待ち", validationError);
        result.review += 1;
        return;
      }

      const plan = buildAutoPlaylistRequestPlan_(request);
      if (!isAutoUpdateV1TypeEligible_(plan.ruleType)) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "確認待ち", "テーマ型・未対応方式は人の確認が必要です");
        result.review += 1;
        return;
      }

      const playlistId = requestPlaylistId;
      const access = inspectAutoUpdatePlaylistAccessV1_(playlistId, token);
      // Spotifyの新しい共同編集招待は、Web上で共同編集者になっていても
      // Web APIの collaborative が false のまま返る。招待URLがあり、かつ
      // 運用アカウントのライブラリに存在する場合を承認済みとして扱う。
      const invitedAndSaved = Boolean(request.inviteUrl) && access.presentInLibrary === true;
      if (!access.editable && !invitedAndSaved) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "招待承認待ち", "運用アカウントで共同編集招待を承認してください");
        result.waiting += 1;
        return;
      }

      const rule = buildAutoUpdateRuntimeRuleV1_(request, playlistId, rowNumber);
      const ruleValidation = validateAutoPlaylistRule_(rule);
      if (!ruleValidation.valid) {
        setAutoUpdateRequestStatusV1_(sheet, rowNumber, "確認待ち", ruleValidation.errors.join(" / "));
        result.review += 1;
        return;
      }

      assertAutoPlaylistRuleActivationSafe_(rule);

      assertAutoPlaylistSheetLinkBeforeWrite_(rule);
      let seed = findAutoUpdateSeedEpisodeV1_(
        getAllSpotifyPlaylistItems_(rule.playlistId, token),
        rule,
        token
      );
      if (!seed && rule.seedDateOverride) {
        seed = {
          id: "manual-date-boundary-" + playlistId,
          releaseDate: rule.seedDateOverride,
          name: "申請で確認した最新既存回"
        };
      }
      if (!seed) {
        setAutoUpdateRequestStatusV1_(
          sheet,
          rowNumber,
          "確認待ち",
          "条件に合う起点エピソードがプレイリスト内にありません"
        );
        result.review += 1;
        return;
      }
      prepareAutoUpdateSeedBootstrapV1_(rule, seed);
      saveAutoUpdateRuntimeRuleV1_(rule);

      // 招待リンクは権限確認後にシートから消し、不要な露出を残さない。
      sheet.getRange(rowNumber, 5).clearContent();
      setAutoUpdateRequestStatusV1_(
        sheet,
        rowNumber,
        "初回補完中",
        "起点 " + seed.releaseDate + " から不足回を古い順に補完します"
      );
      result.activated += 1;
    });

    SpreadsheetApp.flush();
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function syncApprovedAutoUpdateRequestsV1() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別の自動更新処理が実行中です");

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
    const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
      return rule && rule.bootstrapPending !== true;
    });
    const results = [];
    rules.forEach(function(rule) {
      try {
        const normalizedRule = normalizeAutoUpdateRuntimeRuleV1_(rule);
        if (JSON.stringify(normalizedRule) !== JSON.stringify(rule)) {
          saveAutoUpdateRuntimeRuleV1_(normalizedRule);
        }
        results.push(syncOneApprovedAutoUpdateRequestV1_(normalizedRule, token));
      } catch (error) {
        const reason = "巡回エラー: " + String(error && error.message ? error.message : error);
        Logger.log(reason);
        results.push(pauseAutoUpdateRuleV1_(rule, reason));
      }
    });
    Logger.log(JSON.stringify(results));
    return results;
  } finally {
    lock.releaseLock();
  }
}

function syncNextAutoUpdateBootstrapV1_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別の自動更新処理が実行中です");

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
    const rules = loadAutoUpdateRuntimeRulesV1_().map(function(rule) {
      const normalized = normalizeAutoUpdateRuntimeRuleV1_(rule);
      if (JSON.stringify(normalized) !== JSON.stringify(rule)) {
        saveAutoUpdateRuntimeRuleV1_(normalized);
      }
      return normalized;
    }).filter(function(rule) {
      return rule && rule.enabled !== false && rule.bootstrapPending === true;
    });

    if (!rules.length) return { skipped: true, reason: "no-bootstrap-pending", addedCount: 0 };

    const props = PropertiesService.getScriptProperties();
    const selected = selectNextAutoUpdateBootstrapRuleV1_(
      rules,
      props.getProperty(AUTO_UPDATE_V1_BACKFILL_CURSOR_KEY_) || ""
    );
    props.setProperty(AUTO_UPDATE_V1_BACKFILL_CURSOR_KEY_, String(selected.key || selected.playlistId));

    try {
      return syncOneApprovedAutoUpdateRequestV1_(
        selected,
        token,
        AUTO_UPDATE_V1_BOOTSTRAP_MAX_ADDITIONS_PER_RUN_
      );
    } catch (error) {
      const reason = "初回補完エラー: " + String(error && error.message ? error.message : error);
      Logger.log(reason);
      if (isSpotifyRateLimitErrorV1_(error)) {
        setAutoUpdateRuleSheetStatusV1_(
          selected,
          "初回補完中",
          "Spotify混雑のため一時保留。次の1時間枠で同じ続きから再開します"
        );
        return {
          playlistId: selected.playlistId,
          ok: false,
          retryNextHourlyRun: true,
          reason: reason
        };
      }
      return pauseAutoUpdateRuleV1_(selected, reason);
    }
  } finally {
    lock.releaseLock();
  }
}

function isSpotifyRateLimitErrorV1_(error) {
  return /Spotify API.*レート制限|status=429|\b429\b/i.test(
    String(error && error.message ? error.message : error)
  );
}

function selectNextAutoUpdateBootstrapRuleV1_(rules, previousKey) {
  const source = Array.isArray(rules) ? rules.slice() : [];
  if (!source.length) return null;
  const lastIndex = source.findIndex(function(rule) {
    return String(rule && (rule.key || rule.playlistId) ? (rule.key || rule.playlistId) : "") === String(previousKey || "");
  });
  return source[(lastIndex + 1) % source.length];
}

// 保存済みルールも現行仕様へ寄せる。
// #52-（楽屋裏）/#42-（まなび場天声人語）は MEDIA TALK 内の連載なので、
// 旧版が保存した全公式番組のshowIdsを実行時に自動修復する。
function normalizeAutoUpdateRuntimeRuleV1_(rule) {
  const normalized = Object.assign({}, rule || {});
  const seriesTitleCode = String(normalized.seriesTitleCode || "").trim();
  if (["#52-", "#42-"].indexOf(seriesTitleCode) >= 0) {
    normalized.showIds = [AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_];
  }
  // 旧設計の「翌朝まで待つ」情報は、毎時補完への移行時に破棄する。
  if (normalized.bootstrapPending === true) delete normalized.bootstrapResumeAfterMs;
  return normalized;
}

// 旧版ルールのshowIds修復後などに、初回補完の進捗だけが欠けていても
// 同じ起点日から安全に再開できるようにする。候補は既存Playlistと照合してから
// 追加されるため、再作成しても重複追加にはならない。
function ensureAutoUpdateSeedBootstrapProgressV1_(rule) {
  const seedDate = String(rule.bootstrapSeedDate || rule.seedDateOverride || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) {
    throw new Error("初回補完の起点日を復旧できません");
  }

  return getAutoPlaylistShowIds_(rule).map(function(showId) {
    const existing = loadAutoPlaylistScopedState_(rule.key, showId);
    if (existing) return existing;

    const state = createAutoPlaylistScopedShowState_(rule, showId, "seed-bootstrap", "");
    state.bootstrapSeedDate = seedDate;
    saveAutoPlaylistScopedState_(state);
    return state;
  });
}

function syncOneApprovedAutoUpdateRequestV1_(rule, token, bootstrapMaxAdditions) {
  const validation = validateAutoPlaylistRule_(rule);
  if (!validation.valid) return pauseAutoUpdateRuleV1_(rule, "ルール検証失敗: " + validation.errors.join(" / "));

  if (rule.bootstrapPending === true) {
    ensureAutoUpdateSeedBootstrapProgressV1_(rule);
    return syncAutoUpdateSeedBootstrapV1_(rule, token, bootstrapMaxAdditions);
  }

  const showIds = getAutoPlaylistShowIds_(rule);
  let candidateIds = [];
  const nextBoundaries = {};

  for (let i = 0; i < showIds.length; i += 1) {
    const showId = showIds[i];
    const boundary = loadAutoUpdateBoundaryV1_(rule.playlistId, showId);
    const page = fetchAutoUpdateShowFirstPageV1_(showId, token);
    const episodes = page.items;
    const headId = String(episodes[0] && episodes[0].id ? episodes[0].id : "").trim();
    if (headId) nextBoundaries[showId] = headId;

    if (!boundary) return pauseAutoUpdateRuleV1_(rule, "前回境界がありません: " + showId);
    const boundaryIndex = episodes.findIndex(function(ep) {
      return String(ep && ep.id ? ep.id : "") === boundary;
    });
    if (boundaryIndex < 0) {
      return pauseAutoUpdateRuleV1_(
        rule,
        "最新" + AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_ + "件内に前回境界が見つかりません: " + showId
      );
    }

    episodes.slice(0, boundaryIndex).forEach(function(ep) {
      if (matchesAutoPlaylistRule_(ep, rule) && ep && ep.id) candidateIds.push(String(ep.id));
    });
  }

  candidateIds = Array.from(new Set(candidateIds));
  if (candidateIds.length > AUTO_UPDATE_V1_MAX_ADDITIONS_PER_RUN_) {
    return pauseAutoUpdateRuleV1_(rule, "追加候補が上限を超えました: " + candidateIds.length);
  }

  const existingUris = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const missingIds = candidateIds.filter(function(id) {
    return !existingUris.has("spotify:episode:" + id);
  });
  const episodesToAdd = fetchPlayableAutoUpdateEpisodesV1_(missingIds, token);

  if (episodesToAdd.length) assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const addResult = episodesToAdd.length
    ? addAutoPlaylistEpisodesIndividually_(rule, token, episodesToAdd)
    : { addedCount: 0, failedCount: 0, addedEpisodes: [] };
  if (addResult.failedCount > 0) return pauseAutoUpdateRuleV1_(rule, "Spotify追加に一部失敗しました");

  Object.keys(nextBoundaries).forEach(function(showId) {
    saveAutoUpdateBoundaryV1_(rule.playlistId, showId, nextBoundaries[showId]);
  });
  if (addResult.addedCount > 0) {
    updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(addResult.addedEpisodes));
  }
  setAutoUpdateRuleSheetStatusV1_(rule, "増分自動更新", "前回追加 " + addResult.addedCount + "件");
  return { playlistId: rule.playlistId, ok: true, addedCount: addResult.addedCount };
}

function findAutoUpdateSeedEpisodeV1_(playlistItems, rule, token) {
  const episodes = (Array.isArray(playlistItems) ? playlistItems : []).map(function(row) {
    const episode = row && (row.item || row.track) ? (row.item || row.track) : null;
    if (!episode || !episode.id) return null;
    const releaseDate = String(episode.release_date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return episode;
    return fetchAutoUpdateEpisodeDetailV1_(episode.id, token);
  }).filter(Boolean);
  return selectAutoUpdateSeedEpisodeV1_(episodes, rule);
}

function fetchAutoUpdateEpisodeDetailV1_(episodeId, token) {
  const response = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/episodes/" + encodeURIComponent(String(episodeId || "")) + "?market=JP",
    {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    }
  );
  if (response.getResponseCode() !== 200) return null;
  return JSON.parse(response.getContentText());
}

function selectAutoUpdateSeedEpisodeV1_(episodes, rule) {
  const validEpisodes = (Array.isArray(episodes) ? episodes : []).map(function(episode) {
    const releaseDate = String(episode && episode.release_date ? episode.release_date : "").trim();
    if (!episode || !episode.id || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return null;
    return {
      id: String(episode.id),
      releaseDate: releaseDate,
      name: String(episode.name || episode.id),
      matchesRule: matchesAutoPlaylistRule_(episode, rule)
    };
  }).filter(Boolean);

  let seeds = validEpisodes.filter(function(episode) { return episode.matchesRule; });
  // 連載コード付きの専用プレイリストでは、Spotify APIが共同編集項目の
  // タイトルを省略して一致判定できない場合に限り、最新既存回を起点にする。
  if (!seeds.length && String(rule && rule.seriesTitleCode ? rule.seriesTitleCode : "")) {
    seeds = validEpisodes.slice();
  }

  seeds.sort(function(a, b) {
    if (a.releaseDate !== b.releaseDate) return a.releaseDate > b.releaseDate ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });
  return seeds.length ? seeds[0] : null;
}

function prepareAutoUpdateSeedBootstrapV1_(rule, seed) {
  rule.bootstrapPending = true;
  rule.bootstrapSeedEpisodeId = String(seed.id || "");
  rule.bootstrapSeedDate = String(seed.releaseDate || "");

  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const state = createAutoPlaylistScopedShowState_(rule, showId, "seed-bootstrap", "");
    state.bootstrapSeedDate = rule.bootstrapSeedDate;
    saveAutoPlaylistScopedState_(state);
  });
}

function applyAutoUpdateSeedBootstrapPageV1_(state, episodes, rule, nextUrl) {
  const current = Object.assign({}, state || {});
  const seedDate = String(current.bootstrapSeedDate || rule.bootstrapSeedDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) throw new Error("初回補完の起点日が不正です");

  const source = Array.isArray(episodes) ? episodes : [];
  if (!current.nextUrl && !current.pendingBoundaryId && source.length) {
    current.pendingBoundaryId = String(source[0] && source[0].id ? source[0].id : "").trim();
  }

  let reachedSeedDate = false;
  const pageCandidateIds = [];
  source.forEach(function(episode) {
    if (reachedSeedDate) return;
    const releaseDate = String(episode && episode.release_date ? episode.release_date : "").trim();
    if (releaseDate && releaseDate < seedDate) {
      reachedSeedDate = true;
      return;
    }
    // プレイリスト内の最新対象回を境界にし、その配信日より後だけを補完する。
    // 起点回自身や同日公開の曖昧な回を再追加しない。
    if (releaseDate && releaseDate > seedDate && episode && episode.id && matchesAutoPlaylistRule_(episode, rule)) {
      pageCandidateIds.push(String(episode.id));
    }
  });

  current.pagesFetched = Number(current.pagesFetched || 0) + 1;
  current.inspectedCount = Number(current.inspectedCount || 0) + source.length;
  current.candidateIds = mergeAutoPlaylistCandidateIds_(
    current.candidateIds || [],
    pageCandidateIds,
    AUTO_UPDATE_V1_BOOTSTRAP_MAX_CANDIDATES_PER_SHOW_
  );
  current.candidateCount = current.candidateIds.length;
  current.reachedBoundary = reachedSeedDate;
  current.committed = false;

  const hasNext = Boolean(String(nextUrl || "").trim());
  current.complete = reachedSeedDate || !hasNext;
  current.nextUrl = current.complete ? "" : String(nextUrl);
  return current;
}

function fetchAutoUpdateSeedBootstrapPageV1_(rule, state, token) {
  const url = String(state.nextUrl || "") || buildAutoPlaylistV2InitialUrl_(state.showId);
  const response = fetchSpotifyReadWithRetry_(
    url,
    {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    },
    "Seed bootstrap " + state.showId
  );
  const status = response.getResponseCode();
  if (status !== 200) throw new Error("初回補完のShow取得に失敗しました: " + state.showId + " status=" + status);
  const data = JSON.parse(response.getContentText());
  const nextState = applyAutoUpdateSeedBootstrapPageV1_(
    state,
    Array.isArray(data.items) ? data.items : [],
    rule,
    data.next || ""
  );
  saveAutoPlaylistScopedState_(nextState);
  return nextState;
}

function syncAutoUpdateSeedBootstrapV1_(rule, token, maxAdditions) {
  const showIds = getAutoPlaylistShowIds_(rule);
  let pagesFetched = 0;

  for (let i = 0; i < showIds.length && pagesFetched < AUTO_UPDATE_V1_BOOTSTRAP_MAX_PAGES_PER_RUN_; i += 1) {
    let state = loadAutoPlaylistScopedState_(rule.key, showIds[i]);
    if (!state) {
      return pauseAutoUpdateRuleV1_(rule, "初回補完の進捗がありません: " + showIds[i]);
    }
    while (!state.complete && pagesFetched < AUTO_UPDATE_V1_BOOTSTRAP_MAX_PAGES_PER_RUN_) {
      state = fetchAutoUpdateSeedBootstrapPageV1_(rule, state, token);
      pagesFetched += 1;
    }
  }

  const states = showIds.map(function(showId) {
    return loadAutoPlaylistScopedState_(rule.key, showId);
  });
  if (states.some(function(state) { return !state || state.complete !== true; })) {
    setAutoUpdateRuleSheetStatusV1_(rule, "初回補完中", "対象回を確認中（今回 " + pagesFetched + "ページ）");
    return { playlistId: rule.playlistId, ok: true, bootstrapPending: true, pagesFetched: pagesFetched, addedCount: 0 };
  }

  const existingUris = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const allCandidateIds = mergeAutoPlaylistCandidateIds_([], states.reduce(function(all, state) {
    return all.concat(state.candidateIds || []);
  }, []), AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_);
  const candidateIds = allCandidateIds.filter(function(id) {
    return !existingUris.has("spotify:episode:" + id);
  });
  const additionLimit = Math.max(
    1,
    Math.min(
      AUTO_UPDATE_V1_BOOTSTRAP_MAX_ADDITIONS_PER_RUN_,
      Number(maxAdditions) || AUTO_UPDATE_V1_BOOTSTRAP_MAX_ADDITIONS_PER_RUN_
    )
  );
  // Show APIは新しい順なので、末尾から取ると古い候補から50件に絞れる。
  // 全候補の詳細を毎回取得せず、Spotifyへの読取回数も抑える。
  const candidateIdsThisRun = candidateIds.slice(-additionLimit);
  const candidateEpisodes = fetchPlayableAutoUpdateEpisodesV1_(candidateIdsThisRun, token).sort(function(a, b) {
    const left = String(a.release_date || "");
    const right = String(b.release_date || "");
    if (left !== right) return left < right ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  if (candidateEpisodes.length !== candidateIdsThisRun.length) {
    return pauseAutoUpdateRuleV1_(rule, "取得できない候補回があるため初回補完を停止しました");
  }
  const episodesToAdd = candidateEpisodes;

  if (episodesToAdd.length) assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const addResult = episodesToAdd.length
    ? addAutoPlaylistEpisodesBatch_(rule, token, episodesToAdd)
    : { addedCount: 0, failedCount: 0, addedEpisodes: [] };
  if (addResult.failedCount > 0) return pauseAutoUpdateRuleV1_(rule, "初回補完のSpotify追加に一部失敗しました");

  const resolvedIds = new Set(allCandidateIds.filter(function(id) {
    return existingUris.has("spotify:episode:" + id);
  }).concat(addResult.addedEpisodes.map(function(episode) { return String(episode.id); })));
  states.forEach(function(state) {
    state.candidateIds = (state.candidateIds || []).filter(function(id) { return !resolvedIds.has(String(id)); });
    state.candidateCount = state.candidateIds.length;
    saveAutoPlaylistScopedState_(state);
  });

  const remainingCount = states.reduce(function(sum, state) {
    return sum + Number(state.candidateCount || 0);
  }, 0);
  if (remainingCount > 0) {
    delete rule.bootstrapResumeAfterMs;
    saveAutoUpdateRuntimeRuleV1_(rule);
    setAutoUpdateRuleSheetStatusV1_(
      rule,
      "初回補完中",
      "前回追加 " + addResult.addedCount + "件・残り " + remainingCount +
        "件。1時間ごとに最大50件ずつ追加します"
    );
    return {
      playlistId: rule.playlistId,
      ok: true,
      bootstrapPending: true,
      deferredUntilHourly: true,
      addedCount: addResult.addedCount,
      remainingCount: remainingCount
    };
  }

  states.forEach(function(state) {
    const boundary = String(state.pendingBoundaryId || "").trim();
    if (!boundary) throw new Error("初回補完後の新着境界を確定できません: " + state.showId);
    saveAutoUpdateBoundaryV1_(rule.playlistId, state.showId, boundary);
    deleteAutoPlaylistScopedState_(rule.key, state.showId);
  });
  rule.bootstrapPending = false;
  delete rule.bootstrapResumeAfterMs;
  saveAutoUpdateRuntimeRuleV1_(rule);
  if (addResult.addedCount > 0) {
    updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(addResult.addedEpisodes));
  }
  setAutoUpdateRuleSheetStatusV1_(rule, "増分自動更新", "初回補完完了。以後は新着回を巡回します");
  return { playlistId: rule.playlistId, ok: true, bootstrapPending: false, addedCount: addResult.addedCount, complete: true };
}

function nextAutoUpdateDailyWindowStartMsV1_(nowMs) {
  const timeZone = Session.getScriptTimeZone() || "Asia/Tokyo";
  const tomorrow = Utilities.formatDate(
    new Date(Number(nowMs || Date.now()) + 24 * 60 * 60 * 1000),
    timeZone,
    "yyyy-MM-dd"
  );
  return Utilities.parseDate(tomorrow + " 04:00", timeZone, "yyyy-MM-dd HH:mm").getTime();
}

function autoUpdateRequestFromSheetRowV1_(row) {
  const typeMatch = String(row[8] || "").match(/方式:\s*([^/\s]+)/);
  return {
    url: String(row[1] || "").trim(),
    title: String(row[2] || "").trim(),
    maker: String(row[3] || "").trim(),
    inviteUrl: String(row[4] || "").trim(),
    keywords: String(row[5] || "").trim(),
    ruleNote: String(row[6] || "").trim(),
    updateType: typeMatch ? String(typeMatch[1] || "") : "",
    securityAnswer: "大介",
    requestId: "request_sheet_row_" + String(Date.now())
  };
}

function isAutoUpdateV1TypeEligible_(ruleType) {
  return ruleType === AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ || ruleType === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
}

function buildAutoUpdateRuntimeRuleV1_(request, playlistId, rowNumber) {
  const candidate = buildAutoPlaylistRuleCandidateFromRequest_(request);
  candidate.key = "request-" + playlistId;
  candidate.enabled = true;
  candidate.lifecycleStatus = AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL;
  candidate.productionWriteAllowed = true;
  candidate.playlistId = playlistId;
  candidate.requireSheetLinkBeforeWrite = true;
  candidate.requestSheetRow = rowNumber;
  candidate.updateType = String(request.updateType || "");
  candidate.seriesTitleCode = extractAutoUpdateSeriesTitleCodeV1_(request.ruleNote);
  candidate.seedDateOverride = extractAutoUpdateSeedDateV1_(request.ruleNote);
  if (["#52-", "#42-"].indexOf(candidate.seriesTitleCode) >= 0) {
    candidate.showIds = [AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_];
  }
  return candidate;
}

// 申請補足の「#52-」「#42-」などを連載固有コードとして取り込む。
// タイトル側ではこのコードの直後に半角数字が続く場合だけ一致とする。
function extractAutoUpdateSeriesTitleCodeV1_(ruleNote) {
  const normalized = String(ruleNote || "").normalize("NFKC");
  const match = normalized.match(/#(\d+)-/);
  return match ? "#" + match[1] + "-" : "";
}

function extractAutoUpdateSeedDateV1_(ruleNote) {
  const match = String(ruleNote || "").match(/(?:起点日|最新既存回)[：:\s]*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function inspectAutoUpdatePlaylistAccessV1_(playlistId, token) {
  const meResponse = UrlFetchApp.fetch("https://api.spotify.com/v1/me", {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  if (meResponse.getResponseCode() !== 200) return { editable: false, reason: "profile" };
  const me = JSON.parse(meResponse.getContentText());
  const playlistResponse = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) + "?fields=id,collaborative,owner(id)",
    { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } }
  );
  if (playlistResponse.getResponseCode() !== 200) return { editable: false, reason: "playlist" };
  const playlist = JSON.parse(playlistResponse.getContentText());
  const owned = String(playlist.owner && playlist.owner.id ? playlist.owner.id : "") === String(me.id || "");
  const presentInLibrary = owned || isAutoUpdatePlaylistInCurrentUserLibraryV1_(playlistId, token);
  const collaborative = playlist.collaborative === true;
  return {
    editable: owned || (collaborative && presentInLibrary),
    owned: owned,
    collaborative: collaborative,
    presentInLibrary: presentInLibrary
  };
}

// 共同編集招待の承認状態を、秘密値を出さずに確認する管理用診断。
function diagnosePendingAutoUpdateAccessV1() {
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!sheet) throw new Error("自動更新申請シートが見つかりません");
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues() : [];
  const results = rows.map(function(row, index) {
    const status = String(row[7] || "").trim();
    if (status !== "招待承認待ち") return null;
    const playlistId = extractAutoUpdateSpotifyPlaylistId_(String(row[1] || ""));
    const access = inspectAutoUpdatePlaylistAccessV1_(playlistId, token);
    return {
      row: index + 2,
      playlistId: playlistId,
      editable: access.editable === true,
      owned: access.owned === true,
      collaborative: access.collaborative === true,
      presentInLibrary: access.presentInLibrary === true,
      reason: String(access.reason || "")
    };
  }).filter(Boolean);
  Logger.log(JSON.stringify(results));
  return results;
}

// 今回受付したMEDIA TALK内の2シリーズだけを初回補完する管理用関数。
function syncAsahiRequestedSeriesV1() {
  const targetIds = new Set([
    "1u1qT0BxRZT1OeNM0LDA72",
    "7aKDEfAdCjTxiqiv19Grar"
  ]);
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return targetIds.has(String(rule && rule.playlistId ? rule.playlistId : ""));
  });
  const results = rules.map(function(rule) {
    rule.showIds = [AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_];
    saveAutoUpdateRuntimeRuleV1_(rule);
    return syncOneApprovedAutoUpdateRequestV1_(rule, token);
  });
  Logger.log(JSON.stringify(results));
  return results;
}

function isAutoUpdatePlaylistInCurrentUserLibraryV1_(playlistId, token) {
  let url = "https://api.spotify.com/v1/me/playlists?limit=50";
  let pages = 0;
  while (url && pages < 10) {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    });
    if (response.getResponseCode() !== 200) return false;
    const data = JSON.parse(response.getContentText());
    const found = (Array.isArray(data.items) ? data.items : []).some(function(item) {
      return String(item && item.id ? item.id : "") === playlistId;
    });
    if (found) return true;
    url = String(data.next || "");
    pages += 1;
  }
  return false;
}

function fetchAutoUpdateShowFirstPageV1_(showId, token) {
  const url = "https://api.spotify.com/v1/shows/" + encodeURIComponent(String(showId || "")) +
    "/episodes?market=JP&limit=" + AUTO_UPDATE_V1_RECENT_EPISODES_PER_SHOW_;
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const status = response.getResponseCode();
  if (status !== 200) throw new Error("Show取得に失敗しました: " + showId + " status=" + status);
  const data = JSON.parse(response.getContentText());
  return { items: Array.isArray(data.items) ? data.items : [] };
}

function fetchPlayableAutoUpdateEpisodesV1_(episodeIds, token) {
  const ids = Array.from(new Set((episodeIds || []).map(function(id) {
    return String(id || "").trim();
  }).filter(Boolean)));
  const episodes = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const response = fetchSpotifyReadWithRetry_(
      "https://api.spotify.com/v1/episodes?market=JP&ids=" +
        encodeURIComponent(batch.join(",")),
      { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token, Accept: "application/json" } },
      "Episodes batch " + String(offset / 50 + 1)
    );
    if (response.getResponseCode() !== 200) continue;
    const data = JSON.parse(response.getContentText());
    (Array.isArray(data.episodes) ? data.episodes : []).forEach(function(episode) {
      if (!episode || episode.is_playable === false) return;
      episodes.push({
        id: String(episode.id || ""),
        uri: String(episode.uri || ("spotify:episode:" + episode.id)),
        name: String(episode.name || episode.id),
        release_date: String(episode.release_date || "")
      });
    });
  }
  return episodes;
}

function captureAutoUpdateBoundariesV1_(rule, token) {
  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const page = fetchAutoUpdateShowFirstPageV1_(showId, token);
    const headId = String(page.items[0] && page.items[0].id ? page.items[0].id : "").trim();
    if (!headId) throw new Error("開始境界を取得できません: " + showId);
    saveAutoUpdateBoundaryV1_(rule.playlistId, showId, headId);
  });
}

function saveAutoUpdateRuntimeRuleV1_(rule) {
  const props = PropertiesService.getScriptProperties();
  const ids = JSON.parse(props.getProperty(AUTO_UPDATE_V1_RULE_IDS_KEY_) || "[]");
  if (ids.indexOf(rule.playlistId) < 0) ids.push(rule.playlistId);
  props.setProperty(AUTO_UPDATE_V1_RULE_IDS_KEY_, JSON.stringify(ids));
  props.setProperty(AUTO_UPDATE_V1_RULE_PREFIX_ + rule.playlistId, JSON.stringify(rule));
}

function loadAutoUpdateRuntimeRulesV1_() {
  const props = PropertiesService.getScriptProperties();
  const ids = JSON.parse(props.getProperty(AUTO_UPDATE_V1_RULE_IDS_KEY_) || "[]");
  return ids.map(function(id) {
    const raw = props.getProperty(AUTO_UPDATE_V1_RULE_PREFIX_ + id);
    return raw ? JSON.parse(raw) : null;
  }).filter(Boolean);
}

function autoUpdateBoundaryKeyV1_(playlistId, showId) {
  return AUTO_UPDATE_V1_BOUNDARY_PREFIX_ + playlistId + "_" + showId;
}

function saveAutoUpdateBoundaryV1_(playlistId, showId, episodeId) {
  PropertiesService.getScriptProperties().setProperty(autoUpdateBoundaryKeyV1_(playlistId, showId), episodeId);
}

function loadAutoUpdateBoundaryV1_(playlistId, showId) {
  return String(PropertiesService.getScriptProperties().getProperty(autoUpdateBoundaryKeyV1_(playlistId, showId)) || "");
}

function setAutoUpdateRequestStatusV1_(sheet, rowNumber, status, note) {
  const noteCell = sheet.getRange(rowNumber, 9);
  const existingNote = String(noteCell.getDisplayValue() || "");
  sheet.getRange(rowNumber, 8, 1, 2).setValues([[
    status,
    mergeAutoUpdateStatusNoteV1_(existingNote, note)
  ]]);
}

function mergeAutoUpdateStatusNoteV1_(existingNote, note) {
  const typeMatch = String(existingNote || "").match(/方式:\s*([^/\s]+)/);
  const detail = String(note || "").trim();
  return typeMatch
    ? "方式: " + String(typeMatch[1] || "") + (detail ? " / " + detail : "")
    : detail;
}

function setAutoUpdateRuleSheetStatusV1_(rule, status, note) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!sheet) throw new Error("自動更新申請シートが見つかりません");
  const row = Number(rule.requestSheetRow || 0);
  if (row >= 2) setAutoUpdateRequestStatusV1_(sheet, row, status, note);
}

function pauseAutoUpdateRuleV1_(rule, reason) {
  setAutoUpdateRuleSheetStatusV1_(rule, "確認待ち", reason);
  return { playlistId: rule.playlistId, ok: false, reviewRequired: true, reason: reason };
}
