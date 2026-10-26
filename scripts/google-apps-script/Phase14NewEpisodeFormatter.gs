/**
 * 朝ポキ｜新着収蔵ロボ：RSS由来の概要・出演者共通整形 v0.1
 * Pure transformation. No SpreadsheetApp writes, no ID allocation or triggers.
 * Reuse on new-episode ingestion; audit results before connecting writer.
 */
var P14NewEpisodeFormatter=(function(){
 function plain(s) {return String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").split('\n').map(x=>x.trim()).filter(Boolean).join('\n');}
 function region(html,start,end) {const a=String(html||'');let b=a.indexOf(start);if(b<0)return null;b+=start.length;let e=end?a.indexOf(end,b):-1;if(e<0)e=a.length;return a.slice(b,e);}
 function cleanDescription(raw) {
   if(!raw||!String(raw).trim())return {status:'NO_SOURCE',text:'',method:'none'};
   // Explicit official 【番組内容】 section: do not import preceding ads.
   let section=region(raw,'【番組内容】','【関連記事】');
   if(section===null)section=region(raw,'【番組内容】','【出演・スタッフ】');
   if(section!==null) {
     section=section.split(/【(?:出演・スタッフ|おねがい|朝ポキ情報|番組情報|関連記事)】/)[0];
     const text=plain(section).replace(/\n{3,}/g,'\n\n');
     if(text.length>=35&&!/PODCAST MEETING|スタンダードコース|会員登録をお願いします/.test(text))
       return {status:'CLEAN_CONFIDENT',text:text.replace(/\n/g,'\n\n'),method:'explicit_program_section'};
   }
   // Avoid guessing where the episode content ends. Preserve V and flag for review.
   return {status:'NEEDS_REVIEW',text:'',method:'section_not_unambiguous'};
 }
 function cast(raw){
   let section=region(raw,'【出演・スタッフ】','【おねがい】');
   if(section===null)section=region(raw,'【出演・スタッフ】','【朝ポキ情報】');
   if(section===null)return {status:'NO_EXPLICIT_SECTION',full:'',people:[],evidence:''};
   section=section.split(/【(?:朝ポキ情報|関連記事|番組情報|おねがい)】/)[0];
   const stop=/^(?:★|※|お便り|番組フォロー|朝日新聞アプリ|スタンダードコース|PODCAST MEETING|https?:\/\/)/i;
   const lines=plain(section).split('\n').filter(x=>x.trim());
   const full=[],people=[];
   for(const line of lines){
     if(stop.test(line)||/PODCAST MEETING|会員登録|キャンペーン|ご購読|購読料で配信/i.test(line))break;
     // A single cast entry may include a biography link, parentheses, or role.
     const s=line.replace(/https?:\/\/\S+/g,'').trim();
     let candidate=s.replace(/^(?:MC(?:・音源編集)?|音源編集|編集|出演|ゲスト|聞き手|進行)[：:\s　]*/,'').trim();
     candidate=candidate.replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'').trim();
     if(!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}・\s　]{2,30}$/u.test(candidate))
       return {status:'NEEDS_REVIEW',full:full.join('\n'),people:[],evidence:''};
     if(!people.includes(candidate))people.push(candidate);
     full.push(line);
     if(people.length>5)return {status:'MORE_THAN_FIVE',full:full.join('\n'),people:[],evidence:''};
   }
   if(!people.length)return {status:'NEEDS_REVIEW',full:'',people:[],evidence:''};
   return {status:'CAST_CONFIDENT',full:full.join('\n'),people,
     evidence:'公式RSS概要原文【出演・スタッフ】欄から抽出。V原文照合'};
 }
 function format(raw){
   const overview=cleanDescription(raw),people=cast(raw);
   return {rawDescription:String(raw||''),overview,cast:people,
     fields:{V:String(raw||''),W:overview.status==='CLEAN_CONFIDENT'?overview.text:'',
       X:people.status==='CAST_CONFIDENT'?people.full:'',
       AT:people.people[0]||'',AU:people.people[1]||'',AV:people.people[2]||'',
       AW:people.people[3]||'',AX:people.people[4]||'',
       AY:people.status==='CAST_CONFIDENT'?people.evidence:''},
     readyForAutoWrite:overview.status==='CLEAN_CONFIDENT'&&
       (people.status==='CAST_CONFIDENT'||people.status==='NO_EXPLICIT_SECTION')};
 }
 return {format,cleanDescription,cast};
})();
function phase14NewEpisodeFormatterDryRunEP06625(){
 const scriptId='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV';
 if(ScriptApp.getScriptId()!==scriptId)throw Error('WRONG_SCRIPT');
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const r=sh.getRange(6626,1,1,55).getDisplayValues()[0];
 if(r[0]!=='EP-06625'||r[6]!=='aca6c2d2-6291-4bd5-801a-b4eb00651c0d')throw Error('IDENTITY_CHANGED');
 const result=P14NewEpisodeFormatter.format(r[21]);
 const expected=['岡純太郎','岸上渉','山根久美子'];
 const ok=result.overview.status==='CLEAN_CONFIDENT'&&result.overview.text.includes('大阪・関西万博の閉幕から1年')&&
 result.overview.text.includes('※2026年10月21日に収録しました。')&&
 !result.overview.text.includes('PODCAST MEETING')&&
 expected.every((v,i)=>result.cast.people[i]===v);
 console.log(JSON.stringify({mode:'NEW_EPISODE_FORMATTER_DRY_RUN',id:r[0],
  overviewStatus:result.overview.status,castStatus:result.cast.status,
  names:result.cast.people,cleaned:result.fields.W,passed:ok,writes:0,triggers:0}));
 if(!ok)throw Error('REGRESSION_FAILED');
 return {passed:ok,writes:0};
}
