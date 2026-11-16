// 朝リスの蔵 → Spotify候補橋渡し（読み取り専用）
// 既存Spotify自動更新には接続しない。V2を読むだけで、候補をログに返す。
const ASARISU_V2_SHEET_ID_ = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
function previewAsarisuSpotifyCandidates() {
  var ss = SpreadsheetApp.openById(ASARISU_V2_SHEET_ID_);
  var sh = ss.getSheetByName('V2・統合台帳');
  if (!sh) throw new Error('V2・統合台帳が見つかりません。書込はしていません');
  var values = sh.getDataRange().getDisplayValues();
  var head = values.shift();
  function column(names) {
    for (var i = 0; i < names.length; i++) {
      var n = head.indexOf(names[i]);
      if (n >= 0) return n;
    }
    return -1;
  }
  var epCol = column(['EP-ID','EP ID']);
  var spotifyCol = column(['Spotify','Spotify URL','SpotifyURL']);
  var statusCol = column(['公開判定','公開区分','公開対象','採用区分']);
  var titleCol = column(['タイトル','エピソード名']);
  if (epCol < 0 || spotifyCol < 0) throw new Error('必須列がありません: ' + head.join(', '));
  var candidates = [], held = [], invalid = [];
  var ids = {};
  values.forEach(function(row) {
    var ep = String(row[epCol] || '').trim();
    var url = String(row[spotifyCol] || '').trim();
    var status = statusCol < 0 ? '' : String(row[statusCol] || '');
    var title = titleCol < 0 ? '' : String(row[titleCol] || '');
    if (!ep || !url) return;
    var match = url.match(/^https:\/\/open[.]spotify[.]com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
    if (!match) { invalid.push({ep:ep,url:url}); return; }
    // 未照合の再配信は自動追加しない。誤除外を避け、保留に分ける。
    if (/（再）|\(再\)|再配信/.test(title) || /重複|除外|保留|HOLD/i.test(status)) {
      held.push({ep:ep,spotifyId:match[1],reason:'再配信または除外・保留の確認待ち'});
      return;
    }
    if (ids[match[1]]) {
      held.push({ep:ep,spotifyId:match[1],reason:'Spotify ID重複',firstEp:ids[match[1]]});
      return;
    }
    ids[match[1]] = ep;
    candidates.push({ep:ep,spotifyId:match[1],uri:'spotify:episode:'+match[1],title:title});
  });
  var report = {status:'READ_ONLY',source:sh.getName(),scanned:values.length,
    candidates:candidates.length,held:held.length,invalid:invalid.length,
    sample:candidates.slice(0,20),heldSample:held.slice(0,20),invalidSample:invalid.slice(0,20),
    note:'Spotify API・プレイリストには接続も書込もしない。候補はまだ公開承認されていない。'};
  Logger.log(JSON.stringify(report,null,2));
  return report;
}
