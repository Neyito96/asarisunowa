// 06_出演者ルール（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: PlaylistAutoSpeakerGuardrail.js, PlaylistAutoSpeakerSato.js, PlaylistAutoSpeakerSaito.js, PlaylistAutoSpeakerTerashita.js, SpeakerHumanDecisionSheet.js

// ---- PlaylistAutoSpeakerGuardrail.js ----
const SPEAKER_GUARDRAIL_CLASSIFICATION_ = {
  CONFIRMED: "confirmed",
  REVIEW: "review",
  FALSE_POSITIVE: "false_positive",
  UNRESOLVED: "unresolved"
};
const SPEAKER_GUARDRAIL_KNOWN_REVIEW_TITLES_ = {
  BE_FOUR_KINGS: "遊びじゃない、ガチの付録だよ"
};
function classifySpeakerEpisodeWithGuardrail_(episode, policy, classifier) {
  const safePolicy = policy || {};
  if (!episode) {
    return speakerGuardrailClassification_("unresolved", "episode_missing", "", "", "");
  }

  const episodeIdentity = String(episode.uri || episode.id || "").trim();
  if (safePolicy.requireEpisodeIdentity !== false && !episodeIdentity) {
    return speakerGuardrailClassification_("unresolved", "episode_identity_missing", "", "", "");
  }

  const title = String(episode.name || "").trim();
  const description = String(episode.description || "").trim();
  const htmlDescription = String(episode.html_description || "").trim();
  if (!title && !description && !htmlDescription) {
    return speakerGuardrailClassification_("unresolved", "episode_metadata_missing", "", "", "");
  }

  const knownReviewTitle = findSpeakerGuardrailKnownReviewTitle_(
    title,
    safePolicy.knownReviewTitleIncludes
  );
  if (knownReviewTitle) {
    return speakerGuardrailClassification_(
      "review",
      "known_manual_review_episode",
      title.substring(0, 240),
      "name",
      "title"
    );
  }

  if (typeof classifier !== "function") {
    return speakerGuardrailClassification_("unresolved", "classifier_missing", "", "", "");
  }

  try {
    return normalizeSpeakerGuardrailClassification_(classifier(episode));
  } catch (_) {
    return speakerGuardrailClassification_("unresolved", "classifier_error", "", "", "");
  }
}
function findSpeakerGuardrailKnownReviewTitle_(title, titleIncludes) {
  const normalizedTitle = String(title || "").replace(/\s+/g, " ").trim();
  if (!normalizedTitle || !Array.isArray(titleIncludes)) return "";

  return titleIncludes.find(function(fragment) {
    const wanted = String(fragment || "").replace(/\s+/g, " ").trim();
    return wanted && normalizedTitle.indexOf(wanted) >= 0;
  }) || "";
}
function normalizeSpeakerGuardrailClassification_(result) {
  if (!result || typeof result !== "object") {
    return speakerGuardrailClassification_("unresolved", "classifier_result_missing", "", "", "");
  }

  const allowed = Object.keys(SPEAKER_GUARDRAIL_CLASSIFICATION_).map(function(key) {
    return SPEAKER_GUARDRAIL_CLASSIFICATION_[key];
  });
  const classification = String(result.classification || "").trim();
  if (allowed.indexOf(classification) < 0) {
    return speakerGuardrailClassification_("unresolved", "classifier_result_invalid", "", "", "");
  }

  const reasons = Array.isArray(result.reasons)
    ? result.reasons.map(function(reason) { return String(reason || "").trim(); }).filter(Boolean)
    : [];
  const fallbackReason = String(result.reason || "").trim();
  if (!reasons.length && fallbackReason) reasons.push(fallbackReason);
  if (!reasons.length) reasons.push("classifier_reason_missing");

  return {
    classification: classification,
    reasons: reasons,
    reason: reasons[0],
    excerpt: String(result.excerpt || ""),
    metadataSource: String(result.metadataSource || ""),
    evidenceSection: String(result.evidenceSection || result.matchedSection || ""),
    matchedField: String(result.matchedField || result.metadataSource || ""),
    matchedSection: String(result.matchedSection || result.evidenceSection || "")
  };
}
function speakerGuardrailClassification_(classification, reason, excerpt, metadataSource, evidenceSection) {
  return {
    classification: classification,
    reasons: [reason],
    reason: reason,
    excerpt: String(excerpt || ""),
    metadataSource: String(metadataSource || ""),
    evidenceSection: String(evidenceSection || ""),
    matchedField: String(metadataSource || ""),
    matchedSection: String(evidenceSection || "")
  };
}
function isSpeakerGuardrailConfirmed_(result) {
  return Boolean(result && result.classification === SPEAKER_GUARDRAIL_CLASSIFICATION_.CONFIRMED);
}

