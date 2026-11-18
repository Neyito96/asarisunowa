// 実RSS(item JSON) × V2統合台帳スナップショット の READ_ONLY 判定。書込なし。台帳本文は出力しない（件数・EP-ID・GUIDのみ）。
// usage: node v2-ingest-dryrun.mjs <V2 A1:H json> <V2 I1:J json> <rss-items.json> [out.json]
import fs from 'node:fs'; import vm from 'node:vm';
const sb = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../google-apps-script/P25V2IngestAdapter.js', import.meta.url), 'utf8'), sb);
const A = sb.module.exports, H = [...A.HEADERS];
const [ah, ij, rssFile, out = 'v2-ingest-dryrun.json'] = process.argv.slice(2);
const t = JSON.parse(fs.readFileSync(ah)).values, q = JSON.parse(fs.readFileSync(ij)).values;
const vals = [H, ...t.slice(1).map((r, i) => { const o = H.map(() => ''); for (let c = 0; c < 8; c++) o[c] = r[c] ?? ''; o[8] = (q[i + 1] || [])[0] ?? ''; o[9] = (q[i + 1] || [])[1] ?? ''; return o; })];
const rss = JSON.parse(fs.readFileSync(rssFile));
const io = { open: () => ({ id: 'DRY', name: 'DRY COPY', sheetName: A.SHEET }), readAll: () => vals, appendRow() { throw Error('READ_ONLY'); }, readRow() { throw Error('READ_ONLY'); } };
const cfg = { environment: 'COPY', targetSpreadsheetId: 'DRY', expectedTargetId: 'DRY', sheetName: A.SHEET, scope: A.SCOPE, write: false };
const r = A.ingest(io, cfg, rss.items, { write: false });
const by = {}; r.decisions.forEach((d, i) => { const k = d.decision; (by[k] = by[k] || []).push({ show: d.show, guid: d.guid, date: rss.items[i].date, reasons: d.reasons, existing: d.existing }); });
const res = { mode: r.mode, rssFetchedAt: rss.fetchedAt, feedStatus: rss.feedStatus, rowsBefore: r.rowsBefore, publicBefore: r.publicBefore, counts: r.counts, candidates: by.CANDIDATE || [], hold: by.HOLD || [], block: by.BLOCK || [], metadataChange: by.METADATA_CHANGE || [] };
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ counts: r.counts, rowsBefore: r.rowsBefore, publicBefore: r.publicBefore, candidates: res.candidates.map((x) => x.show + ' ' + x.date), hold: res.hold.map((x) => x.show + ' ' + x.reasons), block: res.block.map((x) => x.reasons.join('+')), meta: res.metadataChange.length }));
