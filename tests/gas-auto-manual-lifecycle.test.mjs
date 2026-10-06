import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/google-apps-script/AutoUpdateAutomationV1.js", "utf8");

test("manual stop/delete/resume lifecycle is defined", () => {
  assert.match(source, /function stopAutoUpdatePlaylistV1\(/);
  assert.match(source, /function humanDeleteAutoUpdatePlaylistV1\(/);
  assert.match(source, /function resumeAutoUpdatePlaylistV1\(/);
  assert.match(source, /AUTO_UPDATE_V1_HUMAN_DELETED_PREFIX_/);
});

test("daily runtime sync excludes disabled and human-deleted rules", () => {
  const start = source.indexOf("function syncApprovedAutoUpdateRequestsV1()");
  const end = source.indexOf("function syncNextAutoUpdateBootstrapV1_()", start);
  const body = source.slice(start, end);
  assert.match(body, /rule\.enabled !== false/);
  assert.match(body, /rule\.lifecycleStatus !== "human_deleted"/);
});

test("pending submissions do not silently resurrect a human-deleted playlist", () => {
  const start = source.indexOf("function processPendingAutoUpdateRequestsV1()");
  const end = source.indexOf("function syncApprovedAutoUpdateRequestsV1()", start);
  const body = source.slice(start, end);
  assert.match(body, /isAutoUpdatePlaylistHumanDeletedV1_\(playlistId\)/);
  assert.match(body, /"人間削除済み"/);
});
