#!/usr/bin/env node
// Safe staging for the Phase25 COPY Apps Script project.
//
// WHY: `clasp push` from scripts/google-apps-script/ would upload ALL ~90 production files to the COPY
// project and delete COPY-only files. Instead: `clasp pull` the COPY project into an EMPTY folder, run this
// script on that folder (dry run, then --apply), review `clasp status`, and only then (with approval) push.
//
// Usage: node scripts/p25-copy-stage.mjs <PULLED_COPY_DIR> [--apply]
// Never touches the repository's production folder, appsscript.json or .clasp.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const COPY_SCRIPT_ID = '16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R';
export const PRODUCTION_SCRIPT_ID = '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9';
export const COPY_FILES = ['P25LibraryPipeline.js', 'P25CopyAdapter.js', 'P25CopyOwnership.js', 'P25CopySession20261107.js', 'P25CopyToken.js'];
// Files that exist only in the production project. Seeing one in the pulled folder = wrong project.
export const PRODUCTION_ONLY = ['P25ProdIo.js', 'P25Ownership.js', 'P25SpotifyTarget.js', 'AutoUpdateAutomationV1.js', 'AutoUpdateRequest.js', 'ThemeV3SingleSheet.js', 'PlaylistAutoWrite.js'];
const SOURCE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'google-apps-script');

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const globals = text => new Set([...text.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1] || m[2]));
// sha256 of every file in the folder (top level + subfolders), used to prove nothing else changed.
export function snapshot(dir) {
  const out = {};
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else out[path.relative(dir, f)] = sha(f);
  });
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

export function planStage(pulledDir, sourceDir = SOURCE_DIR, opts = {}) {
  const problems = [];
  const retire = opts.retire ? String(opts.retire) : '';
  const claspPath = path.join(pulledDir, '.clasp.json');
  if (!fs.existsSync(claspPath)) problems.push('NO_CLASP_JSON: 先に COPY プロジェクトを clasp pull した空のフォルダを指定してください');
  else {
    const id = JSON.parse(fs.readFileSync(claspPath, 'utf8')).scriptId;
    if (id === PRODUCTION_SCRIPT_ID) problems.push('PRODUCTION_SCRIPT_ID: 本番プロジェクトです。中止します');
    else if (id !== COPY_SCRIPT_ID) problems.push('UNKNOWN_SCRIPT_ID: COPY のスクリプトIDではありません');
  }
  if (!fs.existsSync(path.join(pulledDir, 'appsscript.json'))) problems.push('NO_MANIFEST: appsscript.json がありません(pull が未完了)');
  const present = fs.existsSync(pulledDir) ? fs.readdirSync(pulledDir) : [];
  for (const f of PRODUCTION_ONLY) if (present.includes(f)) problems.push('PRODUCTION_FILE_PRESENT: ' + f);
  const files = COPY_FILES.map(name => {
    const src = path.join(sourceDir, name), dst = path.join(pulledDir, name);
    if (!fs.existsSync(src)) { problems.push('SOURCE_MISSING: ' + name); return { name, action: 'missing' }; }
    const next = fs.readFileSync(src, 'utf8');
    const action = !fs.existsSync(dst) ? 'add' : fs.readFileSync(dst, 'utf8') === next ? 'same' : 'update';
    return { name, action };
  });
  // GAS shares one global namespace: a name defined in a COPY file AND in a file that stays would break the project.
  const mine = new Set();
  for (const f of files) if (f.action !== 'missing') globals(fs.readFileSync(path.join(sourceDir, f.name), 'utf8')).forEach(n => mine.add(n));
  // Legacy retirement: the old single-file COPY script (コード.js) is moved OUT of the folder (never deleted here), only if
  //  (a) a backup with the identical SHA-256 exists, (b) it is not one of the 4 files, and (c) every top-level name it defines
  //  is redefined by the 4 new files, so no function disappears from the COPY project.
  let retireInfo = null;
  if (retire) {
    const rf = path.join(pulledDir, retire);
    if (retire !== path.basename(retire) || COPY_FILES.includes(retire) || retire === 'appsscript.json') problems.push('RETIRE_NOT_ALLOWED: ' + retire);
    else if (!fs.existsSync(rf)) problems.push('RETIRE_FILE_MISSING: ' + retire);
    else {
      const sum = sha(rf);
      if (!opts.backup || !fs.existsSync(opts.backup)) problems.push('RETIRE_BACKUP_REQUIRED: --backup に退避済みファイルを指定してください');
      else if (sha(opts.backup) !== sum) problems.push('RETIRE_BACKUP_MISMATCH: バックアップとCOPY上のファイルのSHA-256が一致しません');
      if (opts.expectSha && opts.expectSha !== sum) problems.push('RETIRE_SHA_UNEXPECTED: 想定したSHA-256と異なります');
      const oldNames = globals(fs.readFileSync(rf, 'utf8'));
      const orphans = [...oldNames].filter(n => !mine.has(n));
      if (orphans.length) problems.push('RETIRE_ORPHAN_DEFINITIONS: 新4ファイルに無い定義が消えます: ' + orphans.join(', '));
      retireInfo = { file: retire, sha256: sum, definitions: oldNames.size, replacedByNew: [...oldNames].filter(n => mine.has(n)).length };
    }
  }
  for (const other of present.filter(f => /\.(js|gs)$/.test(f) && !COPY_FILES.includes(f) && f !== retire)) {
    for (const n of globals(fs.readFileSync(path.join(pulledDir, other), 'utf8'))) if (mine.has(n)) problems.push('GLOBAL_NAME_COLLISION: ' + n + ' (' + other + ')');
  }
  const preserved = present.filter(f => !COPY_FILES.includes(f) && f !== retire);
  return { ok: problems.length === 0, problems, files, preserved, deletes: retireInfo ? [retireInfo.file] : [], retire: retireInfo };
}

