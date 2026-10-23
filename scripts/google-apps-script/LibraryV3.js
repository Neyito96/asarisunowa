/** Integrated library pipeline. Opt-in, no startup side effects.
 * Reuses V2 RSS/cache/identity/HTTP; V1 and V2 entry points remain independent.
 * All writes require explicit configuration after deployment approval.
 * State tabs are append/update-only machine records; ledger values are blank-only.
 */
function libV3Schema_(){return {
 state:['EP-ID','fieldStatesJSON','updatedAt'],
 dashboard:['show','field','missing','candidate','hold','verified','noInformation','unchecked','recheck'],
 fields:[[7,'guid'],[15,'audio'],[22,'description'],[23,'clean'],[24,'cast'],[12,'spotify'],[14,'image'],[16,'duration'],[45,'rss'],[18,'audioUrlPresence'],[38,'cleanVersion'],[46,'cast1'],[47,'cast2'],[48,'cast3'],[49,'cast4'],[50,'cast5'],[51,'castEvidence']]
};}
function libV3Text_(v){return String(v==null?'':v).trim();}
function libV3Hash_(v){return libV2CpHash_(JSON.stringify(v));}
function libV3Identity_(r){return [...new Set([libV2CpGuid_(r[6]),...libV2CpRowAnchors_(r)].filter(Boolean))];}
function libV3Clean_(text){
 // Mechanical rendering only: preserve words, URLs and names, never summarize.
 return String(text||'').replace(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,(_,q,url,label)=>label===url?label:label+' '+url).replace(/\\r\\n|\\n|\\r|\r\n?|\n/g,' ').replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,' ')
 .replace(/<(https?:\/\/[^<>\s]+)>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x])
 .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(x,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):x;}).replace(/\s+/g,' ').trim();
}
function libV3CheckHeaders_(h){
 libV2CpCheckHeaders_(h);
 const required={13:'画像URL',15:'再生時間（秒）',17:'音声URL状態',22:'概要清掃済み',37:'清掃版',44:'番組RSS URL',50:'出演者確認根拠'};
 for(let n=0;n<5;n++)required[45+n]='出演者'+(n+1);
 Object.keys(required).forEach(k=>{if(h[k]!==required[k])throw Error('V3 header mismatch '+k);});
}
function libV3Index_(rows,exclusions,records){
 const guid=new Map(),anchor=new Map(),ids=new Map(),spotify=new Map(),audio=new Map(),metadata=new Map(),registry=new Set(),states=new Map();
 const add=(m,k,i)=>{if(k){if(!m.has(k))m.set(k,[]);if(!m.get(k).includes(i))m.get(k).push(i);}};
 rows.forEach((r,i)=>{add(guid,libV2CpGuid_(r[6]),i);libV2CpRowAnchors_(r).forEach(g=>add(anchor,g,i));add(ids,String(r[0]),i);add(spotify,libV3Text_(r[11]),i);add(audio,libV3Text_(r[14]),i);add(metadata,libV2CpNorm_(r[2])+'|'+libV2CpDate_(r[3]),i);});
 (records||[]).forEach(r=>{states.set(r[0]+'|'+r[1],r);if(r[3]&&(!String(r[0]).startsWith('NEW:')||r[1]==='rssInspection'))registry.add(r[3]);if(r[1]==='identity')String(r[9]||'').split('|').filter(Boolean).forEach(g=>registry.add(g));});
 const tomb={gs:new Set(),is:new Set()};(exclusions||[]).forEach(r=>{if(r[0])tomb.gs.add(libV2CpGuid_(r[0]));if(r[1])tomb.is.add(libV3Text_(r[1]));});
 return {guid,anchor,ids,spotify,audio,metadata,registry,states,tomb};
}
function libV3Plan_(it,feed,rows,index,formulas){
 const matches=libV2CpMatches_(it.guid,index.guid,index.anchor),reasons=[];
 if(!it.guid)reasons.push('blank_guid');
 if(index.tomb.gs.has(it.guid))reasons.push('human_deleted_guid');
 if(matches.length!==1){
  reasons.push(matches.length?'multiple_ledger_matches':index.registry.has(it.guid)?'previously_seen_identity':'no_identity_match');
  return {guid:it.guid,matches,reasons,fields:[]};
 }
 const i=matches[0],r=rows[i],id=String(r[0]);
 reasons.push(...libV2CpRowReasons_(it,feed.show,r,index.ids,index.tomb));
 const raw=libV3Text_(r[21])?String(r[21]):String(it.description||''),clean=libV3Clean_(raw),cleanEvidence=typeof libV3AutoCleanEvidence_==='function'?libV3AutoCleanEvidence_(raw):null;
 const values={guid:it.guid,audio:/^https:\/\//.test(it.audio)?it.audio:'',description:it.description,clean,
 cast:it.cast,spotify:it.spotify,image:/^https:\/\//.test(it.image||'')?it.image:'',duration:Number(it.duration)>0?Number(it.duration):'',
 rss:feed.url,audioUrlPresence:(libV3Text_(r[14])||it.audio)?'記載あり':'',cleanVersion:clean&&(!libV3Text_(r[22])||String(r[22])===clean)&&!formulas?.[i]?.[22]?'V3-mechanical-1':''};
 const persons=String(it.cast||'').split('、').filter(Boolean);
 const canAssign=persons.length>0&&persons.length<=5&&!r.slice(45,50).some(libV3Text_)&&(!libV3Text_(r[23])||String(r[23])===it.cast);
 for(let n=0;n<5;n++)values['cast'+(n+1)]=canAssign?(persons[n]||''):'';
 values.castEvidence=canAssign?'RSS explicit person host/guest: '+feed.url:'';
 // Clean from a different original is never certified as the feed's current text.
 const fields=libV3Schema_().fields.map(([col,name])=>{
  const current=r[col-1],value=values[name],prior=index.states.get(id+'|'+name),valueHash=libV3Hash_(current==null?'':current);
  let state='UNINSPECTED',candidate=false,reason='existing_value_unverified';
  if(prior&&['reserved_before_cell_write','unresolved_write_reservation'].includes(prior[7])){const target=JSON.parse(prior[9]||'{}').candidateHash;if(!reasons.length&&target&&target===valueHash&&String(current)===String(value)){state='VERIFIED';reason='reserved_write_recovered';}else{state='HOLD';reason='unresolved_write_reservation';}}
  else if(prior&&((prior[6]&&prior[6]!==valueHash)||(prior[2]==='RECHECK_REQUIRED'&&prior[7]==='human_or_other_writer_changed_cell'))){state='RECHECK_REQUIRED';reason='human_or_other_writer_changed_cell';}
  else if(reasons.length){state='HOLD';reason=reasons.join('|');}
  else if(['clean','cleanVersion'].includes(name)&&cleanEvidence?.hold){state='HOLD';reason=cleanEvidence.reason;}
  else if(formulas?.[i]?.[col-1]){state='HOLD';reason='formula_protected';}
  else if(name==='spotify'&&value&&(index.spotify.get(value)||[]).some(owner=>owner!==i)){state='HOLD';reason='spotify_owned_by_other_ep';}
  else if(libV3Text_(current)){
   if(value!==''&&value!=null){state=String(current)===String(value)?'VERIFIED':'RECHECK_REQUIRED';reason=state==='VERIFIED'?'source_equal':'existing_value_differs';}
  }else if(value!==''&&value!=null){state='UNINSPECTED';candidate=true;reason='exact_identity_blank_cell';}
  else {state='NO_INFORMATION';reason='not_explicit_in_current_source';}
  return {col,name,state,candidate,reason,value,valueHash,prior};
 });
 return {guid:it.guid,id,i,matches,reasons,fields,rowHash:libV3Hash_(r),sourceHash:libV3Hash_(it),cleanEvidence};
}
function libV3Feeds_(sourceRows){
 const map=new Map();sourceRows.forEach(r=>{const url=libV3Text_(r[7]),show=libV2CpNorm_(r[0]);if(/^https:\/\//.test(url)&&!/youtube\.com|youtu\.be/i.test(url)){
  if(!show)throw Error('Feed show missing');if(map.has(url)&&map.get(url)!==show)throw Error('Feed show conflict');map.set(url,show);
 }});return [...map].sort((a,b)=>a[0].localeCompare(b[0])).map(([url,show])=>({url,show}));
}
function libV3Context_(requireState,copyPilot){
 const targetSheetId=copyPilot?libV3CopyPilotId_(copyPilot):LIB_V2_SHEET_ID;
 const ss=SpreadsheetApp.openById(targetSheetId),get=name=>{const sh=ss.getSheetByName(name);if(!sh)throw Error('Missing '+name);return sh;};
 const sh=get('エピソード台帳'),data=sh.getDataRange().getValues(),headers=data.shift();libV3CheckHeaders_(headers);
 const ex=get('削除・除外履歴'),history=get('自動補完・実行履歴');
 const expected=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
 if(history.getRange(1,1,1,10).getValues()[0].some((v,i)=>v!==expected[i]))throw Error('History schema mismatch');
 const state=ss.getSheetByName('図書館V3・項目状態');
 if(requireState&&!state)throw Error('V3 setup required');
 const stored=state?state.getDataRange().getValues():[],records=[],packed=new Map();
 if(state&&libV3Hash_(stored.shift())!==libV3Hash_(libV3Schema_().state))throw Error('V3 state schema mismatch');
 stored.forEach((r,i)=>{if(packed.has(r[0]))throw Error('Duplicate state EP-ID');const fields=JSON.parse(r[1]||'{}');if(!fields||Array.isArray(fields)||typeof fields!=='object')throw Error('Invalid packed state');packed.set(r[0],{row:i+2,fields});Object.entries(fields).forEach(([name,value])=>{if(!Array.isArray(value)||value.length!==8)throw Error('Invalid field state');records.push([r[0],name,...value]);});});
 const recordRows=new Map(records.map((r,i)=>[r[0]+'|'+r[1],i]));
 return {ss,targetSheetId,sh,rows:data,headers,ex,history,state,records,recordRows,packed,feeds:libV3Feeds_(get('取得元一覧').getDataRange().getValues().slice(1)),index:libV3Index_(data,ex.getDataRange().getValues().slice(1),records)};
}
function libV3Config_(){
 const raw=PropertiesService.getScriptProperties().getProperty('LIB_V3_CONFIG');
 const c=raw?JSON.parse(raw):{};
 // Old V1/V2 enabled flags cannot authorize V3.
 return {enabled:c.enabled===true,allowEnrich:c.allowEnrich===true,allowNew:c.allowNew===true,newAfter:c.newAfter||'',maxEpisodes:10,maxItems:200,autonomous:c.autonomous===true};
}
function libV3Conflicts_(){
 // Enumerate installed handlers, not a partial list of known scheduler names.
 return ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction()).filter(n=>!['scheduledLibraryV3','scheduledLibraryV3BaselineOnly','scheduledLibraryV3Morning','continueLibraryV3Morning'].includes(n)&&/(?:[Ll]ibrary|[Oo]fficialRss|[Bb]ackfill)/.test(n));
}
function libV3StatePut_(c,record){
 const key=record[0]+'|'+record[1],old=c.index.states.get(key);
 if(old&&old[2]==='RECHECK_REQUIRED'&&old[7]==='human_or_other_writer_changed_cell'){record=record.slice();record[2]=old[2];record[7]=old[7];}
 if(old&&['reserved_before_cell_write','unresolved_write_reservation','reserved_spotify_write'].includes(old[7])&&record[2]!=='VERIFIED'){record=record.slice();record[2]='HOLD';record[7]=old[7];record[9]=old[9];record[6]=old[6];}
 if(old&&[2,3,4,5,6,7,9].every(i=>String(old[i])===String(record[i])))return;
 const existing=c.recordRows.has(key)?c.recordRows.get(key):-1;
 let packed=c.packed.get(record[0]);if(!packed){packed={row:c.packed.size+2,fields:{}};c.packed.set(record[0],packed);}
 packed.fields[record[1]]=record.slice(2);const serialized=JSON.stringify(packed.fields);if(serialized.length>45000)throw Error('Bounded per-EP state exceeded');
 c.state.getRange(packed.row,1,1,3).setValues([[libV3Safe_(record[0]),serialized,new Date().toISOString()]]);
 if(existing<0){c.recordRows.set(key,c.records.length);c.records.push(record);}else c.records[existing]=record;
 c.index.states.set(key,record);if(record[3]&&(!String(record[0]).startsWith('NEW:')||record[1]==='rssInspection'))c.index.registry.add(record[3]);
}
function libV3Safe_(v){return typeof v==='string'&&/^[=+\-@]/.test(v)?"'"+v:v;}
function libV3Record_(p,f,r,hash){return [p.id,f.name,f.state,p.guid,libV3Hash_(r),hash,libV3Hash_(r[f.col-1]??''),f.reason,new Date().toISOString(),JSON.stringify({candidate:f.candidate,candidateHash:f.candidate?libV3Hash_(f.value):''})];}
/** Approval-only provisioning: creates machine-owned sidecars, never changes ledger. */
function setupLibraryV3AfterApproval(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');
 try{
  if(libV3Conflicts_().length)throw Error('Legacy library triggers still installed');
  const c=libV3Context_(false),schemas=libV3Schema_();
  for(const [name,h] of [['図書館V3・項目状態',schemas.state],['図書館V3・進捗',schemas.dashboard]]){
   let sh=c.ss.getSheetByName(name);if(!sh){sh=c.ss.insertSheet(name);sh.getRange(1,1,1,h.length).setValues([h]);}
   else if(libV3Hash_(sh.getRange(1,1,1,h.length).getValues()[0])!==libV3Hash_(h))throw Error('Sidecar exists with other schema');
  }
  return {status:'SETUP_READY',ledgerWrites:0};
 }finally{lock.releaseLock();}
}
/** Register all original identities before permitting new rows; 200 rows/run. */
function registerLibraryV3BaselineAfterApproval(){
 const deadline=Date.now()+100000;
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');
 try{
  if(libV3Conflicts_().length)throw Error('Legacy library triggers still installed');
  const c=libV3Context_(true),p=PropertiesService.getScriptProperties(),key='LIB_V3_BASELINE',s=JSON.parse(p.getProperty(key)||'{}');
  const hash=libV3Hash_(c.rows.map(r=>[r[0],...libV3Identity_(r)]));
  if(s.hash!==hash){s.offset=0;s.hash=hash;s.complete=false;}
  let next=s.offset||0;const end=Math.min(c.rows.length,next+200);
  for(;next<end&&Date.now()<deadline;next++){
   const r=c.rows[next];if(!/^EP-\d+$/.test(r[0])||c.index.ids.get(String(r[0])).length!==1)throw Error('Invalid/duplicate baseline EP-ID');
   libV3StatePut_(c,[r[0],'identity','VERIFIED',libV2CpGuid_(r[6]),libV3Hash_(r),'',libV3Hash_(r[0]),'baseline',new Date().toISOString(),libV3Identity_(r).join('|')]);
  }
  s.offset=next;s.complete=s.offset===c.rows.length;
  p.setProperty(key,JSON.stringify(s));return {status:s.complete?'BASELINE_READY':'BASELINE_PARTIAL',...s};
 }finally{lock.releaseLock();}
}
function previewLibraryV3(){return libV3Run_(false);}
function runLibraryV3AfterApproval(){return libV3Run_(true);}
function scheduledLibraryV3(){return typeof libV3AutoTick_==='function'?libV3AutoTick_():libV3Run_(true);}
function libV3NewDecision_(it,feed,c,config,baseline){
 const reasons=[];
 if(!baseline.complete)reasons.push('baseline_not_registered');
 if(!config.allowNew)reasons.push('new_registration_not_enabled');
 if(!config.newAfter||!it.published||!Number.isFinite(Date.parse(it.published))||!Number.isFinite(Date.parse(config.newAfter))||Date.parse(it.published)<=Date.parse(config.newAfter))reasons.push('historical_or_invalid_publication');
 if(c.index.registry.has(it.guid)||c.index.tomb.gs.has(it.guid))reasons.push('seen_or_deleted_guid');
 if(!it.guid||!it.title||!it.date)reasons.push('missing_required_metadata');
 if([...c.index.ids].some(([id,indices])=>!/^EP-\d+$/.test(id)||indices.length!==1))reasons.push('ledger_id_integrity');
 if(c.index.metadata.has(it.title+'|'+it.date)||c.index.audio.has(it.audio))reasons.push('possible_reissue_or_migration');
 return {eligible:!reasons.length,reasons};
}
/** Copy pilot stays in the explicitly selected copy, including the fresh re-read.
 * Its persistent identity reservation supplies monotonic IDs without Properties.
 * Default production behavior and counter are unchanged.
 */
