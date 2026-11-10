/** 台帳(蔵)の清掃済み概要(W列=22)を、既存エピソードへ増分反映する。純粋関数・IOなし・固定件数なし。
 * 清掃済み(W)が真値。Wが空なら既存値を消さない・清掃済み→原文へ戻さない(既存の概要清掃を壊さない)。原文(V列=21)は既存が空のときだけ補う。冪等。 */
import {plainDescription} from './library-core.mjs';
export function refreshDescriptionFromLedger(existing, rows) {
  const changes = [], episodes = existing.map(e => ({...e})); let keptBlank = 0, missingInLedger = 0;
  for (const e of episodes) {
    const r = rows.get(e.id); if (!r) { missingInLedger++; continue; }
    const clean = r[22] ? plainDescription(r[22]) : '', raw = r[21] ? plainDescription(r[21]) : '';
    if (clean) { if (clean !== e.description || e.descriptionSource !== 'clean') { changes.push({id: e.id, show: e.show, kind: e.descriptionSource === 'clean' ? 'DESC_CLEAN_CHANGED' : 'DESC_CLEANED', beforeSource: e.descriptionSource || 'missing'}); e.description = clean; e.descriptionSource = 'clean'; } continue; }
    if (e.descriptionSource === 'clean' || (e.description && e.descriptionSource !== 'missing')) { keptBlank++; continue; } // Wが空でも既存の概要は保全
    if (raw) { changes.push({id: e.id, show: e.show, kind: 'DESC_RAW_ADDED', beforeSource: e.descriptionSource || 'missing'}); e.description = raw; e.descriptionSource = 'raw-rendered'; }
  }
  return {episodes, changes, keptBlank, missingInLedger};
}
/** 蔵→宇宙の検証。期待値は台帳行から導出(W優先)。詳細(details)と検索索引(keywords文字列の先頭)が同じ概要か。ids指定で対象(公開対象)を絞る。 */
export function verifyDescriptions(rows, {details, search}, {ids = null} = {}) {
  const by = new Map(details.map(e => [e.id, e])), sx = new Map(search.map(e => [e.id, e])), set = ids ? new Set(ids) : null;
  const r = {checked: 0, ledgerHasClean: 0, reflectedClean: 0, cleanNotReflected: [], mismatchDetailVsSearch: [], missingInPreview: [], ledgerBlankBoth: []};
  for (const [id, row] of rows) {
    if (set && !set.has(id)) continue; const e = by.get(id); if (!e) { r.missingInPreview.push(id); continue; } r.checked++;
    const clean = row[22] ? plainDescription(row[22]) : '', raw = row[21] ? plainDescription(row[21]) : '';
    if (!clean && !raw) r.ledgerBlankBoth.push(id);
    if (clean) { r.ledgerHasClean++; if (e.description === clean && e.descriptionSource === 'clean') r.reflectedClean++; else r.cleanNotReflected.push({id, source: e.descriptionSource || 'missing'}); }
    const s = sx.get(id); if (!s || !String(Array.isArray(s.keywords) ? s.keywords[0] : s.keywords || '').startsWith(e.description)) r.mismatchDetailVsSearch.push(id);
  }
  r.pass = !r.cleanNotReflected.length && !r.mismatchDetailVsSearch.length && !r.missingInPreview.length; return r;
}
