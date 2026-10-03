import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const gasFiles = [
  "scripts/google-apps-script/PlaylistAutoRules.js",
  "scripts/google-apps-script/PlaylistAutoLifecycle.js",
  "scripts/google-apps-script/PlaylistAutoRequestRule.js",
  "scripts/google-apps-script/AutoUpdateAutomationV1.js",
  "scripts/google-apps-script/PlaylistAutoThemeReview.js",
  "scripts/google-apps-script/PlaylistAutoSafetyTests.js",
];

test("keeps submitted themes stopped until explicit review approval", () => {
  const context = vm.createContext({
    Array,
    Date,
    JSON,
    Logger: { log() {} },
    Map,
    Math,
    Number,
    Object,
    RegExp,
    Set,
    String,
    console,
  });

  for (const file of gasFiles) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }

  vm.runInContext("testSubmittedThemeApprovalPureFunctions_()", context);
});
