// 08_プレイリストの情報（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: PlaylistJstDate.js, PlaylistDates.js, PlaylistLiveMeta.js, PlaylistResolve.js, PlaylistSpecial.js, Test.js

// ---- PlaylistJstDate.js ----
var PJD_INDEX_ = null;
function pjdNorm_(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }
function pjdAddDay_(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

// 純粋: 蔵 lite 行 [id, 番組番号, 日時, 題名, …] → 題名ごとの配信日（日本時間）
function pjdIndex_(liteRows) {
  var idx = {};
  (liteRows || []).forEach(function (r) { var k = pjdNorm_(r && r[3]); if (k) (idx[k] = idx[k] || []).push(String(r[2]).slice(0, 10)); });
  return idx;
}

// 純粋: Spotify の回 {name, release_date} → 日本時間の配信日
function pjdJstDate_(ep, idx) {
  var rd = String(ep && (ep.release_date || ep.date) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rd)) return rd;
  var next = pjdAddDay_(rd, 1), hits = ((idx || {})[pjdNorm_(ep && ep.name)] || []).filter(function (d) { return d === rd || d === next; });
  return hits.length ? hits.sort().pop() : rd;
}
function pjdLibraryIndex_() {
  if (PJD_INDEX_) return PJD_INDEX_;
  try {
    var m = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json');
    PJD_INDEX_ = pjdIndex_(libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + m.searchIndex.lite));
  } catch (e) { PJD_INDEX_ = {}; }
  return PJD_INDEX_;
}

// 回の配列を日本時間の配信日つきにする（release_date を置き換えた写し）
function pjdWithJstDates_(episodes) {
  var idx = (episodes || []).length ? pjdLibraryIndex_() : {};
  return (episodes || []).map(function (ep) { if (!ep) return ep; var c = {}; Object.keys(ep).forEach(function (k) { c[k] = ep[k]; }); c.release_date = pjdJstDate_(ep, idx); return c; });
}

