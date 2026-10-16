/** Bounded replacement for the unified controller only. V1/manual pilots unchanged.
 * Cache is disposable; checkpoint is durable. A changed snapshot replays from zero.
 * No new rows, fuzzy identity, Spotify search, audio download or trigger changes.
 */
function previewLibraryV2Checkpoint() { return libV2CheckpointRun_(false); }
function writeLibraryV2CheckpointPilot10() { return libV2CheckpointRun_(true); }
function libV2CpNorm_(v) { return String(v == null ? '' : v).normalize('NFKC').replace(/\s+/g,' ').trim(); }
function libV2CpGuid_(v) {
  const s=libV2CpNorm_(v), m=s.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i);
  return (m ? m[0] : s).toLowerCase();
}
function libV2CpBlocked_(v) { const s=libV2CpNorm_(v).toLowerCase(); return !!s && !['未指定','なし','false','0','no'].includes(s); }
function libV2CpDate_(v) {
  if(v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v,'Asia/Tokyo','yyyy-MM-dd');
  const m=String(v||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return m ? m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0') : '';
}
function libV2CpClip_(v) {
  const s=String(v||'');
  if(!/^https:\/\/(?:(?:traffic\.)?omny\.fm|(?:www\.)?omnycontent\.com)\//i.test(s))return '';
  const m=s.match(/\/clips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/([0-9a-f-]{36})(?:[/?#]|$)/i)||s.match(/\/(?:episode|shows\/[^/?#]+)\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  return m ? libV2CpGuid_(m[1]) : '';
}
function libV2CpHash_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s)); }
function libV2CpParse_(text) {
  const ch=XmlService.parse(text).getRootElement().getChild('channel');
  if(!ch)throw Error('RSS channel missing');
  return ch.getChildren('item').map(item=>{
    const d=new Date(String(item.getChildText('pubDate')||''));
    const person=item.getChildren().filter(n=>n.getName()==='person' && n.getNamespace().getURI()==='https://podcastindex.org/namespace/1.0');
    // Only explicitly labelled cast; authors/producers are not inferred as speakers.
    const cast=person.filter(n=>['host','guest'].includes(String(n.getAttribute('role')?.getValue()||'').toLowerCase())).map(n=>libV2CpNorm_(n.getText())).filter(Boolean);
    const links=[item.getChildText('link'),...item.getChildren().filter(n=>n.getName()==='episode' && n.getNamespace().getURI()==='https://www.spotify.com/ns/rss').map(n=>n.getText())];
    const spotify=[...new Set(links.filter(x=>/^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}$/.test(String(x||''))))];
    return {guid:libV2CpGuid_(item.getChildText('guid')),title:libV2CpNorm_(item.getChildText('title')),
      date:isNaN(d.getTime())?'':Utilities.formatDate(d,'Asia/Tokyo','yyyy-MM-dd'),
      audio:item.getChild('enclosure')?.getAttribute('url')?.getValue()||'',
      description:String(item.getChildText('description')||'').trim().replace(/\r\n?|\n/g,'\\n'),
      cast:[...new Set(cast)].join('、'),spotify:spotify.length===1?spotify[0]:''};
  });
}
/** A failed HTTP request never advances a cursor. No blocking sleep / shortened Retry-After. */
function libV2CpHttp_(url, headers, retry, now) {
  if(retry?.stopped)return {status:'STOPPED_HTTP',http:retry.http,retry};
  if(retry?.at>now)return {status:'RETRY_WAIT',retry};
  const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,headers:headers||{}}), code=res.getResponseCode();
  if(code===200||code===304)return {status:'OK',res,http:code};
  const h=res.getAllHeaders(), k=Object.keys(h).find(k=>k.toLowerCase()==='retry-after'), raw=k?String(h[k]):'';
  const attempt=(retry?.attempt||0)+1;
  const delay=/^\d+$/.test(raw)?Number(raw)*1000:Math.max(0,Date.parse(raw)-now)||0;
  const stopped=![429,503].includes(code)||attempt>=5;
  return {status:stopped?'STOPPED_HTTP':'RETRY_WAIT',http:code,retry:{http:code,attempt,stopped,at:now+Math.max(delay,Math.min(3600000,60000*Math.pow(2,attempt-1)))}};
}
function libV2CpSnapshot_(url, write, state, metrics) {
  const cache=CacheService.getScriptCache(), key='LV2CP:'+libV2CpHash_(url), now=Date.now();
  let meta=JSON.parse(cache.get(key)||'null'), text='';
  if(meta) {
    for(let i=0;i<meta.parts;i++) { const p=cache.get(key+':'+meta.hash+':'+i); if(p===null){meta=null;break;} text+=p; }
    if(meta && libV2CpHash_(text)!==meta.hash)meta=null;
  }
  if(meta && ((state.hash===meta.hash && state.offset>0) || now-meta.at<15*60*1000)){metrics.cacheHits++;return {items:JSON.parse(text),hash:meta.hash};}
  const headers={Accept:'application/rss+xml, application/xml, text/xml'};
  if(meta?.etag)headers['If-None-Match']=meta.etag;
  if(meta?.modified)headers['If-Modified-Since']=meta.modified;
  // Retry state is tied to the feed URL by the caller.
  const http=libV2CpHttp_(url,headers,state.retry,now);
  if(http.status!=='OK')return http;
  metrics.apiCalls++; // Network attempts including failures are counted by caller adjustment below.
  if(http.http===304&&!meta)throw Error('304 without complete cached snapshot');
  const items=http.http===304?JSON.parse(text):libV2CpParse_(http.res.getContentText('UTF-8'));
  const serialized=JSON.stringify(items),hash=libV2CpHash_(serialized);
  metrics.fetchedItems=http.http===200?items.length:0;
  if(write) {
    const h=http.res.getAllHeaders(),get=n=>{const k=Object.keys(h).find(k=>k.toLowerCase()===n);return k?String(h[k]):'';};
    const parts=Math.ceil(serialized.length/18000);
    if(parts>800)throw Error('RSS snapshot exceeds bounded cache budget');
    for(let i=0;i<parts;i++)cache.put(key+':'+hash+':'+i,serialized.slice(i*18000,(i+1)*18000),21600);
    // Publish manifest last. Missing/evicted parts always cause refetch + safe replay.
    cache.put(key,JSON.stringify({hash,parts,at:now,etag:get('etag')||meta?.etag||'',modified:get('last-modified')||meta?.modified||''}),21600);
  }
  return {items,hash,fetched:true};
}
function libV2CheckpointRun_(write) {
  const start=Date.now(), deadline=start+120000, lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {status:'SKIPPED_ALREADY_RUNNING',writtenCells:0};
  const m={apiCalls:0,cacheHits:0,fetchedItems:0,inspected:0,proposedCells:0,writtenCells:0,updatedIds:[],holds:0};
  try {
    const props=PropertiesService.getScriptProperties(),stateKey='LIB_V2_CHECKPOINT_V1';
    const state=JSON.parse(props.getProperty(stateKey)||'{}');
    const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳'),src=ss.getSheetByName('取得元一覧'),ex=ss.getSheetByName('削除・除外履歴'),history=ss.getSheetByName('自動補完・実行履歴');
    if(!sh||!src||!ex||!history)throw Error('Required library tab missing');
    const rows=sh.getDataRange().getValues(),headers=rows.shift();
    const required={0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',6:'外部ID',8:'元ページURL',11:'Spotify個別URL',14:'音声URL',21:'概要原文',23:'出演者・スタッフ',32:'取得元URL',38:'人間除外'};
    Object.keys(required).forEach(c=>{if(headers[c]!==required[c])throw Error('Header mismatch '+c);});
    const expected=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
    const historyHeaders=history.getRange(1,1,1,10).getValues()[0];
    if(expected.some((v,i)=>historyHeaders[i]!==v))throw Error('History header mismatch');
    const conflicts=['scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10','scheduledLibraryMetadataBackfillV2Hourly','scheduledLibraryV2FastAutomation','writeLibraryV2OmnyClipGuidPilot10'];
    if(write && ScriptApp.getProjectTriggers().some(t=>conflicts.includes(t.getHandlerFunction())))throw Error('Conflicting writer trigger');
    const feeds=new Map();
    src.getDataRange().getValues().slice(1).forEach(r=>{const u=String(r[7]||'').trim(),show=libV2CpNorm_(r[0]);if(/^https:\/\//.test(u)&&!/youtube\.com|youtu\.be/i.test(u)){if(feeds.has(u)&&feeds.get(u)!==show)throw Error('Conflicting feed show');feeds.set(u,show);}});
    const urls=[...feeds.keys()].sort(); if(!urls.length)throw Error('No feeds');
    const url=urls.includes(state.url)?state.url:urls[0];
    if(state.url!==url){state.url=url;state.offset=0;state.hash='';delete state.retry;}
    const before=Date.now(),snap=libV2CpSnapshot_(url,write,state,m);
    if(snap.status){if(!state.retry?.stopped && !(state.retry?.at>before))m.apiCalls++;if(write){state.retry=snap.retry;props.setProperty(stateKey,JSON.stringify(state));}return Object.assign(m,{status:snap.status,retry:snap.retry});}
    delete state.retry;
    if(state.hash!==snap.hash){state.hash=snap.hash;state.offset=0;}
    // Fetch/parse is its own stage: never write after an unbounded network operation.
    if(snap.fetched && write){props.setProperty(stateKey,JSON.stringify(state));return Object.assign(m,{status:'SNAPSHOT_READY'});}
    const idx=new Map(),clips=new Map(),ids=new Map(),spotifyOwners=new Map();
    rows.forEach((r,i)=>{for(const [map,k] of [[idx,libV2CpGuid_(r[6])],[clips,libV2CpClip_(r[8])||libV2CpClip_(r[32])],[ids,String(r[0])],[spotifyOwners,String(r[11]||'')]]){if(k){if(!map.has(k))map.set(k,[]);map.get(k).push(i);}}});
    const deleted=()=>{const gs=new Set(),is=new Set();ex.getDataRange().getValues().slice(1).forEach(r=>{gs.add(libV2CpGuid_(r[0]));is.add(String(r[1]||'').trim());});return {gs,is};};
    const tomb=deleted(), counts=new Map();snap.items.forEach(it=>counts.set(it.guid,(counts.get(it.guid)||0)+1));
    let offset=Math.max(0,Number(state.offset)||0),episodes=0;
    while(offset<snap.items.length && m.inspected<200 && episodes<10 && Date.now()<deadline-15000) {
      const it=snap.items[offset],matches=idx.get(it.guid)||clips.get(it.guid)||[];m.inspected++;
      if(!it.guid||counts.get(it.guid)!==1||matches.length!==1){m.holds++;offset++;continue;}
      const i=matches[0],r=rows[i],id=String(r[0]),a=libV2CpClip_(r[8]),b=libV2CpClip_(r[32]);
      if((r[14] && it.audio && String(r[14])!==it.audio)||(r[11] && it.spotify && String(r[11])!==it.spotify)||!/^EP-\d+$/.test(id)||ids.get(id).length!==1||libV2CpBlocked_(r[38])||tomb.gs.has(it.guid)||tomb.is.has(id)||libV2CpNorm_(r[1])!==feeds.get(url)||libV2CpNorm_(r[2])!==it.title||!it.date||libV2CpDate_(r[3])!==it.date|| (a&&b&&a!==b)|| (r[6]&&libV2CpGuid_(r[6])!==it.guid)) {m.holds++;offset++;continue;}
      const fields=[[7,it.guid],[15,/^https:\/\//.test(it.audio)?it.audio:''],[22,it.description],[24,it.cast],[12,it.spotify]]
        .filter(([c,v])=>v&&!String(r[c-1]||'').trim() && (c!==12||!spotifyOwners.has(v)));
      if(fields.length){
        episodes++;m.proposedCells+=fields.length;
        if(write){
          // Repeat identity, tombstones, formula/blank checks immediately before each cell.
          for(const [col,value] of fields){
            if(Date.now()>=deadline-10000)break;
            const latest=sh.getRange(i+2,1,1,39).getValues()[0],dt=deleted();
            if([0,1,2,3,6,8,11,14,21,23,32,38].some(c=>String(latest[c])!==String(r[c]))||dt.gs.has(it.guid)||dt.is.has(id))throw Error('Row changed before write '+id);
            const cell=sh.getRange(i+2,col);
            if(String(cell.getValue()||'').trim()||cell.getFormula())continue;
            // Rich RSS text must never become a spreadsheet formula.
            const stored=/^[=+\-@]/.test(String(value))?"'"+value:value;
            cell.setValue(stored);SpreadsheetApp.flush();
            if(String(cell.getValue())!==String(value))throw Error('Postwrite verification failed '+id);
            r[col-1]=value;m.writtenCells++;
            if(col===12)spotifyOwners.set(value,[i]);
            if(!m.updatedIds.includes(id))m.updatedIds.push(id);
          }
        }
      }
      // A partially filled row is safe to replay: retain item until every proposed cell handled.
      if(write && fields.some(([c])=>!String(r[c-1]||'').trim()))break;
      offset++;
    }
    if(write){
      history.appendRow([new Date(),'V2_CHECKPOINT',m.updatedIds.length,m.writtenCells,m.holds,m.updatedIds.join(','),url,'',Math.round((Date.now()-start)/1000),JSON.stringify({offset,apiCalls:m.apiCalls,cacheHits:m.cacheHits,fetchedItems:m.fetchedItems})]);
      state.offset=offset;
      if(offset>=snap.items.length){state.url=urls[(urls.indexOf(url)+1)%urls.length];state.offset=0;state.hash='';}
      props.setProperty(stateKey,JSON.stringify(state)); // only after verified writes + audit
    }
    return Object.assign(m,{status:write?'CHECKPOINTED':'READ_ONLY',feed:url,nextOffset:offset,completeFeed:offset>=snap.items.length});
  } finally {m.elapsedMs=Date.now()-start;Logger.log(JSON.stringify(m));lock.releaseLock();}
}

/** Optional exact-ID Spotify read adapter. Not invoked by RSS enrichment, which
 * uses only explicit episode links. Caller persists returned retry state and must
 * not advance its boundary until VERIFIED. Never accepts search/fuzzy results.
 * A token is supplied by the caller; no token refresh or credential logging here.
 */
function libV2CpSpotifyRead_(id, accessToken, retry) {
  if(!/^[A-Za-z0-9]{22}$/.test(String(id))||!accessToken)throw Error('Spotify exact ID/token required');
  const http=libV2CpHttp_('https://api.spotify.com/v1/episodes/'+id+'?market=JP',{Authorization:'Bearer '+accessToken},retry,Date.now());
  if(http.status!=='OK')return {status:http.status,http:http.http,retry:http.retry};
  if(http.http!==200)throw Error('Spotify expected HTTP 200');
  const data=JSON.parse(http.res.getContentText());
  if(data.id!==id || data.type!=='episode' || data.external_urls?.spotify!=='https://open.spotify.com/episode/'+id)throw Error('Spotify identity response mismatch');
  return {status:'VERIFIED',episode:data};
}
