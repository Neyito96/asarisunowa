// ポす神回（#312）COPY 試験の土台。本番 GAS には置かない。
// 置き場所: 清掃ロボ（COPY/V2作業用 GAS）に、scripts/google-apps-script/Posukami.js と一緒に別ファイルとして置く。
// 書くのは COPY スプレッドシートだけ。V2・統合台帳と朝リスPodcast一覧（公開API）は読むだけ。
var POSU_COPY_ID = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';
var POSU_FORBIDDEN_IDS = ['1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ', '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', '1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA'];
POSU_CFG_OVERRIDE = { spreadsheetId: POSU_COPY_ID, podcastApi: 'https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec?type=listenerPodcast' };
function posuGuardCopy_() { var c = posuCfg(); if (c.spreadsheetId !== POSU_COPY_ID || POSU_FORBIDDEN_IDS.indexOf(c.spreadsheetId) >= 0) throw new Error('POSU_TARGET_NOT_COPY'); return c; }
function posuLog_(fn, o) { Logger.log(fn + ' ' + JSON.stringify(o, null, 1)); return o; }

// 1) 紹介元の照合（読むだけ）。結果表は COPY「ポす・紹介回照合」
function POSU_C1_紹介回照合_READ_ONLY() {
  posuGuardCopy_();
  var res = posuIntroReport(), ss = SpreadsheetApp.openById(POSU_COPY_ID), sh = ss.getSheetByName('ポす・紹介回照合') || ss.insertSheet('ポす・紹介回照合'), rows = [];
  res.forEach(function (x) { (x.intros.length ? x.intros : x.candidates.length ? x.candidates : [null]).forEach(function (i) { rows.push([x.id, x.title, x.introduced, x.status, i ? i.ep : '', (i ? '［' + i.show + '］' + i.title : ''), i ? i.date : '', i ? i.evidence : '', i ? i.url : '']); }); });
  sh.clearContents(); sh.getRange(1, 1, 1, 9).setValues([['番組ID', '番組名', '紹介配信日', '判定', 'EP-ID', '回の題名', '回の配信日', '根拠', '公式個別URL']]);
  if (rows.length) sh.getRange(2, 1, rows.length, 9).setValues(rows);
  var by = {}, eps = posuDonutEpisodes(), byShow = {}; res.forEach(function (x) { by[x.status] = (by[x.status] || 0) + 1; }); eps.forEach(function (e) { var k = e.show + ' ' + String(e.date).slice(0, 7); byShow[k] = (byShow[k] || 0) + 1; });
  return posuLog_('POSU_C1_紹介回照合_READ_ONLY', { status: 'OK', podcasts: res.length, byStatus: by, introEpisodesByShowMonth: byShow, verified: res.filter(function (x) { return x.status === 'VERIFIED'; }).map(function (x) { return x.id + ' ' + x.title + ' → ' + x.intros.map(function (i) { return i.ep; }).join(','); }), notVerified: res.filter(function (x) { return x.status !== 'VERIFIED'; }).map(function (x) { return x.id + ' ' + x.title + '（' + x.status + (x.candidates.length ? ' 候補 ' + x.candidates.map(function (i) { return i.ep + ':' + i.evidence; }).join(',') : '') + '）'; }) });
}
// 2) 確定した紹介元だけを COPY の公開シートへ（一度だけ）
function POSU_C2_紹介回を公開シートへ_COPY() { posuGuardCopy_(); return posuLog_('POSU_C2_紹介回を公開シートへ_COPY', Object.assign({ status: 'OK' }, posuSyncIntros(posuIntroReport()))); }
// 3) 栃尾江美さんの実例2件を、利用者と同じ投稿の経路で COPY に投稿する（一次資料で確認済みのURL）
function POSU_C3_栃尾さん実例を投稿_COPY() {
  posuGuardCopy_();
  var pods = posuPodcasts(), p = pods.filter(function (x) { return x.title === 'クリエイティブの反対語'; })[0];
  if (!p) return posuLog_('POSU_C3_栃尾さん実例を投稿_COPY', { status: 'STOP_NO_PODCAST' });
  var a = posuSubmit({ podcastId: p.id, podcastTitle: p.title, url: 'https://omny.fm/shows/asahi/d20261116', relation: 'donut_guest', title: '（対話）自分に興味がある人と、自分なんてないと思う人　栃尾江美さん', date: '2026-11-16', note: 'ドーナツ EP-06739（V2・統合台帳で確認）', hp: '' });
  var b = posuSubmit({ podcastId: p.id, podcastTitle: p.title, url: 'https://podcasts.apple.com/jp/podcast/id1129707783?i=1000802141616', relation: 'kanda_guest', title: '#410 なんと同い年！　朝日新聞社・神田大介さん', date: '2026-11-16', note: 'クリエイティブの反対語（Apple のページで題名・ゲストを確認）', hp: '' });
  return posuLog_('POSU_C3_栃尾さん実例を投稿_COPY', { status: a.ok && b.ok ? 'OK' : 'CHECK', podcastId: p.id, donut: a, external: b });
}
// 4) 承認分を公開へ（COPY）。キューの「状態」を「承認」にした行だけが対象
function POSU_C4_承認分を公開へ_COPY() { posuGuardCopy_(); return posuLog_('POSU_C4_承認分を公開へ_COPY', posuApprove()); }
// 5) 公開シート → サイト用 JSON（読むだけ）。JSON は COPY「ポす神回・公開JSON」A1 に置く（リポジトリの生成スクリプトが使う）
function POSU_C5_公開JSON_READ_ONLY() {
  var c = posuGuardCopy_(), ss = SpreadsheetApp.openById(POSU_COPY_ID), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H), j = posuBuildPublic(posuRows(ps, POSU_PUBLIC_H.length), posuPodcasts(), {}, { generatedAt: new Date().toISOString() });
  var sh = ss.getSheetByName('ポす神回・公開JSON') || ss.insertSheet('ポす神回・公開JSON'); sh.clearContents(); sh.getRange(1, 1).setValue(JSON.stringify(j));
  return posuLog_('POSU_C5_公開JSON_READ_ONLY', { status: 'OK', cards: j.cards.map(function (x) { return x.podcastId + ' ' + x.podcastTitle + ' 紹介' + x.introductions.length + '・神回' + x.specials.length; }) });
}
// 6) 投稿の安全試験（COPY）: 正しい投稿 → 承認待ち、二重投稿の拒否、不正の拒否、未承認は公開データに出ない、承認後に一度だけ反映、再実行で増えない、最後に試験行を消して元に戻す
function POSU_T1_COPY試験() {
  var c = posuGuardCopy_(), ss = SpreadsheetApp.openById(POSU_COPY_ID), qs = posuSheet(ss, c.queueSheet, POSU_QUEUE_H), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H);
  var q0 = qs.getLastRow(), p0 = ps.getLastRow(), pods = posuPodcasts(), p = pods.filter(function (x) { return x.title === 'ファミレスで隣から聞こえてくるフリーランスのモヤモヤ話'; })[0], r = {};
  if (!p) return posuLog_('POSU_T1_COPY試験', { status: 'STOP_NO_PODCAST' });
  var base = { podcastId: p.id, podcastTitle: p.title, url: 'https://open.spotify.com/episode/3FB0Z8QZTrbvTgVYvblCqC', relation: 'other', title: '【試験】', date: '2026-10-20', note: 'POSU_T1 試験投稿（最後に消す）', hp: '' };
  var count = function () { return posuBuildPublic(posuRows(ps, POSU_PUBLIC_H.length), pods, {}, {}).cards.reduce(function (n, x) { return n + (x.podcastId === p.id ? x.specials.length : 0); }, 0); };
  var before = count();
  var a = posuSubmit(base); r.valid = a.ok ? 'OK（' + a.status + '・' + a.pageCheck + '）' : 'NG ' + a.errors;
  var d = posuSubmit(base); r.duplicate = !d.ok && d.errors.indexOf('DUPLICATE') >= 0 ? 'OK（拒否）' : 'NG';
  var s = posuSubmit(Object.assign({}, base, { url: 'https://open.spotify.com/show/5R6rbjVuiGiLXl7DYAsQ1M' })); r.showUrl = !s.ok && s.errors.indexOf('NOT_EPISODE_URL') >= 0 ? 'OK（拒否）' : 'NG';
  var u = posuSubmit(Object.assign({}, base, { podcastId: '9999' })); r.unknownPodcast = !u.ok && u.errors.indexOf('UNKNOWN_PODCAST') >= 0 ? 'OK（拒否）' : 'NG';
  var h = posuSubmit(Object.assign({}, base, { hp: 'http://spam' })); r.bot = !h.ok && h.errors.indexOf('BOT_SUSPECTED') >= 0 ? 'OK（拒否）' : 'NG';
  r.pendingNotPublic = count() === before ? 'OK（公開データに出ない）' : 'NG';
  var row = posuRows(qs, POSU_QUEUE_H.length).map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x[0] === a.receiptId; })[0];
  if (row) { qs.getRange(row.i + 2, 15).setValue(POSU_STATE.APPROVE); SpreadsheetApp.flush(); }
  var ap1 = posuApprove(), after1 = count(), ap2 = posuApprove(), after2 = count();
  r.approveOnce = ap1.published === 1 && after1 === before + 1 ? 'OK（1件反映）' : 'NG ' + JSON.stringify(ap1);
  r.rerunNoDup = ap2.published === 0 && after2 === after1 ? 'OK（再実行で増えない）' : 'NG ' + JSON.stringify(ap2);
  var again = posuSubmit(base); r.afterPublishDuplicate = !again.ok && again.errors.indexOf('DUPLICATE') >= 0 ? 'OK（掲載済みとして拒否）' : 'NG';
  // 後片付け（COPY の試験行だけ）
  var del = function (sh, col, val) { var v = posuRows(sh, col + 1); for (var i = v.length - 1; i >= 0; i--) if (v[i][col] === val) sh.deleteRow(i + 2); };
  del(ps, 12, a.receiptId); del(qs, 0, a.receiptId); SpreadsheetApp.flush();
  r.restored = qs.getLastRow() === q0 && ps.getLastRow() === p0 && count() === before ? 'OK（元に戻した）' : 'NG';
  var pass = Object.keys(r).every(function (k) { return /^OK/.test(r[k]); });
  return posuLog_('POSU_T1_COPY試験', { status: pass ? 'PASS' : 'FAIL', checks: r, note: 'COPY だけ。V2・本番シートは読むだけ' });
}

