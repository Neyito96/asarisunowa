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
import { fileURLToPath } from 'node:url';

export const COPY_SCRIPT_ID = '16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R';
export const PRODUCTION_SCRIPT_ID = '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9';
export const COPY_FILES = ['P25LibraryPipeline.js', 'P25CopyAdapter.js', 'P25CopyOwnership.js', 'P25CopySession20261107.js'];
// Files that exist only in the production project. Seeing one in the pulled folder = wrong project.
export const PRODUCTION_ONLY = ['P25ProdIo.js', 'P25Ownership.js', 'P25SpotifyTarget.js', 'AutoUpdateAutomationV1.js', 'AutoUpdateRequest.js', 'ThemeV3SingleSheet.js', 'PlaylistAutoWrite.js'];
const SOURCE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'google-apps-script');

export function planStage(pulledDir, sourceDir = SOURCE_DIR) {
  const problems = [];
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
  const preserved = present.filter(f => !COPY_FILES.includes(f));
  return { ok: problems.length === 0, problems, files, preserved, deletes: [] };
}

export function applyStage(pulledDir, sourceDir = SOURCE_DIR) {
  const plan = planStage(pulledDir, sourceDir);
  if (!plan.ok) throw new Error('STAGE_REFUSED: ' + plan.problems.join(' | '));
  for (const f of plan.files) if (f.action !== 'same') fs.copyFileSync(path.join(sourceDir, f.name), path.join(pulledDir, f.name));
  return plan;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [dir, flag] = process.argv.slice(2);
  if (!dir) { console.error('Usage: node scripts/p25-copy-stage.mjs <PULLED_COPY_DIR> [--apply]'); process.exit(2); }
  const plan = flag === '--apply' ? applyStage(dir) : planStage(dir);
  console.log(JSON.stringify({ mode: flag === '--apply' ? 'APPLIED' : 'DRY_RUN', ...plan }, null, 2));
  process.exit(plan.ok ? 0 : 1);
}
