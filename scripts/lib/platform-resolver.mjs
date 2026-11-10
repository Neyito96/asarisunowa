// 6サービス個別EP URL補完ボット (Issue #280)。純関数+注入式fetcher。ネットワーク・シート書込なし(proposalsを返すだけ)。
// #279 の base-ledger.mjs(個別EP形式判定・固定順)を再利用し、探索ロジックの重複を作らない。
import { PLATFORMS, isEpisodeLevel, urlMatchesPlatform, parseUrl, classifyRedistribution } from './base-ledger.mjs';

export const BOT_PLATFORMS = Object.freeze(['listen', 'spotify', 'apple', 'amazon', 'pocketcasts', 'pody']);
export const STATUS = Object.freeze(['VERIFIED', 'HOLD', 'NOT_FOUND', 'ERROR']);
const HOUR = 3600e3;
const s = (v) => (v == null ? '' : String(v).trim());

/** NFKC・小文字・空白/記号除去。表記揺れは吸収するが、数字・かな漢字は残す(#15と#16を混同しない)。 */
export const normTitle = (t) => s(t).normalize('NFKC').toLowerCase().replace(/[\s　\-–—_・:：;；,，.。!！?？'"“”‘’「」『』()（）\[\]【】#＃~〜]/g, '');
/** 台帳の日時(tz無しはJST)をepoch msへ。 */
export function toEpoch(v) {
  const t = s(v); if (!t) return NaN;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) return Date.parse(t);
  const m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/); if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], (m[4] ? +m[4] : 0) - 9, m[5] ? +m[5] : 0);
}
const jstDay = (ms) => Math.floor((ms + 9 * HOUR) / (24 * HOUR));
/** 公開日照合。day精度は±1日(タイムゾーン許容)、時刻精度は±12h。 */
export function dateCompatible(ledgerAt, candAt, precision = 'time') {
  const a = toEpoch(ledgerAt), b = toEpoch(candAt); if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return precision === 'day' ? Math.abs(jstDay(a) - jstDay(b)) <= 1 : Math.abs(a - b) <= 12 * HOUR;
}

/** retry_after(epoch ms)。429: Retry-After優先。5xx/timeout: 指数バックオフ(上限24h)。NOT_FOUND: 新着は短く、古い話は長く。 */
export function retryAfter({ kind, attempts = 0, retryAfterSec = null, now, ageDays = 0 }) {
  if (kind === 'RATE_LIMIT') return now + Math.max(60, Number(retryAfterSec) || 0) * 1000 + Math.min(attempts, 5) * 60e3;
  if (kind === 'TRANSIENT') return now + Math.min(24 * HOUR, 5 * 60e3 * 2 ** Math.min(attempts, 8));
  if (kind === 'NOT_FOUND') return now + (ageDays <= 7 ? 6 * HOUR : ageDays <= 60 ? 24 * HOUR : 7 * 24 * HOUR);
  return null;
}
/** プラットフォーム共有クールダウン: 429後は同一platformの呼出を止め、全EPを即ERROR(COOLDOWN)にせず次回へ回す。 */
export class CooldownGate {
  constructor() { this.until = new Map(); }
  blockedUntil(p, now) { const t = this.until.get(p) || 0; return t > now ? t : 0; }
  trip(p, until) { this.until.set(p, Math.max(this.until.get(p) || 0, until)); }
}
export class FetchError extends Error { constructor(kind, status, retryAfterSec) { super(`${kind}:${status}`); this.kind = kind; this.status = status; this.retryAfterSec = retryAfterSec ?? null; } }
export function classifyHttp(status, retryAfterSec) {
  if (status === 429) return new FetchError('RATE_LIMIT', 429, retryAfterSec);
  if (status === 404) return new FetchError('NOT_FOUND', 404);
  if (status >= 500 || status === 0 || status === 408) return new FetchError('TRANSIENT', status);
  return new FetchError('FATAL', status);
}

const rec = (i, platform, f) => ({ ep_id: i.epId, platform, entity_type: 'episode', url: '', external_id: '', evidence: [], checked_at: f.checkedAt, status: 'NOT_FOUND', reason: '', retry_after: null, ...f.over });