// ---- PlaylistDates.js ----
function updatePlaylistLatestDates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheets().find(function(s) {
    return String(s.getName()).trim() === "作業台";
  });

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const values = sheet.getDataRange().getValues();

  const headers = values[0].map(function(v) {
    return String(v || "").trim();
  });

  const urlCol = headers.indexOf("Spotifyプレイリストのリンク");
  const titleCol = headers.indexOf("公開プレイリスト");
  const profileCol = headers.indexOf("プロフィール");
  const latestCol = headers.indexOf("最終更新日");

  if (
    urlCol < 0 ||
    titleCol < 0 ||
    profileCol < 0 ||
    latestCol < 0
  ) {
    throw new Error("必要な列見出しが見つかりません");
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できません");
  }

  for (let i = 1; i < values.length; i++) {
    const url = String(values[i][urlCol] || "").trim();
    const title = String(values[i][titleCol] || "").trim();
    const profile = String(values[i][profileCol] || "").trim();

    // NEYITO管理プレイリストだけ自動更新
   const collaboratorUrl = String(values[i][3] || "").trim();

const shouldTry =
  profile.toUpperCase() === "NEYITO" ||
  Boolean(collaboratorUrl);

if (!shouldTry) {
  continue;
}

    if (!url || !/open\.spotify\.com\/playlist\//i.test(url)) {
      continue;
    }

    const match = url.match(
      /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i
    );

    if (!match) continue;

    const playlistId = match[1];

    try {
      const items = getAllSpotifyPlaylistItems_(playlistId, token);

      let latestReleaseDate = "";

      items.forEach(function(row) {
        const releaseDate =
          row && row.item && row.item.release_date
            ? String(row.item.release_date)
            : "";

        if (
          releaseDate &&
          (!latestReleaseDate || releaseDate > latestReleaseDate)
        ) {
          latestReleaseDate = releaseDate;
        }
      });

      const latestDate =
        latestReleaseDate
          ? latestReleaseDate.slice(0, 10)
          : "";

      if (latestDate) {
  // F列：最終更新日
  sheet
    .getRange(i + 1, latestCol + 1)
    .setValue(latestDate);

  // 現行見出し「更新日取得状況」を優先し、旧見出しにも互換対応する。
  const methodCol = findPlaylistUpdateStatusColumn_(headers);

  if (methodCol >= 0) {
    sheet
      .getRange(i + 1, methodCol + 1)
      .setValue("AUTO");
  }
        Logger.log(
          "更新 ✅ " +
          title +
          " → " +
          latestDate
        );
      } else {
        Logger.log(
          "日付取得できず: " + title
        );
      }

    } catch (err) {
      Logger.log(
        "スキップ: " +
        title +
        " | " +
        String(err)
      );
    }
  }

  Logger.log("最終更新日の書き込み完了");
}
function findPlaylistUpdateStatusColumn_(headers) {
  const current = headers.indexOf("更新日取得状況");
  return current >= 0 ? current : headers.indexOf("更新日取得方法");
}
function updatePlaylistLatestDate_(playlistId, releaseDate) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 更新元は「作業台」
  const sheet = getSheetLoose(ss, "作業台");

  if (!sheet) {
    throw new Error("作業台シートが見つかりません");
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error("作業台シートにデータがありません");
  }

  // 作業台 A〜F列を取得
  const values = sheet
    .getRange(2, 1, lastRow - 1, 6)
    .getDisplayValues();

  // A列のSpotifyプレイリストURLから対象を探す
  const targetRowIndex = values.findIndex(function(row) {
    const url = String(row[0] || "");
    return url.indexOf(playlistId) >= 0;
  });

  if (targetRowIndex < 0) {
    throw new Error(
      "対象プレイリストが作業台に見つかりません: " +
      playlistId
    );
  }

  const rowNumber = targetRowIndex + 2;

  const latestDate =
    String(releaseDate || "").trim() ||
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  // 作業台 F列 = 最終更新日
  // QUERY列で文字列扱いされると公開側で空欄になるため、実日付として保存する。
  const latestDateValue = new Date(latestDate + "T00:00:00");
  if (isNaN(latestDateValue.getTime())) {
    throw new Error("最終更新日が不正です: " + latestDate);
  }
  sheet.getRange(rowNumber, 6)
    .setValue(latestDateValue)
    .setNumberFormat("yyyy-mm-dd");

  Logger.log(
    "更新日反映 ✅ 作業台 row=" +
    rowNumber +
    " date=" +
    latestDate
  );
}

// ---- PlaylistLiveMeta.js ----
function plmToken_() {
  try { return typeof getSpotifyUserAccessToken === 'function' ? getSpotifyUserAccessToken() : ''; } catch (e) { return ''; }
}
function plmHeaders_(token) { return { Authorization: 'Bearer ' + token, Accept: 'application/json' }; }
// 一度に大量に送らないよう、5件ずつ・1秒空けて送る（#412）
function plmFetchChunked_(reqs) {
  // 返り値は reqs と同じ長さ。Spotify に 429 で止められたら以降は送らず null を入れる（待機を記録）
  var out = [], stopped = false;
  for (var i = 0; i < reqs.length; i += 5) {
    var chunk = reqs.slice(i, i + 5);
    if (stopped) { chunk.forEach(function () { out.push(null); }); continue; }
    if (i) Utilities.sleep(1000);
    var rs = UrlFetchApp.fetchAll(chunk);
    rs.forEach(function (r) { if (typeof spotifyCooldownNote_ === 'function' && spotifyCooldownNote_(r, 'PlaylistLiveMeta')) stopped = true; });
    out = out.concat(rs);
  }
  return out;
}
function plmOk_(r) { return !!(r && r.getResponseCode() === 200); }

