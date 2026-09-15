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

  if (a.maker && b.maker) {
    return {
      duplicate: a.maker === b.maker,
      candidate: a.maker !== b.maker,
      reason: a.maker === b.maker ? "title_maker" : "title_only"
    };
  }

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

function canonicalPodcastIdentityUrl_(value) {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    parsed.search = "";
    parsed.hash = "";
    let normalized = parsed.toString();
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized.toLowerCase();
  } catch (_) {
    return raw.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function listenerPodcastRowFromValues_(row, index) {
  return {
    id: String(index + 1).padStart(2, "0"),
    url: String(row[0] || "").trim(),
    title: String(row[1] || "").trim(),
    maker: String(row[2] || "").trim(),
    urls: [row[0], row[5], row[6], row[7], row[8], row[9], row[10], row[11]]
      .map(canonicalPodcastIdentityUrl_)
      .filter(Boolean)
  };
}

function findListenerPodcastDuplicateByAnyUrlInSheet_(sheet, urls) {
  if (!sheet) return null;

  const wanted = (Array.isArray(urls) ? urls : [urls])
    .map(canonicalPodcastIdentityUrl_)
    .filter(Boolean);
  if (!wanted.length) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues();
  for (var i = 0; i < values.length; i += 1) {
    const item = listenerPodcastRowFromValues_(values[i], i);
    if (item.urls.some(function(url) { return wanted.indexOf(url) >= 0; })) {
      return item;
    }
  }
  return null;
}

function podcastPlatformUrlsFromResolved_(resolved) {
  const source = resolved || {};
  return [
    source.url,
    source.spotify,
    source.apple,
    source.listen,
    source.standfm,
    source.amazon,
    source.youtube,
    source.website
  ].filter(Boolean);
}

function findListenerPodcastDuplicateByIdentityInSheet_(sheet, resolved) {
  if (!sheet || !resolved || !resolved.title) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues();
  const items = values.map(listenerPodcastRowFromValues_);

  return findPodcastDuplicateByIdentity_(items, resolved);
}
