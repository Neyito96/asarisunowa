function inspectKinodoLatestV1() {
  const token = getSpotifyUserAccessToken();
  const rule = getAutoPlaylistRuleByKey_("kino-douga");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);

  Logger.log("取得件数: " + episodes.length);

  episodes.slice(0, 10).forEach(function(ep, i) {
    Logger.log(
      (i + 1) +
      " | " +
      String(ep.id || "") +
      " | " +
      String(ep.release_date || "") +
      " | " +
      String(ep.name || "")
    );
  });

  const target = episodes.find(function(ep) {
    return String(ep.id || "") === "6sKHNLoHzmR549kjdhzHKL";
  });

  Logger.log("TARGET FOUND: " + Boolean(target));

  if (target) {
    Logger.log("TARGET TITLE: " + target.name);
    Logger.log(
      "TARGET MATCH: " +
      matchesAutoPlaylistRule_(target, rule)
    );
  }
}
function inspectKinodoPlaylistTitlesV1() {
  const token = getSpotifyUserAccessToken();
  const rule = getAutoPlaylistRuleByKey_("kino-douga");
  const items = getAllSpotifyPlaylistItems_(rule.playlistId, token);

  Logger.log("PLAYLIST ITEM COUNT: " + items.length);

  items.forEach(function(row, i) {
    const item = row && row.item;
    Logger.log(
      (i + 1) +
      " | " +
      String(item && item.id || "") +
      " | " +
      String(item && item.name || "")
    );
  });
}

