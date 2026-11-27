// 01_入口とAPI（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: コード.js, ApiCommon.js, ApiReadHandler.js, SheetData.js, Bunrui.js, HttpFetch.js

// ---- コード.js ----
const SPREADSHEET_ID = "1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ";
const LOG_SHEET_NAME = "投稿受付";
const WORK_SHEET_NAME = "作業台　 ";
const PUBLIC_SHEET_NAME = "サイト公開用";
const PODCAST_SHEET_NAME = "おすすめPodcast";
const LISTENER_PODCAST_SHEET_NAME = "朝リスPodcast";
const SUBMIT_SECURITY_ANSWER = "大介";
function doPost(e) {
  try {
    const input = parsePostInput_(e);
    const data = input.data;
    const url = input.url;
    const title = input.title;
    const maker = input.maker;
    const host = input.host;
    const rss = input.rss;
    const inviteUrl = input.inviteUrl;
    const comment = input.comment;
    const introducedDate = input.introducedDate;
    let artwork = input.artwork;
    const kind = input.kind;
    const securityAnswer = input.securityAnswer;
    const website = input.website;
    const shelf = input.shelf;
    const autoGrow = { show: input.autoShow, keyword: input.autoKeyword };
    let requestId = String(data.requestId || "").trim();

    if (website) return jsonResponse({ ok: true });

    const baseLengthError = validatePostInputLengths_({
      url: url,
      title: title,
      maker: maker,
      host: host,
      rss: rss,
      comment: comment,
      introducedDate: introducedDate,
      artwork: artwork,
      kind: kind,
      securityAnswer: securityAnswer
    });

    if (baseLengthError) {
      return jsonResponse({ ok: false, error: baseLengthError });
    }

    if (kind === "autoUpdateRequest") {
      return handleAutoUpdateRequest_(
        data,
        url,
        title,
        maker,
        securityAnswer
      );
    }

    const basicError = validatePostBasic_(url, title, maker, securityAnswer);

    if (basicError) {
      return jsonResponse({ ok: false, error: basicError });
    }

    if (kind !== "podcast" && kind !== "listenerPodcast") {
      artwork = resolvePostArtwork_(artwork, kind, title);
    }

    const kindError = validatePostKind_(kind);

    if (kindError) {
      return jsonResponse({ ok: false, error: kindError });
    }

    const targetUrlError = validatePostTargetUrl_(kind, url);

    if (targetUrlError) {
      return jsonResponse({
        ok: false,
        error: targetUrlError
      });
    }

    if (kind === "podcast" || kind === "listenerPodcast") {
      if (!requestId) {
        requestId = "legacy_" + Utilities.getUuid().replace(/-/g, "");
        // Legacy clients have no receipt protocol: queue failure must not reject their post.
        try { beginPodcastReceipt_(requestId, kind, url, title); }
        catch (_) { Logger.log("Legacy podcast queue deferred; common blank-cell sweep will retry."); }
      } else {
        beginPodcastReceipt_(requestId, kind, url, title);
      }
    }

    const saved = savePost_(
      url,
      title,
      maker,
      host,
      rss,
      introducedDate,
      comment,
      artwork,
      kind,
      inviteUrl,
      requestId,
      shelf,
      autoGrow
    );
    // 自動育成が指定されたプレイリストは、投稿直後にその1件だけすぐ育てる（失敗しても投稿は成功のまま・毎時でも再試行）
    if (kind === "playlist" && autoGrow.show && typeof libraryPlaylistSyncByUrl_ === "function") {
      try { libraryPlaylistSyncByUrl_(url); } catch (growError) {}
    }
    return saved;

  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}
function doGet(e) {

  if (e && e.parameter && e.parameter.code) {
    return handleSpotifyUserOAuthCallback_(e);
  }

  if (e && e.parameter && e.parameter.error) {
    return HtmlService.createHtmlOutput(
      "<h2>Spotify認証がキャンセルされました</h2>"
    );
  }

  const callback =
    e && e.parameter && e.parameter.callback
      ? String(e.parameter.callback)
      : "";

  try {
    if (!isValidJsonpCallback_(callback)) {
      return jsonResponse({
        ok: false,
        error: "callback名が正しくありません"
      });
    }

    const type =
      e && e.parameter && e.parameter.type
        ? String(e.parameter.type)
        : "status";

    if (type === "status") {
      return apiResponse({
        ok: true,
        service: "asarisunowa-api",
        version: "2026.09.08-resolve12-artwork-persist"
      }, callback);
    }

    if (type === "resolve") {
      return handlePodcastResolve_(e, callback);
    }

    // ポす神回・ポすすめ返し（#312/#315）。Posukami.gs
    if (type === "posukamiSubmit") {
      return handlePosukamiSubmit_(e, callback);
    }

    // 蔵の「わたしの蔵書」をテーマへの推薦として受け付ける（#345）。ShelfSubmit.js・別タブ「蔵書推薦・受付」
    if (type === "shelfSubmit") {
      return handleShelfSubmit_(e, callback);
    }
    if (type === "posukamiPublic") {
      return handlePosukamiPublic_(e, callback);
    }

    // 朝リスみんなで仕分け（迷っている回の分類を集める）。Bunrui.js・別タブ「朝リス分類・投稿」
    if (type === "bunruiSubmit") {
      return handleBunruiSubmit_(e, callback);
    }
    if (type === "bunruiPublic") {
      return handleBunruiPublic_(e, callback);
    }

    if (type === "autoUpdateRequestStatus") {
      return handleAutoUpdateRequestStatus_(e, callback);
    }

    if (type === "podcastRequestStatus") {
      return handlePodcastRequestStatus_(e, callback);
    }

    if (type === "playlistRequestStatus") {
      return handlePlaylistRequestStatus_(e, callback);
    }

    if (type === "playlistResolve") {
      return handlePlaylistResolve_(e, callback);
    }

    const readResponse = handleApiRead_(type, callback);

    if (readResponse) {
      return readResponse;
    }

    return apiResponse({
      ok: false,
      error:
        "type は playlist / podcast / listenerPodcast / resolve を指定してください"
    }, callback);

  } catch (error) {
    return apiResponse({
      ok: false,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    }, callback);
  }
}

// ---- ApiCommon.js ----
function normalizeUrl(url) {
  const clean = String(url || "").trim().replace(/#.*$/, "");
  const parts = clean.split("?");
  const base = String(parts.shift() || "").replace(/\/+$/, "");
  const query = parts.join("?");

  if (!query) {
    return base;


function launchSatoYoOnsaEpisodesIndividual(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw new Error("Another update is running");
 try{
  const token=getSpotifyUserAccessToken();
  const plan=buildSatoYoOnsaLaunchPlan_(token);
  if(!plan.safeToRun)throw new Error("Safety stop: "+plan.reason);
  const episodes=plan.missingUris.map(function(uri){return {uri:uri,name:uri};});
  const addResult=addAutoPlaylistEpisodesIndividually_({playlistId:SATOYO_LAUNCH_.playlistId},token,episodes);
  const after=buildSatoYoOnsaLaunchPlan_(token);
  if(after.missingCount!==0||after.unexpectedUris.length||after.duplicateUris.length)throw new Error("Post-check failed: "+JSON.stringify({addResult:addResult,after:after}));
  updatePlaylistLatestDate_(SATOYO_LAUNCH_.playlistId);
  const result={ok:true,spotifyAddedCount:plan.missingCount,expectedCount:14};
  Logger.log(JSON.stringify(result));
  return result;
 }finally{lock.releaseLock();}
}
  }

  // Spotify等の共有用クエリは同一URL判定には不要だが、
  // YouTube / YouTube Music は list / v がコンテンツ識別子なので残す。
  if (/youtube\.com|youtu\.be/i.test(base)) {
    const keep = query
      .split("&")
      .filter(Boolean)
      .filter(function(part) {
        const key = String(part.split("=")[0] || "").toLowerCase();
        return key === "list" || key === "v";
      })
      .sort();

    return keep.length
      ? base + "?" + keep.join("&")
      : base;
  }

  return base;
}
function normalizeTitle(title) {
  return String(
    title || ""
  )
    .toLowerCase()
    .replace(
      /[\s　・･\-—–_()（）「」『』【】\[\]！!？?：:]/g,
      ""
    )
    .trim();
}
function isValidJsonpCallback_(callback) {
  return !callback || /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback);
}
function jsonResponse(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        payload
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}
function apiResponse(payload, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(
        callback +
        "(" +
        JSON.stringify(
          payload
        ) +
        ");"
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return jsonResponse(
    payload
  );
}

// ---- ApiReadHandler.js ----
function handleApiRead_(type, callback) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (type === "playlist") {
    const sheet = getSheetLoose(ss, PUBLIC_SHEET_NAME);

    if (!sheet) {
      throw new Error("サイト公開用シートが見つかりません");
    }

    return apiResponse(readPlaylistSheet(sheet), callback);
  }

  if (type === "listenerPodcast") {
    const sheet = getSheetLoose(ss, LISTENER_PODCAST_SHEET_NAME);

    if (!sheet) {
      throw new Error("朝リスPodcastシートが見つかりません");
    }

    return apiResponse(readListenerPodcastSheet(sheet), callback);
  }

  if (type === "podcast") {
    const sheet = getSheetLoose(ss, PODCAST_SHEET_NAME);

    if (!sheet) {
      throw new Error("おすすめPodcastシートが見つかりません");
    }

    return apiResponse(readPodcastSheet(sheet), callback);
  }

  return null;
}

// ---- SheetData.js ----
function findPodcastDuplicate(sheet, url, title) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        Math.max(
          2,
          sheet.getLastColumn()
        )
      )
      .getDisplayValues();

  const wantedUrl =
    normalizeUrl(url);

  const wantedTitle =
    normalizeTitle(title);

  for (
    let i = 0;
    i < values.length;
    i++
  ) {
    const rowUrl =
      normalizeUrl(
        values[i][0] || ""
      );

    const rowTitle =
      normalizeTitle(
        values[i][1] || ""
      );

    const urlMatch =
      !!wantedUrl &&
      rowUrl === wantedUrl;

    const titleMatch =
      !!wantedTitle &&
      rowTitle === wantedTitle;

    if (
      urlMatch ||
      titleMatch
    ) {
      return {
        id:
          String(i + 1)
            .padStart(2, "0"),

        title:
          String(
            values[i][1] || ""
          ).trim(),

        maker:
          String(
            values[i][2] || ""
          ).trim(),

        host:
          String(
            values[i][6] || ""
          ).trim(),

        urlMatch:
          urlMatch,

        titleMatch:
          titleMatch
      };
    }
  }

  return null;
}
function playlistIdForPublicRead_(url) {
  const match = String(url || "").match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  return match ? match[1] : "";
}

