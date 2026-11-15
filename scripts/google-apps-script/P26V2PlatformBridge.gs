// P26: P18/P19 → V2 橋渡し（2026-11-15 司令塔「第3優先 COPY予行承認」）。朝ポキ｜本番ロボGAS に置く追加ファイル。
// - 手動実行専用。トリガーは作らない・既存の P18/P19 の関数・設定・書き先には触れない。
// - 読む: V2正本「V2・統合台帳」（見出し名で列を引く）、旧本番の候補シート「P15_PLATFORM_CANDIDATES」（P19 が書く。読むだけ）。
// - 個別エピソードの確認: 既存の P15_PLATFORMS.resolve（P18 と同じ確認。GUID・音声・番組/配信日/再生時間の一致だけが VERIFIED）。
// - 書く: COPY の「V2・統合台帳」コピーだけ（ID 固定）。結果表も COPY に置く。V2正本・旧本番には書かない。
// 押す順: P26_1_照合_READ_ONLY（DONE まで繰り返す）→ P26_2_COPY反映_少数 → P26_3_再実行確認。保留の原因は P26_4_保留診断_READ_ONLY。
// 異常時: 停止旗で書込は止まる → P26_8_未完了の確認 → 原因確認後 P26_9_停止解除。
var P26_V2_ID_ = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';     // 読むだけ
var P26_V1_ID_ = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';     // 読むだけ（候補シート）
var P26_COPY_ID_ = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';   // 書き先はここだけ
var P26_LEDGER_ = 'V2・統合台帳', P26_CAND_ = 'P15_PLATFORM_CANDIDATES', P26_RESULT_ = 'P26・V2URL照合', P26_LOG_ = 'P26・COPY反映履歴';
var P26_SERVICES_ = { 'Spotify': 'Spotify', 'Apple Podcasts': 'Apple', 'Apple': 'Apple', 'Amazon Music': 'Amazon', 'Pocket Casts': 'Pocket Casts', 'LISTEN': 'LISTEN', 'Pody': 'Pody' };   // 候補の表記 → V2 の見出し
var P26_RESOLVE_NAME_ = { 'Spotify': 'Spotify', 'Apple': 'Apple Podcasts', 'Amazon': 'Amazon Music', 'Pocket Casts': 'Pocket Casts', 'LISTEN': 'LISTEN', 'Pody': 'Pody' };
var P26_RESULT_H_ = ['EP-ID', '番組', 'タイトル', 'サービス', '候補URL', 'V2の現在値', '判定', '確認根拠', '確認日時'];
var P26_LOG_H_ = ['日時', 'EP-ID', 'サービス', '変更前', '変更後', '確認根拠', '読み戻し'];
var P26_STATE_ = 'P26_STATE';

function p26Nz_(s) { return String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, ''); }
function p26Utc_(s) { if (Object.prototype.toString.call(s) === '[object Date]') return isNaN(s.getTime()) ? '' : s.toISOString(); var d; try { d = Utilities.parseDate(String(s || '').trim(), 'Asia/Tokyo', 'yyyy/M/d H:mm'); } catch (e) { return ''; } return d && !isNaN(d.getTime()) ? d.toISOString() : ''; }
function p26Read_(ss, name) { var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) throw new Error('P26_SHEET_MISSING:' + name); return { sh: sh, v: sh.getDataRange().getValues() }; }
function p26Cols_(h, names) { var o = {}; names.forEach(function (n) { o[n] = h.indexOf(n); if (o[n] < 0) throw new Error('P26_HEADER_MISSING:' + n); }); return o; }
function p26Copy_() { var c = SpreadsheetApp.openById(P26_COPY_ID_); if (c.getId() !== P26_COPY_ID_ || c.getId() === P26_V2_ID_ || c.getId() === P26_V1_ID_) throw new Error('P26_TARGET_NOT_COPY'); return c; }
var P26_NEED_ = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '公式GUID', '音声URL', '再生時間 秒', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody'];

