// 自動生成ファイル（編集しない）: node scripts/ledger-v2/build-copy-gas.mjs で再生成。元: scripts/google-apps-script/P25V2IngestAdapter.js + gas/p25v2-copy/src/P25V2CopyMain.js
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
function P25V2_INGEST_COPY(config, items, write) {
  p25v2AssertIsolated_({ hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: ScriptApp.getProjectTriggers().length });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var src = items || p25v2FetchFeeds_(config.feeds);
    var res = p25v2Ingest_(p25v2GasIo_(config), config, p25v2StripUnverified_(src.items || src), { write: write === true, maxRows: config.maxRows || 1, deadlineMs: Date.now() + 4 * 60 * 1000, sha256: p25v2GasSha256_ });
    res.feedErrors = src.errors || []; return res;
  } finally { lock.releaseLock(); }
}


// 朝リスの田 V2 収蔵ボット — 独立COPY専用 Apps Script の入口（P25V2IngestAdapter.js と1つのプロジェクトに入れる）。
// 守ること: 書き込み先は COPY だけ（保護ID・名前・実際に開いたID・シート見出しを毎回確認）。トリガーは作らない。
// 収蔵だけを行う。清掃・出演者・関連記事・6サービスURLは書かない（別工程。品質未検証の値を台帳本体に入れない）。
// 管理人が手で実行する関数は番号付きの5つ: P25V2_1_CHECK → P25V2_2_DRYRUN → P25V2_3_WRITE_ONE → P25V2_4_VERIFY →（必要時）P25V2_5_BACKFILL_RAW。

