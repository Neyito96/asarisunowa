// #395【読み取り専用】SDGsを話そう アーカイブ（Spotify 番組 7vuSolzvNiNwu7UR4lVIwU）の全回の一覧を取得して、実行ログに出す。
// 台帳・シート・プレイリストには一切書き込まない。プロパティも変えない（利用制限の記録 SPOTIFY_COOLDOWN_UNTIL だけは既存の仕組みどおり更新されうる）。
// 使い方: エディタで SDGS_ARCHIVE_LIST_READ_ONLY を実行 → 実行ログの「SDGSARC|」で始まる行をすべて写し、
//         node scripts/library/sdgs-archive-map.mjs <写したテキスト> で蔵の回と突き合わせる（題名＋配信日。一致しない回は保留）
var SDGS_ARCHIVE_SHOW_ID_ = '7vuSolzvNiNwu7UR4lVIwU';

function SDGS_ARCHIVE_LIST_READ_ONLY() {
  var until = spotifyCooldownUntil_();
  if (until) { Logger.log('Spotify の利用制限中のため取得しません: ' + until); return { ok: false, cooldown: until }; }
  var token = getSpotifyAccessToken();
  if (!token) { Logger.log('Spotify のトークンが取れません'); return { ok: false }; }
  var rows = [], offset = 0, total = null, calls = 0;
  while (total === null || offset < total) {
    if (calls >= 30) { Logger.log('呼び出し上限（30回）で止めました'); break; }
    var res = UrlFetchApp.fetch('https://api.spotify.com/v1/shows/' + SDGS_ARCHIVE_SHOW_ID_ + '/episodes?market=JP&limit=50&offset=' + offset,
      { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    calls++;
    var code = res.getResponseCode();
    if (code === 429) { spotifyCooldownNote_(res); Logger.log('429 で止めました（offset ' + offset + '）'); break; }
    if (code < 200 || code >= 300) { Logger.log('HTTP ' + code + ' で止めました（offset ' + offset + '）'); break; }
    var data = JSON.parse(res.getContentText());
    total = data.total;
    (data.items || []).forEach(function (it) { if (it && it.id) rows.push([it.id, it.release_date || '', String(it.name || '').replace(/[|\n]/g, ' ').slice(0, 80)].join('\t')); });
    if (!data.items || !data.items.length) break;
    offset += data.items.length;
    Utilities.sleep(400);
  }
  Logger.log('SDGSARC|META\ttotal=' + total + '\tgot=' + rows.length + '\tcalls=' + calls);
  var chunk = [];
  rows.forEach(function (r, k) { chunk.push(r); if (chunk.length === 60 || k === rows.length - 1) { Logger.log('SDGSARC|' + chunk.join('\n')); chunk = []; } });
  return { ok: true, total: total, got: rows.length, calls: calls };
}
