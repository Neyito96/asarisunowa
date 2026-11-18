// speaker AUTOの人間判定台帳。人間がD列を「承認」にするまでルールへ反映しない。
const SPEAKER_HUMAN_DECISION_SHEET_NAME_ = "AUTO出演者判定";

function extractSpeakerHumanEpisodeId_(value) {
  const raw = String(value || "").trim();
  if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
  const uri = raw.match(/^spotify:episode:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];
  const url = raw.match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[/?#].*)?$/);
  return url ? url[1] : "";
}

function setupSpeakerHumanDecisionSheetV1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = getSheetLoose(ss, SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (sheet) return { created: false, name: SPEAKER_HUMAN_DECISION_SHEET_NAME_ };
  sheet = ss.insertSheet(SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  sheet.getRange(1, 1, 1, 4).setValues([[
    "SpotifyプレイリストID", "episode ID または Spotify URL", "判定", "承認（削除時は削除承認）"
  ]]);
  return { created: true, name: SPEAKER_HUMAN_DECISION_SHEET_NAME_ };
}

function readApprovedSpeakerHumanDecisions_(playlistId) {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
  const decisions = {};
  rows.forEach(function(row, index) {
    const id = String(row[0] || "").trim();
    const approval = String(row[3] || "").trim();
    if (id !== playlistId || ["承認", "削除承認"].indexOf(approval) < 0) return;
    const episodeId = extractSpeakerHumanEpisodeId_(row[1]);
    const decision = String(row[2] || "").trim();
    if (approval === "削除承認" && decision !== "除外") {
      throw new Error("Spotify削除の承認行は「除外」にしてください: " + (index + 2));
    }
    if (!/^[A-Za-z0-9]{22}$/.test(episodeId) ||
        ["除外", "訂正済み", "反映済み"].indexOf(decision) < 0) {
      throw new Error("AUTO出演者判定の承認済み行が不正です: " + (index + 2));
    }
    if (decisions[episodeId] && decisions[episodeId] !== decision) {
      throw new Error("AUTO出演者判定で同じepisode IDの判定が衝突しています: " + episodeId);
    }
    decisions[episodeId] = decision;
  });
  return decisions;
}

// 「AUTO出演者判定」の削除承認を1行だけ処理する。除外保存の成功後にだけSpotifyへDELETEする。
function removeOneApprovedSpeakerEpisodeFromSpotifyV1() {
  const sheet = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (!sheet) throw new Error("AUTO出演者判定シートがありません");
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues() : [];
  const pending = rows.map(function(row, index) {
    return { row: row, rowNumber: index + 2 };
  }).filter(function(entry) { return String(entry.row[3] || "").trim() === "削除承認"; });
  if (pending.length !== 1) throw new Error("削除承認行をちょうど1行にしてください: " + pending.length);

  const entry = pending[0];
  const playlistId = String(entry.row[0] || "").trim();
  const episodeId = extractSpeakerHumanEpisodeId_(entry.row[1]);
  if (!/^[A-Za-z0-9]{22}$/.test(playlistId) || !episodeId ||
      String(entry.row[2] || "").trim() !== "除外") {
    throw new Error("削除承認行のplaylist ID・episode URL・判定を確認してください: " + entry.rowNumber);
  }
  if (readApprovedSpeakerHumanDecisions_(playlistId)[episodeId] !== "除外") {
    throw new Error("承認済みの人間除外を確認できません: " + episodeId);
  }
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return String(rule && rule.playlistId || "") === playlistId &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  });
  if (rules.length !== 1) throw new Error("対象speakerルールが一意に見つかりません");
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザートークンがありません");
  const uri = "spotify:episode:" + episodeId;
  const items = getAllSpotifyPlaylistItems_(playlistId, token);
  const present = items.some(function(row) {
    return String(row && row.item && row.item.id || "") === episodeId &&
      String(row.item.uri || "") === uri;
  });

  // スクリプトロックを使う既存関数で、Spotify操作に先立って除外を確定する。
  recordSpeakerAutoUpdateHumanDecisionV1(playlistId, episodeId, "除外");
  if (present) {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" + encodeURIComponent(playlistId) + "/items", {
        method: "delete", muteHttpExceptions: true, contentType: "application/json",
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
        payload: JSON.stringify({ items: [{ uri: uri }] })
      }
    );
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error("除外は保存済みですがSpotify削除に失敗しました: HTTP " + status);
    }
    if (getAllSpotifyPlaylistItems_(playlistId, token).some(function(row) {
      return String(row && row.item && row.item.id || "") === episodeId;
    })) {
      throw new Error("除外は保存済みですがSpotifyにepisodeが残っています");
    }
  }
  // 次回の実行で同じ行を再処理しない。承認履歴は残してAUTO巡回でも読み続ける。
  sheet.getRange(entry.rowNumber, 4).setValue("承認");
  return { playlistId: playlistId, episodeId: episodeId, decision: "除外", removed: present };
}

