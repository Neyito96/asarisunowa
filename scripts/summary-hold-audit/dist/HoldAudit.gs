// 生成ファイル（scripts/summary-hold-audit/build.mjs）。直接編集しない
var tidyDescription = (function () {
// #315 概要欄の表示整形（表示のときだけ。公開データ・V2原本は書き換えない）
// 残す: 本編の説明・収録日・「番組内で紹介したポッドキャストは…」・関連記事（タイトル＋URL → 1件ずつリンク）
// 外す: イベント告知・宣伝・会員登録のお願い・SNS/discord 案内・【出演・スタッフ】などの定型
// 判断がつかないときは HOLD（元の概要をそのまま出す）。URLは本文にあるものだけを使い、作らない。
const RELATED_HEAD = /関連|関係記事|おすすめ記事|今回取り上げた|記事】|リンク|参考|連載|そもそも解説|まとめてわかる|解説人語|詳報|特集|社説|エピソード】|ポッドキャスト】|番組】|動画】|写真|コンテンツ|サイト】|アーカイブ|記者サロン/;
const DROP_HEAD = /GOOD LIFEフェア|出演|スタッフ|おねがい|お願い|朝ポキ情報|キャンペーン|イベント|申込|申し込み|締め?切|募集|プレゼント|登録|購読|会員|はじめるなら|月額|円で|スペシャルデー|生配信|夜会|ご案内|おしらせ|お知らせ|ツイッター|Twitter|インスタ|メール|discord|SPONSORED|開催|登壇|公演|配信のお知らせ|リスナーさんへ|語ろう|ご意見|アンケート|公式サイト|ビデオポッドキャスト|Spotify|Apple Podcasts|朝リスの木|会場|ニュースの要点|ニュース4U|よせがき|見逃し|まで配信/;
const KEEP_HEAD = /番組内容|^【内容】|議題|タイムスタンプ|要旨|前編|後編|ネタバレ/;
const PROMO = /申し込み|申込|締め切|〆切|会員登録|キャンペーン|初月無料|無料|アーカイブ配信|discord|フォロー|おたより|プレイリスト|🎧|購読|イベント|お会いしましょう|ご利用いただけます|ログインID|チケット|応募|はこちら|配信中|お待ちしています|ご意見|感想|リクエスト/i;
const STRONG_PROMO = /ad choices|adchoices|megaphone\.fm|お申し込み|会員登録|初月無料|キャンペーン|購読料で配信|ご利用いただけます|新プレイリスト|多彩な番組を配信中|privacy information|Learn more about|omnystudio\.com/i;
const PROMO_URL = /bit\.ly\/(asapoki|4k4ZKwA)|t\.asahi\.com\/(w|asapoki)|discord\.gg|ciy\.digital\.asahi\.com|digital\.asahi\.com\/pr\/|omnystudio\.com|x\.gd\/|youtube\.com\/@asapoki/i;
const URL_ONLY = /^https?:\/\/\S+$/;
const RECORDED = /^※?\s*(\d{4})年(\d{1,2})月(\d{1,2})日に収録(?:しました)?。?$/;
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–' };

const ARTICLE_URL = /^https:\/\/((www\.)?asahi\.com\/|digital\.asahi\.com\/articles|withnews\.jp\/|globe\.asahi\.com\/|book\.asahi\.com\/|dot\.asahi\.com\/|news\.yahoo\.co\.jp\/)/;
const SOCIAL_URL = /twitter\.com|x\.com\/|instagram\.com|buff\.ly|facebook\.com|tiktok\.com|forms\.|note\.com\/asahi/i;
// 「タイトル URL」の並び → 1件ずつ。宣伝・SNS の行は外す。読めない残りがあれば null（HOLD）
function relatedPairs(text) {
  const t = text.replace(/[（(]\s*(https?:\/\/[^\s）)]+)\s*[）)]/g, ' $1 ').replace(/\s*[▽／]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [], re = /(\S.*?)\s*(https?:\/\/[^\s]+)/g; let m, last = 0;
  while ((m = re.exec(t))) {
    const title = m[1].trim(), url = m[2]; last = re.lastIndex;
    if (PROMO_URL.test(url) || SOCIAL_URL.test(url) || PROMO.test(title) || /^(ウェブサイト|朝日新聞ポッドキャスト|公式サイト|番組一覧|過去の回)/.test(title)) continue;
    if (!title || URL_ONLY.test(title) || title.length > 120 || !/^https:/.test(url)) return null;
    out.push({ title, url });
  }
  const rest = t.slice(last).trim();
  return rest && !PROMO.test(rest) && !STRONG_PROMO.test(rest) ? null : out;
}

function tidyDescription(raw) {
  const text = String(raw || '').replace(/&[a-z#0-9]+;/gi, (x) => ENT[x] ?? x).replace(/[〖［]/g, '【').replace(/[〗］]/g, '】').replace(/([^\s])(https?:\/\/)/g, '$1 $2').replace(/\s+/g, ' ').trim();
  if (!text) return { status: 'EMPTY', reason: '', body: '', recordedAt: '', related: [], removed: [] };
  const parts = text.split(/(?=【[^】]{1,40}】)/), body = [], related = [], removed = [];
  let recordedAt = '', hold = '';
  for (const part of parts) {
    const head = (part.match(/^【[^】]*】/) || [''])[0];
    if (head && DROP_HEAD.test(head) && !KEEP_HEAD.test(head)) { removed.push(part.slice(0, 40)); continue; }
    if (head && RELATED_HEAD.test(head) && !KEEP_HEAD.test(head)) {
      const r = relatedPairs(part.slice(head.length).trim());
      if (!r) hold = hold || (/https:\/\//.test(part) ? '関連記事の形が読めない' : '関連記事にURLがない');
      else related.push(...r);
      continue;
    }
    if (head && !KEEP_HEAD.test(head)) { hold = hold || '知らない見出し'; }
    let promo = false; const chunks = part.slice(head && KEEP_HEAD.test(head) ? head.length : 0).split(' ').filter(Boolean);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i], rec = chunk.match(RECORDED);
      if (rec) { recordedAt = `${rec[1]}年${Number(rec[2])}月${Number(rec[3])}日`; promo = false; continue; }
      if (chunk.startsWith('★')) { promo = true; removed.push(chunk); continue; }
      if (chunk.startsWith('※') && !/紹介した/.test(chunk) && PROMO.test(chunk)) { promo = true; removed.push(chunk); continue; }
      if (URL_ONLY.test(chunk)) {
        if (promo || PROMO_URL.test(chunk)) { removed.push(chunk); continue; }
        const prev = body[body.length - 1] || '';
        if (SOCIAL_URL.test(chunk) || /こちら|フォーム|一覧|フォロー|つぶやき|登録|ご意見|感想|お願いします/.test(prev)) { if (prev && /こちら|フォーム|一覧|フォロー|つぶやき|登録|ご意見|感想|お願いします/.test(prev)) removed.push(body.pop()); removed.push(chunk); if (/^[）)]/.test(chunks[i + 1] || '')) i++; continue; }
        if (ARTICLE_URL.test(chunk) && /^https:/.test(chunk)) {   // 本文中の「記事タイトル URL」→ 関連記事へ（タイトルは直前の文の切れ目まで）
          const title = []; while (body.length && !/[。！？!?]$/.test(body[body.length - 1]) && title.length < 6) title.unshift(body.pop());
          const tt = title.join(' ').replace(/^[〖【]?関連記事[】〗]?\s*/, '').replace(/[（(]$/, '').trim();
          if (tt && tt.length <= 120) { related.push({ title: tt, url: chunk }); if (/^[）)]/.test(chunks[i + 1] || '')) i++; continue; }
          body.push(...title);
        }
        hold = hold || '本文にURLが残る'; body.push(chunk); continue;
      }
      if (STRONG_PROMO.test(chunk)) { removed.push(chunk); promo = true; continue; }
      if ((promo || URL_ONLY.test(chunks[i + 1] || '') && PROMO_URL.test(chunks[i + 1])) && (PROMO.test(chunk) || /^[（(].*[）)]$/.test(chunk))) { removed.push(chunk); promo = true; continue; }
      if (promo && /^(See|Learn|more|about|for|information\.?|privacy|your|ad|choices\.?|Visit)$/i.test(chunk)) { removed.push(chunk); continue; }
      promo = false; body.push(chunk);
    }
  }
  const out = body.join(' ').trim();
  if (!hold && !out && !related.length && !recordedAt) hold = '本文が空になる';
  return { status: hold ? 'HOLD' : removed.length || related.length || recordedAt ? 'TIDY' : 'AS_IS', reason: hold, body: out, recordedAt, related, removed };
}

return tidyDescription;
})();
// HA-1 概要欄HOLD監査（Issue #308 / #315）
// 目的: 蔵の表示整形（public/library/description-tidy.mjs・PR #316）で HOLD になった回について、
//   1) 原文がどこにあるか（V2・収蔵詳細「概要原文」）を確かめ、取得済み・未取得・SHA不一致に分ける
//   2) 原文に同じ整形規則をかけ、品質の検査（本文が原文の中にある・関連記事の見出しとURLが原文の中で対応している・出演者の重複）をする
//   3) 自動修正可能・人間確認必要・原文未取得に分け、COPY の明細・集計シートに書く
// 安全: V2作業用台帳・本番は読むだけ。書くのは COPY の「HOLD監査・明細」「HOLD監査・集計」だけ（毎回まるごと書き直す＝冪等）。原文は加工しない。
var HA_VERSION = 'HA-3';
var HA_CFG = {
  v2Id: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc',   // V2作業用（読むだけ）
  copyId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY', // COPY（書く）
  refuse: ['1I0fm8iBM6BMeLgBDdvQ4HLitlGy4sTm7Njjy50J-8BA', '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ'],
  ledger: 'V2・統合台帳', detail: 'V2・収蔵詳細', cleanDetail: 'V2・清掃詳細',
  outRows: 'HOLD監査・明細', outSum: 'HOLD監査・集計'
};
var HA_ROW_H = ['EP-ID', '番組', '分類', '原因', '原文状態', '原文SHA256', '原文文字数', '清掃済文字数', '整形後文字数', '整形の判定', '関連記事数（整形）', '関連記事数（SC4-18）', 'URL差（整形にだけ）', 'URL差（SC4-18にだけ）', '出演者重複', '整形後本文（先頭200字）', '関連記事JSON（整形）', '版', '日時'];

