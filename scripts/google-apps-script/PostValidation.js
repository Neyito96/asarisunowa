// 投稿入力検証

function validatePostInputLengths_(values) {
  const limits = {
    url: 2048,
    title: 200,
    maker: 100,
    comment: 2000,
    introducedDate: 32,
    artwork: 2048,
    kind: 32,
    securityAnswer: 20,
    updateType: 100,
    inviteUrl: 2048,
    keywords: 500,
    ruleNote: 2000,
    requestId: 100
  };

  const labels = {
    url: "URL",
    title: "タイトル",
    maker: "作成者",
    comment: "コメント",
    introducedDate: "紹介日",
    artwork: "画像URL",
    kind: "投稿種別",
    securityAnswer: "セキュリティ回答",
    updateType: "更新方式",
    inviteUrl: "共同編集URL",
    keywords: "キーワード",
    ruleNote: "ルール",
    requestId: "受付番号"
  };

  for (const key in values) {
    if (
      Object.prototype.hasOwnProperty.call(values, key) &&
      limits[key] &&
      String(values[key] || "").length > limits[key]
    ) {
      return labels[key] + "が長すぎます";
    }
  }

  return "";
}

function validateAutoUpdateRequest_(values) {
  const source = values || {};
  const url = String(source.url || "").trim();
  const title = String(source.title || "").trim();
  const maker = String(source.maker || "").trim();
  const updateType = String(source.updateType || "").trim();
  const inviteUrl = String(source.inviteUrl || "").trim();
  const keywords = String(source.keywords || "").trim();
  const securityAnswer = String(source.securityAnswer || "").trim();
  const requestId = String(source.requestId || "").trim();

  const lengthError = validatePostInputLengths_({
    url: url,
    title: title,
    maker: maker,
    updateType: updateType,
    inviteUrl: inviteUrl,
    keywords: keywords,
    ruleNote: String(source.ruleNote || "").trim(),
    securityAnswer: securityAnswer,
    requestId: requestId
  });
  if (lengthError) return lengthError;

  if (securityAnswer !== SUBMIT_SECURITY_ANSWER) {
    return "セキュリティ回答が正しくありません";
  }
  if (!url || !title || !maker || !inviteUrl || !keywords) {
    return "必須項目が不足しています";
  }
  if (["series", "speaker", "theme"].indexOf(updateType) < 0) {
    return "自動更新の種類が正しくありません";
  }
  const playlistId = extractAutoUpdateSpotifyPlaylistId_(url);
  const invitePlaylistId = extractAutoUpdateSpotifyPlaylistId_(inviteUrl);
  if (!playlistId) {
    return "Spotifyプレイリストを選んでください";
  }
  if (
    !invitePlaylistId ||
    !/[?&]pt=[^&#]+/i.test(inviteUrl)
  ) {
    return "Spotifyの共同編集者招待URLを確認してください";
  }
  if (playlistId !== invitePlaylistId) {
    return "共同編集者招待URLのプレイリストが一致しません";
  }
  if (requestId && !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
    return "受付番号が正しくありません";
  }

  return "";
}

function extractAutoUpdateSpotifyPlaylistId_(value) {
  const match = String(value || "").trim().match(
    /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)(?:[?#]|$)/i
  );
  return match ? String(match[1]) : "";
}

function validatePostBasic_(url, title, maker, securityAnswer) {
  if (securityAnswer !== SUBMIT_SECURITY_ANSWER) {
    return "セキュリティ回答が正しくありません";
  }

  if (!url || !title || !maker) {
    return "必須項目が不足しています";
  }

  return "";
}

function validatePostKind_(kind) {
  if (kind !== "playlist" && kind !== "podcast" && kind !== "listenerPodcast") {
    return "投稿の種類が正しくありません";
  }

  return "";
}

function validatePostTargetUrl_(kind, url) {
  const isPlaylistUrl =
    /^https:\/\/open\.spotify\.com\/playlist\//i.test(url) ||
    /^https:\/\/music\.youtube\.com\/playlist\?/i.test(url);

  const isPodcastUrl =
    /^https:\/\/open\.spotify\.com\/show\//i.test(url) ||
    /^https:\/\/open\.spotify\.com\/episode\//i.test(url) ||
    /^https:\/\/podcasts\.apple\.com\//i.test(url) ||
    /^https:\/\/music\.amazon\./i.test(url) ||
    /^https:\/\/www\.amazon\./i.test(url) ||
    /^https:\/\/listen\.style\//i.test(url) ||
    /^https:\/\/stand\.fm\//i.test(url) ||
    /^https:\/\/pca\.st\//i.test(url) ||
    /^https:\/\/pocketcasts\.com\//i.test(url) ||
    /^https:\/\/(www\.)?youtube\.com\//i.test(url) ||
    /^https:\/\/youtu\.be\//i.test(url);

  if (kind === "playlist" && !isPlaylistUrl) {
    return "朝リストにはSpotifyまたはYouTube MusicのプレイリストURLを入力してください";
  }

  if ((kind === "podcast" || kind === "listenerPodcast") && !isPodcastUrl) {
    return "Podcastの番組URLを確認してください";
  }

  return "";
}
