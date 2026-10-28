// GENERATED: edit source files, then run build-autonomous-bundle.cjs

// SOURCE: Phase15IntegratedProductionEngine.gs
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
  if(/^※20\d{2}年\d{1,2}月\d{1,2}日に収録しました/.test(line)){body.push(line.split('。')[0]+'。');return;}
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
 if(/[【〖［]\s*(?:出演|スタッフ|おねがい)|購読料で配信しています|omnystudio\.com\/listener|PODCAST MEETING|スタンダードコース|discord|会員登録|ad choices/i.test(result))holds.push('RESIDUE');
 return {text:result,pairs:pairs,cast:cast,holds:Array.from(new Set(holds))};
}
function seconds(v){v=txt(v);if(/^\d+$/.test(v))return Number(v);if(/^\d+:\d{2}(?::\d{2})?$/.test(v)){var p=v.split(':').map(Number);return p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];}return 0;}
function parseFeed(xml,url,show){
 var root=XmlService.parse(xml).getRootElement(),channel=root.getChild('channel');
 if(!channel)throw Error('RSS_CHANNEL_MISSING');
 var ns=XmlService.getNamespace('itunes','http://www.itunes.com/dtds/podcast-1.0.dtd'),items=channel.getChildren('item');
 return items.map(function(it){
  var g=guid(it.getChildText('guid')),e=it.getChild('enclosure'),im=it.getChild('image',ns);
  return {guid:g,show:show,source:url,description:it.getChildText('description')||'',title:it.getChildText('title')||'',published:it.getChildText('pubDate')||'',link:it.getChildText('link')||'',image:im&&im.getAttribute('href')?im.getAttribute('href').getValue():'',audio:e&&e.getAttribute('url')?e.getAttribute('url').getValue():'',duration:seconds(it.getChildText('duration',ns))};
 }).filter(function(it){return goodGuid(it.guid);});
}
function fetchSources(ss,deadline){
 var sh=ss.getSheetByName(C.feeds);if(!sh)throw Error('SOURCE_LIST_MISSING');
 var rows=sh.getRange(2,1,Math.min(20,sh.getLastRow()-1),8).getValues(),byGuid={},log=[];
 rows.forEach(function(r){
  if(deadline&&Date.now()>deadline-15000)return;
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
function fetchHistoricOmny(rows,rssMap,deadline){
 var prefix='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/';
 var todo=[],map={},log=[];
 rows.forEach(function(r){
  var g=guid(r[6]),show=txt(r[1]);if(!goodGuid(g)||rssMap[g])return;
  if(/^(?:ニュースの学校|報談|AJW|アルキキ|YouTube|朝ポキTV)$/.test(show))return;
  if(todo.some(function(q){return q.guid===g;}))return;
  todo.push({guid:g,show:show,row:r,url:prefix+g});
 });
 for(var off=0;off<todo.length;off+=15){
  if(deadline&&Date.now()>deadline-20000)break;
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
    map[x.guid]={guid:x.guid,show:x.show,source:x.url,sourceType:'OFFICIAL_JSON',description:desc,title:clip.Title,audio:audio,image:image,published:clip.PublishedUtc,link:txt(clip.PublishedUrl||clip.ShareUrl),duration:Number.isFinite(duration)&&duration>0?Math.round(duration):0};
    log.push({guid:x.guid,status:'GUID_TITLE_DATE_VERIFIED'});
   }catch(e){log.push({guid:x.guid,status:'JSON_PARSE_ERROR'});}
  });
 }
 return {byGuid:map,log:log,checked:todo.length,verified:Object.keys(map).length};
}

// Adapted from Phase14 V2/V3: explicit section, bounded names, no guessing.
function castNames(entries){
 var names=[];
 for(var i=0;i<entries.length;i++){
  var entry=entries[i];
  // Pure production credits are retained in X, not asserted as speakers.
  if(/^(?:音源編集|編集|制作|構成)(?:[：: 　]|$)/.test(entry))continue;
  var name=entry.replace(/https?:\/\/\S+/g,'').replace(/^(?:MC(?:[、・]\s*音源編集)?|司会|進行|ゲスト|ナビゲーター)[：: 　]*/,'').replace(/[（(].*$/,'').trim();
  if(!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}・ 　]{2,30}$/u.test(name))return {names:[],hold:'CAST_NEEDS_REVIEW'};
  if(names.indexOf(name)<0)names.push(name);
 }
 return names.length>5?{names:[],hold:'CAST_OVERFLOW'}:{names:names};
}
function humanExcluded(v){return !/^(?:|未指定|FALSE|false|いいえ|0)$/.test(txt(v).trim());}
function empty(v){return v===null||v===undefined||v==='';}
function plan(row,src,opts){
 var o={changes:[],holds:[],parsed:null};
 if(!src){o.holds.push('GUID_NOT_FOUND_IN_CURRENT_FEEDS');return o;}
 if(src.collision||guid(src.guid)!==guid(row[6])||src.show!==txt(row[1])){o.holds.push('SOURCE_IDENTITY_CONFLICT');return o;}
 if(!/^https:\/\/(?:www\.omnycontent\.com|feeds\.megaphone\.fm|api\.omny\.fm\/orgs\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/clips)\//.test(src.source)){o.holds.push('UNTRUSTED_SOURCE');return o;}
 if(txt(src.description).length>49000){o.holds.push('SOURCE_TOO_LONG_FOR_CELL');return o;}
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
  if(!mismatch&&official&&p.cast.length){
   var castResult=castNames(p.cast),names=castResult.names;
   if(castResult.hold)o.holds.push(castResult.hold);
   if(names.length){if(empty(row[23]))o.changes.push({col:24,value:p.cast.join('\n'),why:'EXPLICIT_CAST_IN_OFFICIAL_RAW'});
    names.forEach(function(name,i){if(empty(row[45+i]))o.changes.push({col:46+i,value:name,why:'CAST_NAME_'+(i+1)});});
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
 if(typeof P15_AUTO!=='undefined')P15_AUTO.assertOwner(ss);
 var live=sh.getRange(rn,1,1,55).getValues()[0];
 if(txt(live[0])!==txt(original[0])||guid(live[6])!==guid(original[6]))throw Error('EP_ID_GUID_CHANGED');
 if(live.some(function(v,i){return txt(v)!==txt(original[i]);}))throw Error('CONCURRENT_ROW_CHANGE');
 for(var i=0;i<changes.length;i++){
  var c=changes[i],cell=sh.getRange(rn,c.col);
  if(txt(live[c.col-1])!==txt(original[c.col-1])||cell.getFormula()||cell.getDataValidation()){if(txt(live[c.col-1])!==txt(original[c.col-1]))throw Error('CONCURRENT_CELL_CHANGE_'+c.col);return {ok:false,why:'PROTECTED_COL_'+c.col};}
 }
 var a=ss.getSheetByName(C.audit);
 if(!a){a=ss.insertSheet(C.audit);a.appendRow(['UTC','STATE','ROW','EP-ID','GUID','SOURCE','COLUMN','BEFORE','AFTER','WHY']);}
 var records=changes.map(function(c){return [new Date().toISOString(),'PENDING',rn,txt(original[0]),txt(original[6]),source,c.col,txt(original[c.col-1]),txt(c.value),c.why];});
 var first=a.getLastRow()+1;a.getRange(first,1,records.length,10).setValues(records);SpreadsheetApp.flush();
 var expected=original.slice();
 changes.forEach(function(c){
  var current=sh.getRange(rn,1,1,55).getValues()[0];
  if(current.some(function(v,i){return txt(v)!==txt(expected[i]);}))throw Error('CONCURRENT_ROW_CHANGE_DURING_WRITE');
  sh.getRange(rn,c.col).setValue(typeof c.value==='string'&&/^[=+@-]/.test(c.value)?"'"+c.value:c.value);expected[c.col-1]=c.value;});
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
  if(args.write&&typeof P15_AUTO!=='undefined')P15_AUTO.assertOwner(ss);
  var cursorKey=C.cursor+(prod?'_PROD':'_COPY');
  var start=Math.max(2,Number(args.startRow)||Number(props.getProperty(cursorKey))||2);
  if(start>sh.getLastRow())start=2;
  var deadline=args.deadline||Date.now()+240000;
  var end=Math.min(sh.getLastRow(),start+Math.min(100,Math.max(1,Number(args.limit)||100))-1);
  var source=args.sources||fetchSources(ss,deadline),rows=sh.getRange(start,1,Math.max(1,end-start+1),55).getValues(),stamp=Date.now();
  var historic=fetchHistoricOmny(rows.filter(function(r){return !args.deferred||!args.deferred[guid(r[6])];}),source.byGuid,deadline);
  Object.keys(historic.byGuid).forEach(function(g){if(!source.byGuid[g])source.byGuid[g]=historic.byGuid[g];});
  var result={mode:args.write?'WRITE':'DRY_RUN',target:prod?'PROD':'COPY',start:start,next:start,officialGuids:source.unique,officialJsonVerified:historic.verified,officialJsonChecked:historic.checked,officialJsonLog:historic.log,feeds:source.log,processed:0,counts:{V:0,W_new:0,W_revised:0,AC:0,N:0,O:0,P:0,X:0,AT:0,AU:0,AV:0,AW:0,AX:0,AY:0},holds:[],excluded:[],changed:[]};
  for(var i=0;i<rows.length&&start+i<=end;i++){
   if(Date.now()>deadline-15000)break;
   var row=rows[i],rn=start+i;result.processed++;
   function advance(){result.next=rn+1;if(args.write&&!args.preserveCursor)props.setProperty(cursorKey,String(result.next));}
   if(/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(txt(row[1]))||humanExcluded(row[38])){result.excluded.push({row:rn,id:row[0],reason:'OUT_OF_SCOPE'});advance();continue;}
   if(!/^EP-\d{5,6}$/.test(txt(row[0]))||!goodGuid(row[6])){result.holds.push({row:rn,id:row[0],why:'INVALID_ID_OR_GUID'});advance();continue;}
   if(args.write&&args.target==='COPY'&&rn===2&&!args.allowFirstRow){
    result.holds.push({row:rn,id:row[0],why:'FIRST_ROW_NEEDS_EXPLICIT_TRIAL_GATE'});advance();continue;
   }
   var origin=source.byGuid[guid(row[6])],proposal;
   try{proposal=plan(row,origin,{reviseW:args.reviseW===true});}
   catch(e){result.holds.push({row:rn,id:row[0],why:'ROW_PARSE_ERROR',detail:txt(e).slice(0,160)});result.next=rn+1;if(args.write&&!args.preserveCursor)props.setProperty(cursorKey,String(result.next));continue;}
   if(!origin&&args.deferred&&args.deferred[guid(row[6])])proposal.holds=args.deferred[guid(row[6])];
   else if(!origin){var diagnosis=historic.log.filter(function(d){return d.guid===guid(row[6]);})[0];if(diagnosis)proposal.holds=[diagnosis.status];}
   if(proposal.holds.length)result.holds.push({row:rn,id:row[0],why:proposal.holds});
   var changes=proposal.changes.filter(function(c){return proposal.holds.indexOf('SOURCE_IDENTITY_CONFLICT')<0&&(!/^(W_|VERIFIED_ARTICLE)/.test(c.why)||proposal.holds.length===0);});
   if(changes.length){
    var w;
    try{w=args.write?writeRow(ss,sh,rn,row,changes,origin.source):{ok:true};}
    catch(e){if(args.write)props.setProperty('P15_HALT',txt(e).slice(0,180));throw e;}
    if(!w.ok)result.holds.push({row:rn,id:row[0],reason:w.why});
    else{
     changes.forEach(function(c){var k=Object.keys(C.columns).filter(function(z){return C.columns[z]===c.col;})[0];if(k==='W')k=empty(row[22])?'W_new':'W_revised';if(k==='AC')k='AC';if(result.counts[k]!==undefined)result.counts[k]++;});
     result.changed.push({row:rn,id:row[0],cols:changes.map(function(c){return c.col;})});
    }
   }
   advance();
  }
  if(args.write&&typeof P15_AUTO!=='undefined')P15_AUTO.recordHolds(ss,result,rows);
  else if(args.write&&result.holds.length){
   var holdTab=ss.getSheetByName(C.holds);if(!holdTab){holdTab=ss.insertSheet(C.holds);holdTab.appendRow(['UTC','TARGET','ROW','EP-ID','GUID','REASON','RETRY_STATUS']);}
   var holdRows=result.holds.map(function(h){var r=rows[h.row-start]||[];return [new Date().toISOString(),prod?'PROD':'COPY',h.row,h.id||txt(r[0]),txt(r[6]),JSON.stringify(h.why||h.reason||h.detail||''),'PENDING'];});
   holdTab.getRange(holdTab.getLastRow()+1,1,holdRows.length,7).setValues(holdRows);
  }
  Logger.log(JSON.stringify({mode:result.mode,target:result.target,processed:result.processed,next:result.next,counts:result.counts,holds:result.holds.length,officialJsonVerified:result.officialJsonVerified,feeds:result.feeds}));
  return result;
 }finally{lock.releaseLock();}
}
return {humanExcluded:humanExcluded,clean:clean,castNames:castNames,plan:plan,parseFeed:parseFeed,fetchSources:fetchSources,fetchHistoricOmny:fetchHistoricOmny,writeRow:writeRow,run:run};
})();
function p15iCopyDryRun(){return PHASE15_INTEGRATED.run({target:'COPY',startRow:2,limit:30,write:false});}
function p15iProductionDryRun(){return PHASE15_INTEGRATED.run({target:'PROD',startRow:2,limit:30,write:false});}
function p15iCopyWrite(){return PHASE15_INTEGRATED.run({target:'COPY',startRow:2,limit:30,write:true});}
function p15iCopyTrialDryRun(){return PHASE15_INTEGRATED.run({target:'COPY',startRow:2,limit:1,write:false});}
function p15iCopyTrialWrite(){return PHASE15_INTEGRATED.run({target:'COPY',startRow:2,limit:1,write:true,preserveCursor:true,allowFirstRow:true});}
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

