// 基本台帳v1 (Issue #278) — pure functions. No I/O, no network, never mutates inputs.
// 全体方針: 元台帳の列・タブ・EP-IDは一切変更しない。ここは「派生View」と「EP×プラットフォーム正規化表」を作るだけ。

/** 0-based 台帳列。13/42/43等のCOLUMN値(1-based)はP15_PLATFORM_STATUSの実測(18件×6サービス)で確認済み。 */
export const LEDGER_COL = Object.freeze({
  id: 0, show: 1, title: 2, datetime: 3, medium: 4, source: 5, guid: 6,
  anchorI: 8, anchorJ: 9, audioUrl: 14, descRaw: 21, descClean: 22,
  relatedUrls: 28, sourceUrl: 32, humanExclude: 38,
});

/** プラットフォーム→台帳列(0-based)。URL列は「不要」に分類しない。 */
export const PLATFORMS = Object.freeze([
  { key: 'asahi', label: '朝日公式', col: null, hosts: [/(^|\.)asahi\.com$/, /podcast\.asahi\.com$/], note: 'I/J/AG/AC列の公式個別URLから抽出' },
  { key: 'listen', label: 'LISTEN', col: 10, hosts: [/(^|\.)listen\.style$/] },
  { key: 'spotify', label: 'Spotify', col: 11, hosts: [/(^|\.)open\.spotify\.com$/] },
  { key: 'apple', label: 'Apple Podcasts', col: 12, hosts: [/(^|\.)podcasts\.apple\.com$/] },
  { key: 'amazon', label: 'Amazon Music', col: 40, hosts: [/(^|\.)music\.amazon\.[a-z.]+$/] },
  { key: 'pocketcasts', label: 'Pocket Casts', col: 41, hosts: [/(^|\.)pocketcasts\.com$/, /(^|\.)pca\.st$/] },
  { key: 'pody', label: 'Pody', col: 42, hosts: [/(^|\.)pody\.jp$/, /(^|\.)podcast\.pody\.jp$/] },
  { key: 'omny', label: 'Omny/Megaphone', col: 14, hosts: [/(^|\.)omny\.fm$/, /(^|\.)omnycontent\.com$/, /(^|\.)megaphone\.fm$/, /(^|\.)traffic\.megaphone\.fm$/] },
]);

export const LINK_STATUS = Object.freeze(['confirmed', 'candidate', 'hold', 'not_found', 'unavailable', 'not_supported']);

