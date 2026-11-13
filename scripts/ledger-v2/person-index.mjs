// 人物索引（Issue #309）: 検索の正本は「1行 = 1人 × 1エピソード」。役割（MC・音源編集・ゲスト）では分けない。
// 出どころは保全済みの概要原文（公式RSS）から清掃器 cleanV4 が取り出した出演者行。原文に無い名前は作らない（推測しない）。
// 表記: 氏名の空白・敬称（さん・氏・様・君・ちゃん）を除いた「索引名」で検索・重複判定し、原文の書き方（表記原文）と肩書き・リンクは根拠として残す。
import { cleanV4, PLATFORM_NAME } from './summary-cleaner-v4.mjs';

export const PERSON_INDEX_VERSION = 'PI-1';
export const PERSON_INDEX_HEADERS = ['EP-ID', '索引名', '表記原文', '肩書き・注記', 'リンク', '出典', '検証状態', '索引版'];
const HONORIFIC = /(?:さん|氏|様|さま|君|くん|ちゃん)$/;
// 索引名: NFKC、空白除去、末尾の敬称を除く。漢字の異体字は変えない（同一人物か断定できないため）
export function personKey(name) {
  return String(name ?? '').normalize('NFKC').replace(/[\s　]+/g, '').replace(HONORIFIC, '').trim();
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
export function buildPersonIndex(episodes) {
  const rows = [], hold = [], stat = { episodes: 0, withNames: 0, noNamesInRaw: 0, rawNone: 0, rows: 0, hold: 0 };
  for (const e of episodes) { stat.episodes++; const r = personRows(e.ep, e.raw); rows.push(...r.rows); hold.push(...r.hold);
    if (r.status === 'OK') stat.withNames++; else if (r.status === 'RAW_NONE') stat.rawNone++; else stat.noNamesInRaw++; }
  stat.rows = rows.length; stat.hold = hold.length;
  const byKey = new Map(); rows.forEach((r) => byKey.set(r.key, (byKey.get(r.key) || 0) + 1));
  const keys = [...byKey.keys()], loose = (k) => k.replace(/[・=＝.．]/g, '').replace(/[ヶケ]/g, 'ケ'), groups = new Map();
  keys.forEach((k) => { const g = loose(k); groups.set(g, [...(groups.get(g) || []), k]); });
  const variants = [...groups.values()].filter((v) => v.length > 1);
  stat.people = keys.length; stat.variantGroups = variants.length;
  return { rows, hold, stat, variants };
}
