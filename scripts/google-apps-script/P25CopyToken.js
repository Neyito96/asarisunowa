// Phase25 COPY-only Spotify token handling. Reflect ONLY into the standalone COPY GAS project.
//
// Properties (all in the COPY project's own Script Properties; names are fixed and must start with P25_COPY_SPOTIFY_):
//   P25_COPY_SPOTIFY_ACCESS_TOKEN / _REFRESH_TOKEN / _EXPIRES_AT (epoch ms) / _CLIENT_ID / _CLIENT_SECRET (optional with PKCE)
//   P25_COPY_SPOTIFY_REAUTH_REQUIRED ("1" after invalid_grant: stops every refresh until a new OAuth stores tokens)
//   P25_COPY_SPOTIFY_REFRESH_NOT_BEFORE (epoch ms backoff after 429 / failure)
// Secrets are never logged, never put into error messages and never returned.
// The ONLY POST this file can send goes to accounts.spotify.com/api/token (grant_type=refresh_token).
// It makes no other network call, so it cannot read or change any Spotify content.
const P25_COPY_TOK_PREFIX_ = "P25_COPY_SPOTIFY_";
const P25_COPY_TOK_ENDPOINT_ = "https://accounts.spotify.com/api/token";
const P25_COPY_TOK_PRODUCTION_SCRIPTS_ = ["1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9"];

function p25CopyTokAssertCopy_(config) {
  const id = ScriptApp.getScriptId();
  if (!config || config.environment !== "COPY" || !config.copyScriptId || id !== config.copyScriptId || P25_COPY_TOK_PRODUCTION_SCRIPTS_.indexOf(id) >= 0) throw new Error("COPY_ISOLATION_REQUIRED");
}
function p25CopyTokKey_(name) { return P25_COPY_TOK_PREFIX_ + name; }
function p25CopyTokError_(message, status, retryAfterSeconds) {
  const error = new Error(message);
  if (status) error.status = status;
  if (retryAfterSeconds) error.retryAfterSeconds = retryAfterSeconds;
  return error;
}
function p25CopyTokRead_() {
  const props = PropertiesService.getScriptProperties();
  const get = function(name) { return String(props.getProperty(p25CopyTokKey_(name)) || "").trim(); };
  return { access: get("ACCESS_TOKEN"), refresh: get("REFRESH_TOKEN"), expiresAt: Number(get("EXPIRES_AT")) || 0, reauth: get("REAUTH_REQUIRED") === "1", notBefore: Number(get("REFRESH_NOT_BEFORE")) || 0 };
}

// Stores a token response (OAuth callback or refresh). A returned refresh_token replaces the old one; a missing one keeps it.
// The OAuth callback must call this instead of discarding refresh_token.
function p25CopyTokStore_(config, data, nowMs) {
  p25CopyTokAssertCopy_(config);
  const access = String(data && data.access_token || "").trim();
  if (!access) throw p25CopyTokError_("COPY_TOKEN_RESPONSE_INVALID");
  const seconds = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600;
  const refresh = String(data.refresh_token || "").trim();
  const props = PropertiesService.getScriptProperties();
  const had = Boolean(p25CopyTokRead_().refresh);
  if (refresh) props.setProperty(p25CopyTokKey_("REFRESH_TOKEN"), refresh);   // refresh first: a half-written state never loses it
  props.setProperty(p25CopyTokKey_("ACCESS_TOKEN"), access);
  props.setProperty(p25CopyTokKey_("EXPIRES_AT"), String((nowMs || Date.now()) + seconds * 1000));
  props.deleteProperty(p25CopyTokKey_("REAUTH_REQUIRED"));
  props.deleteProperty(p25CopyTokKey_("REFRESH_NOT_BEFORE"));
  return { stored: true, refreshTokenPresent: Boolean(refresh) || had, refreshTokenReplaced: Boolean(refresh) };
}

