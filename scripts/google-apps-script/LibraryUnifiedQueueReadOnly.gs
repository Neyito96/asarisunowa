/**
 * Phase 14: chronological Omny + Megaphone registration queue.
 * COPY ONLY, READ ONLY. Does not reserve EP-IDs, mutate sheets, or create triggers.
 * Uses fixed 7-day window from the Oct 23 audit so the 28 older candidates remain visible.
 */
function inspectUnifiedOfficialQueueReadOnly(){
 'use strict';
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const START=Date.parse('2026-10-16T21:47:50+09:00');
 const ss=SpreadsheetApp.openById(COPY);
 const source=ss.getSheetByName('取得元一覧'),ledger=ss.getSheetByName('エピソード台帳');
 if(!source||!ledger)throw Error('COPY_TABS_MISSING');
 const feeds=source.getRange(2,1,7,8).getValues().map(r=>({show:String(r[0]||'').trim(),url:String(r[7]||'').trim()}));
 const official=/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/;
 if(feeds.length!==7||feeds.some(f=>!f.show||!official.test(f.url)))throw Error('SEVEN_OFFICIAL_FEEDS_INVALID');
 const rows=ledger.getDataRange().getValues(),header=rows.shift()||[];
 if(header[0]!=='台帳ID'||header.length<55)throw Error('LEDGER_HEADER_UNEXPECTED');
 const guidSet=new Set(),audioSet=new Set(),titleDateSet=new Set(),epIds=new Set();
 const normalize=x=>String(x==null?'':x).trim().toLowerCase();
 const day=x=>{const t=Date.parse(x);return Number.isFinite(t)?new Date(t).toISOString().slice(0,16):'';};
 for(const r of rows){
  if(r[0]){if(epIds.has(String(r[0])))throw Error('DUPLICATE_EP_ID');epIds.add(String(r[0]));}
  [6,51].forEach(i=>{if(r[i])guidSet.add(normalize(r[i]));});
  if(r[14])audioSet.add(normalize(r[14]));
  if(r[2]&&r[3])titleDateSet.add(normalize(r[2])+'|'+day(r[3]));
 }
 const history=ss.getSheetByName('固定ID採番履歴');
 const excluded=ss.getSheetByName('削除・除外履歴');
 const decisions=ss.getSheetByName('図書館・宇宙 検索対象判定');
 const states=ss.getSheetByName('図書館V3・項目状態');
 if(!history||!excluded||!decisions||!states)throw Error('IDENTITY_SHEET_MISSING');
 const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
 [history,excluded,decisions].forEach(sh=>sh.getDataRange().getValues().slice(1).forEach(r=>r.forEach(v=>{
  const x=normalize(v);if(uuid.test(x))guidSet.add(x);
 })));
 states.getDataRange().getValues().slice(1).forEach(r=>{
  if(!r[1])return;
  let v;try{v=JSON.parse(r[1]);}catch(e){throw Error('STATE_JSON_INVALID_'+r[0]);}
  const x=normalize(v.identity?.[1]);if(uuid.test(x))guidSet.add(x);
 });
 const now=Date.now(),items=[],errors=[];
 for(const feed of feeds){
  try{
   const response=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});
   if(response.getResponseCode()!==200)throw Error('RSS_HTTP_'+response.getResponseCode());
   const channel=XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
   if(!channel)throw Error('CHANNEL_MISSING');
   const platform=feed.url.includes('megaphone.fm')?'Megaphone':'Omny';
   for(const node of channel.getChildren('item')){
    const published=Date.parse(node.getChildText('pubDate')||'');
    if(!Number.isFinite(published)||published<START||published>now)continue;
    const guid=String(node.getChildText('guid')||'').trim(),title=String(node.getChildText('title')||'').trim();
    const audio=String(node.getChild('enclosure')?.getAttribute('url')?.getValue()||'').trim();
    const link=String(node.getChildText('link')||'').trim();
    items.push({show:feed.show,platform,guid,title,published,publishedIso:new Date(published).toISOString(),audio,link});
   }
  }catch(e){errors.push({show:feed.show,error:String(e.message)});}
 }
 const frequency=new Map();
 items.forEach(x=>frequency.set(normalize(x.guid),(frequency.get(normalize(x.guid))||0)+1));
 items.sort((a,b)=>a.published-b.published||a.guid.localeCompare(b.guid)||a.show.localeCompare(b.show));
 const results=items.map((x,i)=>{
  const holds=[];
  if(!uuid.test(x.guid))holds.push('INVALID_GUID');
  if(!x.title)holds.push('TITLE_MISSING');
  if(!/^https:\/\//.test(x.audio))holds.push('AUDIO_MISSING');
  if(x.platform==='Omny'&&!/^https:\/\//.test(x.link))holds.push('OMNY_EPISODE_LINK_MISSING');
  if(frequency.get(normalize(x.guid))!==1)holds.push('RSS_GUID_DUPLICATED');
  if(guidSet.has(normalize(x.guid)))holds.push('GUID_ALREADY_RECORDED_OR_RESERVED');
  if(audioSet.has(normalize(x.audio)))holds.push('AUDIO_ALREADY_IN_LEDGER');
  // Advisory only: a date formatting difference must not silently clear a reissue.
  const possibleTitleCollision=rows.some(r=>normalize(r[2])===normalize(x.title));
  if(possibleTitleCollision)holds.push('TITLE_COLLISION_REVIEW');
  return {order:i+1,show:x.show,platform:x.platform,guid:x.guid,title:x.title,
   published:x.publishedIso,hasAudio:!!x.audio,hasEpisodeLink:!!x.link,
   status:holds.length?'HOLD':'CANDIDATE',holds};
 });
 const summary={mode:'COPY_READ_ONLY',fixedWindowStartJst:'2026-10-16 21:47:50',feeds:feeds.length,
  feedErrors:errors.length,found:results.length,candidates:results.filter(x=>x.status==='CANDIDATE').length,
  held:results.filter(x=>x.status==='HOLD').length,omny:results.filter(x=>x.platform==='Omny').length,
  megaphone:results.filter(x=>x.platform==='Megaphone').length,
  ledgerRows:rows.length,writes:0,propertyWrites:0,triggerChanges:0,epIdsAllocated:0};
 console.log('UNIFIED_QUEUE_SUMMARY '+JSON.stringify(summary));
 errors.forEach(x=>console.log('UNIFIED_QUEUE_ERROR '+JSON.stringify(x)));
 results.forEach(x=>console.log('UNIFIED_QUEUE_ITEM '+JSON.stringify(x)));
 return summary;
}