// 候補を V2 の行に結ぶ（番組＋題名の完全一致・1件だけ）。空欄の枠だけを確認対象にする。既存URLと違えば保留。
function p26Plan_(ledger, cand) {
  var h = ledger[0], c = p26Cols_(h, P26_NEED_), byKey = {}, out = [];
  ledger.slice(1).forEach(function (r) { if (!String(r[c['EP-ID']]).trim()) return; var k = p26Nz_(r[c['番組']]) + '\u001f' + p26Nz_(r[c['タイトル']]); (byKey[k] = byKey[k] || []).push(r); });
  var ch = cand[0], cc = p26Cols_(ch, ['SHOW', 'SERVICE', 'LABEL', 'URL']);
  cand.slice(1).forEach(function (x) {
    var service = P26_SERVICES_[String(x[cc.SERVICE]).trim()], url = String(x[cc.URL]).trim(), ms = byKey[p26Nz_(x[cc.SHOW]) + '\u001f' + p26Nz_(x[cc.LABEL])] || [];
    if (!service || !url || ms.length !== 1) return;   // 一致なし・複数一致は対象外（照合表には出さない＝空欄補完の候補ではない）
    var r = ms[0], cur = String(r[c[service]] || '').trim();
    if (cur === url) return;   // 既に同じURL
    out.push({ ep: String(r[c['EP-ID']]).trim(), show: String(r[c['番組']]), title: String(r[c['タイトル']]), service: service, url: url, current: cur,
      source: { guid: String(r[c['公式GUID']]).trim().toLowerCase(), show: String(r[c['番組']]), title: String(r[c['タイトル']]), published: p26Utc_(r[c['配信日時 JST']]), audio: String(r[c['音声URL']] || ''), duration: Number(r[c['再生時間 秒']]) || 0 } });
  });
  return out;
}
function p26Verify_(p, ctx) {
  if (p.current) return { verdict: '保留: V2に別のURLがある（上書きしない）', basis: '' };
  if (!p.source.guid) return { verdict: '保留: V2の公式GUIDが空', basis: '' };
  var name = P26_RESOLVE_NAME_[p.service], o;
  try { o = P15_PLATFORMS.resolve(p.source, { references: [{ guid: p.source.guid, service: name, url: p.url }], context: ctx, deferred: {}, existing: {}, directories: [] }); }
  catch (e) { return { verdict: '保留: 確認エラー', basis: String(e).slice(0, 80) }; }
  var d = (o.results || []).filter(function (x) { return x.service === name; })[0], links = o.links || {}, hit = Object.keys(links).some(function (k) { return links[k] === p.url; }) || (d && d.url === p.url);
  if (d && d.state === 'VERIFIED' && hit) return { verdict: 'VERIFIED', basis: (d.method || d.reason || 'VERIFIED') + (d.evidence ? ' ' + String(JSON.stringify(d.evidence)).slice(0, 120) : '') };
  return { verdict: '保留: ' + (d ? d.state + ' ' + (d.reason || '') : 'NO_RESULT'), basis: d && d.evidence ? String(JSON.stringify(d.evidence)).slice(0, 120) : '' };
}
function P26_1_照合_READ_ONLY() {
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), st = JSON.parse(P.getProperty(P26_STATE_) || 'null');
  var ledger = p26Read_(SpreadsheetApp.openById(P26_V2_ID_), P26_LEDGER_).v, cand = p26Read_(SpreadsheetApp.openById(P26_V1_ID_), P26_CAND_).v, plan = p26Plan_(ledger, cand), copy = p26Copy_();
  var sh = copy.getSheetByName(P26_RESULT_);
  if (!st || !sh) { sh = sh || copy.insertSheet(P26_RESULT_); sh.clearContents(); sh.getRange(1, 1, 1, P26_RESULT_H_.length).setValues([P26_RESULT_H_]); st = { cursor: 0, total: plan.length }; }
  var ctx = { remaining: 12, deadline: Date.now() + 240000, cache: {} }, rows = [], i = st.cursor;
  for (; i < plan.length && Date.now() - t0 < 240000; i++) { ctx.remaining = Math.max(ctx.remaining, 3); var p = plan[i], v = p26Verify_(p, ctx); if (/BUDGET_DEFERRED|DEFERRED/.test(v.verdict)) break; rows.push([p.ep, p.show, p.title, p.service, p.url, p.current, v.verdict, v.basis, new Date().toISOString()]); }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, P26_RESULT_H_.length).setNumberFormat('@').setValues(rows);
  st.cursor = i; var done = i >= plan.length; if (done) P.deleteProperty(P26_STATE_); else P.setProperty(P26_STATE_, JSON.stringify(st));
  var res = { status: done ? 'DONE' : 'PARTIAL_RESUME_NEEDED', candidates: plan.length, checked: i, readFrom: 'V2 ' + P26_V2_ID_ + ' / 候補 ' + P26_V1_ID_ + '（読むだけ）', wroteTo: 'COPY ' + P26_COPY_ID_ + ' 「' + P26_RESULT_ + '」', ms: Date.now() - t0 };
  Logger.log('P26_1_照合_READ_ONLY ' + JSON.stringify(res)); return res;
}
// ===== 書込（上限・停止・同時実行の管理。2026-11-15 司令塔「上限管理の強化」）=====
// 上限は「書き先ごとの累計」。数えるのは履歴シートの行（取消していない行）。書く前に履歴へ PENDING 行を先に足して予約し、
// 予約の後に数え直して上限を超えていれば書かずに取消。途中で止まっても PENDING 行が上限に数えられるので、再実行で上限を超えない。
// 同時実行はスクリプトロック（実行全体で保持）で1本に絞る。読み戻しが合わない・例外が出たら停止旗 P26_STOP=YES を立てて以後の書込を拒否。
var P26_TARGETS_ = {
  COPY: { id: P26_COPY_ID_, log: P26_LOG_, cap: 3 },
  // 本番V2: 承認後にだけ有効にする（P26_V2_WRITE_ENABLED_ を true にするコード変更＝承認の印）。上限は承認時に決める。
  V2: { id: P26_V2_ID_, log: 'P26・V2反映履歴', cap: 0 }
};
var P26_V2_WRITE_ENABLED_ = false;
function p26Stop_(why) { PropertiesService.getScriptProperties().setProperty('P26_STOP', 'YES'); PropertiesService.getScriptProperties().setProperty('P26_STOP_WHY', String(why).slice(0, 200)); }
function p26LogSheet_(copy, name) { var log = copy.getSheetByName(name) || copy.insertSheet(name); if (log.getLastRow() === 0) log.getRange(1, 1, 1, 8).setValues([P26_LOG_H_.concat(['取消'])]); return log; }
function p26LogRows_(log) { return log.getLastRow() > 1 ? log.getRange(2, 1, log.getLastRow() - 1, 8).getValues() : []; }
function p26Used_(rows) { return rows.filter(function (x) { return !String(x[7] || '').trim(); }).length; }   // PENDING も数える
function p26Write_(mode) {
  var P = PropertiesService.getScriptProperties(), T = P26_TARGETS_[mode];
  if (!T) throw new Error('P26_UNKNOWN_TARGET');
  if (mode === 'V2' && (!P26_V2_WRITE_ENABLED_ || !(T.cap > 0))) return { status: 'V2_WRITE_NOT_APPROVED', wrote: [] };
  if (mode !== 'V2' && T.id !== P26_COPY_ID_) throw new Error('P26_TARGET_NOT_COPY');
  if (P.getProperty('P26_STOP') === 'YES') return { status: 'STOPPED', why: P.getProperty('P26_STOP_WHY') || '', wrote: [] };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED', wrote: [] };
  try {
    var copy = p26Copy_(), target = mode === 'V2' ? SpreadsheetApp.openById(P26_V2_ID_) : copy;
    var r = p26Read_(copy, P26_RESULT_).v, led = p26Read_(target, P26_LEDGER_), c = p26Cols_(led.v[0], P26_NEED_), log = p26LogSheet_(copy, T.log), rows = p26LogRows_(log);
    if (rows.some(function (x) { return x[6] === 'PENDING' && !String(x[7] || '').trim(); })) return { status: 'PENDING_EXISTS', note: '先に P26_8_未完了の確認', wrote: [] };
    var done = {}; rows.forEach(function (x) { done[x[1] + '/' + x[2]] = 1; });
    if (p26Used_(rows) >= T.cap) return { status: 'CAP_REACHED', used: p26Used_(rows), max: T.cap, wrote: [] };
    var rowOf = {}; led.v.forEach(function (x, i) { if (i) rowOf[String(x[c['EP-ID']]).trim()] = i + 1; });
    var wrote = [], skipped = [];
    for (var i = 1; i < r.length; i++) {
      var ep = r[i][0], service = r[i][3], url = r[i][4]; if (r[i][6] !== 'VERIFIED' || done[ep + '/' + service]) continue;
      var rn = rowOf[ep]; if (!rn) { skipped.push(ep + ':行なし'); continue; }
      if (String(led.sh.getRange(rn, c['EP-ID'] + 1).getValue()).trim() !== ep) { p26Stop_('ROW_SHIFTED ' + ep); return { status: 'STOPPED_ROW_SHIFTED', wrote: wrote }; }
      // 1) 予約（PENDING 行）→ 2) 数え直し（上限を超えたら取消して終了）
      log.appendRow([new Date().toISOString(), ep, service, '', url, r[i][7], 'PENDING', '']); SpreadsheetApp.flush();
      var at = log.getLastRow(), all = p26LogRows_(log);
      if (p26Used_(all) > T.cap) { log.getRange(at, 8).setValue('取消: 上限超過のため書かない'); return { status: 'CAP_REACHED', wrote: wrote, skipped: skipped }; }
      // 3) 書く直前に空欄を確かめる（既存URLは変えない）
      var cell = led.sh.getRange(rn, c[service] + 1), before = String(cell.getValue() || '').trim();
      if (before) { log.getRange(at, 4).setValue(before); log.getRange(at, 8).setValue('取消: 既存値あり（変更しない）'); skipped.push(ep + '/' + service + ':既存値'); continue; }
      try { cell.setValue(url); SpreadsheetApp.flush(); } catch (e) { log.getRange(at, 7).setValue('ERROR'); p26Stop_('WRITE_ERROR ' + ep + ' ' + e); return { status: 'STOPPED_WRITE_ERROR', wrote: wrote }; }
      var back = String(led.sh.getRange(rn, c[service] + 1).getValue());
      log.getRange(at, 7).setValue(back === url ? 'OK' : 'MISMATCH');
      if (back !== url) { p26Stop_('READBACK_MISMATCH ' + ep + '/' + service); return { status: 'STOPPED_READBACK_MISMATCH', wrote: wrote }; }
      wrote.push({ ep: ep, service: service, before: before, after: url, readBack: true });
      if (p26Used_(p26LogRows_(log)) >= T.cap) break;
    }
    return { status: 'OK', wrote: wrote, skipped: skipped, target: mode + ' ' + T.id };
  } finally { lock.releaseLock(); }
}
function P26_2_COPY反映_少数() { var res = p26Write_('COPY'); Logger.log('P26_2_COPY反映_少数 ' + JSON.stringify(res)); return res; }
// 途中で止まった PENDING 行の後始末（書き先のセルを見て、URLが入っていれば OK、空欄なら取消、別の値なら停止）
function P26_8_未完了の確認(mode) {
  mode = mode || 'COPY'; var T = P26_TARGETS_[mode], copy = p26Copy_(), log = p26LogSheet_(copy, T.log), rows = p26LogRows_(log), target = mode === 'V2' ? SpreadsheetApp.openById(P26_V2_ID_) : copy;
  var led = p26Read_(target, P26_LEDGER_), c = p26Cols_(led.v[0], P26_NEED_), rowOf = {}, fixed = [];
  led.v.forEach(function (x, i) { if (i) rowOf[String(x[c['EP-ID']]).trim()] = i; });
  rows.forEach(function (x, k) { if (x[6] !== 'PENDING' || String(x[7] || '').trim()) return; var i = rowOf[x[1]], cur = i ? String(led.v[i][c[x[2]]] || '').trim() : '';
    if (cur === String(x[4])) { log.getRange(k + 2, 7).setValue('OK'); fixed.push(x[1] + ':OK'); }
    else if (!cur) { log.getRange(k + 2, 8).setValue('取消: 書く前に止まった'); fixed.push(x[1] + ':取消'); }
    else { log.getRange(k + 2, 7).setValue('MISMATCH'); p26Stop_('PENDING_MISMATCH ' + x[1]); fixed.push(x[1] + ':MISMATCH'); } });
  var res = { status: 'OK', fixed: fixed }; Logger.log('P26_8_未完了の確認 ' + JSON.stringify(res)); return res;
}
// 停止旗を外す（原因を確かめた後に人が押す）
function P26_9_停止解除() { var P = PropertiesService.getScriptProperties(), was = P.getProperty('P26_STOP_WHY'); P.deleteProperty('P26_STOP'); P.deleteProperty('P26_STOP_WHY'); Logger.log('P26_9_停止解除 ' + was); return { status: 'CLEARED', was: was }; }
// 保留の診断（読むだけ。結果は COPY の「P26・保留診断」）: 候補ページから読めた番組名・題名・配信時刻・長さ・GUID を、V2 の値と並べる
function P26_4_保留診断_READ_ONLY() {
  var copy = p26Copy_(), r = p26Read_(copy, P26_RESULT_).v, ledger = p26Read_(SpreadsheetApp.openById(P26_V2_ID_), P26_LEDGER_).v, cand = p26Read_(SpreadsheetApp.openById(P26_V1_ID_), P26_CAND_).v, plan = p26Plan_(ledger, cand);
  var sh = copy.getSheetByName('P26・保留診断') || copy.insertSheet('P26・保留診断'), H = ['EP-ID', 'サービス', '判定', 'ページの番組名', 'V2の番組名', '番組一致', '題名一致', '配信時刻の差(秒)', '長さの差(秒)', 'GUIDあり', 'HTTP/理由'], out = [], ctx = { remaining: 40, deadline: Date.now() + 240000, cache: {} };
  sh.clearContents(); sh.getRange(1, 1, 1, H.length).setValues([H]);
  r.slice(1).filter(function (x) { return x[6] !== 'VERIFIED' && !/別のURL/.test(x[6]); }).forEach(function (x) {
    var p = plan.filter(function (q) { return q.ep === x[0] && q.service === x[3]; })[0]; if (!p || Date.now() > ctx.deadline) return;
    var page = P15_PLATFORMS.fetchPage(p.url, ctx), rec = page && page.html ? P15_PLATFORMS.parsePage(page.html, page.url, p.source) : null;
    if (!rec) { out.push([x[0], x[3], x[6], '', p.source.show, '', '', '', '', '', page ? (page.reason || page.http || 'PARSE_NULL') : 'NO_PAGE']); return; }
    var dt = Date.parse(rec.published) - Date.parse(p.source.published);
    out.push([x[0], x[3], x[6], String(rec.show || ''), p.source.show, String(rec.show || '') === p.source.show ? 'はい' : 'いいえ', p26Nz_(rec.title) === p26Nz_(p.source.title) ? 'はい' : 'いいえ', isFinite(dt) ? Math.round(dt / 1000) : '', rec.duration != null && p.source.duration ? Math.round(Number(rec.duration) - p.source.duration) : '', rec.guid ? 'はい' : 'いいえ', page.http || '']);
  });
  if (out.length) sh.getRange(2, 1, out.length, H.length).setNumberFormat('@').setValues(out);
  var res = { status: 'OK', diagnosed: out.length }; Logger.log('P26_4_保留診断_READ_ONLY ' + JSON.stringify(res)); return res;
}
// 再実行の確認: COPY の台帳コピーに対して計画をもう一度立て、書いた枠が「既に同じURL」になって対象から外れること・他のセルが変わっていないことを見る（書かない）
function P26_3_再実行確認() {
  var copy = p26Copy_(), led = p26Read_(copy, P26_LEDGER_).v, cand = p26Read_(SpreadsheetApp.openById(P26_V1_ID_), P26_CAND_).v, plan = p26Plan_(led, cand);
  var log = copy.getSheetByName(P26_LOG_), written = (log && log.getLastRow() > 1 ? log.getRange(2, 1, log.getLastRow() - 1, 8).getValues() : []).filter(function (w) { return !String(w[7] || '').trim(); });   // 取消した行は除く
  var still = written.filter(function (w) { return plan.some(function (p) { return p.ep === w[1] && p.service === w[2]; }); });
  var unchanged = written.filter(function (w) { var rn = -1; led.forEach(function (x, i) { if (i && String(x[led[0].indexOf('EP-ID')]).trim() === w[1]) rn = i; }); return rn > 0 && String(led[rn][led[0].indexOf(w[2])]) === String(w[4]); }).length;
  var res = { status: still.length || unchanged !== written.length ? 'NG' : 'OK', writtenSlots: written.length, stillEqualInCopy: unchanged, replannedForWrittenSlots: still.length, planNow: plan.length }; Logger.log('P26_3_再実行確認 ' + JSON.stringify(res)); return res;
}
