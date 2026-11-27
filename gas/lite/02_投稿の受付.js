// 02_投稿の受付（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: PostInput.js, PostValidation.js, PostDuplicate.js, PostArtwork.js, PostSheets.js, PostWrite.js, PostSave.js, ShelfSubmit.js, Posukami.js

// ---- PostInput.js ----
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
    shelf: normalizePlaylistShelf_(data.shelf),
    // 自動育成（蔵から）: 朝日新聞ポッドキャストの番組名と、題名に入る語
    autoShow: String(data.autoShow || "").trim().slice(0, 40),
    autoKeyword: String(data.autoKeyword || "").trim().slice(0, 40)
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

// ---- PostValidation.js ----
function validatePostInputLengths_(values) {
  const limits = {
    url: 2048,
    title: 200,
    maker: 100,
    host: 100,
    rss: 2048,
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
    host: "配信者 / Host",
    rss: "RSS",
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
    /^https:\/\/youtu\.be\//i.test(url) ||
    /^https?:\/\/[^\s]+\/(?:rss|feed)(?:[/?#]|$)/i.test(url) ||
    /^https?:\/\/[^\s]+\.(?:rss|xml)(?:[?#]|$)/i.test(url);

  if (kind === "playlist" && !isPlaylistUrl) {
    return "朝リストにはSpotifyまたはYouTube MusicのプレイリストURLを入力してください";
  }

  if ((kind === "podcast" || kind === "listenerPodcast") && !isPodcastUrl) {
    return "Podcastの番組URLを確認してください";
  }

  return "";
}

// ---- PostDuplicate.js ----
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

// ---- PostArtwork.js ----
function resolvePostArtwork_(artwork, kind, title) {
  if (artwork) return artwork;

  if (kind === "podcast" || kind === "listenerPodcast") {
    return findPodcastArtworkByTitle(title);
  }

  return artwork;
}

// ---- PostSheets.js ----
function getPostSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getSheetLoose(ss, LOG_SHEET_NAME);
  const workSheet = getSheetLoose(ss, WORK_SHEET_NAME);
  const podcastSheet = getSheetLoose(ss, PODCAST_SHEET_NAME);
  const listenerPodcastSheet = getSheetLoose(ss, LISTENER_PODCAST_SHEET_NAME);

  if (!logSheet) throw new Error("投稿受付シートが見つかりません");
  if (!workSheet) throw new Error("作業台シートが見つかりません");
  if (!podcastSheet) throw new Error("おすすめPodcastシートが見つかりません");
  if (!listenerPodcastSheet) throw new Error("朝リスPodcastシートが見つかりません");

  return {
    logSheet: logSheet,
    workSheet: workSheet,
    podcastSheet: podcastSheet,
    listenerPodcastSheet: listenerPodcastSheet
  };
}
function appendPostLog_(logSheet, url, title, maker, kind, comment) {
  logSheet.appendRow([
    new Date(),
    url,
    title,
    maker,
    kind === "listenerPodcast"
      ? "朝リスPodcast"
      : kind === "podcast"
      ? "おすすめPodcast"
      : "朝ポキプレイリスト",
    comment
  ]);
}

// ---- PostWrite.js ----
function getPostTargetSheet_(kind, workSheet, podcastSheet, listenerPodcastSheet) {
  return kind === "listenerPodcast"
    ? listenerPodcastSheet
    : kind === "podcast"
    ? podcastSheet
    : workSheet;
}
function appendPostRow_(targetSheet, kind, url, title, maker, host, rss, introducedDate, comment, artwork, inviteUrl, shelf, autoGrow) {
  if (kind === "listenerPodcast") {
    ensurePodcastMetadataHeaders_(targetSheet, kind);
    // Persist submitted/known information only; no external lookup on the save path.
    const resolved = {};
    applyKnownPodcastUrl_(resolved, url);
    // Pody URLs are verified asynchronously, even when submitted as the primary URL.
    resolved.pody = "";

    targetSheet.appendRow([
      url,
      title,
      maker,
      introducedDate || "",
      comment,
      resolved.spotify || "",
      resolved.apple || "",
      resolved.listen || "",
      resolved.standfm || "",
      resolved.amazon || "",
      resolved.youtube || "",
      resolved.website || "",
      resolved.artwork || artwork || "",
      resolved.rss || rss || "",
      resolved.pocketcasts || "",
      resolved.pody || "",
      resolved.genre || ""
    ]);
    return;
  }

  if (kind === "podcast") {
    ensurePodcastMetadataHeaders_(targetSheet, kind);
    const resolved = {};
    applyKnownPodcastUrl_(resolved, url);
    resolved.pody = "";

    targetSheet.appendRow([
      url,
      title,
      maker,
      new Date(),
      comment,
      resolved.artwork || artwork || "",
      host || "",
      resolved.rss || rss || "",
      resolved.youtube || "",
      resolved.spotify || "",
      resolved.amazon || "",
      resolved.apple || "",
      resolved.pocketcasts || "",
      resolved.listen || "",
      resolved.standfm || "",
      resolved.pody || "",
      resolved.website || "",
      resolved.genre || ""
    ]);
    return;
  }

  // プレイリストはD列に共同編集URL、G列に取得待ち状態、H列に登録日を保存する。
  // Spotify取得に成功したら PlaylistDates.js がF列を書き、G列をAUTOへ進める。
  const row = targetSheet.getLastRow() + 1;
  targetSheet.getRange(row, 1, 1, 4).setValues([[
    url,
    title,
    maker,
    inviteUrl || ""
  ]]);
  targetSheet.getRange(row, 7).setValue("要確認");
  targetSheet.getRange(row, 8).setValue(new Date());
  // I列＝掲載先（連載／朝リスト）。投稿で選ばれた時だけ書く。管理人は作業台のI列を直せば掲載先を変えられる。
  const shelfLabel = normalizePlaylistShelf_(shelf);
  if (shelfLabel) targetSheet.getRange(row, 9).setValue(shelfLabel);
  // J列＝自動育成の番組、K列＝題名に入る語（蔵から自動で育てる。LibraryPlaylist.js が読む）
  const grow = autoGrow || {};
  if (grow.show && typeof LIBRARY_PLAYLIST_SHOW_IDS_ !== "undefined" && LIBRARY_PLAYLIST_SHOW_IDS_[grow.show] &&
      String(grow.keyword || "").trim().length >= 2) {
    targetSheet.getRange(row, 10, 1, 2).setValues([[grow.show, "'" + String(grow.keyword).trim()]]);
  }
}
function ensurePodcastMetadataHeaders_(sheet, kind) {
  if (!sheet) return;

  if (kind === "podcast") {
    const headers = [
      "配信者 / Host",
      "RSS",
      "YouTube",
      "Spotify",
      "Amazon Music",
      "Apple Podcasts",
      "Pocket Casts",
      "LISTEN",
      "stand.fm",
      "Pody",
      "番組HP",
      "ジャンル"
    ];
    const range = sheet.getRange(1, 7, 1, headers.length);
    const current = range.getDisplayValues()[0];
    const next = current.slice();
    let changed = false;
    for (let i = 0; i < headers.length; i++) {
      if (!String(next[i] || "").trim()) {
        next[i] = headers[i];
        changed = true;
      }
    }
    if (changed) range.setValues([next]);
    return;
  }

  if (kind === "listenerPodcast") {
    const headers = ["RSS", "Pocket Casts", "Pody", "ジャンル"];
    const range = sheet.getRange(1, 14, 1, headers.length);
    const current = range.getDisplayValues()[0];
    const next = current.slice();
    let changed = false;
    for (let i = 0; i < headers.length; i++) {
      if (!String(next[i] || "").trim()) {
        next[i] = headers[i];
        changed = true;
      }
    }
    if (changed) range.setValues([next]);
  }
}

// ---- PostSave.js ----
const PLAYLIST_RECEIPT_CACHE_PREFIX_ = "PLAYLIST_RECEIPT_";
const PLAYLIST_RECEIPT_SECONDS_ = 600;
function savePost_(url, title, maker, host, rss, introducedDate, comment, artwork, kind, inviteUrl, requestId, shelf, autoGrow) {
  const writeLock = LockService.getScriptLock();
  if (!writeLock.tryLock(5000)) {
    throw new Error("ただいま投稿が混み合っています。少し待って再度お試しください");
  }

  try {
    const postSheets = getPostSheets_();

    appendPostLog_(
      postSheets.logSheet,
      url,
      title,
      maker,
      kind,
      comment
    );

    const targetSheet = getPostTargetSheet_(
      kind,
      postSheets.workSheet,
      postSheets.podcastSheet,
      postSheets.listenerPodcastSheet
    );

    const lastRow = targetSheet.getLastRow();

    const existingRows =
      lastRow > 1
        ? targetSheet
            .getRange(
              2,
              1,
              lastRow - 1,
              Math.max(2, targetSheet.getLastColumn())
            )
            .getDisplayValues()
        : [];

    const duplicate = findPostDuplicate_(existingRows, kind, url, title);

    let added = false;
    let duplicateReason = "";

    if (!duplicate.duplicateByUrl && !duplicate.duplicateByTitle) {
      appendPostRow_(
        targetSheet,
        kind,
        url,
        title,
        maker,
        host,
        rss,
        introducedDate,
        comment,
        artwork,
        inviteUrl,
        shelf,
        autoGrow
      );

      added = true;
    } else {
      duplicateReason = duplicate.duplicateReason;
    }

    SpreadsheetApp.flush();

    // Receipt failures cannot turn a committed row into a failed submission.
    if (kind === "podcast" || kind === "listenerPodcast") {
      try { completePodcastReceipt_(requestId, added, duplicateReason); }
      catch (_) { Logger.log("Podcast receipt completion deferred; status checks the saved row."); }
    }

    // 新規保存された通常投稿のみ管理者へ通知する。
    // メール送信に失敗しても、保存済み投稿そのものは失敗扱いにしない。
    if (added) {
      try {
        notifyPostReceived_({
          kind: kind,
          title: title,
          maker: maker,
          host: host,
          rss: rss,
          url: url,
          comment: comment
        });
      } catch (notificationError) {
        Logger.log(
          "通常投稿の管理者メール通知に失敗しました: " +
          String(notificationError)
        );
      }
    }

    const cleanRequestId = String(requestId || "").trim();
    if (kind === "playlist" && /^[A-Za-z0-9_-]{16,100}$/.test(cleanRequestId)) {
      CacheService.getScriptCache().put(
        PLAYLIST_RECEIPT_CACHE_PREFIX_ + cleanRequestId,
        "accepted",
        PLAYLIST_RECEIPT_SECONDS_
      );
    }

    return jsonResponse({
      ok: true,
      kind: kind,
      added: added,
      duplicateReason: duplicateReason,
      message: added ? "保存しました" : "すでに登録されています"
    });
  } finally {
    writeLock.releaseLock();
  }
}
function handlePlaylistRequestStatus_(e, callback) {
  const requestId = String(
    e && e.parameter && e.parameter.requestId
      ? e.parameter.requestId
      : ""
  ).trim();

  if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
    return apiResponse({ ok: false, accepted: false, error: "受付番号が正しくありません" }, callback);
  }

  const accepted = CacheService.getScriptCache().get(
    PLAYLIST_RECEIPT_CACHE_PREFIX_ + requestId
  ) === "accepted";

  return apiResponse({ ok: true, accepted: accepted }, callback);
}

// ---- ShelfSubmit.js ----
var SHELF_SHEET_ = '蔵書推薦・受付';
var SHELF_H_ = ['受付ID', '受付日時', '状態', 'EP-ID（並び順）', '件数', '蔵書名', '説明', 'ひとこと', 'ニックネーム', '同じ内容の印', '管理メモ', 'Spotify希望', '追加先プレイリストURL', 'Spotify結果'];
var SHELF_LIMITS_ = { items: 50, title: 60, description: 300, note: 300, nick: 30, perMinute: 20 };
var SHELF_ERROR_TEXT_ = { HONEYPOT: '送信できませんでした', NO_ITEMS: '蔵書に回が入っていません', TOO_MANY: '一度に送れるのは50回までです', BAD_ID: '回番号の形が正しくありません', DUPLICATE: '同じ内容がすでに受け付けられています（承認待ち）', BUSY: '混み合っています。少し待ってからもう一度お試しください', RATE: '短い時間に送信が集中しています。少し待ってからお試しください', NOT_SAVED: '保存を確認できませんでした。もう一度お試しください' };
function shelfClean_(s, max) { var t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); return /^[=+\-@]/.test(t) ? "'" + t : t; }   // 表計算の式として解釈されないように
// みんなの蔵書に自動で載せない文字（2026-11-27 管理人決定: 承認なしで先に載せ、まずいものは後から「非公開」にする）。
// 題名・説明・ニックネームに URL・メールアドレス・電話番号らしきものがあれば、自動では載せず「承認待ち」にする
function shelfPublicBlocked_(v) {
  var t = [v.title, v.description, v.nick].join(' ');
  if (/https?:|www\.|[a-z0-9-]+\.(com|jp|net|org|io|ly|me|co|info)\b/i.test(t)) return 'URL';
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/.test(t)) return 'MAIL';
  if (/(?:\d[\s\-‐ー－]?){10,}/.test(t.replace(/[０-９]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0xFEE0); }))) return 'PHONE';
  return '';
}
function shelfValidate_(sub) {
  if (String(sub.hp || '').trim()) return { ok: false, errors: ['HONEYPOT'] };
  var raw = String(sub.ids || '').split(/[\s,]+/).filter(Boolean), ids = [];
  for (var i = 0; i < raw.length; i++) { if (!/^EP-\d{5}$/.test(raw[i])) return { ok: false, errors: ['BAD_ID'] }; if (ids.indexOf(raw[i]) < 0) ids.push(raw[i]); }
  if (!ids.length) return { ok: false, errors: ['NO_ITEMS'] };
  if (ids.length > SHELF_LIMITS_.items) return { ok: false, errors: ['TOO_MANY'] };
  var v = { ids: ids, title: shelfClean_(sub.title, SHELF_LIMITS_.title), description: shelfClean_(sub.description, SHELF_LIMITS_.description), note: shelfClean_(sub.note, SHELF_LIMITS_.note), spotify: /^(1|true|on)$/i.test(String(sub.spotify || '')), nick: shelfClean_(sub.nick, SHELF_LIMITS_.nick) , publish: /^(1|true|on)$/i.test(String(sub.publish || ''))};
  v.key = ids.join(',') + '|' + v.title;
  v.blocked = shelfPublicBlocked_(v);
  return { ok: true, value: v };
}
// 既存タブには見出しが足りない列だけ右に足す（既存の列・行は動かさない）
function shelfSheet_(ss) {
  var sh = posuSheet(ss, SHELF_SHEET_, SHELF_H_), w = sh.getLastColumn(), h = sh.getRange(1, 1, 1, Math.max(w, 1)).getDisplayValues()[0];
  for (var i = 0; i < SHELF_H_.length; i++) if (String(h[i] || '') !== SHELF_H_[i]) { if (i < 11) throw new Error('蔵書推薦・受付の見出しが想定と違います'); sh.getRange(1, i + 1).setValue(SHELF_H_[i]); }
  return sh;
}
function shelfSubmit_(sub) {
  var v = shelfValidate_(sub); if (!v.ok) return { ok: false, errors: v.errors, message: SHELF_ERROR_TEXT_[v.errors[0]] };
  var cache = CacheService.getScriptCache(), slot = 'SHELF_RATE_' + Math.floor(Date.now() / 60000), n = Number(cache.get(slot) || 0);
  if (n >= SHELF_LIMITS_.perMinute) return { ok: false, errors: ['RATE'], message: SHELF_ERROR_TEXT_.RATE };
  cache.put(slot, String(n + 1), 120);
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, errors: ['BUSY'], message: SHELF_ERROR_TEXT_.BUSY };
  try {
    var c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), sh = shelfSheet_(ss), rows = posuRows(sh, SHELF_H_.length), x = v.value;
    if (rows.some(function (r) { return r[9] === x.key && (r[2] === '承認待ち' || SHELF_PUBLIC_STATUSES_.indexOf(r[2]) >= 0); })) return { ok: false, errors: ['DUPLICATE'], message: SHELF_ERROR_TEXT_.DUPLICATE };
    var now = new Date().toISOString(), id = 'SH-' + now.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 900 + 100);
    var pub = x.publish && !x.blocked;
    sh.appendRow([id, now, pub ? '公開' : '承認待ち', x.ids.join(' '), x.ids.length, x.title, x.description, x.note, x.nick, x.key, x.publish && x.blocked ? '自動公開せず: ' + x.blocked : '', x.spotify ? '希望' : '', '', '']);
    SpreadsheetApp.flush();
    if (posuRows(sh, SHELF_H_.length).filter(function (r) { return r[0] === id; }).length !== 1) return { ok: false, errors: ['NOT_SAVED'], message: SHELF_ERROR_TEXT_.NOT_SAVED };
    if (pub) return { ok: true, status: 'PUBLIC', receiptId: id, count: x.ids.length, message: '受け付けました。30分ほどで「みんなの蔵書」に並びます' };
    return { ok: true, status: 'PENDING', receiptId: id, count: x.ids.length, message: x.publish ? '受け付けました。題名・説明・ニックネームにURLや連絡先らしきものがあるため、管理人が確認してから載せます' : '受け付けました。管理人が確認してから、テーマ選びやプレイリストの参考にします' };
  } finally { lock.releaseLock(); }
}
function handleShelfSubmit_(e, callback) {
  var p = (e && e.parameter) || {}, res = shelfSubmit_({ ids: p.ids, title: p.title, description: p.description, note: p.note, nick: p.nick, spotify: p.spotify, publish: p.publish, hp: p.website2 });
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
// みんなの蔵書（#463・2026-11-27 管理人決定）: 「状態」が「公開」（本人が載せると選び、自動で通ったもの）か「公開OK」（管理人が手で）の行だけを返す（読むだけ。表には書かない）。
// 出すのは 受付ID・受付日・蔵書名・説明・回の並び・ニックネーム だけ。「ひとこと」（管理人あての伝言）と管理メモは出さない。
var SHELF_PUBLIC_STATUSES_ = ['公開', '公開OK'];   // 「非公開」にすれば一覧から消える
function shelfPublicRows_(rows) {
  return rows.filter(function (r) { return SHELF_PUBLIC_STATUSES_.indexOf(String(r[2]).trim()) >= 0; }).map(function (r) {
    var ids = String(r[3] || '').split(/\s+/).filter(function (x) { return /^EP-\d{5}$/.test(x); }).slice(0, SHELF_LIMITS_.items);
    var date = String(r[1] || '').slice(0, 10);
    return { id: String(r[0]), date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', title: String(r[5] || '').replace(/^'/, ''), description: String(r[6] || '').replace(/^'/, ''), ids: ids, nick: String(r[8] || '').replace(/^'/, '') };
  }).filter(function (x) { return /^SH-\d{14}-\d{3}$/.test(x.id) && x.ids.length; });
}
function handleShelfPublic_(e, callback) {
  var res;
  try {
    var ss = SpreadsheetApp.openById(posuCfg().spreadsheetId), sh = ss.getSheetByName(SHELF_SHEET_);
    res = { ok: true, type: 'shelfPublic', generatedAt: new Date().toISOString(), shelves: sh ? shelfPublicRows_(posuRows(sh, SHELF_H_.length)) : [] };
  } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}

