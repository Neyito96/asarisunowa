// プレイリスト自動更新の書き込みなし確認
// Spotify・スプレッドシートへの書き込みは行わず、候補件数と未登録候補を返す。

function dryRunAutoPlaylistByPlaylistId(playlistId) {
  const wantedId = String(playlistId || "").trim();
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === wantedId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + wantedId);
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);

  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  const candidates = episodes.filter(function(ep) {
    return matchesAutoPlaylistRule_(ep, rule);
  });

  const newEpisodes = candidates.filter(function(ep) {
    const uri = String(ep && ep.uri ? ep.uri : "");
    return uri && !existingUris.has(uri);
  });

  const result = {
    dryRun: true,
    name: rule.name,
    playlistId: rule.playlistId,
    sourceShowCount: getAutoPlaylistShowIds_(rule).length,
    fetchedEpisodeCount: episodes.length,
    candidateCount: candidates.length,
    newEpisodeCount: newEpisodes.length,
    newEpisodes: newEpisodes.map(function(ep) {
      return {
        id: String(ep && ep.id ? ep.id : ""),
        name: String(ep && ep.name ? ep.name : ""),
        uri: String(ep && ep.uri ? ep.uri : ""),
        releaseDate: String(ep && ep.release_date ? ep.release_date : "")
      };
    })
  };

  Logger.log("=== DRY RUN: " + rule.name + " ===");
  Logger.log("一次ソース数: " + result.sourceShowCount);
  Logger.log("取得エピソード数: " + result.fetchedEpisodeCount);
  Logger.log("候補件数: " + result.candidateCount);
  Logger.log("未登録候補: " + result.newEpisodeCount);
  result.newEpisodes.forEach(function(ep) {
    Logger.log(ep.releaseDate + " | " + ep.name + " | " + ep.uri);
  });

  return result;
}

