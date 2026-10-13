/** Node-only regression runner for GAS read-only preview. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, 'google-apps-script');
const ctx = {
  Date, String, Number, Array, Object, RegExp, Error, Math, JSON,
  UrlFetchApp: { fetch() { throw new Error('Unexpected network request'); } },
  XmlService: { parse() { throw new Error('Unexpected XML parse'); } },
  Utilities: { formatDate(date) { return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10); } },
};
vm.createContext(ctx);
for (const file of ['OfficialRssDeltaPreview.js', 'OfficialRssLibraryPreview.js', 'OfficialRssDeltaPreviewTests.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}
let total = 0;
for (const name of ['testRssPreviewKeys_', 'testRssPreviewNormalization_', 'testRssPreviewMigrationFixture_', 'testRssLibraryExcludedHistory_', 'testRssPreviewTitleDateIsolation_']) {
  const result = vm.runInContext(name + '()', ctx);
  assert.equal(result.ok, true, name);
  total += result.assertions;
  process.stdout.write(name + ': PASS (' + result.assertions + ' assertions)\n');
}
process.stdout.write('TOTAL: ' + total + ' assertions PASS\n');
