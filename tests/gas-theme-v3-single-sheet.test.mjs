import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const code = fs.readFileSync("scripts/google-apps-script/ThemeV3SingleSheet.js", "utf8");

function ctx() {
  return vm.createContext({ Array, Boolean, Date, Map, Math, Number, Object, Set, String });
}

function load() {
  const c = ctx();
  vm.runInContext(code, c, { filename: "ThemeV3SingleSheet.js" });
  return c;
}

test("manual Spotify deletion becomes tombstone instead of re-add", () => {
  const c = load();
  c.rows = [["request-x","ep1","","","","","","","採用","2026/10/05","2026/10/05","","人間",""]];
  c.current = [];
  const plan = vm.runInContext("buildThemeV3SpotifyPlan_(rows, current)", c);
  if (plan.additions.length !== 0 || plan.manualRemovalTombstones.length !== 1) {
    throw new Error("Spotify手動削除を再追加禁止として扱えません");
  }
});

test("approved new row is planned for addition", () => {
  const c = load();
  c.rows = [["request-x","ep2","","","","","","","採用","2026/10/05","","","人間",""]];
  c.current = [];
  const plan = vm.runInContext("buildThemeV3SpotifyPlan_(rows, current)", c);
  if (plan.additions.length !== 1 || plan.additions[0].episodeId !== "ep2") {
    throw new Error("新規採用行を追加計画にできません");
  }
});

test("excluded existing item is removal review only", () => {
  const c = load();
  c.rows = [["request-x","ep3","","","","","","","除外","2026/10/05","2026/10/04","","人間",""]];
  c.current = ["ep3"];
  const plan = vm.runInContext("buildThemeV3SpotifyPlan_(rows, current)", c);
  if (plan.removalReview.length !== 1 || plan.additions.length !== 0) {
    throw new Error("除外済みSpotify項目を自動削除せずレビュー対象にできません");
  }
});