function dryRunOtaMasahikoExistingPlaylistAudit() {
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
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisode_(
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

  const result = {
    dryRun: true,
    audit: true,
    name: rule.name,
    playlistId: playlistId,
    sourceShowCount: getAutoPlaylistShowIds_(rule).length,
    fetchedEpisodeCount: episodes.length,
    playlistItemCount: playlistItems.length,
    counts: counts,
    items: items
  };

  Logger.log("=== EXISTING PLAYLIST AUDIT DRY RUN: " + rule.name + " ===");
  Logger.log("一次ソース数: " + result.sourceShowCount);
  Logger.log("取得エピソード数: " + result.fetchedEpisodeCount);
  Logger.log("既存プレイリスト項目数: " + result.playlistItemCount);
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

  return result;
}

function buildOtaMasahikoExistingPlaylistAuditEpisodeIndex_(episodes) {
  const byUri = {};
  const byId = {};

  (Array.isArray(episodes) ? episodes : []).forEach(function(episode) {
    const uri = String(episode && episode.uri ? episode.uri : "").trim();
    const id = String(episode && episode.id ? episode.id : "").trim();

    if (uri) {
      byUri[uri] = episode;
    }
    if (id) {
      byId[id] = episode;
    }
    if (uri.indexOf("spotify:episode:") === 0) {
      const idFromUri = uri.substring("spotify:episode:".length);
      if (idFromUri && !byId[idFromUri]) {
        byId[idFromUri] = episode;
      }
    }
  });

  return { byUri: byUri, byId: byId };
}

function resolveOtaMasahikoExistingPlaylistAuditEpisode_(playlistEpisode, episodeIndex) {
  if (!playlistEpisode) {
    return { episode: null, metadataSource: "none" };
  }

  const uri = String(playlistEpisode.uri || "").trim();
  const id = String(playlistEpisode.id || "").trim();
  let sourceEpisode = uri && episodeIndex.byUri
    ? episodeIndex.byUri[uri] || null
    : null;

  if (!sourceEpisode && id && episodeIndex.byId) {
    sourceEpisode = episodeIndex.byId[id] || null;
  }

  if (!sourceEpisode && uri.indexOf("spotify:episode:") === 0 && episodeIndex.byId) {
    sourceEpisode = episodeIndex.byId[
      uri.substring("spotify:episode:".length)
    ] || null;
  }

  return sourceEpisode
    ? { episode: sourceEpisode, metadataSource: "show_episode" }
    : { episode: playlistEpisode, metadataSource: "playlist_item" };
}

function classifyOtaMasahikoExistingPlaylistAuditEpisode_(episode) {
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
  let ambiguousCreditMatch = null;
  let announcementMatch = null;
  let otherMatch = null;
  let totalMentionCount = 0;
  let announcementMentionCount = 0;

  fields.forEach(function(field) {
    if (!field.text) return;

    const analysis = extractOtaMasahikoExistingPlaylistAuditCreditSections_(field.text);
    totalMentionCount += analysis.mentionCount;
    announcementMentionCount += analysis.announcementMentionCount;

    [
      ["confirmedMatch", "confirmedMatch"],
      ["ambiguousCreditMatch", "ambiguousCreditMatch"],
      ["announcementMatch", "announcementMatch"],
      ["otherMatch", "otherMatch"]
    ].forEach(function(pair) {
      const localName = pair[0];
      const analysisName = pair[1];
      const value = analysis[analysisName];
      if (!value) return;
      const wrapped = {
        field: field.name,
        section: value.section,
        excerpt: value.excerpt
      };
      if (localName === "confirmedMatch" && !confirmedMatch) confirmedMatch = wrapped;
      if (localName === "ambiguousCreditMatch" && !ambiguousCreditMatch) ambiguousCreditMatch = wrapped;
      if (localName === "announcementMatch" && !announcementMatch) announcementMatch = wrapped;
      if (localName === "otherMatch" && !otherMatch) otherMatch = wrapped;
    });
  });

  if (confirmedMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "confirmed", ["name_found_in_credit_section"],
      confirmedMatch.field, confirmedMatch.section, confirmedMatch.excerpt
    );
  }

  if (ambiguousCreditMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review",
      ["name_found_in_ambiguous_credit_section", "appearance_role_not_confirmed"],
      ambiguousCreditMatch.field,
      ambiguousCreditMatch.section,
      ambiguousCreditMatch.excerpt
    );
  }

  if (totalMentionCount > 0 && totalMentionCount === announcementMentionCount && announcementMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "false_positive",
      ["name_not_found_in_credit_section", "all_name_mentions_are_in_announcement_context"],
      announcementMatch.field,
      announcementMatch.section,
      announcementMatch.excerpt
    );
  }

  if (otherMatch) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review", ["name_found_outside_credit_section", "appearance_not_confirmed"],
      otherMatch.field, otherMatch.section, otherMatch.excerpt
    );
  }

  if (/太田[\s　]*匡彦/.test(name)) {
    return otaMasahikoExistingPlaylistAuditClassification_(
      "review", ["name_found_in_episode_title", "appearance_not_confirmed_in_description"],
      "name", "episode_title", createOtaMasahikoExistingPlaylistAuditExcerpt_(name)
    );
  }

  return otaMasahikoExistingPlaylistAuditClassification_(
    "review", ["name_not_found", "existing_playlist_membership_requires_manual_review"],
    "", "", ""
  );
}

function otaMasahikoExistingPlaylistAuditClassification_(
  classification,
  reasons,
  matchedField,
  matchedSection,
  excerpt
) {
  return {
    classification: classification,
    reasons: reasons,
    matchedField: matchedField,
    matchedSection: matchedSection,
    excerpt: excerpt
  };
}

