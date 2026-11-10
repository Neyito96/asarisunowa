#!/usr/bin/env node
// 台帳W列(概要清掃済み)の受け渡しファイル(JSON Lines)を検証し、公開データの概要だけを非破壊で差分反映する。
// 受け渡しファイルは公開リポジトリへコミットしない(docs/design/2026-11-10-ledger-transfer-protocol.md)。レポートに本文は出さない。
// 使い方:
//   node scripts/apply-description-transfer.mjs --check TRANSFER.jsonl DATA_DIR [REPORT.json]        # 書込なし。要修正件数を確定
//   node scripts/apply-description-transfer.mjs --write TRANSFER.jsonl SRC_DIR OUT_DIR [REPORT.json]  # SRCは変更せずOUTへ出力
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {plainDescription} from '../public/library/library-core.mjs';
import {refreshDescriptionFromLedger} from '../public/library/description-sync.mjs';
import {writePublicLibrarySnapshot} from './library-publication-files.mjs';
const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
export const RESIDUE = [[/[\w.+-]+@[\w-]+(\.[\w-]+)+/, 'EMAIL'], [/mailto:/i, 'MAILTO'], [/(?:0\d{1,4}-\d{1,4}-\d{3,4})/, 'PHONE']];
/** JSON Lines → {meta, rows: Map(id→row55), problems:[{id,code}], held:Set(id)}。1行目の {"_meta":{...}} は任意。 */
export function parseTransfer(text) {
  const rows = new Map(), problems = [], held = new Set(), seen = new Set(); let meta = null, n = 0;
  for (const [i, line] of String(text).replace(/^﻿/, '').split(/\r?\n/).entries()) {
    if (!line.trim()) continue; let o; try { o = JSON.parse(line); } catch { problems.push({line: i + 1, code: 'BAD_JSON'}); continue; }
    if (o._meta) { meta = o._meta; continue; } n++;
    if (!/^EP-\d{5}$/.test(o.id || '')) { problems.push({line: i + 1, code: 'BAD_ID'}); continue; }
    if (seen.has(o.id)) { problems.push({id: o.id, code: 'DUPLICATE_ID'}); rows.delete(o.id); held.add(o.id); continue; } seen.add(o.id); // 重複は両方とも採用しない
    const w = typeof o.w === 'string' ? o.w.replace(/\r\n?/g, '\n') : '';
    if (!w.trim()) { problems.push({id: o.id, code: 'W_BLANK'}); continue; }
    if (o.wSha256 && o.wSha256 !== sha(w) && o.wSha256 !== sha(o.w)) { problems.push({id: o.id, code: 'SHA_MISMATCH'}); held.add(o.id); continue; }
    if (o.wLen != null && o.wLen !== [...w].length && o.wLen !== [...o.w].length) { problems.push({id: o.id, code: 'LEN_MISMATCH'}); held.add(o.id); continue; }
    const hit = RESIDUE.find(([re]) => re.test(w)); if (hit) { problems.push({id: o.id, code: 'PUBLIC_RESIDUE:' + hit[1]}); held.add(o.id); continue; } // 個人情報らしき文字列: 公開データへ入れない
    const row = new Array(55).fill(''); row[0] = o.id; row[22] = w; rows.set(o.id, row);
  }
  return {meta, rows, problems, held, lines: n};
}
const loadDetails = async dir => { const o = []; for (const f of await readdir(join(dir, 'details'))) o.push(...JSON.parse(await readFile(join(dir, 'details', f), 'utf8'))); return o; };
/** 公開データ(details)とW列の照合。本文は返さない。 */
export function checkAgainst(details, rows, expectedIds = null) {
  const r = {published: 0, inTransfer: 0, alreadyReflected: 0, needChange: 0, needChangeFromRaw: 0, needChangeFromOtherClean: 0, notInTransfer: [], transferNotPublished: [], byShow: {}};
  const by = new Map(details.map(e => [e.id, e])), want = expectedIds ? new Set(expectedIds) : null;
  for (const e of details) { if (want && !want.has(e.id)) continue; r.published++;
    const row = rows.get(e.id); if (!row) { r.notInTransfer.push(e.id); continue; } r.inTransfer++;
    const clean = plainDescription(row[22]), s = r.byShow[e.show] || (r.byShow[e.show] = {ok: 0, need: 0});
    if (e.description === clean && e.descriptionSource === 'clean') { r.alreadyReflected++; s.ok++; }
    else { r.needChange++; s.need++; if (e.descriptionSource === 'raw-rendered') r.needChangeFromRaw++; else r.needChangeFromOtherClean++; } }
  for (const id of rows.keys()) if (!by.has(id)) r.transferNotPublished.push(id);
  return r;
}
export async function applyTransfer(transferPath, src, dest) {
  const t = parseTransfer(await readFile(transferPath, 'utf8')), ex = await loadDetails(src);
  const scope = JSON.parse(await readFile(join(src, 'scope.json'), 'utf8')), man = JSON.parse(await readFile(join(src, 'manifest.json'), 'utf8'));
  const cr = refreshDescriptionFromLedger(ex, t.rows); await mkdir(dest, {recursive: true});
  await writePublicLibrarySnapshot({episodes: cr.episodes, counts: man.counts, publicationScope: scope, snapshotDate: man.snapshotDate, destination: dest});
  const mp = join(dest, 'manifest.json'), nm = JSON.parse(await readFile(mp, 'utf8')); if (man.preview) nm.preview = man.preview; await writeFile(mp, JSON.stringify(nm) + '\n');
  const kinds = {}; for (const c of cr.changes) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
  return {changed: cr.changes.length, kinds, keptBlank: cr.keptBlank, problems: t.problems, held: [...t.held], total: ex.length, changedIds: cr.changes.map(c => c.id)};
}
if (process.argv[1] && process.argv[1].endsWith('apply-description-transfer.mjs')) {
  const [, , mode, tp, a, b, c] = process.argv;
  if (mode === '--check') {
    const t = parseTransfer(await readFile(tp, 'utf8')), rep = {transfer: {lines: t.lines, accepted: t.rows.size, problems: t.problems, meta: t.meta}, ...checkAgainst(await loadDetails(a), t.rows)};
    console.log(JSON.stringify({...rep, notInTransfer: rep.notInTransfer.length, transferNotPublished: rep.transferNotPublished.length}, null, 1)); if (b) await writeFile(b, JSON.stringify(rep, null, 1));
  } else if (mode === '--write') { const rep = await applyTransfer(tp, a, b); console.log(JSON.stringify({...rep, changedIds: rep.changedIds.length}, null, 1)); if (c) await writeFile(c, JSON.stringify(rep, null, 1)); }
  else throw Error('Usage: --check TRANSFER.jsonl DATA_DIR [REPORT] | --write TRANSFER.jsonl SRC_DIR OUT_DIR [REPORT]');
}
