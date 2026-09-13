// 投稿入力の読み取り・正規化

function parsePostInput_(e) {
  const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

  return {
    data: data,
    url: String(data.url || "").trim(),
    title: String(data.title || "").trim(),
    maker: String(data.maker || "").trim(),
    comment: String(data.comment || "").trim(),
    introducedDate: String(data.introducedDate || "").trim(),
    artwork: String(data.artwork || "").trim(),
    kind: String(data.kind || "playlist").trim(),
    securityAnswer: String(data.securityAnswer || "").trim(),
    website: String(data.website || "").trim()
  };
}
