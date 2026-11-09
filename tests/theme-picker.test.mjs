import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKER_MAX, searchEpisodes, selectedIds, toggleSelection } from '../lib/library-picker.mjs';
import { applyStage, planStage, COPY_FILES, COPY_SCRIPT_ID, PRODUCTION_SCRIPT_ID } from '../scripts/p25-copy-stage.mjs';

const dir = 'scripts/google-apps-script/';
const src = f => fs.readFileSync(dir + f, 'utf8');
const ep = n => String(n).padStart(22, '0');

// ---------- picker logic (browser side) ----------
test('picker toggles, limits, and never offers EP-00028', () => {
  const e = n => ({ id: 'EP-' + String(n).padStart(5, '0'), title: 't' + n, show: 's', date: '2026-11-01T04:00:00+09:00' });
  let r = toggleSelection([], e(1));
  assert.deepEqual(selectedIds(r.selected), ['EP-00001']);
  assert.equal(r.selected[0].date, '2026-11-01');
  r = toggleSelection(r.selected, e(1));
  assert.deepEqual(r.selected, []);
  assert.equal(toggleSelection([], e(28)).error, 'ON_HOLD');
  assert.equal(toggleSelection([], { id: 'x' }).error, 'INVALID_EPISODE');
  const full = Array.from({ length: PICKER_MAX }, (_, i) => e(i + 100)).map(x => ({ id: x.id, title: '', show: '', date: '' }));
  assert.equal(toggleSelection(full, e(1)).error, 'LIMIT');
  const rows = [e(1), e(28), { ...e(2), title: 'ブラジル特集' }];
  assert.deepEqual(searchEpisodes(rows, { query: 'ブラジル' }).map(x => x.id), ['EP-00002']);
  assert.deepEqual(searchEpisodes(rows, { query: 't' }).map(x => x.id).sort(), ['EP-00001']);   // EP-00028 filtered out
});

test('form wiring: picker only for theme, payload carries EP-IDs, state resets after success', () => {
  const form = fs.readFileSync('app/PlaylistCombinedAutoForm.tsx', 'utf8');
  assert.match(form, /updateType === "theme" && <EpisodePicker/);
  assert.match(form, /selectedEpisodes: picked\.map\(\(e\) => e\.id\)/);
  assert.match(form, /setPicked\(\[\]\)/);
  assert.match(fs.readFileSync('app/autoUpdateSubmit.ts', 'utf8'), /selectedEpisodes\?: string\[\]/);
});

// ---------- GAS side ----------
function gas(extra = {}) {
  const props = new Map();
  const locks = { script: false, user: false };
  const mk = n => ({ tryLock: () => { if (locks[n]) return false; locks[n] = true; return true; }, releaseLock: () => { locks[n] = false; } });
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.has(k) ? props.get(k) : null, setProperty: (k, v) => props.set(k, String(v)), deleteProperty: k => props.delete(k), getProperties: () => Object.fromEntries(props) }) },
    LockService: { getScriptLock: () => mk('script'), getUserLock: () => mk('user') },
    Utilities: { getUuid: () => 'u' }, Session: { getEffectiveUser: () => ({ getEmail: () => 'op@example.com' }) },
    ...extra
  });
  for (const f of ['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js', 'ThemePicker.js']) vm.runInContext(src(f), context, { filename: f });
  return { context, props };
}

function ledger(rows) {
  const header = Array(39).fill(''); Object.entries({ 0: '台帳ID', 1: '番組名', 2: 'タイトル', 3: '配信日時', 6: '外部ID', 11: 'Spotify個別URL', 22: '概要清掃済み', 23: '出演者', 38: '人間除外' }).forEach(([i, v]) => header[i] = v);
  return [header, ...rows.map(r => { const x = Array(39).fill(''); x[0] = 'EP-' + String(r.n).padStart(5, '0'); x[1] = '番組A'; x[2] = 'タイトル' + r.n; x[3] = '2026/11/6 4:00'; x[6] = r.guid ?? 'g' + r.n; x[11] = r.url ?? 'https://open.spotify.com/episode/' + ep(r.n); x[38] = r.excl ?? ''; return x; })];
}
const sheets = (rows, exclusions = [['GUID', 'EP-ID']]) => ({
  SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === '削除・除外履歴'
    ? { getLastRow: () => exclusions.length, getLastColumn: () => 2, getRange: () => ({ getDisplayValues: () => exclusions }) }
    : { getLastRow: () => rows.length, getRange: () => ({ getDisplayValues: () => rows }) } }) }
});

