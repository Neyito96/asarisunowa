// 出演者プレイリスト向け共通安全判定 V2
// 太田匡彦V2の「概要欄重視・告知行除外・クレジット/出演文脈判定」を一般化する。
// 分類のみを担当し、Spotifyへの書き込みは行わない。

function classifySpeakerSafeV2_(episode, rule) {
  const speaker = getSpeakerSafeV2Config_(rule);
  if (!episode) return speakerSafeV2Classification_("unresolved", ["episode_missing"], "", "", "");
  if (!speaker.aliases.length) return speakerSafeV2Classification_("unresolved", ["speaker_alias_missing"], "", "", "");

  const title = normalizeSpeakerSafeV2Text_(episode.name, false);
  const description = normalizeSpeakerSafeV2Text_(episode.description, false);
  const htmlDescription = normalizeSpeakerSafeV2Text_(episode.html_description, true);
  if (!title && !description && !htmlDescription) return speakerSafeV2Classification_("unresolved", ["episode_metadata_missing"], "", "", "");
  // 太田V2と同様、出演者の確定には概要欄情報を必須とする。
  if (!description && !htmlDescription) return speakerSafeV2Classification_("unresolved", ["episode_description_missing"], "", "", "");

  const fields = [
    { name: "description", text: description },
    { name: "html_description", text: htmlDescription }
  ];
  let confirmed = null;
  let narrative = null;
  let other = null;
  let promo = null;
  let keptMentions = 0;
  let promoMentions = 0;

  fields.forEach(function(field) {
    if (!field.text) return;
    const stripped = stripSpeakerSafeV2KnownAnnouncementLines_(field.text, speaker);
    promoMentions += stripped.removedMentionCount;
    if (!promo && stripped.firstRemovedExcerpt) promo = { field: field.name, excerpt: stripped.firstRemovedExcerpt };

    speaker.aliases.forEach(function(alias) {
      const mentions = findSpeakerSafeV2Mentions_(stripped.text, alias);
      keptMentions += mentions.length;
      mentions.forEach(function(mention) {
        if (!confirmed && hasSpeakerSafeV2CreditContext_(mention.excerpt, alias)) confirmed = { field: field.name, section: "credit", excerpt: mention.excerpt };
        else if (!narrative && hasSpeakerSafeV2AppearanceContext_(mention.excerpt, alias)) narrative = { field: field.name, section: "narrative", excerpt: mention.excerpt };
        else if (!other) other = { field: field.name, section: "description", excerpt: mention.excerpt };
      });
    });
  });

  if (confirmed) return speakerSafeV2Classification_("confirmed", ["name_found_in_credit_context_after_known_announcement_removed"], confirmed.field, confirmed.section, confirmed.excerpt);
  if (narrative) return speakerSafeV2Classification_("confirmed", ["name_found_in_narrative_appearance_context"], narrative.field, narrative.section, narrative.excerpt);
  if (promoMentions > 0 && keptMentions === 0 && promo) return speakerSafeV2Classification_("false_positive", ["all_name_mentions_are_in_known_announcement"], promo.field, "known_event_announcement", promo.excerpt);
  if (other) return speakerSafeV2Classification_("review", ["name_found_outside_confirmed_context", "appearance_not_confirmed"], other.field, other.section, other.excerpt);

  const titleAlias = speaker.aliases.find(function(alias) { return title.indexOf(alias) !== -1; });
  if (titleAlias) return speakerSafeV2Classification_("review", ["name_found_in_episode_title", "appearance_not_confirmed_in_description"], "name", "episode_title", speakerSafeV2Excerpt_(title, titleAlias));
  if (promoMentions > 0 && promo) return speakerSafeV2Classification_("false_positive", ["known_announcement_only_after_cleanup"], promo.field, "known_event_announcement", promo.excerpt);

  return speakerSafeV2Classification_("false_positive", ["speaker_name_not_found"], "", "", "");
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
    announcementPatterns: Array.isArray(source.safeV2AnnouncementPatterns) ? source.safeV2AnnouncementPatterns : [],
    useAsahiOneHundredMillionDownloadAnnouncement: source.useAsahiOneHundredMillionDownloadAnnouncement === true
  };
}

