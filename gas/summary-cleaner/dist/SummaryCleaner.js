// 自動生成ファイル（編集しない）: node scripts/ledger-v2/build-cleaner-gas.mjs で再生成。元: public/library/library-clean.mjs, public/library/description-editor.mjs, scripts/ledger-v2/summary-quality-audit.mjs, scripts/ledger-v2/summary-cleaner-v4.mjs + scripts/google-apps-script/P25V2IngestAdapter.js + gas/summary-cleaner/src/CleanerMain.js
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
var P25V2_V2_WORKING_ID_ = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';   // V2作業用: environment='V2_WORKING' かつ明示承認のときだけ書込を許す（他の保護IDは常に拒否）
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
function p25v2Allocate_(ledgerRows, numbering, guid, reservedMax, guidReserve) {
  var g = p25v2T_(guid).toLowerCase(), prior = numbering.filter(function (n) { return n.guid === g; });
  if (prior.length > 1) throw new Error('NUMBERING_GUID_DUPLICATE');
  var used = {}; ledgerRows.forEach(function (r) { if (r.epId) used[r.epId] = r; });
  if (prior.length === 1) {
    var u = used[prior[0].epId];
    if (u && p25v2Guids_(u).indexOf(g) < 0) throw new Error('NUMBERING_ID_COLLISION ' + prior[0].epId);
    return { epId: prior[0].epId, reused: true, numberingRow: prior[0].row };
  }
  var ids = ledgerRows.map(function (r) { return { epId: r.epId }; }).concat(numbering);
  var rsv = guidReserve && guidReserve[g];   // 別台帳（COPY試験など）で同じGUIDに振った番号があれば、未使用なら同じ番号を使う（GUIDと番号の対応を揃える）
  if (rsv && !used[rsv] && !numbering.some(function (n) { return n.epId === rsv; })) return { epId: rsv, reused: false, fromReserve: true };
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
  var t = p25v2T_(config.targetSpreadsheetId), v2w = config.environment === 'V2_WORKING';
  var prot = function (id) { return P25V2_PROTECTED_IDS_.indexOf(id) >= 0 && !(v2w && id === P25V2_V2_WORKING_ID_); };
  if (prot(t) || prot(p25v2T_(actual.id))) throw new Error('PROTECTED_TARGET_REFUSED');
  if (config.environment !== 'COPY' && !v2w) throw new Error('COPY_ENV_REQUIRED');
  if (!t || t !== p25v2T_(config.expectedTargetId)) throw new Error('TARGET_ID_UNCONFIRMED');
  if (p25v2T_(actual.id) !== t) throw new Error('OPENED_ID_MISMATCH');
  if (v2w) {   // V2作業用: IDが固定値と一致・名前に「基本台帳 V2 作業用」・書込は承認フラグ必須
    if (t !== P25V2_V2_WORKING_ID_) throw new Error('V2_WORKING_ID_MISMATCH');
    if (p25v2T_(actual.name).indexOf('基本台帳 V2 作業用') < 0) throw new Error('TARGET_NAME_NOT_V2_WORKING');
    if (forWrite && config.v2WorkingApproved !== true) throw new Error('V2_WORKING_NOT_APPROVED');
  } else if (!/COPY/.test(p25v2T_(actual.name))) throw new Error('TARGET_NAME_NOT_COPY');
  if (config.sheetName !== P25V2_SHEET_ || actual.sheetName !== P25V2_SHEET_) throw new Error('SHEET_NAME_MISMATCH');
  if (config.scope !== P25V2_SCOPE_) throw new Error('SCOPE_MISMATCH');
  if (forWrite && config.write !== true) throw new Error('WRITE_FLAG_OFF');
  return true;
}

// ---- 別表（V2本体34列は変えない。後日補完・清掃・索引をここで管理）----
// 収蔵詳細: 1EP=1行。概要原文はここだけに保全し、清掃結果は別列（原文は上書きしない）。
var P25V2_DETAIL_SHEET_ = 'V2・収蔵詳細';
var P25V2_DETAIL_HEADERS_ = ['EP-ID', '公式GUID', '取得元', '取得日時', '概要原文', '概要原文SHA256', '概要原文文字数', '清掃状態', '清掃版', '清掃日時', '清掃結果', '出典URL', '清掃済み本文', '関連記事(抽出)', '出演者候補(抽出)', '抽出保留', '原文取得方法'];   // 13列目以降は第4段階で末尾に追加
// URL状態: 1EP×1サービス=1行（縦持ち）。サービス追加で列は増えない。PR #281 resolveOne の返り値をそのまま記録できる形。
var P25V2_URLSTATE_SHEET_ = 'V2・URL状態';
var P25V2_URLSTATE_HEADERS_ = ['EP-ID', '公式GUID', 'サービス', 'URL', '状態', '理由', '確認日時', '根拠', '再試行予定'];
var P25V2_HARD_CAP_ = 10;   // 1回の追記上限の絶対値（設定 maxRowsCap はこれ以下。既定1。引き上げは別承認）
function p25v2DetailRow_(epId, item, at, sha) {
  var raw = String(item.descriptionRaw == null ? '' : item.descriptionRaw);
  var len = raw ? raw.length : Number(item.descLen || 0);
  var state = raw ? '未清掃' : (len ? '原文未取得（長さ・ハッシュのみ確認）' : '原文なし');
  return [epId, p25v2Guids_(item)[0] || '', p25v2T_(item.rss), at, raw, raw ? (sha ? sha(raw) : '') : p25v2T_(item.descSha256), String(len), state, '', '', '', p25v2T_(item.sourceUrl || item.rss), '', '', '', '', raw ? p25v2T_(item.rawVia || '公式RSS直接') : (len ? '未取得（長さ・ハッシュのみ）' : 'なし')];
}
function p25v2SheetHeaderCheck_(values, headers, name) {
  var h = (values && values[0] || []).map(p25v2T_);
  headers.forEach(function (n, i) { if (h[i] !== n) throw new Error('SHEET_SCHEMA_MISMATCH ' + name + ':' + n); });
}
// 本番GASプロジェクトに混入していないか（doGet/doPost が同居していたら停止）・トリガーが無いか
function p25v2AssertIsolated_(env) {
  env = env || {};
  if (env.hasDoGet || env.hasDoPost) throw new Error('NOT_ISOLATED_PROJECT');
  if (env.triggerCount > 0) throw new Error('TRIGGERS_PRESENT');
  return true;
}
var P25V2_DATE_SORT_ = function (a, b) { var x = p25v2DateKey_(a.item.date), y = p25v2DateKey_(b.item.date); var f = function (k) { return k.split('-').map(function (n) { return ('0000' + n).slice(-4); }).join(''); }; return f(x) < f(y) ? -1 : f(x) > f(y) ? 1 : 0; };

// 中核処理（I/O 注入・小バッチ）。
// io: open() -> {id,name,sheetName}, readAll(), appendRows(rows)->先頭行, readRows(n,k), readNumbering(), appendNumberingRows(rows)->先頭行,
//     markNumberingRows([{row,state,at,ledgerRow}]), [readDetails(), appendDetails(rows)]
// 順序（チェックポイント）: 採番履歴「採番済」(一括) → 台帳追記(一括) → 読み戻し → 収蔵詳細 → 採番履歴「登録完了」(読み戻し一致分のみ)。
// どこで止まっても、再実行で 採番済の番号を再利用／台帳にある分は ALREADY_INGESTED＋採番修復 となり、二重登録も欠番も生じない。
function p25v2Ingest_(io, config, items, opts) {
  opts = opts || {};
  var write = opts.write === true;
  var cap = Math.min(Number(config.maxRowsCap || 1), P25V2_HARD_CAP_);
  var maxRows = Math.max(0, Math.min(Number(opts.maxRows || 1), cap));
  var nowF = opts.now || function () { return new Date().toISOString(); };
  var actual = io.open();
  p25v2AssertCopyTarget_(config, actual, write);
  var before = io.readAll(), recs = p25v2Records_(before);
  var decisions = p25v2Classify_(recs.rows, items || []);
  var count = function (d) { return decisions.filter(function (x) { return x.decision === d; }).length; };
  var res = { mode: write ? 'COPY_WRITE' : 'READ_ONLY_DRY_RUN', status: 'OK', rowsBefore: recs.rows.length, publicBefore: p25v2PublicCount_(recs.rows),
    counts: { CANDIDATE: count('CANDIDATE'), HOLD: count('HOLD'), BLOCK: count('BLOCK'), ALREADY_INGESTED: count('ALREADY_INGESTED'), METADATA_CHANGE: count('METADATA_CHANGE') },
    decisions: decisions.map(function (d) { return { guid: p25v2Guids_(d.item)[0] || '', show: p25v2T_(d.item.show), date: p25v2T_(d.item.date), decision: d.decision, reasons: d.reasons, existing: d.existing || '' }; }),
    added: 0, addedEpIds: [], numberingRepaired: [], plan: [] };
  var numbering = io.readNumbering ? p25v2Numbering_(io.readNumbering()) : null;
  if (!numbering && config.requireNumbering !== false) throw new Error('NUMBERING_SOURCE_REQUIRED');
  var reserved = Number(config.reservedMaxEpNo || 0);
  var todo = decisions.filter(function (d) { return d.decision === 'CANDIDATE'; }).sort(P25V2_DATE_SORT_).slice(0, (!write && opts.planAll) ? Infinity : maxRows);   // 古い順に採番（READ_ONLY+planAll は全候補の予定採番）
  // 予定採番（READ_ONLYでも出す）
  var simNum = (numbering || []).map(function (n) { return { row: n.row, guid: n.guid, epId: n.epId, state: n.state }; }), simRows = recs.rows.slice();
  var allocs = todo.map(function (d) {
    var g = p25v2Guids_(d.item)[0];
    var al = numbering ? p25v2Allocate_(simRows, simNum, g, reserved, config.guidReserve) : { epId: p25v2NextEpId_(simRows, reserved), reused: false };
    if (!al.reused) simNum.push({ row: 0, guid: g, epId: al.epId, state: '採番済' });
    simRows.push({ epId: al.epId, show: d.item.show, title: d.item.title, guid: g, jsonUuid: '', officialUrl: '' });
    res.plan.push({ epId: al.epId, reused: !!al.reused, fromReserve: !!al.fromReserve, guid: g, show: p25v2T_(d.item.show), date: p25v2T_(d.item.date) });
    return al;
  });
  // 中断復旧: 台帳にあるのに採番履歴が「採番済」→「登録完了」に修復（書込モードのみ）
  if (write && numbering) {
    var fix = [];
    decisions.filter(function (d) { return d.decision === 'ALREADY_INGESTED'; }).forEach(function (d) {
      var g = p25v2Guids_(d.item)[0], n = numbering.filter(function (x) { return x.guid === g; })[0];
      var led = recs.rows.filter(function (r) { return r.epId === d.existing; })[0];
      if (n && led && n.epId === d.existing && n.state === '採番済') fix.push({ row: n.row, state: '登録完了', at: nowF(), ledgerRow: led.row, epId: n.epId });
    });
    if (fix.length) { io.markNumberingRows(fix); res.numberingRepaired = fix.map(function (f) { return f.epId; }); }
  }
  if (!write || !todo.length) { res.publicAfter = res.publicBefore; return res; }
  if (opts.deadlineMs && Date.now() > opts.deadlineMs) { res.status = 'PARTIAL_TIME'; return res; }
  var at = nowF();
  var rows = todo.map(function (d, i) { return p25v2BuildRow_(recs.schema, d.item, allocs[i].epId); });
  // 1) 採番履歴「採番済」（再利用分は書かない）
  var newNum = []; todo.forEach(function (d, i) { if (!allocs[i].reused) newNum.push(i); });
  if (newNum.length) {
    var first = io.appendNumberingRows(newNum.map(function (i) { return [p25v2Guids_(todo[i].item)[0], allocs[i].epId, p25v2T_(todo[i].item.show), p25v2T_(todo[i].item.title), '採番済', at, '', '', 'P25V2'] }));
    newNum.forEach(function (i, k) { allocs[i].numberingRow = first + k; });
  }
  // 2) 書込直前の再検証（対象・台帳の不変・見出し）
  p25v2AssertCopyTarget_(config, io.open(), true);
  var after = io.readAll();
  if (after.length !== before.length || JSON.stringify(after) !== JSON.stringify(before)) throw new Error('LEDGER_CHANGED_SINCE_READ');
  p25v2Schema_(after[0]);
  // 3) 台帳へ一括追記
  var n0 = io.appendRows(rows);
  if (n0 !== before.length + 1) throw new Error('APPEND_POSITION_UNEXPECTED');
  // 4) 読み戻し（日時は値で比較）
  var di = recs.schema.idx['配信日時 JST'];
  var norm = function (r) { return r.map(function (v, i) { return i === di ? p25v2DateKey_(v) : p25v2T_(v); }); };
  var back = io.readRows(n0, rows.length) || [], okIdx = [], bad = [];
  rows.forEach(function (r, i) { var w = norm(r), b = norm(back[i] || []).slice(0, w.length); if (JSON.stringify(b) === JSON.stringify(w)) okIdx.push(i); else bad.push(allocs[i].epId); });
  // 5) 収蔵詳細（概要原文の保全）: 読み戻し一致分のみ。既にあるEP-IDには書かない
  if (io.appendDetails && okIdx.length) {
    var dv = io.readDetails(); p25v2SheetHeaderCheck_(dv, P25V2_DETAIL_HEADERS_, P25V2_DETAIL_SHEET_);
    var have = {}; dv.slice(1).forEach(function (r) { have[p25v2T_(r[0])] = 1; });
    var drows = okIdx.filter(function (i) { return !have[allocs[i].epId]; }).map(function (i) { return p25v2DetailRow_(allocs[i].epId, todo[i].item, at, opts.sha256); });
    if (drows.length) io.appendDetails(drows);
    res.detailsAdded = drows.length;
  }
  // 6) 採番履歴「登録完了」
  if (numbering && okIdx.length) io.markNumberingRows(okIdx.map(function (i) { return { row: allocs[i].numberingRow, state: '登録完了', at: at, ledgerRow: n0 + i }; }));
  okIdx.forEach(function (i) {
    res.added++; res.addedEpIds.push(allocs[i].epId);
    recs.rows.push({ row: n0 + i, epId: allocs[i].epId, show: todo[i].item.show, title: todo[i].item.title, judge: '未判定', rep: allocs[i].epId, guid: todo[i].item.guid, jsonUuid: '', officialUrl: '' });
  });
  res.firstRow = n0; res.readbackOk = bad.length === 0; res.numberingReused = allocs.some(function (a) { return a.reused; });
  res.publicAfter = p25v2PublicCount_(recs.rows);
  if (bad.length) { res.status = 'HALT_READBACK_MISMATCH'; res.readbackFailed = bad; throw Object.assign(new Error('READBACK_MISMATCH ' + bad.join(',')), { result: res }); }
  return res;
}

