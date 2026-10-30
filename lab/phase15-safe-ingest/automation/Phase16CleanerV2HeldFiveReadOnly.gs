/**
 * Phase16 cross-show cleaning v2: read-only regression for five held News School rows.
 * Do not modify the production P15 parser. Test source preserved in column V.
 */
function p16TestCleanerV2HeldFive() {
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=new Set(['EP-00571','EP-00574','EP-00605','EP-00631','EP-00713']);
 const rows=sh.getRange(2,1,sh.getLastRow()-1,29).getValues().filter(r=>ids.has(String(r[0])));
 function clean(raw) {
  let lines=String(raw||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n')
   .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').split('\n').map(x=>x.trim()).filter(Boolean);
  let body=[],articles=[],removed=[],holds=[];
  const urlRegex=/(https?:\/\/(?:www\.|digital\.)?asahi\.com\/articles\/[A-Za-z0-9]+(?:\.html)?(?:\?[^\s<>]*)?|https?:\/\/globe\.asahi\.com\/article\/[0-9]+(?:\?[^\s<>]*)?)/g;
  for(let line of lines) {
   if(/^(?:ご?意見・感想・リクエスト|ほかにも多彩な番組を配信中|See omnystudio|Learn more about)/i.test(line)) {removed.push('footer');continue;}
   if(/(?:キャンペーン|ポッドキャストアワードに投票|番組継続にご協力|月99円|解約違約金)/.test(line)){removed.push('promotion');continue;}
   const matches=[...line.matchAll(urlRegex)];
   if(matches.length===1){
    const m=matches[0],before=line.slice(0,m.index).trim(),after=line.slice(m.index+m[0].length).trim();
    // Concatenated same-line text requires a recognisable article heading boundary.
    let title=before,prose='';
    const pivot=before.search(/【そもそも解説】|（いちからわかる！）|【いちからわかる！】/);
    if(pivot>0){prose=before.slice(0,pivot).trim();title=before.slice(pivot).trim();}
    if(after||!title){holds.push('UNPAIRED_OR_TRAILING_TEXT');continue;}
    if(prose)body.push(prose);
    articles.push({title,url:m[0]});continue;
   }
   if(matches.length>1){holds.push('MULTIPLE_URLS');continue;}
   if(/https?:\/\//.test(line)){holds.push('UNKNOWN_URL');continue;}
   if(/^(?:【番組内容】)/.test(line))line=line.replace(/^【番組内容】/,'').trim();
   body.push(line);
  }
  if(!body.length)holds.push('EMPTY_BODY');
  if(articles.length!==1)holds.push('ARTICLE_COUNT_'+articles.length);
  return {body:body.join('\n'),articles,removed,holds:[...new Set(holds)]};
 }
 const results=rows.map(r=>({id:r[0],title:r[2],existingW:!!r[22],...clean(r[21])}));
 console.log(JSON.stringify({mode:'READ_ONLY',count:results.length,results,writes:0},null,2));return results;
}