// ---- PlaylistAutoSpeakerSato.js ----
function classifySatoYoAutoPlaylistEpisode_(episode) {
  return classifySpeakerEpisodeWithGuardrail_(episode, {
    requireEpisodeIdentity: true,
    knownReviewTitleIncludes: [SPEAKER_GUARDRAIL_KNOWN_REVIEW_TITLES_.BE_FOUR_KINGS]
  }, classifySatoYoEpisodeEvidence_);
}
function classifySatoYoEpisodeEvidence_(episode) {
  const description = normalizeSatoYoText_(episode.description, false);
  const htmlDescription = normalizeSatoYoText_(episode.html_description, true);
  if (!description && !htmlDescription) {
    return satoYoClassification_("unresolved", "description_missing", "");
  }

  const analyses = [description, htmlDescription]
    .filter(Boolean)
    .map(analyzeSatoYoText_);

  const confirmed = analyses.find(function(result) { return result.confirmedExcerpt; });
  if (confirmed) {
    return satoYoClassification_("confirmed", "appearance_confirmed", confirmed.confirmedExcerpt);
  }

  const mentionCount = analyses.reduce(function(sum, result) {
    return sum + result.mentionCount;
  }, 0);
  const announcementMentionCount = analyses.reduce(function(sum, result) {
    return sum + result.announcementMentionCount;
  }, 0);
  const firstExcerpt = analyses.reduce(function(found, result) {
    return found || result.firstExcerpt;
  }, "");

  if (mentionCount > 0 && mentionCount === announcementMentionCount) {
    return satoYoClassification_("false_positive", "announcement_only", firstExcerpt);
  }
  if (mentionCount > 0) {
    return satoYoClassification_("review", "name_found_without_appearance_confirmation", firstExcerpt);
  }

  return satoYoClassification_("review", "name_not_found", "");
}
function analyzeSatoYoText_(text) {
  const lines = String(text || "").split(/\n/).map(function(line) {
    return String(line || "").replace(/\s+/g, " ").trim();
  }).filter(Boolean);
  const namePattern = /佐藤[\s　]*陽/;
  const confirmedHeadingPattern = /^(?:【|\[|（|\()?\s*(出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)(?:】|\]|）|\)|:|：|\s|$)/i;
  const announcementHeadingPattern = /^(?:【|\[|（|\()?\s*(イベント|お知らせ|番組からのお知らせ|次回|次回予告|関連記事|関連リンク|過去回|キャンペーン|応募|購読|配信|SNS|X|Twitter|お問い合わせ)(?:】|\]|）|\)|:|：|\s|$)/i;
  const genericHeadingPattern = /^(?:(?:【[^】]{1,40}】|\[[^\]]{1,40}\]|（[^）]{1,40}）|\([^)]{1,40}\))\s*$|[^。！？\n]{1,24}[：:]\s*)/;
  const announcementContextPattern = /(イベント|告知|お知らせ|登壇|公開収録|会場|チケット|参加者|メンバーも多数参加|周年|記念グッズ|次回|次回予告|関連記事|関連リンク|過去回|申し込み|申込み|応募|キャンペーン|詳しくはこちら|購読|配信予定)/;
  const nonAppearanceByNamePattern = /佐藤[\s　]*陽(?:記者|さん|氏)?(?:(?![。！？\n]).){0,24}(?:編集|制作|音源|取材協力|構成|技術|デザイン|写真|撮影|執筆|記事)/;
  const appearanceByNamePattern = /佐藤[\s　]*陽(?:記者|さん|氏)?(?:が|に|と|を)?(?:話|聞|解説|説明|出演|登場|語|招|迎)/;
  const appearanceInSentencePattern = /佐藤[\s　]*陽(?:記者|さん|氏)?(?:(?![。！？\n]).){0,80}(?:話|聞|解説|説明|出演|登場|語|招|迎)/;
  const roleListPattern = /(?:出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター)[^。\n]{0,30}佐藤[\s　]*陽/;
  let section = "other";
  let sectionLines = 0;
  let mentionCount = 0;
  let announcementMentionCount = 0;
  let confirmedExcerpt = "";
  let firstExcerpt = "";

  lines.forEach(function(line) {
    if (confirmedHeadingPattern.test(line)) {
      section = "confirmed";
      sectionLines = 0;
    } else if (announcementHeadingPattern.test(line)) {
      section = "announcement";
      sectionLines = 0;
    } else if (genericHeadingPattern.test(line)) {
      section = "other";
      sectionLines = 0;
    } else {
      sectionLines += 1;
      if (sectionLines > 12) section = "other";
    }

    const mentions = line.match(new RegExp(namePattern.source, "g")) || [];
    if (!mentions.length) return;
    mentionCount += mentions.length;
    if (!firstExcerpt) firstExcerpt = line.substring(0, 240);

    if (section === "announcement" || announcementContextPattern.test(line)) {
      announcementMentionCount += mentions.length;
      return;
    }

    if (
      !confirmedExcerpt &&
      ((section === "confirmed" && !nonAppearanceByNamePattern.test(line)) ||
        ((appearanceByNamePattern.test(line) || appearanceInSentencePattern.test(line) || roleListPattern.test(line)) &&
          !nonAppearanceByNamePattern.test(line)))
    ) {
      confirmedExcerpt = line.substring(0, 240);
    }
  });

  return {
    mentionCount: mentionCount,
    announcementMentionCount: announcementMentionCount,
    confirmedExcerpt: confirmedExcerpt,
    firstExcerpt: firstExcerpt
  };
}
function normalizeSatoYoText_(value, isHtml) {
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
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function satoYoClassification_(classification, reason, excerpt) {
  return {
    classification: classification,
    reasons: [reason],
    reason: reason,
    excerpt: String(excerpt || "")
  };
}

// ---- PlaylistAutoSpeakerSaito.js ----
const SAITO_KENICHIRO_PLAYLIST_ID_ = "7FBbaBPpGDSJUIXN4L2iYi";
function isSaitoKenichiroAutoUpdateRule_(rule) {
  return String(rule && rule.playlistId || "") === SAITO_KENICHIRO_PLAYLIST_ID_ &&
    getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
}
function normalizeSaitoKenichiroText_(value) {
  return String(value || "").normalize("NFKC")
    .replace(/〖/g, "【").replace(/〗/g, "】")
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, function(_, n) { return String.fromCodePoint(parseInt(n, 16)); })
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCodePoint(Number(n)); })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\r\n?/g, "\n").trim();
}
function classifySaitoKenichiroAutoEpisode_(episode) {
  return classifySpeakerEpisodeWithGuardrail_(episode, { requireEpisodeIdentity: true },
    classifySaitoKenichiroEvidence_);
}
function classifySaitoKenichiroEvidence_(episode) {
  const title = normalizeSaitoKenichiroText_(episode.name);
  const sources = [episode.description, episode.html_description].map(normalizeSaitoKenichiroText_);
  const name = /斎藤\s*健一郎/;
  // Events are not rejected merely because a real episode discusses an event.
  const promo = /告知|お知らせ|開催案内|チケット|申込|申し込|応募|登壇者|出演者一覧|イベント出演|イベントに(?:登壇|出演|参加)|公開収録のお知らせ|開催予定|開催します|出演予定|登場予定|会場はこちら|メンバーも多数参加|記念グッズ|次回|前回|過去回/;
  const promoHeading = /イベント|開催|登壇|チケット|告知|お知らせ|関連(?:記事|リンク)|過去回|次回|出演者一覧/;
  const castHeading = /^(?:今回の|本日の|この回の|本編の)?(?:出演者?|ゲスト|パーソナリティ|MC|聞き手|語り|ナビゲーター|出演・スタッフ|スタッフ・出演)$/i;
  const episodeHeading = /^(?:番組内容|本編|今回の(?:内容|テーマ|出演者?)|この回の出演者?)$/;
  const nonAppearance = /斎藤\s*健一郎(?:記者|さん|氏)?(?:の|が|は)?[^。！？\n]{0,20}(?:執筆|著書|記事|取材協力|編集|制作|写真|撮影|欠席|不参加|出演しない|出演していない)/;
  // Affiliation is not evidence of an editing-only credit. Keep actual staff/negative verbs.
  const nonAppearanceOnly = function(text) {
    return nonAppearance.test(text.replace(/\((?:be編集部|文化部[・\s]*be編集部)\)/gi, ""));
  };
  const explicit = /斎藤\s*健一郎(?:記者|さん|氏)?(?:が|は|に|と|を)?\s*(?:ゲスト(?:として)?(?:出演|参加)|ゲストに迎え|招き|迎え|出演|登場|話(?:します|しました|す|した)|語(?:ります|りました|る|った)|解説|説明|聞く|聞きました)/;
  const inverse = /(?:ゲスト|出演|聞き手|MC)\s*(?:[：:]|は)?\s*(?:朝日新聞(?:の)?記者\s*)?斎藤\s*健一郎/;
  let mentions = 0;
  let excluded = 0;
  let first = "";
  const result = function(classification, reason, excerpt) {
    return { classification: classification, reason: reason, excerpt: String(excerpt || "").slice(0, 240) };
  };
  // This playlist keeps original releases only, including for future updates.
  if (/(?:^[（(【\[]\s*(?:再|再配信|再放送|再公開|リピート配信)\s*[）)】\]]|[（(【\[]\s*(?:再配信|再放送|再公開|リピート配信)\s*[）)】\]]\s*$)/.test(title)) {
    return result("false_positive", "replay_excluded", title);
  }
  // Human-confirmed original trilogy: legacy descriptions have no cast block.
  // Exact episode identity only; rule/manual exclusions still take priority.
  if (["3NB4NpFFJrLZYsgJc6HuD2", "1wutV8VESeD5r2T3hg9XYK", "3Y9SsYZ58P2itQZxvMcWan"].indexOf(String(episode.id || "")) >= 0) {
    return result("confirmed", "human_confirmed_original_episode", title);
  }
  if (name.test(title) && promo.test(title)) return result("false_positive", "announcement_title", title);
  // A named 1on1 or explicit speaking title is evidence; a bare name is not.
  if (name.test(title) && !promoHeading.test(title) && !nonAppearanceOnly(title) &&
      (/^[（(]\s*1on1\s*[）)]\s*斎藤\s*健一郎/i.test(title) || explicit.test(title))) {
    return result("confirmed", "explicit_title_appearance", title);
  }
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    let section = "other";
    const lines = sources[sourceIndex].split(/\n|(?=【)/).map(function(line) { return line.trim(); }).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const heading = line.match(/^(?:【([^】]+)】|\[([^\]]+)\]|([^。！？:：]{1,30})[：:])/) ||
        ((castHeading.test(line) || /^(?:イベントのお知らせ|番組からのお知らせ|開催案内|番組内容|本編)$/.test(line)) ? [line, line] : null);
      if (heading) {
        const label = String(heading[1] || heading[2] || heading[3]).trim();
        // Nested cast headings must not turn event promotional names into guests.
        if (/関連(?:記事|リンク)/.test(label)) { if (section !== "promo") section = "related"; }
        else if (promoHeading.test(label)) section = "promo";
        else if (episodeHeading.test(label)) section = castHeading.test(label) ? "cast" : "other";
        else if (castHeading.test(label)) { if (section !== "promo") section = "cast"; }
        else section = "other";
      }
      if (!heading && (promo.test(line) || /(?:イベント|公開収録).*(?:開催|参加|案内)/.test(line))) {
        // A dated episode paragraph may contain an inline notice. Exclude that
        // paragraph's names, but do not taint later separate article/credit blocks.
        section = /\d{4}年\d{1,2}月\d{1,2}日に収録しました/.test(line) ? "inline-promo" : "promo";
      }
      if (!name.test(line)) continue;
      mentions += 1;
      if (!first) first = line;
      // Spotify often concatenates all credits onto one line. Inspect this
      // person's credit, so another person's audio-editing credit is not ours.
      const castOnlyStaff = section === "cast" &&
        (/(?:音源編集|音声編集|編集担当|制作|写真|撮影|取材協力)\s*[：:]?\s*斎藤\s*健一郎/.test(line) ||
         /斎藤\s*健一郎(?:記者|さん|氏)?(?:が|は)[^。！？]{0,15}(?:編集|制作|写真|撮影|取材協力)/.test(line));
      const ownCredit = section === "cast"
        ? line.slice(line.search(name)).split(/、|,\s*|(?:MC|聞き手|音源編集|音声編集|司会)\s*/i)[0]
        : line;
      if (section === "promo" || section === "inline-promo" || section === "related" || promo.test(line) || castOnlyStaff || nonAppearanceOnly(ownCredit)) { excluded += 1; continue; }
      const titleEventContext = /イベント|公開収録|開催|登壇/.test(title);
      const explicitCurrentEpisode = /今回|本編|この回|本日の(?:番組|放送)/.test(line);
      if ((!titleEventContext || explicitCurrentEpisode) &&
          (section === "cast" || explicit.test(line) || inverse.test(line))) {
        return result("confirmed", "episode_appearance_evidence", line);
      }
    }
  }
  if (mentions && mentions === excluded) return result("false_positive", "announcement_or_nonappearance_only", first);
  if (mentions || name.test(title)) return result("review", "appearance_not_confirmed", first || title);
  return result("false_positive", "name_not_found", "");
}

