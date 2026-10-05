import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const code = fs.readFileSync("scripts/google-apps-script/PlaylistAutoThemeReviewV2.js", "utf8");

function context() {
  const c = vm.createContext({ Array, Boolean, JSON, Math, Number, Object, RegExp, String });
  vm.runInContext(code, c, { filename: "PlaylistAutoThemeReviewV2.js" });
  return c;
}

test("maps known theme playlists to human-readable single tabs", () => {
  const c = context();
  const south = vm.runInContext('getThemeReviewV2SheetName_({playlistId:"2Org6cCBgVas4d9OwzzxAv"})', c);
  const nordic = vm.runInContext('getThemeReviewV2SheetName_({playlistId:"5OwJ6qphlx7kSlpdnk3AXJ"})', c);
  if (south !== "中南米") throw new Error("中南米タブ名が不正です");
  if (nordic !== "北欧") throw new Error("北欧タブ名が不正です");
});

test("normalizes legacy 保留 to 未確認", () => {
  const c = context();
  const v = vm.runInContext('normalizeThemeReviewV2Decision_("保留")', c);
  if (v !== "未確認") throw new Error("保留を未確認へ正規化できません");
});

test("history decision wins over duplicate queue row", () => {
  const c = context();
  c.queue = [["south-america","ep1","2026-09-01","show","title","南米","x","url","未確認","","",""]];
  c.history = [["south-america","ep1","2026-09-01","show","title","南米","x","url","採用","2026/09/18","2026/09/18",""]];
  const rows = vm.runInContext("mergeThemeReviewV2Rows_(queue, history)", c);
  if (rows.length !== 1 || rows[0][8] !== "採用" || !rows[0][10]) {
    throw new Error("履歴の採用済み状態を優先できません");
  }
});

test("north-europe empty history keeps candidates and removes 保留 status", () => {
  const c = context();
  c.queue = [
    ["request-5OwJ6qphlx7kSlpdnk3AXJ","ep2","2026-09-22","show","title","北欧","x","url2","保留","","",""],
    ["request-5OwJ6qphlx7kSlpdnk3AXJ","ep3","2026-09-17","show","title","デンマーク","x","url3","保留","","",""]
  ];
  c.history = [];
  const plan = vm.runInContext(
    'buildThemeReviewV2MigrationPlan_({key:"request-5OwJ6qphlx7kSlpdnk3AXJ",playlistId:"5OwJ6qphlx7kSlpdnk3AXJ"}, queue, history)',
    c
  );
  if (plan.targetSheetName !== "北欧" || plan.mergedRowCount !== 2) {
    throw new Error("北欧の単一タブ移行計画が不正です");
  }
  if (plan.mergedRows.some(r => r[8] !== "未確認")) {
    throw new Error("北欧の保留状態を未確認へ正規化できません");
  }
  if (plan.spotifyWrite || plan.spreadsheetWrite) {
    throw new Error("dry-run計画が本番書き込みを許可しています");
  }
});

test("known source tabs identify obsolete south-america copy", () => {
  const c = context();
  const src = vm.runInContext(
    'getKnownThemeReviewV2SourceTabs_({playlistId:"2Org6cCBgVas4d9OwzzxAv"})',
    c
  );
  if (src.queue !== "テーマ候補確認" || src.history !== "テーマ判定履歴") {
    throw new Error("中南米の既存タブ対応が不正です");
  }
  if (src.obsoleteCopies.length !== 1 || src.obsoleteCopies[0] !== "テーマ候補確認 のコピー") {
    throw new Error("中南米の重複コピータブを検出できません");
  }
});
