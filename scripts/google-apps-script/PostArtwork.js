// 通常投稿のアートワーク補完

function resolvePostArtwork_(artwork, kind, title) {
  if (artwork) return artwork;

  if (kind === "podcast" || kind === "listenerPodcast") {
    return findPodcastArtworkByTitle(title);
  }

  return artwork;
}