function extractOtaMasahikoExistingPlaylistAuditCreditSections_(text) {
  const lines = String(text || "").split(/\n/).map(function(line) {
    return String(line || "").trim();
  });
  const namePattern = /太田[\s　]*匡彦/;
  const ambiguousCreditHeadingPattern =
    /^[\s　]*[【\[（(■◆●▼▽◇・]*[\s　]*(出演[\s　]*[・／/][\s　]*スタッフ|スタッフ[\s　]*[・／/][\s　]*出演)(?=[\s　]*(?:[】\]）):：■◆●▼▽◇・]|$)|[\s　]+)/i;
  const confirmedCreditHeadingPattern =
    /^[\s　]*[【\[（(■◆●▼▽◇・]*[\s　]*(出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)(?=[\s　]*(?:[】\]）):：■◆●▼▽◇・]|$)|[\s　]+)/i;
  const announcementHeadingPattern =
    /^[\s　]*[【\[（(■◆●▼▽◇・]*[\s　]*(イベント|お知らせ|番組からのお知らせ|次回|次回予告|関連記事|関連リンク|過去回|キャンペーン|応募|購読|配信|SNS|X|Twitter|お問い合わせ|朝日新聞デジタル)(?=[\s　]*(?:[】\]）):：■◆●▼▽◇・]|$)|[\s　]+)/i;
  const nonAppearanceRolePattern = /(編集|制作|音源|取材協力|構成|技術|デザイン|写真|撮影)/;
  const announcementContextPattern =
    /(イベント|告知|お知らせ|登壇|次回|次回予告|関連記事|関連リンク|過去回|申し込み|申込み|応募|キャンペーン|詳しくはこちら|購読|配信予定)/;
  let sectionType = "other";
  let sectionName = "";
  let sectionLineCount = 0;
  let mentionCount = 0;
  let announcementMentionCount = 0;
  let confirmedMatch = null;
  let ambiguousCreditMatch = null;
  let announcementMatch = null;
  let otherMatch = null;

  lines.forEach(function(line) {
    if (!line) return;

    let headingMatch = line.match(ambiguousCreditHeadingPattern);
    if (headingMatch) {
      sectionType = "ambiguous_credit";
      sectionName = String(headingMatch[1] || "出演・スタッフ");
      sectionLineCount = 0;
    } else {
      headingMatch = line.match(confirmedCreditHeadingPattern);
      if (headingMatch) {
        sectionType = "confirmed_credit";
        sectionName = String(headingMatch[1] || "出演");
        sectionLineCount = 0;
      } else {
        headingMatch = line.match(announcementHeadingPattern);
        if (headingMatch) {
          sectionType = "announcement";
          sectionName = String(headingMatch[1] || "announcement");
          sectionLineCount = 0;
        } else {
          sectionLineCount++;
          if (sectionType !== "other" && sectionLineCount > 12) {
            sectionType = "other";
            sectionName = "";
            sectionLineCount = 0;
          }
        }
      }
    }

    const mentions = line.match(new RegExp(namePattern.source, "g"));
    if (!mentions || !mentions.length) return;

    mentionCount += mentions.length;
    const match = {
      section: sectionName || sectionType,
      excerpt: createOtaMasahikoExistingPlaylistAuditExcerpt_(line)
    };

    if (sectionType === "confirmed_credit") {
      if (nonAppearanceRolePattern.test(line)) {
        if (!ambiguousCreditMatch) ambiguousCreditMatch = match;
      } else if (!confirmedMatch) {
        confirmedMatch = match;
      }
      return;
    }

    if (sectionType === "ambiguous_credit") {
      if (!ambiguousCreditMatch) ambiguousCreditMatch = match;
      return;
    }

    if (sectionType === "announcement" || announcementContextPattern.test(line)) {
      announcementMentionCount += mentions.length;
      if (!announcementMatch) announcementMatch = match;
      return;
    }

    if (!otherMatch) otherMatch = match;
  });

  return {
    mentionCount: mentionCount,
    announcementMentionCount: announcementMentionCount,
    confirmedMatch: confirmedMatch,
    ambiguousCreditMatch: ambiguousCreditMatch,
    announcementMatch: announcementMatch,
    otherMatch: otherMatch
  };
}

function normalizeOtaMasahikoExistingPlaylistAuditText_(value, isHtml) {
  let text = String(value || "");

  if (isHtml) {
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|section|article)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "");
  }

  return text
    .replace(/\r\n?/g, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, function(_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-f]+);/gi, function(_, code) {
      return String.fromCharCode(parseInt(code, 16));
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createOtaMasahikoExistingPlaylistAuditExcerpt_(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= 240) return text;

  const match = text.match(/太田[\s　]*匡彦/);
  if (!match) return text.substring(0, 240);

  const start = Math.max(0, match.index - 100);
  const end = Math.min(text.length, match.index + match[0].length + 100);

  return (
    (start > 0 ? "…" : "") +
    text.substring(start, end) +
    (end < text.length ? "…" : "")
  );
}
