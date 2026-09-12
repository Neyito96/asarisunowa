const AUTO_PLAYLIST_RULES = [
  {
    name: "一緒に新聞をめくろう！",
    showId: "392h0MYfvMTndEVzf2cOvC",
    playlistId: "4tY0lHoV8IemMBp4iTnKnl",
    keyword: "めくろう"
  },
  {
    name: "木下君、あの動画みた？ #きのどう",
    showId: "0yhef9ORZkUZs9ZeotdCSY",
    playlistId: "6nDhZQG75F1wU62sdcYJMq",
    keyword: "動画みた？"
  },
  {
    name: "豊秀一",
    showIds: [
      "7euH6hzudIdp61JRSi9E8w",
      "0341I5UOUrJgm7KEvNGInZ",
      "0yhef9ORZkUZs9ZeotdCSY",
      "392h0MYfvMTndEVzf2cOvC",
      "5Dt1uyQaJpM6hPV8aEMP3R",
      "1KExdSsjQnatS4TdseGoC0",
      "2uG9W6CnsaNi87AfSuGe8r"
    ],
    playlistId: "4Ri6rxTGFimTm0KkZtKfBZ",
    keywords: ["豊秀一", "豊 秀一"],
    fields: ["name", "description", "html_description"],
    fetchAllPages: true,
    continueOnShowFetchError: true,
    addIndividually: true,
    updateLatestDateOnAdd: true
  }
];

function syncAllAutoPlaylists() {
  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  AUTO_PLAYLIST_RULES.forEach(function(rule) {
    syncOneAutoPlaylist_(rule, token);
  });
}

function syncAutoPlaylistByPlaylistId_(playlistId) {
  const wantedId = String(playlistId || "").trim();
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === wantedId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + wantedId);
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  syncOneAutoPlaylist_(rule, token);
}

function getAutoPlaylistShowIds_(rule) {
  if (Array.isArray(rule.showIds) && rule.showIds.length) {
    return rule.showIds.map(function(showId) {
      return String(showId || "").trim();
    }).filter(Boolean);
  }

  const showId = String(rule.showId || "").trim();
  return showId ? [showId] : [];
}

function getAutoPlaylistEpisodeText_(episode, rule) {
  const fields =
    Array.isArray(rule.fields) && rule.fields.length
      ? rule.fields
      : ["name"];

  return fields.map(function(field) {
    return String(
      episode && episode[field] != null
        ? episode[field]
        : ""
    );
  }).join("\n");
}

function matchesAutoPlaylistRule_(episode, rule) {
  const text = getAutoPlaylistEpisodeText_(episode, rule);

  const includeKeywords =
    Array.isArray(rule.keywords) && rule.keywords.length
      ? rule.keywords
      : rule.keyword
      ? [rule.keyword]
      : [];

  const excludeKeywords =
    Array.isArray(rule.excludeKeywords)
      ? rule.excludeKeywords
      : [];

  const excluded = excludeKeywords.some(function(keyword) {
    return text.indexOf(String(keyword)) >= 0;
  });

  if (excluded) {
    return false;
  }

  if (!includeKeywords.length) {
    return true;
  }

  const mode = String(rule.matchMode || "any").toLowerCase();

  if (mode === "all") {
    return includeKeywords.every(function(keyword) {
      return text.indexOf(String(keyword)) >= 0;
    });
  }

  return includeKeywords.some(function(keyword) {
    return text.indexOf(String(keyword)) >= 0;
  });
}

