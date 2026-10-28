/* Phase15 integrated GAS — single-writer, source-fenced, default read-only.
  Deployment/trigger installation is a separate, unperformed operation.
  Required Script Property P15_WRITES_ENABLED=YES before COPY writes.
  This file MUST NOT be deployed over a live GAS project without reviewing its
  existing script code/properties/other writers.
*/
var PHASE15_INTEGRATED=(function(){
'use strict';
var C={prod:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',copy:'1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY',tab:'エピソード台帳',feeds:'取得元一覧',cursor:'P15I_CURSOR',audit:'P15I_AUDIT',holds:'P15I_HOLD_QUEUE',enabled:'P15_WRITES_ENABLED',batch:100,columns:{N:14,O:15,P:16,V:22,W:23,X:24,AC:29,AT:46,AU:47,AV:48,AW:49,AX:50,AY:51}};
function txt(v){return v===null||v===undefined?'':String(v);}
function guid(v){return txt(v).trim().toLowerCase();}
function goodGuid(v){return /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/.test(guid(v));}
function validUrl(u){return /^https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/|$)/i.test(txt(u))&&!/^https?:\/\/[^/]*@/i.test(txt(u));}
function entity(v){return txt(v).replace(/&(?:amp|nbsp|lt|gt|quot|apos|hellip);|&#(?:x[\da-f]+|\d+);/gi,function(x){var m={'&amp;':'&','&nbsp;':' ','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&hellip;':'…'};if(m[x.toLowerCase()])return m[x.toLowerCase()];return String.fromCodePoint(parseInt(x.slice(x[2]==='x'?3:2,-1),x[2]==='x'?16:10));});}
function lines(raw){
 var v=txt(raw).replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n');
 v=v.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,function(_,href,label){var t=entity(label.replace(/<[^>]*>/g,'')).trim(),u=entity(href).trim();return validUrl(u)?t+(u===t?'':'\n'+u):t;});
 v=v.replace(/<br\s*\/?>|<\/?(?:p|div|li|section)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,'');
 return entity(v).split('\n').map(function(x){return x.trim();}).filter(Boolean);
}
function section(line){
 var m=txt(line).match(/^[【〖［\[]\s*([^】〗］\]\n]{1,80})[】〗］\]]?/);if(!m)return null;
 var h=m[1].replace(/\s/g,'');
 if(/^(?:番組内容|内容)$/.test(h))return {kind:'body',tail:line.slice(m[0].length).trim()};
 if(/^(?:関連記事|関連リンク|関連動画|写真まとめ|特集ページ|まとめトピックス)/.test(h))return {kind:'related',label:'【'+h+'】',tail:line.slice(m[0].length).trim()};
 if(/^(?:出演|スタッフ|出演者)/.test(h))return {kind:'staff'};
 if(/^(?:おねがい|朝ポキ情報|お知らせ|イベント|申し込み|過去の番組一覧|おすすめ|朝ポキも参加|朝日地球会議への申し込み|今回取り上げた記者サロン|川西記者ほか)/.test(h))return {kind:'skip'};
 return null;
}
function promotion(s){return /^(?:★|☆|３STEP|3STEP|ニュースレター.*登録はこちら|番組継続のため|朝日新聞ポッドキャストは、みなさま|ご意見・感想・リクエスト|See .*omnystudio|Learn more about|有料会員が選定！|アプリで記者と対話|番組検索ツール|交流はdiscord)/i.test(s)||/forms\.gle|forms\.cloud\.microsoft|bit\.ly\/asapoki_/i.test(s);}
function articleUrl(s){return /^https?:\/\/(?:www\.|digital\.)?asahi\.com\/(?:articles\/|rensai\/|topics\/|edu\/suisogaku\/)/i.test(txt(s));}
function clean(raw){
 var rawLines=lines(raw),mode='body',body=[],rel=[],cast=[],holds=[],pending='',pairs=0;
 function flush(){if(pending){rel.push(pending);holds.push('RELATED_TITLE_MISSING_VERIFIED_URL');pending='';}}
 rawLines.forEach(function(line){
  var h=section(line);if(h){if(mode==='related')flush();mode=h.kind;if(mode==='related')rel.push(h.label);if(h.tail&&mode==='body')body.push(h.tail);if(h.tail&&mode==='related')pending=h.tail;return;}
  if(/^[★☆]|^有料会員が選定！/.test(line)){mode='skip';return;}if(promotion(line)||mode==='skip')return;
  if(mode==='staff'){if(!/^https?:/.test(line))cast.push(line);return;}
  if(mode==='body'){
   line=line.replace(/これまでのONGOINGはこちら.*$/,'').replace(/過去のいちおしウニュ！はこちら.*$/,'').replace(/過去回はこちらから.*$/,'').replace(/吹奏楽のほかの回はこちら.*$/,'').replace(/3人のトークは毎週月曜日に配信します.*$/,'').trim();
   if(line&&!/^https?:\/\/(?:forms|bit\.ly)/.test(line))body.push(line);return;
  }
  if(mode==='related'){
   var inline=line.match(/^(.*?)\s+(https?:\/\/\S+)$/);
   if(inline&&inline[1]&&articleUrl(inline[2])&&validUrl(inline[2])){flush();rel.push(inline[1],inline[2]);pairs++;return;}
   if(/^https?:\/\//.test(line)){if(!articleUrl(line)&&/digital\.asahi\.com\/info\/|bit\.ly\/|t\.asahi\.com\/|forms\./.test(line))return;if(pending&&articleUrl(line)&&validUrl(line)){rel.push(pending,line);pending='';pairs++;}else{flush();holds.push('UNPAIRED_URL');}}
   else if(!/ニュースレター|購読|会員登録|登録はこちら|お申し込み/.test(line)){flush();pending=line;}
  }
 });
 if(mode==='related')flush();
 if(!body.length)holds.push('EMPTY_BODY');
 var result=body.join('\n')+(rel.length?'\n\n'+rel.join('\n'):'');
 if(/[【〖［]\s*(?:出演|スタッフ|おねがい)|購読料で配信しています|omnystudio\.com\/listener/.test(result))holds.push('RESIDUE');
 return {text:result,pairs:pairs,cast:cast,holds:Array.from(new Set(holds))};
}
function seconds(v){v=txt(v);if(/^\d+$/.test(v))return Number(v);if(/^\d+:\d{2}(?::\d{2})?$/.test(v)){var p=v.split(':').map(Number);return p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];}return 0;}
function parseFeed(xml,url,show){
 var root=XmlService.parse(xml).getRootElement(),channel=root.getChild('channel');
 if(!channel)throw Error('RSS_CHANNEL_MISSING');
 var ns=XmlService.getNamespace('itunes','http://www.itunes.com/dtds/podcast-1.0.dtd'),items=channel.getChildren('item');
 return items.map(function(it){
  var g=guid(it.getChildText('guid')),e=it.getChild('enclosure'),im=it.getChild('image',ns);
  return {guid:g,show:show,source:url,description:it.getChildText('description')||'',title:it.getChildText('title')||'',image:im&&im.getAttribute('href')?im.getAttribute('href').getValue():'',audio:e&&e.getAttribute('url')?e.getAttribute('url').getValue():'',duration:seconds(it.getChildText('duration',ns))};
 }).filter(function(it){return goodGuid(it.guid);});
}
function fetchSources(ss){
 var sh=ss.getSheetByName(C.feeds);if(!sh)throw Error('SOURCE_LIST_MISSING');
 var rows=sh.getRange(2,1,Math.min(20,sh.getLastRow()-1),8).getValues(),byGuid={},log=[];
 rows.forEach(function(r){
  var show=txt(r[0]),url=txt(r[7]);if(/AJW|アルキキ|YouTube|朝ポキTV/.test(show))return;
  if(!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/|feeds\.megaphone\.fm\/)/.test(url))return;
  try{
   var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
   if(response.getResponseCode()!==200)throw Error('HTTP_'+response.getResponseCode());
   var items=parseFeed(response.getContentText('UTF-8'),url,show);
   items.forEach(function(item){if(byGuid[item.guid])byGuid[item.guid].collision=true;else byGuid[item.guid]=item;});
   log.push({show:show,items:items.length,status:'OK'});
  }catch(e){log.push({show:show,status:'ERROR',message:txt(e).slice(0,120)});}
 });
 return {byGuid:byGuid,log:log,unique:Object.keys(byGuid).length};
}

/** Proven Phase14 official Omny endpoint: Phase14BackfillFiveOfficialDryRun.gs.
 * Fetch historic per-GUID JSON in 15-request chunks, never infer URLs.
 */
function utcStamp(v){
 if(v instanceof Date)return v.getTime();
 if(typeof v==='number')return Math.round((v-25569)*86400000)-32400000;
 var x=txt(v).replace(/\//g,'-').replace(' ','T');
 if(!/(?:Z|[+-]\d\d:\d\d)$/.test(x))x+='+09:00';
 return Date.parse(x);
}
function fetchHistoricOmny(rows,rssMap){
 var prefix='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/';
 var todo=[],map={},log=[];
 rows.forEach(function(r){
  var g=guid(r[6]),show=txt(r[1]);if(!goodGuid(g)||rssMap[g])return;
  if(/^(?:ニュースの学校|報談|AJW|アルキキ|YouTube|朝ポキTV)$/.test(show))return;
  if(todo.some(function(q){return q.guid===g;}))return;
  todo.push({guid:g,show:show,row:r,url:prefix+g});
 });
 for(var off=0;off<todo.length;off+=15){
  var chunk=todo.slice(off,off+15),responses;
  try{responses=UrlFetchApp.fetchAll(chunk.map(function(x){return {url:x.url,muteHttpExceptions:true,followRedirects:true};}));}
  catch(e){chunk.forEach(function(x){log.push({guid:x.guid,status:'NETWORK_ERROR'});});continue;}
  chunk.forEach(function(x,i){
   try{
    var resp=responses[i],status=resp.getResponseCode();
    if(status!==200){log.push({guid:x.guid,status:'HTTP_'+status});return;}
    var clip=JSON.parse(resp.getContentText('UTF-8'));
    if(!clip||guid(clip.Id)!==x.guid){log.push({guid:x.guid,status:'GUID_MISMATCH'});return;}
    if(txt(clip.Title).trim()!==txt(x.row[2]).trim()){log.push({guid:x.guid,status:'TITLE_MISMATCH'});return;}
    var local=utcStamp(x.row[3]),official=Date.parse(clip.PublishedUtc);
    if(!Number.isFinite(local)||!Number.isFinite(official)||Math.abs(local-official)>60000){log.push({guid:x.guid,status:'DATE_MISMATCH'});return;}
    var desc=txt(clip.DescriptionHtml||clip.Description);
    if(!desc){log.push({guid:x.guid,status:'DESCRIPTION_MISSING'});return;}
    var duration=Number(clip.DurationSeconds||0);
    var audio=txt(clip.AudioUrl),image=txt(clip.ImageUrl);
    if(audio&&!validUrl(audio))audio='';
    if(image&&!validUrl(image))image='';
    map[x.guid]={guid:x.guid,show:x.show,source:x.url,sourceType:'OFFICIAL_JSON',description:desc,title:clip.Title,audio:audio,image:image,duration:Number.isInteger(duration)&&duration>0?duration:0};
    log.push({guid:x.guid,status:'GUID_TITLE_DATE_VERIFIED'});
   }catch(e){log.push({guid:x.guid,status:'JSON_PARSE_ERROR'});}
  });
 }
 return {byGuid:map,log:log,checked:todo.length,verified:Object.keys(map).length};
}

function empty(v){return v===null||v===undefined||v==='';}
function plan(row,src,opts){
 var o={changes:[],holds:[],parsed:null};
 if(!src){o.holds.push('GUID_NOT_FOUND_IN_CURRENT_FEEDS');return o;}
 if(src.collision||guid(src.guid)!==guid(row[6])||src.show!==txt(row[1])){o.holds.push('SOURCE_IDENTITY_CONFLICT');return o;}
 if(!/^https:\/\/(?:www\.omnycontent\.com|feeds\.megaphone\.fm|api\.omny\.fm\/orgs\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/clips)\//.test(src.source)){o.holds.push('UNTRUSTED_SOURCE');return o;}
 var raw=txt(row[21]),official=txt(src.description),mismatch=Boolean(raw&&official&&raw!==official);
 if(!raw&&official){o.changes.push({col:22,value:official,why:'RSS_RAW_EXACT'});raw=official;}
 else if(mismatch)o.holds.push('V_DIFF_OFFICIAL_PROTECT');
 if(raw){
  var p=clean(raw);o.parsed=p;p.holds.forEach(function(h){o.holds.push(h);});
  if(!mismatch&&!p.holds.length&&p.text&&p.text!==txt(row[22])&&(empty(row[22])||opts.reviseW)){
   o.changes.push({col:23,value:p.text,why:empty(row[22])?'W_FILL':'W_REVISE'});
  }
  if(!mismatch&&empty(row[28])&&p.pairs&&!p.holds.length){
   var urls=(p.text.match(/https?:\/\/[^\s]+/g)||[]).filter(articleUrl);
   if(urls.length===p.pairs)o.changes.push({col:29,value:urls.join(' '),why:'VERIFIED_ARTICLE_INDEX'});
  }
  if(!mismatch&&official&&empty(row[23])&&p.cast.length&&!p.holds.length){
   var names=p.cast.map(function(x){return x.replace(/https?:\/\/\S+/g,'').replace(/^(?:MC・音源編集|MC|音源編集|司会|ナビゲーター)\s*[・／/:：]?\s*/,'').replace(/[（(].*$/,'').trim();}).filter(function(x){return x.length>=2;});
   if(names.length){o.changes.push({col:24,value:p.cast.join('\n'),why:'EXPLICIT_CAST_IN_OFFICIAL_RAW'});
    names.slice(0,5).forEach(function(name,i){if(empty(row[45+i]))o.changes.push({col:46+i,value:name,why:'CAST_NAME_'+(i+1)});});
    if(empty(row[50]))o.changes.push({col:51,value:src.source+'#guid='+src.guid,why:'CAST_SOURCE'});}
  }
 }
 [['N',src.image],['O',src.audio],['P',src.duration]].forEach(function(x){
  var c=C.columns[x[0]],v=x[1];if(!empty(row[c-1])||empty(v))return;
  if(x[0]==='P'?Number.isInteger(v)&&v>0:validUrl(v))o.changes.push({col:c,value:v,why:'RSS_'+x[0]});
 });
 return o;
}
function writeRow(ss,sh,rn,original,changes,source){
 var live=sh.getRange(rn,1,1,55).getValues()[0];
 if(txt(live[0])!==txt(original[0])||guid(live[6])!==guid(original[6]))return {ok:false,why:'EP_ID_GUID_CHANGED'};
 for(var i=0;i<changes.length;i++){
  var c=changes[i],cell=sh.getRange(rn,c.col);
  if(txt(live[c.col-1])!==txt(original[c.col-1])||cell.getFormula()||cell.getDataValidation())return {ok:false,why:'CHANGED_OR_PROTECTED_COL_'+c.col};
 }
 var a=ss.getSheetByName(C.audit);
 if(!a){a=ss.insertSheet(C.audit);a.appendRow(['UTC','STATE','ROW','EP-ID','GUID','SOURCE','COLUMN','BEFORE','AFTER','WHY']);}
 var records=changes.map(function(c){return [new Date().toISOString(),'PENDING',rn,txt(original[0]),txt(original[6]),source,c.col,txt(original[c.col-1]),txt(c.value),c.why];});
 var first=a.getLastRow()+1;a.getRange(first,1,records.length,10).setValues(records);SpreadsheetApp.flush();
 changes.forEach(function(c){sh.getRange(rn,c.col).setValue(c.value);});
 var verify=sh.getRange(rn,1,1,55).getValues()[0];
 if(txt(verify[0])!==txt(original[0])||guid(verify[6])!==guid(original[6]))throw Error('POSTWRITE_IDENTITY_CHANGED');
 changes.forEach(function(c){if(txt(verify[c.col-1])!==txt(c.value))throw Error('POSTWRITE_MISMATCH_COL_'+c.col);});
 a.getRange(first,2,records.length,1).setValues(records.map(function(){return ['VERIFIED'];}));
 return {ok:true};
}
function run(args){
 args=args||{};var lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
 try{
  var prod=args.target==='PROD';if(prod&&args.write&&!args.prodApproved)throw Error('PROD_WRITE_NOT_APPROVED');
  var props=PropertiesService.getScriptProperties();if(args.write&&props.getProperty(C.enabled)!=='YES')throw Error('WRITE_GATE_CLOSED');
  if(prod&&args.write&&props.getProperty('P15_PRODUCTION_APPROVED')!=='YES')throw Error('PRODUCTION_QUALITY_GATE_CLOSED');
  if(prod&&args.write&&props.getProperty('P15_OTHER_WRITERS_PAUSED')!=='YES')throw Error('PARALLEL_WRITERS_NOT_PAUSED');
  var ss=SpreadsheetApp.openById(prod?C.prod:C.copy),sh=ss.getSheetByName(C.tab);
  if(!sh)throw Error('LEDGER_NOT_FOUND');
  var cursorKey=C.cursor+(prod?'_PROD':'_COPY');
  var start=Math.max(2,Number(args.startRow)||Number(props.getProperty(cursorKey))||2);
  var end=Math.min(sh.getLastRow(),start+Math.min(100,Math.max(1,Number(args.limit)||100))-1);
  var source=fetchSources(ss),rows=sh.getRange(start,1,Math.max(1,end-start+1),55).getValues(),stamp=Date.now();
  var historic=fetchHistoricOmny(rows,source.byGuid);
  Object.keys(historic.byGuid).forEach(function(g){if(!source.byGuid[g])source.byGuid[g]=historic.byGuid[g];});
  var result={mode:args.write?'WRITE':'DRY_RUN',target:prod?'PROD':'COPY',start:start,next:start,officialGuids:source.unique,officialJsonVerified:historic.verified,officialJsonChecked:historic.checked,officialJsonLog:historic.log,feeds:source.log,processed:0,counts:{V:0,W_new:0,W_revised:0,AC:0,N:0,O:0,P:0,X:0,AT:0,AU:0,AV:0,AW:0,AX:0,AY:0},holds:[],changed:[]};
  for(var i=0;i<rows.length&&start+i<=end;i++){
   if(Date.now()-stamp>240000)break;
   var row=rows[i],rn=start+i;result.processed++;
   if(!/^EP-\d{5,6}$/.test(txt(row[0]))||!goodGuid(row[6])||/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(txt(row[1]))){result.holds.push({row:rn,reason:'EXCLUDED_OR_INVALID_ID'});result.next=rn+1;continue;}
   var origin=source.byGuid[guid(row[6])],proposal;
   try{proposal=plan(row,origin,{reviseW:args.reviseW===true});}
   catch(e){result.holds.push({row:rn,id:row[0],why:'ROW_PARSE_ERROR',detail:txt(e).slice(0,160)});result.next=rn+1;if(args.write&&!args.preserveCursor)props.setProperty(cursorKey,String(result.next));continue;}
   if(proposal.holds.length)result.holds.push({row:rn,id:row[0],why:proposal.holds});
   var changes=proposal.changes.filter(function(c){return proposal.holds.indexOf('SOURCE_IDENTITY_CONFLICT')<0&&(!/^(W_|VERIFIED_ARTICLE)/.test(c.why)||proposal.holds.length===0);});
   if(changes.length){
    var w=args.write?writeRow(ss,sh,rn,row,changes,origin.source):{ok:true};
    if(!w.ok)result.holds.push({row:rn,id:row[0],reason:w.why});
    else{
     changes.forEach(function(c){var k=Object.keys(C.columns).filter(function(z){return C.columns[z]===c.col;})[0];if(k==='W')k=empty(row[22])?'W_new':'W_revised';if(k==='AC')k='AC';if(result.counts[k]!==undefined)result.counts[k]++;});
     result.changed.push({row:rn,id:row[0],cols:changes.map(function(c){return c.col;})});
    }
   }
   result.next=rn+1;if(args.write)props.setProperty(cursorKey,String(result.next));
  }
  if(args.write&&result.holds.length){
   var holdTab=ss.getSheetByName(C.holds);if(!holdTab){holdTab=ss.insertSheet(C.holds);holdTab.appendRow(['UTC','TARGET','ROW','EP-ID','GUID','REASON','RETRY_STATUS']);}
   var holdRows=result.holds.map(function(h){var r=rows[h.row-start]||[];return [new Date().toISOString(),prod?'PROD':'COPY',h.row,h.id||txt(r[0]),txt(r[6]),JSON.stringify(h.why||h.reason||h.detail||''),'PENDING'];});
   holdTab.getRange(holdTab.getLastRow()+1,1,holdRows.length,7).setValues(holdRows);
  }
  Logger.log(JSON.stringify({mode:result.mode,target:result.target,processed:result.processed,next:result.next,counts:result.counts,holds:result.holds.length,officialJsonVerified:result.officialJsonVerified,feeds:result.feeds}));
  return result;
 }finally{lock.releaseLock();}
}
return {clean:clean,plan:plan,parseFeed:parseFeed,fetchSources:fetchSources,run:run};
})();
function p15iCopyDryRun(){return PHASE15_INTEGRATED.run({target:'COPY',startRow:2,limit:30,write:false});}
function p15iProductionDryRun(){return PHASE15_INTEGRATED.run({target:'PROD',startRow:2,limit:30,write:false});}
function p15iCopyWrite(){return PHASE15_INTEGRATED.run({target:'COPY',startRow:2,limit:30,write:true});}
function p15iCopyContinue(){return PHASE15_INTEGRATED.run({target:'COPY',limit:100,write:true});}
function p15iProductionContinue(){return PHASE15_INTEGRATED.run({target:'PROD',limit:100,write:true,prodApproved:true});}
function p15iProductionSmallWrite(){return PHASE15_INTEGRATED.run({target:'PROD',startRow:2,limit:5,write:true,prodApproved:true});}
/* No trigger creation here: quality gate and parallel-writer owner must be approved first. */
/* Pure local parser smoke tests: no API, Sheets, triggers or writes. */
function p15iParserSmokeTests(){
 var tests=[
 {name:'related_after_staff',raw:'本文\\n〖出演・スタッフ〗\\n担当者\\n【関連記事】\\n記事A\\nhttps://www.asahi.com/articles/A.html',pairs:1},
 {name:'html_anchor',raw:'<p>本文</p><p>【関連記事】<br><a href="https://www.asahi.com/articles/B.html">記事B</a></p><p>【スタッフ】<br>担当者</p>',pairs:1},
 {name:'no_unsupported_pairing',raw:'本文\\n【関連記事】\\n記事A\\n記事B\\n【出演】\\n担当者',pairs:0,hold:true},
 {name:'newsletter_in_related',raw:'本文\\n【関連記事】\\n記事C\\nhttps://www.asahi.com/articles/C.html\\nニュースレター登録はこちら\\nhttps://digital.asahi.com/info/newsletter',pairs:1},
 {name:'promotion_before_articles',raw:'本文\\n★イベント申し込み\\n記者をフォローしてください\\n【関連記事】\\n記事D\\nhttps://www.asahi.com/articles/D.html',pairs:1},
 {name:'event_section_before_articles',raw:'本文\\n【朝ポキも参加！GOOD LIFEフェア】\\n無料ご入場いただけます\\n【関連記事】\\n記事E\\nhttps://www.asahi.com/articles/E.html',pairs:1}
 ];
 return tests.map(function(t){var x=PHASE15_INTEGRATED.clean(t.raw),ok=x.pairs===t.pairs&&!/担当者|フォローしてください|無料ご入場|ニュースレター|〖出演|【出演/.test(x.text)&&(!t.hold||x.holds.length>0);return{name:t.name,ok:ok,pairs:x.pairs,holds:x.holds};});
}

/** Retry a held row after fixing its source, without moving the main scan cursor. */
function p15iRetryHeldCopyRow(row){return PHASE15_INTEGRATED.run({target:'COPY',startRow:row,limit:1,write:true,preserveCursor:true});}
function p15iRetryHeldProductionRow(row){return PHASE15_INTEGRATED.run({target:'PROD',startRow:row,limit:1,write:true,preserveCursor:true,prodApproved:true});}

/** Only call after successful online COPY + production pilot validation and explicit approval. */
function p15iInstallProductionTrigger(){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('P15_WRITES_ENABLED')!=='YES'||p.getProperty('P15_PRODUCTION_APPROVED')!=='YES'||
    p.getProperty('P15_OTHER_WRITERS_PAUSED')!=='YES'||p.getProperty('P15_QUALITY_GATE_PASSED')!=='YES')
  throw Error('P15_TRIGGERS_NOT_APPROVED');
 var name='p15iProductionContinue';
 var found=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()===name;});
 if(found.length>1)throw Error('DUPLICATE_TRIGGER_PRESENT');
 if(found.length===1)return {installed:false,alreadyPresent:true,handler:name};
 var t=ScriptApp.newTrigger(name).timeBased().everyMinutes(15).create();
 return {installed:true,handler:t.getHandlerFunction(),frequency:'15min'};
}
function p15iPauseProductionTrigger(){
 var removed=0;ScriptApp.getProjectTriggers().forEach(function(t){
  if(t.getHandlerFunction()==='p15iProductionContinue'){ScriptApp.deleteTrigger(t);removed++;}
 });
 return {removed:removed};
}