// 純粋: 末尾の項目から一番新しい公開日（YYYY-MM-DD）
function plmLatestFromItems_(items) {
  var best = '';
  (items || []).forEach(function (it) {
    var x = it && (it.item || it.track), d = String(x && x.release_date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > best) best = d;
  });
  return best;
}
// 純粋: 画像（一番大きいもの）
function plmArtwork_(images) {
  var list = (images || []).filter(function (i) { return i && i.url; });
  list.sort(function (a, b) { return (Number(b.width) || 0) - (Number(a.width) || 0); });
  return list.length ? String(list[0].url) : '';
}

// 純粋: 埋め込みページ（open.spotify.com/embed/playlist/ID）の HTML → エピソードID（並び順）
// 他人のプレイリストは API で中身を読めない（Spotify の制限）ため、公開の埋め込みページから回の一覧を取る
function plmEmbedEpisodeIds_(html) {
  var m = String(html || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  try {
    var e = JSON.parse(m[1]).props.pageProps.state.data.entity;
    return (e.trackList || []).map(function (t) { var x = String(t && t.uri || '').match(/^spotify:episode:([A-Za-z0-9]{22})$/); return x ? x[1] : ''; }).filter(Boolean);
  } catch (err) { return []; }
}
var PLM_EMBED_TAIL_ = 3;     // 末尾の何回分の公開日を見るか
var PLM_EP_KEY_ = 'plmEp:';  // 回の公開日は変わらないので6時間キャッシュ

// 埋め込みページ経由の最終新着（id の配列 → { id: 'YYYY-MM-DD' }）
function plmLatestViaEmbed_(ids, token) {
  var out = {}; if (!ids.length) return out;
  var pages = plmFetchChunked_(ids.map(function (id) { return { url: 'https://open.spotify.com/embed/playlist/' + id, muteHttpExceptions: true, followRedirects: true }; }));
  var tails = {}, need = {};
  ids.forEach(function (id, i) {
    if (!plmOk_(pages[i])) return;
    var eps = plmEmbedEpisodeIds_(pages[i].getContentText()).slice(-PLM_EMBED_TAIL_);
    tails[id] = eps; eps.forEach(function (e) { need[e] = true; });
  });
  var epIds = Object.keys(need); if (!epIds.length) return out;
  var cache = CacheService.getScriptCache(), dates = {}, got = cache.getAll(epIds.map(function (e) { return PLM_EP_KEY_ + e; })) || {}, miss = [];
  epIds.forEach(function (e) { var v = got[PLM_EP_KEY_ + e]; if (v) dates[e] = v; else miss.push(e); });
  if (miss.length) {
    var rs = plmFetchChunked_(miss.map(function (e) { return { url: 'https://api.spotify.com/v1/episodes/' + e + '?market=JP', headers: plmHeaders_(token), muteHttpExceptions: true }; }));
    var put = {};
    miss.forEach(function (e, i) {
      if (!plmOk_(rs[i])) return;
      var d = String(JSON.parse(rs[i].getContentText()).release_date || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { dates[e] = d; put[PLM_EP_KEY_ + e] = d; }
    });
    if (Object.keys(put).length) cache.putAll(put, 21600);
  }
  Object.keys(tails).forEach(function (id) {
    var best = ''; tails[id].forEach(function (e) { if (dates[e] && dates[e] > best) best = dates[e]; });
    if (best) out[id] = best;
  });
  return out;
}

// 2026-11-20 #412（管理人「表紙を定期的に取得する必要はない」）:
// ・取得結果はスクリプトプロパティ（plm4:ID）に保存する。閲覧時（doGet）は保存値を返すだけで Spotify を呼ばない。
// ・表紙の定期巡回はしない。Spotify に問い合わせるのは次の時だけ:
//   1) 新しく登録されたリスト（保存値が無いもの）を1回だけ取る（毎時の自動更新から、1回に PLM_NEW_PER_RUN_ 件まで）
//   2) 管理人が Spotify で表紙を変えた時、依頼を受けて該当リストだけ取り直す（plmRefreshCoverOne_）
// ・最終新着日は表紙と別に扱う。自動更新が回を追加した時、その回の配信日から更新する（Spotify に問い合わせない・plmNoteAdded_）
var PLM_STORE_ = 'plm4:';
var PLM_NEW_PER_RUN_ = 4;

// 純粋: 保存値の無い（新しく登録された）リストだけを選ぶ。重複・形の違うIDは除く
function plmPickNew_(ids, stored, limit) {
  var seen = {};
  return (ids || []).filter(function (id) {
    if (seen[id] || !/^[A-Za-z0-9]{22}$/.test(id)) return false;
    seen[id] = true; return !stored[id];
  }).slice(0, limit);
}

// 純粋: 追加した回の配信日から、新しい最終新着日を求める（今より新しい時だけ返す。無ければ ''）
function plmLatestAfterAdd_(current, episodes) {
  var best = String(current || '');
  (episodes || []).forEach(function (ep) {
    var d = String(ep && (ep.release_date || ep.date) || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > best) best = d;
  });
  return best > String(current || '') ? best : '';
}
function plmStoredAll_() {
  var all = PropertiesService.getScriptProperties().getProperties(), out = {};
  Object.keys(all).forEach(function (k) { if (k.indexOf(PLM_STORE_) === 0) { try { out[k.slice(PLM_STORE_.length)] = JSON.parse(all[k]); } catch (e) {} } });
  return out;
}

// プレイリストID の配列 → { id: { artwork, latestDate } }（保存値のみ。Spotify は呼ばない）
function playlistLiveMeta_(ids) {
  var stored = plmStoredAll_(), out = {};
  (ids || []).forEach(function (id) { var v = stored[id]; if (v) out[id] = { artwork: v.artwork || '', latestDate: v.latestDate || '' }; });
  return out;
}

// 指定したリストだけ Spotify から取り直して保存する（呼ぶのは playlistLiveMetaWarm_ のみ）
function plmRefresh_(ids) {
  if (!ids.length) return {};
  if (typeof spotifyAnyCooldown_ === 'function' && spotifyAnyCooldown_()) return {};
  var token = plmToken_(); if (!token) return {};
  var base = 'https://api.spotify.com/v1/playlists/';
  // 1回目: 画像と総数
  var r1 = plmFetchChunked_(ids.map(function (id) { return { url: base + id + '?market=JP&fields=images,tracks.total,items.total', headers: plmHeaders_(token), muteHttpExceptions: true }; }));
  var head = {}, second = [];
  ids.forEach(function (id, i) {
    if (!plmOk_(r1[i])) return;
    var j = JSON.parse(r1[i].getContentText()), total = Number((j.items && j.items.total) || (j.tracks && j.tracks.total) || 0);
    head[id] = { artwork: plmArtwork_(j.images), total: total };
    if (total > 0) second.push(id);
  });
  // 2回目: 末尾50件の公開日
  var r2 = second.length ? plmFetchChunked_(second.map(function (id) {
    return { url: base + id + '/items?market=JP&limit=50&offset=' + Math.max(0, head[id].total - 50), headers: plmHeaders_(token), muteHttpExceptions: true };
  })) : [];
  var latest = {};
  second.forEach(function (id, i) { if (plmOk_(r2[i])) latest[id] = plmLatestFromItems_(JSON.parse(r2[i].getContentText()).items); });
  // API で中身を読めなかったもの（他人のプレイリスト）は埋め込みページ経由で
  var noLatest = Object.keys(head).filter(function (id) { return !latest[id]; });
  try { var viaEmbed = plmLatestViaEmbed_(noLatest, token); Object.keys(viaEmbed).forEach(function (id) { latest[id] = viaEmbed[id]; }); } catch (err) {}
  var props = PropertiesService.getScriptProperties(), put = {}, out = {}, now = new Date().toISOString();
  Object.keys(head).forEach(function (id) {
    out[id] = { artwork: head[id].artwork, latestDate: latest[id] || '' };
    put[PLM_STORE_ + id] = JSON.stringify({ artwork: out[id].artwork, latestDate: out[id].latestDate, at: now });
  });
  if (Object.keys(put).length) props.setProperties(put);
  return out;
}

// 切り替え時だけ: 旧キャッシュ（plm3:）に残っている値を保存値へ移す（表紙が一時的に消えないように）。Spotify は呼ばない
function plmMigrateFromCache_(ids, stored) {
  var need = ids.filter(function (id) { return !stored[id]; });
  if (!need.length) return 0;
  var got = CacheService.getScriptCache().getAll(need.map(function (id) { return 'plm3:' + id; })) || {}, put = {};
  var old = new Date().toISOString();
  need.forEach(function (id) {
    var v = got['plm3:' + id]; if (!v) return;
    try { var j = JSON.parse(v); stored[id] = { artwork: j.artwork || '', latestDate: j.latestDate || '', at: old }; put[PLM_STORE_ + id] = JSON.stringify(stored[id]); } catch (e) {}
  });
  if (Object.keys(put).length) PropertiesService.getScriptProperties().setProperties(put);
  return Object.keys(put).length;
}

// 毎時の自動更新から: 新しく登録されたリスト（保存値が無いもの）だけ1回取る。既にあるリストは取り直さない
function playlistLiveMetaWarm_() {
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), PUBLIC_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return { warmed: 0 };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return playlistIdForPublicRead_(r[0]); }).filter(Boolean);
  var stored = plmStoredAll_();
  plmMigrateFromCache_(ids, stored);
  var pick = plmPickNew_(ids, stored, PLM_NEW_PER_RUN_);
  var m = pick.length ? plmRefresh_(pick) : {};
  return { playlists: ids.length, newPicked: pick.length, fetched: Object.keys(m).length };
}