// Keep ambiguous saved candidates for review; do not quietly discard them.
function assertSaitoKenichiroEpisodesBeforeWrite_(rule, episodes) {
  if (!isSaitoKenichiroAutoUpdateRule_(rule)) return;
  const approved = readApprovedSpeakerHumanDecisions_(rule.playlistId);
  const ledgerRule = Object.assign({}, rule, { manualEpisodeDecisions: approved });
  (episodes || []).forEach(function(episode) {
    if (isSpeakerAutoUpdateHumanBlocked_(rule, episode && episode.id) ||
        isSpeakerAutoUpdateHumanBlocked_(ledgerRule, episode && episode.id)) {
      throw new Error("斎藤健一郎: 人間判断済みepisodeの追加は禁止です");
    }
    if (classifySaitoKenichiroAutoEpisode_(episode).classification !== "confirmed") {
      throw new Error("斎藤健一郎: 追加直前の出演確認ができません");
    }
  });
}

// ---- PlaylistAutoSpeakerTerashita.js ----
function classifyTerashitaAutoEpisode_(episode) {
  const name = /寺下[\s　]*真理加/;
  const title = String(episode && episode.name || "");
  if (/(イベント|公開収録|登壇|参加者|告知|お知らせ)/.test(title)) {
    return { classification: "false_positive", reason: "announcement_title" };
  }
  const raw = [episode && episode.description, episode && episode.html_description]
    .map(function(value) { return String(value || ""); }).join("\n");
  const text = raw.replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/gi, " ");
  if (!name.test(title + "\n" + text)) return { classification: "review", reason: "name_not_found" };
  // The named 1on1 title itself identifies the guest; generic name mentions do not.
  if (/^[（(]\s*1on1\s*[）)]\s*寺下[\s　]*真理加/i.test(title)) {
    return { classification: "confirmed", reason: "named_1on1_title", excerpt: title.slice(0, 180) };
  }
  const announcement = /(イベント|お知らせ|告知|登壇|参加|会場|公開収録|関連記事|記事はこちら|執筆|チケット|申込|応募|メンバー|記念グッズ)/;
  const heading = /^\s*(?:【[^】]+】|\[[^\]]+\]|[^。！？]{1,25}[：:])\s*$/;
  const appearanceHeading = /^\s*(?:【|\[)?(?:出演者?|ゲスト|MC)(?:】|\])?\s*(?:[：:]\s*)?$/i;
  const lines = text.split(/\n/).map(function(line) { return line.replace(/\s+/g, " ").trim(); }).filter(Boolean);
  let inAppearance = false;
  let inAnnouncement = false;
  let sectionLines = 0;
  let announcementOnly = false;
  let outsideAnnouncement = name.test(title);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (heading.test(line)) {
      inAppearance = appearanceHeading.test(line);
      inAnnouncement = announcement.test(line);
      sectionLines = 0;
    } else {
      sectionLines += 1;
      if (sectionLines > 12) inAppearance = false;
    }
    if (!name.test(line)) continue;
    if (inAnnouncement || announcement.test(line)) {
      announcementOnly = true;
      continue;
    }
    outsideAnnouncement = true;
    if (inAppearance) return { classification: "confirmed", reason: "appearance_section", excerpt: line.slice(0, 180) };
    const explicit = /寺下[\s　]*真理加(?:さん|記者|氏)?(?:を|さんを|記者を)?\s*(?:ゲストに迎え|招き|迎え|が話します|が語ります|が出演します|さんが話します|出演します)/;
    const role = /(?:出演者?|ゲスト|MC)[^。！？\n]{0,32}寺下[\s　]*真理加/;
    if (explicit.test(line) || role.test(line)) {
      return { classification: "confirmed", reason: "explicit_appearance", excerpt: line.slice(0, 180) };
    }
  }
  if (announcementOnly && !outsideAnnouncement) {
    return { classification: "false_positive", reason: "announcement_only" };
  }
  return { classification: "review", reason: "appearance_not_confirmed" };
}

