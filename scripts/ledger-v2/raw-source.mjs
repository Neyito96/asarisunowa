// 概要欄の原文（V2・収蔵詳細「概要原文」）と公式の今の原文（公式RSS・公式個別ページ）を比べて、補完・更新してよいかを決める（純関数）。
// 2026-11-16 最終指令「原文が欠落・不完全な場合は、正しい原文を保存する」。Node と GAS で同じコードを使う（build-cleaner-gas.mjs で同梱）。
// 原則: 書いてよいのは「保存が空（欠落）」と「保存が公式の原文の途中で切れている（不完全）」だけ。中身が違うものは書かずに要確認。
export const RAW_SOURCE_VERSION = 'RAW-1';

// 比較用の正規化（CDATA・改行・連続空白・&nbsp; を揃える。中身は変えない）
export function normRaw(t) {
  return String(t ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&nbsp;|\u00a0/g, ' ').replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
}
// 原文そのものが途中で切れている形か（公式と比べなくても分かる形だけ）
export function looksTruncated(t) {
  const s = String(t ?? '').trim(); if (!s) return false;
  if (/(?:…|\.\.\.)$/.test(s) && !/[。！？!?」』）)]\s*(?:…|\.\.\.)$/.test(s)) return true;   // 文の途中で「…」
  if (/<[a-z][^>]*$/i.test(s)) return true;   // タグの途中で終わる
  const open = (s.match(/<p\b/gi) || []).length, close = (s.match(/<\/p>/gi) || []).length;
  return open > 0 && open - close >= 1 && !/<\/p>\s*$/i.test(s) && s.length >= 200 && /^<p\b/i.test(s);
}
const stripEllipsis = (s) => s.replace(/\s*(?:…|\.\.\.)$/, '');

// stored = 保存済みの原文, official = 公式の今の原文（無ければ ''）
// 戻り値 action: FILL（空欄を埋める）/ UPDATE（不完全を公式で置き換え）/ KEEP（書かない）/ HOLD（書かない・要確認）
export function classifyRaw(stored, official, opts = {}) {
  const s = String(stored ?? ''), o = String(official ?? ''), ns = normRaw(s), no = normRaw(o);
  const src = opts.source || '公式RSS';
  if (!ns && !no) return { action: 'HOLD', verdict: '欠落・取得元なし', reason: '保存も公式も原文なし（推測で補完しない）' };
  if (!ns) return o.length > (opts.cellMax || 49000) ? { action: 'HOLD', verdict: '欠落・原文過大', reason: src + 'の原文がセル上限を超える' } : { action: 'FILL', verdict: '欠落→補完', reason: src + 'の原文で空欄を埋める' };
  if (!no) return { action: 'KEEP', verdict: '保存のみ', reason: src + 'に無い（保存済みの原文を使う）' + (looksTruncated(s) ? '・保存が途中で切れている形（要確認）' : ''), truncatedShape: looksTruncated(s) };
  if (s === o) return { action: 'KEEP', verdict: '一致', reason: '' };
  if (ns === no) return { action: 'KEEP', verdict: '一致（空白の差だけ）', reason: '改行・空白だけの違いは書き換えない' };
  const core = normRaw(stripEllipsis(s.trim()));
  if (core.length >= 20 && no.startsWith(core) && no.length > core.length) {
    if (o.length > (opts.cellMax || 49000)) return { action: 'HOLD', verdict: '不完全・原文過大', reason: src + 'の原文がセル上限を超える' };
    return { action: 'UPDATE', verdict: '不完全→更新', reason: '保存の原文は' + src + 'の先頭' + core.length + '字と同じで、その先が欠けている（' + no.length + '字）' };
  }
  if (no.length >= 20 && ns.startsWith(no) && ns.length > no.length) return { action: 'KEEP', verdict: '保存の方が長い', reason: src + 'が短くなった（保存を残す）' };
  return { action: 'HOLD', verdict: '内容変化', reason: src + 'の原文が保存と違う（公式側の後日修正の可能性。書き換えず要確認・原文変化履歴に記録）' };
}

// 公式個別ページ（omny.fm 等）の HTML から原文の候補を取り出す。見つからなければ ''（推測しない）
// 優先: __NEXT_DATA__ 等の JSON にある Description / DescriptionHtml。og:description は短縮されるため使わない。
export function rawFromOfficialPage(html) {
  const h = String(html ?? '');
  const m = h.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  const pick = [];
  const walk = (x, depth) => { if (!x || depth > 12) return; if (Array.isArray(x)) { x.forEach((y) => walk(y, depth + 1)); return; }
    if (typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (typeof v === 'string' && /^(?:descriptionhtml|description|summary|showNotes)$/i.test(k) && v.length >= 40) pick.push(v); else walk(v, depth + 1); } };
  if (m) { try { walk(JSON.parse(m[1]), 0); } catch (e) { /* 壊れたJSONは使わない */ } }
  if (!pick.length) for (const g of h.matchAll(/"(?:DescriptionHtml|Description)"\s*:\s*"((?:\\.|[^"\\]){40,})"/g)) { try { pick.push(JSON.parse('"' + g[1] + '"')); } catch (e) { /* skip */ } }
  pick.sort((a, b) => (/<p\b|<br/i.test(b) ? 1 : 0) - (/<p\b|<br/i.test(a) ? 1 : 0) || b.length - a.length);   // HTML 付き・長いものを優先
  return pick[0] || '';
}
