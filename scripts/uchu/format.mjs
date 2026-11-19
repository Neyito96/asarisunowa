// 朝ポキの宇宙: 「形式」の軸（#390）。テーマとは別に、回の作り（対談・お便り・振り返り…）を題名・概要欄の決まった言い回しで判定する（純関数）
// 推測はしない。根拠の言い回しが見つかったものだけ。1回に複数の形式が付くこともある。
import { stripBoilerplate } from './classify.mjs';
import { seriesOf } from './series.mjs';
const nz = (s) => String(s || '').normalize('NFKC');

export const FORMATS = [
  { name: '対談・ゲスト', title: /×|に聞く|と語る|と考える|インタビュー|対談|ゲスト/, desc: /をゲストに|ゲストに(お)?迎え|ゲストは|にご出演いただ/ },
  { name: 'お便り・相談', title: /お便り|おたより|お悩み|相談|質問|ご意見/, desc: /お便り|おたより|お悩み|リスナー(さん)?(から|の)(質問|メッセージ|声|相談)|質問(に|を)(お)?答え/ },
  { name: '振り返り・まとめ', title: /月刊朝ポキ|総集編|年末スペシャル|この1年を振り返|1年を振り返|ふりかえり/, desc: /前月のいちおし|総集編|1年を振り返/ },
  { name: '新聞めくり', title: /新聞をめくろう|別刷り/, desc: /新聞をめくろう|紙面をめく|別刷りをめく/ },
  { name: '番組づくり・舞台裏', title: /楽屋裏|制作会議|配信ペース|番組づくり|朝ポキのこれから/, desc: /制作会議|番組づくり|朝ポキのこれから|配信ペース/ },
  { name: 'ニュースチャット', title: /ニュースチャット|1on1/i, desc: /ニュースチャット|1on1/i },
  { name: '朗読', title: /朗読/, desc: /朗読/ },
  { name: '子ども向け', title: /こども|子ども記者|小学生新聞/, desc: /お子さんに|子どもゲスト|小学生新聞/, show: /こどもそうだんしつ/, series: /shinbun-kyoshitsu/ },
  { name: '公開収録・イベント', title: /公開収録|イベント|オフ会|ライブ配信/, desc: /公開収録|イベントで収録|会場で収録/ },
];

// [[形式の番号, 根拠の言葉, 'title'|'desc'|'show'], ...]
export function formatsOf(e) {
  const t = nz(e.title), d = stripBoilerplate(nz(e.description)).slice(0, 200), s = seriesOf(e), out = [];
  FORMATS.forEach((f, k) => {
    let m;
    if (f.series && s && f.series.test(s.id)) out.push([k, s.name, 'show']);
    else if (f.show && f.show.test(nz(e.show))) out.push([k, nz(e.show), 'show']);
    else if ((m = t.match(f.title))) out.push([k, m[0], 'title']);
    else if ((m = d.match(f.desc))) out.push([k, m[0], 'desc']);
  });
  return out;
}
