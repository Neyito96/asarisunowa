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
// global（p25v2GlobalReservation_ の結果）: 旧本番・V2作業用・COPY のすべての「番号→GUID」。別のGUIDが使っている番号は、どの台帳のものでも振らない
function p25v2Allocate_(ledgerRows, numbering, guid, reservedMax, guidReserve, global) {
  var g = p25v2T_(guid).toLowerCase(), prior = numbering.filter(function (n) { return n.guid === g; });
  if (prior.length > 1) throw new Error('NUMBERING_GUID_DUPLICATE');
  var used = {}; ledgerRows.forEach(function (r) { if (r.epId) used[r.epId] = r; });
  global = global || { used: {}, v1ByGuid: {}, max: 0 };
  var otherGuid = function (id) { var u = global.used[id]; return u !== undefined && u.slice(1, -1).split('|').some(function (x) { return x !== g; }); };   // その番号を自分以外のGUID（不明を含む）が使っている
  if (prior.length === 1) {
    var u = used[prior[0].epId];
    if (u && p25v2Guids_(u).indexOf(g) < 0) throw new Error('NUMBERING_ID_COLLISION ' + prior[0].epId);
    return { epId: prior[0].epId, reused: true, numberingRow: prior[0].row };
  }
  var taken = function (id) { return !!used[id] || numbering.some(function (n) { return n.epId === id; }) || otherGuid(id); };
  var ids = ledgerRows.map(function (r) { return { epId: r.epId }; }).concat(numbering);
  var rsv = guidReserve && guidReserve[g];   // 別台帳（COPY試験など）で同じGUIDに振った番号があれば、どこでも未使用なら同じ番号を使う
  if (rsv && !taken(rsv)) return { epId: rsv, reused: false, fromReserve: true };
  var v1 = global.v1ByGuid && global.v1ByGuid[g];   // 旧本番に同じGUIDの回があり、その番号がどこでも空いていれば揃える
  if (v1 && !taken(v1)) return { epId: v1, reused: false, fromV1: true };
  var next = p25v2NextEpId_(ids, Math.max(Number(reservedMax || 0), Number(global.max || 0)));
  if (numbering.some(function (n) { return n.epId === next; })) throw new Error('NUMBERING_ID_COLLISION ' + next);
  for (var k = 0; taken(next); k++) { if (k > 1000) throw new Error('NUMBERING_NO_FREE_ID'); next = 'EP-' + ('0000' + (+next.slice(3) + 1)).slice(-5); }
  return { epId: next, reused: false };
}
function p25v2NextEpId_(rows, reservedMax) {
  var max = Number(reservedMax || 0);
  rows.forEach(function (r) { var m = r.epId.match(/^EP-(\d{5})$/); if (m) max = Math.max(max, +m[1]); });
  return 'EP-' + ('0000' + (max + 1)).slice(-5);
}
function p25v2BuildRow_(schema, item, epId, originId) {
  var row = []; for (var i = 0; i < schema.width; i++) row.push('');
  row[schema.idx['EP-ID']] = epId; row[schema.idx['代表EP-ID']] = epId; row[schema.idx['掲載判定']] = '未判定';
  Object.keys(P25V2_ITEM_MAP_).forEach(function (k) { if (item[k] !== undefined) row[schema.idx[P25V2_ITEM_MAP_[k]]] = p25v2T_(item[k]); });
  P25V2_LINKS_.forEach(function (n) { if (item.links && item.links[n]) row[schema.idx[n]] = p25v2T_(item.links[n]); });
  row[schema.idx['判定根拠']] = 'P25V2収蔵: 公式GUID新規・未審査（公開は人の判定後）';
  if (originId && originId !== epId && schema.idx['元EP-ID'] !== undefined) row[schema.idx['元EP-ID']] = originId;   // 旧本番で同じGUIDに振られていた番号（読み替え用）
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
    var al = numbering ? p25v2Allocate_(simRows, simNum, g, reserved, config.guidReserve, config.global) : { epId: p25v2NextEpId_(simRows, reserved), reused: false };
    if (!al.reused) simNum.push({ row: 0, guid: g, epId: al.epId, state: '採番済' });
    simRows.push({ epId: al.epId, show: d.item.show, title: d.item.title, guid: g, jsonUuid: '', officialUrl: '' });
    al.origin = (config.global && config.global.v1ByGuid && config.global.v1ByGuid[g]) || '';
    res.plan.push({ epId: al.epId, reused: !!al.reused, fromReserve: !!al.fromReserve, fromV1: !!al.fromV1, originV1: al.origin, guid: g, show: p25v2T_(d.item.show), date: p25v2T_(d.item.date) });
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
  var rows = todo.map(function (d, i) { return p25v2BuildRow_(recs.schema, d.item, allocs[i].epId, allocs[i].origin); });
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
  var items = [], errors = [], stats = [], empty = [];
  (feeds || []).forEach(function (f) {
    var last = '', t0 = Date.now(), bytes = 0, before = items.length;
    for (var attempt = 0; attempt < 2; attempt++) {   // 一時障害（5xx・通信例外）は1回だけ再試行。4xxは再試行しない
      try { var r = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true }), code = r.getResponseCode();
        if (code !== 200) { last = 'FEED_HTTP_' + code; if (code >= 500 && attempt === 0) { p25v2Sleep_(2000); continue; } break; }
        var body = r.getContentText(); bytes = body.length; var got = p25v2ParseRss_(body, f.url, f.show, f.limit == null ? 30 : (f.limit > 0 ? f.limit : undefined));
        if (!got.length) empty.push(f.show);   // 公式フィードは常に過去回を含む。0件は「新着0」ではなく異常の印（日次 D1 はこれで止まる）
        items = items.concat(got); last = ''; break; }
      catch (e) { last = String(e.message || e); if (/UNVERIFIED_FEED_HOST|FEED_INVALID/.test(last) || attempt > 0) break; p25v2Sleep_(2000); }
    }
    if (last) errors.push({ show: f.show, error: last });
    stats.push({ show: f.show, ms: Date.now() - t0, chars: bytes, items: items.length - before });   // 実行時間・サイズの実測（本文は含めない）
  });
  return { items: items, errors: errors, stats: stats, empty: empty };
}
// 承認ボタンの後に設置する日次の時間主導トリガー（各プロジェクト1本）だけは隔離チェックの対象外。それ以外のトリガーが1本でもあれば停止
var P25V2_ALLOWED_TRIGGER_HANDLERS_ = ['P25V2_D1_日次実行', 'D2_清掃と人物_日次'];
function p25v2ForeignTriggers_() { return ScriptApp.getProjectTriggers().filter(function (t) { return P25V2_ALLOWED_TRIGGER_HANDLERS_.indexOf(t.getHandlerFunction()) < 0 || String(t.getEventType()) !== 'CLOCK'; }).length; }
// 手動実行（COPY専用プロジェクト）。同時実行はスクリプトロックで1本に限定。
function P25V2_INGEST_COPY(config, items, write) {
  p25v2AssertIsolated_({ hasDoGet: typeof doGet === 'function', hasDoPost: typeof doPost === 'function', triggerCount: p25v2ForeignTriggers_() });
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

function p25v2Cfg_(over) {
  var c = JSON.parse(JSON.stringify(P25V2_COPY_CONFIG)); Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; }); c.feeds = c.feeds.map(function (f) { return { show: f.show, url: f.url, limit: f.limit || c.feedLimit }; });
  if (c.globalReservation !== false) { var r = p25v2GlobalReservation_(); c.reservedMaxEpNo = Math.max(Number(c.reservedMaxEpNo || 0), r.max); c.global = r; c.guidReserve = {}; c.reservation = r.summary; }   // 採番の単一経路（COPY も同じ予約を使う）
  return c;
}
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
  var c = p25v2Cfg_({ globalReservation: false }), v = JSON.parse(JSON.stringify(P25V2_V2_CONFIG));
  Object.keys(v).forEach(function (k) { c[k] = v[k]; }); Object.keys(over || {}).forEach(function (k) { c[k] = over[k]; });
  var r = p25v2GlobalReservation_(); c.reservedMaxEpNo = r.max; c.guidReserve = r.guidReserve; c.global = r; c.reservation = r.summary;
  return c;
}
// ===== 採番の単一経路（2026-11-14 司令塔「採番一本化」）=====
// 旧本番（読むだけ）・V2作業用・COPY の台帳と採番履歴から「番号→GUID」を毎回集める。COPY 試験も V2 作業用もこの関数だけを使う。
// ・どの台帳でも別のGUIDが使っている番号は振らない（旧本番が並行して採番していても重ならない）
// ・旧本番に同じGUIDの回があれば、その番号がどこでも空いていれば揃え、空いていなければ新番号＋「元EP-ID」に旧本番の番号を残す
// ・読めない台帳があれば止まる（推測で採番しない）
var P25V2_V1_PROD_ID_ = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', P25V2_COPY_ID_ = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';
function p25v2GlobalReservation_() {
  var num = function (s) { var m = String(s || '').match(/^EP-(\d{5})$/); return m ? +m[1] : 0; }, max = 0, used = {}, summary = {}, v1ByGuid = {};
  var col = function (ss, sheet, header, optional) {
    var sh = ss.getSheetByName(sheet); if (!sh || sh.getLastRow() < 2) return [];
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0], i = h.indexOf(header); if (i < 0) { if (optional) return []; throw new Error('RESERVATION_COLUMN_NOT_FOUND ' + sheet + ':' + header); }
    return sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0]; });
  };
  var take = function (label, ids, guids) { var m = 0; ids.forEach(function (id, i) { var n = num(id); if (!n) return; var g = String((guids || [])[i] || '').toLowerCase(); used[id] = used[id] || '|'; if (used[id].indexOf('|' + g + '|') < 0) used[id] += g + '|'; m = Math.max(m, n); }); summary[label] = m; max = Math.max(max, m); };   // used[id] = '|guid1|guid2|'（GUID不明は空）
  var v2 = SpreadsheetApp.openById(P25V2_V2_CONFIG.targetSpreadsheetId);
  take('V2・統合台帳', col(v2, 'V2・統合台帳', 'EP-ID'), col(v2, 'V2・統合台帳', '公式GUID'));
  take('V2・採番履歴', col(v2, '固定ID採番履歴', '固定ID'), col(v2, '固定ID採番履歴', 'GUID'));
  take('V2・削除除外履歴', col(v2, '削除・除外履歴', '固定ID'));
  take('V2内エピソード台帳', col(v2, 'エピソード台帳', '台帳ID'), col(v2, 'エピソード台帳', '外部ID', true));
  var v1 = SpreadsheetApp.openById(P25V2_V1_PROD_ID_), v1Ids = col(v1, 'エピソード台帳', '台帳ID'), v1G = col(v1, 'エピソード台帳', '外部ID');   // 旧本番は読むだけ
  if (!v1Ids.length) throw new Error('RESERVATION_V1_EMPTY');
  take('旧本番', v1Ids, v1G); v1Ids.forEach(function (id, i) { var g = String(v1G[i] || '').toLowerCase(); if (num(id) && g && !v1ByGuid[g]) v1ByGuid[g] = id; });
  var copy = SpreadsheetApp.openById(P25V2_COPY_ID_);   // COPY は固定ID（設定の書き換えに左右されない）
  var cIds = col(copy, '固定ID採番履歴', '固定ID'), cGuids = col(copy, '固定ID採番履歴', 'GUID'), cState = col(copy, '固定ID採番履歴', '状態');
  take('COPY・採番履歴', cIds, cGuids); take('COPY・統合台帳', col(copy, 'V2・統合台帳', 'EP-ID'), col(copy, 'V2・統合台帳', '公式GUID'));
  var guidReserve = {}; cIds.forEach(function (id, i) { var g = String(cGuids[i]).toLowerCase(); if (cState[i] === '登録完了' && num(id) && used[id] === '|' + g + '|') guidReserve[g] = id; });   // その番号を使っているのが同じGUIDだけのとき
  var collisions = Object.keys(used).filter(function (id) { return used[id].split('|').filter(Boolean).length > 1; }).sort();
  summary.max = max; summary.copyReservable = Object.keys(guidReserve).length; summary.collisions = collisions.length; summary.collisionIds = collisions.slice(0, 40).join(' ');
  return { max: max, used: used, v1ByGuid: v1ByGuid, guidReserve: guidReserve, summary: summary };
}
// 0) 採番の点検（書込なし）: 全台帳の予約最大・番号衝突の数と番号・旧本番のGUID数
function P25V2_0_採番点検() { var r = p25v2GlobalReservation_(); return p25v2Report_('P25V2_0_採番点検', { status: 'OK', reservation: r.summary, v1Guids: Object.keys(r.v1ByGuid).length, nextIfNew: 'EP-' + ('0000' + (r.max + 1)).slice(-5) }); }
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
  return p25v2Report_('P25V2_V2_3_WRITE_BATCH', { status: res.status, error: res.error, emptyFeeds: src.empty || [], added: res.added, addedEpIds: res.addedEpIds, counts: res.counts, publicBefore: res.publicBefore, publicAfter: res.publicAfter, reservation: cfg.reservation,
    plan: (res.plan || []).map(function (p) { return [p.epId, p.show, p.guid, p.fromReserve ? 'COPYと同番号' : '新番号']; }) });
}
// 4) 読み戻し検証（書込なし）: 台帳1行・GUID一致・採番履歴（GUID一致・登録完了）・原文SHA256・EP-IDの重複なし・再実行で既収蔵
function P25V2_V2_4_VERIFY() { return p25v2Verify_(p25v2V2Cfg_(), 'P25V2_V2_LAST_WRITE', 'P25V2_V2_4_VERIFY'); }

