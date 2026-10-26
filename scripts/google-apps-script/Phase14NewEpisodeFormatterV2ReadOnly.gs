/**
 * 新着収蔵ロボ｜追加書式の処理 v0.2 (read-only evaluation).
 * Complements v0.1; DOES NOT overwrite P14NewEpisodeFormatter.
 * Do not use these preview outputs as direct write instructions.
 */
var P14NewEpisodeFormatterV2=(function(){
 function p(s){
  return String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div)>/gi,'\n\n')
   .replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&hellip;|&#8230;/gi,'…')
   .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
   .replace(/&#39;/gi,"'").replace(/\u202f/g,' ').replace(/\r/g,'');
 }
 function clean(raw){
  let s=p(raw).trim();
  const heading='【番組内容】';
  if(s.includes(heading)){
   s=s.slice(s.indexOf(heading)+heading.length);
  } else {
   const first=s.split(/\n\s*\n/).map(x=>x.trim()).find(x=>x.length>60&&!/PODCAST MEETING|キャンペーン|会員登録/.test(x));
   if(!first)return {status:'NEEDS_REVIEW',text:''};
   if(s.indexOf(first)>100&&!/PODCAST MEETING|キャンペーン/.test(s.slice(0,s.indexOf(first))))
    return {status:'NEEDS_REVIEW',text:''};
   s=s.slice(s.indexOf(first));
  }
  const end=/【関連記事】|【出演・スタッフ】|【朝ポキ情報】|【おねがい】|【まとめてわかる】|(?:\n\s*\n)(?:★|※ドーナツのdiscord|ご意見・感想|「報談」の過去回|ほかにも多彩な番組|Learn more about your ad choices|※「報談」専用のdiscord|★菜緒都さんの作品)/i;
  s=s.split(end)[0].trim();
  // When no 【番組内容】 heading, keep a nearby recording-date paragraph, but no other promotional content.
  if(!raw.includes(heading)){
   const tail=p(raw).slice(p(raw).indexOf(s)+s.length);
   const date=(tail.match(/^\s*(※20\d\d年\d{1,2}月\d{1,2}日に収録しました。?)/)||[])[1];
   if(date)s+='\n\n'+date;
  }
  s=s.replace(/\n{3,}/g,'\n\n').trim();
  if(s.length<60||/PODCAST MEETING|スタンダードコース|Learn more about your ad choices|discord\.gg/i.test(s))
   return {status:'NEEDS_REVIEW',text:''};
  return {status:'CLEAN_CONFIDENT',text:s};
 }
 function cast(raw){
  const txt=p(raw),start=txt.indexOf('【出演・スタッフ】');
  if(start<0)return {status:'NO_EXPLICIT_SECTION',names:[]};
  let s=txt.slice(start+'【出演・スタッフ】'.length).split(/【朝ポキ情報】|【おねがい】|【関連記事】|\n\s*\n(?:★|※)/)[0];
  const people=[];
  // For space-delimited Megaphone entries, first break at profile URLs into entry boundaries.
  s=s.replace(/https?:\/\/\S+/g,'\n').replace(/(MC[、・]\s*音源編集|MC)[ 　]+/g,'\n$1　');
  for(const line of s.split('\n').map(x=>x.trim()).filter(Boolean)){
   const name=line.replace(/^(?:MC(?:[、・]\s*音源編集)?|音源編集|編集|進行|ゲスト)[：: 　]*/,'')
     .replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'').trim();
   const candidate=name.replace(/さん$/,'');
   if(!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}・ 　]{2,30}$/u.test(candidate))
     return {status:'NEEDS_REVIEW',names:[]};
   if(!people.includes(candidate))people.push(candidate);
   if(people.length>5)return {status:'NEEDS_REVIEW',names:[]};
  }
  return people.length?{status:'CAST_CONFIDENT',names:people}:{status:'NEEDS_REVIEW',names:[]};
 }
 return {clean,cast};
})();
function phase14NewEpisodeV2CopyFiveReadOnly(){
 if(ScriptApp.getScriptId()!=='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV')throw Error('WRONG_SCRIPT');
 const sh=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY').getSheetByName('エピソード台帳');
 const rows=sh.getRange(6628,1,5,22).getDisplayValues();
 const expected=['EP-06627','EP-06628','EP-06629','EP-06630','EP-06631'];
 const out=rows.map((r,i)=>{
  if(r[0]!==expected[i])throw Error('IDENTITY_MISMATCH');
  const cleaned=P14NewEpisodeFormatterV2.clean(r[21]),cast=P14NewEpisodeFormatterV2.cast(r[21]);
  const report={id:r[0],overview:cleaned.status,preview:cleaned.text,cast:cast.status,names:cast.names};
  console.log(JSON.stringify({mode:'NEW_FIVE_V2_READ_ONLY',...report,writes:0}));
  return report;
 });
 const summary={mode:'NEW_FIVE_V2_SUMMARY',inspected:out.length,overviewClean:out.filter(x=>x.overview==='CLEAN_CONFIDENT').length,castClean:out.filter(x=>x.cast==='CAST_CONFIDENT').length,writes:0,triggerChanges:0};
 console.log(JSON.stringify(summary));return summary;
}