/** 1EP×1platform の探索。確定条件は厳格: 既存URL保護 → 強ID(GUID/外部ID) → 完全タイトル+日付+番組一致(唯一) 以外は HOLD。 */
export async function resolveOne(input, platform, { fetchers = {}, gate = new CooldownGate(), now = Date.now(), attempts = 0 } = {}) {
  const f = { checkedAt: new Date(now).toISOString(), over: {} }; const out = (o) => rec(input, platform, { ...f, over: o });
  const existing = s(input.existing?.[platform]);
  if (existing) {
    if (parseUrl(existing) && urlMatchesPlatform(existing, PLATFORMS.find((p) => p.key === platform)) && isEpisodeLevel(platform, existing)) return out({ url: existing, status: 'VERIFIED', reason: 'EXISTING_PROTECTED', evidence: ['existing-ledger-url'] });
    return out({ url: existing, entity_type: 'show', status: 'HOLD', reason: 'NON_EPISODE_URL_IN_EPISODE_CELL', evidence: ['existing-ledger-url'] }); // 修正は提案のみ。上書きしない
  }
  const fx = fetchers[platform];
  if (!fx) return out({ status: 'ERROR', reason: 'NO_VERIFIED_ROUTE', retry_after: retryAfter({ kind: 'TRANSIENT', attempts, now }) });
  const cd = gate.blockedUntil(platform, now);
  if (cd) return out({ status: 'ERROR', reason: 'COOLDOWN', retry_after: cd });
  let res;
  try { res = await fx.candidates(input); } catch (e) {
    const kind = e.kind || 'TRANSIENT';
    if (kind === 'RATE_LIMIT') { const ra = retryAfter({ kind, attempts, retryAfterSec: e.retryAfterSec, now }); gate.trip(platform, ra); return out({ status: 'ERROR', reason: 'HTTP_429', retry_after: ra, evidence: [`retry-after:${e.retryAfterSec ?? 'none'}`] }); }
    if (kind === 'NOT_FOUND') return out({ status: 'NOT_FOUND', reason: 'HTTP_404', retry_after: retryAfter({ kind: 'NOT_FOUND', now, ageDays: ageDays(input, now) }) });
    return out({ status: 'ERROR', reason: kind === 'FATAL' ? `HTTP_${e.status}` : 'TRANSIENT', retry_after: retryAfter({ kind: 'TRANSIENT', attempts, now }), evidence: [String(e.message)] });
  }
  // 個別EP形式でない候補(番組URL・検索結果URL)は候補から除外し、個別EP列に入れない。
  const expShow = s(input.showIds?.[platform]); const sameShow = (c) => !c.showId || !expShow || c.showId === expShow;
  const cands = (res.candidates || []).filter((c) => sameShow(c) && parseUrl(c.url) && urlMatchesPlatform(c.url, PLATFORMS.find((p) => p.key === platform)) && isEpisodeLevel(platform, c.url));
  const rejected = (res.candidates || []).filter((c) => sameShow(c)).length - cands.length, otherShow = (res.candidates || []).filter((c) => !sameShow(c)).length; const ev = [...(rejected ? [`rejected-non-episode:${rejected}`] : []), ...(otherShow ? [`rejected-other-show:${otherShow}`] : [])];
  const guid = s(input.guid).toLowerCase();
  const strong = cands.filter((c) => (guid && s(c.guid).toLowerCase() === guid) || (input.knownExternalIds || []).includes(c.externalId));
  if (strong.length === 1) return out({ url: strong[0].url, external_id: s(strong[0].externalId), status: 'VERIFIED', reason: 'STRONG_ID', evidence: [...ev, 'guid-or-external-id-match'] });
  if (strong.length > 1) return out({ status: 'HOLD', reason: 'AMBIGUOUS_STRONG_ID', evidence: strong.map((c) => c.url) });
  const nt = normTitle(input.title); const red = classifyRedistribution({ title: input.title });
  const titled = cands.filter((c) => normTitle(c.title) === nt && nt);
  const full = titled.filter((c) => dateCompatible(input.publishedAt, c.publishedAt, c.precision) && sameShow(c));
  if (full.length === 1 && !red.flag) return out({ url: full[0].url, external_id: s(full[0].externalId), status: 'VERIFIED', reason: 'TITLE_DATE_SHOW', evidence: [...ev, 'exact-normalized-title', 'date-compatible', 'show-scoped-unique'] });
  if (full.length > 1) return out({ status: 'HOLD', reason: 'AMBIGUOUS_MULTIPLE_MATCH', evidence: full.map((c) => c.url) });
  if (full.length === 1 && red.flag) return out({ url: full[0].url, status: 'HOLD', reason: 'REDISTRIBUTION_RISK_NEEDS_STRONG_ID', evidence: red.rules });
  if (titled.length) return out({ status: 'HOLD', reason: 'TITLE_ONLY_DATE_MISMATCH', evidence: titled.map((c) => c.url) });
  const similar = cands.filter((c) => { const n = normTitle(c.title); return n && nt && (n.includes(nt) || nt.includes(n)) && dateCompatible(input.publishedAt, c.publishedAt, c.precision); });
  if (similar.length) return out({ status: 'HOLD', reason: 'SIMILAR_ONLY_RENAMED_OR_EDITED', evidence: similar.map((c) => c.url) });
  return out({ status: 'NOT_FOUND', reason: 'NO_CANDIDATE', evidence: [...ev, `candidates:${cands.length}`], retry_after: retryAfter({ kind: 'NOT_FOUND', now, ageDays: ageDays(input, now) }) });
}
const ageDays = (i, now) => { const t = toEpoch(i.publishedAt); return Number.isNaN(t) ? 999 : (now - t) / (24 * HOUR); };