var P25V2_COPY_CONFIG = {
  environment: 'COPY',
  targetSpreadsheetId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',   // 【COPY試験】V2収蔵ボット P25V2 1件試験 2026-11-11（本番ではない）
  expectedTargetId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',     // 二重申告。上と違えば停止
  expectedNameIncludes: '【COPY試験】',
  sheetName: 'V2・統合台帳',
  scope: 'V2_INGEST_APPEND_ONLY',
  maxRowsCap: 1,            // 1回の追記上限（絶対上限10。引き上げは別承認）
  reservedMaxEpNo: 6720,    // 本番・削除済みを含めた既知の最大番号（これ以下は採番しない）
  feedLimit: 30,            // 1フィードあたり新しい順に見る件数（取りこぼし再探索は P25V2_6_RESCAN_READONLY）
  feeds: [
    { show: 'ニュースの現場から', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/684015f9-2396-4ac4-bc1f-ac0f0033d08c/podcast.rss' },
    { show: 'MEDIA TALK', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/07a1de49-67cf-4714-8581-ac1000059302/podcast.rss' },
    { show: 'こどもそうだんしつ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/693cfdd6-f5a9-4308-9025-adb10164b5b1/podcast.rss' },
    { show: 'スポンジ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/8ceab8ef-af5f-44e9-9545-b4ab0024434b/podcast.rss' },
    { show: 'ニュースの学校', url: 'https://feeds.megaphone.fm/TASC5851398719' },
    { show: 'ドーナツ', url: 'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/c373aac9-fb6a-4172-8a8f-b498003d9389/podcast.rss' },
    { show: '報談', url: 'https://feeds.megaphone.fm/TASC9421488254' }
  ]
};
var P25V2_LOG_SHEET_ = 'V2・実行ログ';
var P25V2_FETCH_BUDGET_MS_ = 120000;   // 全件取得がこれを超えたら書込系は止める（GASの1回6分の上限に余裕を残す）。超えたら番組ごとの分割実行に切り替える
var P25V2_RUN_BUDGET_MS_ = 240000;     // 書込開始の締切（実行開始から4分）
var P25V2_LOG_HEADERS_ = ['実行日時', '関数', 'モード', '状態', '追加件数', '候補', 'HOLD', 'BLOCK', '既収蔵', '取得エラー', '追加EP-ID', '備考'];

function p25v2Cfg_(over) { var c = JSON.parse(JSON.stringify(P25V2_COPY_CONFIG)); Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; }); c.feeds = c.feeds.map(function (f) { return { show: f.show, url: f.url, limit: f.limit || c.feedLimit }; }); return c; }
function p25v2Env_() { return { hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: ScriptApp.getProjectTriggers().length }; }
// 開く前・開いた後の両方で対象を確認する（書込なし）
function p25v2OpenChecked_(cfg, forWrite) {
  p25v2AssertIsolated_(p25v2Env_());
  var v2ok = cfg.environment === 'V2_WORKING' && cfg.targetSpreadsheetId === P25V2_V2_WORKING_ID_;   // V2作業用だけは承認付き設定で開ける（他の保護IDは常に拒否）
  if (P25V2_PROTECTED_IDS_.indexOf(cfg.targetSpreadsheetId) >= 0 && !v2ok) throw new Error('PROTECTED_TARGET_REFUSED');
  var ss = SpreadsheetApp.openById(cfg.targetSpreadsheetId), sh = ss.getSheetByName(cfg.sheetName);
  var actual = { id: ss.getId(), name: ss.getName(), sheetName: sh ? sh.getName() : '' };
  p25v2AssertCopyTarget_(cfg, actual, forWrite);
  if (cfg.expectedNameIncludes && actual.name.indexOf(cfg.expectedNameIncludes) < 0) throw new Error('TARGET_NAME_NOT_EXPECTED');
  return { ss: ss, sh: sh, actual: actual };
}
function p25v2Log_(ss, fn, res, note) {
  try {
    var lg = ss.getSheetByName(P25V2_LOG_SHEET_);
    if (!lg) { lg = ss.insertSheet(P25V2_LOG_SHEET_); lg.getRange(1, 1, 1, P25V2_LOG_HEADERS_.length).setValues([P25V2_LOG_HEADERS_]); }
    var c = (res && res.counts) || {};
    lg.appendRow([new Date().toISOString(), fn, (res && res.mode) || '', (res && res.status) || '', (res && res.added) || 0, c.CANDIDATE || 0, c.HOLD || 0, c.BLOCK || 0, c.ALREADY_INGESTED || 0,
      ((res && res.feedErrors) || []).map(function (e) { return e.show + ':' + e.error; }).join(' / '), ((res && res.addedEpIds) || []).join(','), String(note || '').slice(0, 300)]);   // 本文は書かない
  } catch (e) { Logger.log('LOG_WRITE_FAILED ' + e.message); }
}
function p25v2Report_(fn, obj) { Logger.log(fn + ' ' + JSON.stringify(obj, null, 1)); return obj; }

