import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/google-apps-script/AutoUpdateAutomationV1.js", "utf8");

test("human delete supports requests that have no runtime rule yet", () => {
  const start = source.indexOf("function humanDeleteAutoUpdatePlaylistV1(");
  const end = source.indexOf("function resumeAutoUpdatePlaylistV1(", start);
  const body = source.slice(start, end);
  assert.match(body, /findLatestAutoUpdateRequestRowByPlaylistIdV1_\(id\)/);
  assert.match(body, /"人間削除"/);
  assert.match(body, /AUTO_UPDATE_V1_HUMAN_DELETED_PREFIX_/);
  assert.doesNotMatch(body, /if \(!rule\) throw new Error\("AUTO登録が見つかりません/);
});

test("request lookup chooses the latest matching playlist row", () => {
  const start = source.indexOf("function findLatestAutoUpdateRequestRowByPlaylistIdV1_(");
  const end = source.indexOf("function resumeAutoUpdatePlaylistV1(", start);
  const body = source.slice(start, end);
  assert.match(body, /for \(let index = urls\.length - 1; index >= 0; index -= 1\)/);
  assert.match(body, /extractAutoUpdateSpotifyPlaylistId_/);
});

test("human-deleted tombstone still blocks ordinary reactivation", () => {
  assert.match(source, /isAutoUpdatePlaylistHumanDeletedV1_\(playlistId\)/);
  assert.match(source, /"人間削除済み"/);
});
