// RX-1 蔵の関連記事に「見出し」を付けるための書き出し（Issue #308）
// V2作業用台帳の「V2・清掃詳細」（SC4-18 が原文から作った 見出し＋URL の組）を読むだけ。どこにも書かない。
// 公開対象（V2・統合台帳で 掲載判定=対象・代表EP-ID=自分）の回だけを、見出しとURLが両方ある記事に限って返す。
// GitHub Actions がこの URL を読んで public/library/data の relatedArticles を作る（Claude に全件を通さない）。
var RX_VERSION = 'RX-1', RX_V2_ID = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
function rxBuild_() {
  var ss = SpreadsheetApp.openById(RX_V2_ID);
  var L = ss.getSheetByName('V2・統合台帳').getDataRange().getValues(), lh = L[0];
  var iE = lh.indexOf('EP-ID'), iJ = lh.indexOf('掲載判定'), iR = lh.indexOf('代表EP-ID');
  var pub = {}; L.slice(1).forEach(function (r) { var ep = String(r[iE]); if (r[iJ] === '対象' && String(r[iR] || ep) === ep) pub[ep] = 1; });
  var C = ss.getSheetByName('V2・清掃詳細').getDataRange().getValues(), ch = C[0], cE = ch.indexOf('EP-ID'), cJ = ch.indexOf('関連記事JSON(見出し+URL)');
  var out = {}, n = 0, skipped = 0;
  C.slice(1).forEach(function (r) {
    var ep = String(r[cE]); if (!pub[ep]) return;
    var a = []; try { a = JSON.parse(String(r[cJ] || '[]')) || []; } catch (e) { skipped++; return; }
    var pairs = a.filter(function (p) { return p && p.kind === 'article' && p.title && /^https:\/\//.test(p.url || ''); }).map(function (p) { return [String(p.title).slice(0, 200), String(p.url)]; });
    if (pairs.length) { out[ep] = pairs; n += pairs.length; }
  });
  return { ok: true, version: RX_VERSION, generatedAt: new Date().toISOString(), episodes: Object.keys(out).length, pairs: n, badJson: skipped, related: out };
}
function doGet(e) {
  var type = e && e.parameter && e.parameter.type;
  if (type !== 'libraryRelated') return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown type' })).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(JSON.stringify(rxBuild_())).setMimeType(ContentService.MimeType.JSON);
}
function RX_1_関連記事見出し_件数確認() { var r = rxBuild_(); Logger.log(JSON.stringify({ episodes: r.episodes, pairs: r.pairs, badJson: r.badJson })); return { episodes: r.episodes, pairs: r.pairs, badJson: r.badJson }; }
