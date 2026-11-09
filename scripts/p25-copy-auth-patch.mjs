#!/usr/bin/env node
// Patches the COPY-only OAuth callback (P25CopySpotifyAuth.js, NOT tracked in GitHub) so that refresh_token is stored
// through p25CopyTokStore_ (P25CopyToken.js) instead of being discarded. Local file edit only: no network, no GAS push.
//
// Usage: node scripts/p25-copy-auth-patch.mjs <path/to/P25CopySpotifyAuth.js> --backup-dir <dir outside that folder> [--apply]
// Without --apply it only reports (dry run). The original is copied into --backup-dir before anything is written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PRODUCTION_SCRIPT_ID = '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9';
const SCOPE = "'playlist-read-private playlist-modify-private'";
// The exact two statements seen on the COPY project: store access/expiry/scope, then the "discard refresh_token" comment.
const TARGET = new RegExp(
  "^([ \\t]*)p\\.setProperties\\(\\{P25_COPY_SPOTIFY_ACCESS_TOKEN:String\\(data\\.access_token\\),P25_COPY_SPOTIFY_EXPIRES_AT:String\\(Date\\.now\\(\\)\\+Number\\(data\\.expires_in\\)\\*1000\\),P25_COPY_SPOTIFY_SCOPE:" + SCOPE.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\}\\);[ \\t]*\\r?\\n[ \\t]*// Intentionally discard refresh_token\\.[^\\n]*\\r?\\n", 'm');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

export function patchAuth(text) {
  const matches = text.match(new RegExp(TARGET.source, 'gm')) || [];
  if (matches.length !== 1) throw new Error('PATCH_ANCHOR_NOT_FOUND_ONCE: 想定の2行(setProperties と refresh_token 破棄のコメント)が ' + matches.length + ' 件。ファイルが想定と違います');
  if (/p25CopyTokStore_/.test(text)) throw new Error('ALREADY_PATCHED');
  const out = text.replace(TARGET, (_, indent) =>
    indent + "// refresh_token is stored by P25CopyToken.js (never logged). No Spotify playlist request or mutation.\n" +
    indent + "p25CopyTokStore_(p25CopySessionConfig20261107_(), data, Date.now());\n" +
    indent + "p.setProperty('P25_COPY_SPOTIFY_SCOPE'," + SCOPE + ");\n");
  new Function(out);                                          // must still be valid JavaScript
  const before = text.split('\n'), after = out.split('\n');
  const removed = before.filter(l => !after.includes(l)).length, added = after.filter(l => !before.includes(l)).length;
  return { text: out, removedLines: removed, addedLines: added };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2); const file = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--backup-dir');
  const bi = argv.indexOf('--backup-dir'); const backupDir = bi >= 0 ? argv[bi + 1] : '';
  const apply = argv.includes('--apply');
  const fail = m => { console.error(m); process.exit(1); };
  if (!file || path.basename(file) !== 'P25CopySpotifyAuth.js') fail('Usage: node scripts/p25-copy-auth-patch.mjs <P25CopySpotifyAuth.js> --backup-dir <dir> [--apply]');
  if (!backupDir || path.resolve(backupDir) === path.dirname(path.resolve(file)) || path.resolve(backupDir).startsWith(path.dirname(path.resolve(file)) + path.sep)) fail('REFUSED: --backup-dir は対象ファイルのフォルダの外を指定してください');
  const claspPath = path.join(path.dirname(path.resolve(file)), '.clasp.json');
  if (fs.existsSync(claspPath) && JSON.parse(fs.readFileSync(claspPath, 'utf8')).scriptId === PRODUCTION_SCRIPT_ID) fail('REFUSED: 本番プロジェクトのフォルダです');
  const text = fs.readFileSync(file, 'utf8');
  let r; try { r = patchAuth(text); } catch (e) { fail(e.message); }
  const report = { mode: apply ? 'APPLIED' : 'DRY_RUN', file, sha256Before: sha(text), sha256After: sha(r.text), removedLines: r.removedLines, addedLines: r.addedLines, productionOAuthTouched: false };
  if (apply) {
    fs.mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, 'P25CopySpotifyAuth.js.orig-' + report.sha256Before.slice(0, 8));
    fs.writeFileSync(backup, text);
    if (sha(fs.readFileSync(backup, 'utf8')) !== report.sha256Before) fail('BACKUP_VERIFY_FAILED');
    fs.writeFileSync(file, r.text); report.backup = backup;
  }
  console.log(JSON.stringify(report, null, 2));
}