function libV3Append_(c,it,feed,config,baseline,copyPilot){
 // Full latest ledger and exclusion re-read; no stale append/cell overwrite.
 if(copyPilot&&(c.targetSheetId!==libV3CopyPilotId_(copyPilot)||it.guid!==copyPilot.guid||feed.url!==copyPilot.feedUrl))throw Error('Copy pilot scope changed');
 const live=libV3Context_(true,copyPilot),d=libV3NewDecision_(it,feed,live,config,baseline);
 if(libV2CpMatches_(it.guid,live.index.guid,live.index.anchor).length||!d.eligible)throw Error('New item changed or held');
 const props=PropertiesService.getScriptProperties();
 const lastId=Number(props.getProperty('LIB_V3_LAST_ID')||0);if(!Number.isSafeInteger(lastId)||lastId<0)throw Error('Invalid ID counter');
 const max=[...live.rows,...live.records].reduce((n,r)=>Math.max(n,Number(String(r[0]).match(/^EP-(\d+)$/)?.[1]||0)),lastId);
 const id='EP-'+String(max+1).padStart(5,'0');if(!copyPilot)props.setProperty('LIB_V3_LAST_ID',String(max+1));
 // Reserve identity BEFORE append. Crash leaves a hold, never resurrection/duplicate.
 libV3StatePut_(live,[id,'identity','HOLD',it.guid,'','','','reserved_before_append',new Date().toISOString(),it.guid]);
 if(typeof libV3AutoCleanEvidence_==='function'&&libV3AutoCleanEvidence_(it.description||'').hold)throw Error('New description requires review');
 const r=Array(51).fill('');r[0]=id;r[1]=feed.show;r[2]=it.title;r[3]=new Date(it.published);r[4]='音声';r[5]='公式RSS';r[6]=it.guid;r[8]=/^https:\/\//.test(it.link||'')?it.link:'';
 r[14]=/^https:\/\//.test(it.audio||'')?it.audio:'';r[21]=it.description||'';r[22]=libV3Clean_(r[21]);r[23]=it.cast||'';r[44]=feed.url;r[17]=r[14]?'記載あり':'未確認';r[18]='未確認';r[38]='未指定';r[35]='V3 exact RSS; audio not playback verified';r[37]=r[22]?'V3-mechanical-1':'';
 live.sh.getRange(live.sh.getLastRow()+1,1,1,51).setValues([r.map(libV3Safe_)]);SpreadsheetApp.flush();
 if(libV3Hash_(live.sh.getRange(live.sh.getLastRow(),1,1,51).getValues()[0])!==libV3Hash_(r))throw Error('New row postwrite mismatch');
 libV3StatePut_(live,[id,'identity','VERIFIED',it.guid,libV3Hash_(r),'',libV3Hash_(id),'RSS_registered',new Date().toISOString(),it.guid]);
 c.rows.push(r);c.records=live.records;c.recordRows=live.recordRows;c.packed=live.packed;c.index=libV3Index_(c.rows,c.ex.getDataRange().getValues().slice(1),c.records);return {id,writtenCells:51};
}
function libV3Run_(write,options){
 options=options||{};
 const start=Date.now(),deadline=start+110000,lock=LockService.getScriptLock(),config=libV3Config_();
 if(options.morning){config.autonomous=false;config.allowEnrich=false;config.maxEpisodes=5;}
 const m={mode:write?'WRITE_V3':'READ_ONLY_V3',status:'',apiCalls:0,cacheHits:0,fetchedItems:0,inspected:0,proposedCells:0,writtenCells:0,updatedIds:[],newIds:[],holds:0,fieldStates:{},samples:[]};
 if(write&&!config.enabled)return {...m,status:'DISABLED'};
 if(!lock.tryLock(1000))return {...m,status:'SKIPPED_ALREADY_RUNNING'};
 const props=PropertiesService.getScriptProperties(),key=options.morning?'LIB_V3_MORNING_CURSOR':'LIB_V3_CURSOR';let state,context;
 try{
  if(write&&(libV3Conflicts_().length||ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledLibraryV3').length>1))throw Error('Conflicting library triggers');
  const c=libV3Context_(write);context=c;if(!c.feeds.length)throw Error('No feeds');
  state=JSON.parse(props.getProperty(key)||'{}');let feed=c.feeds.find(f=>f.url===state.url)||c.feeds[0];
  if(config.autonomous){const startFeed=c.feeds.indexOf(feed);feed=Array.from({length:c.feeds.length},(_,i)=>c.feeds[(startFeed+i)%c.feeds.length]).find(f=>!(state.feeds?.[f.url]?.nextPollAt>Date.now())&&!(state.feeds?.[f.url]?.retry?.stopped)&&!(state.feeds?.[f.url]?.retry?.at>Date.now()));if(!feed){m.status='IDLE_UNTIL_NEXT_POLL';return m;}}
  m.feed=feed.url;
  if(config.autonomous){state={url:feed.url,...(state.feeds?.[feed.url]||{offset:0,hash:''}),feeds:state.feeds||{}};}
  else if(state.url!==feed.url)state={url:feed.url,offset:0,hash:'',feeds:state.feeds||{}};
  else if(state.feeds?.[feed.url])state={url:feed.url,...state.feeds[feed.url],feeds:state.feeds};
  const save=rotate=>{
   const per={};for(const f of c.feeds)if(state.feeds?.[f.url])per[f.url]=state.feeds[f.url];
   per[feed.url]={offset:state.offset||0,hash:state.hash||'',...(state.retry?{retry:state.retry}:{}),...(config.autonomous?{pass:state.pass||'priority',nextPollAt:state.nextPollAt||0,completedAt:state.completedAt||0}:{})};
   const next=rotate?c.feeds[(c.feeds.indexOf(feed)+1)%c.feeds.length].url:feed.url;
   state={url:next,...(per[next]||{offset:0,hash:''}),feeds:per};const encoded=JSON.stringify(state);if(encoded.length>8000)throw Error('Feed checkpoint property budget exceeded');props.setProperty(key,encoded);
  };
  const before=Date.now(),snap=libV2CpSnapshot_(feed.url,write,state,m,{prefix:options.morning?'LV3MORN':config.autonomous?'LV3AUTO':'LV3CP',chunkSize:22000,timeoutSeconds:45,maxAgeMs:(options.morning||config.autonomous)?30*60000:0,parse:t=>{const list=libV2CpParse_(t,true);return (options.morning||config.autonomous)?list.sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0)||String(a.guid).localeCompare(String(b.guid))):list;}});
  if(snap.status){if(!state.retry?.stopped&&!(state.retry?.at>before))m.apiCalls++;m.status=snap.status;m.retry=snap.retry;state.retry=snap.retry;if(write)save(snap.status==='RETRY_WAIT');return m;}
  delete state.retry;if(state.hash!==snap.hash){state.hash=snap.hash;state.offset=0;state.pass='priority';state.nextPollAt=0;}
  if(snap.fetched&&write){save(false);m.status='SNAPSHOT_READY';return m;}
  const counts=new Map();snap.items.forEach(it=>counts.set(it.guid,(counts.get(it.guid)||0)+1));
  const baseline=JSON.parse(props.getProperty('LIB_V3_BASELINE')||'{}');
  let offset=state.offset||0,touched=0;
  while(offset<snap.items.length&&m.inspected<config.maxItems&&touched<config.maxEpisodes&&Date.now()<deadline-15000){
   const it=snap.items[offset];m.inspected++;
   if(options.morning){const at=Date.parse(it.published);if(!Number.isFinite(at)||at>Date.now()+60000){offset++;continue;}if(at<Number(options.since)){offset=snap.items.length;break;}}
   if(!it.guid||counts.get(it.guid)!==1){m.holds++;if(write)libV3StatePut_(c,['NEW:'+(it.guid||'blank'),'discovery','HOLD',it.guid||'','',libV3Hash_(it),'','blank_or_duplicate_rss_guid',new Date().toISOString(),'']);offset++;continue;}
   if(config.autonomous&&typeof libV3AutoInspectDue_==='function'&&!libV3AutoInspectDue_(it,feed,c,state.pass||'priority')){offset++;continue;}
   const plan=libV3Plan_(it,feed,c.rows,c.index);
   if(!plan.id){
    m.holds++;const nd=libV3NewDecision_(it,feed,c,config,baseline);
    if(m.samples.length<10)m.samples.push({guid:it.guid,reasons:plan.reasons,newDecision:nd});
    if(write){
     libV3StatePut_(c,['NEW:'+it.guid,'discovery','HOLD',it.guid,'',libV3Hash_(it),'','unmatched_or_held',new Date().toISOString(),JSON.stringify([...plan.reasons,...nd.reasons])]);
     for(const i of plan.matches){const r=c.rows[i];for(const [col,name] of libV3Schema_().fields)libV3StatePut_(c,[r[0],name,'HOLD',it.guid,libV3Hash_(r),libV3Hash_(it),libV3Hash_(r[col-1]??''),plan.reasons.join('|'),new Date().toISOString(),'']);}
    }
    if(write&&plan.reasons.length===1&&plan.reasons[0]==='no_identity_match'&&nd.eligible){const added=libV3Append_(c,it,feed,config,baseline);m.newIds.push(added.id);m.writtenCells+=added.writtenCells;touched++;}
    if(write&&config.autonomous)libV3AutoInspected_(it,feed,c,plan);
    offset++;continue;
   }
   const r=c.rows[plan.i];let deferred=false;
   if(plan.reasons.length)m.holds++;
   if(plan.fields.some(f=>f.candidate)){touched++;}
   for(const f of plan.fields){
    if(Date.now()>=deadline-10000){deferred=true;break;}
    if(f.candidate&&f.name==='cleanVersion'&&((libV3Text_(r[22])&&String(r[22])!==libV3Clean_(libV3Text_(r[21])||it.description))||(!libV3Text_(r[22])&&!plan.fields.some(v=>v.name==='clean'&&v.candidate)))){f.candidate=false;f.state='HOLD';f.reason='clean_not_verified';}
    if(f.candidate){
     const cell=c.sh.getRange(plan.i+2,f.col);
     if(cell.getFormula()){f.candidate=false;f.state='HOLD';f.reason='formula_protected';m.holds++;}
    }
    if(f.candidate){m.proposedCells++;
     if(write&&config.allowEnrich){
      const latest=c.sh.getRange(plan.i+2,1,1,51).getValues()[0];
      const tomb=libV3Index_([],c.ex.getDataRange().getValues().slice(1),[]).tomb;
      if(libV3Hash_(latest)!==libV3Hash_(r)||libV2CpRowReasons_(it,feed.show,latest,c.index.ids,tomb).length)throw Error('Row changed before write '+plan.id);
      const cell=c.sh.getRange(plan.i+2,f.col);if(cell.getFormula()||libV3Text_(cell.getValue()))throw Error('Destination changed');
      libV3StatePut_(c,libV3Record_(plan,{...f,state:'HOLD',reason:'reserved_before_cell_write'},r,plan.sourceHash));
      cell.setValue(libV3Safe_(f.value));SpreadsheetApp.flush();if(String(cell.getValue())!==String(f.value))throw Error('Cell verification failed');
      r[f.col-1]=f.value;m.writtenCells++;f.state='VERIFIED';f.reason='blank_only_verified_write';if(!m.updatedIds.includes(plan.id))m.updatedIds.push(plan.id);
     }
     if(f.name==='spotify')c.index.spotify.set(f.value,[plan.i]);
    }
    m.fieldStates[f.state]=(m.fieldStates[f.state]||0)+1;
    if(write)libV3StatePut_(c,libV3Record_(plan,f,r,plan.sourceHash));
   }
   if(m.samples.length<10&&plan.fields.some(f=>f.candidate))m.samples.push({id:plan.id,fields:plan.fields.filter(f=>f.candidate).map(f=>f.name)});
   if(deferred)break;
   if(write&&plan.cleanEvidence)libV3AutoRecordClean_(c,plan,r);
   if(write&&config.autonomous)libV3AutoInspected_(it,feed,c,plan);
   offset++;
  }
  m.nextOffset=offset;m.completeFeed=offset===snap.items.length;
  if(write){
   c.history.appendRow([new Date(),'V3_CHECKPOINT',m.updatedIds.length+m.newIds.length,m.writtenCells,m.holds,[...m.updatedIds,...m.newIds].join(','),feed.url,'',Math.round((Date.now()-start)/1000),JSON.stringify({offset,apiCalls:m.apiCalls,cacheHits:m.cacheHits,fetchedItems:m.fetchedItems,newIds:m.newIds})]);
   state.offset=offset;if(m.completeFeed){state.offset=0;if(config.autonomous){if((state.pass||'priority')==='priority'){state.pass='review';m.completeFeed=false;}else{state.pass='priority';state.completedAt=Date.now();state.nextPollAt=Date.now()+30*60000;}}else state.hash='';}
   save(true);props.setProperty('LIB_V3_FAILURES','0');
  }
  m.status=write?'CHECKPOINTED':'READ_ONLY';return m;
 }catch(e){
  m.status='FAILED';m.error=String(e);if(write){const failures=Number(props.getProperty('LIB_V3_FAILURES')||0)+1;props.setProperty('LIB_V3_FAILURES',String(failures));if(failures>=2){const v=JSON.parse(props.getProperty('LIB_V3_CONFIG')||'{}');v.enabled=false;props.setProperty('LIB_V3_CONFIG',JSON.stringify(v));}}
  return m;
 }finally{
  m.elapsedMs=Date.now()-start;
  if(write&&context&&m.status!=='CHECKPOINTED'){
   try{context.history.appendRow([new Date(),'V3_'+m.status,m.updatedIds.length+m.newIds.length,m.writtenCells,m.holds,[...m.updatedIds,...m.newIds].join(','),m.feed||'','',Math.round(m.elapsedMs/1000),JSON.stringify({apiCalls:m.apiCalls,cacheHits:m.cacheHits,fetchedItems:m.fetchedItems,retry:m.retry||null,error:m.error||''})]);}
   catch(e){m.historyError=String(e);const v=JSON.parse(props.getProperty('LIB_V3_CONFIG')||'{}');v.enabled=false;props.setProperty('LIB_V3_CONFIG',JSON.stringify(v));}
  }
  if(write&&(m.elapsedMs>=150000||m.status==='STOPPED_HTTP')){const v=JSON.parse(props.getProperty('LIB_V3_CONFIG')||'{}');v.enabled=false;props.setProperty('LIB_V3_CONFIG',JSON.stringify(v));}
  Logger.log(JSON.stringify(m));lock.releaseLock();
 }
}
/** Read-only overview; never repairs existing dashboards implicitly. */
function previewLibraryV3Progress(){
 const c=libV3Context_(false),stats=new Map();
 for(const r of c.rows)for(const [col,field] of libV3Schema_().fields){
  const key=r[1]+'|'+field;if(!stats.has(key))stats.set(key,{show:r[1],field,missing:0,candidate:0,states:{}});
  const s=stats.get(key),record=c.index.states.get(r[0]+'|'+field);
  if(!libV3Text_(r[col-1]))s.missing++;
  if(record&&record[6]===libV3Hash_(r[col-1]??'')&&record[9]&&JSON.parse(record[9]).candidate)s.candidate++;
  const state=!record?'UNINSPECTED':record[6]!==libV3Hash_(r[col-1]??'')?'RECHECK_REQUIRED':record[2];s.states[state]=(s.states[state]||0)+1;
 }
 const result={mode:'READ_ONLY_V3_PROGRESS',rows:c.rows.length,byShowField:[...stats.values()],config:libV3Config_(),conflictingTriggers:libV3Conflicts_(),audio:'external bounded transport required; HTTP evidence is not playback'};
 Logger.log(JSON.stringify({mode:result.mode,rows:result.rows,groups:result.byShowField.length,config:result.config,conflictingTriggers:result.conflictingTriggers,writes:0}));
 Logger.log(JSON.stringify(result));return result;
}
function stopLibraryV3AfterApproval(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{const p=PropertiesService.getScriptProperties(),c=JSON.parse(p.getProperty('LIB_V3_CONFIG')||'{}');c.enabled=false;p.setProperty('LIB_V3_CONFIG',JSON.stringify(c));return {status:'DISABLED',triggerChanges:0};}finally{lock.releaseLock();}
}
function installLibraryV3TriggerAfterApproval(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{
  if(libV3Conflicts_().length)throw Error('Legacy library triggers still installed');
  const own=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='scheduledLibraryV3');if(own.length>1)throw Error('Duplicate V3 triggers');
  if(!own.length)ScriptApp.newTrigger('scheduledLibraryV3').timeBased().everyMinutes(10).create();
  return {status:'TRIGGER_READY',enabled:libV3Config_().enabled};
 }finally{lock.releaseLock();}
}
/** Approval-only refresh of the V3-owned dashboard, preserving legacy dashboard. */
function refreshLibraryV3ProgressAfterApproval(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{
  const report=previewLibraryV3Progress(),c=libV3Context_(true),sh=c.ss.getSheetByName('図書館V3・進捗');if(!sh)throw Error('V3 setup required');
  const h=libV3Schema_().dashboard;if(libV3Hash_(sh.getRange(1,1,1,h.length).getValues()[0])!==libV3Hash_(h))throw Error('Dashboard schema changed');
  const rows=report.byShowField.map(s=>[s.show,s.field,s.missing,s.candidate,s.states.HOLD||0,s.states.VERIFIED||0,s.states.NO_INFORMATION||0,s.states.UNINSPECTED||0,s.states.RECHECK_REQUIRED||0]);
  if(rows.length)sh.getRange(2,1,rows.length,h.length).setValues(rows.map(r=>r.map(libV3Safe_)));
  return {status:'V3_DASHBOARD_UPDATED',rows:rows.length,ledgerWrites:0};
 }finally{lock.releaseLock();}
}
/** GAS UrlFetchApp has no documented HEAD method. Fail closed, never silently
 * fall back to GET: an origin can ignore Range and send the whole media file. */
