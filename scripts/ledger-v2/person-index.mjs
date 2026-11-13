// 人物索引（Issue #309）: 検索の正本は「1行 = 1人 × 1エピソード」。役割（MC・音源編集・ゲスト）では分けない。
// 出どころは保全済みの概要原文（公式RSS）から清掃器 cleanV4 が取り出した出演者行。原文に無い名前は作らない（推測しない）。
// 表記: 氏名の空白・敬称（さん・氏・様・君・ちゃん）を除いた「索引名」で検索・重複判定し、原文の書き方（表記原文）と肩書き・リンクは根拠として残す。
import { cleanV4, PLATFORM_NAME } from './summary-cleaner-v4.mjs';

export const PERSON_INDEX_VERSION = 'PI-3';
export const PERSON_INDEX_HEADERS = ['EP-ID', '索引名', '表記原文', '肩書き・注記', 'リンク', '出典', '検証状態', '索引版'];
const LEAD_ROLE = /^(?:ナビゲーター|アシスタント|進行|語り手?|朗読|案内役|解説|コメンテーター|リポーター|レポーター)[・:：]?/;   // 役割語が氏名に付いたまま（「ナビゲーター石倉徹也」）でも同じ人として引けるように。役割は保存しない
const HONORIFIC = /(?:さん|氏|様|さま|君|くん|ちゃん)$/;
// 索引名: NFKC、空白除去、末尾の敬称を除く。漢字の異体字は変えない（同一人物か断定できないため）
export function personKey(name) {
  return String(name ?? '').normalize('NFKC').replace(/[\s　]+/g, '').replace(LEAD_ROLE, '').replace(HONORIFIC, '').trim();
}
// 人名として扱わないもの → HOLD（書かずに理由を残す）
export function personHold(name) {
  const n = String(name ?? '').trim(), k = personKey(n);
  if (!k) return 'EMPTY';
  if (PLATFORM_NAME.test(n) || PLATFORM_NAME.test(k)) return 'PLATFORM_NAME';
  if (/https?:|www\.|@|＠/.test(n)) return 'LINK_OR_ACCOUNT';
  if (k.length > 20 || /[。！？!?、，,]/.test(k)) return 'NOT_A_NAME_SENTENCE';
  if (/^[\p{N}\p{P}\p{S}\s_]+$/u.test(k)) return 'NO_LETTERS';
  return '';
}
// 1話分: 原文 → 索引行（同じ話の中で同じ索引名は1行）
export function personRows(ep, raw) {
  if (!String(raw ?? '').trim()) return { rows: [], hold: [], status: 'RAW_NONE' };
  const c = cleanV4(raw), seen = new Set(), rows = [], hold = [];
  for (const x of c.cast) {
    const why = personHold(x.name); if (why) { hold.push({ ep, name: x.name, why }); continue; }
    const k = personKey(x.name); if (seen.has(k)) continue; seen.add(k);
    rows.push({ ep, key: k, display: String(x.name).trim(), note: [x.role, x.note].filter(Boolean).join(' / '), links: x.links.join(' '), source: '概要原文（公式RSS）', state: '原文で確認' });
  }
  return { rows, hold, status: rows.length ? 'OK' : 'NO_NAMES_IN_RAW' };
}
// 全話: 表記ゆれ候補（索引名が違うのに空白・敬称以外で一致しそうなもの）は自動で統合せず、一覧に出すだけ
// 原文に名前が無い回で、台帳の出演者列に名前がある場合（旧台帳からの既存値）は消さずに索引へ載せ、状態で区別する（出典なし・未検証）
export function ledgerRows(ep, ledgerCast, parse) {
  const seen = new Set(), rows = [];
  String(ledgerCast ?? '').split('\n').forEach((l) => { const c = parse(l); if (!c.name || personHold(c.name)) return; const k = personKey(c.name); if (seen.has(k)) return; seen.add(k);
    rows.push({ ep, key: k, display: String(c.name).trim(), note: [c.role, c.note].filter(Boolean).join(' / '), links: c.links.join(' '), source: '統合台帳 出演者列（既存値）', state: '原文に出典なし・未検証' }); });
  return rows;
}
export function buildPersonIndex(episodes) {
  const rows = [], hold = [], stat = { episodes: 0, withNames: 0, noNamesInRaw: 0, rawNone: 0, rows: 0, hold: 0 };
  for (const e of episodes) { stat.episodes++; const r = personRows(e.ep, e.raw); rows.push(...r.rows); hold.push(...r.hold);
    if (r.status === 'OK') stat.withNames++; else if (r.status === 'RAW_NONE') stat.rawNone++; else stat.noNamesInRaw++;
    if (r.status !== 'OK' && e.ledgerCast && e.parse) { const lr = ledgerRows(e.ep, e.ledgerCast, e.parse); if (lr.length) { rows.push(...lr); stat.ledgerOnlyEpisodes = (stat.ledgerOnlyEpisodes || 0) + 1; stat.ledgerOnlyRows = (stat.ledgerOnlyRows || 0) + lr.length; } } }
  stat.rows = rows.length; stat.hold = hold.length;
  const byKey = new Map(); rows.forEach((r) => byKey.set(r.key, (byKey.get(r.key) || 0) + 1));
  const keys = [...byKey.keys()], loose = (k) => k.replace(/[・=＝.．]/g, '').replace(/[ヶケ]/g, 'ケ'), groups = new Map();
  keys.forEach((k) => { const g = loose(k); groups.set(g, [...(groups.get(g) || []), k]); });
  const variants = [...groups.values()].filter((v) => v.length > 1);
  stat.people = keys.length; stat.variantGroups = variants.length;
  return { rows, hold, stat, variants };
}