/** Manual bounded retry of 1-10 unresolved COPY holds; never advances normal cursor.
 * Uses same GUID/source verification. Re-run after source mismatch is resolved.
 */
function p15iRetryPendingCopyHolds(){
 var ss=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY');
 var sh=ss.getSheetByName('P15I_HOLD_QUEUE');if(!sh||sh.getLastRow()<2)return {scanned:0,resolved:0,pending:0};
 var rows=sh.getRange(2,1,sh.getLastRow()-1,7).getValues(),seen={};
 var result={scanned:0,resolved:0,pending:0,errors:[]};
 for(var i=0;i<rows.length&&result.scanned<10;i++){
  var record=rows[i],rowNumber=Number(record[2]),key=String(record[1])+'/'+rowNumber;
  if(record[1]!=='COPY'||record[6]!=='PENDING'||seen[key]||!Number.isInteger(rowNumber)||rowNumber<2)continue;
  seen[key]=true;result.scanned++;
  try{
   var trial=PHASE15_INTEGRATED.run({target:'COPY',startRow:rowNumber,limit:1,write:true,preserveCursor:true});
   var stillHeld=trial.holds.length>0,oldReason=String(record[5]||'');
   var outcome=stillHeld?'PENDING':'RESOLVED';
   // Do not declare success for empty-source/no-write cases: trial itself will hold those.
   if(!stillHeld){
     var ledger=ss.getSheetByName('エピソード台帳'),current=ledger.getRange(rowNumber,1,1,7).getValues()[0];
     if(String(current[0])===String(record[3])&&String(current[6]).toLowerCase()===String(record[4]).toLowerCase()){
      sh.getRange(i+2,7).setValue('RESOLVED');result.resolved++;
     }else result.pending++;
    }
   else result.pending++;
  }catch(e){result.pending++;result.errors.push({row:rowNumber,reason:String(e).slice(0,120)});}
 }
 return result;
}


