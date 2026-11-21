// みんなで仕分け: 画面から切り離した純粋な部品（テストあり）

// 端末ごとに並びを変える（5,000人が同じ回に集中しないように）。決まった種からの並びなので、同じ端末では毎回同じ
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// 並び順: ①Claude が特に迷った回 ②票が3未満の回（少ない順）③それ以外 — 自分が仕分け済み・スキップした回は最後
export function queueOrder(items, device) {
  const rank = (x) => (x.mine ? 3 : x.skipped ? 2 : 0);
  return [...items].sort((a, b) =>
    rank(a) - rank(b) ||
    (b.boundary === true) - (a.boundary === true) ||
    Math.min(a.n, 3) - Math.min(b.n, 3) ||
    hash(device + a.id) - hash(device + b.id));
}

const PLATFORMS = [
  [/^https:\/\/open\.spotify\.com\/episode\//, 'spotify', 'Spotify'],
  [/^https:\/\/podcasts\.apple\.com\//, 'apple', 'Apple Podcasts'],
  [/^https:\/\/music\.amazon\./, 'amazon', 'Amazon Music'],
  [/^https:\/\/(pca\.st|pocketcasts\.com)\//, 'pocketcasts', 'Pocket Casts'],
  [/^https:\/\/listen\.style\//, 'listen', 'LISTEN'],
  [/^https:\/\/pody\.jp\//, 'pody', 'Pody'],
  [/^https:\/\/(www\.)?youtube\.com\/|^https:\/\/youtu\.be\//, 'youtube', 'YouTube'],
  [/^https:\/\/omny\.fm\/shows\/.+\/embed$/, 'omny-embed', 'Omny'],
  [/^https:\/\/omny\.fm\/shows\//, 'omny', 'Omny'],
  [/^https:\/\/www\.asahi\.com\/special\/podcasts\//, 'asahi', '朝日新聞 公式'],
];
export function platformOf(url) { for (const [re, key, name] of PLATFORMS) if (re.test(String(url || ''))) return { key, name }; return null; }

export function shareText(title, url) { return `この回、どの分類だと思う？「${title}」 #朝リスみんなで仕分け ${url}`; }

// 票の多い順（同数は名前順）。「わからない」は別に数えるので含めない
export function topVotes(v, limit = 6) {
  return Object.entries((v && v.main) || {}).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja')).slice(0, limit);
}

// 票がそろったか（宇宙に「みんなの分類」として出す条件。管理人決定 11/20: 3人以上・3分の2以上が同じ主分類）
export function consensus(v, minN = 3, ratio = 2 / 3) {
  if (!v) return null;
  const decided = Object.values(v.main || {}).reduce((s, x) => s + x, 0);
  if (v.n < minN || decided < minN) return null;
  const top = topVotes(v, 1)[0];
  return top && top.count / v.n >= ratio ? { name: top.name, count: top.count, n: v.n } : null;
}

// みんなの見立て（#456）: 1人目から票をそのまま並べる。「わからない」は別に数える
export function viewpoints(v, limit = 4) {
  if (!v || !v.n) return null;
  return { n: v.n, rows: topVotes(v, limit), unsure: v.unsure || 0 };
}
// この端末で送った直後の集計（GASが返した最新の数）が、公開中の votes.json より新しければそちらを使う
export function freshTally(served, fresh, generatedAt) {
  if (!fresh || !fresh.t || typeof fresh.t.n !== 'number') return served || null;
  const g = Date.parse(generatedAt || '') || 0;
  return fresh.at > g ? fresh.t : (served || null);
}