// ===== 掲載判定（Issue #278 基準・V2作業用の新着28件だけ）=====
// 5) 予行（書込なし）→ 6) 反映。掲載判定が「未判定」の行だけを対象にし、既に判定済みの行は書かない（再実行で差分0）。
// 規則: 除外番組（アルキキ・AJW・朝ポキTV/YouTube由来）→ 対象外／再配信表記（（再）（ふりかえり）（深掘り）再放送です）・再生時間0以下 → 対象外（再配信）
//       採番履歴が登録完了でない・GUIDが台帳内で一意でない・同題同日時の他行あり・概要欄に未検証（自動検査合格／品質確認済 以外）の文がある → 保留
//       それ以外 → 対象。概要清掃の合否そのものは掲載可否に使わない（未検証の概要文が台帳に入っていないことだけ確認する）。
var P25V2_V2_JUDGE_EPS_ = ['EP-06695', 'EP-06698'].concat([6700, 6701, 6702, 6703, 6704, 6705, 6706, 6707, 6708, 6709, 6710, 6711, 6712, 6713, 6714, 6715, 6716, 6717, 6718, 6719, 6720, 6721, 6722, 6723, 6724, 6725].map(function (n) { return 'EP-0' + n; }));
var P25V2_EXCLUDED_SHOWS_ = /アルキキ|AJW|朝ポキ|YouTube/i, P25V2_RERUN_MARK_ = /（再）|\(再\)|（ふりかえり）|（深掘り）|再放送です/;
function p25v2V2JudgePlan_(cfg, pick) {
  pick = pick || function (r, c) { return P25V2_V2_JUDGE_EPS_.indexOf(r[c.ep]) >= 0; };
  var o = p25v2OpenChecked_(cfg, false), v = o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues(), h = v[0];
  var I = function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + n); return i; };
  var c = { ep: I('EP-ID'), show: I('番組'), title: I('タイトル'), date: I('配信日時 JST'), judge: I('掲載判定'), rep: I('代表EP-ID'), guid: I('公式GUID'), uuid: I('公式JSON UUID'), dur: I('再生時間 秒'), sum: I('概要（清掃済）'), reason: I('除外・保留理由'), basis: I('判定根拠') };
  var io = p25v2GasIo_(cfg); io.open(); var num = {}; p25v2Numbering_(io.readNumbering()).forEach(function (n) { num[n.epId] = n; });
  var ds = o.ss.getSheetByName('V2・清掃詳細'), cv = {}; if (ds && ds.getLastRow() > 1) { var dv = ds.getRange(1, 1, ds.getLastRow(), ds.getLastColumn()).getDisplayValues(); dv.slice(1).forEach(function (r) { cv[r[0]] = r[dv[0].indexOf('判定')]; }); }
  var guidCount = {}, titleDate = {};
  v.slice(1).forEach(function (r) { var seen = {}; [r[c.guid], r[c.uuid]].forEach(function (g) { g = String(g).toLowerCase(); if (g && !seen[g]) { seen[g] = 1; guidCount[g] = (guidCount[g] || 0) + 1; } }); var k = r[c.show] + '\u0001' + r[c.title] + '\u0001' + r[c.date]; titleDate[k] = (titleDate[k] || 0) + 1; });
  var plan = [], at = new Date().toISOString();
  v.forEach(function (r, i) {
    if (i === 0 || !pick(r, c)) return;
    var p = { row: i + 1, ep: r[c.ep], show: r[c.show], cur: r[c.judge], guid: String(r[c.guid]).toLowerCase() }, why = [];
    if (P25V2_EXCLUDED_SHOWS_.test(r[c.show])) { p.judge = '対象外'; why.push('除外番組（Issue #278）'); }
    else if (P25V2_RERUN_MARK_.test(r[c.title]) || (String(r[c.dur]).trim() !== '' && !(Number(r[c.dur]) > 0))) { p.judge = '対象外'; why.push(P25V2_RERUN_MARK_.test(r[c.title]) ? '再配信表記（Issue #278）' : '再生時間0以下（Issue #278）'); }
    else if (String(r[c.dur]).trim() === '') { p.judge = '保留'; why.push('再生時間未取得'); }   // 空欄は「0秒」ではない（未取得）。再配信と決めつけない
    else {
      if (!num[p.ep]) why.push('採番履歴なし'); else if (num[p.ep].state !== '登録完了' || num[p.ep].guid !== p.guid) why.push('採番履歴が登録完了でない');
      if (r[c.rep] !== p.ep) why.push('代表EP-IDが自分でない');
      if (!p.guid || guidCount[p.guid] !== 1) why.push('GUIDが台帳内で一意でない');
      if (titleDate[r[c.show] + '\u0001' + r[c.title] + '\u0001' + r[c.date]] !== 1) why.push('同題・同日時の他行あり');
      if (r[c.sum] && !/^(自動検査合格・目視未確認|品質確認済)$/.test(cv[p.ep] || '')) why.push('未検証の概要文が台帳にある');
      p.judge = why.length ? '保留' : '対象';
    }
    p.reason = p.judge === '対象' ? '' : why.join('／');
    p.basis = 'Issue #278 基準 ' + at.slice(0, 10) + ' P25V2_V2_6: 除外番組でない・再配信表記なし・再生時間>0・採番登録完了・GUID一意・同題同日なし' + (p.judge === '対象' ? '' : ' → ' + p.reason);
    p.action = p.cur === '未判定' ? '書込' : (p.cur === p.judge ? '判定済（同じ）' : '判定済（変更しない）');
    p.cols = c; plan.push(p);
  });
  return { o: o, plan: plan, cols: c };
}
function p25v2PublicMeasured_(ss) { var p = ss.getSheetByName('V2・公開台帳'); if (!p) return 'シートなし'; SpreadsheetApp.flush(); var a = p.getRange(2, 1, Math.max(p.getLastRow() - 1, 1), 1).getDisplayValues(); return a.filter(function (r) { return r[0]; }).length; }
function p25v2JudgeCounts_(plan) { var n = {}; plan.forEach(function (p) { n[p.judge] = (n[p.judge] || 0) + 1; }); return n; }
function P25V2_V2_5_掲載判定_予行() {
  var cfg = p25v2V2Cfg_(), r = p25v2V2JudgePlan_(cfg);
  return p25v2Report_('P25V2_V2_5_掲載判定_予行', { status: 'OK', targets: r.plan.length, judges: p25v2JudgeCounts_(r.plan), toWrite: r.plan.filter(function (p) { return p.action === '書込'; }).length, publicMeasured: p25v2PublicMeasured_(r.o.ss),
    plan: r.plan.map(function (p) { return [p.ep, p.show, p.cur, '→', p.judge, p.reason, p.action]; }) });
}
function P25V2_V2_6_掲載判定_反映() {
  var cfg = p25v2V2Cfg_({ write: true }), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return p25v2Report_('P25V2_V2_6_掲載判定_反映', { status: 'LOCKED' });
  try {
    p25v2OpenChecked_(cfg, true);
    var r = p25v2V2JudgePlan_(cfg), c = r.cols, sh = r.o.sh, before = p25v2PublicMeasured_(r.o.ss), w = r.plan.filter(function (p) { return p.action === '書込'; }), bad = 0;
    if (r.plan.length !== P25V2_V2_JUDGE_EPS_.length) throw new Error('JUDGE_TARGET_COUNT_MISMATCH ' + r.plan.length);
    w.forEach(function (p) { sh.getRange(p.row, c.judge + 1).setValue(p.judge); sh.getRange(p.row, c.reason + 1).setValue(p.reason); sh.getRange(p.row, c.basis + 1).setValue(p.basis); });
    SpreadsheetApp.flush();
    w.forEach(function (p) { var b = sh.getRange(p.row, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; if (b[c.ep] !== p.ep || b[c.judge] !== p.judge || b[c.reason] !== p.reason || b[c.basis] !== p.basis) bad++; });
    var after = p25v2PublicMeasured_(r.o.ss), added = w.filter(function (p) { return p.judge === '対象'; }).length;
    var out = { status: bad ? 'READBACK_MISMATCH' : (typeof before === 'number' && after === before + added) ? (w.length ? 'OK' : 'OK_NO_CHANGE') : 'PUBLIC_COUNT_MISMATCH', written: w.length, readbackMismatch: bad, judges: p25v2JudgeCounts_(r.plan), publicBefore: before, publicAfter: after, expectedAfter: typeof before === 'number' ? before + added : null,
      skipped: r.plan.filter(function (p) { return p.action !== '書込'; }).length, notTarget: r.plan.filter(function (p) { return p.judge !== '対象'; }).map(function (p) { return [p.ep, p.judge, p.reason]; }) };
    p25v2Log_(r.o.ss, 'P25V2_V2_6_掲載判定_反映', { mode: 'V2_WRITE', status: out.status, counts: out.judges }, JSON.stringify(w.map(function (p) { return p.ep + ':' + p.cur + '→' + p.judge; })).slice(0, 400));
    return p25v2Report_('P25V2_V2_6_掲載判定_反映', out);
  } finally { lock.releaseLock(); }
}


// =====================================================================
// 管理人が押して使う GAS（2026-11-13）。Claude は設計・試験・COPY 少数件まで。全件処理はここから GAS が行う。
// 書込のある関数は「承認ボタン」（P25V2_xx0_承認_…）を押してスクリプトプロパティに承認印を付けた後だけ動く。
// 取消ボタン（…9_…取消）は履歴シートから「書いた値が今もそのままのセル」だけを元に戻す。
// =====================================================================
function p25v2Approved_(key) { return PropertiesService.getScriptProperties().getProperty(key) === 'yes'; }
function p25v2Approve_(key, fn, note) { PropertiesService.getScriptProperties().setProperty(key, 'yes'); return p25v2Report_(fn, { status: 'APPROVED', key: key, note: note, at: new Date().toISOString() }); }
function p25v2Unapprove_(key) { PropertiesService.getScriptProperties().deleteProperty(key); }
function p25v2EnvCfg_(env) { return env === 'COPY' ? p25v2Cfg_({}) : p25v2V2Cfg_(); }

// ---------- GUID 空欄補完（台帳の「公式GUID」が空で、V2・収蔵詳細に同じEP-IDのGUIDがある行だけ） ----------
// 安全条件: 台帳GUID空欄／収蔵詳細のGUIDが詳細内で1回だけ／台帳のどの行のGUID・公式JSON UUIDにも未使用／公式JSON UUIDが空か同じ値／
//          GUIDがURLでない（UUID形式 または 空白なし100字以内）／台帳のEP-IDが1行だけ。1つでも外れたら HOLD（書かない）。
var P25V2_GUID_HIST_ = 'V2・GUID補完履歴', P25V2_GUID_HIST_HEADERS_ = ['日時', '実行ID', 'EP-ID', '台帳行', '書込GUID', '状態'];
function p25v2GuidPlan_(cfg) {
  var o = p25v2OpenChecked_(cfg, false), v = o.sh.getRange(1, 1, o.sh.getLastRow(), o.sh.getLastColumn()).getDisplayValues(), h = v[0];
  var I = function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('LEDGER_COLUMN_NOT_FOUND ' + n); return i; }, cEp = I('EP-ID'), cG = I('公式GUID'), cU = I('公式JSON UUID');
  // GUIDの出どころは常に V2作業用の「V2・収蔵詳細」（読むだけ）。COPY試験でも同じ出どころを使い、書くのは COPY の台帳だけ
  var ds = SpreadsheetApp.openById(P25V2_V2_WORKING_ID_).getSheetByName(P25V2_DETAIL_SHEET_); if (!ds) throw new Error('SHEET_NOT_FOUND ' + P25V2_DETAIL_SHEET_);
  var dv = ds.getLastRow() > 1 ? ds.getRange(1, 1, ds.getLastRow(), 2).getDisplayValues() : [['EP-ID', '公式GUID']];
  var detByEp = {}, detCount = {}, used = {}, epCount = {};
  dv.slice(1).forEach(function (r) { var g = String(r[1]).trim().toLowerCase(); if (!r[0] || !g) return; detByEp[r[0]] = g; detCount[g] = (detCount[g] || 0) + 1; });
  v.slice(1).forEach(function (r) { epCount[r[cEp]] = (epCount[r[cEp]] || 0) + 1; [r[cG], r[cU]].forEach(function (g) { g = String(g).trim().toLowerCase(); if (g) used[g] = (used[g] || 0) + 1; }); });
  var plan = [], hold = {}, holdEx = [];
  v.forEach(function (r, i) {
    if (i === 0 || !r[cEp] || String(r[cG]).trim()) return;
    var g = detByEp[r[cEp]], why = '';
    if (!g) why = 'DETAIL_GUID_NONE';
    else if (detCount[g] !== 1) why = 'DETAIL_GUID_SHARED';
    else if (used[g]) why = 'GUID_USED_BY_OTHER_ROW';
    else if (String(r[cU]).trim() && String(r[cU]).trim().toLowerCase() !== g) why = 'JSON_UUID_DIFFERS';
    else if (/^https?:|\s/.test(g) || g.length > 100) why = 'GUID_FORMAT';
    else if (epCount[r[cEp]] !== 1) why = 'EP_ID_DUPLICATED';
    if (why) { hold[why] = (hold[why] || 0) + 1; if (holdEx.length < 30) holdEx.push([r[cEp], why]); return; }
    plan.push({ row: i + 1, ep: r[cEp], guid: g });
  });
  return { o: o, plan: plan, hold: hold, holdEx: holdEx, col: cG + 1, emptyTotal: plan.length + Object.keys(hold).reduce(function (a, k) { return a + hold[k]; }, 0) };
}
function p25v2GuidDry_(env, fn) {
  var r = p25v2GuidPlan_(p25v2EnvCfg_(env));
  return p25v2Report_(fn, { status: 'OK', env: env, emptyGuidRows: r.emptyTotal, writable: r.plan.length, hold: r.hold, holdExamples: r.holdEx, first: r.plan.slice(0, 5).map(function (p) { return [p.ep, p.guid]; }) });
}
function p25v2GuidApply_(env, fn, maxRows, approvalKey) {
  if (approvalKey && !p25v2Approved_(approvalKey)) return p25v2Report_(fn, { status: 'NOT_APPROVED', note: '先に承認ボタンを押す（' + approvalKey + '）' });
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return p25v2Report_(fn, { status: 'LOCKED' });
  try {
    var cfg = p25v2EnvCfg_(env); cfg.write = true; p25v2OpenChecked_(cfg, true);
    var r = p25v2GuidPlan_(cfg), sh = r.o.sh, w = r.plan.slice(0, maxRows), id = new Date().toISOString() + '/GUID', t0 = Date.now();
    if (!w.length) return p25v2Report_(fn, { status: 'OK_NO_CHANGE', env: env, hold: r.hold });
    var hs = r.o.ss.getSheetByName(P25V2_GUID_HIST_) || r.o.ss.insertSheet(P25V2_GUID_HIST_);
    if (hs.getLastRow() === 0) hs.getRange(1, 1, 1, P25V2_GUID_HIST_HEADERS_.length).setValues([P25V2_GUID_HIST_HEADERS_]);
    var hr = hs.getRange(hs.getLastRow() + 1, 1, w.length, P25V2_GUID_HIST_HEADERS_.length); hr.setNumberFormat('@');
    hr.setValues(w.map(function (p) { return [new Date().toISOString(), id, p.ep, p.row, p.guid, '書込中']; })); SpreadsheetApp.flush();   // 先に履歴（途中で止まっても取消できる）
    var rows = w.map(function (p) { return p.row; }), i = 0;
    while (i < w.length) { var j = i; while (j + 1 < w.length && rows[j + 1] === rows[j] + 1) j++;   // 連続行はまとめて書く
      var rg = sh.getRange(rows[i], r.col, j - i + 1, 1); rg.setNumberFormat('@'); rg.setValues(w.slice(i, j + 1).map(function (p) { return [p.guid]; })); i = j + 1; }
    SpreadsheetApp.flush();
    var col = sh.getRange(1, r.col, sh.getLastRow(), 1).getDisplayValues(), epc = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues(), bad = 0;
    var st = w.map(function (p) { var ok = String(col[p.row - 1][0]).toLowerCase() === p.guid && epc[p.row - 1][0] === p.ep; if (!ok) bad++; return [ok ? 'OK' : 'READBACK_MISMATCH']; });
    hr.offset(0, 5, w.length, 1).setValues(st);
    var out = { status: bad ? 'READBACK_MISMATCH' : 'OK', env: env, written: w.length, readbackMismatch: bad, remaining: r.plan.length - w.length, hold: r.hold, runId: id, ms: Date.now() - t0 };
    p25v2Log_(r.o.ss, fn, { mode: env + '_WRITE', status: out.status, counts: { written: w.length, remaining: out.remaining } }, id);
    return p25v2Report_(fn, out);
  } finally { lock.releaseLock(); }
}
function p25v2GuidUndo_(env, fn) {   // 一括: GUID列とEP-ID列を1回読み、書いた値が今もそのままの行だけ空に戻す（連続行はまとめて書く）
  var cfg = p25v2EnvCfg_(env); cfg.write = true; var o = p25v2OpenChecked_(cfg, true), hs = o.ss.getSheetByName(P25V2_GUID_HIST_);
  if (!hs || hs.getLastRow() < 2) return p25v2Report_(fn, { status: 'NOTHING_TO_UNDO' });
  var hv = hs.getRange(2, 1, hs.getLastRow() - 1, P25V2_GUID_HIST_HEADERS_.length).getDisplayValues(), h = o.sh.getRange(1, 1, 1, o.sh.getLastColumn()).getDisplayValues()[0], col = h.indexOf('公式GUID') + 1;
  var n = o.sh.getLastRow(), gv = o.sh.getRange(1, col, n, 1).getDisplayValues(), ev = o.sh.getRange(1, 1, n, 1).getDisplayValues(), rows = [], st = hv.map(function (r) { return [r[5]]; }), kept = 0;
  hv.forEach(function (r, k) { if (!/^OK$|^書込中$/.test(r[5])) return; var rw = Number(r[3]);
    if (ev[rw - 1] && ev[rw - 1][0] === r[2] && String(gv[rw - 1][0]).toLowerCase() === r[4]) { rows.push(rw); st[k] = ['取消済']; } else kept++; });
  rows.sort(function (x, y) { return x - y; }); var i = 0;
  while (i < rows.length) { var j = i; while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++; o.sh.getRange(rows[i], col, j - i + 1, 1).setValues(rows.slice(i, j + 1).map(function () { return ['']; })); i = j + 1; }
  SpreadsheetApp.flush(); hs.getRange(2, 6, st.length, 1).setValues(st);
  var after = o.sh.getRange(1, col, n, 1).getDisplayValues(), bad = rows.filter(function (rw) { return after[rw - 1][0] !== ''; }).length;
  return p25v2Report_(fn, { status: bad ? 'READBACK_MISMATCH' : 'OK', undone: rows.length, keptBecauseChanged: kept, readbackMismatch: bad });
}
// COPY（少数件試験・上限20行）
function P25V2_G1_GUID補完_予行_COPY() { return p25v2GuidDry_('COPY', 'P25V2_G1_GUID補完_予行_COPY'); }
function P25V2_G2_GUID補完_反映_COPY() { return p25v2GuidApply_('COPY', 'P25V2_G2_GUID補完_反映_COPY', 20, null); }
function P25V2_G9_GUID補完_取消_COPY() { return p25v2GuidUndo_('COPY', 'P25V2_G9_GUID補完_取消_COPY'); }
// V2作業用（承認後。1回最大1,000行、残りがあれば同じボタンをもう一度）
function P25V2_G1_GUID補完_予行() { return p25v2GuidDry_('V2', 'P25V2_G1_GUID補完_予行'); }
function P25V2_G0_承認_GUID補完() { return p25v2Approve_('APPROVE_GUID_BACKFILL_V2', 'P25V2_G0_承認_GUID補完', '管理人がV2作業用のGUID空欄補完を承認'); }
function P25V2_G2_GUID補完_反映() { return p25v2GuidApply_('V2', 'P25V2_G2_GUID補完_反映', 1000, 'APPROVE_GUID_BACKFILL_V2'); }
function P25V2_G9_GUID補完_取消() { return p25v2GuidUndo_('V2', 'P25V2_G9_GUID補完_取消'); }