/** Only call after successful online COPY + production pilot validation and explicit approval. */
function p15iInstallProductionTrigger(){
 if(typeof p15AutonomousInstallTrigger==='function')return p15AutonomousInstallTrigger();
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


// SOURCE: Phase15AutonomousRuntime.gs
/** Standalone GAS scheduler. Load alongside Phase15IntegratedProductionEngine.gs.
 * No ChatGPT, external worker, web app, npm, or OAuth secret dependency.
 * Dedicated project recommended; never replace unrelated scripts/triggers.
 */
var P15_AUTO=(function(){
'use strict';
var ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',VERSION='p15-auto-20261028.2-six-platforms';
var H=['KEY','EP-ID','GUID','ROW','REASON','STATE','ATTEMPTS','NEXT_UTC','LAST_UTC'];
function props(){return PropertiesService.getScriptProperties();}
function str(x){return x==null?'':String(x);}
function column(n){var a='';while(n){n--;a=String.fromCharCode(65+n%26)+a;n=Math.floor(n/26);}return a;}
function norm(x){return str(x).trim().toLowerCase();}
function ss(){return SpreadsheetApp.openById(ID);}
function table(s,name,headers){var t=s.getSheetByName(name);if(!t){t=s.insertSheet(name);t.appendRow(headers);}return t;}
function rows(t,n){return t.getLastRow()>1?t.getRange(2,1,t.getLastRow()-1,n).getValues():[];}
function put(t,r,values){if(r>t.getMaxRows())t.insertRowsAfter(t.getMaxRows(),Math.max(100,r-t.getMaxRows()));t.getRange(r,1,1,values.length).setValues([values.map(function(x){return typeof x==='string'&&/^[=+@-]/.test(x)?"'"+x:x;})]);}
function assertOwner(s){
 var p=props();
 if(s.getId()!==ID)throw Error('WRONG_LEDGER');
 if(p.getProperty('P15_HALT'))throw Error('HALTED_'+p.getProperty('P15_HALT'));
 if(p.getProperty('P15_OWNER_SCRIPT_ID')!==ScriptApp.getScriptId())throw Error('OWNER_NOT_CONFIGURED');
 if(p.getProperty('P15_OTHER_WRITERS_PAUSED')!=='YES'||!p.getProperty('P15_WRITER_REVIEW_NOTE'))throw Error('OLD_WRITER_REVIEW_REQUIRED');
 if(p.getProperty('P15_WRITES_ENABLED')!=='YES'||p.getProperty('P15_PRODUCTION_APPROVED')!=='YES')throw Error('WRITE_GATE_CLOSED');
 var t=s.getSheetByName('P15_OWNER');
 if(!t||str(t.getRange(2,1).getValue())!==ScriptApp.getScriptId())throw Error('OWNER_MISMATCH');
 // ScriptLock protects this project only. Other projects must be disabled by owner.
}
function retryPolicy(reason,attempt,now){
 if(/OUT_OF_SCOPE/.test(reason))return {state:'EXCLUDED',next:''};
 if(/TOO_LONG|REVIEW|INVALID|PROTECTED|CONFLICT|MISMATCH|V_DIFF|RELATED_|UNPAIRED|RESIDUE|EMPTY_BODY|CAST_|FIRST_ROW|UNVERIFIED|HTTP_40[134]/.test(reason))return {state:'REVIEW',next:''};
 if(attempt>=8)return {state:'EXHAUSTED',next:''};
 return {state:'RETRY',next:new Date(now+Math.min(7*86400000,3600000*Math.pow(2,attempt))).toISOString()};
}
function recordHolds(s,result,input){
 var t=table(s,'P15_RETRY',H),all=rows(t,9),index={};
 all.forEach(function(r,i){index[r[0]]=i+2;});
 (result.holds||[]).concat(result.excluded||[]).forEach(function(h){
  var r=input[h.row-result.start]||[],ep=h.id||r[0]||'',g=norm(r[6]),reasons=h.why||h.reason;
  (Array.isArray(reasons)?reasons:[reasons]).forEach(function(reason){
   reason=str(reason);var key=ep+'|'+g+'|'+reason,at=index[key],old=at?all[at-2]:null;
   // Normal patrol does not reset retry backoff or terminal review states.
   if(old&&old[5]!=='RESOLVED')return;
   var policy=retryPolicy(reason,0,Date.now()),v=[key,ep,g,h.row,reason,policy.state,0,policy.next,new Date().toISOString()];
   if(!at){at=t.getLastRow()+1;index[key]=at;}put(t,at,v);all[at-2]=v;
  });
 });
}
function migrateLegacy(s){
 var legacy=s.getSheetByName('P15I_HOLD_QUEUE');if(!legacy)return {imported:0};
 var inv=inventory(s),holds=[],seen={};
 rows(legacy,7).forEach(function(r){
  if(r[1]!=='PROD'||r[6]!=='PENDING')return;var rn=inv.ids[str(r[3])],live=rn?inv.data[rn-2]:null;
  if(!live||norm(live[6])!==norm(r[4]))return; // historical stale row remains in original log
  var reasons;try{reasons=JSON.parse(r[5]);}catch(e){reasons='LEGACY_REVIEW';}
  [].concat(reasons).forEach(function(reason){
   if(reason==='EXCLUDED_OR_INVALID_ID')reason=/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(str(live[1]))||PHASE15_INTEGRATED.humanExcluded(live[38])?'OUT_OF_SCOPE':'INVALID_ID_OR_GUID';
   var key=r[3]+'|'+reason;if(seen[key])return;seen[key]=true;holds.push({row:rn,id:r[3],why:reason});
  });
 });recordHolds(s,{start:2,holds:holds},inv.data);return {imported:holds.length};
}
function fatal(e){var message=str(e).slice(0,200);props().setProperty('P15_HALT',message);return message;}
function locked(fn){var l=LockService.getScriptLock();if(!l.tryLock(1000))throw Error('WRITER_BUSY');try{return fn();}finally{l.releaseLock();}}
function pending(s){
 var audit=s.getSheetByName('P15I_AUDIT'),intake=s.getSheetByName('P15_INTAKE');
 return (audit?rows(audit,10).filter(function(r){return /^(?:PENDING|ROLLBACK_PENDING)$/.test(r[1]);}).length:0)+(intake?rows(intake,7).filter(function(r){return r[3]==='RESERVED';}).length:0);
}
function inventory(s){
 var sh=s.getSheetByName('エピソード台帳'),data=rows(sh,55),ids={},guids={},max=0;
 data.forEach(function(r,i){
  var id=str(r[0]),g=norm(r[6]);
  if(id){if(ids[id])throw Error('DUPLICATE_EP_ID_'+id);ids[id]=i+2;var m=id.match(/^EP-(\d+)$/);if(m)max=Math.max(max,Number(m[1]));}
  if(g){if(!guids[g])guids[g]=[];guids[g].push(i+2);}
 });
 var legacy=s.getSheetByName('固定ID採番履歴'),reservedGuids={};
 if(legacy){
  var head=legacy.getRange(1,1,1,2).getValues()[0];if(head[0]!=='GUID'||head[1]!=='固定ID')throw Error('HISTORY_SCHEMA_MISMATCH');
  rows(legacy,8).forEach(function(r){var m=str(r[1]).match(/^EP-(\d+)$/);if(m)max=Math.max(max,+m[1]);if(r[0])reservedGuids[norm(r[0])]=str(r[1]);});
 }
 return {sh:sh,data:data,ids:ids,guids:guids,reservedGuids:reservedGuids,max:max};
}
function intake(s,sources,deadline){return locked(function(){
 assertOwner(s);var inv=inventory(s),p=props(),since=Date.parse(p.getProperty('P15_INGEST_SINCE')||'');
 if(!Number.isFinite(since))throw Error('INGEST_SINCE_REQUIRED');
 inv.max=Math.max(inv.max,Number(p.getProperty('P15_MAX_EP_NUMBER')||0));
 var journal=table(s,'P15_INTAKE',['GUID','EP-ID','ROW','STATE','UTC','SOURCE','DETAIL']);
 var reservations=rows(journal,7),reserved={};reservations.forEach(function(r){reserved[norm(r[0])]=r;var m=str(r[1]).match(/^EP-(\d+)$/);if(m)inv.max=Math.max(inv.max,+m[1]);});
 var items=Object.keys(sources.byGuid).map(function(g){return sources.byGuid[g];}).filter(function(x){var time=Date.parse(x.published);return Number.isFinite(time)&&time>=since&&time<=Date.now();}).sort(function(a,b){return Date.parse(a.published)-Date.parse(b.published);});
 var added=0,held=0,counts={};
 for(var i=0;i<items.length&&added<10&&Date.now()<deadline-20000;i++){
  var x=items[i];if(inv.guids[x.guid])continue;
  if(inv.reservedGuids[x.guid]){held++;continue;}
  if(reserved[x.guid]){if(reserved[x.guid][3]==='RESERVED')throw Error('INTAKE_PENDING_RECONCILIATION');continue;}
  if(x.collision){held++;continue;}
  // Same show/title/date may be a reissued GUID: do not allocate a second EP-ID.
  var duplicate=inv.data.some(function(r){return r[1]===x.show&&str(r[2]).trim()===str(x.title).trim()&&Math.abs(new Date(r[3]).getTime()-Date.parse(x.published))<60000;});
  if(duplicate){recordHolds(s,{start:0,holds:[{row:0,id:'NEW:'+x.guid,why:'POSSIBLE_DUPLICATE_REVIEW'}]},[['',x.show,x.title,x.published,'','',x.guid]]);held++;continue;}
  var ep='EP-'+String(++inv.max).padStart(5,'0'),rn=inv.sh.getLastRow()+1;
  if(rn>inv.sh.getMaxRows())inv.sh.insertRowsAfter(inv.sh.getMaxRows(),1);
  var row=Array(55).fill('');row[0]=ep;row[1]=x.show;row[2]=x.title;row[3]=new Date(x.published);row[4]='音声';row[5]=/omnycontent/.test(x.source)?'Omny RSS':'Megaphone RSS';row[6]=x.guid;row[31]=new Date();row[32]=x.source;row[44]=x.source;
  var proposal=PHASE15_INTEGRATED.plan(row,x,{reviseW:false});
  if(proposal.holds.indexOf('SOURCE_IDENTITY_CONFLICT')>=0)throw Error('NEW_SOURCE_CONFLICT');
  if(proposal.holds.indexOf('SOURCE_TOO_LONG_FOR_CELL')>=0){held++;continue;}
  proposal.changes.forEach(function(c){row[c.col-1]=c.value;});
  var jr=journal.getLastRow()+1;put(journal,jr,[x.guid,ep,rn,'RESERVED',new Date().toISOString(),x.source,JSON.stringify(row)]);SpreadsheetApp.flush();
  // Persist reservation BEFORE writing; interrupted intake is never blindly reallocated.
  if(inv.sh.getRange(rn,1,1,55).getValues()[0].some(function(v){return v!=='';}))throw Error('APPEND_ROW_CHANGED');
  var dest=inv.sh.getRange(rn,1,1,55);
  if(dest.getFormulas()[0].some(Boolean)||dest.getDataValidations()[0].some(Boolean))throw Error('APPEND_ROW_PROTECTED');
  put(inv.sh,rn,row);SpreadsheetApp.flush();
  var actual=inv.sh.getRange(rn,1,1,55).getValues()[0];
  if(actual.some(function(v,j){return v instanceof Date&&row[j] instanceof Date?v.getTime()!==row[j].getTime():str(v)!==str(row[j]);}))throw Error('INTAKE_POSTWRITE_MISMATCH');
  put(journal,jr,[x.guid,ep,rn,'VERIFIED',new Date().toISOString(),x.source,JSON.stringify(row)]);
  p.setProperty('P15_MAX_EP_NUMBER',String(inv.max));
  inv.ids[ep]=rn;inv.guids[x.guid]=[rn];inv.data.push(row);added++;row.forEach(function(v,c){if(v!=='')counts[column(c+1)]=(counts[column(c+1)]||0)+1;});
  if(proposal.holds.length)recordHolds(s,{start:rn,holds:[{row:rn,id:ep,why:proposal.holds}]},[row]);
 }
 return {added:added,held:held,counts:counts};
});}
// Parse only a PodcastEpisode node whose identifier AND title match this GUID.
// This avoids importing show links or promotional links to a different episode.
function platformEvidence(html,source){
 var evidence=[],blocks=str(html).match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
 function visit(node){
  if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;
  if(node['@graph'])visit(node['@graph']);
  var types=[].concat(node['@type']||[]),ids=[].concat(node.identifier||[]).map(function(id){return norm(typeof id==='object'?id.value:id);});
  if(types.indexOf('PodcastEpisode')<0||ids.indexOf(norm(source.guid))<0||str(node.name).trim()!==str(source.title).trim())return;
  [].concat(node.sameAs||[]).forEach(function(url){if(typeof url==='string')evidence.push(url);});
 }
 blocks.forEach(function(block){try{visit(JSON.parse(block.replace(/^.*?>/s,'').replace(/<\/script>$/i,'')));}catch(e){}});
 return evidence;
}
function platformLinks(source,evidence){
 var out={};(evidence||[]).forEach(function(u){var service=P15_PLATFORMS.classify(u);if(!service)return;var col=service.col;if(out[col]&&out[col]!==u)out[col]=null;else if(out[col]!==null)out[col]=u;});
 Object.keys(out).forEach(function(c){if(!out[c])delete out[c];});return out;
}
function resolvePlatforms(source,options){return P15_PLATFORMS.resolve(source,options);}
function platformState(s){
 var header=['KEY','EP-ID','GUID','ROW','SERVICE','COLUMN','STATE','REASON','URL','EVIDENCE_URL','CHECKED_UTC','NEXT_UTC','METHOD','HTTP'];
 var t=table(s,'P15_PLATFORM_STATUS',header),all=rows(t,14),index={};all.forEach(function(r,i){index[r[0]]=i+2;});return {tab:t,all:all,index:index};
}
function platformSchedule(result){
 if(result.state==='REVIEW')return '';
 var delay=result.state==='DEFERRED'?15*60000:result.reason==='BUDGET_DEFERRED'?15*60000:/HTTP_429|HTTP_5|NETWORK_ERROR/.test(result.reason)?3600000:result.state==='VERIFIED'||result.state==='EXISTING_VERIFIED'?30*86400000:86400000;
 return new Date(Date.now()+delay).toISOString();
}
function savePlatformState(state,rn,row,result){
 var key=row[0]+'|'+norm(row[6])+'|'+result.service,at=state.index[key];
 if(result.state==='DEFERRED'&&at)return;
 var value=[key,row[0],row[6],rn,result.service,result.col,result.state,result.reason||'',result.url||'',result.evidence||'',new Date().toISOString(),platformSchedule(result),result.method||'',result.http||''];
 if(!at){at=state.tab.getLastRow()+1;state.index[key]=at;}put(state.tab,at,value);state.all[at-2]=value;
}
function platformOptions(s,state,row,context,config){
 var deferred={},existing={},references=[];
 P15_PLATFORMS.services.forEach(function(service){var key=row[0]+'|'+norm(row[6])+'|'+service.name,at=state.index[key],previous=at?state.all[at-2]:null;
  if(row[service.col-1])existing[service.col]=row[service.col-1];
  if(previous&&((previous[6]==='REVIEW')||(previous[11]&&Date.parse(previous[11])>Date.now()))&&str(previous[8])===str(row[service.col-1]||previous[8]))deferred[service.name]=previous[7]||previous[6];
 });
 (config.candidates||[]).forEach(function(r){if(r[0]===row[1]&&str(r[2]).indexOf(str(row[2]))>=0)references.push({guid:norm(row[6]),service:r[1],url:r[3]});});
 (config.references||[]).forEach(function(r){if(norm(r[0])===norm(row[6]))references.push({guid:norm(row[6]),service:r[1],url:r[2]});});
 return {context:context,existing:existing,references:references,directories:config.directories,deferred:deferred};
}
function discoverPlatforms(s,show,context){
 var catalog=s.getSheetByName('配信先URL'),directories=[];
 if(catalog){var h=catalog.getRange(1,1,1,4).getValues()[0];if(h[0]!=='番組'||h[2]!=='配信先'||h[3]!=='URL')throw Error('PLATFORM_DIRECTORY_SCHEMA');
  rows(catalog,9).forEach(function(r){if(r[0]===show&&P15_PLATFORMS.allowed(r[3])&&P15_PLATFORMS.services.some(function(x){return x.name===r[2];}))directories.push({show:r[0],service:r[2],url:r[3]});});}
 var candidateTab=table(s,'P15_PLATFORM_CANDIDATES',['SHOW','SERVICE','LABEL','URL','DISCOVERY_URL']),candidates=rows(candidateTab,5),seen={};candidates.forEach(function(r){seen[r[3]]=true;});
 var pages=table(s,'P15_PLATFORM_PAGES',['ROOT','NEXT_URL','CHECKED_UTC','NEXT_UTC']),pageRows=rows(pages,4),indices={};pageRows.forEach(function(r,i){indices[r[0]]=i+2;});
 directories.forEach(function(d){
  var at=indices[d.url],state=at?pageRows[at-2]:null;if(state&&Date.parse(state[3])>Date.now())return;
  var page=P15_PLATFORMS.fetchPage(state&&state[1]||d.url,context);if(page.reason){if(page.reason==='BUDGET_DEFERRED')return;put(pages,at||pages.getLastRow()+1,[d.url,state&&state[1]||d.url,new Date().toISOString(),new Date(Date.now()+3600000).toISOString()]);return;}
  P15_PLATFORMS.listingEntries(page.html,page.url,d.service).forEach(function(entry){if(seen[entry.url])return;seen[entry.url]=true;var r=[d.show,d.service,entry.label,entry.url,page.url];put(candidateTab,candidateTab.getLastRow()+1,r);candidates.push(r);});
  var next=P15_PLATFORMS.nextPage(page.html,page.url);if(next===page.url)next='';
  put(pages,at||pages.getLastRow()+1,[d.url,next,new Date().toISOString(),new Date(Date.now()+(next?15*60000:6*3600000)).toISOString()]);
 });
 var referenceTab=s.getSheetByName('P15_PLATFORM_REFERENCES');
 return {directories:directories,candidates:candidates,references:referenceTab?rows(referenceTab,4):[]};
}
function audioProbe(url){
 if(!/^https:\/\/(?:[^/]+\.)?(?:omnycontent\.com|megaphone\.fm|traffic\.megaphone\.fm)\//i.test(url))return {status:'UNVERIFIED_HOST',play:'未確認'};
 try{var r=UrlFetchApp.fetch(url,{headers:{Range:'bytes=0-2047'},muteHttpExceptions:true,followRedirects:false}),code=r.getResponseCode();
  if(code>=300&&code<400)return {status:'REDIRECT_NOT_VERIFIED',play:'未確認'};
  var headers=r.getHeaders(),type=str(headers['Content-Type']||headers['content-type']);
  // Transport evidence is not a decoder/playback test.
  return {status:(code===200||code===206)&&/^audio\//i.test(type)?'AUDIO_HTTP_'+code:'HTTP_'+code,play:'未確認'};
 }catch(e){return {status:'NETWORK_ERROR',play:'未確認'};}
}
function enrich(s,sources,deadline){return locked(function(){
 assertOwner(s);var p=props(),sh=s.getSheetByName('エピソード台帳'),start=Number(p.getProperty('P15_MEDIA_CURSOR')||2),count=0,counts={},services={};
 P15_PLATFORMS.services.forEach(function(x){services[x.name]={verified:0,unavailable:0,written:0,deferred:0,existing:0};});
 if(start>sh.getLastRow())start=2;
 var context={remaining:12,deadline:Math.min(deadline-5000,Date.now()+45000),cache:{}},state=platformState(s),configs={};
 for(var rn=start;rn<=sh.getLastRow()&&rn<start+20&&Date.now()<deadline-15000;rn++){
  var r=sh.getRange(rn,1,1,55).getValues()[0],x=sources.byGuid[norm(r[6])];
  if(PHASE15_INTEGRATED.humanExcluded(r[38])||/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(str(r[1]))){p.setProperty('P15_MEDIA_CURSOR',String(rn+1));continue;}
  if(x&&!x.collision&&x.show===r[1]){
   // Audio processing is independent of discovery/network/parse failures below.
   var audioChanges=[];
   if(x.audio&&r[14]===x.audio&&(r[17]===''||r[18]==='')){
    var probe=audioProbe(x.audio);if(r[17]==='')audioChanges.push({col:18,value:'URLあり／'+probe.status,why:'AUDIO_TRANSPORT_ONLY'});
    if(r[18]==='')audioChanges.push({col:19,value:probe.play,why:'PLAYBACK_NOT_DECODED'});
   }
   if(audioChanges.length){var w=PHASE15_INTEGRATED.writeRow(s,sh,rn,r,audioChanges,x.source);if(w.ok)audioChanges.forEach(function(c){count++;counts[column(c.col)]=(counts[column(c.col)]||0)+1;r[c.col-1]=c.value;});}
   var report;
   try{
    if(!configs[r[1]])configs[r[1]]=discoverPlatforms(s,r[1],context);
    report=resolvePlatforms(x,platformOptions(s,state,r,context,configs[r[1]]));
   }catch(e){report={links:{},results:P15_PLATFORMS.services.map(function(service){return {service:service.name,col:service.col,state:'UNAVAILABLE',reason:'PLATFORM_ADAPTER_ERROR'};})};}
   report.results.forEach(function(result){
    var stats=services[result.service];
    if(result.state==='VERIFIED'||result.state==='EXISTING_VERIFIED')stats.verified++;
    else if(result.state==='DEFERRED'||result.reason==='BUDGET_DEFERRED')stats.deferred++;else stats.unavailable++;
    if(result.state==='EXISTING_VERIFIED')stats.existing++;
    var url=report.links[result.col];
    if(url&&r[result.col-1]===''){
     // A protected URL cell does not block other URL columns or audio.
     var outcome=PHASE15_INTEGRATED.writeRow(s,sh,rn,r,[{col:result.col,value:url,why:'PLATFORM_'+result.service+'_'+result.method}],result.evidence||url);
     if(outcome.ok){r[result.col-1]=url;count++;stats.written++;counts[column(result.col)]=(counts[column(result.col)]||0)+1;}
     else{result.state='REVIEW';result.reason=outcome.why;}
    }
    savePlatformState(state,rn,r,result);
   });
  }else{
   P15_PLATFORMS.services.forEach(function(service){services[service.name].unavailable++;savePlatformState(state,rn,r,{service:service.name,col:service.col,state:'UNAVAILABLE',reason:x?'SOURCE_IDENTITY_CONFLICT':'OFFICIAL_SOURCE_UNAVAILABLE'});});
  }
  p.setProperty('P15_MEDIA_CURSOR',String(rn+1));
  if(context.remaining<=0)break;
 }
 return {cells:count,counts:counts,platforms:services};
});}
function retry(s,sources,deadline){
 var t=s.getSheetByName('P15_RETRY');if(!t)return {checked:0,resolved:0};
 var all=rows(t,9),seen={},checked=0,resolved=0;
 for(var i=0;i<all.length&&checked<5&&Date.now()<deadline-25000;i++){
  var rec=all[i];if(rec[5]!=='RETRY'||Date.parse(rec[7])>Date.now()||seen[rec[1]])continue;seen[rec[1]]=true;
  var sh=s.getSheetByName('エピソード台帳'),rn=+rec[3],live=sh.getRange(rn,1,1,7).getValues()[0];
  if(str(live[0])!==str(rec[1])||norm(live[6])!==norm(rec[2])){rec[5]='REVIEW';rec[4]='RETRY_IDENTITY_CHANGED';put(t,i+2,rec);continue;}
  checked++;
  var result=PHASE15_INTEGRATED.run({target:'PROD',startRow:rn,limit:1,write:true,prodApproved:true,preserveCursor:true,sources:sources,deadline:deadline});
  var reasons=[];result.holds.forEach(function(h){reasons=reasons.concat(h.why||h.reason);});
  all.forEach(function(r,j){if(r[1]!==rec[1]||r[2]!==rec[2]||r[5]!=='RETRY')return;
   r[6]=+r[6]+1;r[8]=new Date().toISOString();
   if(result.processed===1&&reasons.indexOf(r[4])<0){r[5]='RESOLVED';r[7]='';resolved++;}
   else{var next=retryPolicy(r[4],r[6],Date.now());r[5]=next.state;r[7]=next.next;}put(t,j+2,r);
  });
 }
 return {checked:checked,resolved:resolved};
}
function deferred(s){
 var t=s.getSheetByName('P15_RETRY'),out={};if(!t)return out;
 rows(t,9).forEach(function(r){if(r[5]==='REVIEW'||r[5]==='EXHAUSTED'||r[5]==='EXCLUDED'||(r[5]==='RETRY'&&Date.parse(r[7])>Date.now())){var g=norm(r[2]);if(g){out[g]=out[g]||[];out[g].push(r[4]);}}});return out;
}
function tick(){
 var p=props(),now=Date.now(),deadline=now+240000;
 // Claim a whole-tick lease under ScriptLock. Each stage also uses ScriptLock.
 var acquired=locked(function(){if(Number(p.getProperty('P15_TICK_UNTIL')||0)>now)return false;p.setProperty('P15_TICK_UNTIL',String(now+600000));return true;});
 if(!acquired)return {status:'BUSY'};
 var result={version:VERSION,started:new Date(now).toISOString(),processed:0,counts:{},json:0,rss:0,intake:0,media:0};
 try{
  var s=ss();assertOwner(s);if(pending(s))throw Error('PENDING_WRITE_REQUIRES_RECONCILIATION');
  var sources=PHASE15_INTEGRATED.fetchSources(s,deadline);result.rss=sources.log.filter(function(x){return x.status==='OK';}).length;
  if(!result.rss)throw Error('ALL_SOURCES_UNAVAILABLE');
  // Alternate priority so slow feeds/intake cannot permanently starve patrol.
  var phase=p.getProperty('P15_NEXT_PHASE')||'INGEST';p.setProperty('P15_NEXT_PHASE',phase==='INGEST'?'PATROL':'INGEST');
  if(phase==='INGEST'&&Date.now()<deadline-30000)result.intake=intake(s,sources,deadline);
  if(Date.now()<deadline-30000)result.retry=retry(s,sources,deadline);
  var batches=Math.min(5,Math.max(1,Number(p.getProperty('P15_BATCHES_PER_TICK')||1)));
  for(var b=0;b<batches&&Date.now()<deadline-30000;b++){
   var out=PHASE15_INTEGRATED.run({target:'PROD',limit:100,write:true,prodApproved:true,reviseW:p.getProperty('P15_W_REVISION_APPROVED')==='YES',deferred:deferred(s),sources:sources,deadline:deadline-50000});
   result.processed+=out.processed;result.next=out.next;result.json+=out.officialJsonVerified;
   Object.keys(out.counts).forEach(function(k){result.counts[k]=(result.counts[k]||0)+out.counts[k];});
   if(out.processed<100||out.next>s.getSheetByName('エピソード台帳').getLastRow())break;
  }
  if(Date.now()<deadline-20000)result.media=enrich(s,sources,deadline);
  result.status='OK';
 }catch(e){
  result.error=str(e).slice(0,200);
  if(/ALL_SOURCES_UNAVAILABLE|WRITER_BUSY|Service invoked too many times/.test(result.error))result.status='RETRY_NEXT_TICK';
  else{fatal(e);result.status='HALTED';}
 }finally{
  result.elapsedMs=Date.now()-now;p.setProperty('P15_LAST_RUN',JSON.stringify(result));p.deleteProperty('P15_TICK_UNTIL');
  if(s&&s.getSheetByName('P15_OWNER')&&s.getSheetByName('P15_OWNER').getRange(2,1).getValue()===ScriptApp.getScriptId()){
   try{table(s,'P15_RUNS',['UTC','STATUS','ROWS','NEXT','RSS_OK','JSON_OK','COUNTS','INTAKE','MEDIA','ERROR']).appendRow([result.started,result.status,result.processed,result.next||'',result.rss,result.json,JSON.stringify(result.counts),JSON.stringify(result.intake),JSON.stringify(result.media),result.error||'']);}catch(logError){p.setProperty('P15_RUN_LOG_ERROR',str(logError).slice(0,150));}
  }
  console.log(JSON.stringify(result));
 }
 return result;
}
function preflight(){
 var s=ss(),p=props(),sh=s.getSheetByName('エピソード台帳');
 var header=sh.getRange(1,1,1,55).getValues()[0],expected={0:'台帳ID',6:'外部ID',21:'概要原文',22:'概要清掃済み',38:'人間除外',50:'出演者確認根拠'};
 Object.keys(expected).forEach(function(c){if(header[c]!==expected[c])throw Error('SCHEMA_MISMATCH_'+c);});
 var smoke=p15iParserSmokeTests();if(smoke.some(function(t){return !t.ok;}))throw Error('PARSER_TEST_FAILED');
 var inv=inventory(s),sources=PHASE15_INTEGRATED.fetchSources(s,Date.now()+180000);
 var result={version:VERSION,scriptId:ScriptApp.getScriptId(),savedCursor:p.getProperty('P15I_CURSOR_PROD'),rows:inv.data.length,maxAllocatedId:inv.max,pendingWrites:pending(s),feeds:sources.log,tests:smoke,triggers:ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction();}),writes:0};
 console.log(JSON.stringify(result));return result;
}
return {tick:tick,preflight:preflight,assertOwner:assertOwner,recordHolds:recordHolds,retryPolicy:retryPolicy,platformLinks:platformLinks,platformEvidence:platformEvidence,audioProbe:audioProbe,intake:intake,inventory:inventory,migrateLegacy:migrateLegacy,enrich:enrich,version:VERSION};
})();
function p15AutonomousTick(){return P15_AUTO.tick();}
function p15AutonomousPreflight(){return P15_AUTO.preflight();}
/** Explicit operator setup, NOT called by tick. No trigger is installed here. */
function p15AutonomousEnable(){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('P15_OTHER_WRITERS_PAUSED')!=='YES'||!p.getProperty('P15_WRITER_REVIEW_NOTE'))throw Error('REVIEW_OLD_WRITERS_FIRST');
 if(p.getProperty('P15_INITIAL_CURSOR_CONFIRMED')!=='YES'||!/^\d+$/.test(p.getProperty('P15_MAX_EP_NUMBER')||''))throw Error('CONFIRM_SAVED_CURSOR_FIRST');
 if(!Number.isFinite(Date.parse(p.getProperty('P15_INGEST_SINCE')||'')))throw Error('SET_INGEST_SINCE_FIRST');
 var check=p15AutonomousPreflight();if(check.pendingWrites||!check.feeds.some(function(f){return f.status==='OK';}))throw Error('PREFLIGHT_NOT_READY');
 var s=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),t=s.getSheetByName('P15_OWNER');
 if(t&&t.getLastRow()>1&&t.getRange(2,1).getValue()!==ScriptApp.getScriptId())throw Error('OTHER_OWNER_PRESENT');
 if(!t){t=s.insertSheet('P15_OWNER');t.appendRow(['SCRIPT_ID','VERSION','ACTIVATED_UTC']);}
 t.getRange(2,1,1,3).setValues([[ScriptApp.getScriptId(),P15_AUTO.version,new Date().toISOString()]]);
 p.setProperties({P15_OWNER_SCRIPT_ID:ScriptApp.getScriptId(),P15_WRITES_ENABLED:'YES',P15_PRODUCTION_APPROVED:'YES'});
 var migrated=P15_AUTO.migrateLegacy(s);
 return {enabled:true,triggerInstalled:false,legacy:migrated};
}
function p15AutonomousInstallTrigger(){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('P15_TRIGGER_APPROVED')!=='YES')throw Error('EXPLICIT_TRIGGER_APPROVAL_REQUIRED');
 P15_AUTO.assertOwner(SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'));
 var last=JSON.parse(p.getProperty('P15_LAST_RUN')||'{}');if(last.version!==P15_AUTO.version||last.status!=='OK'||last.processed<1)throw Error('SUCCESSFUL_LIVE_PILOT_REQUIRED');
 var mine=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='p15AutonomousTick';});
 if(mine.length>1)throw Error('DUPLICATE_TRIGGER');
 if(!mine.length)ScriptApp.newTrigger('p15AutonomousTick').timeBased().everyMinutes(15).create();
 return {handler:'p15AutonomousTick',minutes:15,alreadyPresent:mine.length===1};
}
function p15AutonomousPause(){PropertiesService.getScriptProperties().setProperty('P15_HALT','OPERATOR_PAUSE');}
/** Read-only recovery report. Does not clear HALT or mutate ledger/audit. */
function p15AutonomousRecoveryReport(){
 var s=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'),sh=s.getSheetByName('エピソード台帳'),out=[];
 var a=s.getSheetByName('P15I_AUDIT');
 if(a&&a.getLastRow()>1)a.getRange(2,1,a.getLastRow()-1,10).getValues().forEach(function(r,i){
  if(!/^(?:PENDING|ROLLBACK_PENDING)$/.test(r[1]))return;var live=sh.getRange(+r[2],1,1,55).getValues()[0],identity=String(live[0])===String(r[3])&&String(live[6]).toLowerCase()===String(r[4]).toLowerCase();
  out.push({originalState:r[1],auditRow:i+2,row:r[2],column:r[6],status:!identity?'IDENTITY_CHANGED':String(live[+r[6]-1])===String(r[8])?'AFTER_MATCH':String(live[+r[6]-1])===String(r[7])?'BEFORE_MATCH':'DIVERGED'});
 });
 var t=s.getSheetByName('P15_INTAKE');
 if(t&&t.getLastRow()>1)t.getRange(2,1,t.getLastRow()-1,7).getValues().forEach(function(r,i){if(r[3]==='RESERVED')out.push({intakeRow:i+2,row:r[2],id:r[1],status:'RESERVED_REVIEW_SNAPSHOT'});});
 console.log(JSON.stringify(out));return out;
}
/** Explicit recovery only: reconcile pending cells already equal to BEFORE/AFTER.
 * Does NOT rewrite any ledger value. Divergence keeps the entire robot halted.
 * A fresh successful preflight and operator resume are required afterwards.
 */