// ---- Posukami.js ----
var POSU_QUEUE_H = ['受付ID', '受付日時', '番組ID', '番組名', 'URL', '照合キー', '交流の種類', 'タイトル（投稿）', '配信日（投稿）', '補足', '検出タイトル', '検出配信日', 'ページ確認', '関係の手がかり', '状態', '判断メモ', '反映日時'];
var POSU_PUBLIC_H = ['種別', '番組ID', '番組名', 'タイトル', '回の番組名', '配信日', 'URL', '交流の種類', 'EP-ID', '確認日', '根拠', '照合キー', '受付ID'];
var POSU_RELATIONS = { reply: 'ポすすめ返し（ポすすめを受けて番組が配信した回）', donut_guest: 'ドーナツに番組の配信者が出演', kanda_guest: 'この番組に神田さん等が出演', other: 'その他の交流' };
// カード上の欄: reply は「💬 ポすすめ返し」、それ以外は「✨ ポす神回」
var POSU_REPLY_RELATIONS = { reply: true };
var POSU_STATE = { PENDING: '承認待ち', APPROVE: '承認', REJECT: '却下', DONE: '反映済み' };
var POSU_LIMITS = { pendingPerPodcast: 5, pendingTotal: 60, title: 200, note: 500 };
function posuNz(s) { return String(s == null ? '' : s).normalize('NFKC').replace(/[\s​-‍﻿]+/g, '').toLowerCase(); }
// 番組名の芯（区切り記号の前）。3文字未満なら使わない
function posuCore(title) { var t = String(title || '').normalize('NFKC').split(/\s[—–-]\s|[—–|｜（(【\[:：]/)[0].trim(); return posuNz(t).length >= 3 ? posuNz(t) : ''; }
// 'YYYY/MM/DD HH:mm'（JST）・'YYYY-MM-DD'・'YYYY.MM.DD' → 'YYYY-MM-DD'
function posuDay(s) { var m = String(s || '').match(/(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }
function posuDayDiff(a, b) { var x = Date.parse(posuDay(a) + 'T00:00:00Z'), y = Date.parse(posuDay(b) + 'T00:00:00Z'); return isFinite(x) && isFinite(y) ? Math.round(Math.abs(x - y) / 86400000) : Infinity; }
// 概要の「紹介したポッドキャストは「X」」の X と番組名が十分似ているか（2文字ずつの一致率。表記ゆれ用・日付一致と併用）
function posuBigrams(t) { var a = {}, n = 0; for (var i = 0; i < t.length - 1; i++) { a[t.substr(i, 2)] = (a[t.substr(i, 2)] || 0) + 1; n++; } return { a: a, n: n }; }
function posuDice(x, y) { var A = posuBigrams(x), B = posuBigrams(y), hit = 0; if (!A.n || !B.n) return 0; for (var k in A.a) if (B.a[k]) hit += Math.min(A.a[k], B.a[k]); return 2 * hit / (A.n + B.n); }
function posuNamedIntroHit(summary, title) {
  var re = /紹介(?:した|している)ポッドキャストは[「『]([^」』]{3,80})[」』]/g, m, t = posuNz(String(title || '').replace(/[〜～~]+$/, ''));
  while ((m = re.exec(String(summary || '').normalize('NFKC')))) if (posuDice(posuNz(m[1].replace(/[〜～~]+$/, '')), t) >= 0.7) return true;
  return false;
}
function posuIsIntroEpisode(title) { var t = String(title || '').normalize('NFKC'); return /\(ポすすめ\)|\(日曜版\)/.test(t); }

// ===== 1) 紹介元ドーナツ回の照合 =====
// podcasts: [{ id, title, maker, introduced }]、eps: [{ ep, title, date(JST), summary, status(掲載判定), url(公式個別URL) }]（ドーナツだけ）
// 確定（VERIFIED）= 番組名（全体か芯）が回の題名か概要に含まれる ＋ 回の配信日が紹介配信日の±1日 ＋ 掲載判定が除外でない。
// 番組名だけ・日付だけの一致は HOLD（候補として残し、リンクは出さない）。複数の回が確定なら全部出す。
function posuIntroMatch(podcasts, eps) {
  var intro = eps.filter(function (e) { return posuIsIntroEpisode(e.title) && !/除外|対象外/.test(String(e.status || '')); });
  return podcasts.map(function (p) {
    var full = posuNz(p.title), core = posuCore(p.title), maker = posuNz(p.maker), out = { id: String(p.id), title: p.title, introduced: p.introduced, status: 'NOT_FOUND', intros: [], candidates: [] };
    intro.forEach(function (e) {
      var hay = posuNz(e.title) + '\u0001' + posuNz(e.summary), ev = [];
      if (full.length >= 3 && hay.indexOf(full) >= 0) ev.push('番組名一致'); else if (core && hay.indexOf(core) >= 0) ev.push('番組名（芯）一致');
      var dd = posuDayDiff(e.date, p.introduced); if (dd <= 1) ev.push(dd === 0 ? '紹介日一致' : '紹介日±1日');
      if (!ev.some(function (x) { return /^番組名/.test(x); }) && posuNamedIntroHit(e.summary, p.title)) ev.unshift('番組名（概要の紹介文）一致');   // 「紹介したポッドキャストは「…」」の表記ゆれ（例: 吹奏楽部⇔吹部）
      if (maker.length >= 2 && hay.indexOf(maker) >= 0) ev.push('配信者名一致');
      var titleHit = ev.some(function (x) { return /^番組名/.test(x); }), dayHit = dd <= 1;
      var rec = { ep: e.ep, show: e.show || '', title: e.title, date: posuDay(e.date), url: e.url || '', evidence: ev.join('・') };
      if (titleHit && dayHit) out.intros.push(rec); else if (titleHit || (dayHit && ev.length)) out.candidates.push(rec);
    });
    out.status = out.intros.length ? 'VERIFIED' : out.candidates.length ? 'HOLD' : 'NOT_FOUND';
    return out;
  });
}

// ===== 2) 投稿の検証 =====
// エピソード個別URLだけを受け付ける（番組トップは不可）。照合キーは「同じ回」を表す正規化URL
function posuEpisodeUrl(raw) {
  var s = String(raw || '').trim(), m;
  if (!/^https:\/\//i.test(s) || s.length > 600) return null;
  var u = s.replace(/#.*$/, ''), host = (u.match(/^https:\/\/([^\/?]+)/i) || [])[1].toLowerCase().replace(/^www\./, '');
  var path = u.replace(/^https:\/\/[^\/?]+/i, '').replace(/\?.*$/, ''), q = (u.match(/\?(.*)$/) || [])[1] || '';
  var param = function (k) { var x = q.match(new RegExp('(?:^|&)' + k + '=([^&]+)')); return x ? decodeURIComponent(x[1]) : ''; };
  if (host === 'open.spotify.com' && (m = path.match(/^\/(?:intl-[a-z]+\/)?episode\/([A-Za-z0-9]{22})/))) return { service: 'Spotify', key: 'spotify:' + m[1] };
  if (host === 'podcasts.apple.com' && /\/id\d+/.test(path) && /^\d+$/.test(param('i'))) return { service: 'Apple Podcasts', key: 'apple:' + param('i') };
  if (host === 'listen.style' && (m = path.match(/^\/p\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/?$/))) return { service: 'LISTEN', key: 'listen:' + m[1] + '/' + m[2] };
  if (host === 'pca.st' && (m = path.match(/^\/episode\/([0-9a-f-]{36})$/i))) return { service: 'Pocket Casts', key: 'pocketcasts:' + m[1].toLowerCase() };
  if (host === 'pody.jp' && (m = path.match(/^\/player\/([A-Za-z0-9]{20})\/([A-Za-z0-9]{20})$/))) return { service: 'Pody', key: 'pody:' + m[2] };
  if (/^music\.amazon\.[a-z.]+$/.test(host) && (m = path.match(/^\/podcasts\/[0-9a-f-]{36}\/episodes\/([0-9a-f-]{36})/i))) return { service: 'Amazon Music', key: 'amazon:' + m[1].toLowerCase() };
  if (host === 'omny.fm' && (m = path.match(/^\/shows\/([^\/]+)\/([^\/]+)\/?$/)) && m[2] !== 'playlists') return { service: 'Omny', key: 'omny:' + m[1] + '/' + m[2] };
  if (host === 'youtube.com' && path === '/watch' && /^[A-Za-z0-9_-]{11}$/.test(param('v'))) return { service: 'YouTube', key: 'youtube:' + param('v') };
  if (host === 'youtu.be' && (m = path.match(/^\/([A-Za-z0-9_-]{11})$/))) return { service: 'YouTube', key: 'youtube:' + m[1] };
  if (host === 'stand.fm' && (m = path.match(/^\/episodes\/([A-Za-z0-9]+)$/))) return { service: 'stand.fm', key: 'standfm:' + m[1] };
  if (host === 'asahi.com' && path === '/special/podcasts/item/' && /^[0-9a-f-]{36}$/i.test(param('itemid'))) return { service: '朝日新聞', key: 'asahi:' + param('itemid').toLowerCase() };
  return null;
}
// sub: { podcastId, podcastTitle, url, relation, title, date, note, hp }、podcasts: [{id,title}]、taken: {照合キー: true}（キュー〈却下以外〉と公開の両方）、pending: {番組ID: 件数, _total: 件数}
function posuValidate(sub, podcasts, taken, pending) {
  var errors = [], p = null, e = posuEpisodeUrl(sub.url);
  if (String(sub.hp || '').trim()) errors.push('BOT_SUSPECTED');
  podcasts.forEach(function (x) { if (String(x.id) === String(sub.podcastId)) p = x; });
  if (!p) errors.push('UNKNOWN_PODCAST'); else if (posuNz(p.title) !== posuNz(sub.podcastTitle)) errors.push('PODCAST_TITLE_MISMATCH');
  if (!e) errors.push('NOT_EPISODE_URL');
  if (!POSU_RELATIONS[sub.relation]) errors.push('BAD_RELATION');
  if (String(sub.title || '').length > POSU_LIMITS.title || String(sub.note || '').length > POSU_LIMITS.note) errors.push('TOO_LONG');
  if (sub.date && !posuDay(sub.date)) errors.push('BAD_DATE');
  var key = e ? e.key + '|' + String(sub.podcastId) : '';
  if (key && taken[key]) errors.push('DUPLICATE');
  if (p && (pending[String(p.id)] || 0) >= POSU_LIMITS.pendingPerPodcast) errors.push('TOO_MANY_PENDING');
  if ((pending._total || 0) >= POSU_LIMITS.pendingTotal) errors.push('QUEUE_FULL');
  return { ok: !errors.length, errors: errors, key: key, service: e ? e.service : '', podcast: p };
}
// ページの題名・配信日（og:title・JSON-LD・<title>）。読めなければ空
function posuPageMeta(html) {
  var h = String(html || ''), pick = function (re) { var m = h.match(re); return m ? posuUnesc(m[1]).trim() : ''; };
  var title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) || pick(/"name"\s*:\s*"([^"]{2,300})"\s*,\s*"@type"\s*:\s*"PodcastEpisode"/) || pick(/"@type"\s*:\s*"PodcastEpisode"[^}]*?"name"\s*:\s*"([^"]{2,300})"/) || pick(/<title[^>]*>([^<]{2,300})<\/title>/i);
  var date = posuDay(pick(/"datePublished"\s*:\s*"([^"]+)"/) || pick(/property=["'](?:article:published_time|music:release_date)["'][^>]+content=["']([^"']+)/i));
  return { title: title, date: date };
}
function posuUnesc(s) { return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u0026/g, '&'); }
// 関係の手がかり（判断材料。自動承認には使わない）
function posuRelationHints(sub, meta, html, podcast) {
  var hay = posuNz(meta.title) + '\u0001' + posuNz(String(html || '').slice(0, 400000)), hints = [];
  if (podcast && hay.indexOf(posuNz(podcast.title)) >= 0) hints.push('ページに番組名');
  if (podcast && podcast.maker && posuNz(podcast.maker).length >= 2 && hay.indexOf(posuNz(podcast.maker)) >= 0) hints.push('ページに配信者名');
  if (/神田大介|神田さん|朝ポキ|朝日新聞ポッドキャスト/.test(String(meta.title) + String(html || '').slice(0, 400000))) hints.push('ページに神田さん・朝ポキ');
  if (/ポすすめ|日曜版|ドーナツ/.test(String(meta.title) + String(html || '').slice(0, 400000))) hints.push('ページに「ポすすめ」等');
  if (sub.relation === 'reply' && podcast && meta.date && posuDay(podcast.introduced)) hints.push(meta.date >= posuDay(podcast.introduced) ? '紹介日以降の配信' : '紹介日より前の配信（要確認）');
  return hints.length ? hints.join('・') : '手がかりなし（要確認）';
}

// ===== 2b) ポすすめ返しの候補探し（読むだけ・自動では載せない）=====
// eps: その番組の回（Apple の公開データ iTunes Search API lookup: trackName・description・releaseDate・trackViewUrl）
// 候補 = 紹介日〜90日後に配信 ＋ 題名か説明に「ポすすめ／朝日新聞／朝ポキ／ドーナツ／神田」。題名にあれば強い候補。あくまで候補で、承認キューにも入れない
function posuApprovePlan(queue, publicKeys, podcasts, nowIso) {
  var add = [], updates = [], seen = {};
  queue.forEach(function (r, i) {
    if (String(r[14]).trim() !== POSU_STATE.APPROVE) return;
    var key = String(r[5]);
    if (publicKeys[key] || seen[key]) { updates.push({ index: i, state: POSU_STATE.DONE, memo: '既に公開済み（二重反映しない）' }); return; }
    var p = null; podcasts.forEach(function (x) { if (String(x.id) === String(r[2])) p = x; });
    if (!p || posuNz(p.title) !== posuNz(r[3])) { updates.push({ index: i, state: POSU_STATE.PENDING, memo: '番組が見つからない・番組名が変わった（要確認）' }); return; }
    seen[key] = 1;
    var ep = (String(r[15]) + ' ' + String(r[9])).match(/EP-\d{5}/), program = r[6] === 'donut_guest' ? 'ドーナツ' : (r[6] === 'kanda_guest' || r[6] === 'reply') ? String(r[3]) : '';   // 蔵の回なら 判断メモ か 補足 に書いた EP-ID を使う
    add.push(['SPECIAL', String(r[2]), r[3], String(r[7]).trim() || String(r[10]).trim(), program, posuDay(r[8]) || posuDay(r[11]), r[4], r[6], ep ? ep[0] : '', posuDay(nowIso), '承認（' + r[0] + '）・' + r[12] + '・' + r[13], key, r[0]]);
    updates.push({ index: i, state: POSU_STATE.DONE, memo: '' });
  });
  return { add: add, updates: updates };
}

// ===== 4) 公開シート → サイト用 JSON =====
// rows: 公開シートの行（見出しを除く）、libraryIds: 公開中の蔵にある EP-ID の集合（{EP-ID: true}）。蔵に無い回は公式ページへ
function posuCfg() {
  var base = { spreadsheetId: (typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : ''), podcastSheet: (typeof LISTENER_PODCAST_SHEET_NAME !== 'undefined' ? LISTENER_PODCAST_SHEET_NAME : '朝リスPodcast'), queueSheet: 'ポす神回・投稿キュー', publicSheet: 'ポす神回・公開', ledgerId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', ledgerSheet: 'V2・統合台帳', podcastApi: '' };
  if (typeof POSU_CFG_OVERRIDE !== 'undefined' && POSU_CFG_OVERRIDE) for (var k in POSU_CFG_OVERRIDE) base[k] = POSU_CFG_OVERRIDE[k];
  return base;
}
function posuSheet(ss, name, header) { var sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, header.length).setValues([header]); sh.setFrozenRows(1); } return sh; }
function posuRows(sh, width) { var n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, width).getDisplayValues() : []; }
// 朝リスPodcast一覧。ID は「番組ID」列（R列以降の見出しで探す）。空なら既存の公開API（readListenerPodcastSheet）と同じ並び順の番号
var POSU_PODCAST_EXTRA_H = ['番組ID', '紹介された回', 'ポすすめ返し', 'ポす神回', 'ポす投稿（承認待ち）'];
function posuPodcastRowsToList(values) {
  var h = values[0] || [], idCol = h.indexOf('番組ID');
  return values.slice(1).filter(function (r) { return r[0] || r[1]; }).map(function (r, i) { return { id: String((idCol >= 0 && String(r[idCol]).trim()) || (i + 1)), title: r[1], maker: r[2], introduced: r[3], apple: r[6] }; });
}
function posuPodcasts() {
  var c = posuCfg();
  if (c.podcastApi) { var j = JSON.parse(UrlFetchApp.fetch(c.podcastApi, { muteHttpExceptions: true }).getContentText()); return (j.items || []).map(function (x) { return { id: String(x.id), title: x.title, maker: x.maker, introduced: x.introduced, apple: x.apple || '' }; }); }
  var sh = SpreadsheetApp.openById(c.spreadsheetId).getSheetByName(c.podcastSheet);
  if (sh.getLastRow() < 2) return [];
  return posuPodcastRowsToList(sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues());
}
// 「朝リスPodcast」の右端（既存17列の後ろ）に、番組ID と交流の状況を書く（既存の列には触れない）
function posuPodcastSummary(values, pubRows, queueRows) {
  var list = posuPodcastRowsToList(values), by = {};
  list.forEach(function (p) { by[p.id] = { intro: [], reply: [], special: [], pending: 0 }; });
  pubRows.forEach(function (r) { var b = by[String(r[1])]; if (!b) return; var t = String(r[3]) + (posuDay(r[5]) ? '（' + posuDay(r[5]) + '）' : ''); if (r[0] === 'INTRO') b.intro.push(t); else if (POSU_REPLY_RELATIONS[r[7]]) b.reply.push(t); else b.special.push(t); });
  queueRows.forEach(function (r) { var b = by[String(r[2])]; if (b && String(r[14]) === POSU_STATE.PENDING) b.pending++; });
  return list.map(function (p) { var b = by[p.id]; return [p.id, b.intro.join('\n'), b.reply.join('\n'), b.special.join('\n'), b.pending ? String(b.pending) : '']; });
}
function posuWritePodcastSummary_(ss, pub, queue) {
  var c = posuCfg(), sh = ss.getSheetByName(c.podcastSheet), last = sh.getLastRow(); if (last < 2) return 0;
  var base = 18, head = sh.getRange(1, base, 1, POSU_PODCAST_EXTRA_H.length).getDisplayValues()[0];
  if (head.join('') && head.join('|') !== POSU_PODCAST_EXTRA_H.join('|')) throw new Error('POSU_SUMMARY_COLUMNS_IN_USE');   // R列以降を別用途で使っていたら止める
  var values = sh.getRange(1, 1, last, Math.max(17, sh.getLastColumn())).getDisplayValues(), rows = [], dataIdx = [];
  values.forEach(function (r, i) { if (i && (r[0] || r[1])) dataIdx.push(i); });
  var sum = posuPodcastSummary(values, pub, queue);
  if (!head.join('')) sh.getRange(1, base, 1, POSU_PODCAST_EXTRA_H.length).setValues([POSU_PODCAST_EXTRA_H]);
  dataIdx.forEach(function (rowIdx, k) { sh.getRange(rowIdx + 1, base, 1, POSU_PODCAST_EXTRA_H.length).setValues([sum[k]]); });
  return dataIdx.length;
}
// 公開用: 承認済みの行を反映してから、公開シートの行と番組一覧を返す（サイトの同期ジョブが読む）。承認は管理人がキューで「承認」にした行だけ
function handlePosukamiPublic_(e, callback) {
  var res;
  try {
    var ap = posuApprove(), c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), intro = { added: 0 };
    try { intro = posuSyncIntros(posuIntroReport()); } catch (err) { intro = { added: 0, error: String(err && err.message || err) }; }   // 紹介された回を毎回照合（#345後続・確定のみ・二重登録しない）
    var pub = posuRows(posuSheet(ss, c.publicSheet, POSU_PUBLIC_H), POSU_PUBLIC_H.length), queue = posuRows(posuSheet(ss, c.queueSheet, POSU_QUEUE_H), POSU_QUEUE_H.length);
    var n = 0; try { n = posuWritePodcastSummary_(ss, pub, queue); } catch (err) { n = -1; }
    res = { ok: true, type: 'posukamiPublic', approved: ap.published || 0, introAdded: intro.added || 0, introError: intro.error || '', podcasts: posuPodcasts().map(function (p) { return { id: p.id, title: p.title }; }), rows: pub, summaryRows: n };
  } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
// 紹介回の候補: 題名に（ポすすめ）か（日曜版）が付く回。ドーナツ開始（2026-08-17）より前の（日曜版）は別の番組名で台帳に入っているため、番組で絞らない
function posuDonutEpisodes() {
  var c = posuCfg(), v = SpreadsheetApp.openById(c.ledgerId).getSheetByName(c.ledgerSheet).getDataRange().getDisplayValues(), h = v[0], ix = {};
  ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '概要（清掃済）', '公式個別URL', '旧元ページURL'].forEach(function (n) { ix[n] = h.indexOf(n); if (ix[n] < 0) throw new Error('POSU_HEADER_MISSING:' + n); });
  return v.slice(1).filter(function (r) { return String(r[ix['EP-ID']]).trim() && posuIsIntroEpisode(r[ix['タイトル']]); }).map(function (r) { return { ep: r[ix['EP-ID']], show: r[ix['番組']], title: r[ix['タイトル']], date: r[ix['配信日時 JST']], status: r[ix['掲載判定']], summary: r[ix['概要（清掃済）']], url: r[ix['公式個別URL']] || r[ix['旧元ページURL']] }; });
}
function posuTaken(queue, pub) { var t = {}, pending = { _total: 0 }; queue.forEach(function (r) { if (String(r[14]) !== POSU_STATE.REJECT) t[r[5]] = true; if (String(r[14]) === POSU_STATE.PENDING) { pending[r[2]] = (pending[r[2]] || 0) + 1; pending._total++; } }); pub.forEach(function (r) { if (r[11]) t[r[11]] = true; }); return { taken: t, pending: pending }; }
var POSU_ERROR_TEXT = { BOT_SUSPECTED: '送信を受け付けられませんでした', UNKNOWN_PODCAST: '番組が見つかりません（ページを再読み込みしてください）', PODCAST_TITLE_MISMATCH: '番組情報が更新されています（ページを再読み込みしてください）', NOT_EPISODE_URL: 'エピソード（回）ごとのURLを入力してください（番組トップのURLは受け付けていません）', BAD_RELATION: '交流の種類を選んでください', TOO_LONG: '文字数が多すぎます', BAD_DATE: '配信日の形が読めません', DUPLICATE: 'この回はすでに受け付け済みか、掲載済みです', TOO_MANY_PENDING: 'この番組の確認待ちが多いため、いまは受け付けを止めています', QUEUE_FULL: '確認待ちが多いため、いまは受け付けを止めています', PAGE_NOT_FOUND: 'そのURLのページを開けませんでした（URLをご確認ください）' };
// 受付（JSONP・GET）。成功したときだけ ok:true と受付ID を返す（サイトは ok を見て「受け付けました」と表示する）
function handlePosukamiSubmit_(e, callback) {
  var p = (e && e.parameter) || {}, res = posuSubmit({ podcastId: p.podcastId, podcastTitle: p.podcastTitle, url: p.url, relation: p.relation, title: p.title, date: p.date, note: p.note, hp: p.website2 });
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
function posuSubmit(sub) {
  var c = posuCfg(), lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, errors: ['BUSY'], message: '混み合っています。少し待ってからもう一度お試しください' };
  try {
    var ss = SpreadsheetApp.openById(c.spreadsheetId), qs = posuSheet(ss, c.queueSheet, POSU_QUEUE_H), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H);
    var queue = posuRows(qs, POSU_QUEUE_H.length), pub = posuRows(ps, POSU_PUBLIC_H.length), tk = posuTaken(queue, pub), podcasts = posuPodcasts();
    var v = posuValidate(sub, podcasts, tk.taken, tk.pending);
    if (!v.ok) return { ok: false, errors: v.errors, message: v.errors.map(function (x) { return POSU_ERROR_TEXT[x] || x; }).join('／') };
    var r = null; try { r = UrlFetchApp.fetch(String(sub.url).trim(), { muteHttpExceptions: true, followRedirects: true }); } catch (err) { r = null; }
    var code = r ? r.getResponseCode() : -1, html = r && code === 200 ? r.getContentText() : '';
    if (code === 404 || code === 410) return { ok: false, errors: ['PAGE_NOT_FOUND'], message: POSU_ERROR_TEXT.PAGE_NOT_FOUND };
    var meta = posuPageMeta(html), hints = posuRelationHints(sub, meta, html, v.podcast), now = new Date().toISOString(), id = 'PK-' + now.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 900 + 100);
    var pageCheck = code === 200 ? (meta.title ? 'ページ確認（題名あり）' : 'ページは開ける（題名は読めない）') : '未確認（HTTP ' + code + '）';
    // 即時公開（管理人 2026-11-20「自分で投稿するようでいい、すぐ投稿するように」）: ページが開けて題名が読めた投稿は、その場で承認にして公開シートへ移す。
    // 開けない・題名が読めない投稿と、1日の上限（POSU_AUTO_DAILY_MAX）を超えた分は、これまでどおり承認待ち。掲載後に外すときは公開シートの行を消す
    var auto = code === 200 && !!meta.title && posuAutoCountToday_(queue, now) < POSU_AUTO_DAILY_MAX;
    qs.appendRow([id, now, String(sub.podcastId), v.podcast.title, String(sub.url).trim(), v.key, sub.relation, String(sub.title || '').trim(), posuDay(sub.date), String(sub.note || '').trim(), meta.title, meta.date, pageCheck, hints, auto ? POSU_STATE.APPROVE : POSU_STATE.PENDING, auto ? '自動承認（ページ確認・題名あり）' : '', ''].map(function (x) { return String(x).replace(/^([=+\-@])/, "'$1"); }));
    SpreadsheetApp.flush();
    var back = posuRows(qs, POSU_QUEUE_H.length).filter(function (row) { return row[0] === id; }).length;   // 読み戻せたときだけ受付完了
    if (back !== 1) return { ok: false, errors: ['NOT_SAVED'], message: '保存を確認できませんでした。もう一度お試しください' };
    if (!auto) return { ok: true, status: 'PENDING', receiptId: id, detectedTitle: meta.title, detectedDate: meta.date, pageCheck: pageCheck, message: '受け付けました。ページの題名を読み取れなかったため、確認のあとにカードへ載ります' };
    lock.releaseLock(); lock = null;
    var ap = posuApprove();
    return { ok: true, status: ap && ap.published ? 'PUBLISHED' : 'APPROVED', receiptId: id, detectedTitle: meta.title, detectedDate: meta.date, pageCheck: pageCheck, message: '受け付けました。30分ほどでカードに載ります' };
  } finally { if (lock) lock.releaseLock(); }
}
var POSU_AUTO_DAILY_MAX = 30;   // 自動承認の1日の上限（いたずら対策。超えた分は承認待ち）
function posuAutoCountToday_(queue, nowIso) { var d = String(nowIso).slice(0, 10); return queue.filter(function (r) { return String(r[1]).slice(0, 10) === d && /^自動承認/.test(String(r[15] || '')); }).length; }
// 一度だけ: 即時公開にする前に「承認待ち」で止まっている投稿のうち、ページ確認（題名あり）のものを承認にして公開シートへ移す（管理人 2026-11-20 承認）
function posuApprove() {
  var c = posuCfg(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var ss = SpreadsheetApp.openById(c.spreadsheetId), qs = posuSheet(ss, c.queueSheet, POSU_QUEUE_H), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H);
    var queue = posuRows(qs, POSU_QUEUE_H.length), pub = posuRows(ps, POSU_PUBLIC_H.length), keys = {}; pub.forEach(function (r) { keys[r[11]] = true; });
    var now = new Date().toISOString(), plan = posuApprovePlan(queue, keys, posuPodcasts(), now);
    if (plan.add.length) ps.getRange(ps.getLastRow() + 1, 1, plan.add.length, POSU_PUBLIC_H.length).setValues(plan.add);
    plan.updates.forEach(function (u) { qs.getRange(u.index + 2, 15, 1, 3).setValues([[u.state, u.memo, u.state === POSU_STATE.DONE ? now : '']]); });
    SpreadsheetApp.flush();
    return { status: 'OK', published: plan.add.length, updated: plan.updates.length };
  } finally { lock.releaseLock(); }
}
// 紹介元の照合（読むだけ）→ 結果を返す。公開シートへの記入は posuSyncIntros（確定分だけ・一度だけ）
function posuIntroReport() { return posuIntroMatch(posuPodcasts(), posuDonutEpisodes()); }
function posuSyncIntros(results) {
  var c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H), pub = posuRows(ps, POSU_PUBLIC_H.length), keys = {}, add = [], now = new Date().toISOString();
  pub.forEach(function (r) { keys[r[11]] = true; });
  results.forEach(function (x) { x.intros.forEach(function (i) { var key = 'INTRO|' + x.id + '|' + i.ep; if (keys[key]) return; keys[key] = true; add.push(['INTRO', x.id, x.title, i.title, i.show || 'ドーナツ', i.date, i.url, '', i.ep, posuDay(now), '照合: ' + i.evidence, key, '']); }); });
  if (add.length) ps.getRange(ps.getLastRow() + 1, 1, add.length, POSU_PUBLIC_H.length).setValues(add);
  return { added: add.length };
}
