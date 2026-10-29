/** Standalone GAS scheduler. Load alongside Phase15IntegratedProductionEngine.gs.
 * No ChatGPT, external worker, web app, npm, or OAuth secret dependency.
 * Use the existing production project; never replace unrelated scripts/triggers.
 */
var P15_AUTO=(function(){
'use strict';
var ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',VERSION='p15-auto-20261029.1-predeployment';
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
 if(/EXCLUSION_HISTORY|HISTORY_RESERVED|UNAPPROVED_SHOW|UNTRUSTED_SOURCE|OFFICIAL_EPISODE_URL|TOO_LONG|REVIEW|INVALID|PROTECTED|CONFLICT|MISMATCH|V_DIFF|RELATED_|UNPAIRED|RESIDUE|EMPTY_BODY|CAST_|FIRST_ROW|UNVERIFIED|HTTP_40[134]/.test(reason))return {state:'REVIEW',next:''};
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
function exclusionHistory(s){
 var out={guids:{},titles:{},max:0,error:''},t=s.getSheetByName('削除・除外履歴');
 if(!t){out.error='EXCLUSION_HISTORY_MISSING';return out;}
 try{
  var expected=['GUID','固定ID','番組','タイトル','状態','登録日時','理由','記録者','備考'],head=t.getRange(1,1,1,9).getValues()[0];
  if(expected.some(function(v,i){return head[i]!==v;})){out.error='EXCLUSION_HISTORY_SCHEMA_MISMATCH';return out;}
  rows(t,9).forEach(function(r){
   if(r.every(function(v){return v===''||v==null;}))return;
   var g=norm(r[0]),title=str(r[3]).trim(),show=str(r[2]).trim(),m=str(r[1]).match(/^EP-(\d+)$/);
   if(m)out.max=Math.max(out.max,+m[1]);
   // Any recorded deletion/exclusion is fenced, including unknown/restored status.
   // Re-admission requires an explicit separate review, never an inferred release.
   if(g)out.guids[g]=true;
   if(show&&title)out.titles[show+'|'+title]=true;
   if(!g&&!(show&&title))out.error='EXCLUSION_HISTORY_UNIDENTIFIABLE_ROW';
  });
 }catch(e){out.error='EXCLUSION_HISTORY_READ_FAILED';}
 return out;
}
function newEpisodeDecision(x,inv){
 var g=norm(x.guid),show=str(x.show),title=str(x.title).trim(),ex=inv.exclusions;
 if(/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(show))return {state:'EXCLUDED',reason:'OUT_OF_SCOPE'};
 if(ex.guids[g]||ex.titles[show+'|'+title])return {state:'EXCLUDED',reason:'DELETION_EXCLUSION_HISTORY'};
 if((inv.guids[g]||[]).some(function(rn){return PHASE15_INTEGRATED.humanExcluded(inv.data[rn-2][38]);}))return {state:'EXCLUDED',reason:'HUMAN_EXCLUDED'};
 if(inv.guids[g])return {state:'REGISTERED',reason:'GUID_ALREADY_REGISTERED'};
 if(ex.error)return {state:'HOLD',reason:ex.error};
 if(!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/.test(g)||!title||!Number.isFinite(Date.parse(x.published)))return {state:'HOLD',reason:'INVALID_SOURCE_IDENTITY'};
 if(!/^(ニュースの現場から|MEDIA TALK|こどもそうだんしつ|スポンジ|ニュースの学校|ドーナツ|報談|旧SDGsアーカイブ)$/.test(show))return {state:'HOLD',reason:'UNAPPROVED_SHOW'};
 if(x.collision)return {state:'HOLD',reason:'SOURCE_IDENTITY_CONFLICT'};
 if(!/^https:\/\/(?:www\.omnycontent\.com|feeds\.megaphone\.fm)\//.test(str(x.source)))return {state:'HOLD',reason:'UNTRUSTED_SOURCE'};
 if(inv.reservedGuids[g])return {state:'HOLD',reason:'HISTORY_RESERVED_GUID'};
 if(inv.data.some(function(r){return r[1]===show&&str(r[2]).trim()===title&&Math.abs(new Date(r[3]).getTime()-Date.parse(x.published))<60000;}))return {state:'HOLD',reason:'POSSIBLE_DUPLICATE_REVIEW'};
 if(!/^https:\/\/(?:omny\.fm|www\.omny\.fm)\/shows\/[^/?#]+\/[^/?#]+(?:[?#].*)?$/.test(str(x.link))||/\/playlists\//.test(x.link))return {state:'HOLD',reason:'OFFICIAL_EPISODE_URL_MISSING_OR_UNVERIFIED'};
 if(str(x.description).length>49000)return {state:'HOLD',reason:'SOURCE_TOO_LONG_FOR_CELL'};
 return {state:'UNREGISTERED',reason:''};
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
 var exclusions=exclusionHistory(s);max=Math.max(max,exclusions.max);
 return {sh:sh,data:data,ids:ids,guids:guids,reservedGuids:reservedGuids,max:max,exclusions:exclusions};
}
function intake(s,sources,deadline,options){return locked(function(){
 options=options||{};var limit=options.limit===undefined?10:options.limit;
 if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('INVALID_INTAKE_LIMIT');
 assertOwner(s);var inv=inventory(s),p=props(),since=Date.parse(p.getProperty('P15_INGEST_SINCE')||'');
 if(!Number.isFinite(since))throw Error('INGEST_SINCE_REQUIRED');
 inv.max=Math.max(inv.max,Number(p.getProperty('P15_MAX_EP_NUMBER')||0));
 var journal=table(s,'P15_INTAKE',['GUID','EP-ID','ROW','STATE','UTC','SOURCE','DETAIL']);
 var reservations=rows(journal,7),reserved={};reservations.forEach(function(r){reserved[norm(r[0])]=r;var m=str(r[1]).match(/^EP-(\d+)$/);if(m)inv.max=Math.max(inv.max,+m[1]);});
 var items=Object.keys(sources.byGuid).map(function(g){return sources.byGuid[g];}).filter(function(x){var time=Date.parse(x.published);return Number.isFinite(time)&&time>=since&&time<=Date.now();}).sort(function(a,b){return Date.parse(a.published)-Date.parse(b.published);});
 var added=0,held=0,excluded=0,registered=0,counts={},decisions=[],addedIds=[];
 if(options.guid)items=items.filter(function(x){return norm(x.guid)===norm(options.guid);});
 for(var i=0;i<items.length&&added<limit&&Date.now()<deadline-20000;i++){
  var x=items[i],decision=newEpisodeDecision(x,inv);decisions.push({guid:x.guid,state:decision.state,reason:decision.reason});
  if(decision.state==='REGISTERED'){registered++;continue;}
  if(decision.state==='EXCLUDED'){excluded++;continue;}
  if(decision.state==='HOLD'){held++;recordHolds(s,{start:0,holds:[{row:0,id:'NEW:'+x.guid,why:decision.reason}]},[['',x.show,x.title,x.published,'','',x.guid]]);continue;}
  if(reserved[x.guid]){if(reserved[x.guid][3]==='RESERVED')throw Error('INTAKE_PENDING_RECONCILIATION');continue;}
  var ep='EP-'+String(++inv.max).padStart(5,'0'),rn=inv.sh.getLastRow()+1;
  if(rn>inv.sh.getMaxRows())inv.sh.insertRowsAfter(inv.sh.getMaxRows(),1);
  var row=Array(55).fill('');row[0]=ep;row[1]=x.show;row[2]=x.title;row[3]=new Date(x.published);row[4]='音声';row[5]=/omnycontent/.test(x.source)?'Omny RSS':'Megaphone RSS';row[6]=x.guid;row[8]=x.link;row[9]=x.link;row[31]=new Date();row[32]=x.source;row[44]=x.source;
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
  inv.ids[ep]=rn;inv.guids[x.guid]=[rn];inv.data.push(row);added++;addedIds.push(ep);row.forEach(function(v,c){if(v!=='')counts[column(c+1)]=(counts[column(c+1)]||0)+1;});
  if(proposal.holds.length)recordHolds(s,{start:rn,holds:[{row:rn,id:ep,why:proposal.holds}]},[row]);
 }
 return {added:added,addedIds:addedIds,held:held,excluded:excluded,registered:registered,counts:counts,decisions:decisions};
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
  // Every tick checks new episodes first; cap intake time to retain patrol/media budget.
  if(Date.now()<deadline-80000)result.intake=intake(s,sources,Math.min(deadline-80000,Date.now()+60000));
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
function trialOne(){
 var p=props(),g=norm(p.getProperty('P15_TRIAL_GUID'));
 if(p.getProperty('P15_TRIAL_APPROVED')!=='YES'||!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/.test(g))throw Error('EXPLICIT_ONE_GUID_TRIAL_APPROVAL_REQUIRED');
 var s=ss();assertOwner(s);if(pending(s))throw Error('PENDING_WRITE_REQUIRES_RECONCILIATION');
 var deadline=Date.now()+180000,sources=PHASE15_INTEGRATED.fetchSources(s,deadline);
 if(!sources.byGuid[g])return {status:'HOLD',reason:'TRIAL_GUID_NOT_IN_OFFICIAL_RSS',added:0};
 try{var result=intake(s,sources,deadline,{limit:1,guid:g});console.log(JSON.stringify({mode:'ONE_GUID_TRIAL',guid:g,result:result}));return result;}catch(e){fatal(e);throw e;}
 // No patrol, retry, media, cursor change, trigger, or full-pilot approval.
}
function preflight(){
 var s=ss(),p=props(),sh=s.getSheetByName('エピソード台帳');
 var header=sh.getRange(1,1,1,55).getValues()[0],expected={0:'台帳ID',6:'外部ID',21:'概要原文',22:'概要清掃済み',38:'人間除外',50:'出演者確認根拠'};
 Object.keys(expected).forEach(function(c){if(header[c]!==expected[c])throw Error('SCHEMA_MISMATCH_'+c);});
 var smoke=p15iParserSmokeTests();if(smoke.some(function(t){return !t.ok;}))throw Error('PARSER_TEST_FAILED');
 var inv=inventory(s),sources=PHASE15_INTEGRATED.fetchSources(s,Date.now()+180000);
 var result={version:VERSION,exclusionHistoryError:inv.exclusions.error,scriptId:ScriptApp.getScriptId(),savedCursor:p.getProperty('P15I_CURSOR_PROD'),rows:inv.data.length,maxAllocatedId:inv.max,pendingWrites:pending(s),feeds:sources.log,tests:smoke,triggers:ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction();}),writes:0};
 console.log(JSON.stringify(result));return result;
}
return {tick:tick,trialOne:trialOne,newEpisodeDecision:newEpisodeDecision,exclusionHistory:exclusionHistory,preflight:preflight,assertOwner:assertOwner,recordHolds:recordHolds,retryPolicy:retryPolicy,platformLinks:platformLinks,platformEvidence:platformEvidence,audioProbe:audioProbe,intake:intake,inventory:inventory,migrateLegacy:migrateLegacy,enrich:enrich,version:VERSION};
})();
function p15AutonomousTick(){return P15_AUTO.tick();}
function p15AutonomousTrialOne(){return P15_AUTO.trialOne();}
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