test('server-side check: ledger IDs, GUID, Spotify ID, human exclusion, admin hold, exclusion sheet', () => {
  const rows = ledger([{ n: 1 }, { n: 2, excl: '除外' }, { n: 3, guid: '' }, { n: 4, url: '' }, { n: 5 }, { n: 28 }, { n: 6 }]);
  const { context } = gas(sheets(rows, [['GUID', 'EP-ID'], ['', 'EP-00006']]));
  const r = JSON.parse(JSON.stringify(context.validateThemePickerSelectionV1_(['EP-00001', 'EP-00002', 'EP-00003', 'EP-00004', 'EP-00028', 'EP-00006', 'EP-99999', 'EP-00001'])));
  assert.deepEqual(r.accepted.map(a => a.epId), ['EP-00001']);
  assert.equal(r.accepted[0].spotifyId, ep(1));
  assert.equal(r.accepted[0].guid, 'g1');
  const reasons = Object.fromEntries(r.rejected.map(x => [x.epId, x.reason]));
  assert.deepEqual(reasons, { 'EP-00002': 'HUMAN_EXCLUDED', 'EP-00003': 'GUID_MISSING', 'EP-00004': 'SPOTIFY_URL_MISSING_OR_INVALID', 'EP-00028': 'ADMIN_HOLD', 'EP-00006': 'HUMAN_EXCLUDED', 'EP-99999': 'NOT_IN_LEDGER' });
  assert.throws(() => context.validateThemePickerSelectionV1_(Array.from({ length: 101 }, (_, i) => 'EP-' + String(i + 1).padStart(5, '0'))), /最大100件/);
});

test('selection fails closed when the ledger exclusion column or sheet is missing', () => {
  const noAm = ledger([{ n: 1 }]).map(r => r.slice(0, 24));
  assert.throws(() => gas(sheets(noAm)).context.validateThemePickerSelectionV1_(['EP-00001']), /LEDGER_SCHEMA_MISMATCH/);
  const g = gas({ SpreadsheetApp: { openById: () => ({ getSheetByName: n => n === '削除・除外履歴' ? null : { getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => ledger([{ n: 1 }]) }) } }) } });
  assert.throws(() => g.context.validateThemePickerSelectionV1_(['EP-00001']), /EXCLUSION_SHEET_MISSING/);
});

function fakeSheet(initial = []) {
  const rows = initial.map(r => [...r]);
  return { rows, getLastRow: () => rows.length + 1, getRange: (r, c, n) => ({ getValues: () => rows.slice(r - 2, r - 2 + n), setValues: v => { v.forEach((x, i) => { rows[r - 2 + i] = x; }); } }) };
}

test('import writes 採用/投稿者選択 rows, skips known episodes (incl. human exclusions), never overwrites', () => {
  const rows = ledger([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const { context } = gas({ ...sheets(rows), readThemeV3Rows_: s => s.rows, getThemeV3EpisodeId_: r => String(r[1] || '') });
  const existing = ['k', ep(2), '', '', '', '', '', '', '除外', '', '', '', '人間', ''];
  const sheet = fakeSheet([existing]);
  const r = JSON.parse(JSON.stringify(context.importThemePickerSelectionV1_(sheet, { key: 'request-x' }, ['EP-00001', 'EP-00002', 'EP-00028'])));
  assert.equal(r.imported, 1);
  assert.equal(r.skippedKnown, 1);
  assert.deepEqual(r.rejected.map(x => x.epId), ['EP-00028']);
  assert.equal(sheet.rows.length, 2);
  assert.deepEqual(sheet.rows[0], existing);                       // the human exclusion stays untouched
  const added = sheet.rows[1];
  assert.equal(added[1], ep(1));
  assert.equal(added[8], '採用');
  assert.equal(added[12], '投稿者選択');
  assert.equal(added[10], '');                                      // not yet on Spotify
  assert.match(added[13], /EP-00001/);
});

test('row states: 手動選択 / 管理者採用 / 除外 / Spotify追加済み / 新着候補 are told apart', () => {
  const { context } = gas();
  const row = (decision, source, added = '') => { const r = Array(14).fill(''); r[8] = decision; r[12] = source; r[10] = added; return r; };
  const st = r => context.themeV3RowStateV1_(r);
  assert.equal(st(row('採用', '投稿者選択')), '手動選択');
  assert.equal(st(row('採用', '人間')), '管理者採用');
  assert.equal(st(row('採用', 'AUTO')), 'AUTO初稿');
  assert.equal(st(row('採用', 'AUTO新着')), '新着候補');
  assert.equal(st(row('採用', '投稿者選択', '2026-11-09')), 'Spotify追加済み');
  assert.equal(st(row('除外', '投稿者選択')), '除外');
  assert.equal(st(row('未確認', '')), '未確認');
});

test('request cell parsing is tolerant', () => {
  const { context } = gas();
  const parse = v => JSON.parse(JSON.stringify(context.parseThemePickerSelectionV1_(v)));
  assert.deepEqual(parse(JSON.stringify({ v: 1, episodes: ['EP-00001', 'bad'] })), ['EP-00001']);
  for (const bad of ['', 'not json', '{"v":2,"episodes":[]}', '{"v":1}']) assert.deepEqual(parse(bad), []);
});

test('request handler: selection only for theme, validated before saving, stored in column J', () => {
  const s = src('AutoUpdateRequest.js');
  assert.match(s, /updateType !== "theme"/);
  assert.match(s, /validateThemePickerSelectionV1_\(data\.selectedEpisodes\)/);
  assert.ok(s.indexOf('validateThemePickerSelectionV1_') < s.indexOf('appendRow'));
  assert.match(s, /pickerCell\s*\n\s*\]\)/);
});

