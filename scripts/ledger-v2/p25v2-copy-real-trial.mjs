// 実RSSの新着1件で COPY 収蔵を行うための計画/検証（GAS実機の代わりに Sheets API で書く場合の手順を固定化）。
// plan  : node p25v2-copy-real-trial.mjs plan  <COPY A1:J json> <採番履歴 json> <item json> <採番履歴の次の空き行> <copyId> <copyName>  → plan.json
// verify: node p25v2-copy-real-trial.mjs verify <COPY A1:J json(書込後)> <採番履歴 json(書込後)> <item json> <plan.json> <台帳読戻し行 json配列> <採番読戻し行 json配列> <copyId> <copyName>
import fs from 'node:fs'; import vm from 'node:vm';
const sb = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../google-apps-script/P25V2IngestAdapter.js', import.meta.url), 'utf8'), sb);
const A = sb.module.exports, H = [...A.HEADERS];
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const pad = (vals) => [H, ...vals.slice(1).filter((r) => r.some((v) => String(v ?? '').trim())).map((r) => { const o = H.map(() => ''); r.forEach((v, c) => { if (c < H.length) o[c] = v ?? ''; }); return o; })];
const [mode, ...a] = process.argv.slice(2);
const cfgOf = (id) => ({ environment: 'COPY', targetSpreadsheetId: id, expectedTargetId: id, sheetName: A.SHEET, scope: A.SCOPE, write: true });
if (mode === 'plan') {
  const [ledgerF, numF, itemF, nextNumRow, id, name] = a;
  const vals = pad(J(ledgerF).values), num = J(numF).values.map((r) => [...r]), item = J(itemF);
  const plan = { ledger: null, numbering: null, mark: null };
  const io = { open: () => ({ id, name, sheetName: A.SHEET }), readAll: () => vals.map((r) => [...r]), readNumbering: () => num,
    appendNumbering: (row) => { plan.numbering = { row: +nextNumRow, values: row }; return +nextNumRow; },
    appendRow: (row) => { plan.ledger = { row: vals.length + 1, values: row }; return vals.length + 1; }, readRow: () => plan.ledger.values,
    markNumbering: (n, state, at, lr) => { plan.mark = { row: n, state, at, ledgerRow: lr }; } };
  const r = A.ingest(io, cfgOf(id), [item], { write: true, now: () => new Date().toISOString() });
  plan.result = { added: r.added, epIds: r.addedEpIds, counts: r.counts, publicBefore: r.publicBefore, publicAfter: r.publicAfter, rowsBefore: r.rowsBefore };
  fs.writeFileSync('plan.json', JSON.stringify(plan, null, 1)); console.log(JSON.stringify(plan.result), JSON.stringify({ ledgerRow: plan.ledger?.row, numberingRow: plan.numbering?.row }));
} else if (mode === 'verify') {
  const [ledgerF, numF, itemF, planF, rbLedger, rbNum, id, name] = a;
  const plan = J(planF), item = J(itemF), di = H.indexOf('配信日時 JST');
  const dk = (v) => { const m = String(v).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/); return m ? [m[1], +m[2], +m[3], +m[4], m[5]].join('-') : String(v).trim(); };
  const T = (x) => H.map((_, i) => (i === di ? dk((x || [])[i] ?? '') : String((x || [])[i] ?? '').trim()));
  const readbackOk = JSON.stringify(T(JSON.parse(rbLedger))) === JSON.stringify(T(plan.ledger.values));
  const nb = JSON.parse(rbNum), numOk = nb[0] === plan.numbering.values[0] && nb[1] === plan.numbering.values[1] && (nb[4] === '登録完了' || nb[4] === '採番済');
  const marks = [];
  const vals = pad(J(ledgerF).values), num = J(numF).values;
  let appends = 0;
  const io = { open: () => ({ id, name, sheetName: A.SHEET }), readAll: () => vals, readNumbering: () => num, appendNumbering: () => { appends++; return 0; }, appendRow: () => { appends++; return 0; }, readRow: () => [], markNumbering: (n, st, at, lr) => { marks.push({ row: n, state: st, at, ledgerRow: lr }); } };
  const r = A.ingest(io, cfgOf(id), [item], { write: true });
  const out = { readbackOk, numberingOk: numOk, rowsAfter: vals.length - 1, rerun: { added: r.added, counts: r.counts, writeCalls: appends, existing: r.decisions[0].existing }, numberingState: nb[4], numberingRepairPlanned: marks, publicAfter: r.publicBefore };
  fs.writeFileSync('verify.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
}
