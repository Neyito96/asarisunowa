/** Phase 14. Independent, disabled by default. No Pages or Spotify writes.
 * Uses Sheets REST atomic batches (ledger + state + history + audit).
 * Install ONLY alongside the inspected live V3 files, never replace that project.
 */
var LibraryOfficialEngine = (function () {
 const PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const blank=x=>x===undefined||x===null||x==='';
 const value=c=>c&&c.userEnteredValue ? (c.userEnteredValue.stringValue??c.userEnteredValue.numberValue??c.userEnteredValue.boolValue??'') : '';
 function must(ok,msg){if(!ok)throw Error(msg);}
 function hash(x){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(x),Utilities.Charset.UTF_8));}
 function utc(x){if(typeof x==='number')return new Date(Math.round((x-25569)*86400000)-32400000).toISOString();if(x instanceof Date)return x.toISOString();return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(String(x))?x:String(x).replace(/\//g,'-').replace(' ','T')+'+09:00').toISOString();}
 // Exact V3 contract: native getValues() row, entire data-range width.
 // Do not pass REST serial dates, truncate columns, or normalize blanks/types.
 function rowHash(row){return hash(row);}
 function v3RowHash(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
 function verifyRowProof(row,state){
  must(state.identity?.[0]==='VERIFIED','STATE_NOT_VERIFIED');
  const actual=rowHash(row),baseline=state.identity[2],packed=state.officialBackfill;
  const receipt=Array.isArray(packed)&&packed.length===8&&packed[0]==='VERIFIED'?JSON.parse(packed[7]||'{}'):null;
  if(packed){
   must(receipt?.schema==='official-native-row-v1'&&receipt.baselineHash===baseline&&receipt.afterHash===actual,'STATE_HASH_CONFLICT');
   return actual;
  }
  if(actual===baseline||v3RowHash(row)===baseline)return actual;
  // Proven online for EP-00141..150: V3 baseline predates AZ:BC extension.
  must(state.identity[5]==='baseline'&&row.length===55&&v3RowHash(row.slice(0,51))===baseline,'STATE_HASH_CONFLICT');
  return actual;
 }
 function jst(x){return new Date(Date.parse(x)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' ');}
 function clipUuid(audio){return (String(audio).match(/\/clips\/[^/]+\/[^/]+\/([0-9a-f-]{36})\//i)||[])[1]||'';}
 function verify(item,clip){
  must(UUID.test(item.guid),'GUID_INVALID');
  must(clip.Id===item.guid&&clip.Title===item.title&&Date.parse(clip.PublishedUtc)===Date.parse(item.pubDate)&&clip.PublishedUrl===item.link,'RSS_JSON_CONFLICT');
  must(clipUuid(item.audio)===item.guid&&/^https:\/\/(?:traffic\.omny\.fm|www\.omnycontent\.com)\//.test(item.audio),'AUDIO_UUID_CONFLICT');
  must(/^https:\/\/(?:www\.)?omny\.fm\//.test(item.link),'PAGE_HOST');
  const seconds=String(item.duration||'').split(':').reduce((s,x)=>s*60+Number(x),0);
  must(Number.isFinite(seconds)&&seconds>0,'DURATION_INVALID');return seconds;
 }
 function material(item,clip,apiUrl){
  const duration=verify(item,clip),parsed=LibraryOfficialParser.parse(item.description||'');
  const stop=parsed.staff.findIndex(s=>/^【/.test(s));const staff=parsed.staff.slice(0,stop<0?undefined:stop);
  const people=staff.map(s=>s.replace(/https?:\/\/\S+/g,'').trim()).filter(Boolean);
  const names=people.map(s=>s.replace(/^(?:MC(?:・音源編集)?|音源編集|出演|司会)\s+/,'').replace(/（[^）]*）$/,''));
  // Only official article URLs from explicit description sections; omit promotional links.
  const embedded=Array.from(String(item.description||'').matchAll(/https?:\/\/[^\s<>"']+/g),m=>LibraryOfficialParser.url(m[0]));
  const links=parsed.relatedArticles.map(x=>x.url).concat(embedded).filter(u=>/^https:\/\/(?:www\.|digital\.)?asahi\.com\/articles\//.test(u));
  const r={9:item.link,13:item.image||clip.ImageUrl||'',14:item.audio,15:duration,21:item.description||'',22:parsed.description.replace(/(https?:\/\/[^\s]+)\s+\1/g,'$1'),23:staff.join('\n'),28:[...new Set(links)].join('\n'),32:item.sourceUrl||item.feedUrl,44:item.feedUrl,51:clip.Id,52:clip.PublishedUrl,53:clip.EmbedUrl||'',54:apiUrl};
  names.slice(0,5).forEach((s,i)=>r[45+i]=s);
  if(staff.length)r[50]='公式RSSの出演・スタッフ欄。所属・役割・全員分はX列とV列に保持。';
  for(const proof of item.platformEvidence||[]){const col={apple:12,listen:10,spotify:11,pocket:41,pody:42}[proof.platform];const hosts={apple:'podcasts.apple.com',listen:'listen.style',spotify:'open.spotify.com',pocket:'pca.st',pody:'pody.fm'};const host=(String(proof.url).match(/^https:\/\/([^/]+)\//)||[])[1];if(col!==undefined&&proof.guid===item.guid&&proof.verified===true&&host===hosts[proof.platform])r[col]=proof.url;}
  return {values:r,people,links:[...new Set(links)],warnings:parsed.holds};
 }
 function fromJson(row,clip,apiUrl){
  must(clip.Id===row[6]&&clip.Title===row[2],'HISTORICAL_JSON_IDENTITY');
  must(utc(row[3])===utc(clip.PublishedUtc),'HISTORICAL_JSON_DATE');
  return {guid:clip.Id,title:clip.Title,pubDate:clip.PublishedUtc,description:clip.DescriptionHtml||clip.Description||'',link:clip.PublishedUrl,audio:clip.AudioUrl,duration:clip.DurationSeconds,image:clip.ImageUrl,feedUrl:row[44]||row[32]||'',sourceUrl:apiUrl,sourceType:'official-json'};
 }
 function articleLinkRuns(links){
  const runs=[];let offset=0;
  for(const url of links){
   runs.push({startIndex:offset,format:{link:{uri:url}}});
   offset+=url.length;
   runs.push({startIndex:offset,format:{}});
   offset++;
  }
  return runs;
 }
 function cell(v){return {userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}};}
 function plan(cells,item,clip,apiUrl){
  must(value(cells[6])===item.guid,'ROW_GUID_CONFLICT');
  must(blank(value(cells[51]))||value(cells[51])===item.guid,'ROW_UUID_CONFLICT');
  must(value(cells[2])===item.title,'ROW_TITLE_CONFLICT');
  const m=material(item,clip,apiUrl),changes=[],conflicts=[];
  for(const key of Object.keys(m.values)){
   const col=Number(key),old=value(cells[col]),next=m.values[col],c=cells[col]||{};
   if(blank(next))continue;
   if(c.userEnteredValue?.formulaValue||c.chipRuns?.length||c.dataValidation){conflicts.push({col,reason:'STRUCTURE_PROTECTED'});continue;}
   if(!blank(old)){if(String(old)!==String(next))conflicts.push({col,reason:'NONEMPTY_PRESERVED'});continue;}
   const out=cell(next);out.note=JSON.stringify({engine:'official-rss-v1',guid:item.guid,source:item.sourceUrl||item.feedUrl,sourceType:item.sourceType||'official-rss',json:apiUrl,old:'',new:next});
   if(col===28)out.textFormatRuns=articleLinkRuns(m.links);
   changes.push({col,old:'',next,cell:out});
  }
  return {id:value(cells[0]),guid:item.guid,changes,conflicts,warnings:m.warnings};
 }
 function identityTokens(row){return [row[6],row[51],clipUuid(row[14])].filter(x=>UUID.test(String(x))).map(x=>x.toLowerCase());}
 function newDecision(item,rows,history,excluded,decisions,config,baseline,lastId){
  must(baseline.complete===true,'BASELINE_NOT_READY');
  must(config.allowNew===true&&Number.isFinite(Date.parse(config.newAfter)),'NEW_DISABLED');
  must(Date.parse(item.pubDate)>Date.parse(config.newAfter)&&Date.parse(item.pubDate)<=Date.now(),'NOT_FRESH');
  must(UUID.test(item.guid),'GUID_INVALID');const guid=item.guid.toLowerCase();
  const ids=rows.map(r=>r[0]);must(ids.every(x=>/^EP-\d{5}$/.test(x))&&new Set(ids).size===ids.length,'LEDGER_ID_INTEGRITY');
  must(!rows.some(r=>identityTokens(r).includes(guid))&&!history.some(r=>String(r[0]).toLowerCase()===guid)&&!excluded.some(r=>r.some(x=>String(x).toLowerCase()===guid)),'SEEN_OR_EXCLUDED');
  must(!rows.some(r=>r[14]===item.audio||(r[2]===item.title&&utc(r[3])===utc(item.pubDate))),'POSSIBLE_REISSUE');
  // All decisions, including held and excluded, remain reserved even if absent from ledger.
  const reserved=[...ids,...history.map(r=>r[1]),...excluded.map(r=>r[1]),...decisions.map(r=>r[0])].filter(x=>/^EP-\d{5}$/.test(x));
  const counter=String(lastId||'0').replace(/^EP-/,'');must(/^\d+$/.test(counter),'COUNTER_INVALID');
  const max=Math.max(Number(counter),...reserved.map(x=>Number(x.slice(3))));must(max<99999,'ID_EXHAUSTED');
  return 'EP-'+String(max+1).padStart(5,'0');
 }
 function config(){const c=JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_OFFICIAL_CONFIG')||'{}');must(c.sheetId&&Array.isArray(c.feeds)&&c.feeds.length,'CONFIG_REQUIRED');return c;}
 function inspect(){
  const p=PropertiesService.getScriptProperties();return {scriptId:ScriptApp.getScriptId(),sheetId:typeof LIB_V2_SHEET_ID==='undefined'?null:LIB_V2_SHEET_ID,triggers:ScriptApp.getProjectTriggers().map(t=>({handler:t.getHandlerFunction(),type:String(t.getEventType()),id:t.getUniqueId()})),v3Config:JSON.parse(p.getProperty('LIB_V3_CONFIG')||'null'),baseline:JSON.parse(p.getProperty('LIB_V3_BASELINE')||'null'),lastId:p.getProperty('LIB_V3_LAST_ID'),officialConfig:JSON.parse(p.getProperty('LIB_OFFICIAL_CONFIG')||'null'),checkpoint:JSON.parse(p.getProperty('LIB_OFFICIAL_CHECKPOINT')||'null')};
 }
 function readJson(url,options){const r=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true,followRedirects:false},options||{}));must(r.getResponseCode()===200,'HTTP_'+r.getResponseCode());return JSON.parse(r.getContentText());}
 function api(c,path,body){return readJson('https://sheets.googleapis.com/v4/spreadsheets/'+c.sheetId+path,{method:body?'post':'get',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},...(body?{payload:JSON.stringify(body)}:{})});}
 function table(c,name){return api(c,'/values/'+encodeURIComponent("'"+name+"'!A1:BC10000")+'?valueRenderOption=UNFORMATTED_VALUE').values||[];}
 function context(c){
  const meta=api(c,'?fields=sheets.properties'),tabs={};meta.sheets.forEach(s=>tabs[s.properties.title]=s.properties);
  const rows=table(c,'エピソード台帳'),history=table(c,'固定ID採番履歴'),excluded=table(c,'削除・除外履歴'),decisions=table(c,'図書館・宇宙 検索対象判定'),states=table(c,'図書館V3・項目状態');
  must(rows[0][0]==='台帳ID'&&rows[0][21]==='概要原文'&&rows[0].length>=55,'HEADER_CONFLICT');
  return {tabs,rows:rows.slice(1),history:history.slice(1),excluded:excluded.slice(1),decisions:decisions.slice(1),states:states.slice(1),stateLength:states.length};
 }
 function rss(feed){
  must(/^https:\/\/www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\//.test(feed.url),'FEED_NOT_OFFICIAL');
  const r=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});must(r.getResponseCode()===200,'RSS_HTTP');
  const root=XmlService.parse(r.getContentText()).getRootElement().getChild('channel');must(root,'RSS_CHANNEL');
  const ns=XmlService.getNamespace('http://www.itunes.com/dtds/podcast-1.0.dtd');
  return root.getChildren('item').map(x=>({guid:x.getChildText('guid'),title:x.getChildText('title'),pubDate:x.getChildText('pubDate'),description:x.getChildText('description')||'',link:x.getChildText('link'),audio:x.getChild('enclosure')?.getAttribute('url')?.getValue(),duration:x.getChildText('duration',ns),image:x.getChild('image',ns)?.getAttribute('href')?.getValue()||'',feedUrl:feed.url,show:feed.show}));
 }
 function official(item){must(UUID.test(item.guid),'GUID_INVALID');const url='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/'+item.guid;return {clip:readJson(url),url};}
 function platforms(item,feed){
  const out=[];
  // Reuses Phase 13 exact episodeGuid + feedUrl evidence. No guessed platform URLs.
  if(feed.applePodcastId&&/^\d+$/.test(String(feed.applePodcastId))){try{
   const result=readJson('https://itunes.apple.com/lookup?id='+feed.applePodcastId+'&entity=podcastEpisode&limit=200&country=JP');
   const matches=(result.results||[]).filter(r=>r.episodeGuid===item.guid&&r.feedUrl===item.feedUrl&&/^https:\/\/podcasts\.apple\.com\//.test(r.trackViewUrl||'')&&/[?&]i=\d+/.test(r.trackViewUrl||''));
   if(matches.length===1)out.push({platform:'apple',guid:item.guid,url:matches[0].trackViewUrl,verified:true});
  }catch(e){/* Optional enrichment failure never blocks official ingestion. */}}
  return out;
 }
 function update(sheetId,row,col,cellData){return {updateCells:{range:{sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[cellData]}],fields:'userEnteredValue,note,textFormatRuns'}};}
 function writePlan(c,ctx,rowIndex,original,plan){
  if(!plan.changes.length)return 0;
  const ledger=ctx.tabs['エピソード台帳'],stateTab=ctx.tabs['図書館V3・項目状態'];
  const range="'エピソード台帳'!A"+(rowIndex+1)+':BC'+(rowIndex+1);
  const current=api(c,'?includeGridData=true&ranges='+encodeURIComponent(range)).sheets[0].data[0].rowData[0].values;
  must(JSON.stringify(current.map(value))===JSON.stringify(original.map(value)),'CONCURRENT_ROW_CHANGE');
  must(plan.changes.every(ch=>blank(value(current[ch.col]))&&!current[ch.col]?.userEnteredValue?.formulaValue&&!current[ch.col]?.dataValidation&&!current[ch.col]?.chipRuns?.length),'TARGET_STRUCTURE_CHANGED');
  const stateIndex=ctx.states.findIndex(r=>r[0]===plan.id);must(stateIndex>=0,'STATE_MISSING');
  const state=JSON.parse(ctx.states[stateIndex][1]);must(state.identity?.[0]==='VERIFIED','STATE_NOT_VERIFIED');
  const sheet=SpreadsheetApp.openById(c.sheetId).getSheetByName('エピソード台帳');
  const before=sheet.getRange(rowIndex+1,1,1,sheet.getLastColumn()).getValues()[0];
  must(before[0]===plan.id&&before[6]===plan.guid,'NATIVE_IDENTITY_CONFLICT');
  verifyRowProof(before,state);
  must(plan.changes.every(ch=>blank(before[ch.col])),'NATIVE_TARGET_NOT_BLANK');
  const after=before.slice(),requests=plan.changes.map(ch=>{after[ch.col]=ch.next;return update(ledger.sheetId,rowIndex,ch.col,ch.cell);});
  // Preserve the original V3 identity proof. A separate receipt records this transition.
  state.officialBackfill=['VERIFIED',plan.guid,rowHash(before),'',rowHash(after),'official_blank_fill',new Date().toISOString(),JSON.stringify({schema:'official-native-row-v1',baselineHash:state.identity[2],beforeHash:rowHash(before),afterHash:rowHash(after),columns:plan.changes.map(x=>x.col)})];
  requests.push(update(stateTab.sheetId,stateIndex+1,1,cell(JSON.stringify(state))));
  requests.push(update(stateTab.sheetId,stateIndex+1,2,cell(new Date().toISOString())));
  // Notes retain per-cell old/new/evidence; state transition and fills commit atomically.
  api(c,':batchUpdate',{requests});
  const reread=api(c,'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE').values[0];
  must(plan.changes.every(ch=>String(reread[ch.col])===String(ch.next)),'READBACK_FAILED');return plan.changes.length;
 }
 function runBackfill(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};
  try{
   const c=config();must(c.engineValidation==='P14_RUNTIME_VERIFIED','ENGINE_NOT_VALIDATED');must(c.enabled===true&&c.allowBackfill===true,'BACKFILL_DISABLED');
   must(c.otherWritersPaused===true,'WRITERS_NOT_CONFIRMED');
   must(!ScriptApp.getProjectTriggers().some(t=>!/^scheduledLibraryOfficial/.test(t.getHandlerFunction())&&/library|backfill/i.test(t.getHandlerFunction())),'TRIGGER_CONFLICT');
   const props=PropertiesService.getScriptProperties(),last=Number(props.getProperty('LIB_OFFICIAL_NEW_LAST_SUCCESS')||0);
   if(c.sheetId===PROD)must(Date.now()-last<2*3600000,'NEW_INGESTION_PRIORITY');
   const ctx=context(c),cp=JSON.parse(props.getProperty('LIB_OFFICIAL_CHECKPOINT')||'{}');must(!cp.sheetId||cp.sheetId===c.sheetId,'CHECKPOINT_TARGET_CONFLICT');
   const deadline=Date.now()+180000,items=[];c.feeds.forEach(f=>items.push(...rss(f)));const index=new Map();for(const i of items){if(index.has(i.guid))index.set(i.guid,null);else index.set(i.guid,i);}
   const stage=cp.stage||0,priority=[[21],[15],[28],[23,45,50],[9,13,14],[10,11,12,40,41,42]];
   let next=cp.offset||0,processed=0,changed=0;const holds=[];
   for(;next<ctx.rows.length&&processed<Math.min(c.batchSize||10,10)&&Date.now()<deadline;next++){
    const row=ctx.rows[next];if(!priority[stage].some(col=>blank(row[col])))continue;let item=index.get(row[6]);
    processed++;
    try{const range="'エピソード台帳'!A"+(next+2)+':BC'+(next+2);const cells=api(c,'?includeGridData=true&ranges='+encodeURIComponent(range)).sheets[0].data[0].rowData[0].values;const evidence=official(item||{guid:row[6]});if(!item)item=fromJson(row,evidence.clip,evidence.url);item.platformEvidence=platforms(item,c.feeds.find(f=>f.url===item.feedUrl)||{});const p=plan(cells,item,evidence.clip,evidence.url);changed+=writePlan(c,ctx,next+1,cells,p);}
    catch(e){holds.push({id:row[0],reason:String(e.message)});}
    props.setProperty('LIB_OFFICIAL_CHECKPOINT',JSON.stringify({sheetId:c.sheetId,stage,offset:next+1,updatedAt:new Date().toISOString()}));
   }
   props.setProperty('LIB_OFFICIAL_CHECKPOINT',JSON.stringify({sheetId:c.sheetId,stage:next>=ctx.rows.length?(stage+1)%priority.length:stage,offset:next>=ctx.rows.length?0:next,updatedAt:new Date().toISOString()}));
   // Bounded summary; failed rows are revisited on subsequent sweeps, no silent permanent skip.
   props.setProperty('LIB_OFFICIAL_LAST_REPORT',JSON.stringify({processed,changed,holds:holds.slice(0,20),held:holds.length}));return {processed,changed,holds};
  }finally{lock.releaseLock();}
 }
 return {inspect,plan,material,verify,fromJson,newDecision,identityTokens,rowHash,v3RowHash,verifyRowProof,runBackfill,readJson,rss,official,platforms,config,context,cell,update,api,PROD};
})();
function inspectLibraryOfficialReadOnly(){const report=LibraryOfficialEngine.inspect();console.log(JSON.stringify(report));return report;}
function scheduledLibraryOfficialBackfill(){return LibraryOfficialEngine.runBackfill();}
/** New records have an atomic history reservation, so an interrupted retry cannot allocate again. */
function scheduledLibraryOfficialNew(){
 const E=LibraryOfficialEngine,lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {status:'BUSY'};
 try{
  const c=E.config(),inspection=E.inspect(),props=PropertiesService.getScriptProperties();
  if(c.engineValidation!=='P14_RUNTIME_VERIFIED')throw Error('ENGINE_NOT_VALIDATED');
  if(c.enabled!==true||c.allowNew!==true||c.otherWritersPaused!==true)throw Error('NEW_DISABLED_OR_WRITERS_UNCONFIRMED');
  if(inspection.triggers.some(t=>!/^scheduledLibraryOfficial/.test(t.handler)&&/library|backfill/i.test(t.handler)))throw Error('TRIGGER_CONFLICT');
  if(inspection.v3Config&&(inspection.v3Config.enabled||inspection.v3Config.allowNew||inspection.v3Config.allowEnrich))throw Error('V3_WRITER_ENABLED');
  if(!inspection.baseline?.complete)throw Error('BASELINE_NOT_READY');
  if(c.sheetId===E.PROD&&inspection.sheetId!==E.PROD)throw Error('V3_TARGET_CONFLICT');
  const all=[];for(const feed of c.feeds)all.push(...E.rss(feed));
  const frequencies=new Map();all.forEach(it=>frequencies.set(it.guid,(frequencies.get(it.guid)||0)+1));
  const candidates=all.filter(it=>frequencies.get(it.guid)===1&&Date.parse(it.pubDate)>Date.parse(c.newAfter)).sort((a,b)=>Date.parse(a.pubDate)-Date.parse(b.pubDate));
  const report={added:[],held:[...frequencies].filter(([,n])=>n>1).map(([guid])=>({guid,reason:'AMBIGUOUS_FEED_IDENTITY'})),existing:0},deadline=Date.now()+180000;
  for(const item of candidates){
   if(Date.now()>deadline||report.added.length>=Math.min(c.newBatchSize||1,10))break;
   try{
    let ctx=E.context(c);
    if(ctx.rows.some(r=>E.identityTokens(r).includes(item.guid.toLowerCase()))||ctx.history.some(r=>r[0]===item.guid)){report.existing++;continue;}
    if(c.onlyGuid&&c.onlyGuid!==item.guid)continue;
    const evidence=E.official(item);item.platformEvidence=E.platforms(item,c.feeds.find(f=>f.url===item.feedUrl)||{});const m=E.material(item,evidence.clip,evidence.url);
    // Re-read all identity stores after the network fetch, before reserving any ID.
    ctx=E.context(c);
    const reservations=ctx.states.map(r=>{const identity=JSON.parse(r[1]||'{}').identity;return [identity?.[1]||'',r[0]];});
    const id=E.newDecision(item,ctx.rows,ctx.history.concat(reservations),ctx.excluded,ctx.decisions,c,inspection.baseline,props.getProperty('LIB_V3_LAST_ID'));
    const row=Array(55).fill('');Object.entries(m.values).forEach(([k,v])=>row[Number(k)]=v);
    Object.assign(row,{0:id,1:item.show,2:item.title,3:new Date(Date.parse(item.pubDate)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' '),4:'音声',5:'朝日新聞ポッドキャスト公式RSS（Omny Studio）',6:item.guid,8:item.link,18:'未確認（未再生）',38:'未指定'});
    const now=new Date().toISOString(),state={identity:['VERIFIED',item.guid,E.rowHash(row),'','','RSS_registered',now,item.guid],registrationEvidence:['VERIFIED',item.guid,E.rowHash(row),'','','official_rss_plus_json',now,JSON.stringify({source:item.feedUrl,json:evidence.url,pubDate:item.pubDate})]};
    const ledger=ctx.tabs['エピソード台帳'],history=ctx.tabs['固定ID採番履歴'],states=ctx.tabs['図書館V3・項目状態'],requests=[];
    const positions=[[ledger,ctx.rows.length+1],[history,ctx.history.length+1],[states,ctx.stateLength]];
    for(const [tab,index]of positions)if(index>=tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:index-tab.gridProperties.rowCount+1}});
    // Copy only format and validation; no values, hyperlinks or row-specific chips.
    for(const pasteType of ['PASTE_FORMAT','PASTE_DATA_VALIDATION'])requests.push({copyPaste:{source:{sheetId:ledger.sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:55},destination:{sheetId:ledger.sheetId,startRowIndex:ctx.rows.length+1,endRowIndex:ctx.rows.length+2,startColumnIndex:0,endColumnIndex:55},pasteType}});
    row.forEach((v,col)=>{const data=E.cell(v);if(col===28&&v)data.textFormatRuns=E.articleLinkRuns(m.links);if(col===21)data.note=JSON.stringify({source:item.feedUrl,guid:item.guid,raw:true});requests.push(E.update(ledger.sheetId,ctx.rows.length+1,col,data));});
    [item.guid,id,item.show,item.title,'登録完了',now].forEach((v,col)=>requests.push(E.update(history.sheetId,ctx.history.length+1,col,E.cell(v))));
    [id,JSON.stringify(state),now].forEach((v,col)=>requests.push(E.update(states.sheetId,ctx.stateLength,col,E.cell(v))));
    E.api(c,':batchUpdate',{requests});
    const check=E.context(c);if(check.rows.filter(r=>r[0]===id&&r[6]===item.guid).length!==1||check.history.filter(r=>r[0]===item.guid&&r[1]===id).length!==1)throw Error('REGISTRATION_READBACK_FAILED');
    props.setProperty('LIB_V3_LAST_ID',String(Number(id.slice(3))));report.added.push(id);
   }catch(e){report.held.push({guid:item.guid,reason:String(e.message)});}
  }
  props.setProperty('LIB_OFFICIAL_NEW_LAST_SUCCESS',String(Date.now()));props.setProperty('LIB_OFFICIAL_NEW_REPORT',JSON.stringify(report));return report;
 }finally{lock.releaseLock();}
}
/** Run only after online source review, copy test and production smoke evidence are recorded. */
function installLibraryOfficialTriggersAfterValidation(){
 const E=LibraryOfficialEngine,c=E.config(),s=E.inspect();
 if(c.engineValidation!=='P14_RUNTIME_VERIFIED')throw Error('ENGINE_NOT_VALIDATED');
 if(c.enabled!==true||c.copyVerified!==true||c.productionSmokeVerified!==true||c.otherWritersPaused!==true||!s.baseline?.complete)throw Error('VALIDATION_REQUIRED');
 if(s.triggers.length)throw Error('EXISTING_TRIGGERS_REVIEW_REQUIRED');
 if(s.v3Config&&(s.v3Config.enabled||s.v3Config.allowNew||s.v3Config.allowEnrich))throw Error('V3_WRITER_ENABLED');
 // Hourly also covers 06:35 releases; GAS time triggers have a scheduling window.
 const added=[];try{
  added.push(ScriptApp.newTrigger('scheduledLibraryOfficialNew').timeBased().everyHours(1).create());
  added.push(ScriptApp.newTrigger('scheduledLibraryOfficialBackfill').timeBased().everyHours(2).create());
 }catch(e){added.forEach(t=>ScriptApp.deleteTrigger(t));throw e;}
 return E.inspect();
}
/** READ_ONLY native GAS diagnosis. Does not change any saved proof or cell. */
function inspectLibraryOfficialCopyHashesReadOnly(){
 const ids=['1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY',LibraryOfficialEngine.PROD];
 const out={mode:'READ_ONLY',scriptId:ScriptApp.getScriptId(),books:[]};
 ids.forEach(id=>{
  const ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName('エピソード台帳');
  const rows=sh.getRange(142,1,10,sh.getLastColumn()).getValues();
  const states=ss.getSheetByName('図書館V3・項目状態').getDataRange().getValues();
  const book={id,timezone:ss.getSpreadsheetTimeZone(),width:sh.getLastColumn(),rows:[]};
  rows.forEach(row=>{
   const savedRow=states.find(r=>r[0]===row[0]);if(!savedRow)throw Error('STATE_MISSING');
   const state=JSON.parse(savedRow[1]),saved=state.identity[2],matchingWidths=[];
   for(let w=1;w<=row.length;w++)if(LibraryOfficialEngine.v3RowHash(row.slice(0,w))===saved)matchingWidths.push(w);
   book.rows.push({id:row[0],saved,full:LibraryOfficialEngine.v3RowHash(row),first51:LibraryOfficialEngine.v3RowHash(row.slice(0,51)),utf8:LibraryOfficialEngine.rowHash(row.slice(0,51)),matchingWidths,types:row.map(v=>v instanceof Date?'Date':typeof v),dates:row.map((v,i)=>v instanceof Date?{col:i+1,iso:v.toISOString()}:null).filter(Boolean)});
  });out.books.push(book);
 });out.books.forEach(b=>{console.log(JSON.stringify({id:b.id,width:b.width,timezone:b.timezone}));b.rows.forEach(r=>console.log(JSON.stringify(r)));});return out;
}

/** Copy-only network/parser probe. No cell, property or trigger writes. */
function inspectLibraryOfficialCopyNetworkReadOnly(){
 const E=LibraryOfficialEngine,c={sheetId:'1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY'};
 const ss=SpreadsheetApp.openById(c.sheetId),rows=ss.getSheetByName('エピソード台帳').getRange(142,1,10,55).getValues();
 const feed={url:rows[0][44],show:rows[0][1]},items=E.rss(feed);
 const report={mode:'COPY_READ_ONLY',rssItems:items.length,rssParsed:0,jsonVerified:0,copyPlannedCells:0,writes:0,rows:[]};
 if(items.length){const ev=E.official(items[0]);E.material(items[0],ev.clip,ev.url);report.rssParsed=1;}
 for(let i=0;i<rows.length;i++){
  const r=rows[i],ev=E.official({guid:r[6]}),item=E.fromJson(r,ev.clip,ev.url);
  const range="'エピソード台帳'!A"+(142+i)+':BC'+(142+i);
  const cells=E.api(c,'?includeGridData=true&ranges='+encodeURIComponent(range)).sheets[0].data[0].rowData[0].values;
  const p=E.plan(cells,item,ev.clip,ev.url);report.jsonVerified++;report.copyPlannedCells+=p.changes.length;
  report.rows.push({id:r[0],guid:r[6],rawLength:item.description.length,changes:p.changes.map(x=>x.col+1),preserved:p.conflicts.length});
 }
 console.log(JSON.stringify(report));return report;
}