function p15AutonomousReconcilePending(){
 var p=PropertiesService.getScriptProperties();if(p.getProperty('P15_RECOVERY_APPROVED')!=='YES'||!p.getProperty('P15_HALT'))throw Error('RECOVERY_APPROVAL_AND_HALT_REQUIRED');
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('WRITER_BUSY');
 try{
  var s=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  if(!s.getSheetByName('P15_OWNER')||s.getSheetByName('P15_OWNER').getRange(2,1).getValue()!==ScriptApp.getScriptId())throw Error('OWNER_MISMATCH');
  var report=p15AutonomousRecoveryReport();if(report.some(function(r){return r.status!=='AFTER_MATCH'&&r.status!=='BEFORE_MATCH';}))throw Error('MANUAL_DIVERGENCE_REVIEW_REQUIRED');
  var audit=s.getSheetByName('P15I_AUDIT');report.forEach(function(r){audit.getRange(r.auditRow,2).setValue(r.status==='AFTER_MATCH'?'VERIFIED':r.originalState==='ROLLBACK_PENDING'?'ROLLED_BACK':'NOT_APPLIED');});
  p.deleteProperty('P15_RECOVERY_APPROVED');return {reconciled:report.length,haltRetained:true};
 }finally{lock.releaseLock();}
}
/** Explicit resume never changes write gates, ownership or unrelated triggers. */
function p15AutonomousResume(){
 var p=PropertiesService.getScriptProperties();if(p.getProperty('P15_RESUME_APPROVED')!=='YES')throw Error('RESUME_APPROVAL_REQUIRED');
 var result=p15AutonomousPreflight();if(result.pendingWrites)throw Error('PENDING_WRITE_REMAINS');
 p.deleteProperty('P15_HALT');p.deleteProperty('P15_RESUME_APPROVED');return {resumed:true};
}
/** Restore ONE audited cell only when it still equals this engine's AFTER value.
 * Requires paused robot and explicit audit-row approval. Never deletes a ledger row.
 */
