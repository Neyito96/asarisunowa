/**
 * Phase16 precision URL parser V5: three held news-school cases.
 * READ_ONLY: inspect V; never write sheets/triggers.
 * Handle trailing &nbsp; and two adjacent headline+URL pairs.
 */
var P16_NEWS_V5=(function(){
 const u=/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g;
 function parse(raw){
  const s=String(raw||'').replace(/\\n/g,'\n').replace(/&nbsp;|&#160;/gi,' ');
  const lines=s.split('\n').map(x=>x.trim()).filter(Boolean);
  const body=[],articles=[],holds=[];
  for(const line of lines){
   if(/^(ご意見・感想・リクエスト|See omnystudio|Learn more about)/i.test(line))continue;
   const matches=[...line.matchAll(u)];
   if(!matches.length){if(/https?:\/\//.test(line))holds.push('UNKNOWN_BODY_URL');else body.push(line);continue;}
   let start=0;
   for(let i=0;i<matches.length;i++){
    const m=matches[i],fragment=line.slice(start,m.index).trim();
    if(!fragment){holds.push('TITLE_MISSING');break;}
    let title=fragment;
    if(i===0 && body.length===0){holds.push('NO_BODY_BEFORE_ARTICLE');}
    articles.push({title,url:m[0]});
    start=m.index+m[0].length;
   }
   if(line.slice(start).trim())holds.push('TRAILING_TEXT');
  }
  if(!body.length)holds.push('EMPTY_BODY');
  const unique=[...new Set(holds)];
  return {body:body.join('\n'),articles,holds:unique,w:unique.length?null:body.join('\n')+(articles.length?'\n【関連記事】\n'+articles.map(a=>a.title+a.url).join('\n'):'')};
 }
 return {parse};
})();
function p16HeldThreeV5Preview(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=['EP-00747','EP-00763','EP-00764'];
 const result=ids.map(id=>{
  const n=Number(id.slice(3))+1,r=sh.getRange(n,1,1,29).getValues()[0];
  if(String(r[0])!==id)throw Error('ROW_ID_MISMATCH_'+id);
  return {id,existingW:!!r[22],...P16_NEWS_V5.parse(r[21])};
 });
 console.log(JSON.stringify({mode:'READ_ONLY_HELD3_V5',results:result,writes:0},null,2));return result;
}