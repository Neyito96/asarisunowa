// Phase25 → V2 新着収蔵アダプタ（COPY専用）。2026-11-11 司令塔指令（PR #306）。
// - 列は見出し名で解決（列番号ハードコード無し）。V2・統合台帳の見出し集合と完全一致しなければ停止。
// - 追記のみ（既存行は書かない）。最大 maxRows 行（既定1）。書込後に読み戻して全列一致を確認。
// - 保護対象（V1原本・V2作業用正本・本番59列・旧GAS参照シート）への書込は ID 一致に関係なく拒否。
// - 新着は 掲載判定=未判定 で入れる → V2・公開台帳(FILTER 対象かつ代表=自分)に出ない。再配信・重複は HOLD/BLOCK。
// GAS では本ファイルのみを COPY 専用の独立プロジェクトに置く。本番プロジェクト・トリガーは変更しない。

var P25V2_PROTECTED_IDS_ = [
  '1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', // V1 完全保全
  '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', // V2 作業用（正本）
  '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', // 本番 59列台帳
  '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'  // 既存GAS SPREADSHEET_ID
];
var P25V2_SHEET_ = 'V2・統合台帳';
var P25V2_SCOPE_ = 'V2_INGEST_APPEND_ONLY';
var P25V2_HEADERS_ = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '代表EP-ID', '同一内容ID', '公式GUID', '公式JSON UUID', '公式個別URL', 'Omny埋込URL', '旧元ページURL', '再生時間 秒', '概要（清掃済）', '出演者', '関連記事URL', '音声URL', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube', '番組RSS', '画像URL', '文字起こし出典URL', '所属ID', '公式JSON取得元', '元EP-ID', '除外・保留理由', '判定根拠', '備考', '再生状態'];
var P25V2_LINKS_ = ['Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube'];
// 入力 item のキー → V2 見出し（ここに無い見出しは空欄で書く。保全対象は既存行に一切触れないことで守る）
var P25V2_ITEM_MAP_ = { show: '番組', title: 'タイトル', date: '配信日時 JST', guid: '公式GUID', jsonUuid: '公式JSON UUID', officialUrl: '公式個別URL', embedUrl: 'Omny埋込URL', sourceUrl: '旧元ページURL', duration: '再生時間 秒', summaryCleaned: '概要（清掃済）', cast: '出演者', relatedUrls: '関連記事URL', audioUrl: '音声URL', rss: '番組RSS', image: '画像URL', playlistId: '所属ID', note: '備考' };