// 自動更新で回を追加した直後に呼ぶ（PlaylistAutoWrite.js）。Spotify には問い合わせない。
// 保存値があるリストだけ、最終新着日を新しくする（表紙はそのまま）
function plmNoteAdded_(playlistId, episodes) {
  try {
    var id = String(playlistId || ''); if (!/^[A-Za-z0-9]{22}$/.test(id)) return false;
    var props = PropertiesService.getScriptProperties(), raw = props.getProperty(PLM_STORE_ + id); if (!raw) return false;
    var v = JSON.parse(raw), next = plmLatestAfterAdd_(v.latestDate, typeof pjdWithJstDates_ === 'function' ? pjdWithJstDates_(episodes) : episodes); if (!next) return false;   // #432 日本時間の配信日
    v.latestDate = next; v.latestFrom = 'autoAdd'; v.latestAt = new Date().toISOString();
    props.setProperty(PLM_STORE_ + id, JSON.stringify(v));
    return true;
  } catch (e) { return false; }
}

// 管理人の依頼で、1つのリストの表紙だけ取り直す（Spotify 1回）。最終新着日はそのまま。
// 待機中は何もしない（解除後にもう一度実行する）。取れなかった時も今の表紙を消さない
function plmRefreshCoverOne_(idOrUrl) {
  var m = String(idOrUrl || '').match(/([A-Za-z0-9]{22})/); if (!m) return { ok: false, reason: 'NO_ID' };
  var id = m[1];
  var until = typeof spotifyAnyCooldown_ === 'function' ? spotifyAnyCooldown_() : '';
  if (until) return { ok: false, reason: 'SPOTIFY_COOLDOWN', until: until };
  var token = plmToken_(); if (!token) return { ok: false, reason: 'NO_TOKEN' };
  var r = plmFetchChunked_([{ url: 'https://api.spotify.com/v1/playlists/' + id + '?market=JP&fields=images', headers: plmHeaders_(token), muteHttpExceptions: true }])[0];
  if (!plmOk_(r)) return { ok: false, reason: 'HTTP_' + (r ? r.getResponseCode() : 'NONE') };
  var art = plmArtwork_(JSON.parse(r.getContentText()).images);
  if (!art) return { ok: false, reason: 'NO_IMAGE' };
  var props = PropertiesService.getScriptProperties(), raw = props.getProperty(PLM_STORE_ + id), v = {};
  try { v = raw ? JSON.parse(raw) : {}; } catch (e) { v = {}; }
  var before = v.artwork || '';
  v.artwork = art; v.coverAt = new Date().toISOString(); if (!v.at) v.at = v.coverAt;
  props.setProperty(PLM_STORE_ + id, JSON.stringify(v));
  return { ok: true, id: id, changed: before !== art, before: before, after: art };
}
function PLAYLIST_LIVE_META_CHECK() { var r = playlistLiveMetaWarm_(); Logger.log(JSON.stringify(r)); return r; }
// 管理人の依頼「ポすすめの表紙を変えた」（2026-11-20）用
function PLAYLIST_COVER_REFRESH_POSUSUME() { var r = plmRefreshCoverOne_('20eSUPkdsSN56eEC8dg2Lq'); Logger.log(JSON.stringify(r)); return r; }
// 切り替え直後に手で1回: 旧キャッシュから保存値へ移すだけ（Spotify は呼ばない）

