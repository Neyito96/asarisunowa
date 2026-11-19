// 朝ポキの宇宙: 回から地名を取り出す（純関数。Claude 作成の試作）
// 根拠（どの語が・どの欄に）を必ず残す。人名・比喩・別の意味と紛れる場合は前後の文字で除外し、迷うものは置かない。
import { PREFS, JP_PLACES, COUNTRIES } from './gazetteer.mjs';

// 場所の一覧: { id, name, kind: 'pref'|'jp'|'country', scope: 'jp'|'world', lat, lon, pref?, iso? }
export const PLACES = [];
const ALIASES = [];   // [表記, 場所番号]
PREFS.forEach(([name, al, lat, lon]) => { const id = PLACES.length; PLACES.push({ id, name, kind: 'pref', scope: 'jp', lat, lon }); [name, ...al].forEach((a) => ALIASES.push([a, id])); });
JP_PLACES.forEach(([name, al, lat, lon, pref]) => { const id = PLACES.length; PLACES.push({ id, name, kind: 'jp', scope: 'jp', lat, lon, pref }); [name, ...al].forEach((a) => ALIASES.push([a, id])); });
COUNTRIES.forEach(([names, iso, lat, lon]) => { const id = PLACES.length; PLACES.push({ id, name: names[0], kind: 'country', scope: 'world', lat, lon, iso }); names.forEach((a) => ALIASES.push([a, id])); });
ALIASES.sort((a, b) => b[0].length - a[0].length);   // 長い表記を先に（「東京都」を「東京」より先に）

const KANJI = /[一-龯々〆ヵヶ]/, KATA = /[ァ-ヴー]/;
const OK_AFTER_KANJI = /^[市県府都道駅産発港沖線第原城町村島湾大戦万五空地]/;   // 「福島第一」「長崎原爆」「沖縄戦」「大阪万博」などは地名のまま
const PERSON_AFTER = /^(さん|氏|くん|君|ちゃん|様|記者|選手|監督|教授|准教授|議員|弁護士|医師|アナ|先生|容疑者|被告|社長|会長|代表|編集委員)/;
const NOT_FOREIGN = { '中国': /^(地方|・四国|四国|電力|新聞|山地|自動車道)/ };

// 1つの文から [場所番号, 位置] の一覧（重なりは長い表記を優先）
export function findPlaces(text) {
  const s = String(text || '').normalize('NFKC'), used = new Uint8Array(s.length), out = [];
  for (const [a, id] of ALIASES) {
    let from = 0;
    for (;;) {
      const i = s.indexOf(a, from); if (i < 0) break; from = i + 1;
      const j = i + a.length; let bad = false;
      for (let k = i; k < j; k++) if (used[k]) { bad = true; break; }
      if (bad) continue;
      const prev = s.charAt(i - 1), next = s.charAt(j), rest = s.slice(j, j + 6);
      if (KATA.test(a.charAt(0)) && (KATA.test(prev) || KATA.test(next))) continue;           // 「インド」→「インドネシア」の一部
      if (KANJI.test(a.charAt(0)) && KANJI.test(prev)) continue;                              // 「東京都」の中の「京都」など
      if (a.length <= 2 && KANJI.test(a.slice(-1)) && KANJI.test(next) && !OK_AFTER_KANJI.test(rest)) continue;   // 短い名前だけ: 「石川佳純」「宮崎駿」
      if (PERSON_AFTER.test(rest)) continue;                                                  // 「福島さん」「長野記者」
      if (NOT_FOREIGN[a] && NOT_FOREIGN[a].test(rest)) continue;                             // 「中国地方」
      for (let k = i; k < j; k++) used[k] = 1;
      out.push([id, i, a]);
    }
  }
  return out.sort((x, y) => x[1] - y[1]);
}

const FIELD_W = { title: 3, theme: 2.5, article: 1.5, desc: 1 };
// 回の場所: [[場所番号, 得点, 欄, 表記]]（得点順・最大4か所）
export function placesOfEpisode({ title, theme, articles, desc }) {
  const fields = { title, theme: String(theme || '').replace(/^[^/]*\//, ''), article: (articles || []).join('／'), desc };
  const sc = new Map();
  for (const [f, text] of Object.entries(fields)) for (const [id, , a] of findPlaces(text)) {
    const cur = sc.get(id) || { s: 0, f: '', a: '' }; cur.s += FIELD_W[f]; if (!cur.f || FIELD_W[f] > FIELD_W[cur.f]) { cur.f = f; cur.a = a; } sc.set(id, cur);
  }
  return [...sc].map(([id, v]) => [id, Math.round(v.s * 10) / 10, v.f, v.a]).sort((a, b) => b[1] - a[1]).slice(0, 4);
}