function p25v2T_(v) { return String(v == null ? '' : v).trim(); }
function p25v2Schema_(header) {
  var h = (header || []).map(p25v2T_), idx = {};
  h.forEach(function (name, i) { if (name) { if (idx[name] !== undefined) throw new Error('V2_SCHEMA_DUPLICATE ' + name); idx[name] = i; } });
  var missing = P25V2_HEADERS_.filter(function (n) { return idx[n] === undefined; });
  var extra = Object.keys(idx).filter(function (n) { return P25V2_HEADERS_.indexOf(n) < 0; });
  if (missing.length || extra.length) throw new Error('V2_SCHEMA_MISMATCH missing=' + missing.join('|') + ' extra=' + extra.join('|'));
  return { idx: idx, width: h.length };
}
function p25v2UrlKey_(x) {
  var s = p25v2T_(x); if (!/^https?:\/\//i.test(s)) return '';
  s = s.replace(/#.*$/, '').replace(/([?&])(utm_[a-z]+|iref|si)=[^&]*/gi, '$1').replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/\/$/, '');
  return s.toLowerCase();
}
function p25v2Guids_(rec) {
  var out = [];
  [rec.guid, rec.jsonUuid, rec.officialUrl].forEach(function (v) {
    var m = p25v2T_(v).toLowerCase().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g); if (m) out = out.concat(m);
  });
  return out.filter(function (g, i) { return out.indexOf(g) === i; });
}
var P25V2_RERUN_ = /[（(【\[]\s*再(放送|配信)?\s*[）)】\]]|再配信|再放送/;
function p25v2TitleKey_(show, title) { return p25v2T_(show) + '\u0000' + p25v2T_(title).normalize('NFKC').replace(P25V2_RERUN_, '').replace(/\s+/g, '').toLowerCase(); }
function p25v2Records_(values) {
  var s = p25v2Schema_(values[0]);
  var rows = values.slice(1).map(function (r, i) {
    var g = function (n) { return p25v2T_(r[s.idx[n]]); };
    return { row: i + 2, epId: g('EP-ID'), show: g('番組'), title: g('タイトル'), judge: g('掲載判定'), rep: g('代表EP-ID'), guid: g('公式GUID'), jsonUuid: g('公式JSON UUID'), officialUrl: g('公式個別URL') };
  });
  return { schema: s, rows: rows };
}
// 新着の判定。ALREADY_INGESTED（同GUID・同番組・同題）は再実行時の正常系（追加0）。
function p25v2Classify_(rows, items) {
  var byId = {}, byGuid = {}, byUrl = {}, byTitle = {};
  rows.forEach(function (r) {
    if (r.epId) byId[r.epId] = r;
    p25v2Guids_(r).forEach(function (g) { (byGuid[g] = byGuid[g] || []).push(r); });
    var u = p25v2UrlKey_(r.officialUrl); if (u) byUrl[u] = r;
    if (r.title) byTitle[p25v2TitleKey_(r.show, r.title)] = r;
  });
  var seenG = {}, seenU = {};
  return items.map(function (it) {
    var reasons = [], gs = p25v2Guids_(it), u = p25v2UrlKey_(it.officialUrl);
    if (!p25v2T_(it.show) || !p25v2T_(it.title) || !p25v2T_(it.date) || !gs.length) reasons.push('MISSING_REQUIRED');
    if (it.epId && byId[it.epId]) reasons.push('EP_ID_EXISTS');
    var hit = []; gs.forEach(function (g) { (byGuid[g] || []).forEach(function (r) { hit.push(r); }); });
    if (hit.length) {
      var same = hit.every(function (r) { return r.show === p25v2T_(it.show) && p25v2TitleKey_(r.show, r.title) === p25v2TitleKey_(it.show, it.title); });
      if (same) return { item: it, decision: 'ALREADY_INGESTED', reasons: ['GUID_PRESENT_SAME_SHOW_TITLE'], existing: hit[0].epId };
      reasons.push('GUID_EXISTS');
    }
    if (gs.some(function (g) { return seenG[g]; })) reasons.push('GUID_REPEATED_IN_INPUT');
    if (u && byUrl[u]) reasons.push('OFFICIAL_URL_EXISTS');
    if (u && seenU[u]) reasons.push('OFFICIAL_URL_REPEATED_IN_INPUT');
    var hold = [];
    if (P25V2_RERUN_.test(p25v2T_(it.title).normalize('NFKC'))) hold.push('RERUN_MARK');
    if (byTitle[p25v2TitleKey_(it.show, it.title)]) hold.push('SAME_SHOW_TITLE');
    gs.forEach(function (g) { seenG[g] = 1; }); if (u) seenU[u] = 1;
    var decision = reasons.length ? 'BLOCK' : hold.length ? 'HOLD' : 'CANDIDATE';
    return { item: it, decision: decision, reasons: reasons.concat(hold) };
  });
}
function p25v2NextEpId_(rows, reservedMax) {
  var max = Number(reservedMax || 0);
  rows.forEach(function (r) { var m = r.epId.match(/^EP-(\d{5})$/); if (m) max = Math.max(max, +m[1]); });
  return 'EP-' + ('0000' + (max + 1)).slice(-5);
}
function p25v2BuildRow_(schema, item, epId) {
  var row = []; for (var i = 0; i < schema.width; i++) row.push('');
  row[schema.idx['EP-ID']] = epId; row[schema.idx['代表EP-ID']] = epId; row[schema.idx['掲載判定']] = '未判定';
  Object.keys(P25V2_ITEM_MAP_).forEach(function (k) { if (item[k] !== undefined) row[schema.idx[P25V2_ITEM_MAP_[k]]] = p25v2T_(item[k]); });
  P25V2_LINKS_.forEach(function (n) { if (item.links && item.links[n]) row[schema.idx[n]] = p25v2T_(item.links[n]); });
  row[schema.idx['判定根拠']] = 'P25V2収蔵: 公式GUID新規・未審査（公開は人の判定後）';
  return row;
}
// 公開計数（V2・公開台帳 FILTER と同じ条件）。未判定・保留・対象外・再配信は入らない。
function p25v2PublicCount_(rows) { return rows.filter(function (r) { return r.judge === '対象' && r.rep === r.epId; }).length; }

// 書込先の検証（純関数）。actual = 実際に開いたファイルの {id, name, sheetName}
function p25v2AssertCopyTarget_(config, actual, forWrite) {
  config = config || {}; actual = actual || {};
  var t = p25v2T_(config.targetSpreadsheetId);
  if (P25V2_PROTECTED_IDS_.indexOf(t) >= 0 || P25V2_PROTECTED_IDS_.indexOf(p25v2T_(actual.id)) >= 0) throw new Error('PROTECTED_TARGET_REFUSED');
  if (config.environment !== 'COPY') throw new Error('COPY_ENV_REQUIRED');
  if (!t || t !== p25v2T_(config.expectedTargetId)) throw new Error('TARGET_ID_UNCONFIRMED');
  if (p25v2T_(actual.id) !== t) throw new Error('OPENED_ID_MISMATCH');
  if (!/COPY/.test(p25v2T_(actual.name))) throw new Error('TARGET_NAME_NOT_COPY');
  if (config.sheetName !== P25V2_SHEET_ || actual.sheetName !== P25V2_SHEET_) throw new Error('SHEET_NAME_MISMATCH');
  if (config.scope !== P25V2_SCOPE_) throw new Error('SCOPE_MISMATCH');
  if (forWrite && config.write !== true) throw new Error('WRITE_FLAG_OFF');
  return true;
}

// 中核処理（I/O 注入）。io: open() -> {id,name,sheetName}, readAll() -> values, appendRow(row) -> rowNumber, readRow(n) -> values[]
function p25v2Ingest_(io, config, items, opts) {
  opts = opts || {};
  var write = opts.write === true, maxRows = Math.min(Number(opts.maxRows || 1), 1);
  var actual = io.open();
  p25v2AssertCopyTarget_(config, actual, write);
  var before = io.readAll(), recs = p25v2Records_(before);
  var decisions = p25v2Classify_(recs.rows, items || []);
  var count = function (d) { return decisions.filter(function (x) { return x.decision === d; }).length; };
  var res = { mode: write ? 'COPY_WRITE' : 'READ_ONLY_DRY_RUN', rowsBefore: recs.rows.length, publicBefore: p25v2PublicCount_(recs.rows),
    counts: { CANDIDATE: count('CANDIDATE'), HOLD: count('HOLD'), BLOCK: count('BLOCK'), ALREADY_INGESTED: count('ALREADY_INGESTED') },
    decisions: decisions.map(function (d) { return { guid: p25v2Guids_(d.item)[0] || '', show: p25v2T_(d.item.show), decision: d.decision, reasons: d.reasons, existing: d.existing || '' }; }),
    added: 0, addedEpIds: [] };
  var todo = decisions.filter(function (d) { return d.decision === 'CANDIDATE'; }).slice(0, maxRows);
  if (!write || !todo.length) return res;
  var reserved = Number(config.reservedMaxEpNo || 0);
  todo.forEach(function (d) {
    var epId = p25v2NextEpId_(recs.rows, reserved), row = p25v2BuildRow_(recs.schema, d.item, epId);
    p25v2AssertCopyTarget_(config, io.open(), true);              // 書込直前に再検証
    var after = io.readAll();
    // Detect in-place edits as well as new/deleted rows. Row count alone is insufficient.
    if (after.length !== before.length || JSON.stringify(after) !== JSON.stringify(before)) throw new Error('LEDGER_CHANGED_SINCE_READ');
    p25v2Schema_(after[0]);
    var n = io.appendRow(row);
    if (n !== before.length + 1) throw new Error('APPEND_POSITION_UNEXPECTED');
    var back = io.readRow(n).map(p25v2T_);
    var want = row.map(p25v2T_);
    if (JSON.stringify(back.slice(0, want.length)) !== JSON.stringify(want)) throw new Error('READBACK_MISMATCH');
    res.added++; res.addedEpIds.push(epId); res.readbackOk = true; res.writtenRow = n;
    recs.rows.push({ row: n, epId: epId, show: d.item.show, title: d.item.title, judge: '未判定', rep: epId, guid: d.item.guid, jsonUuid: d.item.jsonUuid || '', officialUrl: d.item.officialUrl || '' });
  });
  res.publicAfter = p25v2PublicCount_(recs.rows);
  return res;
}

// GAS 用 I/O（COPY 専用プロジェクトで手動実行。トリガーは作らない）
function p25v2GasIo_(config) {
  var ss = null, sh = null;
  return {
    open: function () { ss = SpreadsheetApp.openById(config.targetSpreadsheetId); sh = ss.getSheetByName(config.sheetName); return { id: ss.getId(), name: ss.getName(), sheetName: sh ? sh.getName() : '' }; },
    readAll: function () { return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(); },
    appendRow: function (row) { var n = sh.getLastRow() + 1; sh.getRange(n, 1, 1, row.length).setValues([row]); SpreadsheetApp.flush(); return n; },
    readRow: function (n) { return sh.getRange(n, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; }
  };
}
function P25V2_INGEST_COPY(config, items, write) { return p25v2Ingest_(p25v2GasIo_(config), config, items, { write: write === true, maxRows: 1 }); }

if (typeof module !== 'undefined' && module.exports) module.exports = { schema: p25v2Schema_, classify: p25v2Classify_, records: p25v2Records_, buildRow: p25v2BuildRow_, nextEpId: p25v2NextEpId_, publicCount: p25v2PublicCount_, assertCopyTarget: p25v2AssertCopyTarget_, ingest: p25v2Ingest_, HEADERS: P25V2_HEADERS_, PROTECTED: P25V2_PROTECTED_IDS_, SHEET: P25V2_SHEET_, SCOPE: P25V2_SCOPE_ };
