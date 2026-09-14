// 太田匡彦プレイリスト既存項目の監査 dry-run v5
// 429回避のためShowエピソードを少量ずつ取得し、途中状態をUserPropertiesへ一時保存する。
// Spotify・スプレッドシートへの書き込みは行わない。
// UserPropertiesには OTA_AUDIT_V5_ 接頭辞の一時データだけを書き込む。

const OTA_AUDIT_V5_PREFIX_ = "OTA_AUDIT_V5_";
const OTA_AUDIT_V5_STATE_KEY_ = OTA_AUDIT_V5_PREFIX_ + "STATE";
const OTA_AUDIT_V5_EP_PREFIX_ = OTA_AUDIT_V5_PREFIX_ + "EP_";
const OTA_AUDIT_V5_PLAYLIST_ID_ = "7jLXrZ0JUNOnsSeFEFbw9S";
const OTA_AUDIT_V5_PAGES_PER_RUN_ = 2;

function dryRunOtaMasahikoExistingPlaylistAuditV5Step() {
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === OTA_AUDIT_V5_PLAYLIST_ID_;
  });
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + OTA_AUDIT_V5_PLAYLIST_ID_);

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const props = PropertiesService.getUserProperties();
  let state = loadOtaMasahikoAuditV5State_(props);

  if (!state) {
    const playlistItems = getAllSpotifyPlaylistItems_(OTA_AUDIT_V5_PLAYLIST_ID_, token);
    const targetIds = playlistItems.map(function(item) {
      const ep = item && item.item ? item.item : null;
      return String(ep && ep.id ? ep.id : "").trim();
    }).filter(Boolean);

    state = {
      version: 5,
      showIds: getAutoPlaylistShowIds_(rule),
      showIndex: 0,
      nextUrl: "",
      targetIds: targetIds,
      matchedIds: [],
      pagesFetched: 0,
      complete: false
    };
    saveOtaMasahikoAuditV5State_(props, state);
  }

  if (state.complete) {
    Logger.log("V5取得は完了済みです。dryRunOtaMasahikoExistingPlaylistAuditV5Report を実行してください。");
    return state;
  }

  const targetSet = new Set(state.targetIds || []);
  const matchedSet = new Set(state.matchedIds || []);
  let pagesThisRun = 0;

  while (pagesThisRun < OTA_AUDIT_V5_PAGES_PER_RUN_ && !state.complete) {
    if (state.showIndex >= state.showIds.length) {
      state.complete = true;
      break;
    }

    const showId = state.showIds[state.showIndex];
    const url = state.nextUrl || ("https://api.spotify.com/v1/shows/" + encodeURIComponent(showId) + "/episodes?market=JP&limit=50");
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    });
    const status = response.getResponseCode();

    if (status === 429) {
      const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
      const retryAfter = headers["Retry-After"] || headers["retry-after"] || "";
      saveOtaMasahikoAuditV5State_(props, state);
      Logger.log("Spotify 429: Show " + showId + " | ここで停止して状態を保存しました" + (retryAfter ? " | Retry-After=" + retryAfter + "秒" : ""));
      Logger.log("時間を置いて同じV5Stepを再実行してください。");
      return state;
    }

    if (status !== 200) {
      saveOtaMasahikoAuditV5State_(props, state);
      throw new Error("Show取得に失敗しました: " + showId + " | status=" + status + " | " + response.getContentText());
    }

    const data = JSON.parse(response.getContentText());
    const episodes = Array.isArray(data.items) ? data.items : [];
    episodes.forEach(function(ep) {
      const id = String(ep && ep.id ? ep.id : "").trim();
      if (!id || !targetSet.has(id)) return;
      saveOtaMasahikoAuditV5Episode_(props, ep);
      matchedSet.add(id);
    });

    state.matchedIds = Array.from(matchedSet);
    state.pagesFetched += 1;
    pagesThisRun += 1;

    if (data.next) state.nextUrl = String(data.next);
    else {
      state.showIndex += 1;
      state.nextUrl = "";
    }

    if (state.showIndex >= state.showIds.length) state.complete = true;
    saveOtaMasahikoAuditV5State_(props, state);

    Logger.log("V5 progress | show " + Math.min(state.showIndex + 1, state.showIds.length) + "/" + state.showIds.length + " | pages=" + state.pagesFetched + " | matched=" + state.matchedIds.length + "/" + state.targetIds.length + (state.complete ? " | complete" : ""));
  }

  Logger.log(state.complete ? "V5取得完了。dryRunOtaMasahikoExistingPlaylistAuditV5Report を実行してください。" : "V5Stepは安全のためここで停止。続きは同じ関数を再実行してください。");
  return state;
}

