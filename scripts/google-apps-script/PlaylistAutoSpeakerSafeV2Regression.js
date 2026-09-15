// speaker-safe-v2 回帰確認用。Spotifyへの書き込みは行わない。
// 429対策: 既存プレイリストだけを取得し、7番組全履歴走査を避ける。

function getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token) {
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const episodes = [];
  const unavailableItems = [];
  const skippedOther = [];
  playlistItems.forEach(function(row, index) {
    const hasItemKey = !!(row && Object.prototype.hasOwnProperty.call(row, "item"));
    const item = row && row.item ? row.item : row && row.track ? row.track : null;
    if (!item) {
      const record = { index:index, reason:hasItemKey ? "unavailable_item" : "item_missing", rowKeys:Object.keys(row || {}) };
      if (record.reason === "unavailable_item") unavailableItems.push(record); else skippedOther.push(record);
      return;
    }
    const type = String(item.type || "");
    if (type && type !== "episode") {
      skippedOther.push({ index:index, reason:"non_episode_type", type:type, id:String(item.id||""), uri:String(item.uri||""), name:String(item.name||"") });
      return;
    }
    episodes.push(item);
  });
  return { playlistItems:playlistItems, episodes:episodes, unavailableItems:unavailableItems, skippedOther:skippedOther };
}

function logSpeakerSafeV2SourceSummary_(source) {
  Logger.log("playlist items: " + source.playlistItems.length);
  Logger.log("episodes usable: " + source.episodes.length);
  Logger.log("unavailable items: " + source.unavailableItems.length);
  Logger.log("other skipped: " + source.skippedOther.length);
  source.unavailableItems.forEach(function(item) { Logger.log("UNAVAILABLE #" + (item.index + 1) + " | Spotify item=null"); });
  source.skippedOther.forEach(function(item) { Logger.log("SKIP #" + (item.index + 1) + " | " + item.reason + " | type=" + String(item.type||"") + " | " + String(item.name||"")); });
}

function diagnoseSpeakerSafeV2Metadata_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const source = getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token);
  const summary = { name:0, description:0, htmlDescription:0, show:0, id:0 };
  const rows = source.episodes.map(function(ep, index) {
    const row = {
      index:index,
      id:!!String(ep && ep.id || ""),
      name:!!String(ep && ep.name || ""),
      description:!!String(ep && ep.description || ""),
      htmlDescription:!!String(ep && ep.html_description || ""),
      show:!!(ep && ep.show),
      keys:Object.keys(ep || {})
    };
    if (row.id) summary.id++;
    if (row.name) summary.name++;
    if (row.description) summary.description++;
    if (row.htmlDescription) summary.htmlDescription++;
    if (row.show) summary.show++;
    return row;
  });
  Logger.log("=== SPEAKER SAFE V2 METADATA: " + rule.name + " ===");
  logSpeakerSafeV2SourceSummary_(source);
  Logger.log("id: " + summary.id + "/" + source.episodes.length);
  Logger.log("name: " + summary.name + "/" + source.episodes.length);
  Logger.log("description: " + summary.description + "/" + source.episodes.length);
  Logger.log("html_description: " + summary.htmlDescription + "/" + source.episodes.length);
  Logger.log("show: " + summary.show + "/" + source.episodes.length);
  rows.forEach(function(row) {
    if (!row.description || !row.htmlDescription) Logger.log("META #" + (row.index+1) + " | id=" + row.id + " name=" + row.name + " desc=" + row.description + " html=" + row.htmlDescription + " show=" + row.show + " | keys=" + row.keys.join(","));
  });
  return { dryRun:true, productionWriteAllowed:false, ruleKey:rule.key, playlistItemCount:source.playlistItems.length, episodeCount:source.episodes.length, unavailableItemCount:source.unavailableItems.length, summary:summary, rows:rows };
}

