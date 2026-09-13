// Podcast URL解析・番組メタデータ取得の共通補助

function normalizePodcastInputUrl(value) {
  let clean =
    String(value || "").trim();

  // URL全体がエンコードされて貼られた場合に備えて、最大2回だけデコード。
  for (let i = 0; i < 2; i++) {
    try {
      const decoded =
        decodeURIComponent(clean);

      if (decoded === clean) {
        break;
      }

      clean = decoded;

    } catch (_) {
      break;
    }
  }

  // テキストの中にURLが含まれていた場合はURL部分だけ抜き出す。
  const m =
    clean.match(/https?:\/\/[^\s]+/i);

  if (m && m[0]) {
    clean = m[0];
  }

  return clean.trim();
}

function looksLikeEpisodeTitle(title) {
  const value =
    String(title || "").trim();

  if (!value) {
    return false;
  }

  return (
    /^(ep(?:isode)?[\s._-]*\d+)/i.test(value) ||
    /^#\s*\d+/.test(value) ||
    /^第\s*\d+\s*(回|話|章)/.test(value) ||
    /\bepisode\b/i.test(value)
  );
}

function firstMeta(html, patterns) {
  for (
    let i = 0;
    i < patterns.length;
    i++
  ) {
    const m =
      html.match(
        patterns[i]
      );

    if (
      m &&
      m[1]
    ) {
      return String(
        m[1]
      ).trim();
    }
  }

  return "";
}

function cleanupTitle(title) {
  return String(
    title || ""
  )
    .replace(
      /\s*[|｜]\s*Podcast on Spotify.*$/i,
      ""
    )
    .replace(
      /\s*[|｜]\s*(Spotify|Apple Podcasts?|LISTEN|stand\.fm|YouTube|Amazon Music).*$/i,
      ""
    )
    .replace(
      /\s+-\s+(Spotify|Apple Podcasts?|LISTEN|stand\.fm).*$/i,
      ""
    )
    .trim();
}

function cleanupMaker(maker) {
  return String(maker || "")
    .replace(/^Spotify$/i, "")
    .replace(/^Apple Podcasts?$/i, "")
    .replace(/^LISTEN$/i, "")
    .replace(/^stand\.fm$/i, "")
    .replace(/^YouTube$/i, "")
    .replace(/^Amazon Music$/i, "")
    .trim();
}

function decodeHtml(value) {
  return String(
    value || ""
  )
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&#39;/g,
      "'"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    )
    .replace(
  /\\u([0-9a-fA-F]{4})/g,
  function(_, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  }
);
}

function detectProvider(url) {
  if (
    /spotify\.com/i.test(url)
  ) {
    return "Spotify";
  }

  if (
    /podcasts\.apple\.com/i.test(url)
  ) {
    return "Apple Podcasts";
  }

  if (
    /listen\.style/i.test(url)
  ) {
    return "LISTEN";
  }

  if (
    /stand\.fm/i.test(url)
  ) {
    return "stand.fm";
  }

  if (
    /amazon/i.test(url)
  ) {
    return "Amazon Music";
  }

  if (
    /youtube\.com|youtu\.be/i.test(url)
  ) {
    return "YouTube";
  }

  if (
    /pca\.st|pocketcasts\.com/i.test(url)
  ) {
    return "Pocket Casts";
  }

  return "";
}
