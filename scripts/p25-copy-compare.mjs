#!/usr/bin/env node
// READ-ONLY comparison of the existing COPY `コード.js` with the Phase25 COPY files.
// Writes ONLY into --out (a folder outside the COPY working folder). Never edits, deletes or pushes anything.
//
// Usage: node scripts/p25-copy-compare.mjs --old ~/p25-copy-backup/コード.js [--new-dir scripts/google-apps-script] --out ~/p25-copy-report
// Output: report.md, report.json, dump/<name>.old.js|.new.js (full differing functions), and (for review only) legacy-renamed/P25CopyLegacy410.js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const NEW_FILES = ['P25LibraryPipeline.js', 'P25CopyAdapter.js', 'P25CopyOwnership.js', 'P25CopySession20261107.js', 'P25CopyToken.js'];
const HERE = path.dirname(fileURLToPath(import.meta.url));

// Walks source skipping strings/comments; returns top-level (depth 0) function declarations and const/let/var.
export function parseTopLevel(text) {
  const items = []; const warnings = [];
  let i = 0, depth = 0, line = 1; const n = text.length;
  const lineAt = pos => text.slice(0, pos).split('\n').length;
  let pending = null;
  while (i < n) {
    const c = text[i], d = text[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '/' && d !== '/' && d !== '*') {
      let k = i - 1; while (k >= 0 && /\s/.test(text[k])) k--;
      if (k < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(text[k]) || /\b(?:return|typeof|case|in|of)$/.test(text.slice(Math.max(0, k - 6), k + 1))) {
        let j = i + 1, cls = false;
        while (j < n && text[j] !== '\n' && (cls || text[j] !== '/')) { if (text[j] === '\\') j++; else if (text[j] === '[') cls = true; else if (text[j] === ']') cls = false; j++; }
        if (text[j] === '/') { i = j + 1; continue; }
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n && text[i] !== q) { if (text[i] === '\\') i++; if (q !== '`' && text[i] === '\n') break; i++; }
      i++; continue;
    }
    if (depth === 0 && (i === 0 || text[i - 1] === '\n')) {
      const m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(text.slice(i, i + 400));
      if (m) pending = { name: m[1] || m[3], kind: m[1] ? 'function' : 'const', params: (m[2] || '').replace(/\s+/g, ''), start: i, startLine: lineAt(i) };
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0 && pending && c === '}' && pending.kind === 'function') {
        pending.end = i + 1; pending.endLine = lineAt(i); pending.body = text.slice(pending.start, pending.end); items.push(pending); pending = null;
      }
      if (depth < 0) { warnings.push('UNBALANCED near line ' + lineAt(i)); depth = 0; }
    }
    if (depth === 0 && c === ';' && pending && pending.kind === 'const') {
      pending.end = i + 1; pending.endLine = lineAt(i); pending.body = text.slice(pending.start, pending.end); items.push(pending); pending = null;
    }
    i++;
  }
  if (depth !== 0) warnings.push('UNBALANCED at end of file (depth ' + depth + ')');
  return { items, warnings };
}

export const normalize = body => body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

