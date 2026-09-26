const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(
  "scripts/google-apps-script/PlaylistAutoThemeReview.js",
  "utf8"
);

const context = {
  console,
  Logger: { log() {} },
  SpreadsheetApp: {
    flush() {}
  }
};

vm.createContext(context);
vm.runInContext(source, context);

context.SpreadsheetApp.openById = function() {
  return {
    getSheetByName: function() { return null; }
  };
};


/*
 * ここから下はテスト専用。
 * GASのSpreadsheet APIそのものを再現せず、
 * appendThemeReviewEpisodesToQueue_ が使う境界だけ差し替える。
 */
let currentRows = [];
let historyRows = [];
let rowsWritten = [];

context.ensureThemeSpecificReviewSheet_ = function() {
  return { kind: "queue" };
};

context.ensureThemeReviewHistorySheet_ = function() {
  return { kind: "history" };
};

context.readThemeReviewRows_ = function(sheet) {
  if (sheet.kind === "queue") return currentRows;
  if (sheet.kind === "history") return historyRows;
  return [];
};

context.writeThemeReviewQueueRows_ = function(sheet, rows) {
  rowsWritten = rows.slice();
};

context.SPREADSHEET_ID = "TEST_SPREADSHEET";

context.getThemeReviewSheetPairV1_ = function(rule, ss) {
  const queue = ss.getSheetByName
    ? ss.getSheetByName("テーマ候補確認")
    : null;
  const history = ss.getSheetByName
    ? ss.getSheetByName("テーマ候補確認履歴")
    : null;

  if (queue && history) {
    return { queue, history };
  }

  // Test-only lightweight sheet wrappers.
  function makeSheet(rowsRef, kind) {
    return {
      kind,
      getLastRow() {
        return Math.max(1, rowsRef().length + 1);
      },
      getRange(row, col, numRows, numCols) {
        return {
          getValues() {
            if (row <= 1) return [];
            return rowsRef().slice(row - 2, row - 2 + numRows);
          },
          setValues(values) {
            if (rowsRef === currentRowsRef) {
              rowsWritten.push(...values);
              currentRows.push(...values);
            } else {
              historyRows.push(...values);
            }
            return this;
          },
          clearContent() { return this; }
        };
      },
      appendRow(row) {
        if (rowsRef === currentRowsRef) {
          rowsWritten.push(row);
          currentRows.push(row);
        } else {
          historyRows.push(row);
        }
      }
    };
  }

  function currentRowsRef() { return currentRows; }
  function historyRowsRef() { return historyRows; }

  return {
    queue: makeSheet(currentRowsRef, "queue"),
    history: makeSheet(historyRowsRef, "history")
  };
};

context.getAutoPlaylistRuleByKey_ = function() {
  return null;
};

context.assertThemeReviewQueueRows_ = function() {};

context.getThemeReviewRowKey_ = function(row) {
  return String(row[0] || "") + "::" + String(row[1] || "");
};

context.getThemeReviewMatchedKeywords_ = function() {
  return ["test"];
};

context.buildThemeReviewExcerpt_ = function() {
  return "excerpt";
};

function episode(id) {
  return {
    id,
    release_date: "2026-09-23",
    name: "自動判別候補 " + id,
    show: { name: "TEST SHOW" },
    external_urls: {
      spotify: "https://open.spotify.com/episode/" + id
    }
  };
}

function reviewRow(id, decision) {
  return [
    "theme-test",
    id,
    "2026-09-20",
    "TEST SHOW",
    "人間確認済み",
    "test",
    "excerpt",
    "https://open.spotify.com/episode/" + id,
    decision,
    new Date("2026-09-22T00:00:00Z"),
    "",
    ""
  ];
}

/*
 * CASE 1:
 * 現在の候補タブで人間が「除外」済み。
 * 同じepisodeを自動判別しても再追加・上書きしない。
 */
currentRows = [
  reviewRow("episode-current-rejected", "除外")
];
historyRows = [];
rowsWritten = [];

let result = context.appendThemeReviewEpisodesToQueue_(
  { key: "theme-test" },
  [episode("episode-current-rejected")]
);

if (result.newCandidateCount !== 0) {
  throw new Error(
    "FAIL CASE1: 現在タブの人間判定を無視して再候補化しました"
  );
}

if (rowsWritten.length !== 0) {
  throw new Error(
    "FAIL CASE1: 人間判定済みepisodeを書き直しました"
  );
}

console.log("PASS CASE1: current human rejection preserved");

