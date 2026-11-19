// 朝ポキの宇宙: 20大分類・小分類の Claude 試作判定（純関数。Node のテストでも使う）
// 入力は 題名・旧仮分類の主題文・関連記事の見出し・概要欄。手がかり語の一致を数え、どの語で決めたかを必ず残す。
// 人の承認（user_approved）の大分類は動かさない。判定できない回は「未分類」のまま（無理に入れない）。
import { TAXONOMY, LEGACY_MAIN_ALIAS } from './taxonomy.mjs';

const nz = (s) => String(s || '').normalize('NFKC');
const FIELD_W = { title: 3, theme: 2.5, article: 1.5, desc: 1 };

// 手がかり語を照合用に準備（英字は前後が英字でないことを条件にする: "AI" が "MAIL" に当たらないように）
const KW = [];
TAXONOMY.forEach((m, mi) => m.subs.forEach(([, words], si) => words.forEach((w) => {
  const k = nz(w);
  const re = /^[A-Za-z0-9\-]+$/.test(k) ? new RegExp(`(?<![A-Za-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`) : null;
  KW.push({ k, re, mi, si, w: 1 + Math.min(4, k.length - 2) * 0.15 });
})));
const hit = (kw, text) => (kw.re ? kw.re.test(text) : text.includes(kw.k));

// 概要欄の番組共通の案内文を除く（どの回にも出るため根拠にしない）
export function stripBoilerplate(desc) {
  return nz(desc).split(/\n|(?<=。)/).filter((line) => !/(beモニター|フォーム|ご意見|ご要望|ハッシュタグ|購読|会員登録|お便り|メールアドレス|ツイッター|X\(旧|https?:\/\/|下記サイト|番組へのご|プレゼント)/.test(line)).join('');
}

// 1回分の得点: { main: [20], sub: {mi: [..]}, ev: [[語, 欄]] }
export function scoreEpisode({ title, theme, articles, desc }) {
  const fields = { title: nz(title), theme: nz(theme).replace(/^[^/]*\//, ''), article: (articles || []).map(nz).join('／'), desc: stripBoilerplate(desc) };
  const main = new Array(TAXONOMY.length).fill(0), sub = TAXONOMY.map((m) => new Array(m.subs.length).fill(0)), ev = [];
  for (const kw of KW) {
    let best = 0, where = '';
    for (const [f, text] of Object.entries(fields)) if (text && FIELD_W[f] > best && hit(kw, text)) { best = FIELD_W[f]; where = f; }
    if (!best) continue;
    const s = best * kw.w; main[kw.mi] += s; sub[kw.mi][kw.si] += s; ev.push([kw.k, where, kw.mi, kw.si, s]);
  }
  return { main, sub, ev };
}

const argmax = (a) => a.reduce((b, x, i) => (x > a[b] ? i : b), 0);
export const legacyMainIndex = (theme) => {
  const name = LEGACY_MAIN_ALIAS[nz(theme).split('/')[0].trim()];
  return name ? TAXONOMY.findIndex((m) => m.name === name) : -1;
};

// 判定。conf: 3=人が承認 / 2=高 / 1=中 / 0=低 / -1=未分類。src: a=承認, d=手がかり語, p=旧仮分類の大分類, n=近い回から
export function classify(input, legacy) {
  const sc = scoreEpisode(input);
  const isApproved = legacy && legacy[1] === 'user_approved';
  const priorAny = legacy ? legacyMainIndex(legacy[0]) : -1;
  const prior = legacy && legacy[0].includes('/') ? priorAny : -1;   // 「大/小」形式の旧分類だけ大分類の手がかりにする（自由記述は本文として使う）
  const top = argmax(sc.main), total = sc.main.reduce((a, b) => a + b, 0), topS = sc.main[top];
  const second = Math.max(...sc.main.filter((_, i) => i !== top), 0);
  let mi = -1, conf = -1, src = '';
  if (isApproved && priorAny >= 0) { mi = priorAny; conf = 3; src = 'a'; }
  else if (prior >= 0) { mi = prior; src = 'p'; conf = topS > 0 && top === prior ? 2 : 1; }
  else if (topS >= 4 && topS >= second * 1.6) { mi = top; src = 'd'; conf = topS >= 7 ? 2 : 1; }
  else if (topS >= 2.5 && topS > second) { mi = top; src = 'd'; conf = 0; }
  const si = mi >= 0 && sc.sub[mi].some((x) => x > 0) ? argmax(sc.sub[mi]) : -1;
  const ev = mi >= 0 ? sc.ev.filter((e) => e[2] === mi).sort((a, b) => b[4] - a[4]).slice(0, 4).map(([k, f]) => [k, f]) : [];
  return { mi, si, conf, src, ev, total, scores: sc.main };
}

// 判定できなかった回を、根拠のある関連回（rel）の大分類の多数決で補う（低い確度・近い回から）
export function fillFromNeighbors(results, rel) {
  return results.map((r, i) => {
    if (r.mi >= 0) return r;
    const vote = new Map();
    for (const [j, s] of rel[i][0] || []) { const o = results[j]; if (o.mi >= 0 && o.src !== 'n') vote.set(o.mi, (vote.get(o.mi) || 0) + s); }
    const best = [...vote].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 60) return r;
    return { ...r, mi: best[0], si: -1, conf: 0, src: 'n', ev: [] };
  });
}

// 手がかり語で高い確度に決まった回から、語と大分類の結びつきを学ぶ（単純ベイズ）。手がかり語で決まらない回の補いに使う
export function trainNB(samples, K) {   // samples: [[Map(語→回数), 大分類]]
  const cnt = Array.from({ length: K }, () => new Map()), tot = new Array(K).fill(0), docs = new Array(K).fill(0), V = new Set();
  for (const [m, c] of samples) { docs[c]++; for (const [k, v] of m) { cnt[c].set(k, (cnt[c].get(k) || 0) + v); tot[c] += v; V.add(k); } }
  return { cnt, tot, docs, V, K, D: samples.length };
}
export function predictNB(model, m) {
  const { cnt, tot, docs, V, K, D } = model;
  const sc = Array.from({ length: K }, (_, c) => Math.log((docs[c] + 1) / (D + K)));
  for (const [k, v] of m) { if (!V.has(k)) continue; for (let c = 0; c < K; c++) sc[c] += Math.min(v, 3) * Math.log(((cnt[c].get(k) || 0) + 0.1) / (tot[c] + 0.1 * V.size)); }
  const o = sc.map((s, c) => [c, s]).sort((a, b) => b[1] - a[1]);
  return { c: o[0][0], margin: 1 / (1 + Math.exp(o[1][1] - o[0][1])) };
}
