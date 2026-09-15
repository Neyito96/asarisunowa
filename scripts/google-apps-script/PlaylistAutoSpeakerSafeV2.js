// 出演者プレイリスト向け共通安全判定 V2
// 太田匡彦で得た知見を人物名に依存しない形へ一般化する。
// 本ファイルは分類とdry-run計画のみ。Spotifyへの書き込みは行わない。

function classifySpeakerSafeV2_(episode, rule) {
  const speaker = getSpeakerSafeV2Config_(rule);
  if (!episode) return speakerSafeV2Classification_("unresolved", ["episode_missing"], "", "", "");
  if (!speaker.aliases.length) return speakerSafeV2Classification_("unresolved", ["speaker_alias_missing"], "", "", "");

  const fields = [
    { name: "name", text: normalizeSpeakerSafeV2Text_(episode.name, false) },
    { name: "description", text: normalizeSpeakerSafeV2Text_(episode.description, false) },
    { name: "html_description", text: normalizeSpeakerSafeV2Text_(episode.html_description, true) }
  ];
  if (!fields.some(function(field) { return field.text; })) {
    return speakerSafeV2Classification_("unresolved", ["episode_metadata_missing"], "", "", "");
  }

  const matches = [];
  fields.forEach(function(field) {
    speaker.aliases.forEach(function(alias) {
      if (alias && field.text.indexOf(alias) !== -1) matches.push({ field: field.name, alias: alias, text: field.text });
    });
  });
  if (!matches.length) return speakerSafeV2Classification_("false_positive", ["speaker_name_not_found"], "", "", "");

  const usable = matches.filter(function(match) {
    return !isSpeakerSafeV2KnownAnnouncementOnly_(match.text, speaker);
  });
  if (!usable.length) {
    return speakerSafeV2Classification_("false_positive", ["known_announcement_only"], matches[0].field, "announcement", speakerSafeV2Excerpt_(matches[0].text, matches[0].alias));
  }

  const credit = usable.find(function(match) { return hasSpeakerSafeV2CreditContext_(match.text, match.alias); });
  if (credit) return speakerSafeV2Classification_("confirmed", ["speaker_credit_context"], credit.field, "credit", speakerSafeV2Excerpt_(credit.text, credit.alias));

  const appearance = usable.find(function(match) { return hasSpeakerSafeV2AppearanceContext_(match.text, match.alias); });
  if (appearance) return speakerSafeV2Classification_("confirmed", ["speaker_appearance_context"], appearance.field, "narrative", speakerSafeV2Excerpt_(appearance.text, appearance.alias));

  return speakerSafeV2Classification_("review", ["speaker_name_found_but_context_unconfirmed"], usable[0].field, "", speakerSafeV2Excerpt_(usable[0].text, usable[0].alias));
}

function getSpeakerSafeV2Config_(rule) {
  const source = rule || {};
  const aliases = [];
  (Array.isArray(source.keywords) ? source.keywords : []).concat(Array.isArray(source.speakerAliases) ? source.speakerAliases : []).forEach(function(value) {
    const text = normalizeSpeakerSafeV2Text_(value, false);
    if (text && aliases.indexOf(text) === -1) aliases.push(text);
  });
  return {
    aliases: aliases,
    announcementPatterns: Array.isArray(source.safeV2AnnouncementPatterns) ? source.safeV2AnnouncementPatterns : []
  };
}

function hasSpeakerSafeV2CreditContext_(text, alias) {
  const escaped = escapeSpeakerSafeV2RegExp_(alias);
  return [
    new RegExp("(?:出演|ゲスト|聞き手|取材|解説|記者|編集者|MC|パーソナリティ)[：:\\s、,・]*" + escaped),
    new RegExp(escaped + "(?:記者|編集者|デスク|さん|氏)[^。\\n]{0,30}(?:出演|解説|聞きました|聞き手|取材)")
  ].some(function(pattern) { return pattern.test(text); });
}

function hasSpeakerSafeV2AppearanceContext_(text, alias) {
  const escaped = escapeSpeakerSafeV2RegExp_(alias);
  return [
    new RegExp(escaped + "(?:記者|編集者|デスク|さん|氏)[^。\\n]{0,45}(?:に聞きました|に聞きます|が解説|が語ります|と話します|を迎え|が出演)"),
    new RegExp("(?:記者|編集者|デスク)の?" + escaped + "[^。\\n]{0,45}(?:に聞きました|に聞きます|が解説|が語ります|と話します|を迎え|が出演)")
  ].some(function(pattern) { return pattern.test(text); });
}

function isSpeakerSafeV2KnownAnnouncementOnly_(text, speaker) {
  return (speaker.announcementPatterns || []).some(function(pattern) {
    if (pattern instanceof RegExp) return pattern.test(text);
    const value = normalizeSpeakerSafeV2Text_(pattern, false);
    return value && text.indexOf(value) !== -1;
  });
}

function normalizeSpeakerSafeV2Text_(value, stripHtml) {
  let text = String(value || "");
  if (stripHtml) text = text.replace(/<[^>]*>/g, " ");
  return text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\u3000/g, " ").replace(/[ \t]+/g, " ").replace(/\r\n?/g, "\n").trim();
}

function speakerSafeV2Excerpt_(text, alias) {
  const source = String(text || "");
  const index = source.indexOf(alias);
  if (index < 0) return source.substring(0, 160);
  return source.substring(Math.max(0, index - 70), Math.min(source.length, index + alias.length + 90));
}

function escapeSpeakerSafeV2RegExp_(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function speakerSafeV2Classification_(classification, reasons, matchedField, matchedSection, excerpt) {
  return { classification: classification, reasons: Array.isArray(reasons) ? reasons : [], matchedField: matchedField || "", matchedSection: matchedSection || "", excerpt: excerpt || "" };
}

function buildSpeakerSafeV2DryRunPlan_(ruleKey) {
  const rule = AUTO_PLAYLIST_RULES.find(function(item) { return String(item && item.key ? item.key : "") === String(ruleKey || ""); });
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  return {
    dryRun: true,
    productionWriteAllowed: false,
    ruleKey: rule.key,
    playlistId: rule.playlistId,
    matchStrategy: "speaker-safe-v2",
    aliases: getSpeakerSafeV2Config_(rule).aliases,
    classifications: ["confirmed", "false_positive", "review", "unresolved"]
  };
}