// GAS 用 I/O（COPY 専用プロジェクトで手動実行。トリガーは作らない）
function p25v2GasIo_(config) {
  var ss = null, sh = null;
  var sheet = function (name) { var x = ss.getSheetByName(name); if (!x) throw new Error('SHEET_NOT_FOUND ' + name); return x; };
  var appendBlock = function (x, rows, copyFormat) { var n = x.getLastRow() + 1; if (copyFormat && n > 2) x.getRange(n - 1, 1, 1, rows[0].length).copyFormatToRange(x, 1, rows[0].length, n, n + rows.length - 1); x.getRange(n, 1, rows.length, rows[0].length).setValues(rows); SpreadsheetApp.flush(); return n; };
  return {
    open: function () { ss = SpreadsheetApp.openById(config.targetSpreadsheetId); sh = ss.getSheetByName(config.sheetName); return { id: ss.getId(), name: ss.getName(), sheetName: sh ? sh.getName() : '' }; },
    readAll: function () { return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(); },
    appendRows: function (rows) { return appendBlock(sh, rows, true); },
    readRows: function (n, k) { return sh.getRange(n, 1, k, sh.getLastColumn()).getDisplayValues(); },
    readNumbering: function () { var ns = sheet(P25V2_NUM_SHEET_); return ns.getRange(1, 1, Math.max(ns.getLastRow(), 1), 9).getDisplayValues(); },
    appendNumberingRows: function (rows) { return appendBlock(sheet(P25V2_NUM_SHEET_), rows, false); },
    markNumberingRows: function (list) { var ns = sheet(P25V2_NUM_SHEET_); list.forEach(function (m) { ns.getRange(m.row, 5).setValue(m.state); ns.getRange(m.row, 7, 1, 2).setValues([[m.at, m.ledgerRow]]); }); SpreadsheetApp.flush(); },
    readDetails: function () { var d = sheet(P25V2_DETAIL_SHEET_); return d.getRange(1, 1, Math.max(d.getLastRow(), 1), P25V2_DETAIL_HEADERS_.length).getDisplayValues(); },
    appendDetails: function (rows) { return appendBlock(sheet(P25V2_DETAIL_SHEET_), rows, false); }
  };
}
function p25v2GasSha256_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function p25v2Sleep_(ms) { if (typeof Utilities !== 'undefined' && Utilities.sleep) Utilities.sleep(ms); }
// 収蔵工程は清掃・出演者・関連記事を書かない（品質未検証の値を台帳本体に入れない）。原文は収蔵詳細にだけ保全する。
function p25v2StripUnverified_(items) { return (items || []).map(function (x) { var y = {}; Object.keys(x).forEach(function (k) { if (['summaryCleaned', 'cast', 'relatedUrls'].indexOf(k) < 0) y[k] = x[k]; }); return y; }); }
// 公式RSSの取得（GAS）。feeds: [{show, url, limit}]（limit 省略=30件、0=全件）。1フィードの失敗で全体を止めず、失敗は記録する。
function p25v2FetchFeeds_(feeds) {
  var items = [], errors = [], stats = [];
  (feeds || []).forEach(function (f) {
    var last = '', t0 = Date.now(), bytes = 0, before = items.length;
    for (var attempt = 0; attempt < 2; attempt++) {   // 一時障害（5xx・通信例外）は1回だけ再試行。4xxは再試行しない
      try { var r = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true }), code = r.getResponseCode();
        if (code !== 200) { last = 'FEED_HTTP_' + code; if (code >= 500 && attempt === 0) { p25v2Sleep_(2000); continue; } break; }
        var body = r.getContentText(); bytes = body.length; items = items.concat(p25v2ParseRss_(body, f.url, f.show, f.limit == null ? 30 : (f.limit > 0 ? f.limit : undefined))); last = ''; break; }
      catch (e) { last = String(e.message || e); if (/UNVERIFIED_FEED_HOST|FEED_INVALID/.test(last) || attempt > 0) break; p25v2Sleep_(2000); }
    }
    if (last) errors.push({ show: f.show, error: last });
    stats.push({ show: f.show, ms: Date.now() - t0, chars: bytes, items: items.length - before });   // 実行時間・サイズの実測（本文は含めない）
  });
  return { items: items, errors: errors, stats: stats };
}
// 手動実行（COPY専用プロジェクト）。同時実行はスクリプトロックで1本に限定。
function p25v2IngestCopyNotInCleaner_(config, items, write) {
  p25v2AssertIsolated_({ hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: ScriptApp.getProjectTriggers().length });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var src = items || p25v2FetchFeeds_(config.feeds);
    var res = p25v2Ingest_(p25v2GasIo_(config), config, p25v2StripUnverified_(src.items || src), { write: write === true, maxRows: config.maxRows || 1, deadlineMs: Date.now() + 4 * 60 * 1000, sha256: p25v2GasSha256_ });
    res.feedErrors = src.errors || []; return res;
  } finally { lock.releaseLock(); }
}


var LibClean = (function () {
// Reused unchanged from LibraryV3.js (PR #234, 2026-10-18).
function libV3Clean_(text){
 // Mechanical rendering only: preserve words, URLs and names, never summarize.
 return String(text||'').replace(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,(_,q,url,label)=>label===url?label:label+' '+url).replace(/\\r\\n|\\n|\\r|\r\n?|\n/g,' ').replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,' ')
 .replace(/<(https?:\/\/[^<>\s]+)>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x])
 .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(x,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):x;}).replace(/\s+/g,' ').trim();
}


return { cleanDescription: libV3Clean_ };
})();