function fetchAutoPlaylistEpisodes_(rule, token) {
  const showIds = getAutoPlaylistShowIds_(rule);

  if (!showIds.length) {
    throw new Error(rule.name + " のShow IDが設定されていません");
  }

  const episodesByUri = {};
  const fetchAllPages = rule.fetchAllPages === true;
  const continueOnShowFetchError =
    rule.continueOnShowFetchError === true;

  showIds.forEach(function(showId) {
    let nextUrl =
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(showId) +
      "/episodes?market=JP&limit=50";

    while (nextUrl) {
      const showRes = UrlFetchApp.fetch(nextUrl, {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      });

      if (showRes.getResponseCode() !== 200) {
        Logger.log(
          "Show取得失敗: " +
          showId +
          " | status=" +
          showRes.getResponseCode() +
          " | " +
          showRes.getContentText()
        );

        if (continueOnShowFetchError) {
          break;
        }

        throw new Error(rule.name + " のShow取得に失敗しました: " + showId);
      }

      const showData = JSON.parse(showRes.getContentText());
      const episodes = Array.isArray(showData.items) ? showData.items : [];

      episodes.forEach(function(episode) {
        const uri = String(episode && episode.uri ? episode.uri : "");
        const key = uri || (showId + "::" + String(episode && episode.id ? episode.id : ""));

        if (key) {
          episodesByUri[key] = episode;
        }
      });

      nextUrl = fetchAllPages && showData.next
        ? String(showData.next)
        : null;
    }
  });

  return Object.keys(episodesByUri).map(function(key) {
    return episodesByUri[key];
  });
}

function addAutoPlaylistEpisodesIndividually_(rule, token, episodes) {
  let addedCount = 0;
  let failedCount = 0;

  episodes.forEach(function(ep) {
    const addRes = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" +
        encodeURIComponent(rule.playlistId) +
        "/items",
      {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        headers: {
          Authorization: "Bearer " + token
        },
        payload: JSON.stringify({
          uris: [String(ep.uri)]
        })
      }
    );

    const status = addRes.getResponseCode();

    if (status === 200 || status === 201) {
      addedCount++;
      Logger.log("追加成功 ✅ " + ep.name);
    } else {
      failedCount++;
      Logger.log(
        "追加不可 ⚠️ " +
        ep.name +
        " | status=" +
        status +
        " | " +
        addRes.getContentText()
      );
    }
  });

  Logger.log("追加成功件数: " + addedCount);
  Logger.log("追加不可件数: " + failedCount);

  return {
    addedCount: addedCount,
    failedCount: failedCount
  };
}

function syncOneAutoPlaylist_(rule, token) {
  Logger.log("=== " + rule.name + " ===");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);

  const playlistItems =
    getAllSpotifyPlaylistItems_(rule.playlistId, token);

  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  const candidates = episodes.filter(function(ep) {
    return matchesAutoPlaylistRule_(ep, rule);
  });

  const newEpisodes = candidates.filter(function(ep) {
    const uri = String(ep && ep.uri ? ep.uri : "");
    return uri && !existingUris.has(uri);
  });

  Logger.log("候補件数: " + candidates.length);
  Logger.log("新規追加候補: " + newEpisodes.length);

  if (!newEpisodes.length) {
    Logger.log("追加なし。すべて登録済みです ✅");
    return;
  }

  if (rule.addIndividually === true) {
    const result =
      addAutoPlaylistEpisodesIndividually_(rule, token, newEpisodes);

    if (
      result.addedCount > 0 &&
      rule.updateLatestDateOnAdd === true
    ) {
      updatePlaylistLatestDate_(rule.playlistId);
    }

    return;
  }

  const uris = newEpisodes.map(function(ep) {
    return String(ep.uri);
  });

  const addRes = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/playlists/" +
      encodeURIComponent(rule.playlistId) +
      "/items",
    {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({ uris: uris })
    }
  );

  Logger.log("Add status: " + addRes.getResponseCode());
  Logger.log(addRes.getContentText());

  if (
    addRes.getResponseCode() !== 200 &&
    addRes.getResponseCode() !== 201
  ) {
    throw new Error(rule.name + " への追加に失敗しました");
  }

  newEpisodes.forEach(function(ep) {
    Logger.log("追加完了 ✅ " + ep.name);
  });

  if (rule.updateLatestDateOnAdd === true) {
    updatePlaylistLatestDate_(rule.playlistId);
  }
}
