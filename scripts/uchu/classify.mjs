// 朝ポキの宇宙: 20大分類・小分類の Claude 試作判定（純関数。Node のテストでも使う）
// 入力は 題名・旧仮分類の主題文・関連記事の見出し・概要欄・蔵の公式タグ。手がかり語の一致を数え、どの語で決めたかを必ず残す。
// 人の承認（user_approved）の大分類は動かさない。判定できない回は「未分類」のまま（無理に入れない）。
import { TAXONOMY, LEGACY_MAIN_ALIAS } from './taxonomy.mjs';

const nz = (s) => String(s || '').normalize('NFKC');
const FIELD_W = { title: 3, theme: 2.5, article: 1.5, desc: 1 };
// 蔵の元データにある公式タグ（朝日新聞側が付けたもの）→ 大分類。番組名・人名・意味の広いタグ（IT・科学、災害・交通 など）は使わない
export const OFFICIAL_TAGS = {
  '社会': '社会・人権', '不平等': '社会・人権', '平等': '社会・人権', 'ジェンダー': 'ジェンダー', 'ジェンダートーク': 'ジェンダー', 'LGBTQ': 'ジェンダー',
  '国際': '国際・外交', 'アジア': '国際・外交', 'ヨーロッパ': '国際・外交', '北米': '国際・外交', '平和': '国際・外交',
  '環境・気候変動': '環境・気候', '環境': '環境・気候', '地域': '暮らし・生活', '子育て・家族': '暮らし・生活', '家族・子育て': '暮らし・生活', '子育て': '暮らし・生活',
  '料理・グルメ': '暮らし・生活', 'グルメ・料理': '暮らし・生活', '食のへぇ～': '暮らし・生活', '心と体': '健康・医療', '医療': '健康・医療', '新型コロナ': '健康・医療',
  '教育': '教育', '文化・芸能': '文化・芸術', '映画・ドラマ': '文化・芸術', 'マンガ・アニメ・ゲーム': '文化・芸術', '動植物': '動物・自然',
  '働き方': '仕事・労働', '労働・雇用': '仕事・労働', '雇用・労働': '仕事・労働', '育休': '仕事・労働', '経済': '経済・金融', '産業・商品': '経済・金融', '企業': '経済・金融',
  '政治': '政治・行政', '選挙': '政治・行政', '歴史': '歴史・宗教', '宗教': '歴史・宗教', 'スポーツ': 'スポーツ', '五輪': 'スポーツ', '野球': 'スポーツ',
  'ネット・SNS': 'AI・技術', '事件・事故・裁判': '法律・司法', '新聞': 'メディア', 'テレビ・ラジオ': 'メディア', '福祉': '福祉・介護',
};
const TAG_MI = Object.fromEntries(Object.entries(OFFICIAL_TAGS).map(([t, n]) => [nz(t), TAXONOMY.findIndex((m) => m.name === n)]));
const TAG_W = 3;

// 手がかり語を照合用に準備（英字は前後が英字でないことを条件にする: "AI" が "MAIL" に当たらないように）
const KW = [];
TAXONOMY.forEach((m, mi) => m.subs.forEach(([, words], si) => words.forEach((w) => {
  const k = nz(w);
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 英字は前後が英字でないこと。3文字以下のカタカナ語は前後がカタカナでないこと（「パン」が「ジャパン」に、「ペット」が「ペットボトル」に当たらないように。監査 #390）
  const re = /^[A-Za-z0-9\-]+$/.test(k) ? new RegExp(`(?<![A-Za-z])${esc}(?![A-Za-z])`) : /^[ァ-ヴー]{1,3}$/.test(k) ? new RegExp(`(?<![ァ-ヴー])${esc}(?![ァ-ヴー])`) : null;
  KW.push({ k, re, mi, si, w: 1 + Math.min(4, k.length - 2) * 0.15 });
})));
const hit = (kw, text) => (kw.re ? kw.re.test(text) : text.includes(kw.k));
// 手がかり語の前に消しておく言い回し（別の意味になる複合語。監査 #390）
const MASK = /テレビ塔/g;
// 副分類の根拠としては弱い公式タグ（意味が広い）。これだけでは副分類にしない
const BROAD_TAGS = new Set(['社会', '不平等', '平等', '働き方', '経済', '地域', '子育て・家族', '家族・子育て'].map(nz));