function diagnoseToyohideSpeakerSafeV2Metadata(){ return diagnoseSpeakerSafeV2Metadata_("toyohide"); }
function diagnoseOtaSpeakerSafeV2Metadata(){ return diagnoseSpeakerSafeV2Metadata_("ota-masahiko"); }
function diagnoseOtaSpeakerSafeV2SkippedItems(){ return diagnoseSpeakerSafeV2Metadata_("ota-masahiko"); }

function dryRunSpeakerSafeV2(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  if (getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_) throw new Error("speakerルールではありません: " + ruleKey);
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const source = getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token);
  const counts = { confirmed:0, false_positive:0, review:0, unresolved:0 };
  const items = source.episodes.map(function(episode) {
    const result = classifySpeakerSafeV2_(episode, rule);
    if (Object.prototype.hasOwnProperty.call(counts, result.classification)) counts[result.classification]++;
    return { id:String(episode.id||""), uri:String(episode.uri||""), name:String(episode.name||""), releaseDate:String(episode.release_date||""), classification:result.classification, reasons:result.reasons, excerpt:result.excerpt };
  });
  Logger.log("=== SPEAKER SAFE V2 PLAYLIST REGRESSION: " + rule.name + " ===");
  logSpeakerSafeV2SourceSummary_(source);
  Logger.log("confirmed: " + counts.confirmed + " / false_positive: " + counts.false_positive + " / review: " + counts.review + " / unresolved: " + counts.unresolved);
  return { dryRun:true, productionWriteAllowed:false, scope:"existing-playlist-only", ruleKey:rule.key, name:rule.name, playlistId:rule.playlistId, playlistItemCount:source.playlistItems.length, episodeCount:source.episodes.length, unavailableItemCount:source.unavailableItems.length, otherSkippedCount:source.skippedOther.length, counts:counts, review:items.filter(function(x){return x.classification==="review";}), unresolved:items.filter(function(x){return x.classification==="unresolved";}), falsePositive:items.filter(function(x){return x.classification==="false_positive";}), unavailableItems:source.unavailableItems, skippedOther:source.skippedOther };
}

function compareOtaLegacyAndSpeakerSafeV2() {
  const rule = getAutoPlaylistRuleByKey_("ota-masahiko");
  if (!rule) throw new Error("太田匡彦ルールが見つかりません");
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const source = getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token);
  const mismatches = [];
  const counts = { same:0, different:0 };
  source.episodes.forEach(function(episode) {
    const legacy = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
    const v2 = classifySpeakerSafeV2_(episode, rule);
    const legacyClass = legacy && legacy.classification ? legacy.classification : "unresolved";
    const v2Class = v2 && v2.classification ? v2.classification : "unresolved";
    if (legacyClass === v2Class) counts.same++;
    else { counts.different++; mismatches.push({ id:String(episode.id||""), name:String(episode.name||""), legacy:legacyClass, speakerSafeV2:v2Class, legacyReasons:legacy&&legacy.reasons?legacy.reasons:[], v2Reasons:v2&&v2.reasons?v2.reasons:[] }); }
  });
  const regressionPassed = counts.different === 0 && source.skippedOther.length === 0 && source.episodes.length > 0;
  Logger.log("=== OTA LEGACY vs SPEAKER SAFE V2 / EXISTING PLAYLIST ===");
  logSpeakerSafeV2SourceSummary_(source);
  Logger.log("same: " + counts.same + " / different: " + counts.different);
  Logger.log("REGRESSION: " + (regressionPassed ? "PASS" : "REVIEW"));
  return { dryRun:true, productionWriteAllowed:false, scope:"existing-playlist-only", playlistItemCount:source.playlistItems.length, episodeCount:source.episodes.length, unavailableItemCount:source.unavailableItems.length, otherSkippedCount:source.skippedOther.length, counts:counts, regressionPassed:regressionPassed, classificationExactMatch:counts.different===0, mismatches:mismatches, unavailableItems:source.unavailableItems, skippedOther:source.skippedOther };
}

function dryRunOtaSpeakerSafeV2(){ return dryRunSpeakerSafeV2("ota-masahiko"); }
function dryRunToyohideSpeakerSafeV2(){ return dryRunSpeakerSafeV2("toyohide"); }