// 7) ポすすめ返しの候補探し（読むだけ）。Apple の番組IDが分かる番組だけ、公式の iTunes Search API で新しい50回を1回ずつ読む。結果は COPY「ポす・振り返り候補」（承認キューには入れない）
function POSU_C6_振り返り候補_READ_ONLY() {
  posuGuardCopy_();
  var pods = posuPodcasts(), rows = [], sum = { podcasts: pods.length, noAppleId: 0, checked: 0, withCandidates: 0, strong: 0, weak: 0 };
  pods.forEach(function (p) {
    var id = posuAppleShowId(p.apple); if (!id) { sum.noAppleId++; rows.push([p.id, p.title, p.introduced, '（Apple の番組IDが分からない）', '', '', '', '']); return; }
    var r = null; try { r = UrlFetchApp.fetch('https://itunes.apple.com/lookup?id=' + id + '&entity=podcastEpisode&limit=50&country=jp', { muteHttpExceptions: true }); } catch (e) { r = null; }
    Utilities.sleep(400); sum.checked++;
    var eps = r && r.getResponseCode() === 200 ? (JSON.parse(r.getContentText()).results || []).filter(function (x) { return x.wrapperType === 'podcastEpisode'; }).map(function (x) { return { title: x.trackName, description: x.description, published: x.releaseDate, url: x.trackViewUrl }; }) : [];
    var c = posuReplyCandidates(p, eps); if (c.length) sum.withCandidates++;
    c.forEach(function (x) { if (/^強/.test(x.strength)) sum.strong++; else sum.weak++; rows.push([p.id, p.title, p.introduced, x.title, x.date, x.strength, x.words, x.url]); });
    if (!c.length) rows.push([p.id, p.title, p.introduced, '（候補なし・新しい50回の範囲）', '', '', '', '']);
  });
  var ss = SpreadsheetApp.openById(POSU_COPY_ID), sh = ss.getSheetByName('ポす・振り返り候補') || ss.insertSheet('ポす・振り返り候補');
  sh.clearContents(); sh.getRange(1, 1, 1, 8).setValues([['番組ID', '番組名', '紹介配信日', '候補の回', '配信日', '強さ', '言及していた言葉', 'URL']]); if (rows.length) sh.getRange(2, 1, rows.length, 8).setValues(rows);
  return posuLog_('POSU_C6_振り返り候補_READ_ONLY', { status: 'OK', summary: sum, strongCandidates: rows.filter(function (r) { return /^強/.test(r[5]); }).map(function (r) { return r[0] + ' ' + r[1] + '｜' + r[4] + '｜' + String(r[3]).slice(0, 60); }), sheet: 'COPY「ポす・振り返り候補」', note: '候補だけ。カードに載せるには投稿→承認の通常の流れを通す' });
}
