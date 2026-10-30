/**
 * Phase16 unified cleaner V4 - READ ONLY. No writer, no trigger.
 * Section-specific processing: promotion/social/cast links never become article links.
 * Retains original V; requires paired Asahi article titles and URLs.
 */
var P16_UNIFIED_V4=(function(){
 const article=/^https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[^\s]*)?$/i;
 const url=/https?:\/\/[^\s<>]+/;
 function parse(raw){
  const normalized=String(raw||'').replace(/\\n/g,'\n').replace(/<br\s*\/?>|<\/?p\b[^>]*>|<\/?div\b[^>]*>/gi,'\n')
   .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi,(_,href)=>'\n'+href+'\n')
   .replace(/<[^>]+>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&');
  const lines=normalized.split('\n').map(x=>x.trim()).filter(Boolean);
  let section='body',pending='',body=[],related=[],holds=[],excluded=[];
  function closeRelated(){if(pending){holds.push('UNPAIRED_RELATED_TITLE');pending='';}}
  function excludedLine(s){return /^(?:※おたよりフォーム|親や子どもにまつわるモヤモヤをお寄せください|Spotify|Apple|Pocket Casts|Amazon music|ご意見・感想・リクエスト|ほかにも多彩な番組を配信中|See\b|Learn more about)/i.test(s)||/キャンペーン|スタンダードコースを初めて|番組フォローにご協力|月99円|ポッドキャストアワードに投票/.test(s);}
  for(let line of lines){
   if(/^【関連記事】/.test(line)){closeRelated();section='related';continue;}
   if(/^【番組内容】/.test(line)){closeRelated();section='body';line=line.replace(/^【番組内容】/,'').trim();if(!line)continue;}
   if(/^【出演・スタッフ】|^【出演者】|^【スタッフ】|^【おねがい】|^【朝ポキ情報】|^【お知らせ】/.test(line)){closeRelated();section='skip';continue;}
   if(/^【秋トクキャンペーン/.test(line)){section='promo';excluded.push('promotion');continue;}
   if(section==='promo')continue; // resets on 【番組内容】
   if(section==='skip')continue;
   if(excludedLine(line)){excluded.push('notice');continue;}
   if(section==='related'){
    const m=line.match(url);
    if(m){
     if(article.test(m[0])&&pending&&line===m[0]){related.push({title:pending,url:m[0]});pending='';}
     else holds.push('UNPAIRED_RELATED_URL');
    } else {if(pending)holds.push('UNPAIRED_RELATED_TITLE');pending=line;}
    continue;
   }
   const m=line.match(url);
   if(m){
    if(article.test(m[0])&&m.index>0&&line.slice(m.index+m[0].length).trim()===''){
     let prefix=line.slice(0,m.index).trim(),p=prefix.search(/【そもそも解説】|（いちからわかる！）|【いちからわかる！】/);
     if(p>0){body.push(prefix.slice(0,p).trim());prefix=prefix.slice(p);}
     related.push({title:prefix,url:m[0]});
    } else if(/^(?:https?:\/\/(?:buff\.ly|bit\.ly|t\.asahi\.com|digital\.asahi\.com\/pr|www\.youtube\.com|omnystudio\.com))/.test(line))excluded.push('external_link');
    else holds.push('UNCLASSIFIED_BODY_URL');
    continue;
   }
   if(/^【/.test(line))holds.push('UNKNOWN_SECTION');
   else body.push(line);
  }
  closeRelated();
  if(!body.length)holds.push('EMPTY_BODY');
  const unique=[...new Set(holds)];
  const w=unique.length?null:body.join('\n')+(related.length?'\n【関連記事】\n'+related.map(a=>a.title+a.url).join('\n'):'');
  return {body:body.join('\n'),related,holds:unique,w,excludedCount:excluded.length};
 }
 return {parse};
})();
function p16UnifiedV4RegressionReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=['EP-00543','EP-00571','EP-00574','EP-00631','EP-00872','EP-01069','EP-06642'];
 const results=ids.map(id=>{
  const n=Number(id.slice(3))+1, r=sh.getRange(n,1,1,29).getValues()[0];
  if(r[0]!==id)throw Error('EP_ID_MISMATCH_'+id);
  const out=P16_UNIFIED_V4.parse(r[21]);
  return {id,show:r[1],existingW:!!r[22],hold:out.holds,related:out.related.length,body:out.body,w:out.w,existingMatches:!!r[22]&&r[22]===out.w};
 });
 console.log(JSON.stringify({mode:'READ_ONLY_V4_REGRESSION',results,writes:0},null,2));
 return results;
}
function p16UnifiedV4BlankSampleReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const rows=sh.getRange(2,1,Math.min(sh.getLastRow()-1,1500),40).getValues();
 const results=[];
 for(const r of rows){
  if(!r[21]||r[22]||!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))continue;
  const p=P16_UNIFIED_V4.parse(r[21]);
  results.push({id:r[0],show:r[1],holds:p.holds,related:p.related.length,wLength:p.w?p.w.length:0});
  if(results.length>=60)break;
 }
 console.log(JSON.stringify({mode:'READ_ONLY_V4_SAMPLE',results,writes:0},null,2));
 return results;
}