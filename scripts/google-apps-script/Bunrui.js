// Bunrui.js — 朝リスみんなで仕分け（2026-11-20 管理人「朝リスの力を借りて、迷っている回の分類を集める」）
//   1) 投稿の受付（type=bunruiSubmit・JSONP）… 作業台の別タブ「朝リス分類・投稿」に1行ずつ足す。台帳（V2）には書かない
//   2) 集計の公開（type=bunruiPublic）… 回ごとの票数だけを返す。ニックネーム・ひとこと・端末IDは出さない
// 同じ端末・同じ回の投稿は、最後の1件だけを数える（気が変わったら出し直せる）。
var BUNRUI_SHEET_ = '朝リス分類・投稿';
var BUNRUI_H_ = ['受付ID', '受付日時', 'EP-ID', '主分類', '副分類', '小テーマ', 'ひとこと', 'ニックネーム', '聞いた', '端末', '状態', 'メモ'];
var BUNRUI_CATS_ = ['政治・行政', '国際・外交', '経済・金融', '仕事・労働', '社会・人権', '法律・司法', 'ジェンダー', '福祉・介護', '健康・医療', '科学', 'AI・技術', '環境・気候', '動物・自然', '防災', '教育', 'メディア', '文化・芸術', '暮らし・生活', 'スポーツ', '歴史・宗教'];
var BUNRUI_UNSURE_ = 'わからない';
var BUNRUI_LISTENED_ = ['全部聞いた', '一部聞いた', '聞いていない'];
var BUNRUI_DAILY_MAX_ = 3000;        // 1日の受付の上限（全体）
var BUNRUI_DEVICE_DAILY_MAX_ = 300;  // 1台の端末の1日の上限
var BUNRUI_EXCLUDED_ = '除外';        // 管理人が「状態」をこれにした行は数えない

// 純粋: 投稿の形を確かめる（受け付けるか・どう保存するか）
function bunruiValidate_(p) {
  var errors = [], s = function (v) { return String(v == null ? '' : v).trim(); };
  var ep = s(p.ep), main = s(p.main), sub = s(p.sub), theme = s(p.theme), note = s(p.note), nick = s(p.nick), listened = s(p.listened), device = s(p.device);
  if (s(p.hp)) errors.push('BOT');
  if (!/^EP-\d{5}$/.test(ep)) errors.push('EP');
  if (main !== BUNRUI_UNSURE_ && BUNRUI_CATS_.indexOf(main) < 0) errors.push('MAIN');
  if (sub && (BUNRUI_CATS_.indexOf(sub) < 0 || sub === main)) errors.push('SUB');
  if (theme.length > 30) errors.push('THEME');
  if (note.length > 300) errors.push('NOTE');
  if (nick.length > 30) errors.push('NICK');
  if (listened && BUNRUI_LISTENED_.indexOf(listened) < 0) errors.push('LISTENED');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(device)) errors.push('DEVICE');
  if (/https?:\/\//i.test(note + nick + theme) && /(bit\.ly|t\.co|discord\.gg)/i.test(note + nick)) errors.push('LINK');
  return { ok: !errors.length, errors: errors, row: { ep: ep, main: main, sub: main === BUNRUI_UNSURE_ ? '' : sub, theme: theme, note: note, nick: nick, listened: listened, device: device } };
}

// 純粋: 受付の行 → 回ごとの票（同じ端末・同じ回は最後の1件だけ。除外行は数えない）
function bunruiTally_(rows) {
  var latest = {};
  (rows || []).forEach(function (r) {
    if (String(r[10] || '') === BUNRUI_EXCLUDED_) return;
    var ep = String(r[2] || ''), dev = String(r[9] || ''); if (!ep || !dev) return;
    latest[ep + '|' + dev] = r;
  });
  var out = {};
  Object.keys(latest).forEach(function (k) {
    var r = latest[k], ep = String(r[2]), o = out[ep] || (out[ep] = { n: 0, main: {}, sub: {}, unsure: 0 });
    o.n++;
    var m = String(r[3] || ''); if (m === BUNRUI_UNSURE_) o.unsure++; else if (m) o.main[m] = (o.main[m] || 0) + 1;
    var sb = String(r[4] || ''); if (sb) o.sub[sb] = (o.sub[sb] || 0) + 1;
  });
  return out;
}