function stripSpeakerSafeV2KnownAnnouncementLines_(text, speaker) {
  const kept = [];
  let removedMentionCount = 0;
  let firstRemovedExcerpt = "";
  String(text || "").split(/\n/).forEach(function(rawLine) {
    const line = String(rawLine || "");
    const aliasesInLine = speaker.aliases.filter(function(alias) { return line.indexOf(alias) !== -1; });
    if (aliasesInLine.length && isSpeakerSafeV2KnownAnnouncementLine_(line, speaker)) {
      removedMentionCount += aliasesInLine.length;
      if (!firstRemovedExcerpt) firstRemovedExcerpt = speakerSafeV2Excerpt_(line, aliasesInLine[0]);
      return;
    }
    kept.push(line);
  });
  return { text: kept.join("\n"), removedMentionCount: removedMentionCount, firstRemovedExcerpt: firstRemovedExcerpt };
}

function isSpeakerSafeV2KnownAnnouncementLine_(line, speaker) {
  const text = normalizeSpeakerSafeV2Text_(line, false);
  const configured = (speaker.announcementPatterns || []).some(function(pattern) {
    if (pattern instanceof RegExp) return pattern.test(text);
    const value = normalizeSpeakerSafeV2Text_(pattern, false);
    return value && text.indexOf(value) !== -1;
  });
  if (configured) return true;
  if (!speaker.useAsahiOneHundredMillionDownloadAnnouncement) return false;
  return (text.indexOf("1億DL") !== -1 || text.indexOf("1億ダウンロード") !== -1) &&
    (text.indexOf("5/31") !== -1 || text.indexOf("5月31日") !== -1 || text.indexOf("イベント") !== -1 || text.indexOf("朝ポキメンバー") !== -1);
}

function findSpeakerSafeV2Mentions_(text, alias) {
  const source = String(text || "");
  const results = [];
  let start = 0;
  while (alias && start < source.length) {
    const index = source.indexOf(alias, start);
    if (index < 0) break;
    results.push({ index: index, excerpt: source.substring(Math.max(0, index - 90), Math.min(source.length, index + alias.length + 110)) });
    start = index + alias.length;
  }
  return results;
}

function hasSpeakerSafeV2CreditContext_(text, alias) {
  const escaped = escapeSpeakerSafeV2RegExp_(alias);
  return [
    new RegExp("(?:出演|出演者|ゲスト|聞き手|取材|解説|記者|編集者|MC|パーソナリティ|スタッフ)[：:\\s、,・]*[^。\\n]{0,35}" + escaped),
    new RegExp(escaped + "(?:記者|編集者|デスク|さん|氏)?[^。\\n]{0,35}(?:出演|出演者|ゲスト|解説|聞き手|取材|スタッフ)")
  ].some(function(pattern) { return pattern.test(text); });
}

function hasSpeakerSafeV2AppearanceContext_(text, alias) {
  const escaped = escapeSpeakerSafeV2RegExp_(alias);
  return [
    new RegExp(escaped + "(?:記者|編集者|デスク|さん|氏)[^。\\n]{0,55}(?:に聞きました|に聞きます|が解説|が語ります|と話します|を迎え|が出演)"),
    new RegExp("(?:記者|編集者|デスク)の?" + escaped + "[^。\\n]{0,55}(?:に聞きました|に聞きます|が解説|が語ります|と話します|を迎え|が出演)")
  ].some(function(pattern) { return pattern.test(text); });
}

function normalizeSpeakerSafeV2Text_(value, stripHtml) {
  let text = String(value || "");
  if (stripHtml) text = text.replace(/<[^>]*>/g, " ");
  return text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\u3000/g, " ").replace(/[ \t]+/g, " ").replace(/\r\n?/g, "\n").trim();
}

function speakerSafeV2Excerpt_(text, alias) {
  const source = String(text || "");
  const index = source.indexOf(alias);
  if (index < 0) return source.substring(0, 180);
  return source.substring(Math.max(0, index - 90), Math.min(source.length, index + alias.length + 110));
}

function escapeSpeakerSafeV2RegExp_(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function speakerSafeV2Classification_(classification, reasons, matchedField, matchedSection, excerpt) {
  return { classification: classification, reasons: Array.isArray(reasons) ? reasons : [], matchedField: matchedField || "", matchedSection: matchedSection || "", excerpt: excerpt || "" };
}

function buildSpeakerSafeV2DryRunPlan_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  return { dryRun: true, productionWriteAllowed: false, ruleKey: rule.key, playlistId: rule.playlistId, matchStrategy: "speaker-safe-v2", aliases: getSpeakerSafeV2Config_(rule).aliases, classifications: ["confirmed", "false_positive", "review", "unresolved"] };
}