/*
 * CASE 2:
 * 「除外」が判定履歴にある。
 * 候補タブから消えていても、自動判別で復活しない。
 */
currentRows = [];
historyRows = [
  reviewRow("episode-history-rejected", "除外")
];
rowsWritten = [];

result = context.appendThemeReviewEpisodesToQueue_(
  { key: "theme-test" },
  [episode("episode-history-rejected")]
);

if (result.newCandidateCount !== 0) {
  throw new Error(
    "FAIL CASE2: 履歴の人間判定を無視して再候補化しました"
  );
}

if (rowsWritten.length !== 0) {
  throw new Error(
    "FAIL CASE2: 履歴済みepisodeを候補へ再登録しました"
  );
}

console.log("PASS CASE2: historical human rejection preserved");

/*
 * CASE 3:
 * 人間が「採用」と判断した既存行も、
 * 自動判定によって作り直さない。
 */
currentRows = [
  reviewRow("episode-current-approved", "採用")
];
historyRows = [];
rowsWritten = [];

result = context.appendThemeReviewEpisodesToQueue_(
  { key: "theme-test" },
  [episode("episode-current-approved")]
);

if (result.newCandidateCount !== 0) {
  throw new Error(
    "FAIL CASE3: 人間の採用判断を自動判定で作り直しました"
  );
}

if (rowsWritten.length !== 0) {
  throw new Error(
    "FAIL CASE3: 採用済みepisodeを書き直しました"
  );
}

console.log("PASS CASE3: current human approval preserved");

/*
 * CASE 4:
 * 過去判断がない完全な新規episodeだけは候補になる。
 */
currentRows = [];
historyRows = [];
rowsWritten = [];

result = context.appendThemeReviewEpisodesToQueue_(
  { key: "theme-test" },
  [episode("episode-new")]
);

if (result.newCandidateCount !== 1) {
  throw new Error(
    "FAIL CASE4: 未判定の新規episodeを候補追加できません"
  );
}

if (rowsWritten.length !== 1) {
  throw new Error(
    "FAIL CASE4: 新規候補の書き込み件数が不正です"
  );
}

if (
  String(rowsWritten[0][0]) !== "theme-test" ||
  String(rowsWritten[0][1]) !== "episode-new"
) {
  throw new Error(
    "FAIL CASE4: 新規候補のキーが不正です"
  );
}

console.log("PASS CASE4: untouched episode becomes a new candidate");

console.log(
  "PASS: human decisions override later automatic theme detection"
);

/*
 * CASE 5:
 * 現在タブでは「採用」だが、過去履歴に「除外」がある。
 * → Spotify再登録候補にしない。
 */
const spotifyCandidate = reviewRow("episode-no-readd", "採用");
spotifyCandidate[10] = "";

const rejectedHistory = reviewRow("episode-no-readd", "除外");

if (
  context.isThemeReviewSpotifyCandidateAllowed_(
    spotifyCandidate,
    [rejectedHistory]
  ) !== false
) {
  throw new Error(
    "FAIL CASE5: 人間が除外したepisodeをSpotify再登録候補にしました"
  );
}

console.log("PASS CASE5: rejected episode cannot be re-added to Spotify");

/*
 * CASE 6:
 * 過去に採用されSpotify反映済み。
 * → 同じepisodeを再登録しない。
 */
const duplicateCandidate = reviewRow("episode-already-added", "採用");
duplicateCandidate[10] = "";

const addedHistory = reviewRow("episode-already-added", "採用");
addedHistory[10] = new Date("2026-09-22T01:00:00Z");

if (
  context.isThemeReviewSpotifyCandidateAllowed_(
    duplicateCandidate,
    [addedHistory]
  ) !== false
) {
  throw new Error(
    "FAIL CASE6: Spotify反映済みepisodeを再登録候補にしました"
  );
}

console.log("PASS CASE6: already-added episode cannot be re-added to Spotify");

/*
 * CASE 7:
 * 過去履歴なし・現在採用・Spotify未反映。
 * → 正常な新規候補として通す。
 */
const freshApproved = reviewRow("episode-fresh-approved", "採用");
freshApproved[10] = "";

if (
  context.isThemeReviewSpotifyCandidateAllowed_(
    freshApproved,
    []
  ) !== true
) {
  throw new Error(
    "FAIL CASE7: 正常な未反映採用episodeまで拒否しました"
  );
}

console.log("PASS CASE7: fresh approved episode remains eligible");
