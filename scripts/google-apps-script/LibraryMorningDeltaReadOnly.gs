/** Phase 14 morning experiment: compare official feeds with Oct 23 21:47 JST baseline.
 * COPY ONLY, READ ONLY. No IDs, properties, sheet writes, or triggers.
 * This is a snapshot comparison, not proof of complete publication coverage.
 */
function inspectLibraryMorningDeltaReadOnly(){
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const ss=SpreadsheetApp.openById(COPY),sh=ss.getSheetByName('取得元一覧');
 if(!sh)throw Error('SOURCE_LIST_MISSING');
 const feeds=sh.getRange(2,1,7,8).getValues().map(r=>({show:String(r[0]||''),url:String(r[7]||'')}));
 if(feeds.length!==7||feeds.some(f=>!f.show||!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/.test(f.url)))throw Error('FEEDS_INVALID');
 const baseline=Date.parse('2026-10-23T21:47:50+09:00'),now=Date.now(),errors=[],recent=[],seen=new Set();
 for(const feed of feeds){
  try{
   const r=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});
   if(r.getResponseCode()!==200)throw Error('HTTP_'+r.getResponseCode());
   const channel=XmlService.parse(r.getContentText()).getRootElement().getChild('channel');
   if(!channel)throw Error('CHANNEL_MISSING');
   for(const item of channel.getChildren('item')){
    const t=Date.parse(item.getChildText('pubDate')||'');
    if(!Number.isFinite(t)||t<=baseline||t>now)continue;
    const guid=String(item.getChildText('guid')||'').trim();
    const key=guid.toLowerCase();
    const issues=[];
    if(!guid)issues.push('GUID_MISSING');
    if(seen.has(key))issues.push('DUPLICATE_IN_FEEDS');
    seen.add(key);
    const audio=item.getChild('enclosure')?.getAttribute('url')?.getValue()||'';
    if(!audio)issues.push('AUDIO_MISSING');
    recent.push({show:feed.show,platform:feed.url.includes('megaphone.fm')?'Megaphone':'Omny',guid,
     title:item.getChildText('title')||'',published:new Date(t).toISOString(),
     audioPresent:!!audio,episodeLinkPresent:!!item.getChildText('link'),issues});
   }
  }catch(e){errors.push({show:feed.show,error:String(e.message)});}
 }
 recent.sort((a,b)=>a.published.localeCompare(b.published)||a.guid.localeCompare(b.guid));
 const summary={mode:'COPY_READ_ONLY',baselineJst:'2026-10-23 21:47:50',feeds:feeds.length,
  feedErrors:errors.length,publishedAfterBaseline:recent.length,
  omny:recent.filter(x=>x.platform==='Omny').length,megaphone:recent.filter(x=>x.platform==='Megaphone').length,
  writes:0,propertyWrites:0,triggerChanges:0,epIdsAllocated:0};
 console.log('MORNING_DELTA_SUMMARY '+JSON.stringify(summary));
 errors.forEach(x=>console.log('MORNING_DELTA_ERROR '+JSON.stringify(x)));
 recent.forEach(x=>console.log('MORNING_DELTA_ITEM '+JSON.stringify(x)));
 return summary;
}
