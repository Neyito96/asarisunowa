// 基本台帳v1 (Issue #278 / PR #279) — pure functions. No I/O, no network, never mutates inputs.
// 方針: 原本を守る → 検索に載せる → 表示を整理する。元台帳の列・タブ・EP-IDは一切変更しない。
import { editDescription } from '../../public/library/description-editor.mjs';

/** 0-based 台帳列(本番55列ヘッダを司令塔が実測: 2026-11-10)。 */
export const LEDGER_COL = Object.freeze({
  id: 0, show: 1, title: 2, datetime: 3, medium: 4, source: 5, guid: 6,
  originPage: 8 /* I 元ページURL */, officialPage: 9 /* J 公式個別URL */, audioUrl: 14 /* O */,
  descRaw: 21 /* V */, descClean: 22 /* W */, castRaw: 23 /* X 出演者・スタッフ */, relatedUrls: 28 /* AC */,
  humanExclude: 38 /* AM */, ytAux: 43 /* AR YouTube補助 */, rss: 44 /* AS 番組RSS */,
  cast1: 45, cast5: 49, castEvidence: 50 /* AY */,
});

const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const segs = (u) => u.pathname.split('/').filter(Boolean);
/** 各プラットフォームの「個別エピソード」判定。番組トップ・RSS・不明形式は false(=confirmedにしない)。 */
const EP = {
  asahi: (u) => !/\/pr\//.test(u.pathname) && (/^\/articles\//.test(u.pathname) || /\/episodes?\/[^/]+/.test(u.pathname) || /^\/special\/podcasts\/[^/]+\/[^/]+/.test(u.pathname)),
  omny: (u) => (/(^|\.)omny\.fm$/.test(u.hostname) && /^\/shows\/[^/]+\/(?:[^/]+\/)?[^/]+/.test(u.pathname) && segs(u).length >= 3)
    || (!/\.rss$/i.test(u.pathname) && !/\/playlist\//.test(u.pathname) && (/\.(mp3|m4a|aac)$/i.test(u.pathname) || /\/clips\//.test(u.pathname)))
    || (/megaphone\.fm$/.test(u.hostname) && (/\.mp3$/i.test(u.pathname) || /\/episodes\/[^/]+/.test(u.pathname))) || /(^|\.)pdst\.fm$/.test(u.hostname) && segs(u).length >= 1,
  listen: (u) => /^\/p\/[^/]+\/[^/]+/.test(u.pathname),
  spotify: (u) => /^\/episode\/[A-Za-z0-9]+/.test(u.pathname),
  apple: (u) => /[?&]i=\d+/.test(u.search),
  amazon: (u) => /\/podcasts\/[^/]+\/episodes\/[^/]+/.test(u.pathname),
  pocketcasts: (u) => (/(^|\.)pca\.st$/.test(u.hostname) && /^\/episode\/[^/]+/.test(u.pathname)) || new RegExp(`^/podcasts?/${ID}/${ID}`, 'i').test(u.pathname),
  pody: (u) => /^\/player\/[^/]+\/[^/]+/.test(u.pathname),
  youtube: (u) => (/youtube\.com$/.test(u.hostname) && u.pathname === '/watch' && u.searchParams.has('v')) || (/^youtu\.be$/.test(u.hostname) && segs(u).length === 1),
};

/** 固定順(司令塔指定): 朝日公式→Omny/Megaphone→LISTEN→Spotify→Apple→Amazon→PocketCasts→Pody→YouTube補助。col=台帳0-based列。 */
export const PLATFORMS = Object.freeze([
  { key: 'asahi', label: '朝日新聞公式個別URL', type: 'episode', cols: [9, 8], hosts: [/(^|\.)asahi\.com$/] },
  { key: 'omny', label: 'Omny/Megaphone元配信・音声', type: 'audio', cols: [14], hosts: [/(^|\.)omny\.fm$/, /(^|\.)omnycontent\.com$/, /megaphone\.fm$/, /(^|\.)pdst\.fm$/] },
  { key: 'listen', label: 'LISTEN', type: 'episode', cols: [10], hosts: [/(^|\.)listen\.style$/] },
  { key: 'spotify', label: 'Spotify', type: 'episode', cols: [11], hosts: [/(^|\.)open\.spotify\.com$/] },
  { key: 'apple', label: 'Apple Podcasts', type: 'episode', cols: [12], hosts: [/(^|\.)podcasts\.apple\.com$/] },
  { key: 'amazon', label: 'Amazon Music', type: 'episode', cols: [40], hosts: [/(^|\.)music\.amazon\.[a-z.]+$/] },
  { key: 'pocketcasts', label: 'Pocket Casts', type: 'episode', cols: [41], hosts: [/(^|\.)pocketcasts\.com$/, /(^|\.)pca\.st$/] },
  { key: 'pody', label: 'Pody', type: 'episode', cols: [42], hosts: [/(^|\.)pody\.jp$/] },
  { key: 'youtube', label: '正規音声EP付随YouTube動画', type: 'video', cols: [43], hosts: [/(^|\.)youtube\.com$/, /^youtu\.be$/] },
]);
export const PLATFORM_ORDER = Object.freeze(PLATFORMS.map((p) => p.key));
export const LINK_STATUS = Object.freeze(['confirmed', 'candidate', 'hold', 'not_found', 'unavailable', 'not_supported']);

/** P15_PLATFORM_STATUS.STATE/REASON → 正規化。未知の状態は「未発見」と断定せず hold。 */
export function mapP15State(state, reason) {
  const r = String(reason || '');
  if (state === 'EXISTING_VERIFIED' || state === 'VERIFIED') return { status: 'confirmed', retryable: false };
  if (/^NOT_SUPPORTED|NO_SUCH_PLATFORM/.test(r)) return { status: 'not_supported', retryable: false };
  if (/^HTTP_(4\d\d|5\d\d)$|BUDGET_DEFERRED|METADATA_UNAVAILABLE|TIMEOUT/.test(r)) return { status: 'unavailable', retryable: true };
  if (/NO_MATCH/.test(r)) return { status: 'not_found', retryable: true };
  if (/AMBIGUOUS|INCOMPLETE|CANDIDATE/.test(r)) return { status: 'candidate', retryable: true };
  if (state === 'UNAVAILABLE') return { status: 'unavailable', retryable: true };
  return { status: 'hold', retryable: true };
}

const s = (v) => (v == null ? '' : String(v).trim());
export const splitUrls = (v) => s(v).split(/[\s\n]+/).filter((x) => parseUrl(x));
export function parseUrl(v) { try { const u = new URL(s(v)); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
export function urlMatchesPlatform(url, platform) { const u = parseUrl(url); return !!u && platform.hosts.some((h) => h.test(u.hostname)); }
export function isEpisodeLevel(platformKey, url) { const u = parseUrl(url); return !!u && !!EP[platformKey]?.(u); }

/**
 * EP×platform 正規化表(固定順)。既存URLは1件も捨てない:
 *  - ホスト一致かつ個別EP形式 → confirmed
 *  - 値あり・ホスト不一致/番組URL/形式不明 → hold(原文保持。自動confirmed禁止)
 *  - 空欄 → P15状態の写像、なければ not_found(probed:false。空欄≠存在しない=再探索対象)
 * 追加の hold 候補(同一EPの別列)も1URL1レコードで残す。
 */
export function buildPlatformLinks(rows, p15 = [], { asOf = null } = {}) {
  const p15Idx = new Map(); for (const p of p15) p15Idx.set(`${p['EP-ID']}|${p.SERVICE}`, p);
  const svc = { listen: 'LISTEN', spotify: 'Spotify', apple: 'Apple Podcasts', amazon: 'Amazon Music', pocketcasts: 'Pocket Casts', pody: 'Pody' };
  const out = [];
  for (const row of rows) {
    const ep = s(row[LEDGER_COL.id]); if (!ep) continue;
    PLATFORMS.forEach((pf, order) => {
      const own = pf.cols.flatMap((c) => splitUrls(row[c]).map((u) => ({ u, col: c })));
      const good = own.filter(({ u }) => urlMatchesPlatform(u, pf) && isEpisodeLevel(pf.key, u));
      const seen = new Set();
      for (const { u, col } of good) { if (seen.has(u)) continue; seen.add(u); out.push({ ep_id: ep, platform: pf.key, type: pf.type, order, url: u, status: 'confirmed', retryable: false, evidence: `ledger-col-${col + 1}`, last_checked: asOf || '', probed: true }); }
      // 当該プラットフォーム専用列に入っている未確定URL(番組URL/ホスト違い)は hold として原文保持。(asahiのAC列は他社URLを含むため除外)
      const ownHold = own;
      for (const { u } of ownHold) { if (seen.has(u)) continue; seen.add(u); out.push({ ep_id: ep, platform: pf.key, type: pf.type, order, url: u, status: 'hold', retryable: true, evidence: 'ledger-value-not-episode-level-or-host-mismatch', last_checked: asOf || '', probed: true }); }
      if (!good.length && !ownHold.length) {
        const p = p15Idx.get(`${ep}|${svc[pf.key]}`);
        if (p) { const m = mapP15State(p.STATE, p.REASON); out.push({ ep_id: ep, platform: pf.key, type: pf.type, order, url: s(p.URL), status: m.status, retryable: m.retryable, evidence: s(p.EVIDENCE_URL) || `P15:${s(p.REASON)}`, last_checked: s(p.CHECKED_UTC) || asOf || '', probed: true }); }
        else out.push({ ep_id: ep, platform: pf.key, type: pf.type, order, url: '', status: 'not_found', retryable: true, evidence: 'blank-cell-no-probe-record', last_checked: asOf || '', probed: false });
      }
    });
  }
  return out;
}

// ---- 除外 ----
export const EXCLUDED_SHOWS = Object.freeze(['アルキキ', 'AJW', '朝ポキTV']);
/** 人間除外(AM列): 本番実測 未指定6,511/空白120。除外確定は明示allowlistのみ。未知値は除外せず hold(fail-closed=掲載を消さない)。 */
export const HUMAN_NOT_EXCLUDED = Object.freeze(['', '未指定', 'なし', 'false', '0', 'no']);
export const HUMAN_EXCLUDE_CONFIRMED = Object.freeze(['除外', '除外済み', '除外確定', '人間除外', 'exclude', 'excluded', 'true', 'yes', '1']);
const nrm = (v) => s(v).normalize('NFKC').toLowerCase();
export function classifyHumanExclude(v) {
  const n = nrm(v);
  if (HUMAN_NOT_EXCLUDED.includes(n)) return 'none';
  if (HUMAN_EXCLUDE_CONFIRMED.includes(n)) return 'excluded';
  return 'unknown';
}
export function isYouTube(url) { const u = parseUrl(url); return !!u && /(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname); }
/** 除外判定。kind: show / human / youtube_origin / null。unknown人間除外値は excluded:false + holdReason。 */
export function classifyExclusion(row) {
  const show = s(row[LEDGER_COL.show]);
  const links = [LEDGER_COL.audioUrl, LEDGER_COL.originPage, LEDGER_COL.officialPage, LEDGER_COL.relatedUrls, LEDGER_COL.ytAux, 10, 11, 12, 40, 41, 42].flatMap((c) => splitUrls(row[c]));
  const yt = links.filter(isYouTube); const nonYt = links.some((l) => !isYouTube(l)); const audio = parseUrl(row[LEDGER_COL.audioUrl]);
  if (EXCLUDED_SHOWS.includes(show)) return { excluded: true, kind: 'show', reason: `対象外番組(${show})`, auxVideoUrls: yt, holdReason: '' };
  const h = classifyHumanExclude(row[LEDGER_COL.humanExclude]);
  if (h === 'excluded') return { excluded: true, kind: 'human', reason: '人間除外', auxVideoUrls: yt, holdReason: '' };
  if (yt.length && !audio && !nonYt) return { excluded: true, kind: 'youtube_origin', reason: 'YouTube由来のみ(音声版なし)', auxVideoUrls: yt, holdReason: '' };
  return { excluded: false, kind: null, reason: '', auxVideoUrls: yt, holdReason: h === 'unknown' ? `人間除外の未知値「${s(row[LEDGER_COL.humanExclude])}」→要確認(除外しない)` : '' };
}

// ---- 再配信 (おんさ speakers3.js 表示計数ルールの「ルール」のみ再実装) ----
const REDIST_MARKERS = ['（再）', '(再)', '（ふりかえり）', '（深掘り）', '再放送です'];
export function classifyRedistribution({ title, durationSec } = {}, evidence = {}) {
  const t = s(title); const hits = REDIST_MARKERS.filter((m) => t.includes(m));
  const zero = durationSec != null && durationSec !== '' && Number(durationSec) <= 0;
  const proof = !!(evidence.sameGuidAs || evidence.originalUrl || evidence.frozenDecision === '再配信');
  if (!hits.length && !zero && evidence.frozenDecision !== '再配信') return { flag: '', rules: [], evidence: null, hideFromNormalDisplay: false };
  return { flag: proof ? '再配信' : '再配信候補(HOLD)', rules: [...hits, ...(zero ? ['duration<=0'] : [])], evidence: proof ? { ...evidence } : null, hideFromNormalDisplay: proof };
}

// ---- 出演者 ----
/** AT〜AX(確認済み個別氏名)を優先。X(原文:役割/URL混在)は別扱いで保持、個別列が空のときのみ「候補」。推測統合しない(同一EP内の完全一致のみ除去)。 */
export function buildParticipants(row) {
  const names = []; for (let c = LEDGER_COL.cast1; c <= LEDGER_COL.cast5; c++) { const v = s(row[c]); if (v && !names.includes(v)) names.push(v); }
  const raw = s(row[LEDGER_COL.castRaw]);
  return { names, castRaw: raw, evidence: s(row[LEDGER_COL.castEvidence]), source: names.length ? 'AT-AX' : raw ? 'X-raw-candidate' : 'none' };
}

// ---- 関連記事 ----
/** EP-ID × 関連記事タイトル × 記事URL × 出典。見出し↔URL対応・順序を維持。AC列のURLのうち本文由来にないものはtitle=''で追加(URLは失わない)。 */
export function buildRelatedArticles(row) {
  const out = []; const seen = new Set();
  const push = (title, url, source, orig) => { const k = url; if (seen.has(k)) return; seen.add(k); out.push({ title, url, originalUrl: orig || url, source, order: out.length }); };
  for (const [col, src] of [[LEDGER_COL.descRaw, 'V概要原文'], [LEDGER_COL.descClean, 'W概要清掃済み']]) {
    const r = editDescription(s(row[col])); for (const a of r.relatedArticles) push(a.title === a.originalUrl ? '' : a.title, a.url, src, a.originalUrl);
  }
  for (const u of splitUrls(row[LEDGER_COL.relatedUrls])) push('', u, 'AC関連記事URL', u);
  return out;
}

// ---- 検索索引 ----
export const normalizeQuery = (v) => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const stripHtml = (t) => String(t ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, ' ');
/** EP単位の検索索引(重み分離): title/cast/related titles/desc は本文系、URL・IDは別フィールド(低重み)。原文・清掃済みの両方を索引。 */
export function buildSearchIndex(rows) {
  return rows.filter((r) => s(r[0])).map((r) => {
    const p = buildParticipants(r); const rel = buildRelatedArticles(r);
    return { id: s(r[0]), show: s(r[1]), title: normalizeQuery(r[LEDGER_COL.title]), desc: normalizeQuery(`${stripHtml(r[LEDGER_COL.descClean])} ${stripHtml(r[LEDGER_COL.descRaw])}`),
      cast: normalizeQuery(`${p.names.join(' ')} ${p.castRaw}`), related: normalizeQuery(rel.map((a) => a.title).join(' ')),
      ids: normalizeQuery(`${s(r[0])} ${s(r[LEDGER_COL.guid])} ${rel.map((a) => a.url).join(' ')}`) };
  });
}
/** 全語AND、title/desc/cast/related/ids のいずれかに含まれればヒット。除外EPは excludedIds で外す。 */
export function searchIndex(index, query, { excludedIds = new Set() } = {}) {
  const terms = normalizeQuery(query).split(' ').filter(Boolean); if (!terms.length) return [];
  return index.filter((e) => !excludedIds.has(e.id) && terms.every((t) => `${e.title} ${e.desc} ${e.cast} ${e.related} ${e.ids}`.includes(t))).map((e) => e.id);
}

// ---- 詳細データ(EP-IDキー)と基本台帳v1 View ----
export function buildDetail(rows, links = []) {
  const by = new Map(); for (const l of links) (by.get(l.ep_id) || by.set(l.ep_id, []).get(l.ep_id)).push(l);
  return rows.filter((r) => s(r[0])).map((r) => ({ id: s(r[0]), title: s(r[LEDGER_COL.title]), descClean: s(r[LEDGER_COL.descClean]), descRaw: s(r[LEDGER_COL.descRaw]),
    participants: buildParticipants(r), relatedArticles: buildRelatedArticles(r), platforms: (by.get(s(r[0])) || []).sort((a, b) => a.order - b.order).map(({ platform, type, url, status, evidence, last_checked }) => ({ platform, type, url, status, evidence, last_checked })) }));
}

export const BASE_V1_HEADERS = Object.freeze(['EP-ID', '番組', 'タイトル', '配信日時', '公式GUID', 'Omny/公式URL', 'Spotify URL', '概要(清掃済み)', '出演者', '再配信フラグ', '掲載判定', '理由/根拠', '最終更新日']);
export function buildBaseView(rows, { links = [], decisions = new Map(), updatedAt = '' } = {}) {
  const idx = new Map(); for (const l of links) if (l.status === 'confirmed' && !idx.has(`${l.ep_id}|${l.platform}`)) idx.set(`${l.ep_id}|${l.platform}`, l);
  return rows.filter((r) => s(r[0])).map((r) => {
    const ep = s(r[0]); const ex = classifyExclusion(r); const dec = decisions.get(ep); const pa = buildParticipants(r);
    const red = classifyRedistribution({ title: r[LEDGER_COL.title] }, { frozenDecision: ['再配信', '再配信候補'].includes(dec?.classification) ? dec.classification : undefined });
    const publication = dec?.publication || (ex.excluded ? '対象外' : ex.holdReason ? '保留' : '未判定');
    const reason = [ex.excluded ? ex.reason : '', ex.holdReason, dec?.classification && dec.classification !== '通常' ? dec.classification : ''].filter(Boolean).join(' / ');
    const cast = pa.names.length ? pa.names.join(' / ') : pa.castRaw ? `（原文候補）${pa.castRaw}` : '';
    return [ep, s(r[1]), s(r[2]), s(r[3]), s(r[LEDGER_COL.guid]), idx.get(`${ep}|omny`)?.url || idx.get(`${ep}|asahi`)?.url || '', idx.get(`${ep}|spotify`)?.url || '',
      s(r[LEDGER_COL.descClean]), cast, red.flag, publication, reason, updatedAt];
  });
}

// ---- 情報損失チェック(原本 vs 生成物) ----
/** 非空セル数・EP別値・索引件数を照合。loss は全て 0 が受入条件。 */
export function lossReport(rows, { links, detail, index, view }) {
  const R = rows.filter((r) => s(r[0])); const byId = new Map(detail.map((d) => [d.id, d])); const loss = { title: [], descClean: [], descRaw: [], participants: [], castEvidence: [], relatedUrls: [], platformUrls: [], index: [], idMissing: [] };
  const linkSet = new Set(links.filter((l) => l.url).map((l) => `${l.ep_id}|${l.url}`)); const idxIds = new Set(index.map((i) => i.id));
  const cnt = { title: 0, descClean: 0, descRaw: 0, participants: 0, relatedUrls: 0, platformUrls: 0 };
  for (const r of R) {
    const id = s(r[0]); const d = byId.get(id); if (!d) { loss.idMissing.push(id); continue; }
    if (s(r[2])) { cnt.title++; if (d.title !== s(r[2])) loss.title.push(id); }
    if (s(r[22])) { cnt.descClean++; if (d.descClean !== s(r[22])) loss.descClean.push(id); }
    if (s(r[21])) { cnt.descRaw++; if (d.descRaw !== s(r[21])) loss.descRaw.push(id); }
    const p = buildParticipants(r); for (let c = 45; c <= 49; c++) if (s(r[c])) { cnt.participants++; if (!d.participants.names.includes(s(r[c]))) loss.participants.push(`${id}:${c}`); }
    if (s(r[23]) && d.participants.castRaw !== s(r[23])) loss.participants.push(`${id}:X`);
    if (s(r[50]) && d.participants.evidence !== s(r[50])) loss.castEvidence.push(id);
    for (const u of splitUrls(r[28])) { cnt.relatedUrls++; if (!d.relatedArticles.some((a) => a.url === u)) loss.relatedUrls.push(`${id}:${u}`); }
    for (const pf of PLATFORMS) for (const c of pf.cols) for (const u of splitUrls(r[c])) { cnt.platformUrls++; if (!linkSet.has(`${id}|${u}`)) loss.platformUrls.push(`${id}:${pf.key}:${u}`); }
    if (!idxIds.has(id)) loss.index.push(id);
  }
  const total = Object.values(loss).reduce((n, a) => n + a.length, 0);
  return { rows: R.length, nonEmptyCells: cnt, viewRows: view.length, indexRows: index.length, loss: Object.fromEntries(Object.entries(loss).map(([k, a]) => [k, a.length])), lossExamples: Object.fromEntries(Object.entries(loss).map(([k, a]) => [k, a.slice(0, 5)])), totalLoss: total, ok: total === 0 && view.length === R.length && index.length === R.length };
}

// ---- 不変条件 ----
export function checkInvariants(before, after, { links }) {
  const errs = []; const ids0 = before.map((r) => s(r[0])).filter(Boolean); const ids1 = after.map((r) => s(r[0])).filter(Boolean);
  if (ids0.length !== new Set(ids0).size) errs.push('入力にEP-ID重複');
  const set1 = new Set(ids1); const miss = ids0.filter((i) => !set1.has(i)); if (miss.length) errs.push(`EP-ID消失 ${miss.length}件 (${miss.slice(0, 3)})`);
  if (ids1.length !== new Set(ids1).size) errs.push('出力にEP-ID重複');
  const linkSet = new Set(links.filter((l) => l.url).map((l) => `${l.ep_id}|${l.url}`));
  for (const r of before) for (const pf of PLATFORMS) for (const c of pf.cols) for (const u of splitUrls(r[c])) if (!linkSet.has(`${s(r[0])}|${u}`)) errs.push(`URL消失 ${r[0]} ${pf.key} ${u}`);
  const guids = before.map((r) => s(r[LEDGER_COL.guid])).filter(Boolean); const dupG = guids.filter((g, i) => guids.indexOf(g) !== i);
  if (dupG.length) errs.push(`強ID(GUID)重複 ${new Set(dupG).size}種`);
  return { ok: errs.length === 0, errors: errs };
}

// ---- 依存関係スキャナ ----
export const URL_COLS_0 = Object.freeze(new Set([8, 9, 10, 11, 12, 14, 28, 40, 41, 42, 43, 44]));
export const SEARCH_COLS_0 = Object.freeze(new Set([0, 1, 2, 21, 22, 23, 45, 46, 47, 48, 49, 50]));
export function scanSource(name, text) {
  const cols = new Map(); const tabs = new Set();
  for (const m of text.matchAll(/\b(?:row|r|rows\[[^\]]+\])\s*\[\s*(\d{1,2})\s*\]/g)) cols.set(+m[1], (cols.get(+m[1]) || 0) + 1);
  for (const m of text.matchAll(/getSheetByName\(\s*['"`]([^'"`]+)['"`]/g)) tabs.add(m[1]);
  return { file: name, columns: [...cols].map(([c, n]) => ({ col0: c, refs: n })), tabs: [...tabs] };
}
export function classifyColumn(col0, refCount) {
  if (URL_COLS_0.has(col0)) return { cls: '運用必須', why: 'プラットフォームURL探索・補完・サイト表示(削減禁止)' };
  if (SEARCH_COLS_0.has(col0)) return { cls: '運用必須', why: '検索・分析の中核(タイトル/概要/出演者/ID)。削減禁止' };
  if (refCount > 0) return { cls: '表示維持', why: 'repo内プログラムが参照' };
  return { cls: '未確認(本番GAS未取得)', why: 'repo内参照なし。本番GASソース確認まで分類保留(削除候補にしない)' };
}
