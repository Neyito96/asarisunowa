/** Phase16 Hybrid V2: conservative multi-section parser; READ_ONLY only. */
var P16_HYBRID_V2=(function(){
 function parse(raw){
  let t=String(raw||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n')
   .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(_,u,label)=>label.replace(/<[^>]*>/g,'')+'\n'+u)
   .replace(/<br\s*\/?>|<\/p>|<p[^>]*>/gi,'\n').replace(/<[^>]+>/g,'')
   .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&');
  const lines=t.split('\n').map(x=>x.trim()).filter(Boolean);
  const body=[],articles=[],cast=[],removed=[],holds=[];let section='body',pending='';
  const art=/^https?:\/\/(?:www\.|digital\.)?asahi\.com\/articles\/[A-Za-z0-9]+(?:\.html)?(?:\?\S*)?$|^https?:\/\/globe\.asahi\.com\/article\/\d+(?:\?\S*)?$/i;
  const url=/https?:\/\/\S+/g;
  function flush(){if(pending){holds.push('RELATED_TITLE_WITHOUT_URL');pending='';}}
  for(let line of lines){
   if(/^【関連記事】|^【関連リンク】/.test(line)){flush();section='related';continue;}
   if(/^【出演(?:・スタッフ|者)?】|^【スタッフ】/.test(line)){flush();section='cast';continue;}
   if(/^【おねがい】|^【お知らせ】/.test(line)){flush();section='skip';continue;}
   if(/^【番組内容】/.test(line)){section='body';line=line.replace(/^【番組内容】/,'').trim();if(!line)continue;}
   if(/^(?:ご?意見・感想・リクエスト|ほかにも多彩な番組を配信中|See omnystudio|Learn more about)/i.test(line)){removed.push('footer');continue;}
   if(/キャンペーン|ポッドキャストアワードに投票|番組継続にご協力/.test(line)){removed.push('promotion');continue;}
   if(section==='skip')continue;
   if(section==='cast'){if(!/^https?:\/\//.test(line))cast.push(line);continue;}
   if(section==='related'){
    if(art.test(line)){if(pending){articles.push({title:pending,url:line});pending='';}else holds.push('ARTICLE_TITLE_MISSING');continue;}
    if(/^https?:\/\//.test(line)){holds.push('UNKNOWN_RELATED_URL');continue;}
    if(pending)holds.push('RELATED_TITLE_WITHOUT_URL');pending=line;continue;
   }
   if(art.test(line)){holds.push('ARTICLE_IN_BODY_WITHOUT_TITLE');continue;}
   const matches=[...line.matchAll(url)];
   if(matches.length===1&&art.test(matches[0][0])){
    const m=matches[0],before=line.slice(0,m.index).trim(),after=line.slice(m.index+m[0].length).trim();
    let pivot=before.search(/【そもそも解説】|（いちからわかる！）|【いちからわかる！】/),title=pivot>0?before.slice(pivot):before;
    if(pivot>0)body.push(before.slice(0,pivot));
    if(!after&&title)articles.push({title,url:m[0]});else holds.push('ARTICLE_INLINE_AMBIGUOUS');
   }else if(matches.length)holds.push('UNKNOWN_BODY_URL');
   else body.push(line);
  }
  flush();if(!body.length)holds.push('EMPTY_BODY');
  return {body:body.join('\n'),articles,cast,removed,holds:[...new Set(holds)]};
 }
 return {parse};
})();
function p16TestHybridV2ReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const targets=['EP-01069','EP-06642','EP-00571','EP-00631'];
 const wanted=new Set(targets);
 const rows=sh.getRange(2,1,sh.getLastRow()-1,29).getValues().filter(r=>wanted.has(String(r[0])));
 const result=rows.map(r=>({id:r[0],title:r[2],existingW:!!r[22],...P16_HYBRID_V2.parse(r[21])}));
 console.log(JSON.stringify({mode:'READ_ONLY',results:result,writes:0},null,2));return result;
}
