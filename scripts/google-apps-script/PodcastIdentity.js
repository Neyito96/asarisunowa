// ポ薦め: 配信プラットフォームをまたいだ番組同定・重複判定の共通処理

function normalizePodcastIdentityText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s　・･\-—–_()（）「」『』【】!！?？:：]/g, "");
}

function podcastIdentityFromResolved_(resolved) {
  const source = resolved || {};
  return {
    title: normalizePodcastIdentityText_(source.title),
    maker: normalizePodcastIdentityText_(
      source.maker || source.author || source.publisher || ""
    )
  };
}

function podcastIdentityMatch_(left, right) {
  const a = podcastIdentityFromResolved_(left);
  const b = podcastIdentityFromResolved_(right);

  if (!a.title || !b.title || a.title !== b.title) {
    return { duplicate: false, candidate: false, reason: "" };
  }

  // タイトルと配信者の両方が取れて一致したときだけ、同一番組を確定する。
  if (a.maker && b.maker) {
    return {
      duplicate: a.maker === b.maker,
      candidate: a.maker !== b.maker,
      reason: a.maker === b.maker ? "title_maker" : "title_only"
    };
  }

  // 配信者情報が片方でも欠ける場合、タイトル一致だけでは確定しない。
  return { duplicate: false, candidate: true, reason: "title_only" };
}

function isSamePodcastIdentity_(left, right) {
  return podcastIdentityMatch_(left, right).duplicate;
}

function findPodcastDuplicateByIdentity_(items, resolved) {
  const list = Array.isArray(items) ? items : [];
  for (var i = 0; i < list.length; i += 1) {
    if (isSamePodcastIdentity_(list[i], resolved)) return list[i];
  }
  return null;
}

function findListenerPodcastDuplicateByIdentityInSheet_(sheet, resolved) {
  if (!sheet || !resolved || !resolved.title) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  const items = values.map(function(row, index) {
    return {
      id: String(index + 1).padStart(2, "0"),
      url: String(row[0] || "").trim(),
      title: String(row[1] || "").trim(),
      maker: String(row[2] || "").trim()
    };
  });

  return findPodcastDuplicateByIdentity_(items, resolved);
}
