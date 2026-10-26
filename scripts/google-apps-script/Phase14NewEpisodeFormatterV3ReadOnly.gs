/**
 * Phase14 new episode formatter v3: conservative corrections for recent 5.
 * READ ONLY test; no ID allocation, no sheet writes, no triggers.
 */
var P14NewEpisodeFormatterV3=(function(){
 function plain(s){return String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div)>/gi,'\n\n')
 .replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&hellip;|&#8230;/gi,'…')
 .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
 .replace(/&#39;/gi,"'").replace(/\r/g,'').trim();}
 function clean(raw){
  const s=plain(raw);if(!s)return {status:'NO_SOURCE',text:''};
  const heading='【番組内容】';let content;
  if(s.includes(heading)){
   content=s.slice(s.indexOf(heading)+heading.length).split(/【関連記事】|【出演・スタッフ】|【朝ポキ情報】|【おねがい】/)[0].trim();
  }else{
   // Preserve only the actual first substantive paragraph. Never infer other paragraph purposes.
   const paras=s.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
   if(!paras.length||paras[0].length<60||/キャンペーン|PODCAST MEETING|会員登録/.test(paras[0]))
      return {status:'NEEDS_REVIEW',text:''};
   content=paras[0];
   // Search only immediately following paragraphs, skipping clearly labeled optional media links.
   for(let i=1;i<Math.min(paras.length,5);i++){
    const x=paras[i];
    if(/^※20\d{2}年\d{1,2}月\d{1,2}日に収録しました。?/.test(x)){
      content+='\n\n'+x.match(/^※20\d{2}年\d{1,2}月\d{1,2}日に収録しました。?/)[0];break;
    }
    if(/【出演・スタッフ】|【朝ポキ情報】|discord|過去回|★|キャンペーン|ご意見・感想|まとめてわかる/i.test(x))break;
    if(/^※/.test(x))break;
   }
  }
  content=content.replace(/\n{3,}/g,'\n\n').trim();
  if(content.length<60||/PODCAST MEETING|スタンダードコース|discord|ad choices|会員登録|https?:\/\//i.test(content))
    return {status:'NEEDS_REVIEW',text:''};
  return {status:'CLEAN_CONFIDENT',text:content};
 }
 function cast(raw) {
  if(typeof P14NewEpisodeFormatterV2==='undefined')throw Error('V2_MISSING');
  const r=P14NewEpisodeFormatterV2.cast(raw);
  // Honorific is retained only if source name actually includes it and uncertain to strip.
  if(r.status==='CAST_CONFIDENT'&&/菜緒都さん（漫画家）/.test(raw))
    r.names=r.names.map(x=>x==='菜緒都'?'菜緒都さん':x);
  return r;
 }
 return {clean,cast};
})();
function phase14NewEpisodeV3CopyFiveReadOnly(){
 if(ScriptApp.getScriptId()!=='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV')throw Error('WRONG_SCRIPT');
 const sh=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY').getSheetByName('エピソード台帳');
 const rows=sh.getRange(6628,1,5,22).getDisplayValues();
 const expected=['EP-06627','EP-06628','EP-06629','EP-06630','EP-06631'];
 const out=rows.map((r,i)=>{
   if(r[0]!==expected[i])throw Error('EP_ID_CHANGED');
   const c=P14NewEpisodeFormatterV3.clean(r[21]),a=P14NewEpisodeFormatterV3.cast(r[21]);
   const result={id:r[0],overview:c.status,cleaned:c.text,cast:a.status,names:a.names,writes:0};
   console.log(JSON.stringify({mode:'NEW_FIVE_V3_ROW',...result}));return result;
 });
 const summary={mode:'NEW_FIVE_V3_SUMMARY',inspected:out.length,
  overviewClean:out.filter(x=>x.overview==='CLEAN_CONFIDENT').length,
  castClean:out.filter(x=>x.cast==='CAST_CONFIDENT').length,
  castMissingExplicit:out.filter(x=>x.cast==='NO_EXPLICIT_SECTION').length,
  writes:0,triggerChanges:0};
 console.log(JSON.stringify(summary));return summary;
}
