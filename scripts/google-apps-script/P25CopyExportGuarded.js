// Guarded COPY-only exporter (replaces P25_COPY_EXPORT_NEW_ROWS_20261110). NOT installed until the admin approves.
// Guarantees: ledger is only READ (no setValue/append/delete on it); fixed EP-ID set; fixed column allowlist;
// one output file per approval (idempotent, recorded in Script Properties); hard row cap; expiry stamped in the sheet;
// stops on any anomaly; logs counts only (no cell values).
var P25_EXPORT_COLS_ = [0,1,2,3,6,8,9,10,11,12,14,15,21,22,23,38,43,45,46,47,48,49]; // same 22 columns as the 11/10 sheet
var P25_EXPORT_MAX_ROWS_ = 200;
var P25_EXPORT_PROP_ = "P25_EXPORT_APPROVAL";

// Pure + unit-tested. values = full ledger grid; spec = {minExclusive:"EP-06591", refresh:[...], maxRows}
function p25ExportPlan_(values, spec) {
  const problems = [];
  if (!Array.isArray(values) || values.length < 2) return {problems: ["LEDGER_EMPTY"], rows: []};
  const header = values[0];
  if (String(header[0]) !== "台帳ID" || String(header[1]) !== "番組名" || String(header[2]) !== "タイトル") problems.push("LEDGER_HEADER_MISMATCH");
  const refresh = {}; (spec.refresh || []).forEach(function(id) { refresh[id] = true; });
  const rows = [], seen = {};
  values.slice(1).forEach(function(r) {
    const id = String(r[0]);
    if (!/^EP-\d{5}$/.test(id)) return;
    if (!(id > spec.minExclusive || refresh[id])) return;
    if (seen[id]) problems.push("DUPLICATE_ID"); seen[id] = true;
    rows.push(P25_EXPORT_COLS_.map(function(c) { return r[c]; }));
  });
  const max = spec.maxRows || P25_EXPORT_MAX_ROWS_;
  if (rows.length === 0) problems.push("NO_ROWS");
  if (rows.length > max) problems.push("ROW_CAP_EXCEEDED");
  (spec.refresh || []).forEach(function(id) { if (!seen[id]) problems.push("REFRESH_ID_MISSING"); });
  return {problems: problems, rows: rows, header: P25_EXPORT_COLS_.map(function(c) { return header[c]; })};
}
// Pure: may this run create a file? approval = parsed property or null.
function p25ExportMayRun_(approval, nowMs) {
  if (!approval) return {ok: false, reason: "NO_APPROVAL_RECORD"};
  if (approval.sheetId) return {ok: false, reason: "ALREADY_EXPORTED", sheetId: approval.sheetId};
  if (approval.creating) return {ok: false, reason: "PREVIOUS_RUN_INCOMPLETE"}; // 作成途中で失敗した可能性: 自動再実行せず人間が確認
  if (!approval.approvedBy || !approval.expiresOn) return {ok: false, reason: "APPROVAL_INCOMPLETE"};
  if (Date.parse(approval.expiresOn) < nowMs) return {ok: false, reason: "APPROVAL_EXPIRED"};
  return {ok: true};
}
// Admin (or a Claude run explicitly approved by the admin) records ONE approval: {approvedBy, expiresOn:"2026-11-24"}.
function P25_COPY_EXPORT_NEW_ROWS_GUARDED() {
  const config = p25CopySessionConfig20261107_();
  p25CopyIo_(config); // COPY isolation identity check
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(P25_EXPORT_PROP_);
  const gate = p25ExportMayRun_(raw ? JSON.parse(raw) : null, Date.now());
  if (!gate.ok) { console.log(JSON.stringify({status: "STOP", reason: gate.reason, created: false})); return {status: "STOP", reason: gate.reason}; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {status: "BUSY"};
  try {
    const approval = JSON.parse(props.getProperty(P25_EXPORT_PROP_));
    if (approval.sheetId) return {status: "STOP", reason: "ALREADY_EXPORTED"}; // re-check under lock
    const sheet = SpreadsheetApp.openById(config.ledgerSheetId).getSheetByName("エピソード台帳"); // read only
    const values = sheet.getRange(1, 1, sheet.getLastRow(), 50).getValues(); // only the columns the allowlist needs
    const plan = p25ExportPlan_(values, {minExclusive: "EP-06591", refresh: approval.refresh || [], maxRows: P25_EXPORT_MAX_ROWS_});
    if (plan.problems.length) { console.log(JSON.stringify({status: "STOP", problems: plan.problems, created: false})); return {status: "STOP", problems: plan.problems}; }
    approval.creating = true; props.setProperty(P25_EXPORT_PROP_, JSON.stringify(approval)); // 先に作成中マーカー: 作成後の保存失敗でも二重作成しない
    const fmt = function(v) { return v instanceof Date ? Utilities.formatDate(v, "Asia/Tokyo", "yyyy/MM/dd HH:mm") : v; };
    const out = [plan.header].concat(plan.rows.map(function(r) { return r.map(fmt); }));
    const ss = SpreadsheetApp.create("朝リス宇宙プレビュー用_派生コピー_期限" + approval.expiresOn + "_削除対象");
    const tab = ss.getSheets()[0].setName("rows");
    tab.getRange(1, 1, out.length, out[0].length).setValues(out);
    tab.getRange(out.length + 2, 1).setValue("一時派生コピー。期限 " + approval.expiresOn + " を過ぎたら削除。共有禁止。");
    approval.sheetId = ss.getId(); approval.creating = false; approval.createdRows = plan.rows.length;
    props.setProperty(P25_EXPORT_PROP_, JSON.stringify(approval)); // one file per approval
    const result = {status: "OK", rows: plan.rows.length, cols: out[0].length, ledgerWritten: false, spotifyWrite: false};
    console.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}
