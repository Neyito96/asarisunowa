/**
 * Phase16 Hybrid V3 isolated READ_ONLY regression.
 * Corrects HTML anchor line handling, promotion sections, and multi-article pairs.
 */
var P16_HYBRID_V3=(function(){
 function parse(raw){
  let s=String(raw||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n')
   .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi,(_,u)=>'\n'+u+'\n')
   .replace(/<br\s*\/?>|<\/?p\b[^>]*>|<\/?div\b[^>]*>/gi,'\n')
   .replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&');
  let lines=s.split('\n').map(x=>x.trim()).filter(Boolean);
  let body=[],related=[],cast=[],holds=[],removed=[],section='body',pending='';
  const article=/^https?:\/\/(?:www\.|digital\.)?asahi\.com\/articles\/[A-Za-z0-9]+(?:\.html)?(?:\?\S*)?$|^https?:\/\/globe\.asahi\.com\/article\/\d+(?:\?\S*)?$/i;
  const link=/(https?:\/\/\S+)/;
  const sectionStart=/^【(?:関連記事|関連リンク|出演・スタッフ|出演者|スタッフ|おねがい|お知らせ|番組内容)】/;
  function flush(){if(pending){holds.push('RELATED_TITLE_WITHOUT_URL');pending='';}}
  for(let line of lines){
   if(/^【(?:関連記事|関連リンク)】/.test(line)){flush();section='related';continue;}
   if(/^【(?:出演・スタッフ|出演者|スタッフ)】/.test(line)){flush();section='cast';continue;}
   if(/^【(?:おねがい|お知らせ)】/.test(line)){flush();section='skip';continue;}
   if(/^【番組内容】/.test(line)){section='body';line=line.replace(/^【番組内容】/,'').trim();if(!line)continue;}
   if(/^(?:ご?意見・感想・リクエスト|ほかにも多彩な番組を配信中|See omnystudio|Learn more about)/i.test(line)){removed.push('footer');continue;}
   if(/(?:キャンペーン|ポッドキャストアワードに投票|番組継続にご協力|スタンダードコースを初めて|番組フォローにご協力)/.test(line)){removed.push('promotion');continue;}
   if(section==='skip')continue;
   if(section==='cast'){if(!/^https?:\/\//.test(line))cast.push(line);continue;}
   if(section==='related'){
    if(article.test(line)){if(pending){related.push({title:pending,url:line});pending='';}else holds.push('ARTICLE_TITLE_MISSING');continue;}
    if(/^https?:\/\//.test(line)){holds.push('UNEXPECTED_RELATED_URL');continue;}
    if(pending)holds.push('RELATED_TITLE_WITHOUT_URL');pending=line;continue;
   }
   const match=line.match(link);
   if(match){
    const u=match[1],before=line.slice(0,match.index).trim(),after=line.slice(match.index+u.length).trim();
    if(article.test(u)&&before&&!after){
     const pivot=before.search(/【そもそも解説】|（いちからわかる！）|【いちからわかる！】/);
     if(pivot>0)body.push(before.slice(0,pivot).trim());
     related.push({title:pivot>0?before.slice(pivot):before,url:u});
    }else holds.push('UNCLASSIFIED_BODY_URL');
    continue;
   }
   if(sectionStart.test(line)){holds.push('UNKNOWN_SECTION');continue;}
   body.push(line);
  }
  flush();if(!body.length)holds.push('EMPTY_BODY');
  return {body:body.join('\n'),related,cast,removed,holds:[...new Set(holds)]};
 }
 return {parse};
})();
function p16HybridV3RegressionReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const wanted=new Set(['EP-00571','EP-00631','EP-01069','EP-06642']);
 const rows=sh.getRange(2,1,sh.getLastRow()-1,23).getValues();
 const results=rows.filter(r=>wanted.has(String(r[0]))).map(r=>({id:r[0],existingW:!!r[22],...P16_HYBRID_V3.parse(r[21])}));
 console.log(JSON.stringify({mode:'READ_ONLY',results,writes:0},null,2));return results;
}
