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
  // scope: world|japan (original test1024-map scope), lat/lon: the prototype's marker position.
  {name: '日本', alias: ['日本(?![人語製車産式風的])', '国内'], generic: true, scope: 'world', lat: 36.2, lon: 138.25},
  {name: 'アメリカ', alias: ['アメリカ', '米国', '米政府', 'ワシントン(?![・･]ポスト|条約)(?:DC|ＤＣ)?'], scope: 'world', lat: 38, lon: -97},
  {name: '中国', alias: ['中国(?![語人地方電山])', '北京', '上海'], scope: 'world', lat: 35, lon: 103},
  {name: '韓国', alias: ['韓国(?![語人])', 'ソウル(?!メイト|フード|ミュージック)'], scope: 'world', lat: 36, lon: 128},
  {name: '台湾', alias: ['台湾', '台北'], scope: 'world', lat: 23.7, lon: 121},
  {name: 'ロシア', alias: ['ロシア(?![語人])', 'モスクワ'], scope: 'world', lat: 61, lon: 100},
  {name: 'ウクライナ', alias: ['ウクライナ', 'キーウ'], scope: 'world', lat: 49, lon: 32},
  {name: 'イスラエル', alias: ['イスラエル'], scope: 'world', lat: 31.5, lon: 35},
  {name: 'パレスチナ・ガザ', alias: ['パレスチナ', 'ガザ'], scope: 'world', lat: 31.5, lon: 34.4},
  {name: 'キューバ', alias: ['キューバ', 'ハバナ'], scope: 'world', lat: 21.5, lon: -79.4},
  {name: 'ブラジル', alias: ['ブラジル'], scope: 'world', lat: -14, lon: -51},
  {name: 'イギリス', alias: ['イギリス', '英国', 'ロンドン'], scope: 'world', lat: 54, lon: -2},
  {name: 'フランス', alias: ['フランス(?![語人])', `(?<![${KATA}])パリ(?![${KATA}])`], scope: 'world', lat: 46.6, lon: 2.2},
  {name: 'ドイツ', alias: ['ドイツ(?![語人])', 'ベルリン'], scope: 'world', lat: 51, lon: 10},
  {name: 'タイ', alias: [`(?<![${KATA}])タイ(?![${KATA}])`, 'バンコク'], ambiguous: true, scope: 'world', lat: 15, lon: 101},
  {name: 'インド', alias: ['インド(?!ネシア)', 'ニューデリー'], scope: 'world', lat: 22.5, lon: 79},
  {name: 'ペルー', alias: ['ペルー', `(?<![${KATA}])リマ(?![${KATA}])`], scope: 'world', lat: -9.2, lon: -75},
  {name: 'イラン', alias: ['イラン', 'テヘラン'], scope: 'world', lat: 32, lon: 53},
  {name: '北朝鮮', alias: ['北朝鮮', '平壌'], scope: 'world', lat: 40, lon: 127.5},
  {name: 'ベトナム', alias: ['ベトナム'], scope: 'world', lat: 16, lon: 108},
  {name: 'オーストラリア', alias: ['オーストラリア'], scope: 'world', lat: -25, lon: 133},
  {name: 'ジャカルタ', alias: ['ジャカルタ', 'Jakarta'], scope: 'world', lat: -6.2, lon: 106.8},
  {name: 'インドネシア', alias: ['インドネシア'], scope: 'world', lat: -2.5, lon: 118},
  // Japan. Person names (松本人志, 石川さん, 宮城さん), clubs/institutions (広島カープ, 東京大学, 京都大学, 川崎フロンターレ) are NOT locations.
  {name: '北海道', alias: ['北海道', '札幌(?!医)'], scope: 'japan', lat: 43.1, lon: 142.8},
  {name: '青森', alias: ['青森'], scope: 'japan', lat: 40.8, lon: 140.7},
  {name: '宮城', alias: ['宮城県', '仙台(?!育英)'], scope: 'japan', lat: 38.3, lon: 140.9},
  {name: '東京', alias: ['東京(?!大学|五輪|オリンピック|パラリンピック|大会|電力|地検|地裁|新聞|ドーム|ディズニー|ヤクルト|高裁|都知事選)', '都内', '新宿', '渋谷'], scope: 'japan', lat: 35.7, lon: 139.7},
  {name: '神奈川', alias: ['神奈川', '横浜(?!DeNA|ＤｅＮＡ|F[・･]マリノス|FC|高|×)', '川崎市'], scope: 'japan', lat: 35.45, lon: 139.6},
  {name: '長野', alias: ['長野(?!智子|さん|氏)', '松本市', '諏訪', '上伊那'], scope: 'japan', lat: 36.65, lon: 138.18},
  {name: '新潟', alias: ['新潟'], scope: 'japan', lat: 37.9, lon: 139.0},
  {name: '石川', alias: ['石川県', '金沢', '能登'], scope: 'japan', lat: 36.56, lon: 136.66},
  {name: '静岡', alias: ['静岡'], scope: 'japan', lat: 34.98, lon: 138.38},
  {name: '愛知', alias: ['愛知', '名古屋(?!グランパス)'], scope: 'japan', lat: 35.18, lon: 136.91},
  {name: '京都', alias: ['京都(?!大学|アニメーション|新聞)'], scope: 'japan', lat: 35.02, lon: 135.76},
  {name: '大阪', alias: ['大阪(?!桐蔭|大学)'], scope: 'japan', lat: 34.69, lon: 135.5},
  {name: '兵庫', alias: ['兵庫', '神戸(?!ヴィッセル)'], scope: 'japan', lat: 34.7, lon: 135.2},
  {name: '広島', alias: ['広島(?!カープ|東洋|大学)'], scope: 'japan', lat: 34.4, lon: 132.46},
  {name: '福岡', alias: ['福岡(?!ソフトバンク|ホークス)', '北九州'], scope: 'japan', lat: 33.6, lon: 130.4},
  {name: '沖縄', alias: ['沖縄', '那覇'], scope: 'japan', lat: 26.3, lon: 127.8},
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