// Form-submitted playlists become 🌱 only after bootstrap has finished and the
// matching application row confirms incremental updates. Fixed rules keep their
// existing eligibility policy; a stale runtime rule cannot change their badge.
function isAutoUpdateRuntimeRuleGrowingV1_(rule, requestRows) {
  if (
    !rule ||
    rule.enabled === false ||
    rule.productionWriteAllowed !== true
  ) {
    return false;
  }

  const lifecycle =
    String(rule.lifecycleStatus || "")
      .trim()
      .toLowerCase();

  const bootstrapActive =
    rule.bootstrapPending === true;

  const incrementalActive =
    rule.bootstrapPending === false &&
    lifecycle === "incremental";

  if (
    !bootstrapActive &&
    !incrementalActive
  ) {
    return false;
  }

  const rowNumber =
    Number(rule.requestSheetRow);

  const rows =
    Array.isArray(requestRows)
      ? requestRows
      : [];

  if (
    !Number.isInteger(rowNumber) ||
    rowNumber < 2 ||
    rowNumber > rows.length + 1
  ) {
    return false;
  }

  const row =
    rows[rowNumber - 2];

  const status =
    String(row[7] || "").trim();

  const requestActive =
    status === "増分自動更新" ||
    (
      bootstrapActive &&
      status === "初回補完中"
    );

  return (
    playlistIdForPublicRead_(row[1]) ===
      String(rule.playlistId || "").trim() &&
    requestActive
  );
}
function readAutoManagedPlaylistIdMap_(ss) {
  const result = {};
  // Preserve existing handling of explicitly configured, fixed playlists.
  if (typeof AUTO_PLAYLIST_RULES !== "undefined" && Array.isArray(AUTO_PLAYLIST_RULES)) {
    AUTO_PLAYLIST_RULES.forEach(function(rule) {
      if (!rule || rule.enabled === false || rule.productionWriteAllowed === false) return;
      const lifecycle = String(rule.lifecycleStatus || "").trim().toLowerCase();
      if (["requested", "audit", "paused"].indexOf(lifecycle) >= 0) return;
      const playlistId = String(rule.playlistId || "").trim();
      if (playlistId) result[playlistId] = true;
    });
  }
  // 蔵から育てるプレイリスト（LibraryPlaylist.js）も、書込スイッチがONなら「楽育ち」
  // 蔵から育てるプレイリスト（LibraryPlaylist.js）は、直近の同期で実際に育っていると確認できたものだけ「楽育ち」
  if (typeof libraryPlaylistGrowingIds_ === "function" &&
      PropertiesService.getScriptProperties().getProperty("LIBRARY_PLAYLIST_WRITE") === "ON") {
    Object.keys(libraryPlaylistGrowingIds_()).forEach(function(id) { result[id] = true; });
  }
  const runtimeRules = typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_() : [];
  if (!runtimeRules.length) return result;
  const requestSheet = getSheetLoose(ss, AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!requestSheet) return result; // Fail closed for new submissions.
  const lastRow = requestSheet.getLastRow();
  const requestRows = lastRow >= 2
    ? requestSheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues() : [];
  runtimeRules.forEach(function(rule) {
    if (isAutoUpdateRuntimeRuleGrowingV1_(rule, requestRows)) {
      result[String(rule.playlistId).trim()] = true;
    }
  });
  return result;
}
function readPlaylistSheet(sheet) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      type: "playlist",
      count: 0,
      items: []
    };
  }

  // サイト公開用: A=URL, B=タイトル, C=制作者, D=最終更新日, E=新規登録日, F=更新日取得状況, G=掲載先（作業台I列）。
  // 「楽育ち」は更新日の取得方法ではなく、実際に有効な自動更新ルールだけを示す。
  const autoManagedPlaylistIds = readAutoManagedPlaylistIdMap_(sheet.getParent());
  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        Math.min(7, Math.max(5, sheet.getLastColumn()))
      )
      .getDisplayValues();

  let items =
    values
      .filter(
        r => {
          const url = String(r[0] || "").trim();
          const title = String(r[1] || "").trim();
          if (!url && !title) return false;
          if (/\bTEST\b/i.test(url) || /^[\s\u3000]*[【\[]?TEST[】\]]?/i.test(title)) return false;
          return true;
        }
      )
      ;
  // 表紙・最終新着は保存値（各リスト1日1回ほど Spotify から取り直す・閲覧時は呼ばない #412）。無ければシートの値のまま
  let liveMeta = {};
  try {
    if (typeof playlistLiveMeta_ === "function") liveMeta = playlistLiveMeta_(items.map(function(r) { return playlistIdForPublicRead_(r[0]); }));
  } catch (error) { liveMeta = {}; }
  items = items
      .map(
        (r, i) => {
          const playlistId = playlistIdForPublicRead_(r[0]);
          const live = liveMeta[playlistId] || {};
          return ({
          id:
            String(i + 1),
          url:
            r[0] || "",
          title:
            r[1] || "",
          maker:
            r[2] || "",
          latestDate:
            live.latestDate && (!r[3] || live.latestDate > r[3]) ? live.latestDate : (r[3] || ""),
          artwork:
            live.artwork || "",
          introducedDate:
            r[4] || "",
          autoManaged:
            autoManagedPlaylistIds[playlistId] === true,
          shelf:
            playlistShelfKey_(r[6])
          });
        }
      );

  return {
    ok: true,
    type: "playlist",
    count:
      items.length,
    items:
      items
  };
}
function readListenerPodcastSheet(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      type: "listenerPodcast",
      count: 0,
      items: []
    };
  }

  // 番組ID（#315）: 18列目の見出しが「番組ID」なら、その値を ID に使う（行の並びが変わっても ID がずれない）。無ければ従来どおり並び順
  const lastCol = Math.max(17, sheet.getLastColumn());
  const idCol = lastCol >= 18 && String(sheet.getRange(1, 18).getDisplayValue()).trim() === "番組ID" ? 17 : -1;
  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        idCol >= 0 ? 18 : 17
      )
      .getDisplayValues();

  const items =
    values
      .filter(r => r[0] || r[1])
      .map((r, i) => ({
        id: String((idCol >= 0 && String(r[idCol]).trim()) || (i + 1)),
        url: r[0] || "",
        title: r[1] || "",
        maker: r[2] || "",
        introduced: r[3] || "",
        comment: r[4] || "",
        spotify: r[5] || "",
        apple: r[6] || "",
        listen: r[7] || "",
        standfm: r[8] || "",
        amazon: r[9] || "",
        youtube: r[10] || "",
        website: r[11] || "",
        artwork: r[12] || "",
        pocketcasts: r[14] || "",
        pody: r[15] || "",
        genre: r[16] || ""
      }));

  return {
    ok: true,
    type: "listenerPodcast",
    count: items.length,
    items: items
  };
}
function readPodcastSheet(sheet) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return {
      ok: true,
      type: "podcast",
      count: 0,
      items: []
    };
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        18
      )
      .getDisplayValues();

  const items =
    values
      .filter(
        r =>
          r[0] ||
          r[1]
      )
      .map(
        (r, i) => ({
          id:
            String(i + 1),
          url:
            r[0] || "",
          title:
            r[1] || "",
          maker:
            r[2] || "",
          receivedAt:
            r[3] || "",
          comment:
            r[4] || "",
          artwork:
            r[5] || "",
          host:
            r[6] || "",
          youtube:
            r[8] || "",
          spotify:
            r[9] || "",
          amazon:
            r[10] || "",
          apple:
            r[11] || "",
          pocketcasts:
            r[12] || "",
          listen:
            r[13] || "",
          standfm:
            r[14] || "",
          pody:
            r[15] || "",
          website:
            r[16] || "",
          genre:
            r[17] || ""
        })
      );

  return {
    ok: true,
    type: "podcast",
    count:
      items.length,
    items:
      items
  };
}
function getSheetLoose(ss, wanted) {
  const exact =
    ss.getSheetByName(
      wanted
    );

  if (exact) {
    return exact;
  }

  const target =
    String(
      wanted || ""
    ).trim();

  const sheets =
    ss.getSheets();

  for (
    let i = 0;
    i < sheets.length;
    i++
  ) {
    if (
      String(
        sheets[i].getName()
      ).trim() === target
    ) {
      return sheets[i];
    }
  }

  return null;
}

