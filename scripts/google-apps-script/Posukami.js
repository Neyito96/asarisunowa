// Posukami.js — 「ポすすめ」から「ポす神回」へ（Issue #312）。本番GASへの配置・本番シートへの書込は管理人の承認後。
// ここにあるもの:
//   1) 紹介元ドーナツ回の照合（V2・統合台帳のドーナツ「（ポすすめ）」「（日曜版）」回 × 朝リスPodcast一覧）… 読むだけ
//   2) ポす神回の投稿受付（type=posukamiSubmit・JSONP）… 既存の新規番組登録（listenerPodcast）とは別の経路・別シート
//   3) 承認キュー → 公開シート（承認された行だけ・一度だけ）
//   4) 公開シート → サイト用 JSON（public/posusume/posukami.json の元）
// 安全: 未承認は公開しない。同じURLは二重に受け付けない。番組は新規作成しない（既存の番組ID＋番組名の一致が必須）。
// GAS は全ファイルが同じ名前空間なので、名前はすべて posu / POSU で始める。Node のテストからは module.exports で読む。

var POSU_VERSION = 'POSU-1';
var POSU_QUEUE_H = ['受付ID', '受付日時', '番組ID', '番組名', 'URL', '照合キー', '交流の種類', 'タイトル（投稿）', '配信日（投稿）', '補足', '検出タイトル', '検出配信日', 'ページ確認', '関係の手がかり', '状態', '判断メモ', '反映日時'];
var POSU_PUBLIC_H = ['種別', '番組ID', '番組名', 'タイトル', '回の番組名', '配信日', 'URL', '交流の種類', 'EP-ID', '確認日', '根拠', '照合キー', '受付ID'];
var POSU_RELATIONS = { donut_guest: 'ドーナツに番組の配信者が出演', kanda_guest: 'この番組に神田さん等が出演', other: 'その他の交流' };
var POSU_STATE = { PENDING: '承認待ち', APPROVE: '承認', REJECT: '却下', DONE: '反映済み' };
var POSU_LIMITS = { pendingPerPodcast: 5, pendingTotal: 60, title: 200, note: 500 };

