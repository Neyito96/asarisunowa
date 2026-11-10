/** 台帳(蔵)の出演者の確定変更を、既存エピソードへ増分反映する。純粋関数・IOなし・固定件数に依存しない。
 * 真値は台帳のみ(X列=23, AT〜AX列=45〜49)。抽出器(gap-audit extractCast)や補完提案の値はここでは一切使わない=人間が確定した出演者を推測で上書きしない。
 * 台帳側が空欄の時は既存値を消さない(誤って空にしない)。反映は冪等: 同じ入力で再実行しても変更0。 */
import {dedupeCast} from './library-core.mjs';
export const ledgerCast = row => dedupeCast([row?.[23], ...(row?.slice?.(45, 50) || [])]);
const key = s => String(s || '').normalize('NFKC').replace(/\s+/g, '');
export const castNames = cast => String(cast || '').split(/\s+\/\s+/).map(p => key(p.split(/[,，（(]/)[0])).filter(Boolean);
/** existing: 公開側エピソード配列(cast文字列を持つ)。rows: Map(EP-ID → 台帳55列行)。入力は変更しない。 */
export function refreshCastFromLedger(existing, rows) {
  const changes = [], episodes = existing.map(e => ({...e}));
  let keptBlank = 0, missingInLedger = 0;
  for (const e of episodes) {
    const r = rows.get(e.id);
    if (!r) { missingInLedger++; continue; }
    const next = ledgerCast(r), cur = String(e.cast || '');
    if (!next) { if (cur) keptBlank++; continue; }
    if (next === cur) continue;
    changes.push({id: e.id, show: e.show, kind: cur ? 'CAST_CHANGED' : 'CAST_ADDED', before: castNames(cur), after: castNames(next)});
    e.cast = next;
  }
  return {episodes, changes, keptBlank, missingInLedger};
}
/** 詳細・番組別一覧・検索索引の3系統が同じ出演者を持つか。stores: {details:[ep], pages:[ep], search:[ep]}。 */
export function verifyCastConsistency({details, pages, search}) {
  const m = new Map();
  for (const [name, list] of Object.entries({details, pages, search})) for (const e of list) (m.get(e.id) || m.set(e.id, {}).get(e.id))[name] = String(e.cast || '');
  const mismatches = [];
  for (const [id, v] of m) { const vals = new Set(Object.values(v)); if (Object.keys(v).length < 3 || vals.size > 1) mismatches.push({id, stores: Object.keys(v), distinct: vals.size}); }
  return {episodes: m.size, mismatches};
}
/** 番組内の出演者別件数(castフィールド基準)。固定値ではなく実データから集計する。 */
export function castCountsForShow(episodes, show) {
  const counts = {};
  for (const e of episodes) if (e.show === show) for (const n of new Set(castNames(e.cast))) counts[n] = (counts[n] || 0) + 1;
  return counts;
}
