/** 1007-derived source-aware content interpretation. PURE: no I/O or mutation.
 * 1007 O is historical edited copy, NEVER canonical RSS V original.
 */
const str=x=>String(x==null?'':x);
function legacy1007Normalize(raw){
 return str(raw).replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n').replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
}
function legacy1007ArticleLinks(raw){
 const src=legacy1007Normalize(raw),out=[],seen=new Set();
 const add=(url,title,source)=>{
  const u=str(url).trim().replace(/[）)\]。、,，；;]+$/g,'');
  if(!/^https?:\/\/[^\s<>()]+$/i.test(u)||seen.has(u))return;
  seen.add(u);out.push({url:u,titleCandidate:str(title).trim()||null,titleVerified:false,
   source,status:'REVIEW',relatedType:source==='explicit_related_section'?'ARTICLE_CANDIDATE':'LINK_CANDIDATE'});
 };
 // The historical O format often places several article-title(URL) pairs after 【関連記事】.
 const sections=[...src.matchAll(/【関連記事】([\s\S]*?)(?=\n\s*【[^】]+】|\n\s*朝日新聞ポッドキャスト|$)/g)];
 for(const section of sections){
  for(const piece of section[1].split(/\s*▽\s*|\n(?=\S)/).filter(Boolean)){
   for(const m of piece.matchAll(/(https?:\/\/[^\s（）()<>]+)/g)){
    const title=piece.slice(0,m.index).replace(/[（(\s]+$/g,'').trim();
    add(m[1],title,'explicit_related_section');
   }
  }
 }
 for(const m of src.matchAll(/([^\n]{1,180})\s*[（(]\s*(https?:\/\/[^\s（）()<>]+)\s*[）)]/g)){
  const label=m[1].trim();
  if(/【関連記事】/.test(label)||/https?:\/\//.test(label)||/^(?:朝日新聞ポッドキャスト|おたよりフォーム|メルマガ|Discord)/.test(label))continue;
  add(m[2],label,'parenthetical_link');
 }
 const lines=src.split('\n');
 for(let i=1;i<lines.length;i++){
  const url=lines[i].trim().match(/^(https?:\/\/\S+)$/);
  if(!url)continue;
  const title=lines[i-1].trim();
  if(title&&title.length<=180&&!/^(?:関連記事|お知らせ|リンク集|おたよりフォーム)$/.test(title))
   add(url[1],title,'preceding_line');
 }
 return out;
}
const EXACT_NOTICES=[
 /^Learn more about your ad choices\. Visit (?:https?:\/\/)?megaphone\.fm\/adchoices\.?$/i,
 /^See (?:https?:\/\/)?omnystudio\.com\/listener for privacy information\.$/i,
 /^ご意見・感想・リクエスト https:\/\/bit\.ly\/asapoki_discord$/,
 /^おたよりフォーム https:\/\/bit\.ly\/asapoki_otayori$/,
 /^メルマガ https:\/\/bit\.ly\/asapoki_newsletter$/
];
const SHORT_PROMO=/朝日新聞ポッドキャスト（\s*https?:\/\/www\.asahi\.com\/special\/podcasts\/?(?:\?iref=omny)?\s*）では他にも様々な番組を配信(?:しています|、テキストでも読めます|しているほか、関連記事も読んでいただけます)[。.]?/g;
function legacy1007Clean(raw){
 const original=str(raw), removed=[],reviews=[], kept=[];
 const normalized=legacy1007Normalize(original).replace(SHORT_PROMO,m=>{removed.push({reason:'EXACT_SHARED_PROMO',text:m});return '';});
 for(const [lineIndex,line] of normalized.split('\n').entries()){
  const t=line.trim();
  if(EXACT_NOTICES.some(re=>re.test(t))){removed.push({line:lineIndex,reason:'EXACT_SHARED_NOTICE',text:line});continue;}
  // Never delete an episode-specific event, interview, article or recorded date by guess.
  if(/イベント|募集|キャンペーン|申し込み|申込|【お願い】|【朝ポキ情報】|podcaster@|@asahi\.com|おたよりフォーム/i.test(t))
   reviews.push({line:lineIndex,reason:'NOTICE_OR_CONTACT_REVIEW',text:line});
  kept.push(line);
 }
 return {original,cleaned:kept.join('\n').replace(/\n{3,}/g,'\n\n').trim(),
  articleCandidates:legacy1007ArticleLinks(original),removed,reviews,ruleVersion:'1007-legacy-crosswalk-1',writes:0};
}
function legacy1007Crosswalk({legacyO='',legacyK='',rssRaw='',sourceKind='',sourceUrl='',existingV='',existingW='',identityConfirmed=false}={}){
 if(!identityConfirmed||!/^https:\/\//.test(str(sourceUrl)))return {status:'HOLD_IDENTITY',writes:0};
 const historical=str(legacyO),raw=str(rssRaw),v=str(existingV),w=str(existingW);
 const rssCanonical=sourceKind==='OFFICIAL_RSS'&&!!raw, chosen=rssCanonical?raw:historical;
 const cleaned=legacy1007Clean(chosen);
 return {status:rssCanonical?'READ_ONLY_RSS_CANDIDATES':'REVIEW_FALLBACK_ONLY',
  legacy:{O:historical,K:str(legacyK),role:'HISTORICAL_CLEANED_COPY',provenance:'UNCHANGED_UNVERIFIED'},
  rawVProposal:rssCanonical&&!v?raw:null,
  cleanWProposal:rssCanonical&&(!v||v===raw)&&!w?cleaned.cleaned:null,
  legacyWReview:historical&&!w?historical:null,
  rawVersionConflict:!!(rssCanonical&&v&&v!==raw),
  related:cleaned.articleCandidates,removed:cleaned.removed,reviews:cleaned.reviews,
  provenance:{sourceKind,sourceUrl,ranking:'OFFICIAL_RSS > ASAHI_OFFICIAL > OMNY > APPLE_SPOTIFY > AMAZON_REVIEW'},
  writes:0};
}
export {legacy1007Normalize,legacy1007ArticleLinks,legacy1007Clean,legacy1007Crosswalk};