// ---- Bunrui.js ----
var BUNRUI_SHEET_ = '朝リス分類・投稿';
var BUNRUI_H_ = ['受付ID', '受付日時', 'EP-ID', '主分類', '副分類', '小テーマ', 'ひとこと', 'ニックネーム', '聞いた', '端末', '状態', 'メモ'];
var BUNRUI_CATS_ = ['政治・行政', '国際・外交', '経済・金融', '仕事・労働', '社会・人権', '法律・司法', 'ジェンダー', '福祉・介護', '健康・医療', '科学', 'AI・技術', '環境・気候', '動物・自然', '防災', '教育', 'メディア', '文化・芸術', '暮らし・生活', 'スポーツ', '歴史・宗教'];
var BUNRUI_UNSURE_ = 'わからない';
var BUNRUI_LISTENED_ = ['全部聞いた', '一部聞いた', '聞いていない'];
var BUNRUI_DAILY_MAX_ = 3000;        // 1日の受付の上限（全体）
var BUNRUI_DEVICE_DAILY_MAX_ = 300;  // 1台の端末の1日の上限
var BUNRUI_EXCLUDED_ = '除外';        // 管理人が「状態」をこれにした行は数えない

// 純粋: 投稿の形を確かめる（受け付けるか・どう保存するか）
function bunruiValidate_(p) {
  var errors = [], s = function (v) { return String(v == null ? '' : v).trim(); };
  var ep = s(p.ep), main = s(p.main), sub = s(p.sub), theme = s(p.theme), note = s(p.note), nick = s(p.nick), listened = s(p.listened), device = s(p.device);
  if (s(p.hp)) errors.push('BOT');
  if (!/^EP-\d{5}$/.test(ep)) errors.push('EP');
  if (main !== BUNRUI_UNSURE_ && BUNRUI_CATS_.indexOf(main) < 0) errors.push('MAIN');
  if (sub && (BUNRUI_CATS_.indexOf(sub) < 0 || sub === main)) errors.push('SUB');
  if (theme.length > 30) errors.push('THEME');
  if (note.length > 300) errors.push('NOTE');
  if (nick.length > 30) errors.push('NICK');
  if (listened && BUNRUI_LISTENED_.indexOf(listened) < 0) errors.push('LISTENED');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(device)) errors.push('DEVICE');
  if (/https?:\/\//i.test(note + nick + theme) && /(bit\.ly|t\.co|discord\.gg)/i.test(note + nick)) errors.push('LINK');
  return { ok: !errors.length, errors: errors, row: { ep: ep, main: main, sub: main === BUNRUI_UNSURE_ ? '' : sub, theme: theme, note: note, nick: nick, listened: listened, device: device } };
}

