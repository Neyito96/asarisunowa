/**
 * Phase 14 — Megaphone new-episode adapter, v0.1.
 * COPY-ONLY / READ-ONLY. No EP-ID allocation, Sheets writes, properties or triggers.
 * Do not call scheduledLibraryOfficialNew: that path is Omny-only.
 */
var LibraryMegaphoneAdapter = (function () {
  'use strict';
  const COPY_ID='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
  const FEED_RE=/^https:\/\/feeds\.megaphone\.fm\/TASC[A-Za-z0-9]+$/;
  const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const canonical=x=>String(x==null?'':x).trim().toLowerCase();
  const text=x=>String(x==null?'':x).trim();
  function requireCopy(ss){
    if(ss.getId()!==COPY_ID)throw Error('COPY_ONLY_GUARD');
    const ledger=ss.getSheetByName('エピソード台帳');
    const sources=ss.getSheetByName('取得元一覧');
    if(!ledger||!sources)throw Error('REQUIRED_COPY_TABS_MISSING');
    return {ledger,sources};
  }
  function feeds(source){
    const all=source.getRange(2,1,7,8).getValues().map(r=>({show:text(r[0]),url:text(r[7])}));
    if(all.length!==7||all.some(x=>!x.show||!x.url))throw Error('SEVEN_FEEDS_INVALID');
    const selected=all.filter(x=>FEED_RE.test(x.url));
    if(selected.length!==2||new Set(selected.map(x=>x.show)).size!==2)throw Error('TWO_MEGAPHONE_FEEDS_REQUIRED');
    return selected;
  }
  function parse(feed,xml,since,now){
    const root=XmlService.parse(xml).getRootElement(),channel=root.getChild('channel');
    if(!channel)throw Error('CHANNEL_MISSING');
    const itunes=XmlService.getNamespace('http://www.itunes.com/dtds/podcast-1.0.dtd');
    return channel.getChildren('item').map(item=>{
      const guid=text(item.getChildText('guid')),title=text(item.getChildText('title'));
      const date=text(item.getChildText('pubDate')),publishedMs=Date.parse(date);
      const audio=text(item.getChild('enclosure')?.getAttribute('url')?.getValue());
      const link=text(item.getChildText('link'));
      const duration=text(item.getChildText('duration',itunes));
      const description=text(item.getChildText('description'));
      return {show:feed.show,feedUrl:feed.url,guid,title,publishedMs,
        published:Number.isFinite(publishedMs)?new Date(publishedMs).toISOString():null,
        audio,link,duration,description};
    }).filter(x=>Number.isFinite(x.publishedMs)&&x.publishedMs>=since&&x.publishedMs<=now);
  }
  function identityIndex(ss,ledger){
    const values=ledger.getDataRange().getValues(),header=values.shift()||[];
    if(header[0]!=='台帳ID'||header.length<55)throw Error('LEDGER_SCHEMA_UNEXPECTED');
    const ids=new Set(),tokens=new Set(),titleDates=new Set(),audioUrls=new Set();
    values.forEach(row=>{
      if(row[0])ids.add(text(row[0]));
      [6,51].forEach(i=>{if(row[i])tokens.add(canonical(row[i]));});
      if(row[14])audioUrls.add(text(row[14]));
      if(row[2]&&row[3])titleDates.add(canonical(row[2])+'|'+String(row[3]));
    });
    const history=ss.getSheetByName('固定ID採番履歴');
    if(history)history.getDataRange().getValues().slice(1).forEach(row=>{if(row[0])tokens.add(canonical(row[0]));});
    const excluded=ss.getSheetByName('削除・除外履歴');
    if(excluded)excluded.getDataRange().getValues().slice(1).forEach(row=>row.forEach(v=>{
      if(UUID_RE.test(text(v)))tokens.add(canonical(v));
    }));
    const state=ss.getSheetByName('図書館V3・項目状態');
    if(state)state.getDataRange().getValues().slice(1).forEach(row=>{
      try {const j=JSON.parse(row[1]||'{}');if(UUID_RE.test(text(j.identity?.[1])))tokens.add(canonical(j.identity[1]));}
      catch(e){throw Error('STATE_PARSE_ERROR_'+text(row[0]));}
    });
    return {ids,tokens,titleDates,audioUrls,rows:values.length};
  }
  function check(item,index,frequency){
    const holds=[];
    if(!UUID_RE.test(item.guid))holds.push('GUID_INVALID');
    if(!item.title)holds.push('TITLE_MISSING');
    if(!item.audio||!/^https:\/\//i.test(item.audio))holds.push('AUDIO_URL_INVALID');
    if(frequency.get(canonical(item.guid))!==1)holds.push('DUPLICATE_WITHIN_FEEDS');
    if(index.tokens.has(canonical(item.guid)))holds.push('GUID_ALREADY_RECORDED');
    if(index.audioUrls.has(item.audio))holds.push('AUDIO_ALREADY_RECORDED');
    // A missing item link is an expected Megaphone feed characteristic, not a hold.
    // Never substitute the generic channel URL for an episode page.
    if(item.link&&!/^https:\/\//i.test(item.link))holds.push('EPISODE_LINK_INVALID');
    // Title/date collisions are advisory: ledger dates have native JST representations.
    const sameTitle=index.titleDates.has(canonical(item.title)+'|'+item.published);
    return {status:holds.length?'HOLD':'METADATA_CANDIDATE',
      holds,possibleTitleDateCollision:sameTitle,
      guid:item.guid,show:item.show,title:item.title,published:item.published,
      hasAudio:!!item.audio,hasEpisodeLink:!!item.link,
      hasDescription:!!item.description,hasDuration:!!item.duration};
  }
  function inspect(){
    const ss=SpreadsheetApp.openById(COPY_ID),tabs=requireCopy(ss),selected=feeds(tabs.sources);
    const index=identityIndex(ss,tabs.ledger),now=Date.now(),since=now-7*86400000;
    const all=[],errors=[];
    selected.forEach(feed=>{
      try{
        const r=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});
        if(r.getResponseCode()!==200)throw Error('HTTP_'+r.getResponseCode());
        all.push(...parse(feed,r.getContentText(),since,now));
      }catch(e){errors.push({show:feed.show,error:String(e.message)});}
    });
    const frequency=new Map();all.forEach(x=>frequency.set(canonical(x.guid),(frequency.get(canonical(x.guid))||0)+1));
    const checked=all.map(x=>check(x,index,frequency)).sort((a,b)=>a.published.localeCompare(b.published)||a.guid.localeCompare(b.guid));
    const summary={mode:'COPY_READ_ONLY',feeds:selected.length,feedErrors:errors.length,
      recent:checked.length,metadataCandidates:checked.filter(x=>x.status==='METADATA_CANDIDATE').length,
      held:checked.filter(x=>x.status==='HOLD').length,ledgerRows:index.rows,
      writes:0,propertyWrites:0,triggerChanges:0,epIdsAllocated:0};
    console.log('MEGAPHONE_ADAPTER_SUMMARY '+JSON.stringify(summary));
    errors.forEach(e=>console.log('MEGAPHONE_ADAPTER_ERROR '+JSON.stringify(e)));
    checked.forEach(x=>console.log('MEGAPHONE_ADAPTER_ITEM '+JSON.stringify(x)));
    return summary;
  }
  return {inspect};
})();
function inspectMegaphoneRegistrationCandidatesReadOnly(){
  return LibraryMegaphoneAdapter.inspect();
}