// ===== 差分更新（PI-3）: 1話ごとの指紋（原文・出演者欄・版）が変わった話だけ作り直し、索引の他の行はそのまま残す =====
export function epFingerprintText(raw, ledgerCast, ver) { return [String(raw ?? ''), String(ledgerCast ?? ''), String(ver ?? '')].join('\u0001'); }
// existing: 索引の現在行（{ep,...} の配列）、updates: Map(ep → 新しい行の配列。[] は「この話は0行」)、removed: 台帳から消えた話
export function mergeIndex(existing, updates, removed) {
  const gone = new Set(removed || []), out = [], seen = new Set(), stat = { kept: 0, replacedEpisodes: 0, rowsAdded: 0, rowsRemoved: 0, unchangedEpisodes: 0 };
  const same = (a, b) => a.length === b.length && a.every((x, i) => ['ep', 'key', 'display', 'note', 'links', 'source', 'state'].every((k) => String(x[k] ?? '') === String(b[i][k] ?? '')));
  const byEp = new Map(); existing.forEach((r) => { if (!byEp.has(r.ep)) byEp.set(r.ep, []); byEp.get(r.ep).push(r); });
  for (const r of existing) {
    if (seen.has(r.ep)) continue; seen.add(r.ep);
    const old = byEp.get(r.ep);
    if (gone.has(r.ep)) { stat.rowsRemoved += old.length; continue; }
    if (updates.has(r.ep)) { const nw = updates.get(r.ep); if (same(old, nw)) { stat.unchangedEpisodes++; out.push(...old); } else { stat.replacedEpisodes++; stat.rowsRemoved += old.length; stat.rowsAdded += nw.length; out.push(...nw); } }
    else { stat.kept += old.length; out.push(...old); }
  }
  for (const [ep, nw] of updates) if (!seen.has(ep) && nw.length) { stat.replacedEpisodes++; stat.rowsAdded += nw.length; out.push(...nw); }   // 新しい話は末尾へ
  const dup = new Set(), d = out.filter((r) => { const k = r.ep + '\u0001' + r.key; if (dup.has(k)) return true; dup.add(k); return false; }).length;
  return { rows: out, stat: { ...stat, total: out.length, duplicatePairs: d }, changed: stat.replacedEpisodes > 0 || stat.rowsRemoved > 0 };
}
// 出演者欄と原文の名前の差（人の値は直さず、差として残すだけ）
export function castDifference(ep, rawKeys, ledgerCast, parse) {
  const led = String(ledgerCast ?? '').split('\n').map((l) => parse(l).name).filter((n) => n && !personHold(n)).map(personKey);
  const r = [...new Set(rawKeys)], l = [...new Set(led)];
  if (!r.length && !l.length) return null;
  if (!r.length) return { ep, kind: '台帳にだけ名前（原文に出典なし）', raw: '', ledger: l.join('、') };
  if (!l.length) return { ep, kind: '出演者欄が空（原文には名前あり）', raw: r.join('、'), ledger: '' };
  const miss = r.filter((k) => !l.includes(k)), extra = l.filter((k) => !r.includes(k));
  if (!miss.length && !extra.length) return null;
  return { ep, kind: '名前が一部違う', raw: r.join('、'), ledger: l.join('、'), missingInLedger: miss.join('、'), notInRaw: extra.join('、') };
}