// 純粋: 受付の行 → 回ごとの票（同じ端末・同じ回は最後の1件だけ。除外行は数えない）
function bunruiTally_(rows) {
  var latest = {};
  (rows || []).forEach(function (r) {
    if (String(r[10] || '') === BUNRUI_EXCLUDED_) return;
    var ep = String(r[2] || ''), dev = String(r[9] || ''); if (!ep || !dev) return;
    latest[ep + '|' + dev] = r;
  });
  var out = {};
  Object.keys(latest).forEach(function (k) {
    var r = latest[k], ep = String(r[2]), o = out[ep] || (out[ep] = { n: 0, main: {}, sub: {}, unsure: 0 });
    o.n++;
    var m = String(r[3] || ''); if (m === BUNRUI_UNSURE_) o.unsure++; else if (m) o.main[m] = (o.main[m] || 0) + 1;
    var sb = String(r[4] || ''); if (sb) o.sub[sb] = (o.sub[sb] || 0) + 1;
  });
  return out;
}
var BUNRUI_ERROR_TEXT_ = { BOT: '送信できませんでした', EP: '回の番号が正しくありません', MAIN: '主分類を選んでください', SUB: '副分類は主分類と別のものを選んでください', THEME: '小テーマは30字までです', NOTE: 'ひとことは300字までです', NICK: 'ニックネームは30字までです', LISTENED: '「聞いた」の選び方が正しくありません', DEVICE: 'ページを読み込み直してからお試しください', LINK: '短縮URL・招待リンクは書けません', DAILY: '今日の受付の上限に達しました。明日またお願いします', BUSY: '混み合っています。少し待ってからもう一度お試しください', NOT_SAVED: '保存を確認できませんでした。もう一度お試しください' };
function bunruiSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), sh = ss.getSheetByName(BUNRUI_SHEET_);
  if (!sh) { sh = ss.insertSheet(BUNRUI_SHEET_); sh.getRange(1, 1, 1, BUNRUI_H_.length).setValues([BUNRUI_H_]); sh.setFrozenRows(1); }
  return sh;
}
function bunruiRows_(sh) { var n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, BUNRUI_H_.length).getDisplayValues() : []; }
// 端末IDはそのまま保存しない（ハッシュの先頭だけ）
function bunruiDeviceKey_(device) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'bunrui:' + device, Utilities.Charset.UTF_8);
  return b.slice(0, 8).map(function (x) { return ((x + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
function bunruiSubmit_(p) {
  var v = bunruiValidate_(p);
  if (!v.ok) return { ok: false, errors: v.errors, message: v.errors.map(function (e) { return BUNRUI_ERROR_TEXT_[e] || e; }).join('／') };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, errors: ['BUSY'], message: BUNRUI_ERROR_TEXT_.BUSY };
  try {
    var sh = bunruiSheet_(), rows = bunruiRows_(sh), now = new Date().toISOString(), day = now.slice(0, 10), dev = bunruiDeviceKey_(v.row.device);
    var today = rows.filter(function (r) { return String(r[1]).slice(0, 10) === day; });
    if (today.length >= BUNRUI_DAILY_MAX_ || today.filter(function (r) { return r[9] === dev; }).length >= BUNRUI_DEVICE_DAILY_MAX_) return { ok: false, errors: ['DAILY'], message: BUNRUI_ERROR_TEXT_.DAILY };
    var id = 'BR-' + now.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 9000 + 1000);
    var r = v.row;
    sh.appendRow([id, now, r.ep, r.main, r.sub, r.theme, r.note, r.nick, r.listened, dev, '', '']);
    SpreadsheetApp.flush();
    var back = bunruiRows_(sh).filter(function (x) { return x[0] === id; }).length;
    if (back !== 1) return { ok: false, errors: ['NOT_SAVED'], message: BUNRUI_ERROR_TEXT_.NOT_SAVED };
    var tally = bunruiTally_(bunruiRows_(sh))[r.ep] || { n: 0, main: {}, sub: {}, unsure: 0 };
    return { ok: true, receiptId: id, ep: r.ep, tally: tally, message: '受け付けました。ありがとうございます！' };
  } finally { lock.releaseLock(); }
}
function handleBunruiSubmit_(e, callback) {
  var p = (e && e.parameter) || {};
  var res = bunruiSubmit_({ ep: p.ep, main: p.main, sub: p.sub, theme: p.theme, note: p.note, nick: p.nick, listened: p.listened, device: p.device, hp: p.website2 });
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
function handleBunruiPublic_(e, callback) {
  var res;
  try {
    var rows = bunruiRows_(bunruiSheet_()), t = bunruiTally_(rows), devs = {};
    rows.forEach(function (r) { if (String(r[10] || '') !== BUNRUI_EXCLUDED_ && r[9]) devs[r[9]] = 1; });
    res = { ok: true, type: 'bunruiPublic', generatedAt: new Date().toISOString(), episodes: Object.keys(t).length, contributors: Object.keys(devs).length, votes: t };
  } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}

// ---- HttpFetch.js ----
function fetchJson(url) {
  try {
    const res =
      fetchPodcastPlatformResource_(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return null;
    }

    return JSON.parse(
      res.getContentText()
    );

  } catch (_) {
    return null;
  }
}
function fetchText(url) {
  try {
    const res =
      fetchPodcastPlatformResource_(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return "";
    }

    return res.getContentText();

  } catch (_) {
    return "";
  }
}
