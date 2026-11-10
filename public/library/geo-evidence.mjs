/** Evidence-based place classification for the universe map. Deterministic, no network, no AI.
 * A place name appearing in text is NOT enough to place a pin. Result per place: PIN | TAG | HOLD.
 *  PIN  = the episode is about an event/person/situation located there (title evidence, or repeated located-cue in body)
 *  TAG  = searchable geo tag only (mentioned, nationality/language use, relation phrases, weak evidence)
 *  HOLD = ambiguous token (e.g. short names that occur inside other words) - never pinned
 * Replaces the old rule "regex hit anywhere in title + first 1,800 chars => pin" (the cause of the 日本 mis-pins).
 */
const KATA = 'ァ-ヶー';
// name, aliases (regex sources). Ambiguous short names carry boundary guards.
export const PLACES = [
  {name: '日本', alias: ['日本(?![人語製車産式風的])', '国内'], generic: true},
  {name: 'アメリカ', alias: ['アメリカ', '米国', 'ワシントン(?:DC|ＤＣ)?']},
  {name: '中国', alias: ['中国(?![語人])', '北京', '上海']},
  {name: '韓国', alias: ['韓国(?![語人])', 'ソウル']},
  {name: 'タイ', alias: [`(?<![${KATA}])タイ(?![${KATA}])`, 'バンコク'], ambiguous: true},
  {name: 'インド', alias: ['インド(?!ネシア)', 'ニューデリー']},
  {name: 'ペルー', alias: ['ペルー', `(?<![${KATA}])リマ(?![${KATA}])`]},
  {name: 'フランス', alias: ['フランス(?![語人])', `(?<![${KATA}])パリ(?![${KATA}])`]},
  {name: 'キューバ', alias: ['キューバ', 'ハバナ']},
  {name: 'パレスチナ・ガザ', alias: ['パレスチナ', 'ガザ']},
  {name: 'ウクライナ', alias: ['ウクライナ', 'キーウ']},
  {name: 'ジャカルタ', alias: ['ジャカルタ', 'Jakarta']},
  {name: 'インドネシア', alias: ['インドネシア']},
];
const LOCATED_CUE = /(?:現地|特派員|支局|取材|訪(?:れ|問)|開催|被災|発生|起き(?:た|て)|入(?:り|った)|滞在|で(?:の|は)?(?:暮|活動|開か|行わ))/;
const NATIONAL_USE = /(?:日本人|日本語|日本製|日本代表|日本勢|日本企業|日本政府|日本と(?!.*(?:で|の)開催)|日本の(?:政治|経済|社会|若者|少子|制度|現状|課題))/;
const RELATION = /(?:と(?:の)?関係|の関係|をめぐ|めぐる|との(?:協議|交渉|対立|会談)|と(?:日本|米国|中国|韓国))/;
// Only an explicit located-event construction pins Japan; 日本社会/日本チーム/日本も… are national usage (tag).
const DOMESTIC_EVENT = /日本(?:国内|各地)?で(?:の)?(?:起き|発生|開催|行わ|相次|見つか|確認)|日本各地|日本列島/;
const sentences = text => String(text || '').split(/[。\n！？]/).filter(Boolean);
export function classifyPlaces({title = '', description = ''}) {
  const out = [];
  const body = String(description).slice(0, 1800);
  for (const p of PLACES) {
    const re = new RegExp(p.alias.join('|'));
    const inTitle = re.test(title);
    const hits = sentences(body).filter(s => re.test(s));
    if (!inTitle && !hits.length) continue;
    if (p.ambiguous && !inTitle && hits.length < 2) { out.push({place: p.name, decision: 'HOLD', reason: 'AMBIGUOUS_TOKEN_WEAK_EVIDENCE'}); continue; }
    if (p.generic) { // country-level word used by almost every episode: never a pin on mention alone
      const domestic = inTitle && DOMESTIC_EVENT.test(title) && !NATIONAL_USE.test(title) && !RELATION.test(title);
      out.push(domestic ? {place: p.name, decision: 'PIN', reason: 'TITLE_DOMESTIC_EVENT'} : {place: p.name, decision: 'TAG', reason: inTitle ? 'TITLE_NATIONAL_OR_RELATION_USE' : 'MENTION_ONLY'});
      continue;
    }
    const located = hits.filter(s => LOCATED_CUE.test(s) && !NATIONAL_USE.test(s));
    if (inTitle && !RELATION.test(title)) out.push({place: p.name, decision: 'PIN', reason: 'TITLE_EVIDENCE'});
    else if (located.length >= 2) out.push({place: p.name, decision: 'PIN', reason: 'REPEATED_LOCATED_CUE'});
    else out.push({place: p.name, decision: 'TAG', reason: inTitle ? 'TITLE_RELATION_USE' : 'MENTION_ONLY'});
  }
  return out;
}
export const pinnedPlaces = episode => classifyPlaces(episode).filter(x => x.decision === 'PIN').map(x => x.place);
