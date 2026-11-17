// KA-1 蔵・台帳の総合監査（READ_ONLY）— #337 #308 #309 #278 #271
// 読む: V2作業用台帳（統合台帳・公開台帳・清掃詳細）、公開中の蔵（GitHub Pages の JSON）。書く: COPY の「蔵監査・*」シートだけ（毎回まるごと書き直し＝冪等）。
// 本番V2・Spotify・main には書かない。修正はしない（候補を出すだけ）。
var KA_VERSION = 'KA-1';
var KA_CFG = {
  v2Id: '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc', copyId: '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY',
  site: 'https://neyito96.github.io/asarisunowa/library/data/',
  decisions: 'https://raw.githubusercontent.com/Neyito96/asarisunowa/main/docs/audits/library-v2-sync/decisions.json.gz',
  syncLog: 'https://raw.githubusercontent.com/Neyito96/asarisunowa/main/docs/audits/library-v2-sync/description-sync-log.json.gz',
  services: /spotify|apple ?podcasts?|amazon ?music|pocket ?casts|youtube|listen|pody|omny|stand\.fm|voicy/i
};
function kaTable_(ss, name) { var v = ss.getSheetByName(name).getDataRange().getDisplayValues(), h = v[0]; return { h: h, rows: v.slice(1), c: function (n) { var i = h.indexOf(n); if (i < 0) throw new Error('COLUMN_NOT_FOUND ' + name + ':' + n); return i; } }; }
function kaJson_(url) { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); if (r.getResponseCode() !== 200) throw new Error('FETCH ' + url + ' ' + r.getResponseCode()); return JSON.parse(r.getContentText()); }
function kaGz_(url) { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); if (r.getResponseCode() !== 200) throw new Error('FETCH ' + url + ' ' + r.getResponseCode()); var b = r.getBlob(); b.setContentType('application/x-gzip'); return JSON.parse(Utilities.ungzip(b).getDataAsString()); }
function kaLibrary_() {   // 公開中の蔵（全件）。1つでも取れない・壊れている・重複・総数不一致なら停止
  var m = kaJson_(KA_CFG.site + 'manifest.json?_=' + Date.now()), size = Number(m.detailBucketSize), total = Number(m.total);
  if (!(size > 0) || !(total > 0)) throw new Error('MANIFEST_INVALID size=' + size + ' total=' + total);
  var ids = kaJson_(KA_CFG.site + 'scope.json?_=' + Date.now()).publishedIds; if (!Array.isArray(ids) || ids.length !== total) throw new Error('SCOPE_INVALID');
  var want = {}; ids.forEach(function (id) { want[Math.floor(Number(String(id).slice(3)) / size)] = 1; });   // 蔵の表示と同じ規則（EP番号÷バケット幅）
  var reqs = Object.keys(want).map(function (b) { return { url: KA_CFG.site + 'details/' + b + '.json', muteHttpExceptions: true }; });
  var out = {}, bad = [], dup = [], res = UrlFetchApp.fetchAll(reqs);
  for (var i = 0; i < res.length; i++) {
    var r = res[i], url = reqs[i].url;
    if (r.getResponseCode() !== 200) { bad.push(url + ' ' + r.getResponseCode()); continue; }
    var arr; try { arr = JSON.parse(r.getContentText()); } catch (e) { bad.push(url + ' JSON'); continue; }
    if (!Array.isArray(arr)) { bad.push(url + ' NOT_ARRAY'); continue; }
    arr.forEach(function (e) { if (!e || !e.id) bad.push(url + ' NO_ID'); else if (out[e.id]) dup.push(e.id); else out[e.id] = e; });
  }
  if (bad.length || dup.length || Object.keys(out).length !== total || ids.some(function (id) { return !out[id]; })) throw new Error('LIBRARY_INVALID n=' + Object.keys(out).length + ' total=' + total + ' bad=' + bad.slice(0, 10).join(',') + ' dup=' + dup.slice(0, 10).join(','));
  return { manifest: m, eps: out };
}
function kaNormName_(s) { return String(s || '').replace(/[（(][^）)]*[）)]/g, '').replace(/^(MC|ゲスト|出演|聞き手)[:：\s]*/i, '').replace(/[\s　・]/g, ''); }
function kaSplitCast_(s) { return String(s || '').split(/\s*(?:\/|／|;|；|、|\n)\s*/).map(function (x) { return x.replace(/https?:\/\/\S+/g, '').trim(); }).filter(Boolean); }
function kaNormUrl_(u) { return String(u || '').replace(/^http:/, 'https:').replace(/[?#].*$/, '').replace(/\/+$/, ''); }
function kaCore_(t) { return String(t || '').normalize('NFKC').replace(/[（(](再|再放送|再配信|アンコール|再掲)[^）)]*[）)]/g, '').replace(/【[^】]*(再|アンコール)[^】]*】/g, '').replace(/再放送|再配信|アンコール配信/g, '').replace(/\s+/g, ''); }
function kaWrite_(out, name, header, rows) { rows.forEach(function (r) { if (r.length !== header.length) throw new Error('ROW_WIDTH ' + name); }); out.push({ name: name, header: header, rows: rows }); return rows.length; }   // まずメモリに貯める
function kaCommit_(ss, out) {   // 全部を仮タブに書いて読み戻しが一致したら、旧タブと入れ替える
  var tmps = out.map(function (t) {
    var tn = t.name + '__tmp', old = ss.getSheetByName(tn); if (old) ss.deleteSheet(old);
    var sh = ss.insertSheet(tn), all = [t.header].concat(t.rows); sh.getRange(1, 1, all.length, t.header.length).setValues(all); SpreadsheetApp.flush();
    if (sh.getLastRow() !== all.length || sh.getRange(all.length, 1).getDisplayValue() !== String(all[all.length - 1][0])) throw new Error('READBACK ' + tn);
    return sh;
  });
  out.forEach(function (t, i) { var old = ss.getSheetByName(t.name); if (old) ss.deleteSheet(old); tmps[i].setName(t.name); tmps[i].setFrozenRows(1); });
}

function KA_0_蔵台帳_総合監査_READ_ONLY() {
  var t0 = Date.now(), v2 = SpreadsheetApp.openById(KA_CFG.v2Id), copy = SpreadsheetApp.openById(KA_CFG.copyId), OUT = [];
  if (copy.getName().indexOf('COPY') < 0) throw new Error('NOT_COPY');
  var L = kaTable_(v2, 'V2・統合台帳'), P = kaTable_(v2, 'V2・公開台帳'), C = kaTable_(v2, 'V2・清掃詳細'), lib = kaLibrary_(), S = {};
  var pub = {}; P.rows.forEach(function (r) { pub[r[P.c('EP-ID')]] = r; });
  var led = {}; L.rows.forEach(function (r) { led[r[L.c('EP-ID')]] = r; });
  // 5. 台帳と公開の差分（V2公開 − 蔵）。原因は前回の掲載判定（decisions）から
  var dec = {}, dl = kaGz_(KA_CFG.decisions).decisions; if (!Array.isArray(dl) || !dl.length) throw new Error('DECISIONS_INVALID'); dl.forEach(function (d) { dec[d.id] = d; });   // 取れなければ停止
  var gap = []; Object.keys(pub).forEach(function (id) { if (!lib.eps[id]) { var d = dec[id] || {}; gap.push([id, pub[id][P.c('番組')], pub[id][P.c('タイトル')], d.publication || '判定なし', d.classification || '', d.note || '']); } });
  var extra = Object.keys(lib.eps).filter(function (id) { return !pub[id]; }).map(function (id) { return [id, lib.eps[id].show, lib.eps[id].title, '蔵にだけある', '', '']; });
  S.台帳差分 = kaWrite_(OUT, '蔵監査・台帳差分', ['EP-ID', '番組', 'タイトル', '前回の判定', '分類', 'メモ'], gap.concat(extra));
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
  S.出演者 = kaWrite_(OUT, '蔵監査・出演者', ['EP-ID', '番組', '種類', '内容', 'V2出演者', '蔵の出演者', '判定'], castRows); S.出演者_内訳 = cc;
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
  S.関連記事 = kaWrite_(OUT, '蔵監査・関連記事', ['EP-ID', '番組', '種類', '内容', '見出し付き件数', 'URL件数', 'V2の記事数'], relRows); S.関連記事_内訳 = rc;
  // 4. 再配信: 題名の「（再）」「再放送」等 → 同じ芯の題名の元回と GUID・公式URLを比べる。同一性は確定しない（HOLD）
  var byCore = {}; L.rows.forEach(function (r) { var k = kaCore_(r[L.c('タイトル')]); (byCore[k] = byCore[k] || []).push(r); });
  var reRows = [], rr = {};
  L.rows.forEach(function (r) {
    var title = r[L.c('タイトル')]; if (!/[（(](再|再放送|再配信|アンコール)|再放送|再配信|アンコール/.test(title)) return;
    var core = kaCore_(title), orig = (byCore[core] || []).filter(function (x) { return x !== r && x[L.c('配信日時 JST')] < r[L.c('配信日時 JST')]; });
    var o = orig[0], same = o ? (o[L.c('公式GUID')] && o[L.c('公式GUID')] === r[L.c('公式GUID')] ? 'GUID一致' : (o[L.c('公式個別URL')] && kaNormUrl_(o[L.c('公式個別URL')]) === kaNormUrl_(r[L.c('公式個別URL')]) ? '公式URL一致' : '題名の芯だけ一致')) : '元回が見つからない';
    var rep = r[L.c('代表EP-ID')], repOk = o && rep && rep === o[L.c('EP-ID')] ? '代表EP=元回' : '代表EP不一致/空';
    var verdict = same === '元回が見つからない' ? 'HOLD（元回不明）' : same === '題名の芯だけ一致' ? 'HOLD（題名の芯だけ一致）' : 'HOLD（' + same + '・' + repOk + '・既存判定=' + r[L.c('掲載判定')] + '）';   // 確定・削除はしない
    rr[verdict] = (rr[verdict] || 0) + 1;
    reRows.push([r[L.c('EP-ID')], r[L.c('番組')], title, r[L.c('掲載判定')], o ? o[L.c('EP-ID')] : '', o ? o[L.c('タイトル')] : '', same, verdict, lib.eps[r[L.c('EP-ID')]] ? '蔵に公開中' : '蔵に無い']);
  });
  S.再配信 = kaWrite_(OUT, '蔵監査・再配信', ['EP-ID', '番組', 'タイトル', '掲載判定', '元回EP-ID', '元回タイトル', '照合', '判定（すべてHOLD）', '蔵'], reRows); S.再配信_内訳 = rr;
  // 6. Spotify: 蔵に公開中で、V2に検証済み Spotify URL がある回（プレイリスト照合・追加は本番の既存関数で）
  var sp = []; Object.keys(lib.eps).forEach(function (id) { var r = pub[id]; var u = r ? r[P.c('Spotify')] : ''; if (/^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}/.test(u)) sp.push([id, lib.eps[id].show, lib.eps[id].title, u.replace(/\?.*$/, ''), '未検証（URL形式のみ一致。検証状態の列がV2に無い）', '自動追加しない']); });
  S.Spotify候補_未検証 = kaWrite_(OUT, '蔵監査・Spotify候補', ['EP-ID', '番組', 'タイトル', 'Spotify URL（V2）', '検証', 'プレイリスト'], sp);
  // 5'. 概要HOLD: 同期時(PR #335)の244件 と HOLD監査・明細(HA_2) のEP-ID集合差
  var h244 = (kaGz_(KA_CFG.syncLog).runs.slice(-1)[0].protected || {})['V2概要が表示整形でHOLD']; if (!Array.isArray(h244)) throw new Error('SYNCLOG_HOLD_NOT_FOUND');
  var HA = kaTable_(copy, 'HOLD監査・明細'), haIds = {}; HA.rows.forEach(function (r) { if (r[HA.c('EP-ID')]) haIds[r[HA.c('EP-ID')]] = 1; });
  var s244 = {}; h244.forEach(function (id) { s244[id] = 1; });
  var hd = h244.filter(function (id) { return !haIds[id]; }).map(function (id) { return [id, '同期244にだけある']; }).concat(Object.keys(haIds).filter(function (id) { return !s244[id]; }).map(function (id) { return [id, 'HA_2にだけある']; }));
  S.HOLD集合差 = kaWrite_(OUT, '蔵監査・HOLD集合差', ['EP-ID', '差'], hd); S.HOLD_同期 = h244.length; S.HOLD_HA2 = Object.keys(haIds).length;
  S.蔵 = Object.keys(lib.eps).length; S.V2公開 = Object.keys(pub).length; S.版 = KA_VERSION; S.秒 = Math.round((Date.now() - t0) / 1000);
  var sum = [['項目', '値']]; Object.keys(S).forEach(function (k) { sum.push([k, typeof S[k] === 'object' ? JSON.stringify(S[k]) : String(S[k])]); });
  kaWrite_(OUT, '蔵監査・集計', sum[0], sum.slice(1));
  if (S.蔵 !== lib.manifest.total || S.V2公開 < 1) throw new Error('SUMMARY_INVALID');
  kaCommit_(copy, OUT);
  Logger.log(JSON.stringify(S)); return S;
}