/** P15_PLATFORM_STATUS.STATE/REASON → 正規化ステータス。unavailable(一時)=再探索対象、not_found=未発見(再探索可)。 */
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
export function parseUrl(v) { try { const u = new URL(s(v)); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
export function urlMatchesPlatform(url, platform) { const u = parseUrl(url); return !!u && platform.hosts.some((h) => h.test(u.hostname)); }
/** Spotifyは個別エピソード(/episode/)のみ confirmed 対象。番組URL(/show/)は個別ではない。 */
export function isEpisodeLevel(platformKey, url) {
  const u = parseUrl(url); if (!u) return false;
  if (platformKey === 'spotify') return /^\/episode\/[A-Za-z0-9]+/.test(u.pathname);
  if (platformKey === 'apple') return /[?&]i=\d+/.test(u.search);
  if (platformKey === 'listen') return /^\/p\/[^/]+\/[^/]+/.test(u.pathname);
  return true;
}

/**
 * EP×platform 正規化表。既存URLは一つも捨てない:
 *  - ホスト一致かつ個別EPレベル → confirmed
 *  - 値あり・ホスト不一致/番組URLのみ → hold(誤リンク自動確定禁止。原文はurlに保持)
 *  - 空欄 → P15状態があればそれを写像、なければ not_found(probed:false。空欄≠存在しない)
 * @param rows 台帳行(配列の配列, ヘッダなし)
 * @param p15  P15_PLATFORM_STATUS行 [{ 'EP-ID', SERVICE, STATE, REASON, URL, EVIDENCE_URL, CHECKED_UTC }]
 */
export function buildPlatformLinks(rows, p15 = [], { asOf = null } = {}) {
  const p15Idx = new Map();
  for (const p of p15) p15Idx.set(`${p['EP-ID']}|${p.SERVICE}`, p);
  const svcName = { listen: 'LISTEN', spotify: 'Spotify', apple: 'Apple Podcasts', amazon: 'Amazon Music', pocketcasts: 'Pocket Casts', pody: 'Pody' };
  const out = [];
  for (const row of rows) {
    const ep = s(row[LEDGER_COL.id]); if (!ep) continue;
    for (const pf of PLATFORMS) {
      let url = ''; let evidence = ''; let status; let retryable = false; let probed = true; let checked = '';
      let cands = [];
      if (pf.key === 'asahi') cands = [row[LEDGER_COL.anchorI], row[LEDGER_COL.anchorJ], row[LEDGER_COL.sourceUrl], row[LEDGER_COL.relatedUrls]]; else if (pf.col != null) cands = [row[pf.col]];
      const vals = cands.flatMap((c) => s(c).split(/[\s\n]+/).filter(Boolean));
      const hit = vals.find((v) => urlMatchesPlatform(v, pf) && isEpisodeLevel(pf.key, v));
      const other = vals.find((v) => v && !(urlMatchesPlatform(v, pf) && isEpisodeLevel(pf.key, v)));
      if (hit) { url = hit; status = 'confirmed'; evidence = pf.col != null ? `ledger-col-${pf.col + 1}` : 'ledger-official-anchor'; }
      else if (other && pf.col != null) { url = other; status = 'hold'; evidence = 'ledger-value-not-episode-level-or-host-mismatch'; retryable = true; }
      else {
        const p = p15Idx.get(`${ep}|${svcName[pf.key]}`);
        if (p) { const m = mapP15State(p.STATE, p.REASON); status = m.status; retryable = m.retryable; url = s(p.URL); evidence = s(p.EVIDENCE_URL) || `P15:${s(p.REASON)}`; checked = s(p.CHECKED_UTC); }
        else { status = 'not_found'; retryable = true; probed = false; evidence = 'blank-cell-no-probe-record'; }
      }
      out.push({ ep_id: ep, platform: pf.key, url, status, retryable, evidence, last_checked: checked || asOf || '', probed });
    }
  }
  return out;
}

// ---- 除外 ----
export const EXCLUDED_SHOWS = Object.freeze(['アルキキ', 'AJW', '朝ポキTV']);
const YT = /(^|\.)(youtube\.com|youtu\.be)$/;
export function isYouTube(url) { const u = parseUrl(url); return !!u && YT.test(u.hostname); }
/** 除外判定: 番組(確定) / YouTube由来(音声版なし) / 対象。音声EPに付いた補助YouTube URLは除外理由にしない。 */
export function classifyExclusion(row) {
  const show = s(row[LEDGER_COL.show]);
  const links = [row[LEDGER_COL.audioUrl], row[LEDGER_COL.sourceUrl], row[LEDGER_COL.anchorI], row[LEDGER_COL.anchorJ], row[LEDGER_COL.relatedUrls]].flatMap((c) => s(c).split(/[\s\n]+/).filter(Boolean));
  const audio = parseUrl(row[LEDGER_COL.audioUrl]);
  const yt = links.filter(isYouTube);
  const nonYtOfficial = links.some((l) => parseUrl(l) && !isYouTube(l));
  if (EXCLUDED_SHOWS.includes(show)) return { excluded: true, kind: 'show', reason: `対象外番組(${show})`, auxVideoUrls: yt };
  if (s(row[LEDGER_COL.humanExclude])) return { excluded: true, kind: 'human', reason: '人間除外', auxVideoUrls: yt };
  if (yt.length && !audio && !nonYtOfficial) return { excluded: true, kind: 'youtube_origin', reason: 'YouTube由来のみ(音声版なし)', auxVideoUrls: yt };
  return { excluded: false, kind: null, reason: '', auxVideoUrls: yt };
}

// ---- 再配信 (おんさ speakers3.js 表示計数ルールの「ルール」のみ再実装。コード/データは複製しない) ----
const REDIST_MARKERS = ['（再）', '(再)', '（ふりかえり）', '（深掘り）', '再放送です'];
/**
 * ルール一致 = 再配信「候補」。confirmed は同一GUID/元URLの証拠(evidence)がある場合のみ。
 * それ以外は hold。続編・リマスター・編集版を自動削除しない。
 * @param evidence { sameGuidAs?:string, originalUrl?:string, sourceTimestamp?:string, frozenDecision?:'再配信'|'再配信候補' }
 */
export function classifyRedistribution({ title, durationSec } = {}, evidence = {}) {
  const t = s(title); const hits = REDIST_MARKERS.filter((m) => t.includes(m));
  const zero = durationSec != null && durationSec !== '' && Number(durationSec) <= 0;
  const ruleHit = hits.length > 0 || zero;
  const proof = !!(evidence.sameGuidAs || evidence.originalUrl || evidence.frozenDecision === '再配信');
  if (!ruleHit && evidence.frozenDecision !== '再配信') return { flag: '', rules: [], evidence: null };
  const rules = [...hits, ...(zero ? ['duration<=0'] : [])];
  return { flag: proof ? '再配信' : '再配信候補(HOLD)', rules, evidence: proof ? { ...evidence } : null, hideFromNormalDisplay: proof };
}

// ---- 基本台帳v1 View ----
export const BASE_V1_HEADERS = Object.freeze(['EP-ID', '番組', 'タイトル', '配信日時', '公式GUID', 'Omny/公式URL', 'Spotify URL', '概要(清掃済み)', '出演者', '再配信フラグ', '掲載判定', '理由/根拠', '最終更新日']);
/** 出演者列は元台帳の列位置が未確認のため castCol を明示指定(未指定なら空)。 */
export function buildBaseView(rows, { links = [], decisions = new Map(), castCol = null, updatedAt = '' } = {}) {
  const idx = new Map(); for (const l of links) idx.set(`${l.ep_id}|${l.platform}`, l);
  return rows.filter((r) => s(r[0])).map((r) => {
    const ep = s(r[0]); const ex = classifyExclusion(r); const dec = decisions.get(ep);
    const red = classifyRedistribution({ title: r[LEDGER_COL.title] }, { frozenDecision: dec?.classification === '再配信' || dec?.classification === '再配信候補' ? dec.classification : undefined });
    const publication = dec?.publication || (ex.excluded ? '対象外' : '未判定');
    const reason = [ex.excluded ? ex.reason : '', dec?.classification && dec.classification !== '通常' ? dec.classification : ''].filter(Boolean).join(' / ');
    return [ep, s(r[1]), s(r[2]), s(r[3]), s(r[LEDGER_COL.guid]), idx.get(`${ep}|omny`)?.url || s(r[LEDGER_COL.audioUrl]) || idx.get(`${ep}|asahi`)?.url || '',
      idx.get(`${ep}|spotify`)?.url || '', s(r[LEDGER_COL.descClean]), castCol == null ? '' : s(r[castCol]), red.flag, publication, reason, updatedAt];
  });
}

// ---- 不変条件(切替前後の検証) ----
export function checkInvariants(before, after, { links }) {
  const errs = [];
  const ids0 = before.map((r) => s(r[0])).filter(Boolean); const ids1 = after.map((r) => s(r[0])).filter(Boolean);
  if (ids0.length !== new Set(ids0).size) errs.push('入力にEP-ID重複');
  const miss = ids0.filter((i) => !new Set(ids1).has(i)); if (miss.length) errs.push(`EP-ID消失 ${miss.length}件 (${miss.slice(0, 3)})`);
  if (ids1.length !== new Set(ids1).size) errs.push('出力にEP-ID重複');
  const linkSet = new Set(links.filter((l) => l.url).map((l) => `${l.ep_id}|${l.url}`));
  for (const r of before) for (const pf of PLATFORMS) if (pf.col != null) for (const u of s(r[pf.col]).split(/[\s\n]+/).filter(parseUrl)) if (!linkSet.has(`${s(r[0])}|${u}`)) errs.push(`URL消失 ${r[0]} ${pf.key} ${u}`);
  const guids = before.map((r) => s(r[LEDGER_COL.guid])).filter(Boolean); const dupG = guids.filter((g, i) => guids.indexOf(g) !== i);
  if (dupG.length) errs.push(`強ID(GUID)重複 ${new Set(dupG).size}種`);
  return { ok: errs.length === 0, errors: errs };
}

// ---- 依存関係スキャナ ----
/** ソース文字列から row[N]/[N]/シート名/ヘッダ名参照を抽出。URL列(10-12,40-42,14,8,9,28,32)は必ず keep 扱い。 */
export const URL_COLS_0 = Object.freeze(new Set([8, 9, 10, 11, 12, 14, 28, 32, 40, 41, 42]));
export function scanSource(name, text) {
  const cols = new Map(); const tabs = new Set();
  for (const m of text.matchAll(/\b(?:row|r|rows\[[^\]]+\])\s*\[\s*(\d{1,2})\s*\]/g)) cols.set(+m[1], (cols.get(+m[1]) || 0) + 1);
  for (const m of text.matchAll(/getSheetByName\(\s*['"`]([^'"`]+)['"`]/g)) tabs.add(m[1]);
  for (const m of text.matchAll(/(?:sheet|tab|SHEET|TAB)\w*\s*[:=]\s*['"`]([^'"`]{2,40})['"`]/g)) if (/[ぁ-ヿ一-龥]|^P15|^BACKUP|台帳/.test(m[1])) tabs.add(m[1]);
  return { file: name, columns: [...cols].map(([c, n]) => ({ col0: c, refs: n })), tabs: [...tabs] };
}
export function classifyColumn(col0, refCount) {
  if (URL_COLS_0.has(col0)) return { cls: '運用必須', why: 'プラットフォームURL探索・補完・サイト表示に使用(削減禁止)' };
  if (refCount > 0) return { cls: '表示維持', why: 'repo内プログラムが参照' };
  return { cls: '未確認(本番GAS未取得)', why: 'repo内参照なし。本番GASソース確認まで分類保留(削除候補にしない)' };
}