function dryRunOtaMasahikoExistingPlaylistAuditV5Report() {
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === OTA_AUDIT_V5_PLAYLIST_ID_;
  });
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + OTA_AUDIT_V5_PLAYLIST_ID_);

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const props = PropertiesService.getUserProperties();
  const state = loadOtaMasahikoAuditV5State_(props);
  if (!state) throw new Error("V5の途中状態がありません。先に dryRunOtaMasahikoExistingPlaylistAuditV5Step を実行してください。");
  if (!state.complete) throw new Error("V5取得がまだ完了していません: matched=" + String((state.matchedIds || []).length) + "/" + String((state.targetIds || []).length));

  const playlistItems = getAllSpotifyPlaylistItems_(OTA_AUDIT_V5_PLAYLIST_ID_, token);
  const items = playlistItems.map(function(playlistItem, index) {
    const playlistEpisode = playlistItem && playlistItem.item ? playlistItem.item : null;
    const id = String(playlistEpisode && playlistEpisode.id ? playlistEpisode.id : "").trim();
    const detailedEpisode = id ? loadOtaMasahikoAuditV5Episode_(props, id) : null;
    const episodeForAudit = detailedEpisode || playlistEpisode;
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episodeForAudit);

    return {
      position: index + 1,
      id: id,
      name: String(episodeForAudit && episodeForAudit.name ? episodeForAudit.name : ""),
      uri: String(playlistEpisode && playlistEpisode.uri ? playlistEpisode.uri : episodeForAudit && episodeForAudit.uri ? episodeForAudit.uri : ""),
      releaseDate: String(episodeForAudit && episodeForAudit.release_date ? episodeForAudit.release_date : ""),
      metadataSource: detailedEpisode ? "v5_show_cache" : (playlistEpisode ? "playlist_item" : "none"),
      classification: classification.classification,
      reasons: classification.reasons,
      matchedField: classification.matchedField,
      matchedSection: classification.matchedSection,
      excerpt: classification.excerpt
    };
  });

  const counts = { confirmed: 0, false_positive: 0, review: 0, unresolved: 0 };
  items.forEach(function(item) {
    if (Object.prototype.hasOwnProperty.call(counts, item.classification)) counts[item.classification]++;
  });

  Logger.log("=== EXISTING PLAYLIST AUDIT DRY RUN V5: " + rule.name + " ===");
  Logger.log("既存プレイリスト項目数: " + playlistItems.length);
  Logger.log("詳細取得済み: " + (state.matchedIds || []).length + "/" + (state.targetIds || []).length);
  Logger.log("confirmed: " + counts.confirmed);
  Logger.log("false_positive: " + counts.false_positive);
  Logger.log("review: " + counts.review);
  Logger.log("unresolved: " + counts.unresolved);

  items.forEach(function(item) {
    Logger.log(item.classification + " | " + item.releaseDate + " | " + item.name + " | " + item.uri + " | metadata=" + item.metadataSource + " | reasons=" + item.reasons.join(",") + (item.excerpt ? " | excerpt=" + item.excerpt : ""));
  });

  return { dryRun: true, audit: true, version: 5, name: rule.name, playlistId: OTA_AUDIT_V5_PLAYLIST_ID_, playlistItemCount: playlistItems.length, detailedEpisodeCount: (state.matchedIds || []).length, counts: counts, items: items };
}

function resetOtaMasahikoExistingPlaylistAuditV5() {
  const props = PropertiesService.getUserProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(OTA_AUDIT_V5_PREFIX_) === 0) props.deleteProperty(key);
  });
  Logger.log("V5一時データをリセットしました。");
}

function loadOtaMasahikoAuditV5State_(props) {
  const raw = props.getProperty(OTA_AUDIT_V5_STATE_KEY_);
  return raw ? JSON.parse(raw) : null;
}

function saveOtaMasahikoAuditV5State_(props, state) {
  props.setProperty(OTA_AUDIT_V5_STATE_KEY_, JSON.stringify(state));
}

function saveOtaMasahikoAuditV5Episode_(props, episode) {
  const id = String(episode && episode.id ? episode.id : "").trim();
  if (!id) return;
  const compact = { id: id, name: String(episode.name || ""), uri: String(episode.uri || ""), release_date: String(episode.release_date || ""), description: String(episode.description || ""), html_description: String(episode.html_description || "") };
  props.setProperty(OTA_AUDIT_V5_EP_PREFIX_ + id, JSON.stringify(compact));
}

function loadOtaMasahikoAuditV5Episode_(props, id) {
  const raw = props.getProperty(OTA_AUDIT_V5_EP_PREFIX_ + id);
  return raw ? JSON.parse(raw) : null;
}
