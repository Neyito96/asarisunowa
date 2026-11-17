// KA-1 蔵・台帳の総合監査（READ_ONLY）— #337 #308 #309 #278 #271
// 読む: V2作業用台帳（統合台帳・公開台帳・清掃詳細）、公開中の蔵（GitHub Pages の JSON）。書く: COPY の「蔵監査・*」シートだけ（毎回まるごと書き直し＝冪等）。
// 本番V2・Spotify・main には書かない。修正はしない（候補を出すだけ）。
var KA_VERSION = 'KA-1';
var KA_CFG = {
  v2Id: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', copyId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',
  site: 'https://neyito96.github.io/asarisunowa/library/data/',
  decisions: 'https://raw.githubusercontent.com/Neyito96/asarisunowa/main/docs/audits/library-v2-sync/decisions.json.gz',
  services: /spotify|apple ?podcasts?|amazon ?music|pocket ?casts|youtube|listen|pody|omny|stand\.fm|voicy/i
};
function kaTable_(ss, name) { var v = ss.getSheetByName(name).getDataRange().getDisplayValues(), h = v[0]; return { h: h, rows: v.slice(1), c: function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('COLUMN_NOT_FOUND ' + name + ':' + n); return i; } }; }
function kaJson_(url) { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); if (r.getResponseCode() !== 200) throw new Error('FETCH ' + url + ' ' + r.getResponseCode()); return JSON.parse(r.getContentText()); }
function kaLibrary_() {   // 公開中の蔵（全件）
  var m = kaJson_(KA_CFG.site + 'manifest.json?_=' + Date.now()), n = Math.ceil(7000 / m.detailBucketSize), reqs = [];
  for (var b = 0; b <= n; b++) reqs.push({ url: KA_CFG.site + 'details/' + b + '.json', muteHttpExceptions: true });
  var out = {}; UrlFetchApp.fetchAll(reqs).forEach(function (r) { if (r.getResponseCode() === 200) JSON.parse(r.getContentText()).forEach(function (e) { out[e.id] = e; }); });
  return { manifest: m, eps: out };
}
function kaNormName_(s) { return String(s || '').replace(/[（(][^）)]*[）)]/g, '').replace(/^(MC|ゲスト|出演|聞き手)[:：\s]*/i, '').replace(/[\s　・]/g, ''); }
function kaSplitCast_(s) { return String(s || '').split(/\s*(?:\/|／|;|；|、|\n)\s*/).map(function (x) { return x.replace(/https?:\/\/\S+/g, '').trim(); }).filter(Boolean); }
function kaNormUrl_(u) { return String(u || '').replace(/^http:/, 'https:').replace(/[?#].*$/, '').replace(/\/+$/, ''); }
function kaCore_(t) { return String(t || '').normalize('NFKC').replace(/[（(](再|再放送|再配信|アンコール|再掲)[^）)]*[）)]/g, '').replace(/【[^】]*(再|アンコール)[^】]*】/g, '').replace(/再放送|再配信|アンコール配信/g, '').replace(/\s+/g, ''); }
function kaWrite_(ss, name, header, rows) { var sh = ss.getSheetByName(name) || ss.insertSheet(name); sh.clearContents(); var all = [header].concat(rows); sh.getRange(1, 1, all.length, header.length).setValues(all); sh.setFrozenRows(1); return rows.length; }

function KA_0_蔵台帳_総合監査_READ_ONLY() {
  var t0 = Date.now(), v2 = SpreadsheetApp.openById(KA_CFG.v2Id), copy = SpreadsheetApp.openById(KA_CFG.copyId);
  if (copy.getName().indexOf('COPY') < 0) throw new Error('NOT_COPY');
  var L = kaTable_(v2, 'V2・統合台帳'), P = kaTable_(v2, 'V2・公開台帳'), C = kaTable_(v2, 'V2・清掃詳細'), lib = kaLibrary_(), S = {};
  var pub = {}; P.rows.forEach(function (r) { pub[r[P.c('EP-ID')]] = r; });
  var led = {}; L.rows.forEach(function (r) { led[r[L.c('EP-ID')]] = r; });
  // 5. 台帳と公開の差分（V2公開 − 蔵）。原因は前回の掲載判定（decisions）から
  var dec = {}; try { var g = UrlFetchApp.fetch(KA_CFG.decisions).getBlob(); g.setContentType('application/x-gzip'); JSON.parse(Utilities.ungzip(g).getDataAsString()).decisions.forEach(function (d) { dec[d.id] = d; }); } catch (e) { S.decisionsError = String(e); }
  var gap = []; Object.keys(pub).forEach(function (id) { if (!lib.eps[id]) { var d = dec[id] || {}; gap.push([id, pub[id][P.c('番組')], pub[id][P.c('タイトル')], d.publication || '判定なし', d.classification || '', d.note || '']); } });
  var extra = Object.keys(lib.eps).filter(function (id) { return !pub[id]; }).map(function (id) { return [id, lib.eps[id].show, lib.eps[id].title, '蔵にだけある', '', '']; });
  S.台帳差分 = kaWrite_(copy, '蔵監査・台帳差分', ['EP-ID', '番組', 'タイトル', '前回の判定', '分類', 'メモ'], gap.concat(extra));
  S.台帳差分_内訳 = {}; gap.concat(extra).forEach(function (r) { var k = r[3] + '・' + r[4]; S.台帳差分_内訳[k] = (S.台帳差分_内訳[k] || 0) + 1; });
  // 2. 出演者: 蔵とV2の差・同一EP内の重複・欠落・配信サービス名の混入
  var castRows = [], cc = {};
  Object.keys(lib.eps).forEach(function (id) {
    var e = lib.eps[id], r = led[id]; if (!r) return;
    var v = kaSplitCast_(r[L.c('出演者')]), k = kaSplitCast_(e.cast), nv = v.map(kaNormName_), nk = k.map(kaNormName_), probs = [];
    var dupV = nv.filter(function (x, i) { return x && nv.indexOf(x) !== i; }); if (dupV.length) probs.push('V2で重複: ' + dupV.join('・'));
    var dupK = nk.filter(function (x, i) { return x && nk.indexOf(x) !== i; }); if (dupK.length) probs.push('蔵で重複: ' + dupK.join('・'));
    var svc = v.concat(k).filter(function (x) { return KA_CFG.services.test(x); }); if (svc.length) probs.push('配信サービス名の混入: ' + svc.join('・'));
    if (!v.length && !k.length) probs.push('欠落（V2・蔵とも空）'); else if (!k.length) probs.push('蔵だけ欠落'); else if (!v.length) probs.push('V2だけ欠落');
    else if (nv.filter(function (x) { return nk.indexOf(x) < 0; }).length) probs.push('蔵とV2で違う');
    probs.forEach(function (p) { var key = p.split(':')[0]; cc[key] = (cc[key] || 0) + 1; castRows.push([id, e.show, key, p, r[L.c('出演者')].slice(0, 300), String(e.cast || '').slice(0, 300), /重複|混入/.test(key) ? '修正候補（根拠: 同じ名前・サービス名）' : 'HOLD（人の確認）']); });
  });
  S.出演者 = kaWrite_(copy, '蔵監査・出演者', ['EP-ID', '番組', '種類', '内容', 'V2出演者', '蔵の出演者', '判定'], castRows); S.出演者_内訳 = cc;
  // 3. 関連記事: 蔵の表示データと V2・清掃詳細（見出し＋URL）の対応・欠落・重複
  var sc = {}; C.rows.forEach(function (r) { try { sc[r[C.c('EP-ID')]] = JSON.parse(r[C.c('関連記事JSON(見出し+URL)')] || '[]').filter(function (p) { return p && p.kind === 'article' && /^https:/.test(p.url || ''); }); } catch (e) { sc[r[C.c('EP-ID')]] = null; } });
  var relRows = [], rc = {};
  Object.keys(lib.eps).forEach(function (id) {
    var e = lib.eps[id], ra = e.relatedArticles || [], rel = e.related || [], s = sc[id], probs = [];
    var urls = rel.map(kaNormUrl_); if (urls.filter(function (u, i) { return urls.indexOf(u) !== i; }).length) probs.push('URLの重複');
    if (ra.length && ra.length !== rel.filter(function (u, i) { return urls.indexOf(kaNormUrl_(u)) === i; }).length) probs.push('見出しの数とURLの数が違う');
    ra.forEach(function (a) { if (!a.title) probs.push('見出しなし'); else if (/^https?:/.test(a.title)) probs.push('見出しがURL'); });
    if (s === null) probs.push('V2のJSONが読めない');
    else if (s) { var mine = {}; urls.forEach(function (u) { mine[u] = 1; }); var miss = s.filter(function (p) { return !mine[kaNormUrl_(p.url)]; }); if (miss.length && !Array.isArray(e.relatedArticles)) probs.push('V2にある記事が蔵に無い（' + miss.length + '）'); }
    probs.filter(function (p, i) { return probs.indexOf(p) === i; }).forEach(function (p) { var key = p.replace(/（\d+）/, ''); rc[key] = (rc[key] || 0) + 1; relRows.push([id, e.show, key, p, ra.length, rel.length, s ? s.length : '']); });
  });
  S.関連記事 = kaWrite_(copy, '蔵監査・関連記事', ['EP-ID', '番組', '種類', '内容', '見出し付き件数', 'URL件数', 'V2の記事数'], relRows); S.関連記事_内訳 = rc;
  // 4. 再配信: 題名の「（再）」「再放送」等 → 同じ芯の題名の元回と GUID・公式URLを比べる。同一性は確定しない（HOLD）
  var byCore = {}; L.rows.forEach(function (r) { var k = kaCore_(r[L.c('タイトル')]); (byCore[k] = byCore[k] || []).push(r); });
  var reRows = [], rr = {};
  L.rows.forEach(function (r) {
    var title = r[L.c('タイトル')]; if (!/[（(](再|再放送|再配信|アンコール)|再放送|再配信|アンコール/.test(title)) return;
    var core = kaCore_(title), orig = (byCore[core] || []).filter(function (x) { return x !== r && x[L.c('配信日時 JST')] < r[L.c('配信日時 JST')]; });
    var o = orig[0], same = o ? (o[L.c('公式GUID')] && o[L.c('公式GUID')] === r[L.c('公式GUID')] ? 'GUID一致' : (o[L.c('公式個別URL')] && kaNormUrl_(o[L.c('公式個別URL')]) === kaNormUrl_(r[L.c('公式個別URL')]) ? '公式URL一致' : '題名の芯だけ一致')) : '元回が見つからない';
    var verdict = same === '題名の芯だけ一致' ? '再配信（元回あり・別音声の可能性）' : same === '元回が見つからない' ? 'HOLD（元回不明）' : 'HOLD（同じ回の可能性・要確認）';
    rr[verdict] = (rr[verdict] || 0) + 1;
    reRows.push([r[L.c('EP-ID')], r[L.c('番組')], title, r[L.c('掲載判定')], o ? o[L.c('EP-ID')] : '', o ? o[L.c('タイトル')] : '', same, verdict, lib.eps[r[L.c('EP-ID')]] ? '蔵に公開中' : '蔵に無い']);
  });
  S.再配信 = kaWrite_(copy, '蔵監査・再配信', ['EP-ID', '番組', 'タイトル', '掲載判定', '元回EP-ID', '元回タイトル', '照合', '判定', '蔵'], reRows); S.再配信_内訳 = rr;
  // 6. Spotify: 蔵に公開中で、V2に検証済み Spotify URL がある回（プレイリスト照合・追加は本番の既存関数で）
  var sp = []; Object.keys(lib.eps).forEach(function (id) { var r = pub[id]; var u = r ? r[P.c('Spotify')] : ''; if (/^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}/.test(u)) sp.push([id, lib.eps[id].show, lib.eps[id].title, u.replace(/\?.*$/, '')]); });
  S.Spotify候補 = kaWrite_(copy, '蔵監査・Spotify候補', ['EP-ID', '番組', 'タイトル', 'Spotify URL（V2の検証済み列）'], sp);
  S.蔵 = Object.keys(lib.eps).length; S.V2公開 = Object.keys(pub).length; S.版 = KA_VERSION; S.秒 = Math.round((Date.now() - t0) / 1000);
  var sum = [['項目', '値']]; Object.keys(S).forEach(function (k) { sum.push([k, typeof S[k] === 'object' ? JSON.stringify(S[k]) : String(S[k])]); });
  kaWrite_(copy, '蔵監査・集計', sum[0], sum.slice(1));
  Logger.log(JSON.stringify(S)); return S;
}