var DescEditor = (function () {
// Phase 11 publication layer over V3 mechanical rendering. Never mutates raw text.
const { cleanDescription } = LibClean;
const DESCRIPTION_VERSION = 'V3-public-sections-1';
const urlPattern = /https?:\/\/[^\s<>「」『』（）()"'、]+/g;
function publicationUrl(raw) {
  try {
    const u=new URL(raw); if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';
    for(const k of [...u.searchParams.keys()])if(/^(utm_.+|iref|ref|fbclid|gclid|si)$/i.test(k))u.searchParams.delete(k);
    return u.href;
  } catch { return ''; }
}
function descriptionLines(raw) {
  return String(raw||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n').replace(/<br\s*\/?\s*>|<\/?(?:p|div|li)\b[^>]*>/gi,'\n')
    .split('\n').map(s=>cleanDescription(s).replace(/&(hellip|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/g,(_,n)=>({hellip:'…',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”'}[n]))).filter(Boolean);
}
function extractLinks(text, kind='article') {
  const out=[]; let previous=0;
  for(const m of text.matchAll(urlPattern)) {
    const originalUrl=m[0].replace(/[.,;]+$/,''); const url=publicationUrl(originalUrl);if(!url)continue;
    const title=text.slice(previous,m.index).replace(/^[\s▽・／/）)]+/,'').replace(/[\s（(]+$/,'').trim();
    out.push({title:title||originalUrl,originalUrl,url,kind,linkStatus:'NOT_CHECKED',checkedAt:null}); previous=m.index+m[0].length;
  } return out;
}
function editDescription(raw, {relatedUrls=[],linkEvidence={}}={}) {
  const body=[],staff=[],recording=[],removed=[],related=[],unclassified=[];let section='body';
  for(let line of descriptionLines(raw)) {
    // Split common footer from a recording date, even when stored in one paragraph.
    line=line.replace(/朝日新聞ポッドキャスト[（(][\s\S]*?では他にも様々な番組を配信、テキストでも読めます。?/g,m=>{removed.push({reason:'COMMON_FOOTER',text:m});return '';});
    if(!line.trim())continue;
    if(/^[★※]?過去の.*(?:シリーズ|配信リスト)|^藤田知也記者による連載/.test(line)&&/https?:/.test(line)){related.push(...extractLinks(line,'reference'));continue;}
    if((/^★/.test(line)&&/姉妹番組|記者サロン|移管|チャンネル|イベント|申し込み|詳細はこちら|展|講座|生配信|強化ウイーク|昨日配信|この番組|この続き|クラウドファンディング|生出演/.test(line))||(/^※/.test(line)&&/(?:開催|登録|応募フォーム|お申し込み)/.test(line))){removed.push({reason:'EXPLICIT_PROMOTION',text:line});continue;}
    if(/^※(?:【連載】|朝日新聞デジタルの連載|連載「)/.test(line)&&/https?:/.test(line)){related.push(...extractLinks(line.replace(/^※/,''),'reference'));continue;}
    const date=line.match(/この番組は\d{4}年[^。]*?に収録しました。?/g);
    if(date){recording.push(...date);line=line.replace(/この番組は\d{4}年[^。]*?に収録しました。?/g,'').trim();if(!line)continue;}
    if(/^(?:ご意見|フォーム|おたよりフォーム|ツイッター|メール|【ご意見・ご感想】|【ツイッター】)/.test(line)&&/(?:forms\.gle|twitter\.com|@asahi\.com|【ご意見・ご感想】|【ツイッター】)/i.test(line)){removed.push({reason:'CONTACT',text:line});continue;}
    if(/^See .*omnystudio\.com\/listener.*privacy information\.?$/i.test(line)){removed.push({reason:'COMMON_PRIVACY',text:line});continue;}
    if(/^(?:【番組内容】|【内容】)/.test(line)){section='body';line=line.replace(/^【[^】]+】/,'').trim();}
    else if(/^(?:【関連記事】|【関連リンク】|【写真まとめ】|【ドキュメンタリー動画】|【特集ページ】|【withnewsの記事一覧はこちら】)/.test(line)){section='related';line=line.replace(/^【[^】]+】/,'').trim();}
    else if(/^【出演[・／/]スタッフ】|^【出演者】|^【スタッフ】/.test(line)){section='staff';line=line.replace(/^【[^】]+】/,'').trim();}
    else if(/^(?:【お知らせ】|＜お知らせ＞|<お知らせ>|【イベント|【GOOD LIFE|PR[:：]|PRESENTED BY[:：]|【SPONSORED】)/i.test(line)){section='notice';removed.push({reason:'NOTICE_OR_PROMOTION',text:line});continue;}
    if(section==='notice'){removed.push({reason:'NOTICE_OR_PROMOTION',text:line});continue;}
    if(section==='related'){
      const pending=unclassified.at(-1);if(/^https?:/.test(line)&&pending?.section==='related'){line=pending.text+' '+line;unclassified.pop();}
      related.push(...extractLinks(line));if(!/https?:/.test(line)&&line)unclassified.push({section,text:line});continue;
    }
    if(section==='staff'){staff.push(line);continue;}
    // Only explicit contact URLs/addresses are removed inside otherwise useful content.
    line=line.replace(/(?:mailto:)?[A-Z0-9._%+-]+@asahi\.com/gi,'').replace(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms)[^\s）)]+/gi,'');
    if(/^Official Site\s*\|/i.test(line)||/^番組内で紹介されたエピソードはこちら/.test(line)){related.push(...extractLinks(line,'reference'));continue;}
    line=line.replace(/(?:この番組は|※)?毎週[月火水木金土日]曜日に配信します。?/g,m=>{removed.push({reason:'COMMON_SCHEDULE',text:m});return '';});
    line=line.replace(urlPattern,u=>publicationUrl(u)||'').trim();if(line&&!body.includes(line))body.push(line);
  }
  // Preserve ledger article URLs even if raw section markup is missing or unusual.
  for(const originalUrl of relatedUrls){const url=publicationUrl(originalUrl);if(url&&!related.some(r=>r.url===url))related.push({title:originalUrl,originalUrl,url,kind:'article',linkStatus:'NOT_CHECKED',checkedAt:null});}
  const unique=new Map();for(const r of related){if(/\/special\/podcasts\/?(?:\?|$)|forms\.gle|omnystudio\.com\/listener/.test(r.url))continue;const old=unique.get(r.url);if(!old||old.title===old.originalUrl)unique.set(r.url,r);}
  for(const r of unique.values()){const proof=linkEvidence[r.originalUrl]||linkEvidence[r.url];if(proof)Object.assign(r,{linkStatus:proof.status,checkedAt:proof.checkedAt,httpStatus:proof.httpStatus});}
  const description=body.join('\n\n');const holds=[];
  if(!description)holds.push('CONTENT_EMPTY');
  if(unclassified.length)holds.push('RELATED_TEXT_WITHOUT_URL_REVIEW');
  if(/@asahi\.com|forms\.gle|<\/?[a-z][^>]*>/i.test(description))holds.push('PUBLIC_RESIDUE');
  return {version:DESCRIPTION_VERSION,description,relatedArticles:[...unique.values()],staff,recording:[...new Set(recording)],removed,unclassified,holds};
}

return { DESCRIPTION_VERSION, publicationUrl, descriptionLines, editDescription };
})();

var QualityAudit = (function () {
// 概要清掃の品質監査（READ_ONLY）。比較基準は公式RSSの概要原文だけ。既存の清掃文・新しい清掃案は「検査対象」であって正解ではない。
// 監査側の行分類は清掃器とは独立に、保守的に作る（迷う行は AMBIGUOUS として採点しない＝消し過ぎ・残し過ぎのどちらにも数えない）。
// 出力は件数・分類・EP-ID・行番号・文字数だけ。本文は出さない（leak-guard を通す前提）。
const { descriptionLines } = DescEditor;
// 追跡パラメータ（utm_*・iref・ref・fbclid・gclid・si）だけを外す。URL クラスを使わない（GAS には無い）。それ以外の部分は変えない
function cleanUrl(u) {
  const s = String(u || ''), h = s.indexOf('#'), base = h >= 0 ? s.slice(0, h) : s, hash = h >= 0 ? s.slice(h) : '', q = base.indexOf('?');
  if (q < 0) return s;
  const keep = base.slice(q + 1).split('&').filter((kv) => kv && !/^(utm_[^=]*|iref|ref|fbclid|gclid|si)(=|$)/i.test(kv));
  return base.slice(0, q) + (keep.length ? '?' + keep.join('&') : '') + hash;
}
const publicationUrl = cleanUrl;
// 段落（</p>）ごとに行へ分ける。段落の区切りを残すため（★の告知ブロックは段落の終わりまで）。<p> の無い原文は全体で1段落＝hasParas=false
// 共通ライブラリが訳さない名前付き文字参照（&darr; &times; など）を文字に戻す。原文側と出力側の両方に同じ変換がかかる（SQA-10）
const NAMED_ENTITIES = { darr: '↓', uarr: '↑', rarr: '→', larr: '←', harr: '↔', times: '×', divide: '÷', infin: '∞', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•', laquo: '«', raquo: '»', yen: '¥', euro: '€', Oslash: 'Ø', oslash: 'ø', eacute: 'é', Eacute: 'É', aacute: 'á', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç', ntilde: 'ñ', hearts: '♥', star: '☆', sect: '§', para: '¶', plusmn: '±', frac12: '½', minus: '−', ensp: ' ', emsp: ' ', thinsp: ' ' };
const decodeNamedEntities = (t) => String(t).replace(/&([A-Za-z][A-Za-z0-9]{1,7});/g, (m, n) => NAMED_ENTITIES[n] ?? m);
function paraLines(raw) {
  const src = String(raw ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''), parts = src.split(/<\/p\s*>/i), out = [];
  parts.forEach((chunk, p) => descriptionLines(chunk).forEach((text) => out.push({ text: decodeNamedEntities(text.replace(/[\u200B\u2060\uFEFF]/g, '')), p })));
  return { lines: out, hasParas: parts.length > 1 };
}
// ★/☆ で始まる告知（フォロー・募集・イベント・新番組・感想募集など）。その段落の残りの行も告知として扱う
const STAR_NOTICE = /^[★☆].*(?:読み放題|月額|円で|初回限定|フォロー|お寄せ|募集|お待ち|申し込|申込|配信あり|新番組|はじめます|キャンペーン|イベント|プレゼント|ご感想|ご意見|アンケート|質問)/;
// 見出しの後に文が続く告知（【秋トクキャンペーン …】本文…）
const INLINE_NOTICE_HEAD = /^【[^】]*(?:キャンペーン|イベント|祝|募集|プレゼント|お知らせ|告知|チケット|参加者)[^】]*】/;

const AUDIT_VERSION = 'SQA-10';   // SQA-9 は所在不明の版（2026-11-12）と衝突させないため欠番
// 清掃状態（処理済みと品質確認済みを分離）。品質確認済は人の目視確認と記録があるときだけ付く。自動検査の合格は「自動検査合格・目視未確認」。
const QUALITY_STATES = Object.freeze(['未処理', '自動処理済・未検証', '自動検査合格・目視未確認', '品質確認済', '要確認', '不合格']);
const QUALITY_LOG_HEADERS = Object.freeze(['EP-ID', '公式GUID', '概要原文SHA256', '検査対象', '清掃版', '監査版', '判定', '誤り分類', '検証方法', '検証者', '検証日時', '理由']);

const N = (t) => String(t ?? '').normalize('NFKC').replace(/https?:\/\/\S+/g, '').replace(/[\s　、。，．・「」『』（）()【】\[\]！？!?…:：;；"'“”‘’〜~ー—–-]/g, '').toLowerCase();
const URL_RE = /https?:\/\/[^\s<>「」『』（）()"'、]+/g;
const ARTICLE_RE = /^https?:\/\/(?:www\.asahi\.com\/(?:articles|[a-z]+\/articles)\/|digital\.asahi\.com\/articles\/|withnews\.jp\/article\/|globe\.asahi\.com\/article\/|book\.asahi\.com\/article\/|www\.asahi\.com\/special\/(?!podcasts))/;
// 消してよいと監査側が確信できる定型だけ。迷うものは入れない。
const DROP_LINE = /過去(?:の)?回は(?:下記|こちら)|読み放題|スタンダードコース|初回限定|初月無料|月額\s*[\d０-９,，]+円|^See .*omnystudio\.com\/listener|Learn more about your ad choices|会員登録をお願い|購読料で配信|交流はdiscord|^ご意見・感想・リクエスト|おたよりフォーム|^メルマガ|広告ご検討の企業様|^番組検索ツール|^最新情報はX|^番組カレンダー|全話あります公式サイト|アプリで記者と対話|^朝ポキTV|ほかにも(?:多彩な)?番組を配信中|^★?ご感想はこちら|discord|をフォロー|フォロー[、,]?\s*お願い|お待ちしています|申し込みはこちら|申込はこちら/i;
const DROP_SECTION = /^【(?:おねがい|朝ポキ情報|お知らせ|イベント)|^【[^】]*(?:参加|フェス|募集|告知|プレゼント|チケット|キャンペーン|イベント)[^】]*】\s*$/;
const STAFF_SECTION = /^【(?:出演[・／/]スタッフ|出演者|スタッフ|出演)】/;
const RELATED_SECTION = /^【(?:関連記事|関連リンク|写真まとめ|特集ページ|まとめてわかる)|^【[^】]*(?:関連|参考|アーカイブ)[^】]*】\s*$/;
const AMBIG_LINE = /^[★※▼■◆]|募集|お寄せください|応募|申し込み|配信します|収録しました|プレゼント|イベント|フォロー/;

// 原文を行に分け、監査側の期待（KEEP/DROP/STAFF/RELATED/AMBIGUOUS）を付ける。
function classifyRawLines(raw) {
  const out = []; let section = 'body', notice = -1;   // notice = ★告知・見出し付き告知が続いている段落番号
  const pl = paraLines(raw);
  const groups = new Map(); pl.lines.forEach(({text,p}) => groups.set(p, (groups.get(p) || '') + '\n' + text));
  const invitations = new Set([...groups].filter(([p,t]) => pl.hasParas && /(?:^|\n)(?:【ご案内】|【リアルで新聞をめくろう】|[★☆]「PODCAST MEETING)/.test(t) && /PODCAST MEETING/.test(t) && /申し込|申込|応募|参加|開催|対象はデジタル版有料会員/.test(t) && /https?:\/\/(?:ciy\.digital\.asahi\.com\/ciy\/|que\.digital\.asahi\.com\/question\/|forms\.gle\/|t\.asahi\.com\/wr7n)/.test(t)).map(([p])=>p));
  pl.lines.forEach(({ text, p }, i) => {
    const urlOnly = /^\s*(?:https?:\/\/\S+\s*)+$/.test(text);
    if (notice >= 0 && (p !== notice || /^[【★☆※]/.test(text))) { notice = -1; if (section === 'notice') section = 'body'; }
    if (pl.hasParas && (STAR_NOTICE.test(text) || (INLINE_NOTICE_HEAD.test(text) && !/^【[^】]+】\s*$/.test(text)))) { section = 'notice'; notice = p; }
    else if (/^【朝日新聞アプリで(?:つぶやきの)?フォローしてください】/.test(text)) section = 'drop';
    else if (DROP_SECTION.test(text)) section = 'drop'; else if (STAFF_SECTION.test(text)) section = 'staff'; else if (RELATED_SECTION.test(text)) section = 'related'; else if (/^【[^】]{1,40}】\s*$/.test(text)) section = 'body';   // 名前の決まっていない見出しで節が切り替わる
    const headerOnly = /^【[^】]+】\s*$/.test(text);
    let expect;
    if (/^(?:【(?:ご案内|締め切り迫る)】)?9月23日に 朝ポキ 初の対面イベント「PODCAST MEETING 2022」を開催！皆さんと会いたいです！$/.test(text) || (String(raw).includes('対面イベント「PODCAST MEETING 2022」を開催') && /^※応募締切は9月4日です。$/.test(text)) || invitations.has(p) || /^(?:・\s*)?(?:メールマガジン)?「朝ポキおたより」(?:が|に|、).*?(?:ご登録|始まり|始まります)/.test(text) || /^(?:過去回は、「連載」→「伊藤・奥山・神田」からお聞きいただけます。)?朝ポキ7番組の更新情報・アーカイブはこちら！$/.test(text.replace(URL_RE, '').trim()) || /^(?:https?:\/\/(?:twitter\.com|x\.com)\/[^\s（）()]+\s*[（(][^）)]+[）)]\s*)+$/i.test(text) || DROP_LINE.test(text) || /^(?:ご意見・ご要望|フォーム|ツイッター|メール).*?(?:forms\.gle|twitter\.com|podcast@asahi)/i.test(text) || /^(?:ご登録フォーム\s+https?:|https?:\/\/que\.digital\.asahi\.com\/question\/11008783\s+（ご登録フォーム）)/.test(text) || /^(?:有料会員、)?始めるなら今[、。].*朝日新聞デジタル.*キャンペーン/.test(text) || /^朝日新聞ポッドキャスト[（(].*では他にも様々な番組を配信[、。]テキストでも読めます/.test(text) || /^[３3]STEPで朝リスちゃんグッズGet！/.test(text)) expect = 'DROP';
    else if (section === 'drop' || section === 'notice') expect = 'DROP';
    else if (section === 'staff') expect = 'STAFF';
    else if (section === 'related' || (/https?:/.test(text) && [...text.matchAll(URL_RE)].some((m) => ARTICLE_RE.test(m[0])))) expect = 'RELATED';
    else if (urlOnly || headerOnly) expect = 'DROP';
    else if (AMBIG_LINE.test(text)) expect = 'AMBIGUOUS';
    else expect = 'KEEP';
    out.push({ i, text, len: text.length, expect, section });
  });
  for (let k = 0; k + 1 < out.length; k++) {   // 見出し行の直後がURLだけの行なら、その見出しは関連リンクの見出し（本文として採点しない）
    if (/^\s*(?:https?:\/\/\S+\s*)+$/.test(out[k + 1].text) && out[k].expect === 'KEEP') out[k].expect = 'RELATED';
  }
  return out;
}
const grams = (t, k = 3) => { const s = new Set(); for (let i = 0; i + k <= t.length; i++) s.add(t.slice(i, i + k)); return s; };
// 行が清掃文に残っている割合（0..1）。完全一致でなくても、3文字片の重なりで測る。
function coverage(line, cleaned) {
  const a = N(line), b = N(cleaned); if (!a) return 1; if (b.includes(a)) return 1;
  const g = grams(a), h = grams(b); if (!g.size) return b.includes(a) ? 1 : 0;
  let hit = 0; for (const x of g) if (h.has(x)) hit++; return hit / g.size;
}
const PROPER = /「[^」]{2,30}」|[ァ-ヴー]{3,}|[A-Za-z][A-Za-z0-9&.\-]{2,}|#\d+/g;
const CAST_BAD = /会員登録|discord|おたより|お便り|フォーム|購読|配信中|メルマガ|ご意見|フォロー/i;   // 出演者の個人リンク（URL）は混入ではない
function articleUrls(text) { return [...String(text || '').matchAll(URL_RE)].map((m) => m[0].replace(/[.,;]+$/, '')).filter((u) => ARTICLE_RE.test(u)).map((u) => publicationUrl(u) || u); }

// 1件の監査。candidate = { description, cast(文字列 or 配列), related(URL配列 or {url,title}配列) }
function auditPair(raw, candidate, { minKeepCoverage = 0.85, partialFloor = 0.3 } = {}) {
  const findings = [], lines = classifyRawLines(raw), desc = String(candidate?.description ?? ''), add = (type, extra = {}) => findings.push({ type, ...extra });
  if (!String(raw || '').trim()) return { verdict: 'HOLD', findings: [{ type: 'RAW_EMPTY' }], stats: {} };
  const keep = lines.filter((l) => l.expect === 'KEEP');
  if (keep.length && !desc.trim()) add('EMPTY_OUTPUT');
  for (const l of keep) {
    const c = coverage(l.text, desc);
    if (c < partialFloor) add('OVER_DELETION', { line: l.i, len: l.len }); else if (c < minKeepCoverage) add('PARTIAL_DELETION', { line: l.i, len: l.len, coverage: +c.toFixed(2) });
    else for (const m of l.text.replace(URL_RE, '').matchAll(PROPER)) if (!N(desc).includes(N(m[0])) && N(m[0])) { add('LOST_PROPER_NOUN', { line: l.i, len: m[0].length }); break; }
  }
  for (const l of lines.filter((x) => x.expect === 'DROP' && N(x.text).length >= 6)) if (coverage(l.text, desc) >= 0.9) add('UNDER_DELETION', { line: l.i, len: l.len });
  const descLines = desc.split(/\n+/).map(N).filter(Boolean);   // 出演者の行が本文に「行として」残っているか（本文中で名前に触れるのは正常）
  for (const l of lines.filter((x) => x.expect === 'STAFF' && !STAFF_SECTION.test(x.text) && N(x.text).length >= 2)) if (descLines.some((d) => d === N(l.text) || (d.length <= N(l.text).length * 1.3 && coverage(l.text, d) >= 0.95))) add('STAFF_IN_BODY', { line: l.i, len: l.len });
  if (/<\/?[a-z][^>]*>|<!\[CDATA\[|\]\]>|&(?:nbsp|amp|lt|gt|hellip|quot|#\d+);/i.test(desc)) add('HTML_RESIDUE');
  if (/https?:\/\//.test(desc)) add('URL_IN_BODY');
  if (/[?&](?:iref|utm_[a-z]+)=/.test(desc)) add('TRACKING_PARAM');
  // 関連記事: 原文の記事URLが清掃後（本文か関連記事欄）に残っているか。見出しの結合違いも見る。
  const rel = (candidate?.related || []).map((r) => (typeof r === 'string' ? { url: r } : r)), relUrls = new Set(rel.map((r) => publicationUrl(r.url) || r.url));
  const rawLines = lines.map((l) => l.text);
  for (const l of lines) for (const u of articleUrls(l.text)) {
    if (!relUrls.has(u)) { add('LOST_ARTICLE_URL', { line: l.i }); continue; }
    const r = rel.find((x) => (publicationUrl(x.url) || x.url) === u);
    if (r?.title && r.title !== r.url) {
      const segment = l.text.includes('▽') ? l.text.split('▽').find((part) => articleUrls(part).includes(u)) || l.text : l.text;
      const same = segment.replace(URL_RE, '').trim(), prev = l.i > 0 ? rawLines[l.i - 1] : '';
      const head = N(same).length > 0 ? same : prev.replace(URL_RE, '').trim();
      if (head && coverage(r.title, head) < 0.8 && coverage(head, r.title) < 0.8) add('ARTICLE_TITLE_MISMATCH', { line: l.i });
    }
  }
  // 出演者: 原文【出演・スタッフ】の各行の名前部分が出演者欄にあるか。出演者欄に宣伝や連絡先が混ざっていないか。
  const castArr = Array.isArray(candidate?.cast) ? candidate.cast.map((x) => (typeof x === 'string' ? x : x.text || '')) : String(candidate?.cast || '').split(/\n|、|,|／/).filter(Boolean);
  const castAll = castArr.join(' ');
  if (candidate?.cast !== undefined) {
    for (const l of lines.filter((x) => x.expect === 'STAFF' && !STAFF_SECTION.test(x.text) && !/^\s*(?:https?:\/\/\S+\s*)+$/.test(x.text))) {
      const name = l.text.replace(URL_RE, '').replace(/[（(][^）)]*[）)]/g, '').replace(/^(?:MC|司会|音源編集|出演|ゲスト|聞き手|パーソナリティー?)[\s　:：]*/, '').replace(/[／/|｜]\s*$/, '').trim();
      if (N(name).length >= 2 && !N(castAll).includes(N(name))) add('CAST_MISSING', { line: l.i });
    }
    if (castArr.some((c) => CAST_BAD.test(c))) add('CAST_CONTAMINATED');
  }
  const keepParas = keep.length, descParas = desc.split(/\n+/).filter(Boolean).length;
  if (keepParas >= 3 && descParas === 1) add('LINEBREAK_LOST');
  if (rel.some((r) => !ARTICLE_RE.test(r.url) && (CAST_BAD.test(r.title || '') || !r.title))) add('RELATED_CONTAMINATED');
  // 明示的な案内が残る候補は合格させない（曖昧な本文を推測削除しない）。
  if (desc.split(/\n+/).some((line) => /PODCAST MEETING|朝ポキおたより.*(?:登録|始ま)|朝ポキ[0-9７7]*番組の更新情報・アーカイブはこちら|^[★☆].*クラウドファンディング.*こちら/.test(line) && !(/開催しました|開催された|収録した内容|収録した印刷工場|振り返|大盛況で終了/.test(line) && !/開催します|お申し込|応募|ご参加|募集/.test(line)))) add('PROMO_REMAINS_REVIEW');
  const ambiguous = lines.filter((l) => l.expect === 'AMBIGUOUS').length;
  const severe = findings.some((f) => /OVER_DELETION|EMPTY_OUTPUT|LOST_ARTICLE_URL|CAST_CONTAMINATED|STAFF_IN_BODY|HTML_RESIDUE|RELATED_CONTAMINATED/.test(f.type));
  const verdict = severe ? '不合格' : findings.length ? '要確認' : '自動検査合格・目視未確認';
  return { verdict, findings, stats: { rawLen: String(raw).length, outLen: desc.length, keepLines: keepParas, ambiguousLines: ambiguous, deletedRatio: +(1 - desc.length / Math.max(1, keep.reduce((a, l) => a + l.len, 0))).toFixed(2) } };
}

// 層化（番組・ホスト・長さ・新着/過去）
function stratum(item) {
  const host = /megaphone/.test(item.rss || item.audioUrl || '') ? 'Megaphone' : /omny/.test(item.rss || item.audioUrl || '') ? 'Omny' : 'その他';
  const L = Number(item.descLen || String(item.descriptionRaw || '').length), len = L < 300 ? '短' : L < 1500 ? '中' : '長';
  const d = String(item.date || '').replace(/\//g, '-'), age = d >= '2026-10-01' ? '新着' : '過去';
  return { show: item.show || '', host, len, age };
}
// 公開データ（既存の清掃済み）と RSS item を照合する鍵: Omny は音声URL内のクリップID、Megaphone は TASC 番号。
function joinKey(audio) { const s = String(audio || ''); return (s.match(/\/clips\/[^/]+\/[^/]+\/([0-9a-f-]{36})\//i) || s.match(/(TASC\d+)\.mp3/) || [])[1] || ''; }
function parseListField(v) { if (Array.isArray(v)) return v; return [...String(v || '').matchAll(URL_RE)].map((m) => m[0].replace(/['",\]]+$/, '')); }

// 全体集計。pairs: [{ epId, item(RSS, descriptionRaw付き), candidates: { existing, v2 } }]
function summarize(pairs, { samplePerType = 5 } = {}) {
  const out = { auditVersion: AUDIT_VERSION, pairs: pairs.length, byCandidate: {} };
  for (const pair of pairs) for (const [name, res] of Object.entries(pair.results)) {
    const b = (out.byCandidate[name] = out.byCandidate[name] || { audited: 0, verdict: {}, findingTypes: {}, itemsWithType: {}, samples: {}, strata: {} });
    b.audited++; b.verdict[res.verdict] = (b.verdict[res.verdict] || 0) + 1;
    const st = stratum(pair.item), sk = [st.host, st.len, st.age].join('/'), sh = (b.strata[st.show] = b.strata[st.show] || { audited: 0, fail: 0, review: 0 }), sx = (b.strata[sk] = b.strata[sk] || { audited: 0, fail: 0, review: 0 });
    for (const s of [sh, sx]) { s.audited++; if (res.verdict === '不合格') s.fail++; if (res.verdict === '要確認') s.review++; }
    const types = new Set(res.findings.map((f) => f.type));
    for (const f of res.findings) b.findingTypes[f.type] = (b.findingTypes[f.type] || 0) + 1;
    for (const t of types) { b.itemsWithType[t] = (b.itemsWithType[t] || 0) + 1; const s = (b.samples[t] = b.samples[t] || []); if (s.length < samplePerType) s.push(pair.epId); }
  }
  return out;
}
// 人の目視確認用の層化サンプル（EP-IDのみ）。各層から最大 k 件、決定的に選ぶ。
function stratifiedSample(pairs, k = 2) {
  const by = new Map(); for (const p of pairs) { const s = stratum(p.item), key = [s.show, s.host, s.len, s.age].join('/'); if (!by.has(key)) by.set(key, []); by.get(key).push(p.epId); }
  return [...by.entries()].sort().map(([key, ids]) => ({ stratum: key, epIds: ids.sort().slice(0, k) }));
}

return { cleanUrl, decodeNamedEntities, paraLines, STAR_NOTICE, INLINE_NOTICE_HEAD, AUDIT_VERSION, QUALITY_STATES, QUALITY_LOG_HEADERS, classifyRawLines, coverage, articleUrls, auditPair, stratum, joinKey, parseListField, summarize, stratifiedSample };
})();

var CleanerV4 = (function () {
// 概要欄清掃ロボ V4（Issue #308）。Node と GAS で同じコードを使う（build-cleaner-gas.mjs で GAS 用に1ファイル化）。
// 原則: 原文は変えない。原文だけを基準に、本文・出演者（リンク付き）・関連記事（見出し＋URLのペア）を分ける。
// 迷うもの（見出しなし記事URL・非記事リンク・本文の大幅減少・監査で重大所見）は 要確認。品質確認済は人だけが付ける。
const { descriptionLines, DESCRIPTION_VERSION } = DescEditor;
const { auditPair, AUDIT_VERSION, cleanUrl, paraLines, STAR_NOTICE, INLINE_NOTICE_HEAD, decodeNamedEntities } = QualityAudit;
const CLEANER_VERSION = 'SC4-11(' + DESCRIPTION_VERSION + ')';   // SC4-10 は所在不明の版（2026-11-12）と衝突させないため欠番
const T = (v) => String(v ?? '').trim();
const NZ = (t) => String(t ?? '').normalize('NFKC').replace(/\s+/g, '');
const URL_RE = /https?:\/\/[^\s<>「」『』（）()"'、]+/g;
const ARTICLE_URL = /^https?:\/\/(?:www\.asahi\.com\/(?:[a-z]+\/)?articles\/|digital\.asahi\.com\/articles\/|withnews\.jp\/article\/|globe\.asahi\.com\/article\/|book\.asahi\.com\/article\/|www\.asahi\.com\/special\/(?!podcasts))/;
const SNS_URL = /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|instagram\.com|tiktok\.com|facebook\.com|threads\.net|youtube\.com\/@|note\.com|bsky\.app)\//i;
// 見出しの揺れ（全半角・括弧・コロン）。本文系の見出しは「見出しだけ」を落として中身は残す。
const H = (names) => new RegExp('^\\s*(?:【|\\[|［|〔|■|◆|▼|●)?\\s*(?:' + names + ')\\s*(?:】|\\]|］|〕)?\\s*[:：]?\\s*', 'i');
const BODY_HEAD = H('番組内容|番組説明|番組紹介|内容|概要|今回のテーマ|今回の内容|テーマ|あらすじ');
const STAFF_HEAD = H('出演[・／/]?スタッフ|出演者|出演|スタッフ|ゲスト|パーソナリティー?|MC');
const RELATED_HEAD = H('関連記事|関連リンク|関連URL|参考記事|写真まとめ|特集ページ|まとめてわかる');
const DROP_HEAD = H('おねがい|お願い|朝ポキ情報|お知らせ|イベント|告知|募集|プレゼント|お便り募集|おたより募集|SNS');
// 定型の宣伝・広告（行ごと除去）。本編の話題（Xの騒動・イベントの報道）を誤って消さないよう、宣伝の言い回しに限る。
const PROMO = /読み放題|スタンダードコース|初回限定|初月無料|月額\s*[\d０-９,，]+円|See .*omnystudio\.com\/listener|Learn more about your ad choices|購読料で配信|会員登録をお願い|^交流はdiscord|^ご意見・感想・リクエスト|おたよりフォーム|^メルマガ|広告ご検討の企業様|^番組検索ツール|^最新情報はX|^番組カレンダー|全話あります公式サイト|アプリで記者と対話|^朝ポキTV|ほかにも(?:多彩な)?番組を配信中|^★?ご感想はこちら|フォローをお願い|フォローしてね|チャンネル登録|^(?:X|Twitter|Instagram|インスタ)(?:\s*[:：]|\s*はこちら|\s*https?:)|配信、テキストでも読めます|フォロー[、,]?\s*お願い|をフォロー|お便りは(?:こちら|下記|フォーム)|お便りを(?:お待ち|お寄せ|募集|送って|どうぞ)|discord|ディスコード|お待ちしています|申し込みはこちら|申込はこちら|^[★☆※]\s*(?:お便り|おたより|ご感想|ご意見)/i;
// 原文で確認した独立した案内行だけ。本文中のフォーム・キャンペーン報道には適用しない。
const CONTACT_LINE = /^(?:ご意見・ご要望|フォーム|ツイッター|メール).*?(?:forms\.gle|twitter\.com|podcast@asahi)/i;
const EXTRA_PROMO = /^(?:ご登録フォーム\s+https?:|https?:\/\/que\.digital\.asahi\.com\/question\/11008783\s+（ご登録フォーム）)|^(?:有料会員、)?始めるなら今[、。].*朝日新聞デジタル.*キャンペーン|^[３3]STEPで朝リスちゃんグッズGet！/;
const SOCIAL_LABEL_LINE = /^(?:https?:\/\/(?:twitter\.com|x\.com)\/[^\s（）()]+\s*[（(][^）)]+[）)]\s*)+$/i;
const NEWSLETTER_LINE = /^(?:・\s*)?(?:メールマガジン)?「朝ポキおたより」(?:が|に|、).*?(?:ご登録|始まり|始まります)/;
const ARCHIVE_LINE = /^(?:過去回は、「連載」→「伊藤・奥山・神田」からお聞きいただけます。)?朝ポキ7番組の更新情報・アーカイブはこちら！$/;
const INVITE_2022 = /^(?:【(?:ご案内|締め切り迫る)】)?9月23日に 朝ポキ 初の対面イベント「PODCAST MEETING 2022」を開催！皆さんと会いたいです！$/;
const EVENT_PROMO = /(?:募集|応募|申し込み|申込|お申し込み|参加者|チケット|エントリー|アンケート|フォーム|お寄せください|お待ちしています)/;

// 原文を見出しで区切った節に分ける（見出しを境界として扱う。全削除の正規表現にしない）
function sections(raw) {
  const pl = paraLines(raw), out = []; let cur = { kind: 'body', head: '', lines: [] }, notice = -1;
  const paras = new Map(); pl.lines.forEach(({text,p}) => paras.set(p, (paras.get(p) || '') + '\n' + text));
  const promoParas = new Set([...paras].filter(([p,t]) => pl.hasParas && /(?:^|\n)(?:【ご案内】|【リアルで新聞をめくろう】|[★☆]「PODCAST MEETING)/.test(t) && /PODCAST MEETING/.test(t) && /申し込|申込|応募|参加|開催|対象はデジタル版有料会員/.test(t) && /https?:\/\/(?:ciy\.digital\.asahi\.com\/ciy\/|que\.digital\.asahi\.com\/question\/|forms\.gle\/|t\.asahi\.com\/wr7n)/.test(t)).map(([p])=>p));
  let promoP = -1;
  const start = (kind, head, rest) => { out.push(cur); cur = { kind, head, lines: rest ? [rest] : [] }; };
  for (const { text: l, p } of pl.lines) {
    let m;
    if (promoParas.has(p)) { if (promoP !== p) { start('notice', 'PODCAST_MEETING_INVITATION', ''); promoP = p; } cur.lines.push(l); continue; }
    if (promoP >= 0) { start('body', '', ''); promoP = -1; }
    if (notice >= 0 && (p !== notice || /^[【★☆※]/.test(l))) { notice = -1; if (cur.kind === 'notice') start('body', '', ''); }   // ★告知は段落の終わりまで
    if (pl.hasParas && STAR_NOTICE.test(l)) { start('notice', '★告知', l); notice = p; }
    else if (pl.hasParas && INLINE_NOTICE_HEAD.test(l) && !/^【[^】]+】\s*$/.test(l)) { start('notice', (l.match(INLINE_NOTICE_HEAD) || [''])[0], l); notice = p; }
    else if ((m = l.match(STAFF_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('staff', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(RELATED_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('related', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(DROP_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('drop', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(BODY_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('body', m[0].trim(), l.slice(m[0].length).trim());
    else if (/^\s*【[^】]{1,40}】\s*$/.test(l)) start(/関連|参考|記事|リンク|アーカイブ/.test(l) ? 'related' : /参加|イベント|フェス|募集|お知らせ|告知|プレゼント|チケット|会員|キャンペーン|SNS|フォロー/.test(l) ? 'drop' : 'body', l.trim(), '');   // 名前の決まっていない見出しだけの行も境界にする
    else cur.lines.push(l);
  }
  out.push(cur); return out.filter((s) => s.lines.length || s.head);
}
const urlsOf = (t) => [...String(t).matchAll(URL_RE)].map((m) => m[0].replace(/[.,;、。]+$/, ''));
const stripUrls = (t) => String(t).replace(URL_RE, '').replace(/[ 　]*[／/|｜][ 　]*$/, '').replace(/[ 　]{2,}/g, ' ').trim();
const ROLE = /^(MC[・、,]?音源編集|MC|司会|聞き手|パーソナリティー?|ゲスト|出演|音源編集|編集|制作|構成|ナレーション|プロデューサー|ディレクター)[\s　:：・、]+/;   // 役割の後に区切りがあるときだけ（「ゲスト1さん」等の氏名を削らない）

// 出演者1行 → {role, name, note, links, raw}。氏名の推定はしない（原文の文字列をそのまま分けるだけ）
function parseCastLine(line) {
  const raw = T(line), links = urlsOf(raw); let text = stripUrls(raw), role = '';
  const m = text.match(ROLE); if (m) { role = m[1]; text = text.slice(m[0].length).trim(); }
  const note = (text.match(/[（(]([^）)]*)[）)]/) || [])[1] || '';
  if (!role && /MC|司会|聞き手|音源編集|ゲスト/.test(note)) role = note;
  const name = text.replace(/[（(][^）)]*[）)]/g, '').trim();
  return { role, name, note, links, raw };
}

function cleanV4(raw) {
  const src = String(raw ?? '');
  if (!src.trim()) return { ok: false, holds: ['RAW_EMPTY'], text: '', cast: [], related: [], socials: [], removed: [] };
  const secs = sections(src), follow = [], body = [], cast = [], related = [], removed = [], socials = [], holds = [], notes = [];
  const pushRel = (title, url, kind) => { const clean = cleanUrl(url), old = related.find((r) => r.url === clean); if (old) { if (!old.title && T(title)) old.title = T(title); return; } related.push({ title: T(title).replace(/\s*[（(]\s*[）)]\s*$/, '').replace(/\s*[（(]\s*$/, '').trim(), url: clean, originalUrl: url, kind: kind || 'article', source: '概要原文' }); };
  for (const s of secs) {
    if (s.kind === 'related') s.lines = s.lines.flatMap((l) => l.includes('▽') && urlsOf(l).filter((u) => ARTICLE_URL.test(u)).length > 1 ? l.split('▽').filter(Boolean) : [l]);
    if (s.kind === 'drop') { removed.push({ reason: 'SECTION_' + s.head, lines: s.lines.length }); continue; }
    if (s.kind === 'notice') {   // ★告知・見出し付き告知: 本文に入れない。「氏名＋URL」の行（アプリでフォロー等）は出演者に無ければ出演者へ保全
      removed.push({ reason: 'NOTICE', lines: s.lines.length });
      (s.head === 'PODCAST_MEETING_INVITATION' ? [] : s.lines.slice(1)).forEach((l) => { const c = parseCastLine(l); if (!PROMO.test(l) && !CONTACT_LINE.test(l) && c.name && c.links.length && c.name.length <= 20 && !/[。！？!?、]/.test(c.name)) follow.push({ ...c, note: c.note || '告知欄で紹介' }); });
      continue;
    }
    if (s.kind === 'staff') {
      for (const l of s.lines) { if (PROMO.test(l) || CONTACT_LINE.test(l) || EXTRA_PROMO.test(l) || NEWSLETTER_LINE.test(l) || ARCHIVE_LINE.test(stripUrls(l)) || INVITE_2022.test(l) || (src.includes('対面イベント「PODCAST MEETING 2022」を開催') && /^※応募締切は9月4日です。$/.test(l))) { removed.push({ reason: 'PROMO_IN_STAFF' }); continue; } const c = parseCastLine(l); if (c.name || c.role) cast.push(c); }
      continue;
    }
    for (let i = 0; i < s.lines.length; i++) {
      const l = s.lines[i], us = urlsOf(l), text = stripUrls(l);
      if (SOCIAL_LABEL_LINE.test(l)) { socials.push(...us); removed.push({ reason: 'SOCIAL_LABEL' }); continue; }
      if (PROMO.test(l) || CONTACT_LINE.test(l) || EXTRA_PROMO.test(l) || NEWSLETTER_LINE.test(l) || ARCHIVE_LINE.test(stripUrls(l)) || INVITE_2022.test(l) || (src.includes('対面イベント「PODCAST MEETING 2022」を開催') && /^※応募締切は9月4日です。$/.test(l))) { removed.push({ reason: 'PROMO' }); continue; }
      const art = us.filter((u) => ARTICLE_URL.test(u));
      if (art.length) {   // 見出しと同じ行 or 直前の行（URLだけの行）
        let title = text; if (!T(title) && i > 0 && body.length && body[body.length - 1] === stripUrls(s.lines[i - 1])) title = body.pop();   // 直前の行が見出し
        art.forEach((u) => pushRel(title, u)); if (!T(title) && art.some((u) => !related.find((r) => r.url === cleanUrl(u) && r.title))) holds.push('RELATED_URL_WITHOUT_TITLE');
        continue;
      }
      if (s.kind === 'related') {   // 関連節の中の見出し行（次行がURL）は body に一時置き、次の記事URLで回収
        if (us.length && !art.length) {
          if (EVENT_PROMO.test(l) || us.some((u) => SNS_URL.test(u))) { removed.push({ reason: 'RELATED_PROMO' }); continue; }
          let title = text; if (!T(title) && i > 0 && body.length && body[body.length - 1] === stripUrls(s.lines[i - 1])) title = body.pop();
          if (T(title)) { us.forEach((u) => pushRel(title, u, 'link')); continue; }   // 見出しつきの非記事リンク（動画・特集・短縮URL等）は種類 link として組で保存
          holds.push('RELATED_NONARTICLE_REVIEW'); removed.push({ reason: 'RELATED_NONARTICLE_HELD' }); continue; }
        const nx = s.lines[i + 1] || ''; if (urlsOf(nx).length && !stripUrls(nx)) { body.push(text); continue; }   // 次の行がURLだけ→見出しとして一時置き
        if (text) notes.push(text); continue;   // 関連節の説明文は本文に混ぜず、関連記事JSONに note として保存
      }
      if (us.length) {
        if (us.every((u) => SNS_URL.test(u))) { socials.push(...us); removed.push({ reason: 'SNS_LINK' }); if (text && !/^[@＠]?\w+$/.test(text)) body.push(text); continue; }
        if (EVENT_PROMO.test(l)) { removed.push({ reason: 'EVENT_OR_FORM' }); continue; }
        if (!text) { removed.push({ reason: 'URL_ONLY' }); continue; }
        body.push(text); removed.push({ reason: 'URL_STRIPPED_FROM_BODY' }); continue;
      }
      if (text) body.push(text);
    }
  }
  // 閉じていない見出し行（関連節で回収されなかった見出し）が本文末尾に残らないよう、関連節由来の行は本文から外さない＝そのまま（要確認で拾う）
  const text = body.join('\n').replace(/(?:※\s*)?(?:「[^」]{1,20}」の)?過去(?:の)?回は(?:下記|こちら)(?:から)?[^。\n]*[。．]?/g, '').split('\n').filter((x) => T(x)).join('\n').replace(/\s*(?:ご意見・感想・リクエスト|ほかにも(?:多彩な)?番組を配信中|Learn more about your ad choices)[\s\S]*$/i, '').replace(/[ 　]{2,}/g, ' ').trim();
  if (!text) holds.push('CONTENT_EMPTY');
  follow.forEach((c) => { if (!cast.some((x) => NZ(x.name) === NZ(c.name))) cast.push(c); });
  notes.forEach((n) => related.push({ title: n, url: '', kind: 'note', source: '概要原文' }));
  return { ok: !holds.length, holds: [...new Set(holds)].filter((h) => h !== 'RELATED_URL_WITHOUT_TITLE' || related.some((r) => r.kind === 'article' && !r.title)), text, cast, related, socials: [...new Set(socials)], removed };
}

// 台帳の書式に合わせる: 出演者=原文の行（リンク付き）を改行区切り、関連記事URL=記事URLを空白区切り
const castCell = (cast) => cast.map((c) => c.raw.replace(/\s+/g, ' ').trim()).join('\n');
const relatedCell = (related) => related.filter((r) => (r.kind || 'article') === 'article' && r.url).map((r) => r.url).join(' ');

// 既存値が「原文から機械的に取り出しただけ」か（＝自動値。更新してよい）。原文に無い文字・URLを含むなら人の手が入った可能性→保護
// SC4-11: 旧清掃器の出力の痕跡を自動値として認める（2026-11-13 V2実データ1,675件の分析）。
//   ①旧清掃器が足した節見出しだけの行（【関連記事】〖出演・スタッフ〗等）②URLを消した跡の空かっこ「（ ）」・矢印（↓→▽）・「mailto:」
//   ③リンクの表示文字・href の値（原文のタグの中にある文字）④名前付き文字参照（&darr; 等）。
//   原文に無い文・URLが1つでもあれば従来どおり保護（人が書き足した文は自動値にならない）。
const SECTION_WORD = /^(?:関連記事|関連リンク|出演|出演者|出演・スタッフ|出演スタッフ|スタッフ|ゲスト|MC|音源編集|ご意見・ご感想|ご意見ご感想)$/;
const URL_ANY = /(?:https?:\/\/|mailto:|www\.)[^\s<>"'）)」』】]+|\b[a-z0-9.-]+\.(?:com|co\.jp|jp|fm|me|net|org|st|style)(?:\/[^\s<>"'）)」』】]*)?/gi;
const PD = (t) => NZ(decodeNamedEntities(t)).replace(/[、。，．・「」『』（）()【】〖〗\[\]！？!?…:：;；"'“”‘’〜~ー—–\-,／/|｜↓→▽▼▶►➡＞>＜<※★☆■□◆◇●○♪]/g, '');
function rawSource(raw) {
  const plain = String(raw ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''), hrefs = [...plain.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  return [descriptionLines(plain).join('\n'), plain.replace(/<[^>]*>/g, '\n'), hrefs.join('\n')].join('\n');
}
const urlKey = (u) => cleanUrl(String(u).replace(/[.,;、。]+$/, ''));
function firstNotDerived(existing, raw) {
  const ex = T(existing); if (!ex) return null;
  const src = rawSource(raw), srcUrls = new Set(urlsOf(src).map(urlKey));
  const u = urlsOf(ex).find((x) => !srcUrls.has(urlKey(x))); if (u) return { type: 'URL_NOT_IN_RAW', sample: u.slice(0, 80), rawUrls: [...srcUrls].slice(0, 3).map((x) => x.slice(0, 60)) };
  const srcP = PD(src.replace(URL_ANY, ' '));
  const frags = ex.replace(URL_ANY, '\n').replace(/[（(]\s*[)）]/g, '\n').replace(/[↓→▽▼▶►➡]+/g, '\n')
    .replace(/[【〖]([^】〗]{1,20})[】〗]/g, (m, h) => (SECTION_WORD.test(h.trim()) ? '\n' : '\n' + h + '\n')).split(/[\n。！？／/|｜,、]+/);
  const l = frags.find((x) => { const n = PD(x); return n.length >= 2 && !srcP.includes(n); });
  return l ? { type: 'TEXT_NOT_IN_RAW', sample: l.trim().slice(0, 80) } : null;
}
function derivedFromRaw(existing, raw) { return !firstNotDerived(existing, raw); }
// 診断用: 自動値とみなせなかった最初の理由（短く切る）
function explainDerived(existing, raw) { return firstNotDerived(existing, raw); }

// 1件の判定。existing = 台帳の現在値 {summary, cast, related}
function judgeEpisode(raw, existing = {}, sha256) {
  const c = cleanV4(raw), findings = [];
  if (!String(raw ?? '').trim()) return { verdict: 'HOLD', reason: 'RAW_EMPTY', clean: c, findings: [], compare: '', writable: {}, manual: [] };
  const a = auditPair(raw, { description: c.text, cast: c.cast.map((x) => [x.role, x.name, x.note].join(' ')), related: c.related.map((r) => ({ url: r.url, title: r.title })) });
  findings.push(...a.findings.map((f) => f.type));
  const ex = { summary: T(existing.summary), cast: T(existing.cast), related: T(existing.related) }, nw = { summary: c.text, cast: castCell(c.cast), related: relatedCell(c.related) };
  const same = (k) => NZ(ex[k]) === NZ(nw[k]) || (k === 'related' && ex[k] && NZ(ex[k].split(/\s+/).map(cleanUrl).join(' ')) === NZ(nw[k]));
  const manual = ['summary', 'cast', 'related'].filter((k) => ex[k] && !same(k) && !derivedFromRaw(ex[k], raw));
  const severe = a.verdict === '不合格' || c.holds.includes('CONTENT_EMPTY');
  let verdict = severe ? '不合格' : (c.holds.length || a.verdict === '要確認') ? '要確認' : '自動検査合格・目視未確認';
  const cmp = !ex.summary ? '旧空欄' : same('summary') ? '同一' : '差分あり';
  const writable = {};
  ['summary', 'cast', 'related'].forEach((k) => { writable[k] = !manual.includes(k) && !same(k) && (k === 'summary' ? !!nw.summary : !!nw[k]); });   // 新しい値が空の列は書かない（既存を消さない）
  // 概要自体が原文由来で品質合格なら、他列の手動値を保持したまま概要を反映できる。概要の手動値は常に要確認。
  if (manual.length) { findings.push('MANUAL_EDIT_PROTECTED:' + manual.join('+')); if (verdict === '自動検査合格・目視未確認' && (manual.includes('summary') || !writable.summary)) verdict = '要確認'; }
  if (ex.cast && !c.cast.length) findings.push('CAST_NOT_IN_RAW');   // 既存の出演者が原文に無い（既定値の疑い）。消さずに記録
  if (verdict === '不合格') ['summary', 'cast', 'related'].forEach((k) => { writable[k] = false; });
  return { verdict, reason: [...new Set([...c.holds, ...findings])].join(','), clean: c, findings, compare: cmp, writable, manual, rawSha: sha256 ? sha256(String(raw)) : '', auditVersion: AUDIT_VERSION };
}

return { CLEANER_VERSION, sections, parseCastLine, cleanV4, castCell, relatedCell, derivedFromRaw, explainDerived, judgeEpisode };
})();

// ===== 概要欄清掃ロボ（Issue #308）— 入口 =====
// 管理人が押すのは番号付き関数だけ: S1_点検 → S2_清掃監査（全件・時間切れなら続きから）→ S3A_COPYへ反映_試験10件 → S3B_COPYへ反映_全件 →（確認後）S4_V2作業用へ反映。S0_進捗 はいつでも。
// 守ること: 原文は読むだけ（公式RSSから毎回取得し、SHA256で照合）。V1原本・本番59列・旧GAS参照シートは開かない。トリガーは作らない。
// 台帳へ書くのは「概要（清掃済）・出演者・関連記事URL」の3列だけ。手動訂正の可能性がある値・監査時から変わった値は書かない。

var SC_CONFIG = {
  copyId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',     // 【COPY試験】V2収蔵ボット …（本番ではない）。結果・進捗・反映履歴のシートもここに作る
  copyNameIncludes: '【COPY試験】',
  v2WorkingId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',  // V2作業用台帳（S4 だけが書く）
  // S4 で V2作業用へ反映する範囲: 'HUMAN_OK' = 結果シートの「人の確認」が OK の行だけ（既定）／'AUTO_PASS' = 自動検査合格も含める（COPYで抜き取り確認した後に管理人が切り替える）
  v2ApplyLevel: 'AUTO_PASS',   // 2026-11-12 司令塔指示で AUTO_PASS（COPYで抜き取り20件確認後）。'HUMAN_OK' に戻すと人の確認OKの行だけ
  ledgerSheet: 'V2・統合台帳',
  timeBudgetMs: 270000,     // 1回の実行で処理に使う時間（GASの上限6分に余裕を残す）
  applyMaxPerRun: 1200, // 600セル約65秒の実測に基づき1200セル程度ずつ。履歴と現在値で重複書込を防ぐ
  feeds: P25V2_COPY_FEEDS_()
};
var SC_REFUSE_IDS_ = ['1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'];   // V1原本・本番59列・旧GAS参照
var SC_RESULT_ = '清掃・結果', SC_PROGRESS_ = '清掃・進捗', SC_HISTORY_ = '清掃・反映履歴';
var SC_HEADERS_ = ['EP-ID', '公式GUID', '番組', '原文SHA256', '原文文字数', '原文取得', '判定', '比較', '理由', '書換可', '新・概要', '新・出演者', '新・関連記事URL', '関連記事JSON(見出し+URL)', '出演者JSON', 'SNS等保全URL', '除去内訳', '旧・概要', '旧・出演者', '旧・関連記事URL', '旧値SHA', '清掃版', '処理日時', '人の確認', '確認メモ', '反映先', '反映日時'];
var SC_HIST_HEADERS_ = ['反映日時', '反映ID', '対象', 'EP-ID', '列', '旧値', '新値', '状態'];
// V2作業用台帳（34列）は列を増やさず、同じファイルの別タブに構造化データ（見出し＋URLの組・出演者の内訳）を保持する
// 台帳3列を書いたかどうかに依存せず、V2作業用台帳の全EPを1行ずつ保存する（S5）。S4 は書いた回だけ更新する
var SC_V2DETAIL_ = 'V2・清掃詳細', SC_V2DETAIL_HEADERS_ = ['EP-ID', '公式GUID', '関連記事JSON(見出し+URL)', '出演者JSON', 'SNS等保全URL', '原文SHA256', '清掃版', '判定', '理由', '原文状態', '更新日時'];
// 収蔵詳細（P25V2と同じ17列）に保全済みの原文と、公式RSSの現在の原文が違うときの記録（原文は上書きしない）
var SC_RAWHIST_ = 'V2・原文変化履歴', SC_RAWHIST_HEADERS_ = ['検出日時', 'EP-ID', '公式GUID', '保全済SHA256', 'RSS現在SHA256', 'RSS現在文字数', 'RSS現在原文'];
var SC_CELL_MAX_ = 49000;   // シートの1セル上限（5万字）未満
var SC_COLS_ = { summary: '概要（清掃済）', cast: '出演者', related: '関連記事URL' };
function P25V2_COPY_FEEDS_() { return [
  { show: 'ニュースの現場から', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/684015f9-2396-4ac4-bc1f-ac0f0033d08c/podcast.rss', limit: 0 },
  { show: 'MEDIA TALK', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/07a1de49-67cf-4714-8581-ac1000059302/podcast.rss', limit: 0 },
  { show: 'こどもそうだんしつ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/693cfdd6-f5a9-4308-9025-adb10164b5b1/podcast.rss', limit: 0 },
  { show: 'スポンジ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/8ceab8ef-af5f-44e9-9545-b4ab0024434b/podcast.rss', limit: 0 },
  { show: 'ニュースの学校', url: 'https://feeds.megaphone.fm/TASC5851398719', limit: 0 },
  { show: 'ドーナツ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/c373aac9-fb6a-4172-8a8f-b498003d9389/podcast.rss', limit: 0 },
  { show: '報談', url: 'https://feeds.megaphone.fm/TASC9421488254', limit: 0 }]; }

function scVersion_() { return CleanerV4.CLEANER_VERSION + '|' + QualityAudit.AUDIT_VERSION; }
function scLog_(fn, o) { Logger.log(fn + ' ' + JSON.stringify(o, null, 1)); return o; }
function scOpen_(id, nameIncludes) {
  if (SC_REFUSE_IDS_.indexOf(id) >= 0) throw new Error('PROTECTED_TARGET_REFUSED');
  p25v2AssertIsolated_({ hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: ScriptApp.getProjectTriggers().length });
  var ss = SpreadsheetApp.openById(id); if (ss.getId() !== id) throw new Error('OPENED_ID_MISMATCH');
  if (nameIncludes && ss.getName().indexOf(nameIncludes) < 0) throw new Error('TARGET_NAME_NOT_EXPECTED');
  var sh = ss.getSheetByName(SC_CONFIG.ledgerSheet); if (!sh) throw new Error('LEDGER_SHEET_NOT_FOUND');
  return { ss: ss, sh: sh };
}
function scSheet_(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.getRange(1, 1, 1, headers.length).setValues([headers]); s.setFrozenRows(1); }
  var h = s.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (h.join('\u0001') !== headers.join('\u0001')) throw new Error('SHEET_HEADER_MISMATCH ' + name);
  return s;
}
function scLedger_(sh) {   // 台帳を見出し名で読む（列番号は決め打ちしない）
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(), h = v[0], I = function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + n); return i; };
  var ix = { ep: I('EP-ID'), show: I('番組'), guid: I('公式GUID'), uuid: I('公式JSON UUID'), url: I('公式個別URL'), summary: I(SC_COLS_.summary), cast: I(SC_COLS_.cast), related: I(SC_COLS_.related) };
  var rows = v.slice(1).map(function (r, i) {
    var g = p25v2Guids_({ guid: r[ix.guid], jsonUuid: r[ix.uuid], officialUrl: r[ix.url] });
    return { row: i + 2, ep: r[ix.ep], show: r[ix.show], guid: String(r[ix.guid] || '').toLowerCase(), guids: g, summary: r[ix.summary], cast: r[ix.cast], related: r[ix.related] };
  }).filter(function (r) { return r.ep; });
  return { values: v, ix: ix, rows: rows };
}
function scRawMap_() {
  var f = p25v2FetchFeeds_(SC_CONFIG.feeds), m = {};
  var item = {};
  f.items.forEach(function (it) { if (it.guid && it.descriptionRaw) { m[String(it.guid).toLowerCase()] = it.descriptionRaw; item[String(it.guid).toLowerCase()] = it; } });
  return { map: m, item: item, errors: f.errors, stats: f.stats, items: f.items.length };
}

// S0: 進捗の表示（書込なし）
function S0_進捗() {
  var o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), p = o.ss.getSheetByName(SC_PROGRESS_);
  return scLog_('S0_進捗', p ? p.getRange(1, 1, p.getLastRow(), 2).getDisplayValues() : '未実行');
}
// S1: 点検（書込なし）。対象・列・トリガー0・RSS取得・原文と台帳の突き合わせ件数
function S1_点検() {
  var t0 = Date.now(), o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), L = scLedger_(o.sh), raw = scRawMap_();
  var withRaw = L.rows.filter(function (r) { return r.guids.some(function (g) { return raw.map[g]; }); }).length;
  return scLog_('S1_点検', { status: raw.errors.length ? 'CHECK_WITH_FEED_ERRORS' : 'CHECK_OK', target: o.ss.getName(), ledgerRows: L.rows.length, rssItems: raw.items, ledgerWithRaw: withRaw, ledgerWithoutRaw: L.rows.length - withRaw, existingSummary: L.rows.filter(function (r) { return r.summary; }).length, feedErrors: raw.errors, ms: Date.now() - t0, version: scVersion_() });
}
// S2: 清掃・監査（全件）。原文と既存値を比べ、結果シートに保存。時間切れなら続きから（もう一度押す）。同じ原文・同じ既存値・同じ版の行は処理しない＝再実行で差分0
function S2_清掃監査() {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('S2_清掃監査', { status: 'LOCKED' });
  try {
    var o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(o.ss, SC_RESULT_, SC_HEADERS_), L = scLedger_(o.sh), raw = scRawMap_();
    if (raw.errors.length) return scLog_('S2_清掃監査', { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });   // 一部の番組だけで判定を進めない
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], at = {}, H = {};
    SC_HEADERS_.forEach(function (n, i) { H[n] = i; }); cur.forEach(function (r, i) { at[r[0]] = i; });
    var pre = scPreservedRaw_();
    var props = PropertiesService.getScriptProperties(), start = Number(props.getProperty('SC_CURSOR') || 0), ver = scVersion_(), now = new Date().toISOString();
    var updated = 0, skipped = 0, i = start, done = false;
    for (; i < L.rows.length; i++) {
      if (i % 50 === 0 && Date.now() - t0 > SC_CONFIG.timeBudgetMs) break;
      var r = L.rows[i], g = r.guids.filter(function (x) { return raw.map[x]; })[0], text = g ? raw.map[g] : '';
      if (!text && pre[r.ep] && r.guids.indexOf(pre[r.ep].guid) >= 0) { g = pre[r.ep].guid; text = pre[r.ep].text; }   // 今のRSSに無い回は、V2・収蔵詳細に保全済みの公式RSS原文（SHA256照合済み）を使う
      var exSha = p25v2GasSha256_([r.summary, r.cast, r.related].join('\u0001')), rawSha = text ? p25v2GasSha256_(text) : '';
      var k = at[r.ep], old = k != null ? cur[k] : null;
      if (old && old[H['原文SHA256']] === rawSha && old[H['清掃版']] === ver && old[H['旧値SHA']] === exSha) { skipped++; continue; }
      var row = scJudgeRow_(r, text, g, rawSha, exSha, ver, now, H);
      if (old) { row[H['人の確認']] = old[H['人の確認']]; row[H['確認メモ']] = old[H['確認メモ']]; row[H['反映先']] = old[H['反映先']]; row[H['反映日時']] = old[H['反映日時']]; cur[k] = row; }   // 人の記入は保持
      else { at[r.ep] = cur.length; cur.push(row); }
      updated++;
    }
    if (i >= L.rows.length) { done = true; i = 0; }
    if (updated) { var rg = res.getRange(2, 1, cur.length, SC_HEADERS_.length); rg.setNumberFormat('@'); rg.setValues(cur); }   // 文字列のまま保存（日付・数式に化けさせない）
    props.setProperty('SC_CURSOR', String(i));
    var summary = scProgress_(o.ss, cur, H, { done: done, cursor: i, total: L.rows.length, updated: updated, skipped: skipped, ms: Date.now() - t0, version: ver, at: now });
    return scLog_('S2_清掃監査', summary);
  } finally { lock.releaseLock(); }
}
function scJudgeRow_(r, text, g, rawSha, exSha, ver, now, H) {
  var row = SC_HEADERS_.map(function () { return ''; });
  row[H['EP-ID']] = r.ep; row[H['公式GUID']] = g || r.guid; row[H['番組']] = r.show; row[H['原文SHA256']] = rawSha; row[H['原文文字数']] = text ? String(text.length) : '0';
  row[H['原文取得']] = text ? '公式RSS' : 'なし'; row[H['旧・概要']] = r.summary; row[H['旧・出演者']] = r.cast; row[H['旧・関連記事URL']] = r.related; row[H['旧値SHA']] = exSha; row[H['清掃版']] = ver; row[H['処理日時']] = now;
  if (!text) { row[H['判定']] = 'HOLD'; row[H['理由']] = 'RAW_NOT_IN_RSS（公式RSSに原文なし。推測で補完しない）'; row[H['比較']] = r.summary ? '旧値のみ' : '旧空欄'; return row; }
  var j;
  try { j = CleanerV4.judgeEpisode(text, { summary: r.summary, cast: r.cast, related: r.related }); }
  catch (e) { row[H['判定']] = '要確認'; row[H['理由']] = 'CLEANER_ERROR ' + String(e.message || e).slice(0, 200); return row; }
  var c = j.clean;
  row[H['判定']] = j.verdict; row[H['比較']] = j.compare; row[H['理由']] = j.reason.slice(0, 500);
  row[H['書換可']] = ['summary', 'cast', 'related'].filter(function (k) { return j.writable && j.writable[k]; }).join('+');
  row[H['新・概要']] = c.text; row[H['新・出演者']] = CleanerV4.castCell(c.cast); row[H['新・関連記事URL']] = CleanerV4.relatedCell(c.related);
  row[H['関連記事JSON(見出し+URL)']] = JSON.stringify(c.related); row[H['出演者JSON']] = JSON.stringify(c.cast); row[H['SNS等保全URL']] = c.socials.join(' ');
  var rm = {}; c.removed.forEach(function (x) { rm[x.reason] = (rm[x.reason] || 0) + 1; }); row[H['除去内訳']] = JSON.stringify(rm);
  return row;
}
function scProgress_(ss, cur, H, s) {
  var cnt = {}, cmp = {}, writable = 0; cur.forEach(function (r) { cnt[r[H['判定']]] = (cnt[r[H['判定']]] || 0) + 1; cmp[r[H['比較']]] = (cmp[r[H['比較']]] || 0) + 1; if (r[H['書換可']]) writable++; });
  var human = cur.filter(function (r) { return String(r[H['人の確認']]).toUpperCase() === 'OK'; }).length;
  var p = ss.getSheetByName(SC_PROGRESS_) || ss.insertSheet(SC_PROGRESS_);
  var rows = [['項目', '値'], ['最終実行', s.at], ['状態', s.done ? '全件完了（もう一度押すと変更分だけ再処理）' : '途中（もう一度 S2 を押すと続きから）'], ['処理位置', s.cursor + ' / ' + s.total], ['今回 更新', s.updated], ['今回 変更なし', s.skipped], ['所要ミリ秒', s.ms], ['清掃版', s.version], ['結果行数', cur.length]];
  Object.keys(cnt).sort().forEach(function (k) { rows.push(['判定: ' + k, cnt[k]]); });
  Object.keys(cmp).sort().forEach(function (k) { rows.push(['比較: ' + k, cmp[k]]); });
  rows.push(['書換可能な行', writable], ['人の確認 OK', human]);
  p.clear(); p.getRange(1, 1, rows.length, 2).setValues(rows);
  return { done: s.done, cursor: s.cursor, total: s.total, updated: s.updated, skipped: s.skipped, ms: s.ms, verdicts: cnt, compare: cmp, writable: writable, humanOk: human };
}

// 反映（共通）: 結果シートの「新・…」を台帳に書く。条件: 書換可・判定が許可範囲・台帳の現在値が監査時の旧値と同じ（変わっていたら人の編集とみなし書かない）・EP-IDとGUIDが一致
function scApply_(targetId, nameIncludes, level, label, maxEpisodes, resName, onlyEps) {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(c.ss, resName || SC_RESULT_, SC_HEADERS_), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_);
    var t = targetId === SC_CONFIG.copyId ? c : scOpen_(targetId, nameIncludes), L = scLedger_(t.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
    var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [];
    var cols = { summary: L.ix.summary, cast: L.ix.cast, related: L.ix.related }, NEW = { summary: '新・概要', cast: '新・出演者', related: '新・関連記事URL' }, OLD = { summary: '旧・概要', cast: '旧・出演者', related: '旧・関連記事URL' };
    var last = {}; if (hist.getLastRow() > 1) hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().forEach(function (h) { if (/^OK/.test(h[7])) last[h[2] + '\u0001' + h[3] + '\u0001' + h[4]] = h[6]; else if (h[7] === 'UNDO') delete last[h[2] + '\u0001' + h[3] + '\u0001' + h[4]]; });   // このロボが最後に書いた値（人の編集と区別する）
    var recovered = [], epCount = 0, applyId = new Date().toISOString() + '/' + label, now = new Date().toISOString(), writes = [], skip = {}, sk = function (w) { skip[w] = (skip[w] || 0) + 1; };
    cur.forEach(function (r, ri) {
      if (writes.length >= SC_CONFIG.applyMaxPerRun || (maxEpisodes && epCount >= maxEpisodes)) return;
      var ok = String(r[H['人の確認']]).toUpperCase() === 'OK', v = r[H['判定']];
      if (!(ok || (level === 'AUTO_PASS' && v === '自動検査合格・目視未確認'))) { sk('NOT_APPROVED_LEVEL'); return; }
      if (!r[H['書換可']]) { sk('NOTHING_TO_WRITE'); return; }
      if (onlyEps && !onlyEps[r[H['EP-ID']]]) { sk('OUT_OF_SCOPE'); return; }
      var x = byEp[r[H['EP-ID']]]; if (!x) { sk('EP_NOT_IN_TARGET'); return; }
      if (r[H['公式GUID']] && x.guids.indexOf(String(r[H['公式GUID']]).toLowerCase()) < 0) { sk('GUID_MISMATCH'); return; }
      var ks = String(r[H['書換可']]).split('+'), st = {};
      ks.forEach(function (k) { st[k] = String(x[k]) === String(r[H[NEW[k]]]) ? 'done' : (String(x[k]) === String(r[H[OLD[k]]]) || last[label + '\u0001' + x.ep + '\u0001' + SC_COLS_[k]] === String(x[k])) ? 'old' : 'changed'; });   // 列単位: 最新値は書かず、監査旧値またはロボ最終反映値との一致だけ更新を許す
      if (r[H['反映先']] === label && ks.every(function (k) { return String(x[k]) === String(r[H[NEW[k]]]); })) { sk('ALREADY_APPLIED'); return; }
      var hasChanged = ks.some(function (k) { return st[k] === 'changed'; }); if (hasChanged) sk('CHANGED_SINCE_AUDIT');   // 手動変更の可能性がある列は後段の old フィルタで保護し、他の安全な列は進める
      ks.filter(function (k) { return st[k] === 'done' && !r[H['反映先']]; }).forEach(function (k) { recovered.push([now, applyId, label, x.ep, SC_COLS_[k], String(r[H[OLD[k]]]), String(r[H[NEW[k]]]), 'OK(回収)']); });   // 反映記録のない一致列だけ履歴を回収（既存記録の重複は作らない）
      ks = ks.filter(function (k) { return st[k] === 'old'; });
      if (!ks.length) { if (!hasChanged) { cur[ri][H['反映先']] = label; cur[ri][H['反映日時']] = now; } return; }
      if (ks.some(function (k) { return /^[=+]/.test(String(r[H[NEW[k]]])); })) { sk('FORMULA_LIKE_VALUE_HOLD'); return; }
      epCount++;
      ks.forEach(function (k) { writes.push({ ri: ri, ep: x.ep, row: x.row, col: cols[k] + 1, colName: SC_COLS_[k], oldV: String(x[k]), newV: r[H[NEW[k]]] }); });
    });
    var histRows = [], bad = 0, byCol = {};
    var pend = writes.map(function (w) { return [now, applyId, label, w.ep, w.colName, w.oldV, w.newV, '書込中']; }).concat(recovered), hStart = hist.getLastRow() + 1;
    if (pend.length) { var pr = hist.getRange(hStart, 1, pend.length, SC_HIST_HEADERS_.length); pr.setNumberFormat('@'); pr.setValues(pend); SpreadsheetApp.flush(); PropertiesService.getScriptProperties().setProperty('SC_LAST_APPLY', applyId); }   // 先に履歴（旧値）を残してから書く＝途中で止まっても取消できる
    writes.forEach(function (w) { (byCol[w.col] = byCol[w.col] || []).push(w); });
    Object.keys(byCol).forEach(function (col) {   // 連続する行をまとめて書く（1セルずつ書くと遅く、時間切れで履歴が残らない恐れ）
      var ws = byCol[col].sort(function (a, b) { return a.row - b.row; }), i = 0;
      while (i < ws.length) { var j = i; while (j + 1 < ws.length && ws[j + 1].row === ws[j].row + 1) j++;
        t.sh.getRange(ws[i].row, Number(col), j - i + 1, 1).setValues(ws.slice(i, j + 1).map(function (w) { return [w.newV]; })); i = j + 1; }
    });
    SpreadsheetApp.flush();
    var lastRow = t.sh.getLastRow(), back = {};
    Object.keys(byCol).forEach(function (col) { back[col] = t.sh.getRange(1, Number(col), lastRow, 1).getDisplayValues(); });   // 読み戻しは列ごとに1回
    writes.forEach(function (w) { var b = back[w.col][w.row - 1][0], st = b === String(w.newV) ? 'OK' : 'READBACK_MISMATCH'; if (st !== 'OK') bad++; histRows.push([now, applyId, label, w.ep, w.colName, w.oldV, w.newV, st]); cur[w.ri][H['反映先']] = label; cur[w.ri][H['反映日時']] = now; });
    if (histRows.length) hist.getRange(hStart, 8, histRows.length, 1).setValues(histRows.map(function (h) { return [h[7]]; }));   // 書込中 → OK / READBACK_MISMATCH
    var detailWritten = 0;
    if (targetId !== SC_CONFIG.copyId) {   // V2作業用: 反映した行の構造化データを別タブに保存（EP-IDで上書き更新）
      var eps = {}; writes.forEach(function (w) { eps[w.ep] = 1; }); recovered.forEach(function (h) { eps[h[3]] = 1; });
      if (Object.keys(eps).length) detailWritten = scV2DetailUpsert_(t.ss, L, cur, H, eps, now).changed;
    }
    if (pend.length) res.getRange(2, 1, cur.length, SC_HEADERS_.length).setValues(cur);
    if (pend.length) PropertiesService.getScriptProperties().setProperty('SC_LAST_APPLY', applyId);   // 書込が無い回で取消対象を上書きしない
    return { status: bad ? 'READBACK_MISMATCH' : writes.length ? 'OK' : 'OK_NO_CHANGE', target: label, level: level, cellsWritten: writes.length, recoveredHistory: recovered.length, detailRows: detailWritten, episodes: Object.keys(writes.reduce(function (a, w) { a[w.ep] = 1; return a; }, {})).length, skipped: skip, applyId: applyId, ms: Date.now() - t0 };
  } finally { lock.releaseLock(); }
}
// S3: COPYの台帳へ反映（自動検査合格＋人の確認OK）。まず10件だけ（S3A）→ 結果シート・反映履歴で確認 → 全件（S3B）
function S3A_COPYへ反映_試験10件() { return scLog_('S3A_COPYへ反映_試験10件', scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 10)); }
function S3B_COPYへ反映_全件() { return scLog_('S3B_COPYへ反映_全件', scApply_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes, 'AUTO_PASS', 'COPY', 0)); }
// S4: V2作業用台帳へ反映（既定は「人の確認=OK」の行だけ。SC_CONFIG.v2ApplyLevel を 'AUTO_PASS' にすると自動検査合格も含める）
function S4_V2作業用へ反映() { return scLog_('S4_V2作業用へ反映', scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, null, scV2NotPassedScope_())); }
// V2へ書いてよい範囲: V2・清掃詳細で「自動検査合格」になっていない回（または行がない回）だけ。
// 既に合格して反映済みのロボ出力は、清掃版が変わっても書き直さない（2026-11-12: 版の古い規則で新しい出力を上書きした事故の再発防止）
function scV2NotPassedScope_() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(SC_V2DETAIL_), L = scLedger_(v.sh), pass = {}, scope = {};
  if (ds && ds.getLastRow() > 1) { var dv = ds.getRange(1, 1, ds.getLastRow(), SC_V2DETAIL_HEADERS_.length).getDisplayValues(), e = dv[0].indexOf('EP-ID'), j = dv[0].indexOf('判定');
    dv.slice(1).forEach(function (x) { if (x[j] === '自動検査合格・目視未確認') pass[x[e]] = 1; }); }
  L.rows.forEach(function (r) { if (!pass[r.ep]) scope[r.ep] = 1; });
  return scope;
}
// S9: 直前の反映を取り消す（反映履歴の旧値に戻す。反映後に人が直したセルは戻さない）
function S9_直前の反映を取消() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_), id = PropertiesService.getScriptProperties().getProperty('SC_LAST_APPLY');
  if (!id || hist.getLastRow() < 2) return scLog_('S9_直前の反映を取消', { status: 'NOTHING_TO_UNDO' });
  var rows = hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().filter(function (r) { return r[1] === id && /^OK|^書込中$/.test(r[7]); });
  if (!rows.length) return scLog_('S9_直前の反映を取消', { status: 'NOTHING_TO_UNDO' });
  var t = rows[0][2] === 'COPY' ? c : scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(t.sh), byEp = {}, h = L.values[0], undone = 0, kept = 0, out = [];
  L.rows.forEach(function (r) { byEp[r.ep] = r; });
  rows.forEach(function (r) { var x = byEp[r[3]]; if (!x) return; var col = h.indexOf(r[4]) + 1, cell = t.sh.getRange(x.row, col);
    if (cell.getDisplayValue() === r[6]) { cell.setValue(r[5]); undone++; out.push([new Date().toISOString(), id + '/UNDO', r[2], r[3], r[4], r[6], r[5], 'UNDO']); } else kept++; });
  if (out.length) hist.getRange(hist.getLastRow() + 1, 1, out.length, SC_HIST_HEADERS_.length).setValues(out);
  PropertiesService.getScriptProperties().deleteProperty('SC_LAST_APPLY');
  return scLog_('S9_直前の反映を取消', { status: 'OK', undone: undone, keptBecauseEditedAfter: kept });
}

// S8: 診断（書込なし）。判定理由ごとに数件、原因の行を短く表示する（不具合の調査用）
function S8_診断() {
  var o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = o.ss.getSheetByName(SC_RESULT_), L = scLedger_(o.sh), raw = scRawMap_(), byEp = {};
  L.rows.forEach(function (r) { byEp[r.ep] = r; });
  var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; }); var cur = res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues();
  var want = (PropertiesService.getScriptProperties().getProperty('SC_DIAG') || 'OVER_DELETION,STAFF_IN_BODY').split(','), out = {};
  want.forEach(function (w) { out[w] = []; });
  cur.forEach(function (r) {
    var x = byEp[r[0]]; if (!x) return; var g = x.guids.filter(function (k) { return raw.map[k]; })[0]; if (!g) return; var text = raw.map[g];
    want.forEach(function (w) {
      if (out[w].length >= 3 || String(r[H['理由']]).indexOf(w) < 0) return;
      var d = { ep: r[0], show: r[2] };
      if (w === 'MANUAL_EDIT_PROTECTED') d.why = ['summary', 'cast', 'related'].map(function (k) { return [k, CleanerV4.explainDerived(x[k], text)]; }).filter(function (p) { return p[1]; });
      else { var c = CleanerV4.cleanV4(text), lines = QualityAudit.classifyRawLines(text), a = QualityAudit.auditPair(text, { description: c.text, cast: c.cast.map(function (q) { return [q.role, q.name, q.note].join(' '); }), related: c.related });
        d.findings = a.findings.filter(function (f) { return f.type === w; }).slice(0, 1).map(function (f) { var l = lines.filter(function (q) { return q.i === f.line; })[0], pv = lines.filter(function (q) { return q.i === f.line - 1; })[0]; return { line: f.line, expect: l && l.expect, text: l ? l.text.slice(0, 50) : '', prev: pv ? pv.text.slice(0, 40) : '' }; });
        d.secs = CleanerV4.sections(text).map(function (q) { return q.kind + ':' + String(q.head).slice(0, 14) + '(' + q.lines.length + ')'; }).join(' | ').slice(0, 160); d.out = c.text.slice(0, 60);
        if (w === 'CAST_CONTAMINATED') d.cast = c.cast.slice(0, 4).map(function (q) { return q.raw.slice(0, 60); });
        if (/RELATED/.test(w)) d.related = c.related.slice(0, 3).map(function (q) { return [q.title.slice(0, 30), q.url.slice(0, 60)]; }), d.removed = c.removed.slice(0, 6).map(function (q) { return q.reason; }); }
      out[w].push(d);
    });
  });
  return scLog_('S8_診断', out);
}

// S7: 抜き取り確認（書込なし）。自動検査合格から番組ごとに均等に n 件、原文の行分類と清掃結果（本文・出演者・関連記事の見出し＋URL）を短く並べる
function S7_抜き取り() {
  var n = 20, o = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = o.ss.getSheetByName(SC_RESULT_), L = scLedger_(o.sh), raw = scRawMap_(), byEp = {}, H = {};
  L.rows.forEach(function (r) { byEp[r.ep] = r; }); SC_HEADERS_.forEach(function (k, i) { H[k] = i; });
  var cur = res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues().filter(function (r) { return r[H['判定']] === '自動検査合格・目視未確認'; });
  var byShow = {}; cur.forEach(function (r) { (byShow[r[H['番組']]] = byShow[r[H['番組']]] || []).push(r); });
  var pick = [], shows = Object.keys(byShow).sort(), k = 0; while (pick.length < n && k < 200) { shows.forEach(function (sh) { var a = byShow[sh], r = a[Math.floor((k * 7919) % a.length)]; if (pick.length < n && r && pick.indexOf(r) < 0) pick.push(r); }); k++; }
  var out = pick.map(function (r) { var x = byEp[r[0]], g = x.guids.filter(function (q) { return raw.map[q]; })[0], text = raw.map[g] || '';
    var lines = QualityAudit.classifyRawLines(text).filter(function (l) { return l.expect !== 'DROP'; }).map(function (l) { return l.expect[0] + ':' + l.text.slice(0, 28); });
    var rel = JSON.parse(r[H['関連記事JSON(見出し+URL)']] || '[]').map(function (q) { return (q.kind || 'a')[0] + ':' + String(q.title).slice(0, 18) + '|' + String(q.url).replace(/^https?:\/\/(www\.)?/, '').slice(0, 34); });
    var cast = JSON.parse(r[H['出演者JSON']] || '[]').map(function (q) { return [q.role, q.name, q.links && q.links.length ? 'L' + q.links.length : ''].filter(Boolean).join(' '); });
    return { ep: r[0], show: r[2], raw: lines.slice(0, 12), sum: r[H['新・概要']].slice(0, 50) + '…(' + r[H['新・概要']].length + ')', cast: cast, rel: rel }; });
  return scLog_('S7_抜き取り', out);
}

// ---- S5: V2作業用の別タブへ保全（台帳34列は触らない） ----
function scChunkWrite_(sh, startRow, rows, width) {   // 大量行を500行ずつ書く（文字列として。=で始まる値も式にしない）
  for (var i = 0; i < rows.length; i += 500) { var part = rows.slice(i, i + 500), r = sh.getRange(startRow + i, 1, part.length, width); r.setNumberFormat('@'); r.setValues(part); }
}
// 清掃詳細: 清掃・結果（COPY）の行を V2作業用台帳のEPごとに保存。結果が無い・GUIDが合わない回も HOLD として残す。内容が同じ行は書かない＝再実行差分0
function scV2DetailUpsert_(ss, L, resRows, H, onlyEps, now) {
  var n = SC_V2DETAIL_HEADERS_.length, ds = scSheet_(ss, SC_V2DETAIL_, SC_V2DETAIL_HEADERS_), dv = ds.getLastRow() > 1 ? ds.getRange(2, 1, ds.getLastRow() - 1, n).getDisplayValues() : [], at = {}, byEp = {}, c = { rows: 0, changed: 0, rawMissing: 0, hold: 0, readbackMismatch: 0 };
  dv.forEach(function (r, i) { at[r[0]] = i; }); resRows.forEach(function (r) { byEp[r[H['EP-ID']]] = r; });
  L.rows.forEach(function (x) {
    if (onlyEps && !onlyEps[x.ep]) return;
    var r = byEp[x.ep], row;
    if (!r) row = [x.ep, x.guid, '', '', '', '', '', 'HOLD', 'NO_AUDIT_RESULT（清掃・結果に行なし）', '未判定'];
    else if (r[H['公式GUID']] && x.guids.indexOf(String(r[H['公式GUID']]).toLowerCase()) < 0) row = [x.ep, x.guid, '', '', '', '', r[H['清掃版']], 'HOLD', 'GUID_MISMATCH（台帳と清掃結果のGUIDが違う）', '未判定'];
    else row = [x.ep, r[H['公式GUID']] || x.guid, r[H['関連記事JSON(見出し+URL)']], r[H['出演者JSON']], r[H['SNS等保全URL']], r[H['原文SHA256']], r[H['清掃版']], r[H['判定']], r[H['理由']], r[H['原文取得']] === '公式RSS' ? '取得' : '欠損'];
    row = row.map(function (q) { return String(q == null ? '' : q); }); c.rows++;
    if (row[9] !== '取得') c.rawMissing++; if (row[7] === 'HOLD') c.hold++;
    var i = at[x.ep]; if (i != null && dv[i].slice(0, n - 1).join('\u0001') === row.join('\u0001')) return;
    row.push(now); c.changed++; if (i != null) dv[i] = row; else { at[x.ep] = dv.length; dv.push(row); }
  });
  if (c.changed) { scChunkWrite_(ds, 2, dv, n); SpreadsheetApp.flush();
    var back = ds.getRange(2, 1, dv.length, n).getDisplayValues(); back.forEach(function (b, i) { if (b.join('\u0001') !== dv[i].join('\u0001')) c.readbackMismatch++; }); }
  return c;
}
// 収蔵詳細: 公式RSSの原文を EP-ID＋GUID で保存。既にある原文は上書きしない（RSS側が変わったら原文変化履歴へ）。空欄の原文は、記録済みSHAと一致する場合だけ埋める。RSSに無い回は「原文なし（欠損）」
function scV2RawPreserve_(ss, L, raw, maxNew, now, t0) {
  var n = P25V2_DETAIL_HEADERS_.length, d = ss.getSheetByName(P25V2_DETAIL_SHEET_);
  if (!d) { d = ss.insertSheet(P25V2_DETAIL_SHEET_); d.getRange(1, 1, 1, n).setValues([P25V2_DETAIL_HEADERS_]); d.setFrozenRows(1); }
  var v = d.getRange(1, 1, Math.max(d.getLastRow(), 1), n).getDisplayValues(); p25v2SheetHeaderCheck_(v, P25V2_DETAIL_HEADERS_, P25V2_DETAIL_SHEET_);
  var at = {}; v.forEach(function (r, i) { if (i && r[0]) at[r[0]] = i; });
  var hs = scSheet_(ss, SC_RAWHIST_, SC_RAWHIST_HEADERS_), seen = {}; (hs.getLastRow() > 1 ? hs.getRange(2, 1, hs.getLastRow() - 1, 5).getDisplayValues() : []).forEach(function (r) { seen[r[1] + '|' + r[4]] = 1; });
  var add = [], fill = [], hist = [], eps = {}, c = { added: 0, addedMissing: 0, filled: 0, kept: 0, stillMissing: 0, rssChangedLogged: 0, tooLong: 0, readbackMismatch: 0, partial: false };
  L.rows.forEach(function (x) {
    if (c.partial) return;
    if (Date.now() - t0 > SC_CONFIG.timeBudgetMs - 60000) { c.partial = true; return; }
    var g = x.guids.filter(function (q) { return raw.map[q]; })[0], text = g ? String(raw.map[g]) : '', sha = text ? p25v2GasSha256_(text) : '', i = at[x.ep];
    if (text.length > SC_CELL_MAX_) { c.tooLong++; }
    if (i == null) {
      if (maxNew && add.length >= maxNew) return;
      var row = text && text.length <= SC_CELL_MAX_ ? p25v2DetailRow_(x.ep, raw.item[g], now, p25v2GasSha256_)
        : [x.ep, g || x.guid, '', now, '', sha, String(text.length), text ? '原文過大（保存不可・ハッシュのみ）' : '原文なし（欠損）', '', '', '', '', '', '', '', '', text ? '公式RSS（長さ・ハッシュのみ）' : 'なし（公式RSSに無し）'];
      if (row[4]) row[16] = '公式RSS（清掃GAS S5）'; else c.addedMissing++;
      add.push(row.map(function (q) { return String(q == null ? '' : q); })); eps[x.ep] = 1; return;
    }
    var cur = v[i];
    if (cur[4]) { if (text && sha !== cur[5] && sha.indexOf(cur[5]) !== 0) { if (!seen[x.ep + '|' + sha]) { hist.push([now, x.ep, g, cur[5], sha, String(text.length), text.length <= SC_CELL_MAX_ ? text : '']); seen[x.ep + '|' + sha] = 1; } } else c.kept++; return; }
    if (!text || text.length > SC_CELL_MAX_) { c.stillMissing++; return; }
    if (cur[5] && sha.indexOf(cur[5]) !== 0) { if (!seen[x.ep + '|' + sha]) { hist.push([now, x.ep, g, cur[5], sha, String(text.length), text]); seen[x.ep + '|' + sha] = 1; } return; }   // 記録済みハッシュと違う原文では埋めない
    fill.push({ row: i + 1, text: text, sha: sha });
  });
  if (add.length) { var s0 = d.getLastRow() + 1; scChunkWrite_(d, s0, add, n); SpreadsheetApp.flush();
    d.getRange(s0, 1, add.length, n).getDisplayValues().forEach(function (b, k) { if (b[0] !== add[k][0] || b[4] !== add[k][4] || (b[4] && p25v2GasSha256_(b[4]) !== add[k][5])) c.readbackMismatch++; }); c.added = add.length; }
  fill.forEach(function (f) { var r = d.getRange(f.row, 5, 1, 3); r.setNumberFormat('@'); r.setValues([[f.text, f.sha, String(f.text.length)]]); d.getRange(f.row, 17).setValue('公式RSS（清掃GAS S5・後日補完）'); });
  if (fill.length) { SpreadsheetApp.flush(); fill.forEach(function (f) { if (p25v2GasSha256_(d.getRange(f.row, 5).getDisplayValue()) !== f.sha) c.readbackMismatch++; }); c.filled = fill.length; }
  if (hist.length) { scChunkWrite_(hs, hs.getLastRow() + 1, hist, SC_RAWHIST_HEADERS_.length); c.rssChangedLogged = hist.length; }
  c.totalRows = d.getLastRow() - 1; c.addedEps = eps;
  return c;
}
function scV2Preserve_(fn, maxNew) {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_(fn, { status: 'LOCKED' });
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = c.ss.getSheetByName(SC_RESULT_); if (!res) return scLog_(fn, { status: 'STOP_NO_AUDIT_RESULT（先に S2）' });
    var t = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(t.sh), raw = scRawMap_();
    if (raw.errors.length) return scLog_(fn, { status: 'STOP_FEED_ERRORS', feedErrors: raw.errors });   // 一部の番組だけで保全しない
    var H = {}; SC_HEADERS_.forEach(function (k, i) { H[k] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], now = new Date().toISOString();
    var a = scV2RawPreserve_(t.ss, L, raw, maxNew, now, t0), eps = a.addedEps; delete a.addedEps;
    var b = scV2DetailUpsert_(t.ss, L, cur, H, maxNew ? eps : null, now);
    var bad = a.readbackMismatch + b.readbackMismatch;
    return scLog_(fn, { status: bad ? 'READBACK_MISMATCH' : a.partial ? 'PARTIAL_TIME（もう一度押すと続きから）' : (a.added + a.filled + a.rssChangedLogged + b.changed) ? 'OK' : 'OK_NO_CHANGE', ledgerEps: L.rows.length, raw: a, detail: b, ms: Date.now() - t0 });
  } finally { lock.releaseLock(); }
}
// S5A: まず10件だけ（収蔵詳細に原文、清掃詳細に構造化データ）→ V2作業用の2タブで確認 → S5B で全件。何度押しても差分0
function S5A_V2詳細保全_試験10件() { return scV2Preserve_('S5A_V2詳細保全_試験10件', 10); }
function S5B_V2詳細保全_全件() { return scV2Preserve_('S5B_V2詳細保全_全件', 0); }

// ===== S6: V2作業用に新しく収蔵された回の清掃（P25V2 一括収蔵の後に押す）=====
// 対象: V2作業用台帳で「概要（清掃済）・出演者・関連記事URL」がすべて空の回（＝新着）と、既にS6の結果がある回。原文はRSSを取り直さず、
//   V2・収蔵詳細に保全済みの概要原文を使う（SHA256が記録値と一致する場合だけ）。原文・EP-ID・GUIDは書かない。
// S6A（書込なし・判定を保存）→ 結果を見る → S6B（自動検査合格／人の確認OKだけ台帳3列へ）。取消は S9。
var SC_V2NEW_RESULT_ = '清掃・結果(V2新着)';
function S6A_V2新着_清掃監査() {
  var t0 = Date.now(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('S6A_V2新着_清掃監査', { status: 'LOCKED' });
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), res = scSheet_(c.ss, SC_V2NEW_RESULT_, SC_HEADERS_), v = scOpen_(SC_CONFIG.v2WorkingId, ''), L = scLedger_(v.sh);
    var H = {}; SC_HEADERS_.forEach(function (n, i) { H[n] = i; });
    var cur = res.getLastRow() > 1 ? res.getRange(2, 1, res.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues() : [], at = {}; cur.forEach(function (r, i) { at[r[0]] = i; });
    var ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_); if (!ds) throw new Error('SHEET_NOT_FOUND ' + P25V2_DETAIL_SHEET_);
    var dv = ds.getRange(1, 1, ds.getLastRow(), P25V2_DETAIL_HEADERS_.length).getDisplayValues(), dh = dv[0], D = function (n) { var i = dh.indexOf(n); if (i < 0) throw new Error('DETAIL_COLUMN_NOT_FOUND ' + n); return i; };
    var raw = {}; dv.slice(1).forEach(function (r) { raw[r[D('EP-ID')]] = { guid: String(r[D('公式GUID')]).toLowerCase(), text: r[D('概要原文')], sha: r[D('概要原文SHA256')] }; });
    var ver = scVersion_(), now = new Date().toISOString(), cnt = { target: 0, updated: 0, skipped: 0, rawMissing: 0, rawShaMismatch: 0, guidMismatch: 0 }, eps = {};
    L.rows.forEach(function (r) {
      if (!(at[r.ep] != null || (!r.summary && !r.cast && !r.related))) return;
      cnt.target++; eps[r.ep] = 1;
      var d = raw[r.ep], text = '', g = r.guid;
      if (!d || !d.text) cnt.rawMissing++;
      else if (r.guids.indexOf(d.guid) < 0) cnt.guidMismatch++;
      else if (p25v2GasSha256_(d.text) !== d.sha) cnt.rawShaMismatch++;
      else { text = d.text; g = d.guid; }
      var exSha = p25v2GasSha256_([r.summary, r.cast, r.related].join('\u0001')), rawSha = text ? p25v2GasSha256_(text) : '', k = at[r.ep], old = k != null ? cur[k] : null;
      if (old && old[H['原文SHA256']] === rawSha && old[H['清掃版']] === ver && old[H['旧値SHA']] === exSha) { cnt.skipped++; return; }
      var row = scJudgeRow_(r, text, g, rawSha, exSha, ver, now, H);
      if (!text) row[H['理由']] = 'RAW_NOT_PRESERVED（V2・収蔵詳細に検証済みの原文なし。推測で補完しない）';
      if (old) { ['人の確認', '確認メモ', '反映先', '反映日時'].forEach(function (n) { row[H[n]] = old[H[n]]; }); cur[k] = row; } else { at[r.ep] = cur.length; cur.push(row); }
      cnt.updated++;
    });
    if (cnt.updated) { var rg = res.getRange(2, 1, cur.length, SC_HEADERS_.length); rg.setNumberFormat('@'); rg.setValues(cur); }
    var det = Object.keys(eps).length ? scV2DetailUpsert_(v.ss, L, cur, H, eps, now) : { changed: 0 };   // 判定・出演者JSON・関連記事JSONを V2・清掃詳細へ（台帳3列は書かない）
    var vc = {}; cur.forEach(function (r) { if (eps[r[0]]) vc[r[H['判定']]] = (vc[r[H['判定']]] || 0) + 1; });
    return scLog_('S6A_V2新着_清掃監査', { status: 'OK', counts: cnt, verdicts: vc, writable: cur.filter(function (r) { return eps[r[0]] && r[H['書換可']]; }).length, v2DetailChanged: det.changed, v2DetailReadbackMismatch: det.readbackMismatch || 0, eps: Object.keys(eps).join(' ').slice(0, 600), version: ver, ms: Date.now() - t0 });
  } finally { lock.releaseLock(); }
}
function S6B_V2新着_反映() { return scLog_('S6B_V2新着_反映', scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用(新着)', 0, SC_V2NEW_RESULT_)); }

// ===== S10R: 非公式S10（2026-11-12 13:13Z、PR #306 外）による概要の強制書換を元に戻す =====
// 「V2・強制概要反映履歴」の状態 OK の行だけ対象。V2台帳の概要が履歴の新概要と完全一致する場合に限り旧概要へ戻す（人がその後に直した行は HOLD）。
// 書込前に COPY の清掃・反映履歴へ旧値・新値を記録 → 書込 → 読み戻し → 履歴行の状態を「取消済(S10R)」に更新。再実行は差分0。
function S10R_非公式S10の書換を取消() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return scLog_('S10R_非公式S10の書換を取消', { status: 'LOCKED' });
  try {
    var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), v = scOpen_(SC_CONFIG.v2WorkingId, ''), hs = v.ss.getSheetByName('V2・強制概要反映履歴');
    if (!hs || hs.getLastRow() < 2) return scLog_('S10R_非公式S10の書換を取消', { status: 'NO_HISTORY' });
    var hv = hs.getRange(1, 1, hs.getLastRow(), hs.getLastColumn()).getValues(), hh = hv[0].map(String), X = function (n) { var i = hh.indexOf(n); if (i < 0) throw new Error('S10_HISTORY_COLUMN_NOT_FOUND ' + n); return i; };
    var iEp = X('EP-ID'), iOld = X('旧概要'), iNew = X('新概要'), iSt = X('状態'), L = scLedger_(v.sh), byEp = {}; L.rows.forEach(function (r) { byEp[r.ep] = r; });
    var col = L.ix.summary + 1, now = new Date().toISOString(), id = now + '/S10R', todo = [], cnt = { okRows: 0, restored: 0, alreadyUndone: 0, holdChanged: 0, holdNoRow: 0, readbackMismatch: 0, untouchedNotOk: 0 }, hold = [];
    hv.slice(1).forEach(function (r, k) {
      var st = String(r[iSt]); if (st === '取消済(S10R)') { cnt.alreadyUndone++; return; } if (st !== 'OK') { cnt.untouchedNotOk++; return; }
      cnt.okRows++; var x = byEp[String(r[iEp])]; if (!x) { cnt.holdNoRow++; hold.push(r[iEp] + ':台帳に行なし'); return; }
      var cur = x.summary, nw = String(r[iNew]), od = String(r[iOld]);
      if (cur === od) { todo.push({ k: k, x: x, od: od, nw: nw, skipWrite: true }); return; }   // 既に旧値（手で戻された等）→ 状態だけ更新
      if (cur !== nw) { cnt.holdChanged++; hold.push(r[iEp] + ':S10後に変更あり'); return; }
      todo.push({ k: k, x: x, od: od, nw: nw });
    });
    var hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_), w = todo.filter(function (t) { return !t.skipWrite; });
    if (w.length) { var pr = hist.getRange(hist.getLastRow() + 1, 1, w.length, SC_HIST_HEADERS_.length); pr.setNumberFormat('@'); pr.setValues(w.map(function (t) { return [now, id, 'V2作業用(S10取消)', t.x.ep, SC_COLS_.summary, t.nw, t.od, '書込中']; })); SpreadsheetApp.flush(); }
    w.forEach(function (t) { v.sh.getRange(t.x.row, col).setValue(t.od); });
    SpreadsheetApp.flush();
    w.forEach(function (t) { if (v.sh.getRange(t.x.row, col).getDisplayValue() === t.od) cnt.restored++; else cnt.readbackMismatch++; });
    if (w.length) hist.getRange(hist.getLastRow() - w.length + 1, 8, w.length, 1).setValues(w.map(function (t) { return [v.sh.getRange(t.x.row, col).getDisplayValue() === t.od ? 'OK' : 'READBACK_MISMATCH']; }));
    if (!cnt.readbackMismatch) todo.forEach(function (t) { hs.getRange(t.k + 2, iSt + 1).setValue('取消済(S10R)'); });
    return scLog_('S10R_非公式S10の書換を取消', { status: cnt.readbackMismatch ? 'READBACK_MISMATCH' : (w.length || todo.length) ? 'OK' : 'OK_NO_CHANGE', counts: cnt, restoredEps: w.map(function (t) { return t.x.ep; }), hold: hold, applyId: id });
  } finally { lock.releaseLock(); }
}

// V2・収蔵詳細に保全済みの概要原文（EP-ID → GUID・原文）。記録済みSHA256と一致するものだけ返す（読むだけ）
function scPreservedRaw_() {
  var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(P25V2_DETAIL_SHEET_), out = {};
  if (!ds || ds.getLastRow() < 2) return out;
  var dv = ds.getRange(1, 1, ds.getLastRow(), P25V2_DETAIL_HEADERS_.length).getDisplayValues(), h = dv[0], e = h.indexOf('EP-ID'), g = h.indexOf('公式GUID'), t = h.indexOf('概要原文'), s = h.indexOf('概要原文SHA256');
  if (e < 0 || g < 0 || t < 0 || s < 0) throw new Error('DETAIL_COLUMN_NOT_FOUND');
  dv.slice(1).forEach(function (r) { if (r[t] && p25v2GasSha256_(r[t]) === r[s]) out[r[e]] = { guid: String(r[g]).toLowerCase(), text: r[t] }; });
  return out;
}

// S4B: V2作業用へ反映（V2・清掃詳細で「未合格」だった回だけ）。既に合格・反映済みの回（ロボの前回出力）は書き直さない＝既存の成果を維持。
// 対象は最初の実行時に固定し（スクリプトプロパティ SC_S4B_SCOPE）、以後の実行でも同じ範囲だけを扱う（反映で清掃詳細が更新されても範囲は広がらない）。
function S4B_V2作業用へ反映_未合格分のみ() {
  var props = PropertiesService.getScriptProperties(), scope = JSON.parse(props.getProperty('SC_S4B_SCOPE') || 'null');
  if (!scope) {
    var v = scOpen_(SC_CONFIG.v2WorkingId, ''), ds = v.ss.getSheetByName(SC_V2DETAIL_); if (!ds) throw new Error('SHEET_NOT_FOUND ' + SC_V2DETAIL_);
    var dv = ds.getRange(1, 1, ds.getLastRow(), SC_V2DETAIL_HEADERS_.length).getDisplayValues(), h = dv[0], e = h.indexOf('EP-ID'), j = h.indexOf('判定'), r = h.indexOf('原文状態');
    scope = {}; dv.slice(1).forEach(function (x) { if (x[e] && x[j] !== '自動検査合格・目視未確認' && x[r] === '取得') scope[x[e]] = 1; });
    props.setProperty('SC_S4B_SCOPE', JSON.stringify(scope));
  }
  var out = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel, 'V2作業用', 0, null, scope);
  out.scopeEpisodes = Object.keys(scope).length;
  return scLog_('S4B_V2作業用へ反映_未合格分のみ', out);
}

// S9C: 2026-11-12 13:29〜13:31Z の S3B（COPY）3回分を取消。旧規則SC4-9の出力で、新しい清掃出力を上書きしたため。現在値が新値と一致するセルだけ旧値へ（列ごとにまとめて書く）
var SC_UNDO_IDS_20261112_ = ['2026-11-12T13:29:00.209Z/COPY', '2026-11-12T13:30:15.934Z/COPY', '2026-11-12T13:31:17.946Z/COPY'];
function S9C_COPY反映の取消_20261112() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes), hist = scSheet_(c.ss, SC_HISTORY_, SC_HIST_HEADERS_);
  var hv = hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().filter(function (r) { return SC_UNDO_IDS_20261112_.indexOf(r[1]) >= 0 && /^OK/.test(r[7]); });
  var done = {}; hist.getRange(2, 1, hist.getLastRow() - 1, SC_HIST_HEADERS_.length).getDisplayValues().forEach(function (r) { if (/\/UNDO$/.test(r[1])) done[r[1].replace(/\/UNDO$/, '') + '\u0001' + r[3] + '\u0001' + r[4]] = 1; });
  var L = scLedger_(c.sh), byEp = {}, h = L.values[0], cols = {}, out = [], kept = 0, now = new Date().toISOString(); L.rows.forEach(function (r) { byEp[r.ep] = r; });
  hv.forEach(function (r) { if (done[r[1] + '\u0001' + r[3] + '\u0001' + r[4]]) return; var x = byEp[r[3]], ci = h.indexOf(r[4]); if (!x || ci < 0) { kept++; return; }
    var colv = cols[ci] = cols[ci] || L.values.map(function (row) { return [row[ci]]; });
    if (colv[x.row - 1][0] === r[6]) { colv[x.row - 1][0] = r[5]; out.push([now, r[1] + '/UNDO', r[2], r[3], r[4], r[6], r[5], 'UNDO']); } else kept++; });
  if (out.length) { var pr = hist.getRange(hist.getLastRow() + 1, 1, out.length, SC_HIST_HEADERS_.length); pr.setNumberFormat('@'); pr.setValues(out); SpreadsheetApp.flush(); }
  var chg = {}; out.forEach(function (o) { var ci = h.indexOf(o[4]); (chg[ci] = chg[ci] || []).push(byEp[o[3]].row); });
  Object.keys(chg).forEach(function (ci) { var rows = chg[ci].sort(function (a, b) { return a - b; }), i = 0;   // 変えた行だけ、連続する行をまとめて書く
    while (i < rows.length) { var j = i; while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
      c.sh.getRange(rows[i], Number(ci) + 1, j - i + 1, 1).setValues(rows.slice(i, j + 1).map(function (rw) { return [cols[ci][rw - 1][0]]; })); i = j + 1; } });
  SpreadsheetApp.flush();
  var bad = 0; Object.keys(chg).forEach(function (ci) { var b = c.sh.getRange(1, Number(ci) + 1, c.sh.getLastRow(), 1).getDisplayValues(); chg[ci].forEach(function (rw) { if (b[rw - 1][0] !== String(cols[ci][rw - 1][0])) bad++; }); });
  return scLog_('S9C_COPY反映の取消_20261112', { status: bad ? 'READBACK_MISMATCH' : out.length ? 'OK' : 'OK_NO_CHANGE', undoneCells: out.length, keptBecauseChanged: kept, readbackMismatch: bad });
}
