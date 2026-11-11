// 第51号: V2統合台帳 N列「概要（清掃済）」(旧59列 W列「概要清掃済み」) の再監査（読取専用）。台帳本文は出力しない（EP-ID・件数のみ）。
// usage: node audit-summary-cleaned.mjs --ids 統合A1:H.json --n 統合N1:N.json [--oldids 旧59列A1:B.json --oldw W.json --oldv V.json --oldal AL.json] --out report.json
// 基準（項目定義「概要清掃済み」）: 原文とは別・改行はスペース化・未処理は空欄・一行文字列。
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const vals = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).values;
export const CHECKS = {
  EMPTY: (t) => t.trim() === '',
  MULTILINE_NOT_ONE_LINE: (t) => /\n/.test(t),
  SHORT_UNDER_20: (t) => t.trim() !== '' && t.trim().length < 20,
  NETWORK_BOILERPLATE: (t) => /朝日新聞ポッドキャスト[^\n]{0,80}(では他にも|番組を配信中)/.test(t),
  MENTIONS_REMOVED_SHOW: (t) => /アルキキ|AJW|朝ポキ/.test(t),
  SNS_BOILERPLATE: (t) => /【(ツイッター|Twitter|X|インスタグラム|Instagram)】|フォローして|ハッシュタグ/.test(t),
  PROMO_CAMPAIGN: (t) => /キャンペーン|初月|スタンダードコース|有料会員|購読(はこちら|特典)|お得/.test(t),
  RELATED_ARTICLE_BLOCK: (t) => /【関連記事】/.test(t),
  RAW_URL: (t) => /https?:\/\//.test(t),
  TRACKING_PARAM: (t) => /[?&](iref|utm_[a-z]+)=/.test(t),
  HTML_RESIDUE: (t) => /<\/?[a-z][^>]*>|&(nbsp|amp|lt|gt|quot|#\d+);/i.test(t),
  WHITESPACE: (t) => t !== t.trim() || /\n{3,}|[ 　]{3,}/.test(t),
};
export function audit(idRows, nRows, oldW, oldIds, oldV, oldAL) {
  const hdr = idRows[0];
  if (hdr[0] !== 'EP-ID' || !String(nRows[0][0]).startsWith('概要')) throw new Error('HEADER_MISMATCH');
  const res = {}, byShow = {}, sample = {}, textCount = new Map(), oldBy = new Map();
  const rawBy = new Map(), verBy = new Map();
  if (oldIds) oldIds.slice(1).forEach((r, i) => {
    if (oldW) oldBy.set(r[0], String((oldW[i + 1] || [])[0] || ''));
    if (oldV) rawBy.set(r[0], String((oldV[i + 1] || [])[0] || ''));
    if (oldAL) verBy.set(r[0], String((oldAL[i + 1] || [])[0] || ''));
  });
  const extra = { SAME_AS_RAW_UNCLEANED: 0, RAW_PRESENT_BUT_CLEANED_EMPTY: 0, NO_CLEAN_VERSION_RECORDED: 0 }, extraSample = {};
  const addX = (k, ep) => { extra[k]++; (extraSample[k] = extraSample[k] || []).length < 15 && extraSample[k].push(ep); };
  let rows = 0, diffOld = 0, judged = {};
  idRows.slice(1).forEach((r, i) => {
    const ep = r[0]; if (!ep) return; rows++;
    const t = String((nRows[i + 1] || [])[0] || ''), show = r[1], j = r[4];
    if (t.trim()) textCount.set(t.trim(), (textCount.get(t.trim()) || 0) + 1);
    if (oldBy.size && oldBy.has(ep) && oldBy.get(ep) !== t) diffOld++;
    const raw = rawBy.get(ep);
    if (raw !== undefined && raw.trim() && raw.trim() === t.trim()) addX('SAME_AS_RAW_UNCLEANED', ep);
    if (raw !== undefined && raw.trim() && !t.trim()) addX('RAW_PRESENT_BUT_CLEANED_EMPTY', ep);
    if (verBy.size && t.trim() && !(verBy.get(ep) || '').trim()) addX('NO_CLEAN_VERSION_RECORDED', ep);
    for (const [k, f] of Object.entries(CHECKS)) if (f(t)) {
      res[k] = (res[k] || 0) + 1; byShow[k] = byShow[k] || {}; byShow[k][show] = (byShow[k][show] || 0) + 1;
      if (j === '対象') judged[k] = (judged[k] || 0) + 1;
      (sample[k] = sample[k] || []).length < 15 && sample[k].push(ep);
    }
  });
  const dupGroups = [...textCount.values()].filter((c) => c >= 3);
  return { rows, checks: res, crossChecks: extra, crossSampleEpIds: extraSample, checksOnPublished対象: judged, byShow, sampleEpIds: sample, identicalTextGroups3plus: { groups: dupGroups.length, rows: dupGroups.reduce((a, b) => a + b, 0) }, diffVsOld59W: oldBy.size ? diffOld : 'not_compared' };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const o = (k) => (arg(k) ? vals(arg(k)) : null);
  const r = audit(vals(arg('ids')), vals(arg('n')), o('oldw'), o('oldids'), o('oldv'), o('oldal'));
  fs.writeFileSync(arg('out', 'summary-audit.json'), JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ rows: r.rows, checks: r.checks, cross: r.crossChecks, published: r.checksOnPublished対象, dup: r.identicalTextGroups3plus, diffVsOld59W: r.diffVsOld59W }));
}