// 概要欄の番組共通の案内文を除く（どの回にも出るため根拠にしない）
// 概要欄の定型文を除く: ①番組一覧の宣伝（「…」「…」「…」の7番組を配信中です）②※・★で始まる注記（収録日・告知・紹介したポッドキャスト名など）を次の句点まで
export function stripBoilerplate(desc) {
  return nz(desc).replace(/★[^★\n]{1,60}★/g, ' ')   // ★…★ で囲んだ告知（「★空気階段に悩みを相談しよう★」など）
    .replace(/[^。!！\n]*(イベントを開催します|を開催します[!！]|参加無料|要申し?込み?|お申し込み|申し込み(受付|は)|リアル会場は|配信を開始|締め切り迫る)[^。!！\n]*[。!！]?/g, ' ')   // イベント告知の文（監査 #390: 公開収録の誤検出の原因）
    .replace(/※?\s*(「[^」]{1,30}」){3,}[^。※★]*?番組を配信中です。?/g, '').replace(/[※★][^。\n※★ 　]*。?/g, '').split(/\n|(?<=。)/).filter((line) => !/(beモニター|フォーム|ご意見|ご要望|ハッシュタグ|購読|会員登録|お便り|メールアドレス|ツイッター|X\(旧|https?:\/\/|下記サイト|番組へのご|プレゼント)/.test(line)).join('');
}

// 1回分の得点: { main: [20], sub: {mi: [..]}, ev: [[語, 欄]] }
export function scoreEpisode({ title, theme, articles, desc, tags }) {
  const fields = { title: nz(title).replace(MASK, ' '), theme: nz(theme).replace(/^[^/]*\//, ''), article: (articles || []).map(nz).join('／').replace(MASK, ' '), desc: stripBoilerplate(desc).replace(MASK, ' ') };
  const main = new Array(TAXONOMY.length).fill(0), sub = TAXONOMY.map((m) => new Array(m.subs.length).fill(0)), ev = [];
  for (const kw of KW) {
    let best = 0, where = '';
    for (const [f, text] of Object.entries(fields)) if (text && FIELD_W[f] > best && hit(kw, text)) { best = FIELD_W[f]; where = f; }
    if (!best) continue;
    const s = best * kw.w; main[kw.mi] += s; sub[kw.mi][kw.si] += s; ev.push([kw.k, where, kw.mi, kw.si, s]);
  }
  for (const t of new Set((tags || []).map(nz))) { const mi = TAG_MI[t]; if (mi >= 0) { main[mi] += TAG_W; ev.push([t, 'tag', mi, -1, TAG_W]); } }
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
  // 同点のときは題名に根拠がある分野を先に（それも同じなら分類の並び順）
  const tw = (k) => sc.ev.reduce((a, e) => a + (e[2] === k && e[1] === 'title' ? e[4] : 0), 0);
  const rank = sc.main.map((_, k) => k).sort((a, b) => sc.main[b] - sc.main[a] || tw(b) - tw(a) || a - b);
  const top = rank[0], sec = rank[1], total = sc.main.reduce((a, b) => a + b, 0), topS = sc.main[top], second = sc.main[sec];
  let mi = -1, conf = -1, src = '', mi2 = -1;
  if (isApproved && priorAny >= 0) { mi = priorAny; conf = 3; src = 'a'; }
  else if (prior >= 0) { mi = prior; src = 'p'; conf = topS > 0 && top === prior ? 2 : 1; }
  else if (topS >= 4 && topS >= second * 1.6) { mi = top; src = 'd'; conf = topS >= 7 ? 2 : 1; }
  else if (topS >= 2.5 && second >= 2.5) { mi = top; mi2 = sec; src = 'd'; conf = topS >= 4 ? 1 : 0; }   // 二つの分野にまたがる（#390）: 主分類と副分類
  else if (topS >= 2.5 && topS > second) { mi = top; src = 'd'; conf = 0; }
  // 決まった回でも、ほかの分野に十分な根拠（3点以上・主分類の半分以上）があれば副分類にする
  if (mi >= 0 && mi2 < 0) { const c2 = rank.find((k) => k !== mi); if (sc.main[c2] >= 3 && sc.main[c2] >= sc.main[mi] * 0.5) mi2 = c2; }
  // 監査（#390）: 副分類の根拠が「関連記事の見出しだけ」（正答 40%）や「意味の広い公式タグだけ」のときは付けない
  if (mi2 >= 0) { const e2 = sc.ev.filter((e) => e[2] === mi2); if (e2.every((e) => e[1] === 'article') || e2.every((e) => e[1] === 'tag' && BROAD_TAGS.has(e[0]))) mi2 = -1; }
  const subOf = (m) => (m >= 0 && sc.sub[m].some((x) => x > 0) ? argmax(sc.sub[m]) : -1);
  const evOf = (m) => (m >= 0 ? sc.ev.filter((e) => e[2] === m).sort((a, b) => b[4] - a[4]).slice(0, 4).map(([k, f]) => [k, f]) : []);
  return { mi, si: subOf(mi), conf, src, ev: evOf(mi), mi2, si2: subOf(mi2), ev2: evOf(mi2), total, scores: sc.main };
}

// 判定できなかった回を、根拠のある関連回（rel）の大分類の多数決で補う（低い確度・近い回から）
export function fillFromNeighbors(results, rel) {
  return results.map((r, i) => {
    if (r.mi >= 0) return r;
    const vote = new Map();
    for (const [j, s] of rel[i][0] || []) { const o = results[j]; if (o.mi >= 0 && o.src !== 'n') vote.set(o.mi, (vote.get(o.mi) || 0) + s); }
    const best = [...vote].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 60) return r;
    return { ...r, mi: best[0], si: -1, conf: 0, src: 'n', ev: [], mi2: -1, si2: -1, ev2: [] };
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