/** 全EP×6社。新着(若い順)優先、過去欠損は limit で低負荷バックフィル。state[ep|platform]=attempts を引き継ぐ。 */
export async function runBot(inputs, { fetchers = {}, now = Date.now(), limit = Infinity, backfillLimit = 50, state = {}, platforms = BOT_PLATFORMS } = {}) {
  const gate = new CooldownGate(); const recs = []; const calls = Object.fromEntries(platforms.map((p) => [p, 0])); let backfill = 0;
  const wrapped = Object.fromEntries(Object.entries(fetchers).map(([p, fx]) => [p, { candidates: async (i) => { calls[p]++; return fx.candidates(i); } }]));
  const ordered = [...inputs].sort((a, b) => toEpoch(b.publishedAt) - toEpoch(a.publishedAt));
  let n = 0;
  for (const i of ordered) for (const p of platforms) {
    const due = state[`${i.epId}|${p}`]?.retry_after; if (due && due > now) continue; // 再試行時刻前はスキップ
    const hasExisting = !!s(i.existing?.[p]); const old = ageDays(i, now) > 7;
    if (!hasExisting && n >= limit) continue;
    if (!hasExisting && old) { if (backfill >= backfillLimit) continue; backfill++; }
    if (!hasExisting) n++;
    recs.push(await resolveOne(i, p, { fetchers: wrapped, gate, now, attempts: state[`${i.epId}|${p}`]?.attempts || 0 }));
  }
  return { records: recs, apiCalls: calls };
}

/** 補完提案: 空欄セルへVERIFIEDのみ。非空欄は上書きしない。HOLD/ERROR/NOT_FOUNDは提案しない。冪等(同EP×platformは1件)。 */
export function planFills(records, ledgerCells = {}) {
  const seen = new Set(); const fills = [];
  for (const r of records) {
    if (r.status !== 'VERIFIED' || r.reason === 'EXISTING_PROTECTED') continue;
    const k = `${r.ep_id}|${r.platform}`; if (seen.has(k)) continue; seen.add(k);
    if (s(ledgerCells[k])) continue; // 既存非空欄は保護
    fills.push({ ep_id: r.ep_id, platform: r.platform, url: r.url, evidence: r.evidence, reason: r.reason, write: false });
  }
  return fills;
}
/** 次回state(attempts・retry_after)。成功は消す。 */
export function nextState(prev, records) {
  const st = { ...prev };
  for (const r of records) { const k = `${r.ep_id}|${r.platform}`; if (r.status === 'VERIFIED') delete st[k]; else if (r.retry_after) st[k] = { attempts: (prev[k]?.attempts || 0) + 1, retry_after: r.retry_after, reason: r.reason }; }
  return st;
}

/** 日次レポート(機械可読)。呼出0・補完0を成功扱いにしない(warnings)。routeVerified=false は未検証表示。前日差を付与。 */
export function buildReport(inputs, { records, apiCalls }, { previous = null, routes = {}, now = Date.now() } = {}) {
  const per = {};
  for (const p of BOT_PLATFORMS) {
    const rs = records.filter((r) => r.platform === p); const c = (st) => rs.filter((r) => r.status === st).length;
    per[p] = { targets: inputs.length, attempted: rs.length, blankAttempted: rs.filter((r) => r.reason !== 'EXISTING_PROTECTED' && r.reason !== 'NON_EPISODE_URL_IN_EPISODE_CELL').length, VERIFIED: c('VERIFIED'), newlyVerified: rs.filter((r) => r.status === 'VERIFIED' && r.reason !== 'EXISTING_PROTECTED').length, HOLD: c('HOLD'), NOT_FOUND: c('NOT_FOUND'), ERROR: c('ERROR'), apiCalls: apiCalls[p] || 0, routeVerified: routes[p] ?? false,
      retryScheduled: rs.filter((r) => r.retry_after).length };
    per[p].delta = previous?.platforms?.[p] ? Object.fromEntries(['VERIFIED', 'HOLD', 'NOT_FOUND', 'ERROR'].map((k) => [k, per[p][k] - (previous.platforms[p][k] || 0)])) : null;
  }
  const warnings = [];
  for (const [p, v] of Object.entries(per)) {
    if (v.blankAttempted > 0 && v.apiCalls === 0) warnings.push(`${p}: 空欄${v.blankAttempted}件に対しAPI呼出0(成功扱いしない)`);
    if (v.blankAttempted > 0 && v.newlyVerified === 0 && v.apiCalls > 0) warnings.push(`${p}: 補完候補0件(要原因確認)`);
    if (!v.routeVerified) warnings.push(`${p}: 実API経路は未検証(fixtureのみ)`);
    if (v.ERROR) warnings.push(`${p}: ERROR ${v.ERROR}件`);
  }
  return { generatedAt: new Date(now).toISOString(), episodes: inputs.length, platforms: per, warnings };
}
