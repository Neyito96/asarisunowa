// ShelfSubmit.js — 蔵の「わたしの蔵書」を、テーマへの推薦として朝リスに届ける受付（Issue #345）
// 保存先: 本番スプレッドシート（SPREADSHEET_ID）の「蔵書推薦・受付」タブ。状態は必ず「承認待ち」で入り、公開・Spotify追加は管理人の確認後（ここでは行わない）。
// 受け取るのは 回番号（EP-ID）・蔵書名・説明・ひとこと・ニックネーム（任意）だけ。メール・端末情報・検索の言葉は受け取らない。
var SHELF_SHEET_ = '蔵書推薦・受付';
var SHELF_H_ = ['受付ID', '受付日時', '状態', 'EP-ID（並び順）', '件数', '蔵書名', '説明', 'ひとこと', 'ニックネーム', '同じ内容の印', '管理メモ', 'Spotify希望', '追加先プレイリストURL', 'Spotify結果'];
var SHELF_LIMITS_ = { items: 50, title: 60, description: 300, note: 300, nick: 30, perMinute: 20 };
var SHELF_ERROR_TEXT_ = { HONEYPOT: '送信できませんでした', NO_ITEMS: '蔵書に回が入っていません', TOO_MANY: '一度に送れるのは50回までです', BAD_ID: '回番号の形が正しくありません', DUPLICATE: '同じ内容がすでに受け付けられています（承認待ち）', BUSY: '混み合っています。少し待ってからもう一度お試しください', RATE: '短い時間に送信が集中しています。少し待ってからお試しください', NOT_SAVED: '保存を確認できませんでした。もう一度お試しください' };
function shelfClean_(s, max) { var t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); return /^[=+\-@]/.test(t) ? "'" + t : t; }   // 表計算の式として解釈されないように
function shelfValidate_(sub) {
  if (String(sub.hp || '').trim()) return { ok: false, errors: ['HONEYPOT'] };
  var raw = String(sub.ids || '').split(/[\s,]+/).filter(Boolean), ids = [];
  for (var i = 0; i < raw.length; i++) { if (!/^EP-\d{5}$/.test(raw[i])) return { ok: false, errors: ['BAD_ID'] }; if (ids.indexOf(raw[i]) < 0) ids.push(raw[i]); }
  if (!ids.length) return { ok: false, errors: ['NO_ITEMS'] };
  if (ids.length > SHELF_LIMITS_.items) return { ok: false, errors: ['TOO_MANY'] };
  var v = { ids: ids, title: shelfClean_(sub.title, SHELF_LIMITS_.title), description: shelfClean_(sub.description, SHELF_LIMITS_.description), note: shelfClean_(sub.note, SHELF_LIMITS_.note), spotify: /^(1|true|on)$/i.test(String(sub.spotify || '')), nick: shelfClean_(sub.nick, SHELF_LIMITS_.nick) };
  v.key = ids.join(',') + '|' + v.title;
  return { ok: true, value: v };
}
// 既存タブには見出しが足りない列だけ右に足す（既存の列・行は動かさない）
function shelfSheet_(ss) {
  var sh = posuSheet(ss, SHELF_SHEET_, SHELF_H_), w = sh.getLastColumn(), h = sh.getRange(1, 1, 1, Math.max(w, 1)).getDisplayValues()[0];
  for (var i = 0; i < SHELF_H_.length; i++) if (String(h[i] || '') !== SHELF_H_[i]) { if (i < 11) throw new Error('蔵書推薦・受付の見出しが想定と違います'); sh.getRange(1, i + 1).setValue(SHELF_H_[i]); }
  return sh;
}
function shelfSubmit_(sub) {
  var v = shelfValidate_(sub); if (!v.ok) return { ok: false, errors: v.errors, message: SHELF_ERROR_TEXT_[v.errors[0]] };
  var cache = CacheService.getScriptCache(), slot = 'SHELF_RATE_' + Math.floor(Date.now() / 60000), n = Number(cache.get(slot) || 0);
  if (n >= SHELF_LIMITS_.perMinute) return { ok: false, errors: ['RATE'], message: SHELF_ERROR_TEXT_.RATE };
  cache.put(slot, String(n + 1), 120);
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, errors: ['BUSY'], message: SHELF_ERROR_TEXT_.BUSY };
  try {
    var c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), sh = shelfSheet_(ss), rows = posuRows(sh, SHELF_H_.length), x = v.value;
    if (rows.some(function (r) { return r[9] === x.key && r[2] === '承認待ち'; })) return { ok: false, errors: ['DUPLICATE'], message: SHELF_ERROR_TEXT_.DUPLICATE };
    var now = new Date().toISOString(), id = 'SH-' + now.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 900 + 100);
    sh.appendRow([id, now, '承認待ち', x.ids.join(' '), x.ids.length, x.title, x.description, x.note, x.nick, x.key, '', x.spotify ? '希望' : '', '', '']);
    SpreadsheetApp.flush();
    if (posuRows(sh, SHELF_H_.length).filter(function (r) { return r[0] === id; }).length !== 1) return { ok: false, errors: ['NOT_SAVED'], message: SHELF_ERROR_TEXT_.NOT_SAVED };
    return { ok: true, status: 'PENDING', receiptId: id, count: x.ids.length, message: '受け付けました。管理人が確認してから、テーマ選びやプレイリストの参考にします' };
  } finally { lock.releaseLock(); }
}
function handleShelfSubmit_(e, callback) {
  var p = (e && e.parameter) || {}, res = shelfSubmit_({ ids: p.ids, title: p.title, description: p.description, note: p.note, nick: p.nick, spotify: p.spotify, hp: p.website2 });
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
if (typeof module !== 'undefined') module.exports = { shelfValidate_: shelfValidate_, shelfClean_: shelfClean_, SHELF_H_: SHELF_H_ };