const RULES = {
  AUTH: /token|Bearer|OAuth|Authorization|PropertiesService|Credential|client_secret|refresh/i,
  CONFIG: /openById|openByUrl|SPREADSHEET_ID|copyScriptId|stateSheetId|requestSheetId|ScriptApp\.getScriptId|getActiveSpreadsheet|COPY_|SHEET_NAME/i,
  WRITE: /method\s*:\s*["'](?:post|put|delete|patch)["']|\.(?:setValue|setValues|appendRow|deleteRow|deleteRows|clearContent|clear|insertRow|setProperty|setProperties|deleteProperty)\s*\(|ScriptApp\.(?:newTrigger|deleteTrigger)|\.create\s*\(/i,
  SPOTIFY: /api\.spotify\.com|spotify:episode|spotify\.com/i,
  TRIGGER_OR_ENTRY: /ScriptApp\.newTrigger|onOpen|onEdit|doGet|doPost/
};
export function flags(body) { const out = []; for (const [k, re] of Object.entries(RULES)) if (re.test(body)) out.push(k); if (!out.includes('WRITE')) out.push('READ_ONLY'); return out; }

// Line-level diff summary (LCS on normalized lines; capped so huge functions do not blow up).
export function lineDiff(a, b, cap = 400) {
  const A = a.split('\n').map(s => s.trim()).filter(Boolean).slice(0, cap), B = b.split('\n').map(s => s.trim()).filter(Boolean).slice(0, cap);
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < A.length && j < B.length) { if (A[i] === B[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(A[i++]); else added.push(B[j++]); }
  while (i < A.length) removed.push(A[i++]); while (j < B.length) added.push(B[j++]);
  return { removed, added };
}

export function compare(oldText, newFiles) {
  const old = parseTopLevel(oldText);
  const news = []; const warnings = old.warnings.map(w => 'old: ' + w);
  for (const [file, text] of Object.entries(newFiles)) { const p = parseTopLevel(text); p.warnings.forEach(w => warnings.push(file + ': ' + w)); p.items.forEach(it => news.push({ ...it, file })); }
  const oldBy = new Map(old.items.map(x => [x.name, x]));
  const newBy = new Map(); const dupNew = [];
  for (const x of news) { if (newBy.has(x.name)) dupNew.push(x.name); newBy.set(x.name, x); }
  const collisions = [];
  for (const [name, o] of oldBy) {
    const nw = newBy.get(name); if (!nw) continue;
    const same = normalize(o.body) === normalize(nw.body);
    const of = flags(o.body), nf = flags(nw.body);
    const protectedOld = of.some(f => ['AUTH', 'CONFIG', 'TRIGGER_OR_ENTRY'].includes(f));
    const d = same ? { removed: [], added: [] } : lineDiff(o.body, nw.body);
    let action;
    if (same) action = 'IDENTICAL: 重複のみ。新側を採用して問題なし';
    else if (protectedOld) action = 'PROTECT_OLD: 認証・設定・入口の可能性。旧実装を別名で保持し、人が差分を確認するまで置換しない';
    else if (of.includes('READ_ONLY') && !nf.includes('READ_ONLY')) action = 'REVIEW: 旧は読み取り専用、新は書き込みを含む。置換前に必ず確認';
    else action = 'RENAME_OLD: 旧を別名で保持(旧からの呼び出しは旧同士で完結させる)';
    collisions.push({ name, same, oldFile: 'コード.js', oldLines: [o.startLine, o.endLine], newFile: nw.file, newLines: [nw.startLine, nw.endLine], oldParams: o.params, newParams: nw.params, signatureChanged: o.params !== nw.params, oldFlags: of, newFlags: nf, oldHash: sha(normalize(o.body)), newHash: sha(normalize(nw.body)), removedLines: d.removed.length, addedLines: d.added.length, diffSample: { removed: d.removed.slice(0, 12), added: d.added.slice(0, 12) }, action });
  }
  const oldOnly = old.items.filter(x => !newBy.has(x.name)).map(x => ({ name: x.name, lines: [x.startLine, x.endLine], flags: flags(x.body) }));
  // Entry points / string references that renaming would break (menus, triggers, google.script.run, setHandlerFunction).
  const dumps = collisions.filter(c => !c.same).map(c => ({ name: c.name, old: oldBy.get(c.name).body, nw: newBy.get(c.name).body }));
  const colNames = new Set(collisions.filter(c => !c.same).map(c => c.name));
  const stringRefs = [];
  for (const m of oldText.matchAll(/["'`]([A-Za-z_$][\w$]*)["'`]/g)) if (colNames.has(m[1])) stringRefs.push(m[1]);
  return { dumps, oldCount: old.items.length, newCount: news.length, collisions, oldOnly, dupNew, stringRefs: [...new Set(stringRefs)], warnings };
}

// Review-only copy of the old file with colliding (different) functions renamed; the original is never touched.
export function renameLegacy(oldText, names, suffix = '_legacy410') {
  let out = oldText;
  for (const n of names) out = out.replace(new RegExp('(?<![\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])', 'g'), n + suffix);
  return out;
}

function report(r, oldInfo) {
  const L = [];
  L.push('# COPY コード.js と Phase25 新4ファイルの比較(読み取り専用)', '');
  L.push(`- 旧 コード.js: ${oldInfo.lines} 行 / sha256 ${oldInfo.sha}`, `- 旧の最上位定義: ${r.oldCount} 件、新4ファイル: ${r.newCount} 件`, `- 名前の衝突: **${r.collisions.length} 件**(完全一致 ${r.collisions.filter(c => c.same).length}、相違 ${r.collisions.filter(c => !c.same).length})`);
  if (r.warnings.length) L.push('- 解析の警告(要目視): ' + r.warnings.join(' / '));
  if (r.dupNew.length) L.push('- 新4ファイル内の重複定義: ' + r.dupNew.join(', '));
  L.push('', '## 衝突した関数', '', '| 関数 | 旧(行) | 新(ファイル:行) | 引数変更 | 旧の性質 | 新の性質 | 差分(−/+) | 判定 |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const c of r.collisions) L.push(`| ${c.name} | ${c.oldLines.join('-')} | ${c.newFile}:${c.newLines.join('-')} | ${c.signatureChanged ? '**あり**' : 'なし'} | ${c.oldFlags.join(',')} | ${c.newFlags.join(',')} | ${c.removedLines}/${c.addedLines} | ${c.action.split(':')[0]} |`);
  L.push('', '## 相違のある関数の差分(先頭12行まで)');
  for (const c of r.collisions.filter(x => !x.same)) { L.push('', `### ${c.name} — ${c.action}`, '旧にだけある行:', ...c.diffSample.removed.map(x => '- `' + x.slice(0, 140) + '`'), '新にだけある行:', ...c.diffSample.added.map(x => '- `' + x.slice(0, 140) + '`')); }
  L.push('', '## 文字列で参照されている衝突名(改名すると壊れる可能性)', r.stringRefs.length ? r.stringRefs.map(x => '- ' + x).join('\n') : '- なし');
  L.push('', '## 旧にだけあり衝突しない定義(そのまま残る)', '', r.oldOnly.map(x => `- ${x.name} (${x.lines.join('-')}) [${x.flags.join(',')}]`).join('\n') || '- なし');
  L.push('', '## 安全な移行案', '',
    '1. 旧 `コード.js` は削除・上書きしない。バックアップ(sha256 一致済み)を正本として保持。',
    '2. 判定が PROTECT_OLD / REVIEW の関数は、管理者が差分を確認するまで置換しない。',
    '3. 衝突解消: 旧の相違関数だけを `_legacy410` 付きの別名にした **新ファイル** `P25CopyLegacy410.js` を作り(このスクリプトが legacy-renamed/ に生成)、旧 `コード.js` は同じ名前を二重定義しないよう、承認後に1回だけ置き換える。',
    '4. この置き換え(= COPY 上の `コード.js` の削除)は clasp push 時の**削除**になるため、別承認が必要。それまで push しない。',
    '5. 文字列参照・トリガー・入口(上の表)は、改名後の動作を COPY で読み取り専用の関数から先に確認する。');
  return L.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a, []));
  if (!args.old || !args.out) { console.error('Usage: node scripts/p25-copy-compare.mjs --old <コード.js> --out <report dir> [--new-dir <dir>]'); process.exit(2); }
  const outDir = path.resolve(args.out); const oldPath = path.resolve(args.old);
  if (outDir === path.dirname(oldPath) || outDir.startsWith(path.dirname(oldPath) + path.sep)) { console.error('REFUSED: --out は旧ファイルのあるフォルダの中に置けません'); process.exit(2); }
  const newDir = path.resolve(args['new-dir'] || path.join(HERE, 'google-apps-script'));
  const oldText = fs.readFileSync(oldPath, 'utf8');
  const files = Object.fromEntries(NEW_FILES.map(f => [f, fs.readFileSync(path.join(newDir, f), 'utf8')]));
  const r = compare(oldText, files);
  fs.mkdirSync(path.join(outDir, 'legacy-renamed'), { recursive: true });
  const info = { lines: oldText.split('\n').length, sha: crypto.createHash('sha256').update(oldText).digest('hex') };
  // Full, untruncated bodies of every differing function, split at statement boundaries so `git diff --no-index --word-diff` is readable.
  fs.mkdirSync(path.join(outDir, 'dump'), { recursive: true });
  const spread = t => t.replace(/([;{}])(?=[^\n])/g, '$1\n');
  for (const d of r.dumps) { fs.writeFileSync(path.join(outDir, 'dump', d.name + '.old.js'), spread(d.old) + '\n'); fs.writeFileSync(path.join(outDir, 'dump', d.name + '.new.js'), spread(d.nw) + '\n'); }
  delete r.dumps;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ old: info, ...r }, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), report(r, info));
  fs.writeFileSync(path.join(outDir, 'legacy-renamed', 'P25CopyLegacy410.js'), '// REVIEW ONLY: 旧 コード.js の複製。相違する衝突関数を _legacy410 に改名。COPY へは未反映。\n' + renameLegacy(oldText, r.collisions.filter(c => !c.same).map(c => c.name)));
  console.log(report(r, info));
  console.log('出力先:', outDir, '(旧ファイルは変更していません)');
}
