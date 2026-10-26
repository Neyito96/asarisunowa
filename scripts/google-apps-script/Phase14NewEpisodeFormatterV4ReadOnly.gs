/** Phase14 V4 - read-only five-episode regression; no sheet writes. */
var P14NewEpisodeFormatterV4=(function(){
 function clean(raw){
  if(typeof P14NewEpisodeFormatterV3==='undefined')throw Error('V3_MISSING');
  const v3=P14NewEpisodeFormatterV3.clean(raw);
  if(v3.status!=='CLEAN_CONFIDENT')return v3;
  let text=v3.text.replace(/\n[ \t]+※/g,'\n※');
  const original=String(raw||'').replace(/&nbsp;|&#160;/gi,' ');
  const found=original.match(/※20\d{2}年\d{1,2}月\d{1,2}日に収録しました。?/);
  if(found&&!text.includes(found[0]))text+='\n\n'+found[0];
  // Guard against ingesting trailing CTA text.
  if(/PODCAST MEETING|スタンダードコース|discord|会員登録|ad choices/i.test(text))
    return {status:'NEEDS_REVIEW',text:''};
  return {status:'CLEAN_CONFIDENT',text};
 }
 function cast(raw){return P14NewEpisodeFormatterV3.cast(raw);}
 return {clean,cast};
})();
function phase14NewEpisodeV4FiveRegressionReadOnly(){
 if(ScriptApp.getScriptId()!=='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV')throw Error('WRONG_SCRIPT');
 const sh=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY').getSheetByName('エピソード台帳');
 const rows=sh.getRange(6628,1,5,22).getDisplayValues();
 const expected=[
  {id:'EP-06627',names:['中島晋也','奥山晶二郎','神田大介'],date:'※2026年10月5日に収録しました'},
  {id:'EP-06628',names:[],date:null},
  {id:'EP-06629',names:['冨名腰隆','杢田光'],date:'※2026年10月9日に収録しました'},
  {id:'EP-06630',names:['大木理恵子','望月愛実','宮沢賢一'],date:'※2026年10月8日に収録しました'},
  {id:'EP-06631',names:['菜緒都さん','神田大介'],date:'※2026年10月20日に収録しました'}
 ];
 const output=rows.map((r,i)=>{
  const e=expected[i];if(r[0]!==e.id)throw Error('IDENTITY_CHANGED_'+i);
  const o=P14NewEpisodeFormatterV4.clean(r[21]),c=P14NewEpisodeFormatterV4.cast(r[21]);
  const pass=o.status==='CLEAN_CONFIDENT'&&
    (e.date===null||o.text.includes(e.date))&&
    c.names.length===e.names.length&&e.names.every((name,j)=>c.names[j]===name)&&
    !/PODCAST MEETING|スタンダードコース|discord|ad choices|会員登録/i.test(o.text);
  const res={id:e.id,pass,overview:o.status,cast:c.status,names:c.names,description:o.text,writes:0};
  console.log(JSON.stringify({mode:'NEW_FIVE_V4_CASE',...res}));return res;
 });
 const summary={mode:'NEW_FIVE_V4_REGRESSION',cases:output.length,passed:output.filter(x=>x.pass).length,failed:output.filter(x=>!x.pass).map(x=>x.id),writes:0,triggerChanges:0,status:output.every(x=>x.pass)?'PASS':'REVIEW_REQUIRED'};
 console.log(JSON.stringify(summary));return summary;
}
