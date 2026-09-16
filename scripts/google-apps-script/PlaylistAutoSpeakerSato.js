// 佐藤陽プレイリスト用の安全判定。
// 氏名が概要欄にあるだけでは採用せず、出演・発話が確認できる回だけ confirmed にする。

function classifySatoYoAutoPlaylistEpisode_(episode) {
  if (!episode) return satoYoClassification_("unresolved", "episode_missing", "");

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
  const genericHeadingPattern = /^(?:【[^】]{1,40}】|\[[^\]]{1,40}\]|（[^）]{1,40}）|\([^)]{1,40}\)|[^。！？\n]{1,24}[：:])\s*/;
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
    excerpt: String(excerpt || "")
  };
}
