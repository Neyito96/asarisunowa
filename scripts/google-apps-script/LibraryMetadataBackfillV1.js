/** Library existing-row metadata backfill. DRY RUN by default.
 * Separate from playlist automation. No trigger installation.
 * RSS is fetched once per run; never downloads audio.
 */
const LIB_META_ID_ = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
function previewLibraryMetadataBackfill10() { return libraryMetadataBackfill_(10, false); }
function writeLibraryMetadataBackfill10() { return libraryMetadataBackfill_(10, true); }
/** One safe scheduled batch; manually install trigger only after reviewing the next preview. */
function scheduledLibraryMetadataBackfill10() { return libraryMetadataBackfill_(10, true); }
function installLibraryMetadataHourlyTrigger() {
  const fn='scheduledLibraryMetadataBackfill10';
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===fn);
  if(existing.length) { Logger.log('Hourly trigger already installed'); return; }
  ScriptApp.newTrigger(fn).timeBased().everyHours(1).create();
  Logger.log('Hourly metadata backfill trigger installed');
}
function stopLibraryMetadataHourlyTrigger() {
  const fn='scheduledLibraryMetadataBackfill10';
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===fn).forEach(t=>ScriptApp.deleteTrigger(t));
  Logger.log('Hourly metadata backfill trigger stopped');
}
/** Install one one-shot preview trigger, approximately one minute after invocation. */
function scheduleLibraryMetadataPreviewOnce() {
  const fn='previewLibraryMetadataBackfill10';
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===fn).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(fn).timeBased().after(60*1000).create();
  Logger.log('One-shot read-only RSS preview trigger installed');
}
function libraryMetadataBackfill_(limit, write) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000)) throw Error('Library lock unavailable');
  try {
    const ss=SpreadsheetApp.openById(LIB_META_ID_);
    const sh=ss.getSheetByName('エピソード台帳');
    const sources=ss.getSheetByName('取得元一覧');
    if(!sh || !sources) throw Error('Missing library tabs');
    const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    const expected={0:'台帳ID',6:'外部ID',14:'音声URL',15:'再生時間（秒）',21:'概要原文',22:'概要清掃済み'};
    Object.keys(expected).forEach(k=>{if(headers[+k]!==expected[k]) throw Error('Header mismatch '+k+': '+headers[k]);});
    const last=sh.getLastRow(), data=last>1?sh.getRange(2,1,last-1,sh.getLastColumn()).getValues():[];
    const sourceRows=sources.getDataRange().getValues().slice(1);
    const feeds=[...new Set(sourceRows.map(r=>String(r[7]||'').trim()).filter(u=>/^https:\/\//.test(u) && !/youtube\.com|youtu\.be/i.test(u)))];
    const result={mode:write?'WRITE':'DRY_RUN',scanned:data.length,feeds:feeds.length,proposals:[],missingAudio:[],conflicts:[],written:0};
    // Rotate the first RSS source between runs; avoid starving later shows.
    const props=PropertiesService.getScriptProperties();
    const cursorKey='LIB_META_FEED_CURSOR_V1';
    const cursor=Math.max(0,Number(props.getProperty(cursorKey)||0))%Math.max(1,feeds.length);
    const orderedFeeds=feeds.slice(cursor).concat(feeds.slice(0,cursor));
    result.startFeedIndex=cursor;
    let visited=0;
    if(write && limit!==10) throw Error('Only a 10-row pilot write is authorized');
    const lookup=new Map();
    data.forEach((r,i)=>{
      const id=String(r[6]||'').trim().toLowerCase();
      if(id){if(!lookup.has(id)) lookup.set(id,[]);lookup.get(id).push({row:i+2,values:r});}
    });
    for(const feed of orderedFeeds){
      if(result.proposals.length>=limit) break;
      visited++;
      let response;
      try {response=UrlFetchApp.fetch(feed,{muteHttpExceptions:true,headers:{Accept:'application/rss+xml, application/xml, text/xml'}});}
      catch(error){result.conflicts.push({feed,reason:'Fetch failed: '+String(error)});continue;}
      if(response.getResponseCode()!==200){result.conflicts.push({feed,reason:'HTTP '+response.getResponseCode()});continue;}
      const root=XmlService.parse(response.getContentText('UTF-8')).getRootElement();
      const channel=root.getChild('channel');
      if(!channel){result.conflicts.push({feed,reason:'No channel'});continue;}
      for(const item of channel.getChildren('item')){
        if(result.proposals.length>=limit) break;
        const guid=String(item.getChildText('guid')||'').trim();
        const guidClip=guid.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);
        const key=guidClip?guidClip[1].toLowerCase():guid;
        const matches=lookup.get(key)||[];
        if(matches.length!==1) continue; // No title/date fuzzy writes or multi-match overwrites.
        const entry=matches[0], r=entry.values;
        if(String(r[38]||'').trim() && !['未指定','なし','false','0','no'].includes(String(r[38]).trim().toLowerCase())) continue;
        const enclosure=item.getChild('enclosure');
        const audio=enclosure&&enclosure.getAttribute('url')?enclosure.getAttribute('url').getValue():'';
        const description=String(item.getChildText('description')||'').trim();
        // Reject likely false matches: GUID alone may be reused or misfiled.
        const title=String(item.getChildText('title')||'').trim();
        const norm=t=>String(t||'').normalize('NFKC').replace(/\s+/g,' ').trim();
        if(norm(title)!==norm(r[2])) {result.conflicts.push({id:r[0],feed,reason:'GUID/title mismatch'});continue;}
        const durationNode=item.getChildren().find(x=>x.getName()==='duration' && x.getNamespace().getPrefix()==='itunes');
        const durationText=durationNode?String(durationNode.getText()||'').trim():'';
        const durationSeconds=/^\d+$/.test(durationText)?Number(durationText):(/^\d+:\d{2}(?::\d{2})?$/.test(durationText)?durationText.split(':').map(Number).reduce((a,b)=>a*60+b,0):null);
        const image=item.getChildren().find(x=>x.getName()==='image' && x.getNamespace().getPrefix()==='itunes');
        const imageUrl=image&&image.getAttribute('href')?image.getAttribute('href').getValue():'';
        const proposed=[];
        // T=音源不在の根拠: record only verified RSS items lacking enclosure.
        // Do not label blank ledger audio as nonexistent merely because RSS lookup failed.
        const isSdgs=/SDGs|こどもそうだんしつ|旧SDGs/i.test(String(r[1]||'')+' '+feed);
        if(!audio && !String(r[14]||'').trim()) {
          result.missingAudio.push({id:r[0],row:entry.row,feed,reason:'RSS enclosure URL missing',sdgsReview:isSdgs});
          if(!isSdgs && !String(r[19]||'').trim()) proposed.push({column:20,value:'公式RSSのenclosure URLなし（未再生・要再確認）'});
          if(isSdgs) result.conflicts.push({id:r[0],reason:'SDGs/こどもそうだんしつ: 音源不在は要手動確認'});
        }
        [[15,audio],[22,description],[14,imageUrl],[16,durationSeconds]].forEach(([col,value])=>{
          if(value !== null && value !== '' && !String(r[col-1]||'').trim()) proposed.push({column:col,value:value});
        });
        if(proposed.length) result.proposals.push({id:r[0],row:entry.row,feed,fields:proposed.map(p=>({column:p.column,preview:String(p.value).slice(0,90)})),_fields:proposed});
      }
    }
    if(write){
      if(result.proposals.length===0) {
        result.status='NO_CANDIDATES';
        if(feeds.length) props.setProperty(cursorKey,String((cursor+Math.max(1,visited))%feeds.length));
        result.nextFeedIndex=feeds.length?(cursor+Math.max(1,visited))%feeds.length:0;
        Logger.log(JSON.stringify(result));
        return result;
      }
      if(result.conflicts.length) throw Error('Conflicts detected; refusing write');
      for(const p of result.proposals){
        const id=sh.getRange(p.row,1).getValue();
        if(id!==p.id) throw Error('Row moved: '+p.id);
        if(String(sh.getRange(p.row,39).getValue()||'').trim() && !['未指定','なし','false','0','no'].includes(String(sh.getRange(p.row,39).getValue()).trim().toLowerCase())) throw Error('Human exclusion: '+p.id);
        for(const f of p._fields){
          const cell=sh.getRange(p.row,f.column);
          if(String(cell.getValue()||'').trim()) continue;
          cell.setValue(f.value);
          result.written++;
        }
      }
    }
    // Advance cursor only after a successful write. Dry runs must never mutate progress.
    if(write && feeds.length) props.setProperty(cursorKey,String((cursor+Math.max(1,visited))%feeds.length));
    result.nextFeedIndex=feeds.length?(cursor+Math.max(1,visited))%feeds.length:0;
    result.proposals.forEach(p=>delete p._fields);
    Logger.log(JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}
