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
    inviteUrl: String(data.inviteUrl || "").trim(),
    comment: String(data.comment || "").trim(),
    introducedDate: String(data.introducedDate || "").trim(),
    artwork: String(data.artwork || "").trim(),
    kind: kind,
    securityAnswer: String(data.securityAnswer || "").trim(),
    website: String(data.website || "").trim()
  };
}
