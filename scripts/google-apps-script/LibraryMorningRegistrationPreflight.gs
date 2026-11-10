/** Phase 14 morning registration preflight — COPY ledger only, READ ONLY.
 * Checks the three observed GUIDs against ledger, history, states, and official Omny JSON.
 * Does not allocate IDs, update any sheet/property, install triggers, or publish.
 */
function inspectMorningThreeRegistrationPreflightReadOnly(){
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const target=[
  {show:'スポンジ',guid:'09745c24-ed3b-4b95-b62f-b4e8008dcd64'},
  {show:'ニュースの現場から',guid:'28f11a95-ac3b-46a9-a584-b4ec009c3cb9'},
  {show:'ドーナツ',guid:'b7b13c9d-5f69-4a84-84b9-b4ec005d3bdd'}
 ];
 const ss=SpreadsheetApp.openById(COPY),ledger=ss.getSheetByName('エピソード台帳');
 const source=ss.getSheetByName('取得元一覧');
 if(!ledger||!source)throw Error('COPY_SHEETS_MISSING');
 const values=ledger.getDataRange().getValues(),header=values.shift()||[];
 if(header[0]!=='台帳ID'||header.length<55)throw Error('LEDGER_SCHEMA_CONFLICT');
 const known=new Set(),titles=new Set(),audios=new Set(),ids=[];
 values.forEach(r=>{
  if(r[0])ids.push(String(r[0]));
  [6,51].forEach(i=>{if(r[i])known.add(String(r[i]).trim().toLowerCase());});
  if(r[2])titles.add(String(r[2]).trim());
  if(r[14])audios.add(String(r[14]).trim());
 });
 for(const name of ['固定ID採番履歴','削除・除外履歴']){
  const sh=ss.getSheetByName(name);
  if(!sh)throw Error('MISSING_'+name);
  sh.getDataRange().getValues().slice(1).forEach(r=>r.forEach(v=>{
   const s=String(v||'').trim().toLowerCase();
   if(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s))known.add(s);
  }));
 }
 const states=ss.getSheetByName('図書館V3・項目状態');
 if(!states)throw Error('STATE_SHEET_MISSING');
 states.getDataRange().getValues().slice(1).forEach(r=>{
  if(!r[1])return;
  const state=JSON.parse(r[1]);
  const g=String(state.identity?.[1]||'').toLowerCase();
  if(g)known.add(g);
 });
 const feeds=source.getRange(2,1,7,8).getValues().map(r=>({show:String(r[0]||''),url:String(r[7]||'')}));
 const reports=[];
 for(const wanted of target){
  const feed=feeds.find(f=>f.show===wanted.show);
  if(!feed||!/^https:\/\/www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\//.test(feed.url))throw Error('OMNY_FEED_MISSING_'+wanted.show);
  const response=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('RSS_HTTP_'+response.getResponseCode());
  const channel=XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
  if(!channel)throw Error('RSS_CHANNEL_MISSING');
  const matches=channel.getChildren('item').filter(x=>String(x.getChildText('guid')||'').trim().toLowerCase()===wanted.guid);
  const problems=[];
  if(matches.length!==1)problems.push('RSS_GUID_COUNT_'+matches.length);
  const item=matches[0];
  let title='',published='',audio='',link='',jsonOk=false;
  if(item){
   title=String(item.getChildText('title')||'').trim();
   published=String(item.getChildText('pubDate')||'');
   audio=String(item.getChild('enclosure')?.getAttribute('url')?.getValue()||'');
   link=String(item.getChildText('link')||'');
   if(!title||!Number.isFinite(Date.parse(published))||!audio||!link)problems.push('RSS_REQUIRED_FIELDS');
   if(known.has(wanted.guid))problems.push('GUID_ALREADY_KNOWN');
   if(audios.has(audio))problems.push('AUDIO_ALREADY_KNOWN');
   if(titles.has(title))problems.push('TITLE_COLLISION_REVIEW');
   try{
    const url='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/'+wanted.guid;
    const jsonResponse=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
    if(jsonResponse.getResponseCode()!==200)throw Error('JSON_HTTP_'+jsonResponse.getResponseCode());
    const clip=JSON.parse(jsonResponse.getContentText());
    jsonOk=clip.Id===wanted.guid&&clip.Title===title&&Date.parse(clip.PublishedUtc)===Date.parse(published)&&clip.PublishedUrl===link;
    if(!jsonOk)problems.push('RSS_JSON_IDENTITY_MISMATCH');
   }catch(e){problems.push('JSON_ERROR_'+String(e.message));}
  }
  reports.push({show:wanted.show,guid:wanted.guid,title,
   rssFound:matches.length===1,jsonIdentityVerified:jsonOk,
   audioPresent:!!audio,episodeLinkPresent:!!link,
   status:problems.length?'HOLD':'PREFLIGHT_PASS',problems});
 }
 const integrity=ids.length===new Set(ids).size&&ids.every(x=>/^EP-\d{5}$/.test(x));
 const summary={mode:'COPY_READ_ONLY',checked:reports.length,preflightPass:reports.filter(x=>x.status==='PREFLIGHT_PASS').length,
  held:reports.filter(x=>x.status==='HOLD').length,ledgerIdsUnique:integrity,
  writes:0,propertyWrites:0,triggerChanges:0,epIdsAllocated:0};
 console.log('MORNING_PREFLIGHT_SUMMARY '+JSON.stringify(summary));
 reports.forEach(r=>console.log('MORNING_PREFLIGHT_ITEM '+JSON.stringify(r)));
 return summary;
}