function libV3AudioRequest_(url){
 return {status:libV3Text_(url)?'EXTERNAL_BOUNDED_TRANSPORT_REQUIRED':'NO_AUDIO_URL',http:null,playbackVerified:false,apiCalls:0};
}
/** Import up to five explicitly reviewed external probe records. Sidecar only.
 * Payload generated by scripts/library-v3-audio-probe.py. Never sets 再生状態.
 */
function recordLibraryV3AudioEvidenceAfterApproval(evidence){
 if(!Array.isArray(evidence)||evidence.length>5||new Set(evidence.map(e=>e.id)).size!==evidence.length)throw Error('Up to five unique evidence records');
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Busy');try{
  const c=libV3Context_(true),allowed=['HEAD_REACHABLE','AUDIO_PREFIX_OBSERVED','REDIRECT_NOT_FOLLOWED','INCONCLUSIVE_HTTP','HTTP_NOT_FOUND_AT_CHECK_TIME','RANGE_IGNORED','NON_AUDIO_RESPONSE','FETCH_ERROR','HTTP_FORBIDDEN','HTTP_RATE_LIMITED','HTTP_UNAVAILABLE','HTTP_GONE','HTTP_NOT_FOUND'];
  for(let e of evidence){
   const match=c.index.ids.get(e.id)||[];if(match.length!==1)throw Error('Unknown/duplicate EP-ID');const r=c.rows[match[0]];
   if(e.url!==r[14]||libV2CpBlocked_(r[38])||c.index.tomb.is.has(e.id)||c.index.tomb.gs.has(libV2CpGuid_(r[6])))throw Error('Audio identity/exclusion changed');
   if(!allowed.includes(e.verdict)||!Number.isFinite(Date.parse(e.checkedAt))||Date.parse(e.checkedAt)>Date.now()+60000||Date.now()-Date.parse(e.checkedAt)>86400000||e.playbackVerified!==false)throw Error('Invalid/stale evidence');
   if(!Number.isInteger(e.bytes||0)||(e.bytes||0)<0||(e.bytes||0)>1024||e.nextCheckAt&&(!Number.isFinite(Date.parse(e.nextCheckAt))||Date.parse(e.nextCheckAt)<Date.parse(e.checkedAt)))throw Error('Invalid audio bounds');
   if(typeof libV3AutoAudioSchedule_==='function')e={...e,nextCheckAt:libV3AutoAudioSchedule_(e)};
   libV3StatePut_(c,[e.id,'audioHttp',e.verdict==='AUDIO_PREFIX_OBSERVED'?'VERIFIED':'RECHECK_REQUIRED',libV2CpGuid_(r[6]),libV3Hash_(r),'',libV3Hash_(r[14]),'external_probe_not_playback',e.checkedAt,JSON.stringify({http:e.http,verdict:e.verdict,bytes:e.bytes||0,playbackVerified:false,nextCheckAt:e.nextCheckAt||new Date(Date.parse(e.checkedAt)+86400000).toISOString(),observations:(e.observations||[]).slice(0,6).map(o=>({method:o.method,http:o.http,contentType:o.contentType,bytes:o.bytes,retryAfter:o.retryAfter,errorType:o.errorType,host:o.host}))})]);
  }return {status:'AUDIO_EVIDENCE_RECORDED',count:evidence.length,ledgerWrites:0};
 }finally{lock.releaseLock();}
}
/** All 51 ledger columns are inventoried. Unsupported source fields remain explicit;
 * no generic scrape/guess fallback, and no claim that present means verified. */
