// Run: node scripts/tests/no-mirai-match.test.cjs
// This tests the production rule and matching function without Spotify access.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../google-apps-script/PlaylistAutoRules.js"), "utf8");
const context = vm.createContext({});
vm.runInContext(source + "\nthis.__test = { rule: getAutoPlaylistRuleByKey_('no-mirai'), matches: matchesAutoPlaylistRule_ };", context);
const {rule, matches} = context.__test;
assert.deepEqual(Array.from(rule.showIds), ["0341I5UOUrJgm7KEvNGInZ"]);
[
  "（ノーミライ #9）ひとりでやっとるチキンレースにライバル登場？",
  "（ノーミライ番外編）なんで今月は土曜が5回もあるんや、というお話",
  "農MUSIC 猟ライフ（ノーミライ）",
  "農MUSIC特別号",
  "猟LIFEの特集",
  "（農M、猟L #11）従来の番号表記"
].forEach(name => assert.equal(matches({name}, rule), true, "not matched: " + name));
[
  "（ポリレビ #17）衆院の話",
  "今日は野菜づくり",
  "2026年ニュース"
].forEach(name => assert.equal(matches({name}, rule), false, "false positive: " + name));
console.log("No Mirai match: 9 assertions passed");