// 1) 事前点検（書込なし）: 隔離・トリガー0・保護ID拒否・COPY名・3シートの見出し・RSS7本の取得
function P25V2_1_CHECK() {
  var cfg = p25v2Cfg_(), o = p25v2OpenChecked_(cfg, false), out = { target: o.actual, triggers: 0, sheets: {}, feeds: [] };
  out.sheets[P25V2_SHEET_] = p25v2Schema_(o.sh.getRange(1, 1, 1, o.sh.getLastColumn()).getDisplayValues()[0]).width;
  [[P25V2_NUM_SHEET_, P25V2_NUM_HEADERS_], [P25V2_DETAIL_SHEET_, P25V2_DETAIL_HEADERS_]].forEach(function (p) {
    var x = o.ss.getSheetByName(p[0]); if (!x) throw new Error('SHEET_NOT_FOUND ' + p[0]);
    if (x.getMaxColumns() < p[1].length) throw new Error('SHEET_TOO_NARROW ' + p[0] + ' 必要列数=' + p[1].length);
    p25v2SheetHeaderCheck_(x.getRange(1, 1, 1, p[1].length).getDisplayValues(), p[1], p[0]); out.sheets[p[0]] = p[1].length;
  });
  var t0 = Date.now(), f = p25v2FetchFeeds_(cfg.feeds.map(function (x) { return { show: x.show, url: x.url, limit: 0 }; }));   // 全件取得の時間・サイズを実測（後日補完と同じ条件）
  cfg.feeds.forEach(function (fd) { var st = (f.stats || []).filter(function (x) { return x.show === fd.show; })[0] || {};
    out.feeds.push({ show: fd.show, items: f.items.filter(function (i) { return i.show === fd.show; }).length, rawPresent: f.items.filter(function (i) { return i.show === fd.show && i.descriptionRaw; }).length, ms: st.ms, chars: st.chars }); });
  out.fetchAllMs = Date.now() - t0; out.publicCount = p25v2PublicCount_(p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows);
  out.feedErrors = f.errors; out.status = f.errors.length ? 'CHECK_WITH_FEED_ERRORS' : (out.fetchAllMs > P25V2_FETCH_BUDGET_MS_ ? 'CHECK_FETCH_TOO_SLOW' : 'CHECK_OK');
  out.next = out.status !== 'CHECK_OK' ? '書込に進まない（表示をそのまま報告）' : '次は P25V2_2_DRYRUN';
  return p25v2Report_('P25V2_1_CHECK', out);
}
// 2) 予行（書込なし）: 判定の内訳と、全候補の予定採番
function P25V2_2_DRYRUN() {
  var cfg = p25v2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds);
  var res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, planAll: true, sha256: p25v2GasSha256_ });
  res.feedErrors = src.errors; res.decisions = res.decisions.filter(function (d) { return d.decision !== 'ALREADY_INGESTED'; });
  res.next = src.errors.length ? '書込に進まない（取得エラー）' : res.counts.CANDIDATE > 0 ? '次は P25V2_3_WRITE_ONE → P25V2_4_VERIFY' : '新着なし: WRITE_ONE は実行しない。次は P25V2_5_BACKFILL_RAW（原文の後日補完）→ もう一度 P25V2_5_BACKFILL_RAW（差分0の確認）';
  return p25v2Report_('P25V2_2_DRYRUN', res);
}
// 3) COPYへ1件だけ実書込（古い候補から1件）。採番→追記→読み戻し→収蔵詳細（原文）→登録完了。結果はスクリプトのプロパティに保存
function P25V2_3_WRITE_ONE() {
  var cfg = p25v2Cfg_({ write: true, maxRows: 1 }), o = p25v2OpenChecked_(cfg, true), res, src = p25v2FetchFeeds_(cfg.feeds);
  if (src.errors.length) { res = { mode: 'COPY_WRITE', status: 'STOP_FEED_ERRORS', added: 0, feedErrors: src.errors }; p25v2Log_(o.ss, 'P25V2_3_WRITE_ONE', res, '取得エラーのため書込なし'); return p25v2Report_('P25V2_3_WRITE_ONE', res); }
  try { res = P25V2_INGEST_COPY(cfg, src, true); }
  catch (e) { res = e.result || { mode: 'COPY_WRITE', status: 'ERROR' }; res.status = 'ERROR'; res.error = String(e.message || e); }
  p25v2Log_(o.ss, 'P25V2_3_WRITE_ONE', res, res.error || '');
  if (res.added > 0) PropertiesService.getScriptProperties().setProperty('P25V2_LAST_WRITE', JSON.stringify({ at: new Date().toISOString(), addedEpIds: res.addedEpIds || [], guids: (res.plan || []).map(function (p) { return p.guid; }), status: res.status }));
  return p25v2Report_('P25V2_3_WRITE_ONE', res);
}
// 4) 読み戻し検証（書込なし）: 直前の追加分が 台帳(GUID一致)・採番(登録完了)・収蔵詳細(原文SHA256一致) に揃い、再実行では「既収蔵」になること
function P25V2_4_VERIFY() { return p25v2Verify_(p25v2Cfg_(), 'P25V2_LAST_WRITE', 'P25V2_4_VERIFY'); }
function p25v2Verify_(cfg, propKey, fn) {
  var o = p25v2OpenChecked_(cfg, false), last = JSON.parse(PropertiesService.getScriptProperties().getProperty(propKey) || '{}');
  if (!(last.addedEpIds || []).length) return p25v2Report_(fn, { status: 'NO_WRITE_TO_VERIFY', note: '書込で1件以上追加した後に実行する' });
  var io = p25v2GasIo_(cfg); io.open();
  var recs = p25v2Records_(io.readAll()), num = p25v2Numbering_(io.readNumbering()), det = io.readDetails(), dh = det[0];
  var checks = (last.addedEpIds || []).map(function (ep, i) {
    var row = recs.rows.filter(function (r) { return r.epId === ep; }), n = num.filter(function (x) { return x.epId === ep; })[0];
    var d = det.filter(function (r) { return r[0] === ep; })[0], raw = d ? String(d[dh.indexOf('概要原文')]) : '', g = (last.guids || [])[i] || '';
    return { epId: ep, ledgerRows: row.length, guidOk: row.length === 1 && p25v2Guids_(row[0]).indexOf(g) >= 0, numbering: n ? n.state : 'なし', numberingGuidOk: !!n && n.guid === g, detailRow: !!d, rawLen: raw.length, rawShaOk: !!raw && p25v2GasSha256_(raw) === String(d[dh.indexOf('概要原文SHA256')]) };
  });
  var dupIds = {}, dups = []; recs.rows.forEach(function (r) { if (dupIds[r.epId]) dups.push(r.epId); dupIds[r.epId] = 1; });
  var pending = num.filter(function (x) { return x.state === '採番済'; }).map(function (x) { return x.epId; });
  var src = p25v2FetchFeeds_(cfg.feeds), again = p25v2Ingest_(io, cfg, p25v2StripUnverified_(src.items), { write: false, sha256: p25v2GasSha256_ });
  var lastGuids = last.guids || [], rerunAlready = again.decisions.filter(function (x) { return lastGuids.indexOf(x.guid) >= 0; }).every(function (x) { return x.decision === 'ALREADY_INGESTED'; });
  var ok = checks.length > 0 && checks.every(function (c) { return c.ledgerRows === 1 && c.guidOk && c.numbering === '登録完了' && c.numberingGuidOk && c.detailRow && c.rawShaOk; }) && !pending.length && !dups.length && rerunAlready;
  var out = { status: ok ? 'VERIFY_OK' : 'VERIFY_NG', last: last, checks: checks, numberingPending: pending, duplicateEpIds: dups, rerunAlreadyIngested: rerunAlready, nextCandidates: again.counts.CANDIDATE };
  p25v2Log_(o.ss, fn, { mode: 'READ_ONLY', status: out.status, counts: again.counts }, JSON.stringify(checks.map(function (c) { return c.epId + ':' + (c.guidOk && c.rawShaOk && c.numbering === '登録完了' ? 'OK' : 'NG'); })).slice(0, 300));
  return p25v2Report_(fn, out);
}
// 5) 原文の後日補完: 収蔵詳細で原文が空・ハッシュだけある行を、公式RSSの原文で埋める（GUID一致・SHA前方一致・文字数一致・空欄だけ）。1回10件まで
function P25V2_5_BACKFILL_RAW() {
  var t0 = Date.now(), cfg = p25v2Cfg_({ write: true }), o = p25v2OpenChecked_(cfg, true), lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return p25v2Report_('P25V2_5_BACKFILL_RAW', { status: 'LOCKED' });
  try {
    var det = o.ss.getSheetByName(P25V2_DETAIL_SHEET_), W = P25V2_DETAIL_HEADERS_.length;
    var readDet = function () { return det.getRange(1, 1, det.getLastRow(), W).getDisplayValues(); };
    var pub = function () { return p25v2PublicCount_(p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows); };
    var vals = readDet(); p25v2SheetHeaderCheck_(vals, P25V2_DETAIL_HEADERS_, P25V2_DETAIL_SHEET_);
    var ledger = p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows, guidOf = {};
    ledger.forEach(function (r) { guidOf[r.epId] = (p25v2Guids_(r)[0] || '').toLowerCase(); });
    var publicBefore = p25v2PublicCount_(ledger);
    var src = p25v2FetchFeeds_(cfg.feeds.map(function (f) { return { show: f.show, url: f.url, limit: 0 }; })), byGuid = {};   // 古い回も探すので全件
    var base = { mode: 'COPY_WRITE', fetchMs: Date.now() - t0, fetchStats: src.stats, feedErrors: src.errors, filled: [], hold: [] };
    if (src.errors.length) { base.status = 'STOP_FEED_ERRORS'; p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', base, '取得エラーのため書込なし'); return p25v2Report_('P25V2_5_BACKFILL_RAW', base); }
    if (Date.now() - t0 > P25V2_RUN_BUDGET_MS_) { base.status = 'STOP_TIME_BUDGET'; p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', base, '時間切れのため書込なし（分割実行に切替）'); return p25v2Report_('P25V2_5_BACKFILL_RAW', base); }
    src.items.forEach(function (i) { if (i.guid && i.descriptionRaw) byGuid[i.guid] = i.descriptionRaw; });
    var plan = p25v2PlanRawBackfill_(vals, byGuid, p25v2GasSha256_, new Date().toISOString()), writes = [], hold = base.hold, done = base.filled;
    plan.forEach(function (p) {
      if (p.hold) { hold.push({ epId: p.epId, why: p.hold }); return; }
      if (guidOf[p.epId] !== String(vals[p.row - 1][1]).toLowerCase()) { hold.push({ epId: p.epId, why: 'LEDGER_GUID_MISMATCH' }); return; }   // EP-ID と GUID が台帳と一致する行だけ
      if (writes.length < P25V2_HARD_CAP_) writes.push(p);
    });
    var touched = {};
    writes.forEach(function (p) {
      if (det.getRange(p.row, 5).getDisplayValue()) { hold.push({ epId: p.epId, why: 'RAW_ALREADY_PRESENT' }); return; }   // 書込直前に再確認
      det.getRange(p.row, 4, 1, 5).setValues([[p.at, p.raw, p.sha, String(p.raw.length), '未清掃']]); det.getRange(p.row, 17).setValue('公式RSS直接（GAS後日補完）');
      [4, 5, 6, 7, 8, 17].forEach(function (c) { touched[p.row + ':' + c] = 1; }); SpreadsheetApp.flush();
      var back = String(det.getRange(p.row, 5).getValue());
      if (p25v2GasSha256_(back) !== p.sha || back.length !== p.raw.length) hold.push({ epId: p.epId, why: 'READBACK_MISMATCH' }); else done.push(p.epId);
    });
    // 他のセルが変わっていないこと（収蔵詳細17列の全セル比較）と、公開数が変わっていないこと
    var after = readDet(), changed = 0;
    for (var r = 0; r < Math.max(vals.length, after.length); r++) for (var c = 0; c < W; c++) if (!touched[(r + 1) + ':' + (c + 1)] && String((vals[r] || [])[c] || '') !== String((after[r] || [])[c] || '')) changed++;
    var publicAfter = pub();
    base.otherCellsChanged = changed; base.publicBefore = publicBefore; base.publicAfter = publicAfter; base.remainingAfter = plan.filter(function (p) { return !p.hold; }).length - done.length;
    base.status = hold.some(function (h) { return h.why === 'READBACK_MISMATCH'; }) ? 'READBACK_MISMATCH' : changed ? 'OTHER_CELLS_CHANGED' : publicAfter !== publicBefore ? 'PUBLIC_COUNT_CHANGED' : done.length ? 'OK' : 'OK_NO_CHANGE';
    base.totalMs = Date.now() - t0;
    p25v2Log_(o.ss, 'P25V2_5_BACKFILL_RAW', { mode: base.mode, status: base.status, added: done.length, feedErrors: src.errors, addedEpIds: done }, JSON.stringify({ hold: hold, other: changed, pub: [publicBefore, publicAfter], ms: base.totalMs }).slice(0, 300));
    return p25v2Report_('P25V2_5_BACKFILL_RAW', base);
  } finally { lock.releaseLock(); }
}
// 原文補完の計画（純関数・試験対象）。rows は収蔵詳細の表示値（見出し込み）
function p25v2PlanRawBackfill_(vals, byGuid, sha256, at) {
  var h = vals[0], I = function (n) { return h.indexOf(n); }, out = [];
  vals.slice(1).forEach(function (r, i) {
    var ep = String(r[I('EP-ID')] || ''), g = String(r[I('公式GUID')] || '').toLowerCase(), have = String(r[I('概要原文')] || '');
    if (!ep || have || !byGuid[g]) return;
    var raw = byGuid[g], sha = sha256(raw), rec = String(r[I('概要原文SHA256')] || ''), len = String(r[I('概要原文文字数')] || '');
    if (!rec) { out.push({ row: i + 2, epId: ep, hold: 'NO_RECORDED_HASH' }); return; }
    if (sha.indexOf(rec) !== 0) { out.push({ row: i + 2, epId: ep, hold: 'SHA_MISMATCH' }); return; }   // 収蔵後に公式側の文面が変わった→上書きせず人が判断
    if (len && Number(len) !== raw.length) { out.push({ row: i + 2, epId: ep, hold: 'LENGTH_MISMATCH' }); return; }
    out.push({ row: i + 2, epId: ep, raw: raw, sha: sha, at: at });
  });
  return out;
}
// 6) 取りこぼし再探索（書込なし）: 各フィードの全件を見て、未収蔵の候補を一覧する。古い回は台帳側にGUIDが無いことがあるため、ここでは書かない
function P25V2_6_RESCAN_READONLY() {
  var cfg = p25v2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds.map(function (f) { return { show: f.show, url: f.url, limit: 0 }; }));
  var res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, sha256: p25v2GasSha256_ });
  return p25v2Report_('P25V2_6_RESCAN_READONLY', { counts: res.counts, feedErrors: src.errors, notIngested: res.decisions.filter(function (d) { return d.decision !== 'ALREADY_INGESTED'; }) });
}

