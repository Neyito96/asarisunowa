// speaker-safe-v2 回帰確認用。Spotifyへの書き込みは行わない。
// 429対策: 回帰比較は既存プレイリストのエピソードを直接取得し、7番組全履歴走査を避ける。

function getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token) {
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const episodes = [];
  playlistItems.forEach(function(row) {
    // Spotify APIのplaylist itemsレスポンス差異に対応。
    const item = row && row.item ? row.item : row && row.track ? row.track : null;
    if (!item) return;
    const type = String(item.type || "");
    if (type && type !== "episode") return;
    episodes.push(item);
  });
  return { playlistItems: playlistItems, episodes: episodes };
}

function dryRunSpeakerSafeV2(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  if (getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_) throw new Error("speakerルールではありません: " + ruleKey);

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  // 回帰テストでは既存playlistだけを見る。新規候補探索は通常dry-run側で別途行う。
  const source = getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token);
  const counts = { confirmed:0, false_positive:0, review:0, unresolved:0 };
  const items = source.episodes.map(function(episode) {
    const result = classifySpeakerSafeV2_(episode, rule);
    if (Object.prototype.hasOwnProperty.call(counts, result.classification)) counts[result.classification]++;
    return {
      id:String(episode.id||""), uri:String(episode.uri||""), name:String(episode.name||""),
      releaseDate:String(episode.release_date||""), classification:result.classification,
      reasons:result.reasons, excerpt:result.excerpt
    };
  });

  Logger.log("=== SPEAKER SAFE V2 PLAYLIST REGRESSION: " + rule.name + " ===");
  Logger.log("既存プレイリスト: " + source.playlistItems.length);
  Logger.log("判定可能episode: " + source.episodes.length);
  Logger.log("confirmed: " + counts.confirmed + " / false_positive: " + counts.false_positive + " / review: " + counts.review + " / unresolved: " + counts.unresolved);
  return {
    dryRun:true, productionWriteAllowed:false, scope:"existing-playlist-only",
    ruleKey:rule.key, name:rule.name, playlistId:rule.playlistId,
    playlistItemCount:source.playlistItems.length, episodeCount:source.episodes.length,
    counts:counts,
    review:items.filter(function(x){return x.classification==="review";}),
    unresolved:items.filter(function(x){return x.classification==="unresolved";}),
    falsePositive:items.filter(function(x){return x.classification==="false_positive";})
  };
}

function compareOtaLegacyAndSpeakerSafeV2() {
  const rule = getAutoPlaylistRuleByKey_("ota-masahiko");
  if (!rule) throw new Error("太田匡彦ルールが見つかりません");
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  // 旧34件を回帰テストの固定母集団として使う。全7番組・全ページ取得はしない。
  const source = getSpeakerSafeV2PlaylistEpisodesForRegression_(rule, token);
  const mismatches = [];
  const counts = { same:0, different:0 };
  source.episodes.forEach(function(episode) {
    const legacy = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
    const v2 = classifySpeakerSafeV2_(episode, rule);
    const legacyClass = legacy && legacy.classification ? legacy.classification : "unresolved";
    const v2Class = v2 && v2.classification ? v2.classification : "unresolved";
    if (legacyClass === v2Class) counts.same++;
    else {
      counts.different++;
      mismatches.push({
        id:String(episode.id||""), name:String(episode.name||""), legacy:legacyClass, speakerSafeV2:v2Class,
        legacyReasons:legacy&&legacy.reasons?legacy.reasons:[], v2Reasons:v2&&v2.reasons?v2.reasons:[]
      });
    }
  });

  Logger.log("=== OTA LEGACY vs SPEAKER SAFE V2 / EXISTING PLAYLIST ===");
  Logger.log("playlist items: " + source.playlistItems.length);
  Logger.log("episodes compared: " + source.episodes.length);
  Logger.log("same: " + counts.same);
  Logger.log("different: " + counts.different);
  mismatches.forEach(function(item){ Logger.log(item.legacy + " -> " + item.speakerSafeV2 + " | " + item.name); });
  return {
    dryRun:true, productionWriteAllowed:false, scope:"existing-playlist-only",
    playlistItemCount:source.playlistItems.length, episodeCount:source.episodes.length,
    counts:counts, exactMatch:counts.different===0, mismatches:mismatches
  };
}

function dryRunOtaSpeakerSafeV2(){ return dryRunSpeakerSafeV2("ota-masahiko"); }
function dryRunToyohideSpeakerSafeV2(){ return dryRunSpeakerSafeV2("toyohide"); }
