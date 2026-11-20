// SpotifyCooldown.js — Spotify に「呼びすぎ（429）」で止められた時の待機（2026-11-19）。
// 429 の Retry-After（秒）を覚えておき、その間は Spotify を呼ばない処理（表紙・最終新着の読み取り、取りこぼし回収）で使う。
// 止められている間に呼び続けると解除が遅れるおそれがあるため。
var SPOTIFY_COOLDOWN_KEY_ = 'SPOTIFY_COOLDOWN_UNTIL';

// 待機中なら解除予定時刻（ISO）、そうでなければ ''
function spotifyCooldownUntil_() {
  var v = PropertiesService.getScriptProperties().getProperty(SPOTIFY_COOLDOWN_KEY_) || '';
  return v && new Date(v).getTime() > Date.now() ? v : '';
}

// 応答が 429 なら待機を記録して true（Retry-After が無ければ 60 秒）。
// 2026-11-20 #412: いつ・どの処理で・何秒待てと言われたかをログと SPOTIFY_COOLDOWN_LAST に残す（原因を後から確かめるため）
function spotifyCooldownNote_(response, caller) {
  if (!response || response.getResponseCode() !== 429) return false;
  var h = response.getAllHeaders() || {}, sec = Number(h['Retry-After'] || h['retry-after'] || 60) || 60;
  var until = new Date(Date.now() + Math.max(60, sec) * 1000).toISOString();
  var props = PropertiesService.getScriptProperties();
  if (until > (props.getProperty(SPOTIFY_COOLDOWN_KEY_) || '')) props.setProperty(SPOTIFY_COOLDOWN_KEY_, until);
  var rec = { event: 'spotify429', at: new Date().toISOString(), retryAfterSec: sec, until: until, caller: String(caller || '') };
  try { props.setProperty('SPOTIFY_COOLDOWN_LAST', JSON.stringify(rec)); } catch (e) {}
  Logger.log(JSON.stringify(rec));
  return true;
}

// 旧（SPOTIFY_COOLDOWN_UNTIL）・新（SPOTIFY_COOLDOWN_V2）どちらかで待機中なら解除予定（ISO）、そうでなければ ''
function spotifyAnyCooldown_() {
  var a = spotifyCooldownUntil_(), b = '';
  try { var v2 = typeof spotifyCooldownV2_ === 'function' ? spotifyCooldownV2_() : 0; if (v2 > Date.now()) b = new Date(v2).toISOString(); } catch (e) {}
  return a > b ? a : b;
}

// 定時処理の入口で使う: 待機中なら記録して true（その回は Spotify を一切呼ばずに終える）
function spotifySkipIfCooldown_(jobName) {
  var until = spotifyAnyCooldown_();
  if (!until) return false;
  Logger.log(JSON.stringify({ event: 'spotifyCooldownSkip', job: String(jobName || ''), until: until }));
  return true;
}

function SPOTIFY_COOLDOWN_STATUS() {
  var u = spotifyAnyCooldown_(), last = PropertiesService.getScriptProperties().getProperty('SPOTIFY_COOLDOWN_LAST') || '';
  Logger.log((u ? '待機中: ' + u + ' まで' : '待機なし') + (last ? ' / 直近の429: ' + last : ''));
  return u;
}
