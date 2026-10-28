/** Standalone GAS scheduler. Load alongside Phase15IntegratedProductionEngine.gs.
 * No ChatGPT, external worker, web app, npm, or OAuth secret dependency.
 * Dedicated project recommended; never replace unrelated scripts/triggers.
 */
var P15_AUTO=(function(){
'use strict';
var ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',VERSION='p15-auto-20261028.1';
var H=['KEY','EP-ID','GUID','ROW','REASON','STATE','ATTEMPTS','NEXT_UTC','LAST_UTC'];
function props(){return PropertiesService.getScriptProperties();}
function str(x){return x==null?'':String(x);}
function column(n){var a='';while(n){n--;a=String.fromCharCode(65+n%26)+a;n=Math.floor(n/26);}return a;}
function norm(x){return str(x).trim().toLowerCase();}
function ss(){return SpreadsheetApp.openById(ID);}
function table(s,name,headers){var t=s.getSheetByName(name);if(!t){t=s.insertSheet(name);t.appendRow(headers);}return t;}
function rows(t,n){return t.getLastRow()>1?t.getRange(2,1,t.getLastRow()-1,n).getValues():[];}
function put(t,r,values){t.getRange(r,1,1,values.length).setValues([values.map(function(x){return typeof x==='string'&&/^[=+@-]/.test(x)?"'"+x:x;})]);}
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
 var out={};(evidence||[]).forEach(function(u){var col=0;
  if(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?episode\/[A-Za-z0-9]+(?:[?#]|$)/.test(u))col=12;
  if(/^https:\/\/podcasts\.apple\.com\/[^\s]*[?&]i=\d+(?:&|$)/.test(u))col=13;
  if(/^https:\/\/music\.amazon\.[a-z.]+\/podcasts\/[^/]+\/episodes\/[^/?#]+/.test(u))col=41;
  if(/^https:\/\/(?:pca\.st\/[a-zA-Z0-9]+|pocketcasts\.com\/podcasts\/[^/]+\/[^/]+\/[^/]+)(?:[?#]|$)/.test(u))col=42;
  if(col){if(out[col]&&out[col]!==u)out[col]=null;else if(out[col]!==null)out[col]=u;}
 });Object.keys(out).forEach(function(c){if(!out[c])delete out[c];});return out;
}
function resolvePlatforms(source){
 if(!/^https:\/\/(?:omny\.fm\/shows\/|(?:www\.|www\.asahi\.)?asahi\.com\/)/i.test(str(source.link)))return {};
 try{var response=UrlFetchApp.fetch(source.link,{muteHttpExceptions:true,followRedirects:false});if(response.getResponseCode()!==200)return {};
  return platformLinks(source,platformEvidence(response.getContentText('UTF-8'),source));
 }catch(e){return {};}
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
 assertOwner(s);var p=props(),sh=s.getSheetByName('エピソード台帳'),start=Number(p.getProperty('P15_MEDIA_CURSOR')||2),count=0,counts={};
 if(start>sh.getLastRow())start=2;
 for(var rn=start;rn<=sh.getLastRow()&&rn<start+20&&Date.now()<deadline-20000;rn++){
  var r=sh.getRange(rn,1,1,55).getValues()[0],x=sources.byGuid[norm(r[6])];
  if(x&&!x.collision&&x.show===r[1]&&!PHASE15_INTEGRATED.humanExcluded(r[38])){
   var changes=[],links=resolvePlatforms(x);Object.keys(links).forEach(function(c){if(r[+c-1]==='')changes.push({col:+c,value:links[c],why:'OFFICIAL_GUID_BOUND_EPISODE_LINK'});});
   if(x.audio&&r[14]===x.audio&&(r[17]===''||r[18]==='')){
    var probe=audioProbe(x.audio);if(r[17]==='')changes.push({col:18,value:'URLあり／'+probe.status,why:'AUDIO_TRANSPORT_ONLY'});
    if(r[18]==='')changes.push({col:19,value:probe.play,why:'PLAYBACK_NOT_DECODED'});
   }
   if(changes.length){var w=PHASE15_INTEGRATED.writeRow(s,sh,rn,r,changes,x.source);if(w.ok){count+=changes.length;changes.forEach(function(c){counts[column(c.col)]=(counts[column(c.col)]||0)+1;});}}
  }
  p.setProperty('P15_MEDIA_CURSOR',String(rn+1));
 }
 return {cells:count,counts:counts};
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
  if(phase==='INGEST'&&Date.now()<deadline-30000)result.media=enrich(s,sources,deadline);
  var batches=Math.min(5,Math.max(1,Number(p.getProperty('P15_BATCHES_PER_TICK')||1)));
  for(var b=0;b<batches&&Date.now()<deadline-30000;b++){
   var out=PHASE15_INTEGRATED.run({target:'PROD',limit:100,write:true,prodApproved:true,reviseW:p.getProperty('P15_W_REVISION_APPROVED')==='YES',deferred:deferred(s),sources:sources,deadline:deadline});
   result.processed+=out.processed;result.next=out.next;result.json+=out.officialJsonVerified;
   Object.keys(out.counts).forEach(function(k){result.counts[k]=(result.counts[k]||0)+out.counts[k];});
   if(out.processed<100||out.next>s.getSheetByName('エピソード台帳').getLastRow())break;
  }
  if(phase!=='INGEST'&&Date.now()<deadline-30000)result.media=enrich(s,sources,deadline);
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
return {tick:tick,preflight:preflight,assertOwner:assertOwner,recordHolds:recordHolds,retryPolicy:retryPolicy,platformLinks:platformLinks,platformEvidence:platformEvidence,audioProbe:audioProbe,intake:intake,inventory:inventory,migrateLegacy:migrateLegacy,version:VERSION};
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