function previewLibraryV3AllColumns(context){
 const c=context||libV3Context_(false),groups=new Map(),auto=new Map(libV3Schema_().fields.map(([col,name])=>[col-1,name]));
 for(const r of c.rows)for(let col=0;col<c.headers.length;col++){
  const key=r[1]+'|'+col;if(!groups.has(key))groups.set(key,{show:r[1],column:col+1,label:c.headers[col],missing:0,present:0,states:{}});
  const g=groups.get(key),present=!!libV3Text_(r[col]),field=auto.get(col),prior=field&&c.index.states.get(r[0]+'|'+field);
  present?g.present++:g.missing++;
  const state=prior?(prior[6]===libV3Hash_(r[col]??'')?prior[2]:'RECHECK_REQUIRED'):'UNINSPECTED';g.states[state]=(g.states[state]||0)+1;
 }
 const result={mode:'READ_ONLY_V3_ALL_COLUMNS',rows:c.rows.length,columns:c.headers.length,byShowField:[...groups.values()],writes:0};
 Logger.log(JSON.stringify({mode:result.mode,rows:result.rows,columns:result.columns,groups:result.byShowField.length,writes:result.writes}));return result;
}

/** Repeatable five-field inventory. Presence is not source verification. No writes. */
function libV3MissingAudit_(headers,rows,exclusions){
 libV3CheckHeaders_(headers);
 const fields={guid:6,spotify:11,audio:14,cast:23,description:21},groups=new Map(),idx=libV3Index_(rows,exclusions||[],[]);
 const duplicateIds=[...idx.ids].filter(([,v])=>v.length>1).map(([id,v])=>({id,rows:v.map(i=>i+2)}));
 const total={rows:0,excluded:0,missing:{guid:0,spotify:0,audio:0,cast:0,description:0},blankIds:[],samplesByField:{guid:[],spotify:[],audio:[],cast:[],description:[]}};
 for(let i=0;i<rows.length;i++){
  const r=rows[i];if(!r.some(v=>libV3Text_(v)))continue;
  const show=libV3Text_(r[1])||'(blank show)';if(!groups.has(show))groups.set(show,{show,rows:0,excluded:0,missing:{guid:0,spotify:0,audio:0,cast:0,description:0}});
  const g=groups.get(show);g.rows++;total.rows++;if(!libV3Text_(r[0]))total.blankIds.push(i+2);
  if(libV2CpBlocked_(r[38])||idx.tomb.is.has(String(r[0]))||libV3Identity_(r).some(x=>idx.tomb.gs.has(x))){g.excluded++;total.excluded++;}
  for(const [field,col] of Object.entries(fields))if(!libV3Text_(r[col])){g.missing[field]++;total.missing[field]++;if(total.samplesByField[field].length<10)total.samplesByField[field].push({id:String(r[0]),row:i+2,show});}
 }
 return {mode:'READ_ONLY_V3_MISSING',...total,byShow:[...groups.values()],duplicateIds,writes:0,apiCalls:0};
}
function previewLibraryV3MissingAudit(){const c=libV3Context_(false),r=libV3MissingAudit_(c.headers,c.rows,c.ex.getDataRange().getValues().slice(1));Logger.log(JSON.stringify(r));return r;}

