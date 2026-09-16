// 人物別プレイリスト判定の共通ガードレール。
// 誰をどの文脈で出演確定とするかは、各人物の専用 classifier に残す。

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
