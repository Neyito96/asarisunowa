import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, parseTopLevel, renameLegacy, NEW_FILES } from '../scripts/p25-copy-compare.mjs';

const OLD = `// legacy
const COPY_CONFIG = { stateSheetId: "x" };
function getToken_() { return PropertiesService.getScriptProperties().getProperty("T"); }
function same_(a) { return a + 1; }
function readOnly_(x) { const s = "}{"; return x.map(y => y); }
function writer_(x) { SpreadsheetApp.openById("a").getSheetByName("s").appendRow([x]); }
function p25Plan_(a) { return legacyOnly_(a); }
function legacyOnly_(a) { return 1; }
function menuEntry() { return getToken_(); }
`;
const NEW = { 'P25LibraryPipeline.js': `function same_(a) { return a + 1; }\nfunction getToken_() { return UrlFetchApp.fetch("https://x", {method:"post"}); }\nfunction readOnly_(x, y) { return x.filter(Boolean); }\nfunction p25Plan_(a, b) { return 2; }\n`, 'P25CopyAdapter.js': '', 'P25CopyOwnership.js': '', 'P25CopySession20261107.js': '', 'P25CopyToken.js': '' };

test('parser handles braces inside strings and finds function/const definitions with lines', () => {
  const p = parseTopLevel(OLD);
  assert.deepEqual(p.items.map(i => i.name), ['COPY_CONFIG', 'getToken_', 'same_', 'readOnly_', 'writer_', 'p25Plan_', 'legacyOnly_', 'menuEntry']);
  assert.deepEqual(p.warnings, []);
  assert.equal(p.items.find(i => i.name === 'same_').startLine, 4);
});

test('collisions are classified: identical / protect old (auth) / review / rename', () => {
  const r = compare(OLD, NEW);
  const by = Object.fromEntries(r.collisions.map(c => [c.name, c]));
  assert.deepEqual(Object.keys(by).sort(), ['getToken_', 'p25Plan_', 'readOnly_', 'same_']);
  assert.equal(by.same_.same, true);
  assert.match(by.same_.action, /^IDENTICAL/);
  assert.match(by.getToken_.action, /^PROTECT_OLD/);        // old touches PropertiesService/token
  assert.ok(by.getToken_.newFlags.includes('WRITE'));       // new one POSTs
  assert.equal(by.readOnly_.signatureChanged, true);
  assert.ok(by.readOnly_.removedLines + by.readOnly_.addedLines > 0);
  assert.match(by.p25Plan_.action, /^RENAME_OLD/);
  assert.ok(r.oldOnly.some(x => x.name === 'writer_' && x.flags.includes('WRITE')));
  assert.ok(r.oldOnly.some(x => x.name === 'menuEntry'));
});

test('legacy rename only touches differing collisions, keeps call sites consistent, original untouched', () => {
  const out = renameLegacy(OLD, ['getToken_', 'p25Plan_']);
  assert.match(out, /function getToken__legacy410\(/);
  assert.match(out, /return getToken__legacy410\(\)/);
  assert.match(out, /function same_\(/);
  assert.doesNotMatch(out, /function p25Plan_\(/);
  assert.match(OLD, /function p25Plan_\(/);
});

test('CLI is read-only: writes only into --out, never the old file, refuses --out beside it', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-')); const oldDir = path.join(d, 'backup'); fs.mkdirSync(oldDir);
  const oldFile = path.join(oldDir, 'コード.js'); fs.writeFileSync(oldFile, OLD);
  const nd = path.join(d, 'new'); fs.mkdirSync(nd); for (const f of NEW_FILES) fs.writeFileSync(path.join(nd, f), NEW[f]);
  const out = path.join(d, 'report');
  execFileSync('node', ['scripts/p25-copy-compare.mjs', '--old', oldFile, '--new-dir', nd, '--out', out]);
  assert.equal(fs.readFileSync(oldFile, 'utf8'), OLD);
  assert.deepEqual(fs.readdirSync(oldDir), ['コード.js']);
  assert.ok(fs.existsSync(path.join(out, 'report.md')) && fs.existsSync(path.join(out, 'legacy-renamed', 'P25CopyLegacy410.js')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')).collisions.length, 4);
  const dump = fs.readdirSync(path.join(out, 'dump')).sort();
  assert.deepEqual(dump, ['getToken_.new.js', 'getToken_.old.js', 'p25Plan_.new.js', 'p25Plan_.old.js', 'readOnly_.new.js', 'readOnly_.old.js']);
  assert.match(fs.readFileSync(path.join(out, 'dump', 'p25Plan_.old.js'), 'utf8'), /legacyOnly_\(a\);/);
  const bad = spawnSync('node', ['scripts/p25-copy-compare.mjs', '--old', oldFile, '--new-dir', nd, '--out', oldDir]);
  assert.equal(bad.status, 2);
  assert.deepEqual(fs.readdirSync(oldDir), ['コード.js']);
});

test('real Phase25 files parse cleanly and have no duplicate definitions among themselves', () => {
  const files = Object.fromEntries(NEW_FILES.map(f => [f, fs.readFileSync('scripts/google-apps-script/' + f, 'utf8')]));
  const r = compare('', files);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.dupNew, []);
  assert.ok(r.newCount > 20);
});