function p15AutonomousRollbackOneCell(){
 var p=PropertiesService.getScriptProperties(),n=Number(p.getProperty('P15_ROLLBACK_AUDIT_ROW'));
 if(!p.getProperty('P15_HALT')||p.getProperty('P15_RECOVERY_APPROVED')!=='YES'||!Number.isInteger(n)||n<2)throw Error('ROLLBACK_APPROVAL_REQUIRED');
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('WRITER_BUSY');
 try{
  var s=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  if(s.getSheetByName('P15_OWNER').getRange(2,1).getValue()!==ScriptApp.getScriptId())throw Error('OWNER_MISMATCH');
  var a=s.getSheetByName('P15I_AUDIT'),r=a.getRange(n,1,1,10).getValues()[0],sh=s.getSheetByName('エピソード台帳');
  if(r[1]!=='VERIFIED'&&r[1]!=='PENDING')throw Error('AUDIT_NOT_ROLLBACK_ELIGIBLE');
  var live=sh.getRange(+r[2],1,1,55).getValues()[0],cell=sh.getRange(+r[2],+r[6]);
  if(String(live[0])!==String(r[3])||String(live[6]).toLowerCase()!==String(r[4]).toLowerCase()||String(live[+r[6]-1])!==String(r[8])||cell.getFormula())throw Error('ROLLBACK_CONFLICT');
  a.getRange(n,2).setValue('ROLLBACK_PENDING');SpreadsheetApp.flush();
  var before=r[7];if(+r[6]===16&&before!=='')before=Number(before);
  cell.setValue(typeof before==='string'&&/^[=+@-]/.test(before)?"'"+before:before);SpreadsheetApp.flush();
  if(String(cell.getValue())!==String(r[7]))throw Error('ROLLBACK_READBACK_FAILED');
  a.getRange(n,2).setValue('ROLLED_BACK');p.deleteProperty('P15_RECOVERY_APPROVED');p.deleteProperty('P15_ROLLBACK_AUDIT_ROW');
  return {restoredCells:1,auditRow:n,haltRetained:true};
 }finally{lock.releaseLock();}
}
/** Six-provider resolver inside the SAME integrated project/bundle.
 * Provider pages are read-only data. No page script is executed.
 */