/** P0-A compact evidence inventory. No HTTP, property, cache or sheet mutations.
 * Existing text and playback labels are observations, never inferred verification.
 */
function previewLibraryV3QualityAudit(){
 const c=libV3Context_(false),all=previewLibraryV3AllColumns(c),ex=c.ex.getDataRange().getValues().slice(1);
 const missing=libV3MissingAudit_(c.headers,c.rows,ex),oldNews=[],audio={urlPresent:0,httpEvidenceCurrent:0,httpEvidenceStale:0,playbackLabelPresent:0};
 for(const r of c.rows){
  const url=libV3Text_(r[14]),http=c.index.states.get(r[0]+'|audioHttp');
  if(url)audio.urlPresent++;
  if(libV3Text_(r[18]))audio.playbackLabelPresent++;
  if(http){if(url&&http[6]===libV3Hash_(r[14]))audio.httpEvidenceCurrent++;else audio.httpEvidenceStale++;}
  const date=libV2CpDate_(r[3]);
  if(r[1]==='ニュースの現場から'&&/^202[01]-/.test(date)){
   const raw=libV3Text_(r[21]),clean=libV3Text_(r[22]);
   oldNews.push({id:String(r[0]),date,rawPresent:!!raw,cleanPresent:!!clean,
    cleanRelation:!raw?'RAW_MISSING':!clean?'CLEAN_MISSING':libV3Clean_(raw)===clean?'MECHANICAL_EQUAL':'DIFFERENT_REVIEW_NOT_OVERWRITE',
    audioUrlPresent:!!url,guidPresent:!!libV3Text_(r[6])});
  }
 }
 const duplicateGuids=[...c.index.guid].filter(([,v])=>v.length>1).map(([guid,v])=>({guid,ids:v.map(i=>String(c.rows[i][0]))}));
 const result={mode:'READ_ONLY_V3_QUALITY',rows:c.rows.length,columns:c.headers.length,byShowField:all.byShowField,
  missing,duplicateGuids,exclusionHistoryRows:ex.filter(r=>r.some(v=>libV3Text_(v))).length,audio,oldNews,
  writes:0,apiCalls:0,playbackVerifiedByThisAudit:false};
 // One bounded show/column log per group; return all detail without raw descriptions.
 Logger.log(JSON.stringify({mode:result.mode,rows:result.rows,columns:result.columns,audio,duplicateGuids,exclusionHistoryRows:result.exclusionHistoryRows,writes:0,apiCalls:0}));
 for(const show of [...new Set(c.rows.map(r=>r[1]))])Logger.log(JSON.stringify({mode:'READ_ONLY_V3_QUALITY_SHOW',show,fields:all.byShowField.filter(g=>g.show===show)}));
 for(let i=0;i<oldNews.length;i+=25)Logger.log(JSON.stringify({mode:'READ_ONLY_V3_OLD_NEWS',offset:i,rows:oldNews.slice(i,i+25)}));
 return result;
}

/** Comparison-only representation. Never use this text as a stored original/clean value.
 * Conservative HTML allowlist: unknown tags/attributes remain reviewable, not erased.
 */