// ---- SpeakerHumanDecisionSheet.js ----
const SPEAKER_HUMAN_DECISION_SHEET_NAME_ = "AUTO出演者判定";
function extractSpeakerHumanEpisodeId_(value) {
  const raw = String(value || "").trim();
  if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
  const uri = raw.match(/^spotify:episode:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];
  const url = raw.match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[/?#].*)?$/);
  return url ? url[1] : "";
}
function setupSpeakerHumanDecisionSheetV1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = getSheetLoose(ss, SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (sheet) return { created: false, name: SPEAKER_HUMAN_DECISION_SHEET_NAME_ };
  sheet = ss.insertSheet(SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  sheet.getRange(1, 1, 1, 4).setValues([[
    "SpotifyプレイリストID", "episode ID または Spotify URL", "判定", "承認（削除時は削除承認）"
  ]]);
  return { created: true, name: SPEAKER_HUMAN_DECISION_SHEET_NAME_ };
}
function readApprovedSpeakerHumanDecisions_(playlistId) {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
  const decisions = {};
  rows.forEach(function(row, index) {
    const id = String(row[0] || "").trim();
    const approval = String(row[3] || "").trim();
    if (id !== playlistId || ["承認", "削除承認"].indexOf(approval) < 0) return;
    const episodeId = extractSpeakerHumanEpisodeId_(row[1]);
    const decision = String(row[2] || "").trim();
    if (approval === "削除承認" && decision !== "除外") {
      throw new Error("Spotify削除の承認行は「除外」にしてください: " + (index + 2));
    }
    if (!/^[A-Za-z0-9]{22}$/.test(episodeId) ||
        ["除外", "訂正済み", "反映済み"].indexOf(decision) < 0) {
      throw new Error("AUTO出演者判定の承認済み行が不正です: " + (index + 2));
    }
    if (decisions[episodeId] && decisions[episodeId] !== decision) {
      throw new Error("AUTO出演者判定で同じepisode IDの判定が衝突しています: " + episodeId);
    }
    decisions[episodeId] = decision;
  });
  return decisions;
}

// 「AUTO出演者判定」の削除承認を1行だけ処理する。除外保存の成功後にだけSpotifyへDELETEする。
function removeOneApprovedSpeakerEpisodeFromSpotifyV1() {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (!sheet) throw new Error("AUTO出演者判定シートがありません");
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues() : [];
  const pending = rows.map(function(row, index) {
    return { row: row, rowNumber: index + 2 };
  }).filter(function(entry) { return String(entry.row[3] || "").trim() === "削除承認"; });
  if (pending.length !== 1) throw new Error("削除承認行をちょうど1行にしてください: " + pending.length);

  const entry = pending[0];
  const playlistId = String(entry.row[0] || "").trim();
  const episodeId = extractSpeakerHumanEpisodeId_(entry.row[1]);
  if (!/^[A-Za-z0-9]{22}$/.test(playlistId) || !episodeId ||
      String(entry.row[2] || "").trim() !== "除外") {
    throw new Error("削除承認行のplaylist ID・episode URL・判定を確認してください: " + entry.rowNumber);
  }
  if (readApprovedSpeakerHumanDecisions_(playlistId)[episodeId] !== "除外") {
    throw new Error("承認済みの人間除外を確認できません: " + episodeId);
  }
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "") === playlistId &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  });
  if (rules.length !== 1) throw new Error("対象speakerルールが一意に見つかりません");
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザートークンがありません");
  const uri = "spotify:episode:" + episodeId;
  const items = getAllSpotifyPlaylistItems_(playlistId, token);
  const present = items.some(function(row) {
    return String(row && row.item && row.item.id || "") === episodeId &&
      String(row.item.uri || "") === uri;
  });

  // スクリプトロックを使う既存関数で、Spotify操作に先立って除外を確定する。
  recordSpeakerAutoUpdateHumanDecisionV1(playlistId, episodeId, "除外");
  if (present) {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) + "/items", {
        method: "delete", muteHttpExceptions: true, contentType: "application/json",
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
        payload: JSON.stringify({ items: [{ uri: uri }] })
      }
    );
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error("除外は保存済みですがSpotify削除に失敗しました: HTTP " + status);
    }
    if (getAllSpotifyPlaylistItems_(playlistId, token).some(function(row) {
      return String(row && row.item && row.item.id || "") === episodeId;
    })) {
      throw new Error("除外は保存済みですがSpotifyにepisodeが残っています");
    }
  }
  // 次回の実行で同じ行を再処理しない。承認履歴は残してAUTO巡回でも読み続ける。
  sheet.getRange(entry.rowNumber, 4).setValue("承認");
  return { playlistId: playlistId, episodeId: episodeId, decision: "除外", removed: present };
}
function removeApprovedSpeakerEpisodesBatchV1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (!sheet) throw new Error("AUTO出演者判定シートがありません");

  const MAX_PER_RUN = 10; // 一度に最大10件まで
  const results = [];

  for (let i = 0; i < MAX_PER_RUN; i++) {
    const lastRow = sheet.getLastRow();
    const rows = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues()
      : [];

    const pending = rows
      .map(function(row, index) {
        return { row: row, rowNumber: index + 2 };
      })
      .filter(function(entry) {
        return String(entry.row[3] || "").trim() === "削除承認";
      });

    // 全件終了
    if (pending.length === 0) {
      Logger.log(JSON.stringify({
        ok: true,
        completed: true,
        processed: results.length,
        results: results
      }, null, 2));
      return {
        ok: true,
        completed: true,
        processed: results.length,
        results: results
      };
    }

    // 既存の単発関数は「削除承認がちょうど1件」を要求するため、
    // 先頭1件以外はいったん待避する。
    const first = pending[0];
    const waiting = pending.slice(1);

    waiting.forEach(function(entry) {
      sheet.getRange(entry.rowNumber, 4).setValue("削除待ち");
    });

    SpreadsheetApp.flush();

    try {
      // 実績のある既存処理をそのまま使用
      const result = removeOneApprovedSpeakerEpisodeFromSpotifyV1();
      results.push(result);

    } catch (err) {
      // 未処理行を元の「削除承認」に戻す
      waiting.forEach(function(entry) {
        sheet.getRange(entry.rowNumber, 4).setValue("削除承認");
      });
      SpreadsheetApp.flush();

      Logger.log(JSON.stringify({
        ok: false,
        processed: results.length,
        failedRow: first.rowNumber,
        error: String(err && err.message || err),
        results: results
      }, null, 2));

      throw err;
    }

    // 待避した行を次の処理用に戻す
    waiting.forEach(function(entry) {
      sheet.getRange(entry.rowNumber, 4).setValue("削除承認");
    });

    SpreadsheetApp.flush();
  }

  Logger.log(JSON.stringify({
    ok: true,
    completed: false,
    processed: results.length,
    message: "1回の上限 " + MAX_PER_RUN + " 件に達しました",
    results: results
  }, null, 2));

  return {
    ok: true,
    completed: false,
    processed: results.length,
    results: results
  };
}
