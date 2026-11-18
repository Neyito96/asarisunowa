// 投稿入力の読み取り・正規化

function parsePostInput_(e) {
  const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  const kind = String(data.kind || "playlist").trim();
  const rawUrl = String(data.url || "").trim();
  const url =
    kind === "podcast" || kind === "listenerPodcast"
      ? normalizePodcastInputUrl(rawUrl)
      : rawUrl;

  return {
    data: data,
    url: url,
    title: String(data.title || "").trim(),
    maker: String(data.maker || "").trim(),
    host: String(data.host || "").trim(),
    rss: String(data.rss || "").trim(),
    inviteUrl: String(data.inviteUrl || "").trim(),
    comment: String(data.comment || "").trim(),
    introducedDate: String(data.introducedDate || "").trim(),
    artwork: String(data.artwork || "").trim(),
    kind: kind,
    securityAnswer: String(data.securityAnswer || "").trim(),
    website: String(data.website || "").trim(),
    // 掲載先（Spotifyリストの棚）: 連載・シリーズ / 朝リスト。未指定は空（従来どおり）
    shelf: normalizePlaylistShelf_(data.shelf)
  };
}

// 掲載先の値を「連載」「朝リスト」「」のどれかに揃える（作業台 I列・サイト公開用 G列に入る文字）
function normalizePlaylistShelf_(value) {
  const v = String(value || "").trim();
  if (v === "series" || v === "連載" || v === "連載・シリーズ") return "連載";
  if (v === "list" || v === "朝リスト") return "朝リスト";
  return "";
}

// 公開API用: 「連載」→ series、「朝リスト」→ list、それ以外は空
function playlistShelfKey_(value) {
  const v = normalizePlaylistShelf_(value);
  return v === "連載" ? "series" : v === "朝リスト" ? "list" : "";
}
