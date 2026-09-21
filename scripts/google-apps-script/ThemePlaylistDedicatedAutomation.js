// 専用タブ方式の独立した実装。既存トリガーには接続しない。
// 明示的な呼び出しまで本番のSpotify・シートには書き込まない。
function getThemePlaylistPendingRows_(rule, sheet) {
  const seen = new Set();
  return readThemeReviewRows_(sheet).map(function(row, index) {
    return { row: row, rowNumber: index + 2 };
  }).filter(function(item) {
    const row = item.row;
    const id = String(row[1] || '').trim();
    const decision = String(row[8] || '').trim();
    if (String(row[0] || '').trim() !== String(rule.key) || !id || seen.has(id)) return false;
    seen.add(id);
    return !row[10] && THEME_PLAYLIST_APPROVED_DECISIONS_.indexOf(decision) !== -1;
  });
}

// 候補の登録先を専用タブに限定。既存キュー・履歴の行は消さない。
// 初回は必ずコピーしてから登録し、過去の除外・採用を再候補化しない。
function appendThemeEpisodesToDedicatedTab_(rule, episodes) {
  copyThemeReviewRowsToPlaylistTab_(rule.key);
  const sheet = ensureThemePlaylistTab_(rule);
  const existing = readThemeReviewExistingRows_(sheet);
  const seen = new Set();
  const rows = (episodes || []).map(function(episode) {
    const id = String(episode && episode.id || '').trim();
    const key = String(rule.key) + '::' + id;
    if (!id || existing[key] || seen.has(key)) return null;
    seen.add(key);
    const matched = getThemeReviewMatchedKeywords_(episode, rule);
    return [rule.key, id, String(episode.release_date || ''),
      String(episode.show && episode.show.name || ''), String(episode.name || ''),
      matched.join(' / '), buildThemeReviewExcerpt_(episode, matched),
      String(episode.external_urls && episode.external_urls.spotify ||
        'https://open.spotify.com/episode/' + id),
      '未確認', '', '', ''];
  }).filter(Boolean);
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, THEME_REVIEW_HEADERS_.length)
      .setValues(rows);
  }
  return { ruleKey: rule.key, sheetName: sheet.getName(), newCandidateCount: rows.length };
}

// 書き込み前の確認専用。タブの作成もSpotify呼び出しも行わない。
function previewDedicatedThemeSpotifyWrites_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule || getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    throw new Error('テーマルールが見つかりません: ' + ruleKey);
  }
  const sheet = getThemePlaylistReadSheet_(rule);
  const pending = sheet ? getThemePlaylistPendingRows_(rule, sheet) : [];
  return { ruleKey: rule.key, sheetName: sheet ? sheet.getName() : '',
    approvedCount: pending.length,
    episodeIds: pending.map(function(item) { return String(item.row[1]).trim(); }) };
}

// 既存の本番ライターは変更しない。専用タブの採用行だけを処理する明示実行用関数。
// 旧トリガーとの並行実行を避けるため共通のスクリプトロックを取得する。
function addDedicatedThemeCandidatesToSpotify_(ruleKey) {
  if (!isThemeReviewSpotifyWriteEnabled_()) {
    throw new Error('テーマ候補のSpotify追加は停止中です');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('別のテーマ処理が実行中です');
  try {
    const rule = getAutoPlaylistRuleByKey_(ruleKey);
    if (!rule || getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_) {
      throw new Error('テーマルールが見つかりません: ' + ruleKey);
    }
    assertAutoPlaylistSheetLinkBeforeWrite_(rule);
    // 未移行の共通タブを誤って更新しない。移行が完了していなければ停止。
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(getThemePlaylistTabName_(rule));
    if (!sheet) throw new Error('専用タブが未作成です。コピーと確認を先に実施してください');
    const approved = getThemePlaylistPendingRows_(rule, sheet);
    if (!approved.length) return { ruleKey: rule.key, addedCount: 0, skippedCount: 0 };
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error('Spotifyユーザー認証トークンを取得できませんでした');
    const items = getAllSpotifyPlaylistItems_(rule.playlistId, token);
    const existing = new Set(items.map(function(item) {
      return String(item && item.item && item.item.uri || '');
    }).filter(Boolean));
    const episodes = fetchThemeReviewEpisodeDetails_(approved.map(function(item) {
      return String(item.row[1]).trim();
    }), token).sort(function(a, b) {
      return String(a.release_date || '').localeCompare(String(b.release_date || ''));
    });
    const byId = {};
    approved.forEach(function(item) { byId[String(item.row[1]).trim()] = item; });
    let addedCount = 0;
    let skippedCount = 0;
    const addedEpisodes = [];
    episodes.forEach(function(episode) {
      const item = byId[String(episode.id || '')];
      if (!item) return;
      const uri = String(episode.uri || 'spotify:episode:' + episode.id);
      if (existing.has(uri)) {
        skippedCount += 1;
      } else {
        const result = addAutoPlaylistEpisodesIndividually_(rule, token, [episode]);
        if (result.failedCount > 0) {
          sheet.getRange(item.rowNumber, 12).setValue('Spotify追加失敗');
          return;
        }
        addedCount += 1;
        addedEpisodes.push(episode);
        existing.add(uri);
      }
      sheet.getRange(item.rowNumber, 10).setValue(item.row[9] || new Date());
      sheet.getRange(item.rowNumber, 11).setValue(new Date());
      sheet.getRange(item.rowNumber, 12).clearContent();
    });
    if (addedEpisodes.length && rule.updateLatestDateOnAdd === true) {
      updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(addedEpisodes));
    }
    SpreadsheetApp.flush();
    // 完了行は専用タブに保持し、再巡回時の再登録を防止する。
    return { ruleKey: rule.key, addedCount: addedCount, skippedCount: skippedCount,
      sheetName: sheet.getName() };
  } finally {
    lock.releaseLock();
  }
}
