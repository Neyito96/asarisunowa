// 斎藤健一郎専用。既存runtimeの再登録・Properties変更なしで同一playlistだけに適用。
const SAITO_KENICHIRO_PLAYLIST_ID_ = "7FBbaBPpGDSJUIXN4L2iYi";
const SAITO_KENICHIRO_MATCH_STRATEGY_ = "saito-kenichiro-safe-confirmed";

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
function isSaitoKenichiroReviewCandidate_(episode, rule) {
  if (!isSaitoKenichiroAutoUpdateRule_(rule) || isSpeakerAutoUpdateHumanBlocked_(rule, episode && episode.id)) return false;
  const status = classifySaitoKenichiroAutoEpisode_(episode).classification;
  return status === "review" || status === "unresolved";
}

// Read the human ledger again immediately before the Spotify writer; no property writes.
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
