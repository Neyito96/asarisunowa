/** Phase16 reviewed multi-article W-only backfill: EP-01069, EP-06642.
 * No edits to original V / AC. Explicit gate for WRITE.
 */
var P16_REVIEWED_MULTI=[
 {id:'EP-01069',show:'スポンジ',body:'3年ぶりに開幕から投打の「二刀流」で稼働した大リーグ・ドジャースの大谷翔平。7月を最後に投手としての出場はなく、打撃の成績も一時下降、9月上旬には1負傷者リストに入りました。7月に32歳を迎えた体は慢性的な故障も抱え、投打二刀流での100％の活躍が難しくなっているのでしょうか。今季、3度の渡米で大谷を取材してきた記者が語ります。\n※2026年10月1日に収録しました',articles:[
 ['ドジャースがリーグ優勝決定Sへ　大谷は足で貢献「祝杯は何回でも」','https://www.asahi.com/articles/ASVB776VLVB7UTQP002M.html?iref=omny'],
 ['大谷翔平、マウンドにかけていた今季　二刀流で秋を迎えられずとも','https://www.asahi.com/articles/ASV9Y2137V9YUTQP019M.html?iref=omny'],
 ['大谷、今季二刀流は絶望か　マウンド復帰を阻む「異変」　The Athletic','https://www.asahi.com/articles/ASV97235TV97SFVU1FTM.html?iref=omny']]},
 {id:'EP-06642',show:'ドーナツ',body:'YouTubeやTVerを長時間見てしまう中学2年生と小学4年生の子どもたち。「平日は1日1時間、土日は2時間だよ」と言っても約束を守ってくれないそうです。そんな子どもたちに対してイライラしてしまうリスナーさん。子どもとの約束について考えました。\n※2026年10月1日に収録しました。',articles:[
 ['家庭内での「怒り」にどう対応　識者に聞くアンガーマネージメント','https://www.asahi.com/articles/ASV6M26LDV6MUTIL02SM.html?iref=omny'],
 ['暴力をなぜ「しつけ」と擁護？　子育て中の名もなき父親が抱く違和感','https://www.asahi.com/articles/ASV6J23LRV6JUTIL00DM.html?iref=omny'],
 ['スマホのルール、AIに聞いた9歳の息子　親子の対話から見えたこと','https://www.asahi.com/articles/ASV9G0VZSV9GDIFI00TM.html?iref=omny']]}
];
function p16ReviewedMultiTwo(mode){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const sh=ss.getSheetByName('エピソード台帳');
 const checks=P16_REVIEWED_MULTI.map(item=>{
  const rowNumber=Number(item.id.slice(3))+1, r=sh.getRange(rowNumber,1,1,29).getValues()[0];
  if(r[0]!==item.id||r[1]!==item.show||String(r[22]||'').trim())throw Error('IDENTITY_OR_W_NOT_EMPTY_'+item.id);
  if(String(r[28]||'').trim())throw Error('AC_NOT_EMPTY_REVIEW_'+item.id);
  const raw=String(r[21]||'');
  if(!raw.includes(item.body.split('\n')[0])||!raw.includes(item.body.split('\n').slice(-1)[0]))throw Error('BODY_NOT_IN_V_'+item.id);
  for(const [title,url] of item.articles)if(!raw.includes(title)||!raw.includes(url))throw Error('ARTICLE_NOT_IN_V_'+item.id);
  const w=item.body+'\n【関連記事】\n'+item.articles.map(x=>x[0]+x[1]).join('\n');
  return {id:item.id,rowNumber,body:item.body,articleCount:item.articles.length,w};
 });
 if(mode!=='WRITE'){
  const result={mode:'READ_ONLY',items:checks,writes:0};console.log(JSON.stringify(result));return result;
 }
 if(PropertiesService.getScriptProperties().getProperty('P16_MULTI_TWO_APPROVED')!=='YES')throw Error('WRITE_NOT_APPROVED');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try {
  const updated=[];
  for(const item of checks){
   const live=sh.getRange(item.rowNumber,1,1,29).getValues()[0];
   if(live[0]!==item.id||String(live[22]||'').trim())throw Error('CONCURRENT_CHANGE_'+item.id);
   const result=PHASE15_INTEGRATED.writeRow(ss,sh,item.rowNumber,live,[{col:23,value:item.w,why:'P16_REVIEWED_MULTIARTICLE_W'}],'P16_REVIEWED_MULTIARTICLE_W');
   if(!result.ok)throw Error('WRITE_FAILED_'+item.id);
   updated.push(item.id);
  }
  const result={mode:'WRITE',updated,writes:updated.length};console.log(JSON.stringify(result));return result;
 }finally{lock.releaseLock();}
}
function p16PreviewReviewedMultiTwo(){return p16ReviewedMultiTwo('READ_ONLY');}
function p16WriteReviewedMultiTwo(){return p16ReviewedMultiTwo('WRITE');}
