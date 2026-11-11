// COPY 小バッチ収蔵の「計画 → 書込 → 検証」を固定化（GAS実機の代わりに Sheets API で書く場合）。判定・採番・行生成はすべてアダプタが行う。
// plan   : node p25v2-copy-batch.mjs plan   <COPY 統合 A1:J.json> <採番履歴.json> <収蔵詳細.json|none> <rss-items.json> <maxRowsCap> <copyId> <copyName> <out.json> [readonly]
//          readonly を付けると全候補の予定採番だけを出す（書込計画なし）
// verify : node p25v2-copy-batch.mjs verify <plan.json> <読み戻し 統合 A{start}:AH{end}.json(values)>
import fs from 'node:fs'; import vm from 'node:vm';
const sb = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../google-apps-script/P25V2IngestAdapter.js', import.meta.url), 'utf8'), sb);
const A = sb.module.exports, H = [...A.HEADERS];
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const trimRows = (v) => { const r = v.map((x) => [...x]); while (r.length && !r[r.length - 1].some((c) => String(c ?? '').trim())) r.pop(); return r; };
const [mode, ...a] = process.argv.slice(2);
const di = H.indexOf('配信日時 JST');
const dk = (v) => { const m = String(v ?? '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/); return m ? [m[1], +m[2], +m[3], +m[4], m[5]].join('-') : String(v ?? '').trim(); };
const norm = (r) => H.map((_, i) => (i === di ? dk(r[i]) : String(r[i] ?? '').trim()));
if (mode === 'plan') {
  const [ledF, numF, detF, rssF, cap, id, name, out, ro] = a;
  const led = trimRows(J(ledF).values), vals = [H, ...led.slice(1).map((r) => H.map((_, i) => r[i] ?? ''))];
  const num = trimRows(J(numF).values), det = detF === 'none' ? [[...A.DETAIL_HEADERS]] : trimRows(J(detF).values);
  const items = J(rssF).items, now = new Date().toISOString();
  const P = { numbering: null, ledger: null, details: null, marks: [] }; let planned = [];
  const io = { open: () => ({ id, name, sheetName: A.SHEET }), readAll: () => vals.map((r) => [...r]), readNumbering: () => num,
    appendNumberingRows: (rows) => { P.numbering = { startRow: num.length + 1, rows }; return num.length + 1; },
    appendRows: (rows) => { planned = rows; P.ledger = { startRow: led.length + 1, rows }; return led.length + 1; }, readRows: () => planned,
    readDetails: () => det, appendDetails: (rows) => { P.details = { startRow: det.length + 1, rows }; return det.length + 1; },
    markNumberingRows: (list) => { P.marks.push(...list); } };
  const cfg = { environment: 'COPY', targetSpreadsheetId: id, expectedTargetId: id, sheetName: A.SHEET, scope: A.SCOPE, write: !ro, maxRowsCap: +cap };
  const r = A.ingest(io, cfg, items, { write: !ro, maxRows: +cap, planAll: !!ro, now: () => now, sha256: () => '' });
  const outObj = { mode: r.mode, at: now, counts: r.counts, rowsBefore: r.rowsBefore, publicBefore: r.publicBefore, publicAfter: r.publicAfter, plan: r.plan,
    hold: r.decisions.filter((d) => d.decision === 'HOLD'), block: r.decisions.filter((d) => d.decision === 'BLOCK'), metadataChange: r.decisions.filter((d) => d.decision === 'METADATA_CHANGE'), repaired: r.numberingRepaired, writes: ro ? null : P };
  fs.writeFileSync(out, JSON.stringify(outObj, null, 1));
  console.log(JSON.stringify({ mode: r.mode, counts: r.counts, plan: r.plan.map((p) => p.epId + (p.reused ? '(再利用)' : '')).join(' '), ledgerStart: P.ledger?.startRow, numberingStart: P.numbering?.startRow, detailsStart: P.details?.startRow, marks: P.marks.length, repaired: r.numberingRepaired }));
} else if (mode === 'verify') {
  const [planF, rbF] = a;
  const P = J(planF).writes, rb = J(rbF).values;
  const bad = P.ledger.rows.map((w, i) => (JSON.stringify(norm(rb[i] || [])) === JSON.stringify(norm(w)) ? null : w[0])).filter(Boolean);
  console.log(JSON.stringify({ rows: P.ledger.rows.length, readbackMismatch: bad }));
  if (bad.length) process.exit(2);
}