// ---- 純関数（Node テストと共用） ----
function haSplitCast(s) { return String(s || '').split(/[；;／/、,\n]+/).map(function (x) { return x.replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, '').trim(); }).filter(Boolean); }
function haCastDup(s) { var seen = {}, dup = []; haSplitCast(s).forEach(function (n) { if (seen[n] && dup.indexOf(n) < 0) dup.push(n); seen[n] = 1; }); return dup; }
function haNormUrl(u) { return String(u || '').replace(/&amp;/g, '&').replace(/[?&](iref|ref|utm_[a-z]+)=[^&#]*/gi, '').replace(/[?&]$/, '').replace(/\/$/, '').trim(); }
// 原文（公式RSSのHTML）を、整形にかけられる文字列にする。原文そのものは変えない（比較・整形用の写しを作るだけ）
// Omny は1つのURLを <a href=X>前半</a><a href=X>?iref=omny</a><a href=X></a> のように分けて書くので、同じ href の連続は1つにまとめる
var HA_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', darr: '↓', uarr: '↑', rarr: '→', larr: '←', mdash: '—', ndash: '–', middot: '・', laquo: '«', raquo: '»', times: '×' };
function haHtmlToText(raw) {
  var s = String(raw || '');
  if (!/<[a-z!\/][^>]*>/i.test(s)) return s;
  // 文字が「?iref=omny」「l?iref=omny」だけのリンクは、Omny が別の記事URLを誤って付けた断片なので捨てる（直前のリンクが本物）
  s = s.replace(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, function (m, h, txt) { return /^\s*[a-z]{0,4}\?[\w=&;.-]*\s*$/i.test(txt) ? ' ' : ' \u0001' + h.replace(/&amp;/g, '&') + '\u0001 '; });
  s = s.replace(/(\u0001([^\u0001]+)\u0001)(\s*\u0001\2\u0001)+/g, '$1').replace(/\u0001/g, '');
  s = s.replace(/<br\s*\/?>|<\/p>|<p\b[^>]*>|<\/?(div|li|ul|ol|h\d)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
  s = s.replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(+d); }).replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); }).replace(/&([a-z]+);/gi, function (m, n) { return HA_ENT[n.toLowerCase()] != null ? HA_ENT[n.toLowerCase()] : m; });
  return s.replace(/[ \t\u00a0\u3000]*\n[ \t\u00a0\u3000]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function haNormText(t) { return String(t || '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
// 1件の判定。row: {ep, show, cleaned, cast, raw, rawSha, sc418Json}
function haJudge(row, sha) {
  var raw = String(row.raw || ''), out = { ep: row.ep, show: row.show, rawLen: raw.length, cleanedLen: String(row.cleaned || '').length };
  if (!raw.trim()) { out.cls = '原文未取得'; out.cause = '概要原文が空'; out.rawState = '未取得'; return out; }
  out.sha = sha; out.rawState = row.rawSha && row.rawSha.toLowerCase() !== String(sha).toLowerCase() ? 'SHA不一致' : '取得済み';
  if (out.rawState === 'SHA不一致') { out.cls = '人間確認必要'; out.cause = '保存の原文SHA256と一致しない'; return out; }
  var text = haHtmlToText(raw), t = tidyDescription(text), nraw = haNormText(text);
  out.tidy = t; out.tidyStatus = t.status; out.bodyLen = t.body.length;
  var fails = [];
  if (t.status === 'HOLD') fails.push('整形HOLD: ' + t.reason);
  if (t.status === 'EMPTY') fails.push('整形後に空');
  // 本文は原文の中の語だけでできている（足した文字が無い）
  t.body.split(' ').forEach(function (w) { if (w && nraw.indexOf(w) < 0 && fails.indexOf('本文に原文に無い語') < 0) fails.push('本文に原文に無い語'); });
  // 関連記事: 見出しとURLがどちらも原文にあり、原文の中で 見出し→URL の順に並ぶ
  t.related.forEach(function (r) {
    var it = nraw.indexOf(haNormText(r.title)), iu = nraw.indexOf(r.url);
    if (it < 0 || iu < 0) { if (fails.indexOf('関連記事が原文に無い') < 0) fails.push('関連記事が原文に無い'); }
    else if (it > iu) { if (fails.indexOf('見出しとURLの順が逆') < 0) fails.push('見出しとURLの順が逆'); }
  });
  // SC4-18（既存の清掃ロボ）の見出し＋URLと比べる（記事URLだけ）
  var sc = []; try { sc = JSON.parse(row.sc418Json || '[]') || []; } catch (e) { fails.push('SC4-18のJSONが読めない'); }
  var mine = {}, theirs = {};
  t.related.forEach(function (r) { mine[haNormUrl(r.url)] = 1; });
  (sc || []).forEach(function (p) { var u = p && (p.url || p.u); if (u && /asahi\.com\/articles|digital\.asahi\.com\/articles|withnews|globe\.asahi/.test(u)) theirs[haNormUrl(u)] = 1; });
  out.onlyMine = Object.keys(mine).filter(function (u) { return !theirs[u]; }).length;
  out.onlyTheirs = Object.keys(theirs).filter(function (u) { return !mine[u]; }).length;
  out.scCount = Object.keys(theirs).length;
  if (out.onlyTheirs) fails.push('SC4-18にある記事を整形が落とした');
  out.castDup = haCastDup(row.cast);
  if (out.castDup.length) fails.push('出演者の重複');
  // 例外の集約用（Claude に全文を渡さないため、見出し名・URLのホスト名だけを残す）
  if (/知らない見出し/.test(t.reason || '')) out.heads = (text.match(/【[^】]{1,40}】/g) || []).filter(function (h, i, a) { return a.indexOf(h) === i; });
  if (/URLが残る/.test(t.reason || '')) out.hosts = (t.body.match(/https?:\/\/[^\/\s]+/g) || []).map(function (u) { return u.replace(/^https?:\/\//, ''); });
  out.fails = fails;
  out.cls = fails.length ? '人間確認必要' : '自動修正可能';
  out.cause = fails.length ? fails[0] : (t.status === 'AS_IS' ? '原文のまま（外す物なし）' : '整形して表示できる');
  return out;
}
function haRowOut(j, ver, now) {
  var t = j.tidy || { body: '', related: [] };
  return [j.ep, j.show, j.cls, j.cause, j.rawState || '', j.sha || '', j.rawLen, j.cleanedLen, j.bodyLen || 0, j.tidyStatus || '', t.related.length, j.scCount || 0, j.onlyMine || 0, j.onlyTheirs || 0, (j.castDup || []).join('・'), t.body.slice(0, 200), JSON.stringify(t.related).slice(0, 2000), ver, now];
}
function haSummary(js, examples) {
  var by = {}, cause = {}, ex = {};
  js.forEach(function (j) { by[j.cls] = (by[j.cls] || 0) + 1; var k = j.cls + '｜' + j.cause; cause[k] = (cause[k] || 0) + 1; (ex[k] = ex[k] || []).length < (examples || 3) && ex[k].push(j.ep); });
  var heads = {}, hosts = {};
  js.forEach(function (j) { (j.heads || []).forEach(function (h) { heads[h] = (heads[h] || 0) + 1; }); (j.hosts || []).forEach(function (h) { hosts[h] = (hosts[h] || 0) + 1; }); });
  var top = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, 20).map(function (k) { return [k, o[k]]; }); };
  return { heads: top(heads), hosts: top(hosts), total: js.length, byClass: by, byCause: Object.keys(cause).sort(function (a, b) { return cause[b] - cause[a]; }).map(function (k) { return [k, cause[k], ex[k].join(' ')]; }) };
}

// ---- GAS 実行部 ----
function haOpen_(id) { if (HA_CFG.refuse.indexOf(id) >= 0) throw new Error('REFUSED_SPREADSHEET'); return SpreadsheetApp.openById(id); }
function haTable_(ss, name, cols) {
  var sh = ss.getSheetByName(name); if (!sh) throw new Error('SHEET_NOT_FOUND ' + name);
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), h = v[0].map(String), ix = {};
  cols.forEach(function (c) { ix[c] = h.indexOf(c); if (ix[c] < 0) throw new Error('COLUMN_NOT_FOUND ' + name + ':' + c); });
  return { rows: v.slice(1), ix: ix };
}
function haSha_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function haRun_(limit) {
  var t0 = Date.now(), v2 = haOpen_(HA_CFG.v2Id), copy = haOpen_(HA_CFG.copyId);
  if (copy.getName().indexOf('COPY') < 0) throw new Error('NOT_COPY');
  var L = haTable_(v2, HA_CFG.ledger, ['EP-ID', '番組', '掲載判定', '代表EP-ID', '概要（清掃済）', '出演者']);
  var D = haTable_(v2, HA_CFG.detail, ['EP-ID', '概要原文', '概要原文SHA256']);
  var C = haTable_(v2, HA_CFG.cleanDetail, ['EP-ID', '関連記事JSON(見出し+URL)']);
  var raw = {}, sc = {};
  D.rows.forEach(function (r) { raw[r[D.ix['EP-ID']]] = { t: String(r[D.ix['概要原文']] || ''), sha: String(r[D.ix['概要原文SHA256']] || '') }; });
  C.rows.forEach(function (r) { sc[r[C.ix['EP-ID']]] = String(r[C.ix['関連記事JSON(見出し+URL)']] || ''); });
  // 対象: 公開対象（掲載判定=対象・代表=自分）で、清掃済みの概要に表示整形をかけると HOLD になる回
  var targets = [], publicCount = 0;
  L.rows.forEach(function (r) {
    var ep = String(r[L.ix['EP-ID']]); if (r[L.ix['掲載判定']] !== '対象' || String(r[L.ix['代表EP-ID']] || ep) !== ep) return;
    publicCount++;
    if (tidyDescription(String(r[L.ix['概要（清掃済）']] || '')).status !== 'HOLD') return;
    targets.push({ ep: ep, show: r[L.ix['番組']], cleaned: String(r[L.ix['概要（清掃済）']] || ''), cast: String(r[L.ix['出演者']] || ''), raw: (raw[ep] || {}).t || '', rawSha: (raw[ep] || {}).sha || '', sc418Json: sc[ep] || '' });
  });
  var run = limit ? targets.slice(0, limit) : targets, now = new Date().toISOString();
  var js = run.map(function (row) { return haJudge(row, row.raw ? haSha_(row.raw) : ''); });
  // 書込（COPY・まるごと書き直し）
  var out = copy.getSheetByName(HA_CFG.outRows) || copy.insertSheet(HA_CFG.outRows); out.clearContents();
  var rows = [HA_ROW_H].concat(js.map(function (j) { return haRowOut(j, HA_VERSION, now); }));
  out.getRange(1, 1, rows.length, HA_ROW_H.length).setValues(rows); out.setFrozenRows(1);
  var back = out.getRange(2, 1, Math.max(js.length, 1), 1).getValues().map(function (r) { return r[0]; });
  var readback = js.every(function (j, i) { return back[i] === j.ep; });
  var s = haSummary(js, 5), sum = copy.getSheetByName(HA_CFG.outSum) || copy.insertSheet(HA_CFG.outSum); sum.clearContents();
  var sr = [['版', HA_VERSION, '実行', now], ['公開対象', publicCount, 'HOLD（清掃済に表示整形）', targets.length], ['今回の件数', js.length, '上限', limit || '全件']];
  Object.keys(s.byClass).forEach(function (k) { sr.push(['分類', k, '件数', s.byClass[k]]); });
  s.byCause.forEach(function (c) { sr.push(['原因', c[0], c[1], c[2]]); });
  s.heads.forEach(function (h) { sr.push(['見出し（知らない見出しの回に出る）', h[0], h[1], '']); });
  s.hosts.forEach(function (h) { sr.push(['本文に残るURLのホスト', h[0], h[1], '']); });
  sum.getRange(1, 1, sr.length, 4).setValues(sr);
  var res = { version: HA_VERSION, publicCount: publicCount, holdTargets: targets.length, judged: js.length, byClass: s.byClass, topCauses: s.byCause.slice(0, 8), heads: s.heads.slice(0, 15), hosts: s.hosts.slice(0, 10), readback: readback ? 'OK' : 'MISMATCH', ms: Date.now() - t0 };
  Logger.log(JSON.stringify(res));
  return res;
}
function HA_1_HOLD監査_100件() { return haRun_(100); }
function HA_2_HOLD監査_全件() { return haRun_(0); }

if (typeof module !== 'undefined') module.exports = { haHtmlToText: haHtmlToText, haJudge: haJudge, haSummary: haSummary, haCastDup: haCastDup, haRowOut: haRowOut, HA_ROW_H: HA_ROW_H };
