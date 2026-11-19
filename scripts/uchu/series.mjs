// 朝ポキの宇宙: 番組（シリーズ）ごとの概要欄の清掃とテーマの取り出し（純関数）
// 毎回同じ前置き・番組名・連絡先は言葉・分類・地名の材料にしない。代わりに、その回で「取り上げた記事の見出し」をテーマとして使う。
// 蔵の元データ（題名・概要欄の原文）は変えない。ここで作るのは分析用の写しだけ。
const nz = (s) => String(s || '').normalize('NFKC');

export const SERIES = [
  {
    id: 'shinbun-kyoshitsu',
    name: '笑い飯哲夫のしんぶん教室',
    match: (e) => /笑い飯\s*・?\s*哲夫の(しんぶん|新聞)教室/.test(nz(e.title)) || /「笑い飯哲夫のしんぶん教室」をノーカット/.test(nz(e.description)),
    // 題名の番組名と回数（「教室」が教育に、「哲夫」「笑い飯」が言葉に入らないように）
    title: [/笑い飯\s*・?\s*哲夫の(しんぶん|新聞)教室\s*[0-9①-⑳]*\s*/g],
    desc: [
      /大阪ABCラジオ「笑い飯哲夫のしんぶん教室」をノーカットでお届けします。/g,   // 「大阪」が地名に入っていた
      /(普段は|通常は)?、?哲夫さんが、?(スタジオとオンラインで結んだ)?お子さんに、?朝日新聞の記事を説明する(30分)?番組(です。|ですが、?)/g,
      /パーソナリティ\s*哲夫さん\s*\(笑い飯\)\s*、\s*小寺右子さん\s*\(ABCアナウンサー\)/g,
      /子どもゲスト\s*.*?\((?:[^()]*、)?\s*(?:小|中|高|年長|年中)[^)]*\)/g,   // 子どもゲストの名前・都道府県・学年（地名や人物にしない）
      /「笑い飯哲夫のしんぶん教室」公式ホームページ/g,
      /\d+回目(は|で取り上げる記事は)、?\s*/g,
      /(\d+年)?\d+月\d+日(\([^)]*\))?付?(朝刊|夕刊)(\(大阪本社発行\))?(に掲載された)?/g,   // 「大阪本社」も地名にしない
      /(使用した)?記事は、?/g,
    ],
    // その回で取り上げた記事の見出し: 「…」または『…』のあとに「の記事」「です」「を取り上げ」
    headline: /(?:「((?:[^「」]|「[^」]*」)+)」|『([^』]+)』)\s*(?:の記事|です|を取り上げ)/,
  },
];

// 番組をまたぐ定型文（URL・メールアドレス・イベント告知・関連記事の見出しの繰り返し）
const COMMON = [
  /https?:\/\/\S+/g, /mailto:\S+/g, /[\w.+-]+@[\w-]+(\.[\w-]+)+/g,
  /[^。!！]*オンラインイベント[^。!！]*を開催します[!！]?/g,
  /【関連記事】.*$/s,
];

export function seriesOf(e) { return SERIES.find((s) => s.match(e)) || null; }

// 分析用の写し: { title, desc, headline, series }
export function cleanEpisode(e) {
  const s = seriesOf(e);
  let title = nz(e.title), desc = nz(e.description), headline = '';
  if (s) {
    const m = desc.match(s.headline); if (m) headline = (m[1] || m[2] || '').trim();
    for (const re of s.title) title = title.replace(re, ' ');
    for (const re of s.desc) desc = desc.replace(re, ' ');
    if (headline) desc = desc.split(headline).join(' ').replace(/[「『]\s*[」』](の記事)?(を取り上げました|です)?。?/g, ' ');
  }
  for (const re of COMMON) desc = desc.replace(re, ' ');
  return { title: title.replace(/\s+/g, ' ').trim(), desc: desc.replace(/\s+/g, ' ').trim(), headline, series: s ? s.id : '' };
}
