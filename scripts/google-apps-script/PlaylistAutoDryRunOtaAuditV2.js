// 太田匡彦プレイリスト既存項目の監査 dry-run v2
// 5/31イベント告知などの定型告知を出演根拠から除外し、既存項目を再分類する。
// Spotify・スプレッドシートへの書き込みは行わない。

function dryRunOtaMasahikoExistingPlaylistAuditV2() {
  const playlistId = "7jLXrZ0JUNOnsSeFEFbw9S";
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === playlistId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + playlistId);
  }

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  const episodeIndex = buildOtaMasahikoExistingPlaylistAuditEpisodeIndex_(episodes);

  const items = playlistItems.map(function(playlistItem, index) {
    const playlistEpisode = playlistItem && playlistItem.item
      ? playlistItem.item
      : null;
    const resolved = resolveOtaMasahikoExistingPlaylistAuditEpisode_(
      playlistEpisode,
      episodeIndex
    );
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(
      resolved.episode
    );

    return {
      position: index + 1,
      id: String(
        resolved.episode && resolved.episode.id
          ? resolved.episode.id
          : playlistEpisode && playlistEpisode.id
          ? playlistEpisode.id
          : ""
      ),
      name: String(
        resolved.episode && resolved.episode.name
          ? resolved.episode.name
          : playlistEpisode && playlistEpisode.name
          ? playlistEpisode.name
          : ""
      ),
      uri: String(
        playlistEpisode && playlistEpisode.uri
          ? playlistEpisode.uri
          : resolved.episode && resolved.episode.uri
          ? resolved.episode.uri
          : ""
      ),
      releaseDate: String(
        resolved.episode && resolved.episode.release_date
          ? resolved.episode.release_date
          : playlistEpisode && playlistEpisode.release_date
          ? playlistEpisode.release_date
          : ""
      ),
      metadataSource: resolved.metadataSource,
      classification: classification.classification,
      reasons: classification.reasons,
      matchedField: classification.matchedField,
      matchedSection: classification.matchedSection,
      excerpt: classification.excerpt
    };
  });

  const counts = {
    confirmed: 0,
    false_positive: 0,
    review: 0,
    unresolved: 0
  };

  items.forEach(function(item) {
    if (Object.prototype.hasOwnProperty.call(counts, item.classification)) {
      counts[item.classification]++;
    }
  });

  Logger.log("=== EXISTING PLAYLIST AUDIT DRY RUN V2: " + rule.name + " ===");
  Logger.log("一次ソース数: " + getAutoPlaylistShowIds_(rule).length);
  Logger.log("取得エピソード数: " + episodes.length);
  Logger.log("既存プレイリスト項目数: " + playlistItems.length);
  Logger.log("confirmed: " + counts.confirmed);
  Logger.log("false_positive: " + counts.false_positive);
  Logger.log("review: " + counts.review);
  Logger.log("unresolved: " + counts.unresolved);

  items.forEach(function(item) {
    Logger.log(
      item.classification + " | " + item.releaseDate + " | " + item.name +
      " | " + item.uri + " | metadata=" + item.metadataSource +
      " | reasons=" + item.reasons.join(",") +
      (item.excerpt ? " | excerpt=" + item.excerpt : "")
    );
  });

  return {
    dryRun: true,
    audit: true,
    version: 2,
    name: rule.name,
    playlistId: playlistId,
    sourceShowCount: getAutoPlaylistShowIds_(rule).length,
    fetchedEpisodeCount: episodes.length,
    playlistItemCount: playlistItems.length,
    counts: counts,
    items: items
  };
}

function classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode) {
  if (!episode) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "unresolved", ["playlist_episode_missing"], "", "", ""
    );
  }

  const name = String(episode.name || "").trim();
  const description = normalizeOtaMasahikoExistingPlaylistAuditText_(
    episode.description,
    false
  );
  const htmlDescription = normalizeOtaMasahikoExistingPlaylistAuditText_(
    episode.html_description,
    true
  );

  if (!name && !description && !htmlDescription) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "unresolved", ["episode_metadata_missing"], "", "", ""
    );
  }

  if (!description && !htmlDescription) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "unresolved", ["episode_description_missing"], "", "", ""
    );
  }

  const fields = [
    { name: "description", text: description },
    { name: "html_description", text: htmlDescription }
  ];

  let confirmedMatch = null;
  let narrativeAppearanceMatch = null;
  let otherMatch = null;
  let promoMatch = null;
  let keptMentionCount = 0;
  let promoMentionCount = 0;

  fields.forEach(function(field) {
    if (!field.text) return;

    const stripped = stripOtaMasahikoKnownAnnouncementLines_(field.text);
    promoMentionCount += stripped.removedMentionCount;
    if (!promoMatch && stripped.firstRemovedExcerpt) {
      promoMatch = {
        field: field.name,
        section: "known_event_announcement",
        excerpt: stripped.firstRemovedExcerpt
      };
    }

    const analysis = extractOtaMasahikoExistingPlaylistAuditCreditSections_(
      stripped.text
    );
    keptMentionCount += analysis.mentionCount;

    if (!confirmedMatch && analysis.confirmedMatch) {
      confirmedMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.confirmedMatch
      );
    }

    // 「出演・スタッフ」欄は、既知の告知行を先に除外した後なら
    // 太田匡彦本人のクレジットとして扱う。
    if (!confirmedMatch && analysis.ambiguousCreditMatch) {
      confirmedMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.ambiguousCreditMatch
      );
    }

    if (!narrativeAppearanceMatch && analysis.otherMatch &&
        isOtaMasahikoNarrativeAppearanceContext_(analysis.otherMatch.excerpt)) {
      narrativeAppearanceMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.otherMatch
      );
    }

    if (!otherMatch && analysis.otherMatch) {
      otherMatch = wrapOtaMasahikoAuditMatchV2_(
        field.name,
        analysis.otherMatch
      );
    }
  });

  if (confirmedMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "confirmed",
      ["name_found_in_credit_section_after_known_announcement_removed"],
      confirmedMatch.field,
      confirmedMatch.section,
      confirmedMatch.excerpt
    );
  }

  if (narrativeAppearanceMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "confirmed",
      ["name_found_in_narrative_appearance_context"],
      narrativeAppearanceMatch.field,
      narrativeAppearanceMatch.section,
      narrativeAppearanceMatch.excerpt
    );
  }

  if (promoMentionCount > 0 && keptMentionCount === 0 && promoMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "false_positive",
      ["all_name_mentions_are_in_known_event_announcement"],
      promoMatch.field,
      promoMatch.section,
      promoMatch.excerpt
    );
  }

  if (otherMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review",
      ["name_found_outside_credit_section", "appearance_not_confirmed"],
      otherMatch.field,
      otherMatch.section,
      otherMatch.excerpt
    );
  }

  if (/太田[\s　]*匡彦/.test(name)) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review",
      ["name_found_in_episode_title", "appearance_not_confirmed_in_description"],
      "name",
      "episode_title",
      createOtaMasahikoExistingPlaylistAuditExcerpt_(name)
    );
  }

  if (promoMentionCount > 0 && promoMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "false_positive",
      ["known_event_announcement_only_after_cleanup"],
      promoMatch.field,
      promoMatch.section,
      promoMatch.excerpt
    );
  }

  return otaMasahikoExistingPlaylistAuditClassification_(
    "review",
    ["name_not_found", "existing_playlist_membership_requires_manual_review"],
    "",
    "",
    ""
  );
}

function stripOtaMasahikoKnownAnnouncementLines_(text) {
  const lines = String(text || "").split(/\n/);
  const namePattern = /太田[\s　]*匡彦/g;
  const kept = [];
  let removedMentionCount = 0;
  let firstRemovedExcerpt = "";

  lines.forEach(function(rawLine) {
    const line = String(rawLine || "");
    const nameMatches = line.match(namePattern) || [];
    const isKnownPromo = isOtaMasahikoKnownAnnouncementLine_(line);

    if (isKnownPromo) {
      removedMentionCount += nameMatches.length;
      if (!firstRemovedExcerpt && nameMatches.length) {
        firstRemovedExcerpt = createOtaMasahikoExistingPlaylistAuditExcerpt_(line);
      }
      return;
    }

    kept.push(line);
  });

  return {
    text: kept.join("\n"),
    removedMentionCount: removedMentionCount,
    firstRemovedExcerpt: firstRemovedExcerpt
  };
}

function isOtaMasahikoKnownAnnouncementLine_(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text) return false;

  // 2025年5月末の1億DL記念イベント告知で、多数の無関係回に
  // 同じ出演者列が差し込まれたケースを明示的に除外する。
  if (/朝ポキメンバーも多数参加/.test(text) && /太田[\s　]*匡彦/.test(text)) {
    return true;
  }

  // 装飾付き見出し「【祝・1億DL！ 5\/31（土）イベント】」等も
  // 告知ブロックとして扱う。ただし氏名がない見出し自体は、
  // この関数では削除しても判定結果に影響しない。
  if (/1億DL/.test(text) && /5\s*\/\s*31/.test(text) && /イベント/.test(text)) {
    return true;
  }

  return false;
}

function isOtaMasahikoNarrativeAppearanceContext_(excerpt) {
  const text = String(excerpt || "");
  if (!/太田[\s　]*匡彦/.test(text)) return false;

  return /(記者に聞きました|記者に聞く|記者と考えます|記者が警鐘|記者が解説|太田[\s　]*匡彦記者|太田[\s　]*匡彦さん|太田[\s　]*匡彦氏)/.test(text);
}

function wrapOtaMasahikoAuditMatchV2_(fieldName, match) {
  return {
    field: fieldName,
    section: String(match && match.section ? match.section : ""),
    excerpt: String(match && match.excerpt ? match.excerpt : "")
  };
}