var BUNRUI_ERROR_TEXT_ = { BOT: '送信できませんでした', EP: '回の番号が正しくありません', MAIN: '主分類を選んでください', SUB: '副分類は主分類と別のものを選んでください', THEME: '小テーマは30字までです', NOTE: 'ひとことは300字までです', NICK: 'ニックネームは30字までです', LISTENED: '「聞いた」の選び方が正しくありません', DEVICE: 'ページを読み込み直してからお試しください', LINK: '短縮URL・招待リンクは書けません', DAILY: '今日の受付の上限に達しました。明日またお願いします', BUSY: '混み合っています。少し待ってからもう一度お試しください', NOT_SAVED: '保存を確認できませんでした。もう一度お試しください' };

function bunruiSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), sh = ss.getSheetByName(BUNRUI_SHEET_);
  if (!sh) { sh = ss.insertSheet(BUNRUI_SHEET_); sh.getRange(1, 1, 1, BUNRUI_H_.length).setValues([BUNRUI_H_]); sh.setFrozenRows(1); }
  return sh;
}
function bunruiRows_(sh) { var n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, BUNRUI_H_.length).getDisplayValues() : []; }
// 端末IDはそのまま保存しない（ハッシュの先頭だけ）
function bunruiDeviceKey_(device) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'bunrui:' + device, Utilities.Charset.UTF_8);
  return b.slice(0, 8).map(function (x) { return ((x + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

function bunruiSubmit_(p) {
  var v = bunruiValidate_(p);
  if (!v.ok) return { ok: false, errors: v.errors, message: v.errors.map(function (e) { return BUNRUI_ERROR_TEXT_[e] || e; }).join('／') };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, errors: ['BUSY'], message: BUNRUI_ERROR_TEXT_.BUSY };
  try {
    var sh = bunruiSheet_(), rows = bunruiRows_(sh), now = new Date().toISOString(), day = now.slice(0, 10), dev = bunruiDeviceKey_(v.row.device);
    var today = rows.filter(function (r) { return String(r[1]).slice(0, 10) === day; });
    if (today.length >= BUNRUI_DAILY_MAX_ || today.filter(function (r) { return r[9] === dev; }).length >= BUNRUI_DEVICE_DAILY_MAX_) return { ok: false, errors: ['DAILY'], message: BUNRUI_ERROR_TEXT_.DAILY };
    var id = 'BR-' + now.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 9000 + 1000);
    var r = v.row;
    sh.appendRow([id, now, r.ep, r.main, r.sub, r.theme, r.note, r.nick, r.listened, dev, '', '']);
    SpreadsheetApp.flush();
    var back = bunruiRows_(sh).filter(function (x) { return x[0] === id; }).length;
    if (back !== 1) return { ok: false, errors: ['NOT_SAVED'], message: BUNRUI_ERROR_TEXT_.NOT_SAVED };
    var tally = bunruiTally_(bunruiRows_(sh))[r.ep] || { n: 0, main: {}, sub: {}, unsure: 0 };
    return { ok: true, receiptId: id, ep: r.ep, tally: tally, message: '受け付けました。ありがとうございます！' };
  } finally { lock.releaseLock(); }
}

function handleBunruiSubmit_(e, callback) {
  var p = (e && e.parameter) || {};
  var res = bunruiSubmit_({ ep: p.ep, main: p.main, sub: p.sub, theme: p.theme, note: p.note, nick: p.nick, listened: p.listened, device: p.device, hp: p.website2 });
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
function handleBunruiPublic_(e, callback) {
  var res;
  try {
    var rows = bunruiRows_(bunruiSheet_()), t = bunruiTally_(rows), devs = {};
    rows.forEach(function (r) { if (String(r[10] || '') !== BUNRUI_EXCLUDED_ && r[9]) devs[r[9]] = 1; });
    res = { ok: true, type: 'bunruiPublic', generatedAt: new Date().toISOString(), episodes: Object.keys(t).length, contributors: Object.keys(devs).length, votes: t };
  } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}

if (typeof module !== 'undefined') module.exports = { bunruiValidate_: bunruiValidate_, bunruiTally_: bunruiTally_, BUNRUI_CATS_: BUNRUI_CATS_ };