// ---------- 掲載判定（未判定すべて。Issue #278 規則は 28件版と同じ p25v2V2JudgePlan_） ----------
var P25V2_PICK_UNJUDGED_ = function (r, c) { return r[c.judge] === '未判定'; };
function P25V2_J1_掲載判定_予行_未判定全件() {
  var cfg = p25v2V2Cfg_(), r = p25v2V2JudgePlan_(cfg, P25V2_PICK_UNJUDGED_), why = {};
  r.plan.forEach(function (p) { if (p.reason) p.reason.split('／').forEach(function (x) { why[x] = (why[x] || 0) + 1; }); });
  return p25v2Report_('P25V2_J1_掲載判定_予行_未判定全件', { status: 'OK', targets: r.plan.length, judges: p25v2JudgeCounts_(r.plan), reasons: why, publicMeasured: p25v2PublicMeasured_(r.o.ss),
    notTarget: r.plan.filter(function (p) { return p.judge !== '対象'; }).slice(0, 40).map(function (p) { return [p.ep, p.judge, p.reason]; }) });
}
function P25V2_J0_承認_掲載判定_未判定全件() { return p25v2Approve_('APPROVE_JUDGE_UNJUDGED_V2', 'P25V2_J0_承認_掲載判定_未判定全件', '管理人が未判定全件の掲載判定反映を承認'); }
function P25V2_J2_掲載判定_反映_未判定全件() {
  if (!p25v2Approved_('APPROVE_JUDGE_UNJUDGED_V2')) return p25v2Report_('P25V2_J2_掲載判定_反映_未判定全件', { status: 'NOT_APPROVED', note: '先に P25V2_J0_承認_掲載判定_未判定全件' });
  var cfg = p25v2V2Cfg_({ write: true }), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return p25v2Report_('P25V2_J2_掲載判定_反映_未判定全件', { status: 'LOCKED' });
  try {
    p25v2OpenChecked_(cfg, true);
    var r = p25v2V2JudgePlan_(cfg, P25V2_PICK_UNJUDGED_), c = r.cols, sh = r.o.sh, before = p25v2PublicMeasured_(r.o.ss), w = r.plan.filter(function (p) { return p.action === '書込'; }), bad = 0;
    w.forEach(function (p) { sh.getRange(p.row, c.judge + 1).setValue(p.judge); sh.getRange(p.row, c.reason + 1).setValue(p.reason); sh.getRange(p.row, c.basis + 1).setValue(p.basis.replace('P25V2_V2_6', 'P25V2_J2')); });
    SpreadsheetApp.flush();
    w.forEach(function (p) { var b = sh.getRange(p.row, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; if (b[c.ep] !== p.ep || b[c.judge] !== p.judge) bad++; });
    var after = p25v2PublicMeasured_(r.o.ss), added = w.filter(function (p) { return p.judge === '対象'; }).length;
    var out = { status: bad ? 'READBACK_MISMATCH' : (after === before + added ? (w.length ? 'OK' : 'OK_NO_CHANGE') : 'PUBLIC_COUNT_MISMATCH'), written: w.length, judges: p25v2JudgeCounts_(w), publicBefore: before, publicAfter: after };
    p25v2Log_(r.o.ss, 'P25V2_J2_掲載判定_反映_未判定全件', { mode: 'V2_WRITE', status: out.status, counts: out.judges }, JSON.stringify(w.map(function (p) { return p.ep + ':' + p.judge; })).slice(0, 400));
    return p25v2Report_('P25V2_J2_掲載判定_反映_未判定全件', out);
  } finally { lock.releaseLock(); }
}

// ---------- 日次自動運転（収蔵ボット側）。トリガーは承認ボタンの後に「設置」ボタンで1本だけ ----------
// 順序: 停止旗の確認 → フィード点検（取得エラーなら停止旗）→ 新着書込（10件×最大3回）→ 読み戻し検証 → 停止旗が無ければ終了。
// 掲載判定は承認（APPROVE_AUTO_JUDGE）がある場合だけ、その日に登録した回の「未判定」に対して行う。清掃は清掃ロボ側の日次関数で行う。
function P25V2_D1_日次実行() {
  var P = PropertiesService.getScriptProperties(), fn = 'P25V2_D1_日次実行'; if (P.getProperty('AUTORUN_STOP')) return p25v2Report_(fn, { status: 'STOPPED', reason: P.getProperty('AUTORUN_STOP') });
  var stop = function (why, res) { P.setProperty('AUTORUN_STOP', new Date().toISOString() + ' ' + why); return p25v2Report_(fn, { status: 'STOP', reason: why, res: res }); };
  var added = 0, runs = [];
  for (var k = 0; k < 3; k++) { var w = P25V2_V2_3_WRITE_BATCH(); runs.push(w.status + ':' + (w.added || 0)); if (w.status !== 'OK') return stop('WRITE_' + w.status, w); if (w.emptyFeeds && w.emptyFeeds.length) return stop('FEED_EMPTY ' + w.emptyFeeds.join(','), w); added += w.added || 0; if (!w.added) break; }   // 取得失敗（STOP_FEED_ERRORS）と空のフィード（FEED_EMPTY）は止まる。正常な新着0は OK・added 0
  if (added) { var v = P25V2_V2_4_VERIFY(); if (v.status !== 'VERIFY_OK') return stop('VERIFY_NG', v); }
  var j = null;
  if (added && p25v2Approved_('APPROVE_AUTO_JUDGE')) { var eps = JSON.parse(P.getProperty('P25V2_V2_LAST_WRITE') || '{}').addedEpIds || []; j = p25v2AutoJudge_(eps); if (/MISMATCH/.test(j.status)) return stop('JUDGE_' + j.status, j); }
  return p25v2Report_(fn, { status: 'OK', added: added, runs: runs, judge: j });
}
function p25v2AutoJudge_(eps) {
  var cfg = p25v2V2Cfg_({ write: true }), set = {}; eps.forEach(function (e) { set[e] = 1; }); p25v2OpenChecked_(cfg, true);
  var r = p25v2V2JudgePlan_(cfg, function (row, c) { return set[row[c.ep]] && row[c.judge] === '未判定'; }), c = r.cols, sh = r.o.sh, before = p25v2PublicMeasured_(r.o.ss), w = r.plan.filter(function (p) { return p.action === '書込'; });
  w.forEach(function (p) { sh.getRange(p.row, c.judge + 1).setValue(p.judge); sh.getRange(p.row, c.reason + 1).setValue(p.reason); sh.getRange(p.row, c.basis + 1).setValue(p.basis.replace('P25V2_V2_6', 'P25V2_D1')); });
  SpreadsheetApp.flush(); var after = p25v2PublicMeasured_(r.o.ss), add = w.filter(function (p) { return p.judge === '対象'; }).length;
  return { status: after === before + add ? 'OK' : 'PUBLIC_COUNT_MISMATCH', written: w.length, judges: p25v2JudgeCounts_(w) };
}
function P25V2_D0_承認_日次トリガー() { return p25v2Approve_('APPROVE_DAILY_TRIGGER', 'P25V2_D0_承認_日次トリガー', '管理人が日次トリガー1本の設置を承認'); }
function P25V2_D8_日次トリガー設置() {
  var fn = 'P25V2_D8_日次トリガー設置'; if (!p25v2Approved_('APPROVE_DAILY_TRIGGER')) return p25v2Report_(fn, { status: 'NOT_APPROVED', note: '先に P25V2_D0_承認_日次トリガー' });
  var ts = ScriptApp.getProjectTriggers(), other = ts.filter(function (t) { return t.getHandlerFunction() !== 'P25V2_D1_日次実行'; });
  if (other.length) return p25v2Report_(fn, { status: 'REFUSED_OTHER_TRIGGERS', handlers: other.map(function (t) { return t.getHandlerFunction(); }) });
  if (ts.length) return p25v2Report_(fn, { status: 'ALREADY_INSTALLED', count: ts.length });
  ScriptApp.newTrigger('P25V2_D1_日次実行').timeBased().everyDays(1).atHour(6).nearMinute(40).create();
  return p25v2Report_(fn, { status: 'INSTALLED', handler: 'P25V2_D1_日次実行', at: '毎日 6時台（日本時間）' });
}
function P25V2_D9_日次停止_トリガー削除() {
  var n = 0; ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'P25V2_D1_日次実行') { ScriptApp.deleteTrigger(t); n++; } });
  PropertiesService.getScriptProperties().setProperty('AUTORUN_STOP', new Date().toISOString() + ' 手動停止'); p25v2Unapprove_('APPROVE_DAILY_TRIGGER');
  return p25v2Report_('P25V2_D9_日次停止_トリガー削除', { status: 'OK', deletedTriggers: n, stopFlag: true });
}
function P25V2_D7_停止旗を外す() { PropertiesService.getScriptProperties().deleteProperty('AUTORUN_STOP'); return p25v2Report_('P25V2_D7_停止旗を外す', { status: 'OK' }); }
