// ポ薦め: 配信プラットフォームをまたいだ番組同定・重複判定の共通処理
// まずは純粋関数として追加し、既存の投稿経路にはまだ接続しない。

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

function isSamePodcastIdentity_(left, right) {
  const a = podcastIdentityFromResolved_(left);
  const b = podcastIdentityFromResolved_(right);

  if (!a.title || !b.title || a.title !== b.title) return false;

  // 配信者情報が両方取れている場合は一致も要求する。
  // 片方しか取れない場合はタイトル一致を候補として扱えるようにする。
  if (a.maker && b.maker) return a.maker === b.maker;
  return true;
}

function findPodcastDuplicateByIdentity_(items, resolved) {
  const list = Array.isArray(items) ? items : [];
  for (var i = 0; i < list.length; i += 1) {
    if (isSamePodcastIdentity_(list[i], resolved)) return list[i];
  }
  return null;
}