test('activation imports the selection BEFORE the AUTO draft; new arrivals are labelled AUTO新着', () => {
  const t = src('ThemeV3SingleSheet.js');
  const act = t.slice(t.indexOf('function activateSubmittedThemeV3Request_'));
  assert.ok(act.indexOf('importThemePickerSelectionV1_') < act.indexOf('appendThemeV3AutoDraftCandidates_'));
  assert.match(t, /appendThemeV3AutoDraftCandidates_\(sheet, rule, recent, THEME_PICKER_NEW_ARRIVAL_SOURCE_\)/);
});

test('Phase25 cannot take a theme-managed playlist (one writer per playlist); EP-00028 is held', () => {
  const PL = 'T'.repeat(22);
  const { context, props } = gas({
    THEME_V3_CONFIG_: { '中南米': { playlistId: PL } },
    loadAutoUpdateRuntimeRuleByPlaylistIdV1_: () => null, getAutoPlaylistRuleType_: () => 'x', AUTO_PLAYLIST_RULE_TYPE_THEME_: 'theme'
  });
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { confirm: PL, since: '2026-11-05', ruleRevision: 'r', exclusionsReviewed: true }), /THEME_MANAGED_BY_V3/);
  assert.equal(props.has('P25_OWNER_' + PL), false);
  const other = 'U'.repeat(22);
  const dyn = gas({ THEME_V3_CONFIG_: {}, loadAutoUpdateRuntimeRuleByPlaylistIdV1_: () => ({}), getAutoPlaylistRuleType_: () => 'theme', AUTO_PLAYLIST_RULE_TYPE_THEME_: 'theme' });
  assert.throws(() => dyn.context.P25_SET_OWNER(other, 'P25', { confirm: other, since: '2026-11-05', ruleRevision: 'r', exclusionsReviewed: true }), /THEME_MANAGED_BY_V3/);
});

// ---------- COPY staging (clasp push safety) ----------
function pulled(scriptId, files = ['Code.js', 'appsscript.json']) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  fs.writeFileSync(path.join(d, '.clasp.json'), JSON.stringify({ scriptId }));
  for (const f of files) fs.writeFileSync(path.join(d, f), '// remote ' + f);
  return d;
}
test('COPY staging: dry run lists add/update/same, preserves remote-only files, deletes nothing', () => {
  const d = pulled(COPY_SCRIPT_ID, ['Code.js', 'appsscript.json', 'P25CopyAdapter.js']);
  const plan = planStage(d);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.files.map(f => f.action), ['add', 'update', 'add', 'add']);
  assert.deepEqual(plan.preserved.sort(), ['.clasp.json', 'Code.js', 'appsscript.json']);
  assert.deepEqual(plan.deletes, []);
  assert.equal(fs.readFileSync(path.join(d, 'P25CopyAdapter.js'), 'utf8'), '// remote P25CopyAdapter.js');   // dry run wrote nothing
  applyStage(d);
  for (const f of COPY_FILES) assert.equal(fs.readFileSync(path.join(d, f), 'utf8'), src(f));
  assert.equal(fs.readFileSync(path.join(d, 'appsscript.json'), 'utf8'), '// remote appsscript.json');   // manifest never touched
  assert.equal(fs.readFileSync(path.join(d, 'Code.js'), 'utf8'), '// remote Code.js');
  assert.ok(planStage(d).files.every(f => f.action === 'same'));
});
test('COPY staging refuses the production script, unknown IDs, production-only files and half-pulled folders', () => {
  assert.throws(() => applyStage(pulled(PRODUCTION_SCRIPT_ID)), /PRODUCTION_SCRIPT_ID/);
  assert.throws(() => applyStage(pulled('x'.repeat(20))), /UNKNOWN_SCRIPT_ID/);
  assert.throws(() => applyStage(pulled(COPY_SCRIPT_ID, ['appsscript.json', 'P25ProdIo.js'])), /PRODUCTION_FILE_PRESENT: P25ProdIo.js/);
  assert.throws(() => applyStage(pulled(COPY_SCRIPT_ID, ['Code.js'])), /NO_MANIFEST/);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  assert.throws(() => applyStage(empty), /NO_CLASP_JSON/);
});