// The only place that talks to the token endpoint.
function p25CopyTokRefreshPost_(config, refreshToken, nowMs) {
  const props = PropertiesService.getScriptProperties();
  const clientId = String(props.getProperty(p25CopyTokKey_("CLIENT_ID")) || "").trim();
  const clientSecret = String(props.getProperty(p25CopyTokKey_("CLIENT_SECRET")) || "").trim();
  if (!clientId) throw p25CopyTokError_("COPY_CLIENT_CREDENTIALS_REQUIRED");
  const payload = { grant_type: "refresh_token", refresh_token: refreshToken };
  const headers = { Accept: "application/json" };
  if (clientSecret) headers.Authorization = "Basic " + Utilities.base64Encode(clientId + ":" + clientSecret); else payload.client_id = clientId;
  const response = UrlFetchApp.fetch(P25_COPY_TOK_ENDPOINT_, { method: "post", payload: payload, headers: headers, muteHttpExceptions: true });
  const status = response.getResponseCode();
  const backoff = function(seconds) { props.setProperty(p25CopyTokKey_("REFRESH_NOT_BEFORE"), String(nowMs + seconds * 1000)); };
  if (status === 429) {
    let retry = 60;
    try { const h = response.getAllHeaders(); retry = Number(h["Retry-After"] || h["retry-after"] || 60) || 60; } catch (_) {}
    backoff(retry);
    throw p25CopyTokError_("COPY_TOKEN_REFRESH_RATE_LIMITED", 429, retry);
  }
  if (status === 400 || status === 401) {            // invalid_grant / invalid_client: retrying cannot help, a new OAuth is required
    props.setProperty(p25CopyTokKey_("REAUTH_REQUIRED"), "1");
    throw p25CopyTokError_("COPY_REAUTH_REQUIRED", status);
  }
  if (status !== 200) { backoff(60); throw p25CopyTokError_("COPY_TOKEN_REFRESH_FAILED", status); }
  let data;
  try { data = JSON.parse(response.getContentText() || "{}"); } catch (_) { backoff(60); throw p25CopyTokError_("COPY_TOKEN_RESPONSE_INVALID", status); }
  if (!String(data.access_token || "").trim()) { backoff(60); throw p25CopyTokError_("COPY_TOKEN_RESPONSE_INVALID", status); }
  p25CopyTokStore_(config, data, nowMs);
  return String(data.access_token).trim();
}

// Returns a usable access token, refreshing at most once per call.
// options.rejected: the token that just got HTTP 401 (forces one refresh unless somebody already replaced it).
function p25CopyTokGet_(config, options) {
  options = options || {};
  p25CopyTokAssertCopy_(config);
  const now = options.nowMs || Date.now();
  const skew = Number(config.tokenRefreshSkewSeconds || 300) * 1000;
  const valid = function(t) { return t.access && t.expiresAt > now + skew; };
  let t = p25CopyTokRead_();
  if (!t.access && !t.refresh) throw p25CopyTokError_("COPY_TOKEN_REQUIRED");
  if (options.rejected) { if (t.access && t.access !== options.rejected) return t.access; }
  else if (valid(t)) return t.access;
  else if (!t.expiresAt && t.access && !t.refresh) return t.access;      // legacy token without expiry and nothing to refresh with
  if (t.reauth) throw p25CopyTokError_("COPY_REAUTH_REQUIRED");
  if (!t.refresh) throw p25CopyTokError_("COPY_REAUTH_REQUIRED");        // expired / rejected and no refresh token stored
  if (t.notBefore > now) throw p25CopyTokError_("COPY_TOKEN_REFRESH_BACKOFF", 429, Math.ceil((t.notBefore - now) / 1000));
  // Per-user lock (all COPY runs are the same operator); taken after any Script lock the caller holds, never the other way round.
  const lock = LockService.getUserLock();
  if (!lock.tryLock(10000)) throw p25CopyTokError_("COPY_TOKEN_LOCK_BUSY");
  try {
    t = p25CopyTokRead_();                                               // another execution may have refreshed meanwhile
    if (options.rejected ? (t.access && t.access !== options.rejected) : valid(t)) return t.access;
    if (t.reauth || !t.refresh) throw p25CopyTokError_("COPY_REAUTH_REQUIRED");
    if (t.notBefore > now) throw p25CopyTokError_("COPY_TOKEN_REFRESH_BACKOFF", 429, Math.ceil((t.notBefore - now) / 1000));
    return p25CopyTokRefreshPost_(config, t.refresh, now);
  } finally { lock.releaseLock(); }
}

// Read-only summary for the administrator (booleans and times only; no secrets).
function p25CopyTokStatus_(config, nowMs) {
  p25CopyTokAssertCopy_(config);
  const now = nowMs || Date.now(), t = p25CopyTokRead_();
  return { accessTokenPresent: Boolean(t.access), refreshTokenPresent: Boolean(t.refresh), expiresAt: t.expiresAt ? new Date(t.expiresAt).toISOString() : "", expiresInSeconds: t.expiresAt ? Math.round((t.expiresAt - now) / 1000) : null, reauthRequired: t.reauth, refreshBackoffSeconds: t.notBefore > now ? Math.ceil((t.notBefore - now) / 1000) : 0 };
}
