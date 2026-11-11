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

// ---- 公式RSS → item（第1段階: 基本収蔵に必要な識別子＋後日補完用の原文を保持）----
// 許可ホストは P25CopyAdapter.readSources と同じ（公式フィードのみ）。
var P25V2_FEED_HOST_ = /^https:\/\/(?:omny\.fm|www\.omnycontent\.com|feeds\.megaphone\.fm)\//;
function p25v2XmlText_(s) {
  s = String(s == null ? '' : s);
  var cd = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/); if (cd) return cd[1].trim();
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, '&').trim();
}
function p25v2Tag_(block, tag) { var m = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>')); return m ? p25v2XmlText_(m[1]) : ''; }
function p25v2Attr_(block, tag, attr) { var m = block.match(new RegExp('<' + tag + '\\s[^>]*' + attr + '="([^"]*)"')); return m ? p25v2XmlText_(m[1]) : ''; }
// RFC822 → V2形式 "YYYY/M/D HH:mm"（JST）
function p25v2JstDate_(rfc) {
  var t = Date.parse(rfc); if (isNaN(t)) return '';
  var d = new Date(t + 9 * 3600e3), p = function (n) { return ('0' + n).slice(-2); };
  return d.getUTCFullYear() + '/' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
function p25v2DateKey_(v) { var m = p25v2T_(v).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/); return m ? [m[1], +m[2], +m[3], +m[4], m[5]].join('-') : p25v2T_(v); }
function p25v2Seconds_(v) { var s = p25v2T_(v); if (/^\d+$/.test(s)) return s; var a = s.split(':').map(Number); if (a.some(isNaN)) return ''; return String(a.reduce(function (x, y) { return x * 60 + y; }, 0)); }
// feedUrl は台帳 V2「番組RSS」に記録されている公式URL。show は V2 の番組名（設定で対応付け）。limit は新しい順の最大件数（差分取得）。
function p25v2ParseRss_(xml, feedUrl, show, limit) {
  if (!P25V2_FEED_HOST_.test(String(feedUrl))) throw new Error('UNVERIFIED_FEED_HOST');
  var x = String(xml || ''); if (x.indexOf('<channel') < 0) throw new Error('FEED_INVALID');
  var blocks = x.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  var chanImg = p25v2Attr_(x.split('<item')[0], 'itunes:image', 'href');
  var out = blocks.map(function (b) {
    var g = p25v2Tag_(b, 'guid');
    return { show: show, title: p25v2Tag_(b, 'title'), date: p25v2JstDate_(p25v2Tag_(b, 'pubDate')), pubDate: p25v2Tag_(b, 'pubDate'),
      guid: (g.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [g])[0].toLowerCase(),
      sourceUrl: p25v2Tag_(b, 'link'), audioUrl: p25v2Attr_(b, 'enclosure', 'url'), duration: p25v2Seconds_(p25v2Tag_(b, 'itunes:duration')),
      image: p25v2Attr_(b, 'itunes:image', 'href') || chanImg, rss: feedUrl,
      descriptionRaw: p25v2Tag_(b, 'content:encoded') || p25v2Tag_(b, 'description') };
  });
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}

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
      var own = p25v2T_(it.guid).toLowerCase(), hg = hit.length === 1 ? p25v2Guids_(hit[0]) : [];
      var sameShow = hit.length === 1 && hit[0].show === p25v2T_(it.show) && hg.indexOf(own) >= 0 && gs.every(function (g) { return !byGuid[g] || byGuid[g][0] === hit[0]; });
      if (sameShow) return { item: it, decision: 'METADATA_CHANGE', reasons: ['GUID_PRESENT_TITLE_CHANGED'], existing: hit[0].epId };   // 記録のみ・書かない
      reasons.push('GUID_EXISTS');
    }
    if (gs.some(function (g) { return seenG[g]; })) reasons.push('GUID_REPEATED_IN_INPUT');
    if (u && byUrl[u]) reasons.push('OFFICIAL_URL_EXISTS');
    if (u && seenU[u]) reasons.push('OFFICIAL_URL_REPEATED_IN_INPUT');
    var hold = [];
    if (!/^\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}$/.test(p25v2T_(it.date))) reasons.push('DATE_FORMAT');
    if (P25V2_RERUN_.test(p25v2T_(it.title).normalize('NFKC'))) hold.push('RERUN_MARK');
    if (byTitle[p25v2TitleKey_(it.show, it.title)]) hold.push('SAME_SHOW_TITLE');
    gs.forEach(function (g) { seenG[g] = 1; }); if (u) seenU[u] = 1;
    var decision = reasons.length ? 'BLOCK' : hold.length ? 'HOLD' : 'CANDIDATE';
    return { item: it, decision: decision, reasons: reasons.concat(hold) };
  });
}
// 採番正本「固定ID採番履歴」: [GUID, 固定ID, 番組, タイトル, 状態, 採番日時, 登録完了日時, 台帳行番号, エラー・備考]
var P25V2_NUM_SHEET_ = '固定ID採番履歴';
var P25V2_NUM_HEADERS_ = ['GUID', '固定ID', '番組', 'タイトル', '状態', '採番日時', '登録完了日時', '台帳行番号', 'エラー・備考'];
function p25v2Numbering_(values) {
  var h = (values[0] || []).map(p25v2T_);
  P25V2_NUM_HEADERS_.forEach(function (n, i) { if (h[i] !== n) throw new Error('NUMBERING_SCHEMA_MISMATCH ' + n); });
  return values.slice(1).map(function (r, i) { return { row: i + 2, guid: p25v2T_(r[0]).toLowerCase(), epId: p25v2T_(r[1]), state: p25v2T_(r[4]) }; }).filter(function (r) { return r.guid || r.epId; });
}
// 同GUIDに採番済みならその番号を再利用（中断復旧）。無ければ 台帳・採番履歴・予約下限 の最大+1。衝突は停止。
function p25v2Allocate_(ledgerRows, numbering, guid, reservedMax) {
  var g = p25v2T_(guid).toLowerCase(), prior = numbering.filter(function (n) { return n.guid === g; });
  if (prior.length > 1) throw new Error('NUMBERING_GUID_DUPLICATE');
  var used = {}; ledgerRows.forEach(function (r) { if (r.epId) used[r.epId] = r; });
  if (prior.length === 1) {
    var u = used[prior[0].epId];
    if (u && p25v2Guids_(u).indexOf(g) < 0) throw new Error('NUMBERING_ID_COLLISION ' + prior[0].epId);
    return { epId: prior[0].epId, reused: true, numberingRow: prior[0].row };
  }
  var ids = ledgerRows.map(function (r) { return { epId: r.epId }; }).concat(numbering);
  var next = p25v2NextEpId_(ids, reservedMax);
  if (numbering.some(function (n) { return n.epId === next; })) throw new Error('NUMBERING_ID_COLLISION ' + next);
  return { epId: next, reused: false };
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
    counts: { CANDIDATE: count('CANDIDATE'), HOLD: count('HOLD'), BLOCK: count('BLOCK'), ALREADY_INGESTED: count('ALREADY_INGESTED'), METADATA_CHANGE: count('METADATA_CHANGE') },
    decisions: decisions.map(function (d) { return { guid: p25v2Guids_(d.item)[0] || '', show: p25v2T_(d.item.show), decision: d.decision, reasons: d.reasons, existing: d.existing || '' }; }),
    added: 0, addedEpIds: [] };
  var todo = decisions.filter(function (d) { return d.decision === 'CANDIDATE'; }).slice(0, maxRows);
  // 中断復旧: 台帳には入ったが採番履歴が「採番済」のまま → 同GUID・同EP-IDなら「登録完了」へ直す（書込モードのみ）
  if (write && io.readNumbering) {
    var numb = p25v2Numbering_(io.readNumbering()), nowR = (opts.now || function () { return new Date().toISOString(); })();
    res.numberingRepaired = [];
    decisions.filter(function (d) { return d.decision === 'ALREADY_INGESTED'; }).forEach(function (d) {
      var g = p25v2Guids_(d.item)[0], n = numb.filter(function (x) { return x.guid === g; })[0];
      var led = recs.rows.filter(function (r) { return r.epId === d.existing; })[0];
      if (n && led && n.epId === d.existing && n.state !== '登録完了') { io.markNumbering(n.row, '登録完了', nowR, led.row); res.numberingRepaired.push(n.epId); }
    });
  }
  if (!write || !todo.length) return res;
  var reserved = Number(config.reservedMaxEpNo || 0);
  var numbering = io.readNumbering ? p25v2Numbering_(io.readNumbering()) : null;
  if (!numbering && config.requireNumbering !== false) throw new Error('NUMBERING_SOURCE_REQUIRED');
  todo.forEach(function (d) {
    var alloc = numbering ? p25v2Allocate_(recs.rows, numbering, p25v2Guids_(d.item)[0], reserved) : { epId: p25v2NextEpId_(recs.rows, reserved) };
    var epId = alloc.epId, row = p25v2BuildRow_(recs.schema, d.item, epId), now = (opts.now || function () { return new Date().toISOString(); })();
    if (numbering && !alloc.reused) { alloc.numberingRow = io.appendNumbering([p25v2Guids_(d.item)[0], epId, p25v2T_(d.item.show), p25v2T_(d.item.title), '採番済', now, '', '', 'P25V2']); numbering.push({ row: alloc.numberingRow, guid: p25v2Guids_(d.item)[0], epId: epId, state: '採番済' }); }
    p25v2AssertCopyTarget_(config, io.open(), true);              // 書込直前に再検証
    var after = io.readAll();
    // Detect in-place edits as well as new/deleted rows. Row count alone is insufficient.
    if (after.length !== before.length || JSON.stringify(after) !== JSON.stringify(before)) throw new Error('LEDGER_CHANGED_SINCE_READ');
    p25v2Schema_(after[0]);
    var n = io.appendRow(row);
    if (n !== before.length + 1) throw new Error('APPEND_POSITION_UNEXPECTED');
    var di = recs.schema.idx['配信日時 JST'];
    var norm = function (r) { return r.map(function (v, i) { return i === di ? p25v2DateKey_(v) : p25v2T_(v); }); };   // シートが日時を日付型に変換しても値で比較
    var back = norm(io.readRow(n));
    var want = norm(row);
    if (JSON.stringify(back.slice(0, want.length)) !== JSON.stringify(want)) throw new Error('READBACK_MISMATCH');
    if (numbering) io.markNumbering(alloc.numberingRow, '登録完了', now, n);
    res.added++; res.addedEpIds.push(epId); res.readbackOk = true; res.writtenRow = n; res.numberingReused = !!alloc.reused;
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
    appendRow: function (row) { var n = sh.getLastRow() + 1; if (n > 2) sh.getRange(n - 1, 1, 1, row.length).copyFormatToRange(sh, 1, row.length, n, n); sh.getRange(n, 1, 1, row.length).setValues([row]); SpreadsheetApp.flush(); return n; },
    readRow: function (n) { return sh.getRange(n, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; },
    readNumbering: function () { var ns = ss.getSheetByName(P25V2_NUM_SHEET_); return ns.getRange(1, 1, Math.max(ns.getLastRow(), 1), 9).getDisplayValues(); },
    appendNumbering: function (row) { var ns = ss.getSheetByName(P25V2_NUM_SHEET_), n = ns.getLastRow() + 1; ns.getRange(n, 1, 1, 9).setValues([row]); SpreadsheetApp.flush(); return n; },
    markNumbering: function (n, state, at, ledgerRow) { var ns = ss.getSheetByName(P25V2_NUM_SHEET_); ns.getRange(n, 5).setValue(state); ns.getRange(n, 7, 1, 2).setValues([[at, ledgerRow]]); SpreadsheetApp.flush(); }
  };
}
// 公式RSSの取得（GAS）。feeds: [{show, url, limit}]。1フィードの失敗で全体を止めず、失敗は記録する。
function p25v2FetchFeeds_(feeds) {
  var items = [], errors = [];
  (feeds || []).forEach(function (f) {
    try { var r = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true }); if (r.getResponseCode() !== 200) throw new Error('FEED_HTTP_' + r.getResponseCode()); items = items.concat(p25v2ParseRss_(r.getContentText(), f.url, f.show, f.limit || 30)); }
    catch (e) { errors.push({ show: f.show, error: String(e.message || e) }); }
  });
  return { items: items, errors: errors };
}
// 手動実行（COPY専用プロジェクト）。同時実行はスクリプトロックで1本に限定。
function P25V2_INGEST_COPY(config, items, write) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var src = items || p25v2FetchFeeds_(config.feeds);
    var res = p25v2Ingest_(p25v2GasIo_(config), config, src.items || src, { write: write === true, maxRows: 1 });
    res.feedErrors = src.errors || []; return res;
  } finally { lock.releaseLock(); }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { parseRss: p25v2ParseRss_, jstDate: p25v2JstDate_, numbering: p25v2Numbering_, allocate: p25v2Allocate_, NUM_HEADERS: P25V2_NUM_HEADERS_, schema: p25v2Schema_, classify: p25v2Classify_, records: p25v2Records_, buildRow: p25v2BuildRow_, nextEpId: p25v2NextEpId_, publicCount: p25v2PublicCount_, assertCopyTarget: p25v2AssertCopyTarget_, ingest: p25v2Ingest_, HEADERS: P25V2_HEADERS_, PROTECTED: P25V2_PROTECTED_IDS_, SHEET: P25V2_SHEET_, SCOPE: P25V2_SCOPE_ };
