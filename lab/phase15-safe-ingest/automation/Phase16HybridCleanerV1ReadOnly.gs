/** Phase16 Hybrid Cleaner v1: isolate from production P15; no writes. */
var P16_HYBRID=(function(){
 function normalize(v){return String(v||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/<br\s*\/?>/gi,'\n').replace(/<\/?p[^>]*>/gi,'\n').replace(/<[^>]+>/g,'').split('\n').map(s=>s.trim()).filter(Boolean);}
 function parse(raw){
  let body=[],articles=[],holds=[],removed=[];
  const urls=/(https?:\/\/(?:www\.|digital\.)?asahi\.com\/articles\/[A-Za-z0-9]+(?:\.html)?(?:\?[^\s<>]*)?|https?:\/\/globe\.asahi\.com\/article\/\d+(?:\?[^\s<>]*)?)/g;
  for(let line of normalize(raw)){
   if(/^(?:ご?意見・感想・リクエスト|ほかにも多彩な番組を配信中|See omnystudio|Learn more about)/i.test(line)){removed.push('footer');continue;}
   if(/(?:キャンペーン|ポッドキャストアワードに投票|番組継続にご協力|月99円|解約違約金)/.test(line)){removed.push('promotion');continue;}
   const matches=[...line.matchAll(urls)];
   if(matches.length===1){
    const m=matches[0],before=line.slice(0,m.index).trim(),after=line.slice(m.index+m[0].length).trim();
    if(after){holds.push('ARTICLE_TRAILING_TEXT');continue;}
    let title=before,prose='';
    const pivot=before.search(/【そもそも解説】|（いちからわかる！）|【いちからわかる！】/);
    if(pivot>0){prose=before.slice(0,pivot).trim();title=before.slice(pivot).trim();}
    if(!title){holds.push('ARTICLE_TITLE_MISSING');continue;}
    if(prose)body.push(prose);
    articles.push({title,url:m[0]});continue;
   }
   if(matches.length>1){holds.push('MULTIPLE_ARTICLES_ON_LINE');continue;}
   if(/https?:\/\//.test(line)){holds.push('UNKNOWN_URL');continue;}
   line=line.replace(/^【番組内容】/,'').trim();
   if(line)body.push(line);
  }
  if(!body.length)holds.push('EMPTY_BODY');
  // No related article is valid, not a hold.
  const text=body.join('\n')+(articles.length?'\n\n【関連記事】\n'+articles.map(a=>a.title+'\n'+a.url).join('\n'):'');
  return {text,body:body.join('\n'),articles,holds:[...new Set(holds)],removed};
 }
 return {parse};
})();
function p16HybridRegressionReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=['EP-00543','EP-00555','EP-00563','EP-00571','EP-00574','EP-00605','EP-00631','EP-00713','EP-00872','EP-01069','EP-06642'];
 const wanted=new Set(ids),data=sh.getRange(2,1,sh.getLastRow()-1,29).getValues();
 const found=data.filter(r=>wanted.has(String(r[0]))).map(r=>{
  const x=P16_HYBRID.parse(r[21]);
  return {id:r[0],show:r[1],existingW:!!r[22],articles:x.articles.length,holds:x.holds,removed:x.removed,preview:x.text.slice(0,350)};
 });
 console.log(JSON.stringify({mode:'READ_ONLY',count:found.length,found,writes:0},null,2));return found;
}