function libV3DescriptionNormalize_(raw){
 let supported=true;
 const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x]).replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(x,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):x;});
 let text=String(raw==null?'':raw).replace(/\\r\\n|\\n|\\r/g,'\n');
 text=text.replace(/<a\s+href\s*=\s*(["'])(https?:\/\/[^"']+)\1\s*>([^<]*)<\/a\s*>/gi,(_,q,url,label)=>decode(label)===decode(url)?label:label+' '+url);
 text=text.replace(/<[^>]*>/g,tag=>{
  if(/^<\/?(?:p|div|li)\s*>$|^<br\s*\/?\s*>$/i.test(tag))return ' ';
  if(/^<\/?(?:b|strong|em|i|span)\s*>$/i.test(tag))return '';
  supported=false;return tag;
 });
 // Decode after HTML handling so escaped literal tags do not become removable markup.
 return {text:decode(text).replace(/\s+/g,' ').trim(),supported};
}
function libV3DescriptionCompare_(existing,rss){
 const a=String(existing==null?'':existing),b=String(rss==null?'':rss),left=libV3DescriptionNormalize_(a),right=libV3DescriptionNormalize_(b);
 const kind=a===b?'EXACT_EQUAL':left.supported&&right.supported&&left.text===right.text?'FORMAT_EQUIVALENT':!left.supported||!right.supported?'UNSUPPORTED_FORMAT_REVIEW':'CONTENT_DIFFERENCE';
 return {kind,ruleVersion:'description-compare-1',existingNormalized:left.text,rssNormalized:right.text,existingHash:libV3Hash_(a),rssHash:libV3Hash_(b),overwriteAllowed:false};
}
/** Comparison/extraction rendering only. The original RSS string never passes through this. */
function libV3ContentLines_(raw){
 return String(raw||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n').replace(/<br\b[^>]*>|<\/(?:p|div|li)>/gi,'\n').split('\n').map(libV3Clean_);
}
/** Versioned, exact whole-line rules. Unknown/event prose is retained for review. */
function libV3ContentRules_(show){
 const common=[
  ['adchoices',/^Learn more about your ad choices\. Visit (?:https?:\/\/)?megaphone\.fm\/adchoices\.?$/],
  ['omny_privacy',/^See (?:https?:\/\/)?omnystudio\.com\/listener for privacy information\.$/],
  ['discord',/^(?:ご意見・感想・リクエスト|交流はdiscord) https:\/\/bit\.ly\/asapoki_discord$/],
  ['other_programs',/^ほかにも多彩な番組を配信中！ ?http:\/\/t\.asahi\.com\/womy$/],
  ['app',/^アプリで記者と対話 http:\/\/t\.asahi\.com\/won1$/],
  ['letter',/^おたよりフォーム https:\/\/bit\.ly\/asapoki_otayori$/],
  ['newsletter',/^メルマガ https:\/\/bit\.ly\/asapoki_newsletter$/],
  ['advertiser',/^広告ご検討の企業様は http:\/\/t\.asahi\.com\/asapokiguide$/],
  ['search',/^番組検索ツール https:\/\/bit\.ly\/asapoki_cast$/],
  ['social',/^最新情報はX https:\/\/bit\.ly\/asapoki_twitter$/],
  ['calendar',/^番組カレンダー https:\/\/bit\.ly\/asapki_calendar$/],
  ['website',/^全話あります公式サイト https:\/\/bit\.ly\/asapoki_lp$/]
 ];
 const byShow={
  'ニュースの学校':[], 'ニュースの現場から':[], 'MEDIA TALK':[],
  'こどもそうだんしつ':[], 'スポンジ':[], 'ドーナツ':[],
  '報談':[['houdan_discord',/^※「報談」専用のdiscordもぜひどうぞ ?https:\/\/discord\.gg\/d7sAbSRQvq$/]]
 };
 if(!Object.prototype.hasOwnProperty.call(byShow,show))throw Error('Unsupported content show');
 return common.concat(byShow[show]);
}
function libV3ContentClean_(raw,show){
 const rules=libV3ContentRules_(show),lines=libV3ContentLines_(raw),removed=[],review=[],kept=[];
 lines.forEach((text,line)=>{
  const rule=rules.find(r=>r[1].test(text));
  if(rule){removed.push({line,text,rule:rule[0],reason:'exact_official_boilerplate_line'});return;}
  if(/イベント|申し込み|申込|募集|お知らせ|広告|読み放題|番組フォロー/.test(text))review.push({line,text,reason:'episode_specific_or_unregistered_notice_preserved'});
  kept.push(text);
 });
 const unsupported=/<(?:script|style|img|iframe)\b|\b(?:hidden|display\s*:\s*none)\b/i.test(String(raw));
 if(unsupported)review.push({reason:'unsupported_markup_original_preserved'});
 // 1007 legacy: exact cross-promotion may share a line with the recorded date.
 const joined=kept.join('\n');
 const promo=/朝日新聞ポッドキャスト（\s*https?:\/\/www\.asahi\.com\/special\/podcasts\/?(?:\?iref=omny)?\s*）では他にも様々な番組を配信(?:しています|、テキストでも読めます|しているほか、関連記事も読んでいただけます)[。.]?/g;
 const withoutPromo=joined.replace(promo,(part,pos)=>{removed.push({line:null,text:part,rule:'legacy1007_cross_promo',reason:'exact_legacy_verified_text',offset:pos});return '';});
 const text=withoutPromo.replace(/\n{3,}/g,'\n\n').trim();
 return {text,ruleVersion:'V3-rss-content-1',rawHash:libV3Hash_(raw),cleanHash:libV3Hash_(text),removed,review,hold:unsupported,reason:unsupported?'unsupported_markup':'exact_rules_only',originalPreserved:true};
}

/** 1007-compatible related title/URL candidates. READ_ONLY, never verify a title by inference. */
function libV3RelatedArticleCandidates_(raw){
 const text=String(raw||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n'),result=[],seen=new Set();
 const add=(url,title,source)=>{
  const u=String(url||'').replace(/[）)\]。、,，；;]+$/g,'');
  if(!/^https?:\/\/[^\s<>]+$/i.test(u)||/\/special\/podcasts\/?(?:\?|$)/.test(u)||seen.has(u))return;
  seen.add(u);result.push({url:u,titleCandidate:String(title||'').trim()||null,titleVerified:false,source,status:'REVIEW'});
 };
 for(const m of text.matchAll(/【関連記事】([\s\S]*?)(?=\n\s*【[^】]+】|\n\s*朝日新聞ポッドキャスト|$)/g)){
  for(const chunk of m[1].split(/\s*▽\s*|\n(?=\S)/)){
   const part=chunk.split(/\s+朝日新聞ポッドキャスト（/)[0];
   for(const link of part.matchAll(/https?:\/\/[^\s（）()<>]+/g))
    add(link[0],part.slice(0,link.index).replace(/[（(\s]+$/g,''),'related_heading');
  }
 }
 const lines=text.split('\n');
 for(let i=1;i<lines.length;i++){
  const u=lines[i].trim().match(/^(https?:\/\/\S+)$/),title=lines[i-1].trim();
  if(u&&title&&title.length<=180&&!/^(?:関連記事|参考資料|リンク集)$/.test(title))add(u[1],title,'preceding_line');
 }
 for(const m of text.matchAll(/https?:\/\/(?:www\.)?asahi\.com\/articles\/[^\s<>()（）]+/g))
  add(m[0],null,'asahi_article_url_review');
 return result;
}

/** Audit-only parser: preserve RSS description text (HTML retained), not V2's escaped newlines.
 * Existing ingestion/writing parsers are intentionally unchanged. */
function libV3CandidateParse_(text){
 const items=libV2CpParse_(text,true),nodes=XmlService.parse(text).getRootElement().getChild('channel').getChildren('item');
 return items.map((it,i)=>{const node=nodes[i],encoded=node.getChildren().find(n=>n.getName()==='encoded'&&n.getNamespace().getURI()==='http://purl.org/rss/1.0/modules/content/'),description=String(node.getChildText('description')||''),full=encoded?String(encoded.getText()):'';return {...it,description:description||full,descriptionTag:description?'description':full?'content:encoded':'missing',descriptionVariants:{description,contentEncoded:full},
  people:nodes[i].getChildren().filter(n=>n.getName()==='person'&&n.getNamespace().getURI()==='https://podcastindex.org/namespace/1.0').map(n=>({name:libV2CpNorm_(n.getText()),role:String(n.getAttribute('role')?.getValue()||'').toLowerCase(),source:'podcast:person'}))};});
}
/** Only explicit labelled name lists; ambiguous prose stays review, never attribution. */
function libV3CandidatePeople_(it){
 const people=(it.people||[]).map(p=>({...p})),reviews=[],lines=libV3ContentLines_(it.description),namePattern=/^[一-龠々ぁ-んァ-ヶー]{2,8}(?:[ 　][一-龠々ぁ-んァ-ヶー]{1,8})?$/;
 const roles='出演|聞き手|司会|ゲスト|MC|取材|制作|音源編集|編集';
 const rolePrefix=new RegExp('^('+roles+')(?:[・／/]('+roles+'))*[：:・ 　]+(.+)$');
 let section='';
 const add=(name,role,evidence,source)=>{
  if(!namePattern.test(name)){reviews.push({reason:'ambiguous_role_line',evidence});return;}
  people.push({name,role,evidence,source});
 };
 for(const line of lines){
  if(!line){section='';continue;}
  const heading=line.match(/^【([^】]+)】(.*)$/);
  let text=line;
  if(heading){section=heading[1];text=heading[2].trim();if(!text)continue;}
  if(/イベント|お知らせ|告知|次回|関連記事|関連リンク|過去回|キャンペーン|募集|朝ポキ情報/.test(section)){if(/神田|MC|ゲスト|出演/.test(text))reviews.push({reason:'announcement_not_current_appearance',evidence:line});continue;}
  const labelled=text.match(rolePrefix);
  let role=labelled?text.slice(0,text.length-labelled[3].length).replace(/[：:・ 　]+$/,''):section;
  let names=labelled?labelled[3]:text;
  const suffix=names.match(/^(.+?)[（(]((?:MC|司会|聞き手|出演|ゲスト|取材|制作|音源編集|編集)(?:[・／/](?:MC|司会|聞き手|出演|ゲスト|取材|制作|音源編集|編集))*)[）)]/);
  if(suffix){role=suffix[2];names=suffix[1];}
  if(!labelled&&!suffix&&!/^(?:出演|聞き手|司会|ゲスト|MC|取材|制作|編集|出演・スタッフ)$/.test(section)){
   // Strict affirmative prose only; article subjects, questions and negation never become cast.
   const prose=text.match(/^(?:今回は)?([一-龠々ぁ-んァ-ヶー]{2,8})さん(?:にお話を聞きました|をゲストに迎えました)[。！]?$/);
   if(prose)add(prose[1],'ゲスト',line,'description_explicit_prose');
   continue;
  }
  names=names.replace(/https?:\/\/\S+/g,'').replace(/[（(][^）)]*[）)]/g,'').trim();
  const list=names.split(/[、,／/]/).map(n=>n.trim().replace(/(?:さん|氏)$/,''));
  if(role==='出演・スタッフ'){reviews.push({reason:'mixed_cast_staff_role_unknown',names:list,evidence:line});continue;}
  if(list.length>5){reviews.push({reason:'ambiguous_role_line',evidence:line});continue;}
  list.forEach(name=>role.split(/[・／/]/).forEach(r=>add(name,r,line,'description_role_line')));
 }
 const unique=[...new Map(people.map(p=>[p.name+'|'+p.role,p])).values()];
 const speakers=[...new Set(unique.filter(p=>['host','guest','出演','聞き手','司会','MC','ゲスト'].includes(p.role)).map(p=>p.name))];
 if(!unique.length&&it.cast)speakers.push(...it.cast.split('、').filter(Boolean));
 const plain=libV3Clean_(it.description||'');
 for(const match of plain.matchAll(/([一-龠々]{2,8})さん/g)){if(!unique.some(p=>p.name===match[1]))reviews.push({person:match[1],reason:'name_mention_role_unverified',evidence:match[0]});}
 if(/神田\s*大介/.test(plain)&&!speakers.some(x=>/神田\s*大介/.test(x)))reviews.push({person:'神田大介',reason:'description_mention_role_unverified',evidence:plain.slice(Math.max(0,plain.search(/神田\s*大介/)-50),plain.search(/神田\s*大介/)+100)});
 return {people:unique,speakers:[...new Set(speakers)],reviews};
}
/** Stateless, one-feed candidate audit. Never persist cursor/cache/properties or cells.
 * A future approved scheduler must store the returned cursor in a separate audit store.
 */
function previewLibraryV3SchoolCandidates(){return previewLibraryV3RssCandidates({show:'ニュースの学校'});}
function previewLibraryV3RssCandidates(options){
 const o=options||{},shows=['ニュースの学校','ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ドーナツ','報談'];
 const show=o.show||shows[0],offset=o.cursor?.offset||0;
 if(!shows.includes(show)||!Number.isInteger(offset)||offset<0||offset>100000)throw Error('Invalid audit selection');
 if(o.cursor&&(o.cursor.show!==show||!o.cursor.hash))throw Error('Cursor identity required');
 const started=Date.now(),deadline=started+90000,lock=LockService.getScriptLock();
 const m={mode:'READ_ONLY_V3_RSS_CANDIDATES',show,status:'',inspected:0,apiCalls:0,cacheHits:0,fetchedItems:0,candidates:[],review:[],holds:[],episodes:[],fieldCounts:{},episodeCounts:{},candidateCells:0,writes:0,propertyWrites:0,playbackVerified:false};
 if(!lock.tryLock(1000))return {...m,status:'SKIPPED_ALREADY_RUNNING'};
 try{
  const c=libV3Context_(false),feeds=c.feeds.filter(f=>f.show===show);
  if(feeds.length!==1)throw Error('Expected exactly one configured feed for show');
  const feed=feeds[0];m.feed=feed.url;
  if(o.cursor&&o.cursor.url!==feed.url)throw Error('Cursor feed changed');
  if(Date.now()>deadline-45000){m.status='TIME_BUDGET';return m;}
  const state={offset,hash:o.cursor?.hash||'',retry:o.cursor?.retry};
  const snap=libV2CpSnapshot_(feed.url,false,state,m,{prefix:'LV3CAND2',timeoutSeconds:45,parse:libV3CandidateParse_});
  if(snap.status){if(!state.retry?.stopped&&!(state.retry?.at>started))m.apiCalls++;m.status=snap.status;m.retry=snap.retry;return m;}
  if(o.cursor&&snap.hash!==o.cursor.hash){m.status='SOURCE_CHANGED_RESTART_REQUIRED';return m;}
  if(offset>snap.items.length)throw Error('Cursor exceeds snapshot');
  const counts=new Map();snap.items.forEach(it=>counts.set(it.guid,(counts.get(it.guid)||0)+1));
  let next=offset;
  while(next<snap.items.length&&m.inspected<50&&Date.now()<deadline-15000){
   const original=snap.items[next++];m.inspected++;
   const evidence=libV3CandidatePeople_(original),it={...original,cast:evidence.speakers.join('、')};
   const p=libV3Plan_(it,feed,c.rows,c.index),row=p.id?c.rows[p.i]:null,content=libV3ContentClean_(it.description||'',show);
   for(const f of p.fields.filter(f=>['clean','cleanVersion'].includes(f.name))){
    f.value=f.name==='clean'?content.text:content.text?content.ruleVersion:'';
    if(content.hold){f.candidate=false;f.state='HOLD';f.reason=content.reason;}
    else if(row&&libV3Text_(row[f.col-1])){f.candidate=false;if(!['HOLD','RECHECK_REQUIRED'].includes(f.state)||f.reason==='existing_value_differs'){f.state=String(row[f.col-1])===f.value?'VERIFIED':'RECHECK_REQUIRED';f.reason=f.state==='VERIFIED'?'source_equal':'existing_clean_preserved';}}
    // Never pair W derived from different RSS text with a different stored V.
    if(row&&libV3Text_(row[21])&&String(row[21])!==String(it.description||'')){f.candidate=false;f.state='HOLD';f.reason='rss_original_differs_from_stored_v';}
   }
   const reasons=(!it.guid||counts.get(it.guid)!==1)?['blank_or_duplicate_rss_guid']:p.reasons;
   const originalField=p.fields.find(f=>f.name==='description'),cleanField=p.fields.find(f=>f.name==='clean');
   if(originalField&&['HOLD','RECHECK_REQUIRED'].includes(originalField.state))for(const f of p.fields.filter(f=>['clean','cleanVersion'].includes(f.name))){f.candidate=false;f.state='HOLD';f.reason='original_protected_or_different';}
   const versionField=p.fields.find(f=>f.name==='cleanVersion');
   if(versionField&&cleanField&&!cleanField.candidate&&!(row&&String(row[22])===content.text&&cleanField.state==='VERIFIED')){versionField.candidate=false;versionField.state='HOLD';versionField.reason='clean_not_verified';}
   const ep={id:p.id||'',show,guid:it.guid,title:it.title,date:it.date,published:it.published||'',feed:feed.url,
    match:{method:p.id?(libV2CpGuid_(row[6])===it.guid?'GUID':libV2CpOfficialItem_(row[9])===it.guid?'ASAHI_ITEM_ID':'OMNY_CLIP_ID'):'NONE',confidence:p.id&&!reasons.length?'EXACT_IDENTITY_METADATA_VALIDATED':'HELD'},
    reasons,sourceHash:p.sourceHash||libV3Hash_(it),people:evidence.people,descriptionRaw:it.description||'',descriptionSource:feed.url,descriptionTag:it.descriptionTag||'description',descriptionVariants:it.descriptionVariants||{description:it.description||''},
    content,relatedArticles:libV3RelatedArticleCandidates_(it.description||''),cleanExisting:row?row[22]:'',cleanPresent:!!(row&&libV3Text_(row[22])),audioUrl:it.audio||'',httpVerified:false,playbackVerified:false,fields:[]};
   for(const r of evidence.reviews)m.review.push({id:ep.id,guid:it.guid,...r});
   const selected=p.fields.filter(f=>['audio','description','clean','cleanVersion','cast','cast1','cast2','cast3','cast4','cast5','castEvidence'].includes(f.name));
   const proposed=[],rowFormulas=p.id?c.sh.getRange(p.i+2,1,1,51).getFormulas()[0]:[];
   // Audio identity conflict holds all proposals; an existing equal audio value does not.
   const audioConflict=selected.some(f=>f.name==='audio'&&(['HOLD','RECHECK_REQUIRED'].includes(f.state)||rowFormulas[f.col-1]));
   for(const f of selected){
    const formula=!!rowFormulas[f.col-1];
    const comparison=f.name==='description'?libV3DescriptionCompare_(row[f.col-1],f.value):null;
    let category=f.candidate?'CANDIDATE':f.state==='VERIFIED'?'EXISTING_EQUAL':f.state==='NO_INFORMATION'?'SOURCE_MISSING':'EXISTING_VALUE';
    if(f.name.startsWith('cast')&&!it.cast&&!libV3Text_(row[f.col-1]))category=evidence.reviews.length?'INSUFFICIENT_CAST_EVIDENCE':'SOURCE_MISSING';
    if(['HOLD','RECHECK_REQUIRED'].includes(f.state))category=/human|formula|reservation/.test(f.reason)?'PROTECTED':'CONFLICT';
    if(f.name.startsWith('cast')&&it.cast&&!f.value&&!f.candidate&&(row.slice(45,50).some(libV3Text_)||(libV3Text_(row[23])&&String(row[23])!==it.cast)))category='PROTECTED';
    if(comparison&&f.reason==='existing_value_differs'&&comparison.kind==='FORMAT_EQUIVALENT')category='FORMAT_EQUIVALENT';
    if(f.name==='cleanVersion'&&rowFormulas[22])category='PROTECTED';
    if(formula)category='PROTECTED';
    if(reasons.length)category=/human|excluded/.test(reasons.join('|'))?'PROTECTED':'IDENTITY_HOLD';
    else if(audioConflict&&category==='CANDIDATE')category='CONFLICT';
    const field={field:f.name,column:f.col,category,reason:formula?'formula_protected':audioConflict&&f.candidate?'audio_conflict_blocks_proposal':f.reason,existing:row[f.col-1],value:f.value};
    // Evidence text must reflect description roles as well as podcast:person.
    if(f.name==='castEvidence'&&f.candidate)field.value='RSS explicit role evidence: '+JSON.stringify(evidence.people)+' '+feed.url;
    if(comparison){field.comparison=comparison;if(category==='FORMAT_EQUIVALENT')field.reason='comparison_only_format_equivalent';}
    ep.fields.push(field);
    const key=f.name+':'+category;m.fieldCounts[key]=(m.fieldCounts[key]||0)+1;
    if(category==='CANDIDATE')proposed.push({field:f.name,column:f.col,value:field.value});
   }
   if(reasons.length){ep.category=/human|excluded/.test(reasons.join('|'))?'PROTECTED':reasons.some(r=>/conflict|mismatch/.test(r))?'CONFLICT':reasons.includes('no_identity_match')?'IDENTITY_UNMATCHED':/multiple|duplicate/.test(reasons.join('|'))?'IDENTITY_AMBIGUOUS':'OTHER_HOLD';m.holds.push({id:ep.id,guid:it.guid,reasons});}
   else {
    ep.category=proposed.length?'MATCHED_CANDIDATES':'MATCHED_NO_CANDIDATES';
    const held=ep.fields.filter(f=>['CONFLICT','PROTECTED'].includes(f.category));
    if(held.length)m.holds.push({id:ep.id,guid:it.guid,reasons:[...new Set(held.map(f=>f.reason))]});
   }
   if(proposed.length){m.candidates.push({id:p.id,guid:it.guid,title:it.title,date:it.date,feed:feed.url,sourceHash:ep.sourceHash,rowHash:p.rowHash,key:libV3Hash_([show,p.id,ep.sourceHash,proposed]),fields:proposed});m.candidateCells+=proposed.length;}
   m.episodeCounts[ep.category]=(m.episodeCounts[ep.category]||0)+1;m.episodes.push(ep);
  }
  m.completeFeed=next===snap.items.length;m.nextCursor={show,url:feed.url,hash:snap.hash,offset:next};m.status=next<snap.items.length&&m.inspected<50?'TIME_BUDGET':'READ_ONLY';return m;
 }catch(e){m.status='FAILED';m.errorType=e.name||'Error';return m;}
 finally{m.elapsedMs=Date.now()-started;lock.releaseLock();Logger.log(JSON.stringify({...m,candidates:undefined,review:undefined,holds:undefined,episodes:undefined,candidateEpisodes:m.candidates.length,reviewEpisodes:m.review.length,heldEpisodes:m.holds.length}));for(const kind of ['review','holds'])for(const row of m[kind])Logger.log(JSON.stringify({mode:m.mode,kind,...row}));
  // Chunk raw/field values to avoid Apps Script's per-entry truncation.
  for(const ep of m.episodes){const payload=JSON.stringify(ep),parts=Math.ceil(payload.length/1500);for(let part=0;part<parts;part++)Logger.log(JSON.stringify({mode:m.mode,kind:'episode_chunk',id:ep.id,guid:ep.guid,part,parts,data:payload.slice(part*1500,(part+1)*1500)}));}}
}


/** Phase 6 Mac handoff: one READ_ONLY invocation, no sheet or property writes.
 * Integrates V3 official RSS parser, content cleaner and role evidence already used by
 * previewLibraryV3RssCandidates; proposes one copy-pilot example, NOT a writer.
 * Run only after online code/hash verification and explicit user approval.
 */
function libV3MacHandoffPlan_(report){
 const out={mode:'READ_ONLY_MAC_HANDOFF',status:report&&report.status||'FAILED',
  inspected:report?.inspected||0,matched:0,held:0,
  fieldCounts:report?.fieldCounts||{},candidateCells:report?.candidateCells||0,
  selected:null,writes:0,propertyWrites:0,previewOnly:true};
 if(!report||!['READ_ONLY','TIME_BUDGET'].includes(report.status))return out;
 const eps=report.episodes||[];
 out.matched=eps.filter(ep=>ep.id&&ep.match?.confidence==='EXACT_IDENTITY_METADATA_VALIDATED').length;
 out.held=eps.length-out.matched;
 for(const ep of eps){
  if(!ep.id||ep.match?.confidence!=='EXACT_IDENTITY_METADATA_VALIDATED'||!ep.descriptionRaw)continue;
  const original=(ep.fields||[]).find(f=>f.field==='description');
  const cleaned=(ep.fields||[]).find(f=>f.field==='clean');
  const sourceChanged=original&&original.category==='CONFLICT';
  const linkMatches=[...String(ep.descriptionRaw).matchAll(/https?:\/\/[^\s<>"'）)\]}]+/g)];
  const links=[...new Set(linkMatches.map(m=>m[0].replace(/[。、，,;；]+$/g,'')))];
  const existingV=original?String(original.existing??''):'';
  const existingW=cleaned?String(cleaned.existing??''):'';
  out.selected={
   epId:ep.id,guid:ep.guid,show:ep.show,source:ep.feed,sourceHash:ep.sourceHash,
   originalLength:ep.descriptionRaw.length,rawInV:!!existingV,
   originalRelation:existingV===ep.descriptionRaw?'EQUAL':existingV?'ALTERNATE_VERSION_REVIEW':'BLANK',
   cleanVersion:ep.content?.ruleVersion||null,cleanLength:(ep.content?.text||'').length,
   cleanedInW:!!existingW,
   cleanCandidateSafe:!existingW&&!existingV&&!ep.content?.hold,
   relatedLinkUrls:links,
   castNames:(ep.people||[]).filter(p=>['出演','聞き手','司会','MC','ゲスト','host','guest'].includes(p.role)).map(p=>p.name),
   requiresManualApproval:true,
   note:sourceChanged?'Existing V differs; do not overwrite V/W.':'Proposals only; no archival storage has been performed.'
  };
  break;
 }
 return out;
}
/** Hand-off function shown in GAS dropdown after future authorized code deployment. */
function previewLibraryV3MacHandoff(){
 const report=previewLibraryV3SchoolCandidates();
 const handoff=libV3MacHandoffPlan_(report);
 Logger.log(JSON.stringify(handoff));
 return handoff;
}