var P15_PLATFORMS=(function(){
'use strict';
var SERVICES=[{name:'LISTEN',col:11},{name:'Spotify',col:12},{name:'Apple Podcasts',col:13},{name:'Amazon Music',col:41},{name:'Pocket Casts',col:42},{name:'Pody',col:43}];
function text(v){return v==null?'':String(v);}
function decode(s){return text(s).replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,function(x){var m={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};if(m[x])return m[x];var n=parseInt(x.slice(x[2].toLowerCase()==='x'?3:2,-1),x[2].toLowerCase()==='x'?16:10);return Number.isFinite(n)&&n<=1114111?String.fromCodePoint(n):x;});}
function plain(s){return decode(text(s).replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim();}
function attrs(tag){var out={},m,re=/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;while((m=re.exec(tag)))out[m[1].toLowerCase()]=decode(m[2]===undefined?(m[3]===undefined?m[4]:m[3]):m[2]);return out;}
function meta(html,key){var tags=text(html).match(/<meta\b[^>]*>/gi)||[];for(var i=0;i<tags.length;i++){var a=attrs(tags[i]);if(a.name===key||a.property===key)return a.content||'';}return '';}
function host(url){var m=text(url).match(/^https:\/\/([^/?#]+)(?:[/?#]|$)/i);return m?m[1].toLowerCase():'';}
function allowed(url){return /^(?:listen\.style|pody\.jp|open\.spotify\.com|podcasts\.apple\.com|pca\.st|pocketcasts\.com|music\.amazon\.(?:com|co\.jp|co\.uk|in|de|fr|it|es|ca|com\.au))$/.test(host(url));}
function classify(url){
 url=text(url);if(!allowed(url)||/[\s<>"'\\]/.test(url))return null;
 var p=url.replace(/^https:\/\/[^/]+/,'').split(/[?#]/)[0],h=host(url);
 if(h==='listen.style'&&/^\/p\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(p))return SERVICES[0];
 if(h==='open.spotify.com'&&/^\/(?:intl-[a-z]+\/)?episode\/[A-Za-z0-9]+\/?$/.test(p))return SERVICES[1];
 if(h==='podcasts.apple.com'&&/^\/[^/]+\/podcast\/(?:[^/]+\/)?id\d+\/?$/.test(p)&&/[?&]i=\d+(?:&|$)/.test(url))return SERVICES[2];
 if(/^music\.amazon\./.test(h)&&/^\/podcasts\/[^/]+\/episodes\/[^/]+(?:\/[^/]+)?\/?$/.test(p))return SERVICES[3];
 if((h==='pca.st'&&/^\/episode\/[0-9a-f-]{36}\/?$/i.test(p))||(h==='pocketcasts.com'&&/^\/podcast\/[^/]+\/[0-9a-f-]{36}\/[^/]+\/[0-9a-f-]{36}\/?$/i.test(p)))return SERVICES[4];
 if(h==='pody.jp'&&/^\/player\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(p))return SERVICES[5];
 return null;
}
function key(url){var c=classify(url);if(!c)return '';var p=url.split(/[?#]/)[0].replace(/\/$/,'');if(c.col===13)return 'Apple:'+((url.match(/[?&]i=(\d+)/)||[])[1]);return c.col+':'+p.split('/').pop();}
function absolute(url,base){url=decode(url);if(/^https:\/\//.test(url))return url;if(url[0]==='/'&&url[1]!=='/')return 'https://'+host(base)+url;if(url[0]==='?')return base.split('?')[0]+url;return '';}
function fetchPage(url,ctx){
 ctx=ctx||{};ctx.cache=ctx.cache||{};if(ctx.cache[url])return ctx.cache[url];
 if(!allowed(url))return {reason:'UNTRUSTED_HOST',url:url};
 if((ctx.remaining!==undefined&&ctx.remaining<=0)||(ctx.deadline&&Date.now()>ctx.deadline-5000))return {reason:'BUDGET_DEFERRED',url:url};
 var original=url;
 for(var n=0;n<4;n++){
  if(!allowed(url))return {reason:'UNTRUSTED_REDIRECT',url:original};
  if((ctx.remaining!==undefined&&ctx.remaining<=0)||(ctx.deadline&&Date.now()>ctx.deadline-5000))return {reason:'BUDGET_DEFERRED',url:original};
  if(ctx.remaining!==undefined)ctx.remaining--;
  try{
   var r=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false}),code=r.getResponseCode();
   if(code>=300&&code<400){var headers=r.getHeaders();url=absolute(headers.Location||headers.location||'',url);continue;}
   var result=code===200?{url:url,html:r.getContentText('UTF-8'),http:code}:{url:url,http:code,reason:'HTTP_'+code};
   ctx.cache[original]=result;return result;
  }catch(e){return {url:original,reason:'NETWORK_ERROR'};}
 }
 return {url:original,reason:'REDIRECT_LIMIT'};
}
function jsonScripts(html,type){var result=[],re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,m;while((m=re.exec(html))){var a=attrs(m[1]);if(a.type!==type)continue;try{result.push(JSON.parse(m[2]));}catch(e){}}return result;}
function walk(value,fn,depth){depth=depth||0;if(depth>24||!value||typeof value!=='object')return;fn(value);Object.keys(value).forEach(function(k){if(k!=='__proto__')walk(value[k],fn,depth+1);});}
function audioGuid(url){var m=text(url).match(/^https:\/\/(?:traffic\.omny\.fm|www\.omnycontent\.com)\/d\/clips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/([0-9a-f-]{36})\/audio\.[a-z0-9]+(?:[?#]|$)/i);return m?m[1].toLowerCase():'';}
function audioIdentity(url,source){return !!url&&(audioGuid(url)===text(source.guid).toLowerCase()||url.split('?')[0]===text(source.audio).split('?')[0]);}
function match(record,source){
 if(plain(record.title)!==plain(source.title))return {ok:false,reason:'TITLE_MISMATCH'};
 var exactGuid=record.guid&&text(record.guid).toLowerCase()===text(source.guid).toLowerCase();
 if(record.guid&&!exactGuid)return {ok:false,reason:'GUID_MISMATCH'};
 var audio=audioIdentity(record.audio,source),date=Date.parse(record.published),expected=Date.parse(source.published);
 if(record.published&&(!Number.isFinite(date)||!Number.isFinite(expected)||Math.abs(date-expected)>60000))return {ok:false,reason:'DATE_MISMATCH'};
 if(exactGuid||audio)return {ok:true,method:exactGuid?'GUID_TITLE_DATE':'AUDIO_GUID_TITLE'};
 if(record.show===source.show&&Number.isFinite(date)&&Number.isFinite(expected)&&Math.abs(date-expected)<=60000&&Number(source.duration)>0&&Math.abs(Number(record.duration)-Number(source.duration))<=2)return {ok:true,method:'SHOW_TITLE_TIMESTAMP_DURATION'};
 return {ok:false,reason:'INSUFFICIENT_IDENTITY'};
}
function routerData(html){
 var out=[],re=/streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g,m;
 while((m=re.exec(html))){try{
  var a=JSON.parse(JSON.parse(m[1]));if(!Array.isArray(a)||a.length>50000)continue;var cache={};
  function read(i,depth){if(depth>35||i<0)return null;if(cache[i]!==undefined)return cache[i];var v=a[i];if(v===null||typeof v!=='object')return v;
   var obj=Array.isArray(v)?[]:{};cache[i]=obj;Object.keys(v).forEach(function(k){var name=Array.isArray(v)?k:a[Number(k.slice(1))];if(name==='__proto__'||name==='constructor'||name==='prototype')return;obj[name]=read(v[k],depth+1);});return obj;}
  out.push(read(0,0));
 }catch(e){}}return out;
}
function parsePage(html,url,source){
 var service=classify(url);if(!service)return {ok:false,reason:'NOT_EPISODE_URL'};
 var records=[],ld=jsonScripts(html,'application/ld+json');
 if(service.name==='Pody')ld.forEach(function(root){walk(root,function(n){if(n['@type']==='Article'&&n.isBasedOn&&n.isBasedOn['@type']==='PodcastEpisode'&&key(n.url)===key(url)){var e=n.isBasedOn;records.push({title:e.name,published:n.datePublished,audio:(e.associatedMedia||{}).contentUrl,show:(e.partOfSeries||{}).name});}});});
 else if(service.name==='Apple Podcasts')jsonScripts(html,'application/json').forEach(function(root){walk(root,function(n){if(n.guid&&n.title&&n.storeUrl&&key(n.storeUrl)===key(url))records.push({guid:n.guid,title:n.title,published:n.releaseDate,audio:(n.mediaEnclosures&&n.mediaEnclosures[0]||{}).streamUrl});});});
 else if(service.name==='Pocket Casts')routerData(html).forEach(function(root){walk(root,function(n){if(n.uuid&&n.title&&n.published&&text(n.uuid)===url.split(/[?#]/)[0].split('/').pop())records.push({title:n.title,published:n.published,audio:n.url});});});
 else if(service.name==='LISTEN'){
  var title=meta(html,'og:title'),suffix=' - '+source.show,audios=[],re=/\bconst\s+audioUrl\s*=\s*['"]([^'"]+)['"]/g,m;
  while((m=re.exec(html)))audios.push(decode(m[1]));
  if(title.endsWith(suffix)&&audios.length===1)records.push({title:title.slice(0,-suffix.length),audio:audios[0]});
 }
 else ld.forEach(function(root){walk(root,function(n){if([].concat(n['@type']||[]).indexOf('PodcastEpisode')<0||key(n.url||n['@id'])!==key(url))return;
  var id=typeof n.identifier==='object'?n.identifier.value:n.identifier;
  var r={guid:id,title:n.name,published:n.datePublished,audio:(n.associatedMedia||{}).contentUrl,show:(n.partOfSeries||{}).name};
  if(service.name==='Spotify'){r.published=meta(html,'music:release_date');r.duration=meta(html,'music:duration');r.show=(text(n.description).match(/^Listen to this episode from (.+?) on Spotify\./)||[])[1];}
  records.push(r);
 });});
 if(!records.length)return {ok:false,reason:'EPISODE_METADATA_UNAVAILABLE'};
 var verified=records.map(function(r){return match(r,source);});
 // Conflicting identities in the same page cannot be accepted by choosing one.
 if(verified.some(function(v){return !v.ok;}))return verified.filter(function(v){return !v.ok;})[0];
 return {ok:true,method:verified[0].method,url:url,service:service.name,col:service.col};
}
function candidates(html,base,source,service){
 var out=[],seen={},re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,m;
 while((m=re.exec(html))){var a=attrs(m[1]),url=absolute(a.href||'',base),c=classify(url),label=plain(m[2]);if(!c||c.name!==service||seen[url])continue;
  if(plain(source.title)===label||label.indexOf(plain(source.title))>=0){seen[url]=true;out.push(url);}
 }
 // Apple/server JSON and explicit JSON-LD listing entries; title binding is mandatory.
 jsonScripts(html,'application/json').concat(jsonScripts(html,'application/ld+json')).forEach(function(root){walk(root,function(n){var title=n.title||n.name,url=n.storeUrl||n.url;if(plain(title)!==plain(source.title)||typeof url!=='string')return;var c=classify(url);if(c&&c.name===service&&!seen[url]){seen[url]=true;out.push(url);}});});
 return out.slice(0,3);
}
function listingEntries(html,base,service){
 var out=[],seen={},re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,m;
 while((m=re.exec(html))){var a=attrs(m[1]),u=absolute(a.href||'',base),c=classify(u);if(c&&c.name===service&&!seen[u]){seen[u]=true;out.push({url:u,label:plain(a.title||m[2]).slice(0,1000)});}}
 jsonScripts(html,'application/json').concat(jsonScripts(html,'application/ld+json')).forEach(function(root){walk(root,function(n){var u=n.storeUrl||n.url,c=typeof u==='string'?classify(u):null;if(c&&c.name===service&&!seen[u]&&(n.title||n.name)){seen[u]=true;out.push({url:u,label:plain(n.title||n.name).slice(0,1000)});}});});return out.slice(0,200);
}
function nextPage(html,base){var re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,m;while((m=re.exec(html))){var a=attrs(m[1]);if(a.rel==='next'||/^(?:Next|次へ|次のページ|次)$/i.test(plain(m[2]))){var u=absolute(a.href||'',base);if(host(u)===host(base)&&!classify(u))return u;}}return '';}
function resolve(source,options){
 options=options||{};var ctx=options.context||{remaining:12,deadline:Date.now()+45000},out={links:{},results:[]};
 SERVICES.forEach(function(service){
  var existing=(options.existing||{})[service.col],defer=(options.deferred||{})[service.name];
  if(defer){out.results.push({service:service.name,col:service.col,state:'DEFERRED',reason:defer});return;}
  var urls=[],reason='NO_CANDIDATE',evidence='',pageInfo;
  if(existing){if(!classify(existing)||classify(existing).name!==service.name){out.results.push({service:service.name,col:service.col,state:'REVIEW',reason:'EXISTING_NOT_EPISODE_URL',url:existing});return;}urls.push(existing);}
  (options.references||[]).forEach(function(r){if(r.guid===source.guid&&r.service===service.name)urls.push(r.url);});
  var directory=(options.directories||[]).filter(function(r){return r.show===source.show&&r.service===service.name&&allowed(r.url);})[0];
  if(!urls.length&&directory){
   var listing=fetchPage(directory.url,ctx);pageInfo=listing;
   if(listing.reason)reason=listing.reason;else{urls=candidates(listing.html,listing.url,source,service.name);reason=urls.length?'':'NO_MATCH_IN_DISCOVERED_PAGE';evidence=listing.url;out.next=out.next||{};out.next[directory.url]=nextPage(listing.html,listing.url);}
  }else if(!urls.length&&!directory)reason='NO_DISCOVERY_SOURCE';
  var good=[],failure;
  Array.from(new Set(urls)).slice(0,3).forEach(function(url){
   var kind=classify(url);if(!kind||kind.name!==service.name){failure={reason:'NOT_EPISODE_URL',url:url};return;}
   var page=fetchPage(url,ctx);if(page.reason){failure=page;return;}if(!classify(page.url)||classify(page.url).name!==service.name){failure={reason:'WRONG_PROVIDER_REDIRECT',url:page.url};return;}var result=parsePage(page.html,page.url,source);if(result.ok)good.push(result);else failure={reason:result.reason,url:page.url,http:page.http};
  });
  var unique={};good.forEach(function(g){unique[key(g.url)]=g;});good=Object.keys(unique).map(function(k){return unique[k];});
  if(good.length===1&&!failure){var g=good[0];if(!existing)out.links[g.col]=g.url;out.results.push({service:service.name,col:service.col,state:existing?'EXISTING_VERIFIED':'VERIFIED',reason:'',url:g.url,evidence:evidence||g.url,method:g.method,http:200});}
  else{reason=good.length>1?'AMBIGUOUS_EPISODE_MATCH':failure?failure.reason:reason;out.results.push({service:service.name,col:service.col,state:/MISMATCH|AMBIGUOUS|NOT_EPISODE|WRONG_PROVIDER|INSUFFICIENT/.test(reason)?'REVIEW':'UNAVAILABLE',reason:reason||'NO_CANDIDATE',url:failure?failure.url:'',evidence:evidence,http:failure?failure.http:pageInfo?pageInfo.http:''});}
 });return out;
}
return {services:SERVICES,listingEntries:listingEntries,classify:classify,parsePage:parsePage,resolve:resolve,candidates:candidates,match:match,fetchPage:fetchPage,allowed:allowed,nextPage:nextPage};
})();
