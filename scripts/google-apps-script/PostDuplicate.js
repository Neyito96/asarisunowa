// 投稿重複判定

function findPostDuplicate_(existingRows, kind, url, title) {
  const normalized = normalizeUrl(url);
  const normalizedTitle = normalizeTitle(title);

  const duplicateByUrl = existingRows.some(function(row) {
    return normalizeUrl(row[0]) === normalized;
  });

  const duplicateByTitle =
    kind === "podcast" || kind === "listenerPodcast"
      ? existingRows.some(function(row) {
          return normalizeTitle(row[1]) === normalizedTitle;
        })
      : false;

  return {
    duplicateByUrl: duplicateByUrl,
    duplicateByTitle: duplicateByTitle,
    duplicateReason: duplicateByTitle ? "title" : duplicateByUrl ? "url" : ""
  };
}
