// Phase 11 publication layer over V3 mechanical rendering. Never mutates raw text.
import { cleanDescription } from './library-clean.mjs';
export const DESCRIPTION_VERSION = 'V3-public-sections-1';
const urlPattern = /https?:\/\/[^\s<>「」『』（）()"'、]+/g;
export function publicationUrl(raw) {
  try {
    const u=new URL(raw); if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';
    for(const k of [...u.searchParams.keys()])if(/^(utm_.+|iref|ref|fbclid|gclid|si)$/i.test(k))u.searchParams.delete(k);
    return u.href;
  } catch { return ''; }
}
export function descriptionLines(raw) {
  return String(raw||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n').replace(/<br\s*\/?\s*>|<\/?(?:p|div|li)\b[^>]*>/gi,'\n')
    .split('\n').map(s=>cleanDescription(s).replace(/&(hellip|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/g,(_,n)=>({hellip:'…',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”'}[n]))).filter(Boolean);
}
function extractLinks(text, kind='article') {
  const out=[]; let previous=0;
  for(const m of text.matchAll(urlPattern)) {
    const originalUrl=m[0].replace(/[.,;]+$/,''); const url=publicationUrl(originalUrl);if(!url)continue;
    const title=text.slice(previous,m.index).replace(/^[\s▽・／/）)]+/,'').replace(/[\s（(]+$/,'').trim();
    out.push({title:title||originalUrl,originalUrl,url,kind,linkStatus:'NOT_CHECKED',checkedAt:null}); previous=m.index+m[0].length;
  } return out;
}
export function editDescription(raw, {relatedUrls=[],linkEvidence={}}={}) {
  const body=[],staff=[],recording=[],removed=[],related=[],unclassified=[];let section='body';
  for(let line of descriptionLines(raw)) {
    // Split common footer from a recording date, even when stored in one paragraph.
    line=line.replace(/朝日新聞ポッドキャスト[（(][\s\S]*?では他にも様々な番組を配信、テキストでも読めます。?/g,m=>{removed.push({reason:'COMMON_FOOTER',text:m});return '';});
    if(!line.trim())continue;
    if(/^[★※]?過去の.*(?:シリーズ|配信リスト)|^藤田知也記者による連載/.test(line)&&/https?:/.test(line)){related.push(...extractLinks(line,'reference'));continue;}
    if((/^★/.test(line)&&/姉妹番組|記者サロン|移管|チャンネル|イベント|申し込み|詳細はこちら|展|講座|生配信|強化ウイーク|昨日配信|この番組|この続き|クラウドファンディング|生出演/.test(line))||(/^※/.test(line)&&/(?:開催|登録|応募フォーム|お申し込み)/.test(line))){removed.push({reason:'EXPLICIT_PROMOTION',text:line});continue;}
    if(/^※(?:【連載】|朝日新聞デジタルの連載|連載「)/.test(line)&&/https?:/.test(line)){related.push(...extractLinks(line.replace(/^※/,''),'reference'));continue;}
    const date=line.match(/この番組は\d{4}年[^。]*?に収録しました。?/g);
    if(date){recording.push(...date);line=line.replace(/この番組は\d{4}年[^。]*?に収録しました。?/g,'').trim();if(!line)continue;}
    if(/^(?:ご意見|フォーム|おたよりフォーム|ツイッター|メール|【ご意見・ご感想】|【ツイッター】)/.test(line)&&/(?:forms\.gle|twitter\.com|@asahi\.com|【ご意見・ご感想】|【ツイッター】)/i.test(line)){removed.push({reason:'CONTACT',text:line});continue;}
    if(/^See .*omnystudio\.com\/listener.*privacy information\.?$/i.test(line)){removed.push({reason:'COMMON_PRIVACY',text:line});continue;}
    if(/^(?:【番組内容】|【内容】)/.test(line)){section='body';line=line.replace(/^【[^】]+】/,'').trim();}
    else if(/^(?:【関連記事】|【関連リンク】|【写真まとめ】|【ドキュメンタリー動画】|【特集ページ】|【withnewsの記事一覧はこちら】)/.test(line)){section='related';line=line.replace(/^【[^】]+】/,'').trim();}
    else if(/^【出演[・／/]スタッフ】|^【出演者】|^【スタッフ】/.test(line)){section='staff';line=line.replace(/^【[^】]+】/,'').trim();}
    else if(/^(?:【お知らせ】|＜お知らせ＞|<お知らせ>|【イベント|【GOOD LIFE|PR[:：]|PRESENTED BY[:：]|【SPONSORED】)/i.test(line)){section='notice';removed.push({reason:'NOTICE_OR_PROMOTION',text:line});continue;}
    if(section==='notice'){removed.push({reason:'NOTICE_OR_PROMOTION',text:line});continue;}
    if(section==='related'){
      const pending=unclassified.at(-1);if(/^https?:/.test(line)&&pending?.section==='related'){line=pending.text+' '+line;unclassified.pop();}
      related.push(...extractLinks(line));if(!/https?:/.test(line)&&line)unclassified.push({section,text:line});continue;
    }
    if(section==='staff'){staff.push(line);continue;}
    // Only explicit contact URLs/addresses are removed inside otherwise useful content.
    line=line.replace(/(?:mailto:)?[A-Z0-9._%+-]+@asahi\.com/gi,'').replace(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms)[^\s）)]+/gi,'');
    if(/^Official Site\s*\|/i.test(line)||/^番組内で紹介されたエピソードはこちら/.test(line)){related.push(...extractLinks(line,'reference'));continue;}
    line=line.replace(/(?:この番組は|※)?毎週[月火水木金土日]曜日に配信します。?/g,m=>{removed.push({reason:'COMMON_SCHEDULE',text:m});return '';});
    line=line.replace(urlPattern,u=>publicationUrl(u)||'').trim();if(line&&!body.includes(line))body.push(line);
  }
  // Preserve ledger article URLs even if raw section markup is missing or unusual.
  for(const originalUrl of relatedUrls){const url=publicationUrl(originalUrl);if(url&&!related.some(r=>r.url===url))related.push({title:originalUrl,originalUrl,url,kind:'article',linkStatus:'NOT_CHECKED',checkedAt:null});}
  const unique=new Map();for(const r of related){if(/\/special\/podcasts\/?(?:\?|$)|forms\.gle|omnystudio\.com\/listener/.test(r.url))continue;const old=unique.get(r.url);if(!old||old.title===old.originalUrl)unique.set(r.url,r);}
  for(const r of unique.values()){const proof=linkEvidence[r.originalUrl]||linkEvidence[r.url];if(proof)Object.assign(r,{linkStatus:proof.status,checkedAt:proof.checkedAt,httpStatus:proof.httpStatus});}
  const description=body.join('\n\n');const holds=[];
  if(!description)holds.push('CONTENT_EMPTY');
  if(unclassified.length)holds.push('RELATED_TEXT_WITHOUT_URL_REVIEW');
  if(/@asahi\.com|forms\.gle|<\/?[a-z][^>]*>/i.test(description))holds.push('PUBLIC_RESIDUE');
  return {version:DESCRIPTION_VERSION,description,relatedArticles:[...unique.values()],staff,recording:[...new Set(recording)],removed,unclassified,holds};
}