export function applyStage(pulledDir, sourceDir = SOURCE_DIR, opts = {}) {
  const plan = planStage(pulledDir, sourceDir, opts);
  if (!plan.ok) throw new Error('STAGE_REFUSED: ' + plan.problems.join(' | '));
  const before = snapshot(pulledDir);
  if (plan.retire) {
    // Move (copy + remove) the legacy file into a sibling folder inside this LOCAL work dir; clasp push will then delete it remotely (separate approval).
    const retiredDir = path.resolve(pulledDir) + '-retired';
    fs.mkdirSync(retiredDir, { recursive: true });
    fs.copyFileSync(path.join(pulledDir, plan.retire.file), path.join(retiredDir, plan.retire.file));
    if (sha(path.join(retiredDir, plan.retire.file)) !== plan.retire.sha256) throw new Error('RETIRE_COPY_VERIFY_FAILED');
    fs.unlinkSync(path.join(pulledDir, plan.retire.file));
  }
  for (const f of plan.files) if (f.action !== 'same') fs.copyFileSync(path.join(sourceDir, f.name), path.join(pulledDir, f.name));
  // Proof: only the 4 allowed files may differ afterwards; every other file is byte-identical and none vanished.
  const after = snapshot(pulledDir);
  const changed = Object.keys(after).filter(k => before[k] !== after[k]);
  const removed = Object.keys(before).filter(k => !(k in after));
  const stray = changed.filter(k => !COPY_FILES.includes(k));
  const allowedRemoved = plan.retire ? [plan.retire.file] : [];
  const badRemoved = removed.filter(k => !allowedRemoved.includes(k));
  // After the overlay, no top-level name may be defined twice anywhere in the project (all 24 collisions resolved).
  const owners = new Map(), duplicates = [];
  for (const f of fs.readdirSync(pulledDir).filter(x => /\.(js|gs)$/.test(x))) for (const n of globals(fs.readFileSync(path.join(pulledDir, f), 'utf8'))) { if (owners.has(n)) duplicates.push(n + ' (' + owners.get(n) + ', ' + f + ')'); else owners.set(n, f); }
  if (stray.length || badRemoved.length || duplicates.length) throw new Error('STAGE_VERIFY_FAILED: ' + JSON.stringify({ stray, removed: badRemoved, duplicates }));
  return { ...plan, changed, removed, duplicateGlobals: duplicates, verified: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2); const opt = {}; const rest = [];
  for (let k = 0; k < argv.length; k++) { if (argv[k] === '--apply') opt.apply = true; else if (argv[k] === '--retire') opt.retire = argv[++k]; else if (argv[k] === '--backup') opt.backup = argv[++k]; else if (argv[k] === '--expect-sha') opt.expectSha = argv[++k]; else rest.push(argv[k]); }
  const dir = rest[0];
  if (!dir) { console.error('Usage: node scripts/p25-copy-stage.mjs <PULLED_COPY_DIR> [--retire コード.js --backup <backup file> [--expect-sha <sha256>]] [--apply]'); process.exit(2); }
  let out;
  try { out = opt.apply ? applyStage(dir, SOURCE_DIR, opt) : planStage(dir, SOURCE_DIR, opt); } catch (e) { console.error(String(e.message)); process.exit(1); }
  console.log(JSON.stringify({ mode: opt.apply ? 'APPLIED' : 'DRY_RUN', ...out }, null, 2));
  process.exit(out.ok ? 0 : 1);
}
