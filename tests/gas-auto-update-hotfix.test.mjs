import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function load(file, context) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

test("latest date write updates both work and public sheets", () => {
  const writes = [];
  const workRows = [
    ["https://open.spotify.com/playlist/6hNrobOVHmYaQT5C7hPkNa", "ポリレビ", "maker", "", "", "2026-09-25"]
  ];
  const publicRows = [
    ["https://open.spotify.com/playlist/6hNrobOVHmYaQT5C7hPkNa", "ポリレビ", "maker", "2026-09-25"]
  ];

  function sheet(name, rows) {
    return {
      name,
      getName() { return name; },
      getLastRow() { return rows.length + 1; },
      getRange(row, col, numRows, numCols) {
        return {
          getDisplayValues() {
            if (row === 2 && col === 1) {
              return rows.map(r => r.slice(0, numCols));
            }
            return [];
          },
          setValue(value) {
            writes.push({ sheet: name, row, col, value });
          }
        };
      }
    };
  }

  const work = sheet("作業台", workRows);
  const pub = sheet("サイト公開用", publicRows);
  const ss = {
    getSheetByName(name) { return name === "作業台" ? work : name === "サイト公開用" ? pub : null; },
    getSheets() { return [work, pub]; }
  };

  const context = vm.createContext({
    Array, Date, JSON, Map, Math, Number, Object, RegExp, Set, String,
    SPREADSHEET_ID: "sheet",
    PUBLIC_SHEET_NAME: "サイト公開用",
    SpreadsheetApp: {
      openById() { return ss; },
      flush() {}
    },
    Session: { getScriptTimeZone() { return "Asia/Tokyo"; } },
    Utilities: { formatDate() { return "2026-10-02"; } },
    Logger: { log() {} },
    getSheetLoose(spreadsheet, wanted) {
      return spreadsheet.getSheetByName(wanted);
    }
  });

  load("scripts/google-apps-script/PlaylistDates.js", context);
  vm.runInContext(
    'updatePlaylistLatestDate_("6hNrobOVHmYaQT5C7hPkNa", "2026-10-02")',
    context
  );

  const workWrite = writes.find(w => w.sheet === "作業台" && w.col === 6);
  const publicWrite = writes.find(w => w.sheet === "サイト公開用" && w.col === 4);
  if (!workWrite || workWrite.value !== "2026-10-02") {
    throw new Error("作業台F列が更新されません");
  }
  if (!publicWrite || publicWrite.value !== "2026-10-02") {
    throw new Error("サイト公開用D列が更新されません");
  }
});

test("mekurou rule requests latest-date reconciliation", () => {
  const context = vm.createContext({ Array, Object, String, RegExp });
  load("scripts/google-apps-script/PlaylistAutoRules.js", context);
  const rule = vm.runInContext('getAutoPlaylistRuleByKey_("issho-shinbun")', context);
  if (!rule || rule.updateLatestDateOnAdd !== true || rule.requireSheetLinkBeforeWrite !== true) {
    throw new Error("めくろうルールの日付同期設定が不足しています");
  }
});

test("speaker-safe classifier confirms explicit Saito appearance context", () => {
  const context = vm.createContext({ Array, Object, String, RegExp });
  load("scripts/google-apps-script/PlaylistAutoSpeakerSafeV2.js", context);
  const result = vm.runInContext(`
    classifySpeakerSafeV2_(
      {
        id: "3Qhcx3wDl9anbIiGQsaCDk",
        name: "テスト",
        description: "出演：斎藤健一郎記者。富士山について話します。",
        html_description: ""
      },
      { keywords:["斎藤健一郎","斎藤 健一郎"], speakerAliases:["斎藤健一郎","斎藤 健一郎"] }
    )
  `, context);
  if (!result || result.classification !== "confirmed") {
    throw new Error("斎藤健一郎の明示出演文脈をconfirmedにできません");
  }
});

test("urgent repair runs fixed + speaker latest only, not historical backfill", () => {
  const calls = [];
  const context = vm.createContext({
    JSON,
    Logger: { log() {} },
    syncDailyManagedAutoPlaylistsV1_() { calls.push("fixed"); return [{ ok:true }]; },
    syncBootstrapSpeakerLatestFastLaneV1_() { calls.push("speaker"); return [{ ok:true }]; }
  });
  load("scripts/google-apps-script/AutoUpdateUrgentRepairV1.js", context);
  const result = vm.runInContext("runAutoUpdateUrgentRepairV1()", context);
  if (calls.join(",") !== "fixed,speaker") {
    throw new Error("緊急復旧の呼び出し順が不正です");
  }
  if (result.historicalBackfillRun !== false) {
    throw new Error("緊急復旧が履歴補完を実行しようとしています");
  }
});
