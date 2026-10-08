// Shared app cooldown. GET cache exists only in this GAS execution and is scoped
// by bearer token, method and exact URL. No credential is persisted or logged.
const SPOTIFY_COOLDOWN_V2_ = "SPOTIFY_COOLDOWN_V2";
let spotifyReadCacheV2_ = {};

function spotifyCooldownStateV2_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty(SPOTIFY_COOLDOWN_V2_) || "{}");
}
function spotifyCooldownV2_() { return Number(spotifyCooldownStateV2_().until || 0); }
function spotifyWaitingReportV2_() {
  return { waiting: true, reason: "SPOTIFY_429", nextAttemptAt: spotifyCooldownV2_() };
}
function spotifyRetryDelayV2_(header, attempt, now) {
  const raw = String(header == null ? "" : header).trim();
  const seconds = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
  const date = seconds === null && raw ? Date.parse(raw) : NaN;
  const requested = seconds !== null ? seconds * 1000 : Number.isFinite(date) ? Math.max(0, date - now) : 0;
  return Math.max(requested, Math.min(3600000, 30000 * Math.pow(2, Math.min(attempt - 1, 7)))) + 1000;
}
function spotifyRecord429V2_(response, target) {
  const props = PropertiesService.getScriptProperties(), now = Date.now();
  const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
  const key = Object.keys(headers).find(function(k) { return k.toLowerCase() === "retry-after"; });
  const retryAfter = key ? String(headers[key]) : "";
  const prior = spotifyCooldownStateV2_();
  let body = {}; try { body = JSON.parse(response.getContentText()); } catch (_) {}
  const attempt = Number(prior.attempt || 0) + 1;
  const state = { until: Math.max(Number(prior.until || 0), now + spotifyRetryDelayV2_(retryAfter, attempt, now)),
    attempt: attempt, count: Number(prior.count || 0) + 1, retryAfter: retryAfter,
    reason: String(body.reason || body.error && body.error.reason || "RATE_LIMITED"), target: String(target || ""), at: now };
  props.setProperty(SPOTIFY_COOLDOWN_V2_, JSON.stringify(state));
  Logger.log(JSON.stringify({ event: "spotify429", retryAfter: retryAfter, count: state.count,
    reason: state.reason, resumeTarget: state.target, nextAttemptAt: state.until }));
  return state;
}
function spotifyLegacyFetchV2_(url, options, context) {
  if (!/^https:\/\/api\.spotify\.com\/v1\//.test(String(url))) return UrlFetchApp.fetch(url, options);
  if (spotifyCooldownV2_() > Date.now()) throw new Error("SPOTIFY_429_WAIT_UNTIL_" + spotifyCooldownV2_());
  const method = String(options && options.method || "get").toLowerCase();
  const authorization = String(options && options.headers && options.headers.Authorization || "");
  const cacheKey = authorization + "|" + url;
  if (method === "get" && spotifyReadCacheV2_[cacheKey]) {
    if (context) context.cacheHits += 1;
    return spotifyReadCacheV2_[cacheKey];
  }
  if (context && (context.calls >= context.maxCalls || Date.now() >= context.deadline)) throw new Error("THEME_BUDGET_YIELD");
  if (context) context.calls += 1;
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 429) {
    spotifyRecord429V2_(response, context && context.target || method + " " + String(url).split("?")[0]);
    if (context) context.rateLimits += 1;
    throw new Error("SPOTIFY_429_WAIT_UNTIL_" + spotifyCooldownV2_());
  }
  if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
    if (method === "get") spotifyReadCacheV2_[cacheKey] = response;
    else {
      const prefix=String(url).split("/items")[0];
      Object.keys(spotifyReadCacheV2_).forEach(function(key) { if(key.indexOf(prefix)>=0)delete spotifyReadCacheV2_[key]; });
    }
    const prior = spotifyCooldownStateV2_();
    if (prior.attempt) {
      prior.attempt = 0;
      PropertiesService.getScriptProperties().setProperty(SPOTIFY_COOLDOWN_V2_, JSON.stringify(prior));
    }
  }
  return response;
}
function spotifyJsonV2_(path, token, context, method, body) {
  const url = path.startsWith("https://") ? path : "https://api.spotify.com/v1/" + path;
  if (!/^https:\/\/api\.spotify\.com\/v1\//.test(url)) throw new Error("INVALID_SPOTIFY_NEXT_URL");
  const options = { method: method || "get", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" } };
  if (body) { options.contentType = "application/json"; options.payload = JSON.stringify(body); }
  const res = spotifyLegacyFetchV2_(url, options, context), code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("SPOTIFY_HTTP_" + code);
  return JSON.parse(res.getContentText() || "{}");
}