function applyApprovedSpeakerHumanDecisions_(rule) {
  if (String(rule && rule.ruleType || "") !== "speaker") return rule;
  const approved = readApprovedSpeakerHumanDecisions_(String(rule.playlistId || ""));
  const existing = rule.manualEpisodeDecisions || {};
  const ids = Object.keys(approved);
  if (!ids.length) return rule;
  ids.forEach(function(id) {
    if (existing[id] === "除外" && approved[id] !== "除外") {
      throw new Error("人間の除外済みIDを別判定で上書きできません: " + id);
    }
  });
  const changed = ids.some(function(id) { return existing[id] !== approved[id]; });
  if (!changed) return rule;
  rule.manualEpisodeDecisions = Object.assign({}, existing, approved);
  saveAutoUpdateRuntimeRuleV1_(rule); // Spotifyへ進む前に人間判定を確定する。
  return rule;
}
function diagnoseSpeakerHumanDecisionSheetRows() {
  const sheet = getSheetLoose(
    SpreadsheetApp.openById(SPREADSHEET_ID),
    SPEAKER_HUMAN_DECISION_SHEET_NAME_
  );

  const lastRow = sheet.getLastRow();
  const rows = sheet.getRange(1, 1, lastRow, 4).getDisplayValues();

  Logger.log(JSON.stringify({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: sheet.getName(),
    lastRow: lastRow,
    rows: rows
  }, null, 2));
}
// 「AUTO出演者判定」の削除承認を、安全に1件ずつ連続処理する。
// 各行は既存の removeOneApprovedSpeakerEpisodeFromSpotifyV1() に任せる。
// 1件でも失敗したら、その場で停止する。
function removeApprovedSpeakerEpisodesBatchV1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, SPEAKER_HUMAN_DECISION_SHEET_NAME_);
  if (!sheet) throw new Error("AUTO出演者判定シートがありません");

  const MAX_PER_RUN = 10; // 一度に最大10件まで
  const results = [];

  for (let i = 0; i < MAX_PER_RUN; i++) {
    const lastRow = sheet.getLastRow();
    const rows = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues()
      : [];

    const pending = rows
      .map(function(row, index) {
        return { row: row, rowNumber: index + 2 };
      })
      .filter(function(entry) {
        return String(entry.row[3] || "").trim() === "削除承認";
      });

    // 全件終了
    if (pending.length === 0) {
      Logger.log(JSON.stringify({
        ok: true,
        completed: true,
        processed: results.length,
        results: results
      }, null, 2));
      return {
        ok: true,
        completed: true,
        processed: results.length,
        results: results
      };
    }

    // 既存の単発関数は「削除承認がちょうど1件」を要求するため、
    // 先頭1件以外はいったん待避する。
    const first = pending[0];
    const waiting = pending.slice(1);

    waiting.forEach(function(entry) {
      sheet.getRange(entry.rowNumber, 4).setValue("削除待ち");
    });

    SpreadsheetApp.flush();

    try {
      // 実績のある既存処理をそのまま使用
      const result = removeOneApprovedSpeakerEpisodeFromSpotifyV1();
      results.push(result);

    } catch (err) {
      // 未処理行を元の「削除承認」に戻す
      waiting.forEach(function(entry) {
        sheet.getRange(entry.rowNumber, 4).setValue("削除承認");
      });
      SpreadsheetApp.flush();

      Logger.log(JSON.stringify({
        ok: false,
        processed: results.length,
        failedRow: first.rowNumber,
        error: String(err && err.message || err),
        results: results
      }, null, 2));

      throw err;
    }

    // 待避した行を次の処理用に戻す
    waiting.forEach(function(entry) {
      sheet.getRange(entry.rowNumber, 4).setValue("削除承認");
    });

    SpreadsheetApp.flush();
  }

  Logger.log(JSON.stringify({
    ok: true,
    completed: false,
    processed: results.length,
    message: "1回の上限 " + MAX_PER_RUN + " 件に達しました",
    results: results
  }, null, 2));

  return {
    ok: true,
    completed: false,
    processed: results.length,
    results: results
  };
}