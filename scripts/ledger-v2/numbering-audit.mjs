// 採番履歴（固定ID採番履歴）× V2統合台帳 × 本番59列 の READ_ONLY 整合監査と、COPY用の非破壊バックフィル行の生成。
// 出力 report には EP-ID・GUID・件数のみ（題名などの台帳本文は backfill-rows.json 側＝コミットしない）。
// usage: node numbering-audit.mjs <採番履歴.json> <V2 A1:H.json> <V2 I1:J.json> <本番59列 A1:K.json> <削除EP一覧.json> <outDir> [fromEp=EP-06641] [toEp=EP-06694]
import fs from 'node:fs';
const [numF, ahF, ijF, prodF, delF, outDir, fromEp = 'EP-06641', toEp = 'EP-06694'] = process.argv.slice(2);
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const U = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const no = (e) => +String(e).slice(3);
const num = J(numF).values, ah = J(ahF).values, ij = J(ijF).values, prod = J(prodF).values, del = J(delF);
if (num[0][0] !== 'GUID' || num[0][1] !== '固定ID') throw new Error('NUMBERING_SCHEMA');
if (ah[0][0] !== 'EP-ID' || ah[0][7] !== '公式GUID') throw new Error('V2_SCHEMA');
const hist = num.slice(1).map((r, i) => ({ row: i + 2, guid: String(r[0] || '').toLowerCase(), ep: String(r[1] || ''), state: String(r[4] || '') })).filter((h) => h.guid || h.ep);
const v2 = ah.slice(1).map((r, i) => { const g = new Set([...(String(r[7] || '') + ' ' + (ij[i + 1] || []).join(' ')).matchAll(U)].map((m) => m[0].toLowerCase())); return { row: i + 2, ep: r[0] || '', show: r[1] || '', title: r[2] || '', guids: [...g] }; }).filter((r) => r.ep);
const prodGuid = new Map(); prod.slice(1).forEach((r) => { [...(String(r[6] || '') + ' ' + (r[9] || '')).matchAll(U)].forEach((m) => prodGuid.set(m[0].toLowerCase(), r[0])); });
const deleted = new Set(Object.values(del).flat());
const byEp = new Map(v2.map((r) => [r.ep, r])), histByEp = new Map(), histByGuid = new Map();
hist.forEach((h) => { (histByEp.get(h.ep) || histByEp.set(h.ep, []).get(h.ep)).push(h); (histByGuid.get(h.guid) || histByGuid.set(h.guid, []).get(h.guid)).push(h); });
const prodEps = new Set(prod.slice(1).map((r) => r[0]).filter(Boolean));
const allEps = new Set([...v2.map((r) => r.ep), ...prodEps, ...hist.map((h) => h.ep), ...deleted]);
const maxOf = (it) => Math.max(0, ...[...it].map(no));
const r = {
  generatedAt: new Date().toISOString(), counts: { history: hist.length, v2Eps: v2.length, prod59Eps: prodEps.size, deletedEps: deleted.size },
  max: { history: 'EP-' + String(maxOf(hist.map((h) => h.ep))).padStart(5, '0'), v2: 'EP-' + String(maxOf(v2.map((x) => x.ep))).padStart(5, '0'), prod59: 'EP-' + String(maxOf(prodEps)).padStart(5, '0') },
  historyDuplicateEp: [...histByEp].filter(([, v]) => v.length > 1).map(([k]) => k),
  historyDuplicateGuid: [...histByGuid].filter(([, v]) => v.length > 1).map(([k]) => k),
  historyGuidMismatchWithLedger: hist.filter((h) => byEp.has(h.ep) && !byEp.get(h.ep).guids.includes(h.guid)).map((h) => ({ ep: h.ep, historyGuid: h.guid, ledgerGuids: byEp.get(h.ep).guids })),
  historyGuidOnOtherLedgerEp: hist.filter((h) => v2.some((x) => x.ep !== h.ep && x.guids.includes(h.guid))).map((h) => h.ep),
  historyEpNotInV2: hist.filter((h) => !byEp.has(h.ep)).map((h) => ({ ep: h.ep, deleted: deleted.has(h.ep), inProd59: prodEps.has(h.ep) })),
  historyNotCompleted: hist.filter((h) => h.state !== '登録完了').map((h) => ({ ep: h.ep, state: h.state })),
  v2EpsMissingFromHistory: { total: v2.filter((x) => !histByEp.has(x.ep)).length, inRange: v2.filter((x) => !histByEp.has(x.ep) && no(x.ep) >= no(fromEp) && no(x.ep) <= no(toEp)).map((x) => x.ep) },
  unusedNumbersBelowMax: (() => { const m = maxOf(allEps), u = []; for (let i = 1; i <= m; i++) { const e = 'EP-' + String(i).padStart(5, '0'); if (!allEps.has(e)) u.push(e); } return u; })(),
};
r.unusedNumbersBelowMaxCount = r.unusedNumbersBelowMax.length; r.unusedNumbersBelowMax = r.unusedNumbersBelowMax.slice(0, 50);
// バックフィル（範囲内・GUID 1件で一意・他EPと衝突なし・本番59列と同一GUID）のみ
const bf = [], bfHold = [];
for (const ep of r.v2EpsMissingFromHistory.inRange) {
  const x = byEp.get(ep), g = x.guids;
  const why = g.length !== 1 ? 'GUID_COUNT_' + g.length : histByGuid.has(g[0]) ? 'GUID_ALREADY_IN_HISTORY' : v2.some((y) => y.ep !== ep && y.guids.includes(g[0])) ? 'GUID_SHARED_WITH_OTHER_EP' : prodGuid.get(g[0]) !== ep ? 'PROD59_MISMATCH' : '';
  if (why) bfHold.push({ ep, why }); else bf.push({ ep, guid: g[0], row: [g[0], ep, x.show, x.title, '登録完了', '', '', String(x.row), 'P25V2遡及記録(2026-11-11): V2統合台帳から。採番日時は不明'] });
}
r.backfill = { eligible: bf.length, hold: bfHold, epIds: bf.map((b) => b.ep) };
r.idSafety = { rule: 'next = max(V2, 本番59列, 採番履歴, 削除済み一覧) + 1。欠番は再利用しない。同GUIDの採番済は同番号を再利用', nextIfIngestedNow: 'EP-' + String(maxOf(allEps) + 1).padStart(5, '0') };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outDir + '/numbering-audit.json', JSON.stringify(r, null, 1));
fs.writeFileSync(outDir + '/backfill-rows.json', JSON.stringify(bf.map((b) => b.row)));
console.log(JSON.stringify({ counts: r.counts, max: r.max, dupEp: r.historyDuplicateEp.length, dupGuid: r.historyDuplicateGuid.length, guidMismatch: r.historyGuidMismatchWithLedger.length, guidOnOther: r.historyGuidOnOtherLedgerEp.length, histNotInV2: r.historyEpNotInV2.length, notCompleted: r.historyNotCompleted, missing: r.v2EpsMissingFromHistory.total, missingInRange: r.v2EpsMissingFromHistory.inRange.length, unused: r.unusedNumbersBelowMaxCount, backfill: r.backfill.eligible, backfillHold: r.backfill.hold, next: r.idSafety.nextIfIngestedNow }));