// ===== V2作業用台帳への新着一括収蔵（PR #306）=====
// 既存の収蔵処理（P25V2_INGEST_COPY・検証）をそのまま使い、書き込み先だけ V2作業用に切り替える。トリガーは作らない。
// 採番衝突の防止: 実行のたびに V2作業用の「V2・統合台帳」「固定ID採番履歴」「削除・除外履歴」「エピソード台帳」と、COPY試験の台帳・採番履歴から
//   使用済みの最大番号を読み、それより大きい番号だけを新規に振る。COPY試験で同じGUIDに振った番号は、V2作業用で未使用ならそのまま使う（GUIDと番号を揃える）。
// 押す順: P25V2_V2_1_CHECK → P25V2_V2_2_DRYRUN → P25V2_V2_3_WRITE_BATCH（1回最大10件・古い順）→ P25V2_V2_4_VERIFY。候補が残れば 3→4 を繰り返す。

var P25V2_V2_CONFIG = {
  environment: 'V2_WORKING',
  targetSpreadsheetId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',
  expectedTargetId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',
  expectedNameIncludes: '基本台帳 V2 作業用',
  v2WorkingApproved: true,   // 2026-11-12 司令塔指示「PR #306のV2新着一括収蔵を実装…実機検証」で承認。false にすると書込は止まる
  sheetName: 'V2・統合台帳',
  scope: 'V2_INGEST_APPEND_ONLY',
  maxRowsCap: 10,
  reservationSources: ['固定ID採番履歴', '削除・除外履歴', 'エピソード台帳']
};
function p25v2V2Cfg_(over) {
  var c = p25v2Cfg_({}), v = JSON.parse(JSON.stringify(P25V2_V2_CONFIG));
  Object.keys(v).forEach(function (k) { c[k] = v[k]; }); Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; });
  var r = p25v2V2Reservation_(c); c.reservedMaxEpNo = r.max; c.guidReserve = r.guidReserve; c.reservation = r.summary;
  return c;
}
// 使用済み番号の最大値と、COPY試験の GUID→番号 対応（V2作業用で別GUIDに使われていない番号だけ）
function p25v2V2Reservation_(c) {
  var num = function (s) { var m = String(s || '').match(/^EP-(\d{5})$/); return m ? +m[1] : 0; }, max = 0, used = {}, summary = {};
  var take = function (label, ids) { var m = 0; ids.forEach(function (id) { var n = num(id); if (n) { used[id] = true; m = Math.max(m, n); } }); summary[label] = m; max = Math.max(max, m); };
  var v2 = SpreadsheetApp.openById(c.targetSpreadsheetId), col = function (ss, sheet, header) {
    var sh = ss.getSheetByName(sheet); if (!sh || sh.getLastRow() < 2) return [];
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], i = h.indexOf(header); if (i < 0) throw new Error('RESERVATION_COLUMN_NOT_FOUND ' + sheet + ':' + header);
    return sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0]; });
  };
  take('V2・統合台帳', col(v2, 'V2・統合台帳', 'EP-ID'));
  take('固定ID採番履歴', col(v2, '固定ID採番履歴', '固定ID'));
  take('削除・除外履歴', col(v2, '削除・除外履歴', '固定ID'));
  take('エピソード台帳', col(v2, 'エピソード台帳', '台帳ID'));
  var copy = SpreadsheetApp.openById(P25V2_COPY_CONFIG.targetSpreadsheetId);
  var cIds = col(copy, '固定ID採番履歴', '固定ID'), cGuids = col(copy, '固定ID採番履歴', 'GUID'), cState = col(copy, '固定ID採番履歴', '状態');
  var copyMax = 0; cIds.concat(col(copy, 'V2・統合台帳', 'EP-ID')).forEach(function (id) { copyMax = Math.max(copyMax, num(id)); });
  summary['COPY試験'] = copyMax; max = Math.max(max, copyMax);
  var guidReserve = {}; cIds.forEach(function (id, i) { if (cState[i] === '登録完了' && num(id) && !used[id]) guidReserve[String(cGuids[i]).toLowerCase()] = id; });
  summary.max = max; summary.copyReservable = Object.keys(guidReserve).length;
  return { max: max, guidReserve: guidReserve, summary: summary };
}
// 1) 点検（書込なし）
function P25V2_V2_1_CHECK() {
  var cfg = p25v2V2Cfg_(), o = p25v2OpenChecked_(cfg, false), out = { target: o.actual, triggers: 0, reservation: cfg.reservation };
  out.sheets = {}; out.sheets[P25V2_SHEET_] = p25v2Schema_(o.sh.getRange(1, 1, 1, o.sh.getLastColumn()).getDisplayValues()[0]).width;
  [[P25V2_NUM_SHEET_, P25V2_NUM_HEADERS_], [P25V2_DETAIL_SHEET_, P25V2_DETAIL_HEADERS_]].forEach(function (p) {
    var x = o.ss.getSheetByName(p[0]); if (!x) throw new Error('SHEET_NOT_FOUND ' + p[0]);
    p25v2SheetHeaderCheck_(x.getRange(1, 1, 1, p[1].length).getDisplayValues(), p[1], p[0]); out.sheets[p[0]] = p[1].length; });
  var f = p25v2FetchFeeds_(cfg.feeds); out.rssItems = f.items.length; out.feedErrors = f.errors;
  out.publicCount = p25v2PublicCount_(p25v2Records_(o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues()).rows);
  out.status = f.errors.length ? 'CHECK_WITH_FEED_ERRORS' : 'CHECK_OK';
  return p25v2Report_('P25V2_V2_1_CHECK', out);
}
// 2) 予行（書込なし）: 全候補と予定番号
function P25V2_V2_2_DRYRUN() {
  var cfg = p25v2V2Cfg_(); p25v2OpenChecked_(cfg, false);
  var src = p25v2FetchFeeds_(cfg.feeds), res = p25v2Ingest_(p25v2GasIo_(cfg), cfg, p25v2StripUnverified_(src.items), { write: false, planAll: true, sha256: p25v2GasSha256_ });
  return p25v2Report_('P25V2_V2_2_DRYRUN', { status: src.errors.length ? 'STOP_FEED_ERRORS' : 'OK', counts: res.counts, reservation: cfg.reservation, feedErrors: src.errors,
    plan: res.plan.map(function (p) { return [p.epId, p.show, p.date, p.guid, p.fromReserve ? 'COPYと同番号' : '新番号']; }),
    hold: res.decisions.filter(function (d) { return d.decision === 'HOLD' || d.decision === 'BLOCK'; }) });
}
// 3) V2作業用へ書込（1回最大10件・古い順）。採番→追記→読み戻し→収蔵詳細（原文）→登録完了
function P25V2_V2_3_WRITE_BATCH() {
  var cfg = p25v2V2Cfg_({ write: true, maxRows: 10 }), o = p25v2OpenChecked_(cfg, true), src = p25v2FetchFeeds_(cfg.feeds), res;
  if (src.errors.length) { res = { mode: 'V2_WRITE', status: 'STOP_FEED_ERRORS', added: 0, feedErrors: src.errors }; p25v2Log_(o.ss, 'P25V2_V2_3_WRITE_BATCH', res, '取得エラーのため書込なし'); return p25v2Report_('P25V2_V2_3_WRITE_BATCH', res); }
  try { res = P25V2_INGEST_COPY(cfg, src, true); }
  catch (e) { res = e.result || { mode: 'V2_WRITE', status: 'ERROR' }; res.status = 'ERROR'; res.error = String(e.message || e); }
  p25v2Log_(o.ss, 'P25V2_V2_3_WRITE_BATCH', res, (res.error || '') + ' 予約最大=' + cfg.reservedMaxEpNo);
  if (res.added > 0) PropertiesService.getScriptProperties().setProperty('P25V2_V2_LAST_WRITE', JSON.stringify({ at: new Date().toISOString(), addedEpIds: res.addedEpIds || [], guids: (res.plan || []).map(function (p) { return p.guid; }), status: res.status }));
  return p25v2Report_('P25V2_V2_3_WRITE_BATCH', { status: res.status, error: res.error, added: res.added, addedEpIds: res.addedEpIds, counts: res.counts, publicBefore: res.publicBefore, publicAfter: res.publicAfter, reservation: cfg.reservation,
    plan: (res.plan || []).map(function (p) { return [p.epId, p.show, p.guid, p.fromReserve ? 'COPYと同番号' : '新番号']; }) });
}
// 4) 読み戻し検証（書込なし）: 台帳1行・GUID一致・採番履歴（GUID一致・登録完了）・原文SHA256・EP-IDの重複なし・再実行で既収蔵
function P25V2_V2_4_VERIFY() { return p25v2Verify_(p25v2V2Cfg_(), 'P25V2_V2_LAST_WRITE', 'P25V2_V2_4_VERIFY'); }
