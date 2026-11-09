import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { patchAuth } from '../scripts/p25-copy-auth-patch.mjs';

// Synthetic stand-in built from the lines reported from the real COPY file (no secrets).
const CALLBACK = `function P25_COPY_SPOTIFY_CALLBACK(q) {
  const p = PropertiesService.getScriptProperties();
  try {
    const response = UrlFetchApp.fetch('https://accounts.spotify.com/api/token',{method:'post',muteHttpExceptions:true,payload:{grant_type:'authorization_code',code:q.code}});
    const data = JSON.parse(response.getContentText());
    const scopes = String(data.scope || '').trim().split(/\\s+/);
    if (!data.access_token) return HtmlService.createHtmlOutput('NG');
    p.setProperties({P25_COPY_SPOTIFY_ACCESS_TOKEN:String(data.access_token),P25_COPY_SPOTIFY_EXPIRES_AT:String(Date.now()+Number(data.expires_in)*1000),P25_COPY_SPOTIFY_SCOPE:'playlist-read-private playlist-modify-private'});
    // Intentionally discard refresh_token. No Spotify playlist request or mutation.
    return HtmlService.createHtmlOutput('OK');
  } catch (e) { return HtmlService.createHtmlOutput('ERR'); }
}
`;

test('patch replaces the discard with a p25CopyTokStore_ call, keeps scope, changes nothing else', () => {
  const r = patchAuth(CALLBACK);
  assert.match(r.text, /p25CopyTokStore_\(p25CopySessionConfig20261107_\(\), data, Date\.now\(\)\);/);
  assert.match(r.text, /p\.setProperty\('P25_COPY_SPOTIFY_SCOPE','playlist-read-private playlist-modify-private'\)/);
  assert.doesNotMatch(r.text, /Intentionally discard/);
  assert.doesNotMatch(r.text, /p\.setProperties/);
  assert.equal(r.text.includes("return HtmlService.createHtmlOutput('OK');"), true);
  assert.equal(r.removedLines, 2); assert.equal(r.addedLines, 3);
  // the rest of the file is byte-identical
  assert.equal(r.text.replace(/    \/\/ refresh_token is stored[\s\S]*?P25_COPY_SPOTIFY_SCOPE[^\n]*\n/, '###\n'), CALLBACK.replace(/    p\.setProperties[\s\S]*?discard[^\n]*\n/, '###\n'));
});

test('runtime behaviour: the callback stores access, expiry AND refresh_token, scope kept, nothing logged', () => {
  const store = new Map(); const logs = [];
  const tok = fs.readFileSync('scripts/google-apps-script/P25CopyToken.js', 'utf8');
  const vm = require_vm();
  const ctx = vm.createContext({
    ScriptApp: { getScriptId: () => 'copy-script' }, console: { log: (...a) => logs.push(a.join(' ')) }, Logger: { log: (...a) => logs.push(a.join(' ')) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => store.get(k) ?? null, setProperty: (k, v) => store.set(k, String(v)), setProperties: o => Object.entries(o).forEach(([k, v]) => store.set(k, String(v))), deleteProperty: k => store.delete(k) }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ access_token: 'AT-X', refresh_token: 'RT-X', expires_in: 3600, scope: 'playlist-read-private playlist-modify-private', token_type: 'Bearer' }) }) },
    HtmlService: { createHtmlOutput: s => s },
    p25CopySessionConfig20261107_: () => ({ environment: 'COPY', copyScriptId: 'copy-script' })
  });
  vm.runInContext(tok, ctx);
  vm.runInContext(patchAuth(CALLBACK).text, ctx);
  assert.equal(ctx.P25_COPY_SPOTIFY_CALLBACK({ code: 'c' }), 'OK');
  assert.equal(store.get('P25_COPY_SPOTIFY_ACCESS_TOKEN'), 'AT-X');
  assert.equal(store.get('P25_COPY_SPOTIFY_REFRESH_TOKEN'), 'RT-X');
  assert.ok(Number(store.get('P25_COPY_SPOTIFY_EXPIRES_AT')) > Date.now());
  assert.equal(store.get('P25_COPY_SPOTIFY_SCOPE'), 'playlist-read-private playlist-modify-private');
  assert.ok(!logs.join('\n').includes('RT-X') && !logs.join('\n').includes('AT-X'));
});
function require_vm() { return globalThis.process.getBuiltinModule('node:vm'); }

test('patch refuses unknown shapes, double application and invalid results', () => {
  assert.throws(() => patchAuth('function x(){}'), /PATCH_ANCHOR_NOT_FOUND_ONCE/);
  assert.throws(() => patchAuth(CALLBACK + CALLBACK.replace('function P25', 'function Q25')), /PATCH_ANCHOR_NOT_FOUND_ONCE/);   // anchor twice
  assert.throws(() => patchAuth(patchAuth(CALLBACK).text), /PATCH_ANCHOR_NOT_FOUND_ONCE|ALREADY_PATCHED/);
});

test('CLI: dry run writes nothing; --apply backs up first; refuses backup dir inside the folder and production folders', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-')); const work = path.join(d, 'work'); fs.mkdirSync(work);
  const file = path.join(work, 'P25CopySpotifyAuth.js'); fs.writeFileSync(file, CALLBACK);
  const run = (...a) => spawnSync('node', ['scripts/p25-copy-auth-patch.mjs', ...a], { encoding: 'utf8' });
  const bk = path.join(d, 'backup');
  let r = run(file, '--backup-dir', bk);
  assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).mode, 'DRY_RUN');
  assert.equal(fs.readFileSync(file, 'utf8'), CALLBACK); assert.equal(fs.existsSync(bk), false);
  assert.equal(run(file, '--backup-dir', path.join(work, 'bk'), '--apply').status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), CALLBACK);
  r = run(file, '--backup-dir', bk, '--apply');
  const out = JSON.parse(r.stdout);
  assert.equal(out.mode, 'APPLIED'); assert.equal(out.productionOAuthTouched, false);
  assert.equal(fs.readFileSync(out.backup, 'utf8'), CALLBACK);
  assert.match(fs.readFileSync(file, 'utf8'), /p25CopyTokStore_/);
  assert.equal(run(file, '--backup-dir', bk, '--apply').status, 1);                                // second run refused
  fs.writeFileSync(path.join(work, '.clasp.json'), JSON.stringify({ scriptId: '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9' }));
  fs.writeFileSync(file, CALLBACK);
  assert.equal(run(file, '--backup-dir', bk).status, 1);                                            // production folder
});