// ---- PlaylistResolve.js ----
function handlePlaylistResolve_(e, callback) {
  const rawUrl = String(
    e && e.parameter && e.parameter.url ? e.parameter.url : ""
  ).trim();

  const match = rawUrl.match(
    /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)(?:[/?#]|$)/i
  );

  if (!match) {
    return apiResponse(
      { ok: false, error: "SpotifyプレイリストURLを入力してください" },
      callback
    );
  }

  const token = getSpotifyAccessToken();
  if (!token) {
    return apiResponse(
      { ok: false, error: "Spotify情報を取得できませんでした" },
      callback
    );
  }

  try {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" +
        encodeURIComponent(match[1]) +
        "?market=JP&fields=id,name,owner(display_name)",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      }
    );

    if (response.getResponseCode() !== 200) {
      return apiResponse(
        { ok: false, error: "Spotifyプレイリストを読み込めませんでした" },
        callback
      );
    }

    const data = JSON.parse(response.getContentText());
    return apiResponse(
      {
        ok: true,
        title: String(data && data.name ? data.name : "").trim(),
        owner: String(
          data && data.owner && data.owner.display_name
            ? data.owner.display_name
            : ""
        ).trim()
      },
      callback
    );
  } catch (_) {
    return apiResponse(
      { ok: false, error: "Spotifyプレイリストを読み込めませんでした" },
      callback
    );
  }
}

// ---- PlaylistSpecial.js ----
function syncToyohidePlaylist() {
  if (typeof spotifySkipIfCooldown_ === "function" && spotifySkipIfCooldown_("syncToyohidePlaylist")) return;
  syncAutoPlaylistByPlaylistId_("4Ri6rxTGFimTm0KkZtKfBZ");
}
function syncIsshoShinbunPlaylist() {
  if (typeof spotifySkipIfCooldown_ === "function" && spotifySkipIfCooldown_("syncIsshoShinbunPlaylist")) return;
  syncAutoPlaylistByPlaylistId_("4tY0lHoV8IemMBp4iTnKnl");
}
function syncKinoDougaPlaylist() {
  if (typeof spotifySkipIfCooldown_ === "function" && spotifySkipIfCooldown_("syncKinoDougaPlaylist")) return;
  syncAutoPlaylistByPlaylistId_("6nDhZQG75F1wU62sdcYJMq");
}
