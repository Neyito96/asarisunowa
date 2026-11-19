// SpotifyCooldown.js — Spotify に「呼びすぎ（429）」で止められた時の待機（2026-11-19）。
// 429 の Retry-After（秒）を覚えておき、その間は Spotify を呼ばない処理（表紙・最終新着の読み取り、取りこぼし回収）で使う。
// 止められている間に呼び続けると解除が遅れるおそれがあるため。
var SPOTIFY_COOLDOWN_KEY_ = 'SPOTIFY_COOLDOWN_UNTIL';

// 待機中なら解除予定時刻（ISO）、そうでなければ ''
function spotifyCooldownUntil_() {
  var v = PropertiesService.getScriptProperties().getProperty(SPOTIFY_COOLDOWN_KEY_) || '';
  return v && new Date(v).getTime() > Date.now() ? v : '';
}

// 応答が 429 なら待機を記録して true（Retry-After が無ければ 60 秒）
function spotifyCooldownNote_(response) {
  if (!response || response.getResponseCode() !== 429) return false;
  var h = response.getAllHeaders() || {}, sec = Number(h['Retry-After'] || h['retry-after'] || 60) || 60;
  var until = new Date(Date.now() + Math.max(60, sec) * 1000).toISOString();
  if (until > (PropertiesService.getScriptProperties().getProperty(SPOTIFY_COOLDOWN_KEY_) || '')) {
    PropertiesService.getScriptProperties().setProperty(SPOTIFY_COOLDOWN_KEY_, until);
  }
  return true;
}

function SPOTIFY_COOLDOWN_STATUS() { var u = spotifyCooldownUntil_(); Logger.log(u ? '待機中: ' + u + ' まで' : '待機なし'); return u; }