function posuNz(s) { return String(s == null ? '' : s).normalize('NFKC').replace(/[\s​-‍﻿]+/g, '').toLowerCase(); }
// 番組名の芯（区切り記号の前）。3文字未満なら使わない
function posuCore(title) { var t = String(title || '').normalize('NFKC').split(/\s[—–-]\s|[—–|｜（(【\[:：]/)[0].trim(); return posuNz(t).length >= 3 ? posuNz(t) : ''; }
// 'YYYY/MM/DD HH:mm'（JST）・'YYYY-MM-DD'・'YYYY.MM.DD' → 'YYYY-MM-DD'
function posuDay(s) { var m = String(s || '').match(/(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }
function posuDayDiff(a, b) { var x = Date.parse(posuDay(a) + 'T00:00:00Z'), y = Date.parse(posuDay(b) + 'T00:00:00Z'); return isFinite(x) && isFinite(y) ? Math.round(Math.abs(x - y) / 86400000) : Infinity; }
function posuIsIntroEpisode(title) { var t = String(title || '').normalize('NFKC'); return /\(ポすすめ\)|\(日曜版\)/.test(t); }

// ===== 1) 紹介元ドーナツ回の照合 =====
// podcasts: [{ id, title, maker, introduced }]、eps: [{ ep, title, date(JST), summary, status(掲載判定), url(公式個別URL) }]（ドーナツだけ）
// 確定（VERIFIED）= 番組名（全体か芯）が回の題名か概要に含まれる ＋ 回の配信日が紹介配信日の±1日 ＋ 掲載判定が除外でない。
// 番組名だけ・日付だけの一致は HOLD（候補として残し、リンクは出さない）。複数の回が確定なら全部出す。
function posuIntroMatch(podcasts, eps) {
  var intro = eps.filter(function (e) { return posuIsIntroEpisode(e.title) && !/除外|対象外/.test(String(e.status || '')); });
  return podcasts.map(function (p) {
    var full = posuNz(p.title), core = posuCore(p.title), maker = posuNz(p.maker), out = { id: String(p.id), title: p.title, introduced: p.introduced, status: 'NOT_FOUND', intros: [], candidates: [] };
    intro.forEach(function (e) {
      var hay = posuNz(e.title) + '\u0001' + posuNz(e.summary), ev = [];
      if (full.length >= 3 && hay.indexOf(full) >= 0) ev.push('番組名一致'); else if (core && hay.indexOf(core) >= 0) ev.push('番組名（芯）一致');
      var dd = posuDayDiff(e.date, p.introduced); if (dd <= 1) ev.push(dd === 0 ? '紹介日一致' : '紹介日±1日');
      if (maker.length >= 2 && hay.indexOf(maker) >= 0) ev.push('配信者名一致');
      var titleHit = ev.some(function (x) { return /^番組名/.test(x); }), dayHit = dd <= 1;
      var rec = { ep: e.ep, show: e.show || '', title: e.title, date: posuDay(e.date), url: e.url || '', evidence: ev.join('・') };
      if (titleHit && dayHit) out.intros.push(rec); else if (titleHit || (dayHit && ev.length)) out.candidates.push(rec);
    });
    out.status = out.intros.length ? 'VERIFIED' : out.candidates.length ? 'HOLD' : 'NOT_FOUND';
    return out;
  });
}

// ===== 2) 投稿の検証 =====
// エピソード個別URLだけを受け付ける（番組トップは不可）。照合キーは「同じ回」を表す正規化URL
function posuEpisodeUrl(raw) {
  var s = String(raw || '').trim(), m;
  if (!/^https:\/\//i.test(s) || s.length > 600) return null;
  var u = s.replace(/#.*$/, ''), host = (u.match(/^https:\/\/([^\/?]+)/i) || [])[1].toLowerCase().replace(/^www\./, '');
  var path = u.replace(/^https:\/\/[^\/?]+/i, '').replace(/\?.*$/, ''), q = (u.match(/\?(.*)$/) || [])[1] || '';
  var param = function (k) { var x = q.match(new RegExp('(?:^|&)' + k + '=([^&]+)')); return x ? decodeURIComponent(x[1]) : ''; };
  if (host === 'open.spotify.com' && (m = path.match(/^\/(?:intl-[a-z]+\/)?episode\/([A-Za-z0-9]{22})/))) return { service: 'Spotify', key: 'spotify:' + m[1] };
  if (host === 'podcasts.apple.com' && /\/id\d+/.test(path) && /^\d+$/.test(param('i'))) return { service: 'Apple Podcasts', key: 'apple:' + param('i') };
  if (host === 'listen.style' && (m = path.match(/^\/p\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/?$/))) return { service: 'LISTEN', key: 'listen:' + m[1] + '/' + m[2] };
  if (host === 'pca.st' && (m = path.match(/^\/episode\/([0-9a-f-]{36})$/i))) return { service: 'Pocket Casts', key: 'pocketcasts:' + m[1].toLowerCase() };
  if (host === 'pody.jp' && (m = path.match(/^\/player\/([A-Za-z0-9]{20})\/([A-Za-z0-9]{20})$/))) return { service: 'Pody', key: 'pody:' + m[2] };
  if (/^music\.amazon\.[a-z.]+$/.test(host) && (m = path.match(/^\/podcasts\/[0-9a-f-]{36}\/episodes\/([0-9a-f-]{36})/i))) return { service: 'Amazon Music', key: 'amazon:' + m[1].toLowerCase() };
  if (host === 'omny.fm' && (m = path.match(/^\/shows\/([^\/]+)\/([^\/]+)\/?$/)) && m[2] !== 'playlists') return { service: 'Omny', key: 'omny:' + m[1] + '/' + m[2] };
  if (host === 'youtube.com' && path === '/watch' && /^[A-Za-z0-9_-]{11}$/.test(param('v'))) return { service: 'YouTube', key: 'youtube:' + param('v') };
  if (host === 'youtu.be' && (m = path.match(/^\/([A-Za-z0-9_-]{11})$/))) return { service: 'YouTube', key: 'youtube:' + m[1] };
  if (host === 'stand.fm' && (m = path.match(/^\/episodes\/([A-Za-z0-9]+)$/))) return { service: 'stand.fm', key: 'standfm:' + m[1] };
  if (host === 'asahi.com' && path === '/special/podcasts/item/' && /^[0-9a-f-]{36}$/i.test(param('itemid'))) return { service: '朝日新聞', key: 'asahi:' + param('itemid').toLowerCase() };
  return null;
}
// sub: { podcastId, podcastTitle, url, relation, title, date, note, hp }、podcasts: [{id,title}]、taken: {照合キー: true}（キュー〈却下以外〉と公開の両方）、pending: {番組ID: 件数, _total: 件数}
function posuValidate(sub, podcasts, taken, pending) {
  var errors = [], p = null, e = posuEpisodeUrl(sub.url);
  if (String(sub.hp || '').trim()) errors.push('BOT_SUSPECTED');
  podcasts.forEach(function (x) { if (String(x.id) === String(sub.podcastId)) p = x; });
  if (!p) errors.push('UNKNOWN_PODCAST'); else if (posuNz(p.title) !== posuNz(sub.podcastTitle)) errors.push('PODCAST_TITLE_MISMATCH');
  if (!e) errors.push('NOT_EPISODE_URL');
  if (!POSU_RELATIONS[sub.relation]) errors.push('BAD_RELATION');
  if (String(sub.title || '').length > POSU_LIMITS.title || String(sub.note || '').length > POSU_LIMITS.note) errors.push('TOO_LONG');
  if (sub.date && !posuDay(sub.date)) errors.push('BAD_DATE');
  var key = e ? e.key + '|' + String(sub.podcastId) : '';
  if (key && taken[key]) errors.push('DUPLICATE');
  if (p && (pending[String(p.id)] || 0) >= POSU_LIMITS.pendingPerPodcast) errors.push('TOO_MANY_PENDING');
  if ((pending._total || 0) >= POSU_LIMITS.pendingTotal) errors.push('QUEUE_FULL');
  return { ok: !errors.length, errors: errors, key: key, service: e ? e.service : '', podcast: p };
}
// ページの題名・配信日（og:title・JSON-LD・<title>）。読めなければ空
function posuPageMeta(html) {
  var h = String(html || ''), pick = function (re) { var m = h.match(re); return m ? posuUnesc(m[1]).trim() : ''; };
  var title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) || pick(/"name"\s*:\s*"([^"]{2,300})"\s*,\s*"@type"\s*:\s*"PodcastEpisode"/) || pick(/"@type"\s*:\s*"PodcastEpisode"[^}]*?"name"\s*:\s*"([^"]{2,300})"/) || pick(/<title[^>]*>([^<]{2,300})<\/title>/i);
  var date = posuDay(pick(/"datePublished"\s*:\s*"([^"]+)"/) || pick(/property=["'](?:article:published_time|music:release_date)["'][^>]+content=["']([^"']+)/i));
  return { title: title, date: date };
}
function posuUnesc(s) { return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u0026/g, '&'); }
// 関係の手がかり（判断材料。自動承認には使わない）
function posuRelationHints(sub, meta, html, podcast) {
  var hay = posuNz(meta.title) + '\u0001' + posuNz(String(html || '').slice(0, 400000)), hints = [];
  if (podcast && hay.indexOf(posuNz(podcast.title)) >= 0) hints.push('ページに番組名');
  if (podcast && podcast.maker && posuNz(podcast.maker).length >= 2 && hay.indexOf(posuNz(podcast.maker)) >= 0) hints.push('ページに配信者名');
  if (/神田大介|神田さん|朝ポキ|朝日新聞ポッドキャスト/.test(String(meta.title) + String(html || '').slice(0, 400000))) hints.push('ページに神田さん・朝ポキ');
  return hints.length ? hints.join('・') : '手がかりなし（要確認）';
}

// ===== 3) 承認 → 公開（一度だけ）=====
// queue: 行の配列（POSU_QUEUE_H の順）、publicKeys: {照合キー: true}。戻り値: 公開シートに足す行と、キューの状態更新
function posuApprovePlan(queue, publicKeys, podcasts, nowIso) {
  var add = [], updates = [], seen = {};
  queue.forEach(function (r, i) {
    if (String(r[14]).trim() !== POSU_STATE.APPROVE) return;
    var key = String(r[5]);
    if (publicKeys[key] || seen[key]) { updates.push({ index: i, state: POSU_STATE.DONE, memo: '既に公開済み（二重反映しない）' }); return; }
    var p = null; podcasts.forEach(function (x) { if (String(x.id) === String(r[2])) p = x; });
    if (!p || posuNz(p.title) !== posuNz(r[3])) { updates.push({ index: i, state: POSU_STATE.PENDING, memo: '番組が見つからない・番組名が変わった（要確認）' }); return; }
    seen[key] = 1;
    var ep = (String(r[15]) + ' ' + String(r[9])).match(/EP-\d{5}/), program = r[6] === 'donut_guest' ? 'ドーナツ' : r[6] === 'kanda_guest' ? String(r[3]) : '';   // 蔵の回なら 判断メモ か 補足 に書いた EP-ID を使う
    add.push(['SPECIAL', String(r[2]), r[3], String(r[7]).trim() || String(r[10]).trim(), program, posuDay(r[8]) || posuDay(r[11]), r[4], r[6], ep ? ep[0] : '', posuDay(nowIso), '承認（' + r[0] + '）・' + r[12] + '・' + r[13], key, r[0]]);
    updates.push({ index: i, state: POSU_STATE.DONE, memo: '' });
  });
  return { add: add, updates: updates };
}

// ===== 4) 公開シート → サイト用 JSON =====
// rows: 公開シートの行（見出しを除く）、libraryIds: 公開中の蔵にある EP-ID の集合（{EP-ID: true}）。蔵に無い回は公式ページへ
function posuBuildPublic(rows, podcasts, libraryIds, opts) {
  var o = opts || {}, cards = {}, seen = {};
  podcasts.forEach(function (p) { cards[String(p.id)] = { podcastId: String(p.id), podcastTitle: p.title, introductions: [], specials: [] }; });
  rows.forEach(function (r) {
    var kind = String(r[0]).trim(), id = String(r[1]).trim(), c = cards[id], key = String(r[11] || (kind + '|' + id + '|' + r[6]));
    if (!c || posuNz(c.podcastTitle) !== posuNz(r[2]) || seen[key]) return;   // 番組名が違えばカードに付けない（取り違え防止）
    var ep = String(r[8] || '').trim(), inLib = ep && libraryIds[ep];
    var href = inLib ? '/library/?ep=' + ep : String(r[6] || '').trim();
    if (!/^https:\/\/|^\/library\/\?ep=EP-\d{5}$/.test(href)) return;
    seen[key] = 1;
    var item = { title: String(r[3]), date: posuDay(r[5]), href: href, library: !!inLib, epId: ep, verifiedAt: posuDay(r[9]) };
    if (kind === 'INTRO') c.introductions.push(item);
    else if (kind === 'SPECIAL') { item.program = String(r[4] || '') || (ep ? 'ドーナツ' : ''); item.relation = POSU_RELATIONS[r[7]] || String(r[7] || ''); c.specials.push(item); }
  });
  var list = Object.keys(cards).map(function (k) { return cards[k]; }).filter(function (c) { return c.introductions.length || c.specials.length; });
  list.forEach(function (c) { c.introductions.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); c.specials.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
  return { schema: 1, version: POSU_VERSION, generatedAt: o.generatedAt || '', submitEnabled: !!o.submitEnabled, cards: list };
}

// ===== GAS 側（シート・UrlFetch・Lock）=====
var POSU_CFG_OVERRIDE;   // COPY 試験の土台（PosukamiCopyHarness.js）だけが値を入れる。初期値を書かない（ファイルの読み込み順で上書きを消さないため）
function posuCfg() {
  var base = { spreadsheetId: (typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : ''), podcastSheet: (typeof LISTENER_PODCAST_SHEET_NAME !== 'undefined' ? LISTENER_PODCAST_SHEET_NAME : '朝リスPodcast'), queueSheet: 'ポす神回・投稿キュー', publicSheet: 'ポす神回・公開', ledgerId: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', ledgerSheet: 'V2・統合台帳', podcastApi: '' };
  if (typeof POSU_CFG_OVERRIDE !== 'undefined' && POSU_CFG_OVERRIDE) for (var k in POSU_CFG_OVERRIDE) base[k] = POSU_CFG_OVERRIDE[k];
  return base;
}
function posuSheet(ss, name, header) { var sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, header.length).setValues([header]); sh.setFrozenRows(1); } return sh; }
function posuRows(sh, width) { var n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, width).getDisplayValues() : []; }
// 朝リスPodcast一覧（既存の公開APIと同じ並び＝ID）。COPY 試験では公開APIを読むだけ
function posuPodcasts() {
  var c = posuCfg();
  if (c.podcastApi) { var j = JSON.parse(UrlFetchApp.fetch(c.podcastApi, { muteHttpExceptions: true }).getContentText()); return (j.items || []).map(function (x) { return { id: String(x.id), title: x.title, maker: x.maker, introduced: x.introduced }; }); }
  var sh = SpreadsheetApp.openById(c.spreadsheetId).getSheetByName(c.podcastSheet), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 4).getDisplayValues().filter(function (r) { return r[0] || r[1]; }).map(function (r, i) { return { id: String(i + 1), title: r[1], maker: r[2], introduced: r[3] }; });   // readListenerPodcastSheet と同じ ID の振り方
}
// 紹介回の候補: 題名に（ポすすめ）か（日曜版）が付く回。ドーナツ開始（2026-08-17）より前の（日曜版）は別の番組名で台帳に入っているため、番組で絞らない
function posuDonutEpisodes() {
  var c = posuCfg(), v = SpreadsheetApp.openById(c.ledgerId).getSheetByName(c.ledgerSheet).getDataRange().getDisplayValues(), h = v[0], ix = {};
  ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '概要（清掃済）', '公式個別URL', '旧元ページURL'].forEach(function (n) { ix[n] = h.indexOf(n); if (ix[n] < 0) throw new Error('POSU_HEADER_MISSING:' + n); });
  return v.slice(1).filter(function (r) { return String(r[ix['EP-ID']]).trim() && posuIsIntroEpisode(r[ix['タイトル']]); }).map(function (r) { return { ep: r[ix['EP-ID']], show: r[ix['番組']], title: r[ix['タイトル']], date: r[ix['配信日時 JST']], status: r[ix['掲載判定']], summary: r[ix['概要（清掃済）']], url: r[ix['公式個別URL']] || r[ix['旧元ページURL']] }; });
}
function posuTaken(queue, pub) { var t = {}, pending = { _total: 0 }; queue.forEach(function (r) { if (String(r[14]) !== POSU_STATE.REJECT) t[r[5]] = true; if (String(r[14]) === POSU_STATE.PENDING) { pending[r[2]] = (pending[r[2]] || 0) + 1; pending._total++; } }); pub.forEach(function (r) { if (r[11]) t[r[11]] = true; }); return { taken: t, pending: pending }; }
var POSU_ERROR_TEXT = { BOT_SUSPECTED: '送信を受け付けられませんでした', UNKNOWN_PODCAST: '番組が見つかりません（ページを再読み込みしてください）', PODCAST_TITLE_MISMATCH: '番組情報が更新されています（ページを再読み込みしてください）', NOT_EPISODE_URL: 'エピソード（回）ごとのURLを入力してください（番組トップのURLは受け付けていません）', BAD_RELATION: '交流の種類を選んでください', TOO_LONG: '文字数が多すぎます', BAD_DATE: '配信日の形が読めません', DUPLICATE: 'この回はすでに受け付け済みか、掲載済みです', TOO_MANY_PENDING: 'この番組の確認待ちが多いため、いまは受け付けを止めています', QUEUE_FULL: '確認待ちが多いため、いまは受け付けを止めています', PAGE_NOT_FOUND: 'そのURLのページを開けませんでした（URLをご確認ください）' };
// 受付（JSONP・GET）。成功したときだけ ok:true と受付ID を返す（サイトは ok を見て「受け付けました」と表示する）
function handlePosukamiSubmit_(e, callback) {
  var p = (e && e.parameter) || {}, res = posuSubmit({ podcastId: p.podcastId, podcastTitle: p.podcastTitle, url: p.url, relation: p.relation, title: p.title, date: p.date, note: p.note, hp: p.website2 });
  return (typeof apiResponse === 'function') ? apiResponse(res, callback) : res;
}
function posuSubmit(sub) {
  var c = posuCfg(), lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, errors: ['BUSY'], message: '混み合っています。少し待ってからもう一度お試しください' };
  try {
    var ss = SpreadsheetApp.openById(c.spreadsheetId), qs = posuSheet(ss, c.queueSheet, POSU_QUEUE_H), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H);
    var queue = posuRows(qs, POSU_QUEUE_H.length), pub = posuRows(ps, POSU_PUBLIC_H.length), tk = posuTaken(queue, pub), podcasts = posuPodcasts();
    var v = posuValidate(sub, podcasts, tk.taken, tk.pending);
    if (!v.ok) return { ok: false, errors: v.errors, message: v.errors.map(function (x) { return POSU_ERROR_TEXT[x] || x; }).join('／') };
    var r = null; try { r = UrlFetchApp.fetch(String(sub.url).trim(), { muteHttpExceptions: true, followRedirects: true }); } catch (err) { r = null; }
    var code = r ? r.getResponseCode() : -1, html = r && code === 200 ? r.getContentText() : '';
    if (code === 404 || code === 410) return { ok: false, errors: ['PAGE_NOT_FOUND'], message: POSU_ERROR_TEXT.PAGE_NOT_FOUND };
    var meta = posuPageMeta(html), hints = posuRelationHints(sub, meta, html, v.podcast), now = new Date().toISOString(), id = 'PK-' + now.replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 900 + 100);
    var pageCheck = code === 200 ? (meta.title ? 'ページ確認（題名あり）' : 'ページは開ける（題名は読めない）') : '未確認（HTTP ' + code + '）';
    qs.appendRow([id, now, String(sub.podcastId), v.podcast.title, String(sub.url).trim(), v.key, sub.relation, String(sub.title || '').trim(), posuDay(sub.date), String(sub.note || '').trim(), meta.title, meta.date, pageCheck, hints, POSU_STATE.PENDING, '', ''].map(function (x) { return String(x).replace(/^([=+\-@])/, "'$1"); }));
    SpreadsheetApp.flush();
    var back = posuRows(qs, POSU_QUEUE_H.length).filter(function (row) { return row[0] === id; }).length;   // 読み戻せたときだけ受付完了
    if (back !== 1) return { ok: false, errors: ['NOT_SAVED'], message: '保存を確認できませんでした。もう一度お試しください' };
    return { ok: true, status: 'PENDING', receiptId: id, detectedTitle: meta.title, detectedDate: meta.date, pageCheck: pageCheck, message: '受け付けました。確認・承認のあとにカードへ載ります' };
  } finally { lock.releaseLock(); }
}
// 管理人: キューの「状態」を「承認」にした行を、公開シートへ一度だけ移す
function posuApprove() {
  var c = posuCfg(), lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { status: 'LOCKED' };
  try {
    var ss = SpreadsheetApp.openById(c.spreadsheetId), qs = posuSheet(ss, c.queueSheet, POSU_QUEUE_H), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H);
    var queue = posuRows(qs, POSU_QUEUE_H.length), pub = posuRows(ps, POSU_PUBLIC_H.length), keys = {}; pub.forEach(function (r) { keys[r[11]] = true; });
    var now = new Date().toISOString(), plan = posuApprovePlan(queue, keys, posuPodcasts(), now);
    if (plan.add.length) ps.getRange(ps.getLastRow() + 1, 1, plan.add.length, POSU_PUBLIC_H.length).setValues(plan.add);
    plan.updates.forEach(function (u) { qs.getRange(u.index + 2, 15, 1, 3).setValues([[u.state, u.memo, u.state === POSU_STATE.DONE ? now : '']]); });
    SpreadsheetApp.flush();
    return { status: 'OK', published: plan.add.length, updated: plan.updates.length };
  } finally { lock.releaseLock(); }
}
// 紹介元の照合（読むだけ）→ 結果を返す。公開シートへの記入は posuSyncIntros（確定分だけ・一度だけ）
function posuIntroReport() { return posuIntroMatch(posuPodcasts(), posuDonutEpisodes()); }
function posuSyncIntros(results) {
  var c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), ps = posuSheet(ss, c.publicSheet, POSU_PUBLIC_H), pub = posuRows(ps, POSU_PUBLIC_H.length), keys = {}, add = [], now = new Date().toISOString();
  pub.forEach(function (r) { keys[r[11]] = true; });
  results.forEach(function (x) { x.intros.forEach(function (i) { var key = 'INTRO|' + x.id + '|' + i.ep; if (keys[key]) return; keys[key] = true; add.push(['INTRO', x.id, x.title, i.title, i.show || 'ドーナツ', i.date, i.url, '', i.ep, posuDay(now), '照合: ' + i.evidence, key, '']); }); });
  if (add.length) ps.getRange(ps.getLastRow() + 1, 1, add.length, POSU_PUBLIC_H.length).setValues(add);
  return { added: add.length };
}

if (typeof module !== 'undefined') module.exports = { posuNz: posuNz, posuCore: posuCore, posuDay: posuDay, posuIntroMatch: posuIntroMatch, posuEpisodeUrl: posuEpisodeUrl, posuValidate: posuValidate, posuPageMeta: posuPageMeta, posuRelationHints: posuRelationHints, posuApprovePlan: posuApprovePlan, posuBuildPublic: posuBuildPublic, POSU_QUEUE_H: POSU_QUEUE_H, POSU_PUBLIC_H: POSU_PUBLIC_H, POSU_STATE: POSU_STATE, POSU_RELATIONS: POSU_RELATIONS };
