/**
 * EP-06632 native official feed repair. Run manually in approved production GAS.
 * Read the exact GUID from official RSS and JSON; fill missing fields only.
 * No new ID, no other episode edits, no COPY trigger changes.
 */
function phase14RepairEP06632FromOfficial(){
 const ID='a07f0210-b98d-4e6d-9d21-b4c9005ccdfc';
 const FILE='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const FEED='https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/693cfdd6-f5a9-4308-9025-adb10164b5b1/podcast.rss';
 const API='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/'+ID;
 if(ScriptApp.getScriptId()!=='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV')throw Error('WRONG_PRODUCTION_GAS');
 const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('BUSY');
 try{
  const book=SpreadsheetApp.openById(FILE),tab=book.getSheetByName('エピソード台帳');
  const rowNo=6633,old=tab.getRange(rowNo,1,1,55).getValues()[0];
  if(old[0]!=='EP-06632'||String(old[6]).toLowerCase()!==ID)throw Error('IDENTITY_CHANGED');
  const feedRes=UrlFetchApp.fetch(FEED,{muteHttpExceptions:true});
  if(feedRes.getResponseCode()!==200)throw Error('RSS_HTTP_'+feedRes.getResponseCode());
  const channel=XmlService.parse(feedRes.getContentText()).getRootElement().getChild('channel');
  if(!channel)throw Error('INVALID_RSS');
  const candidates=channel.getChildren('item').filter(item=>String(item.getChildText('guid')||'').toLowerCase()===ID);
  if(candidates.length!==1)throw Error('GUID_NOT_UNIQUE_OR_NOT_IN_FEED_'+candidates.length);
  const item=candidates[0];
  if(String(item.getChildText('title')||'').trim()!==String(old[2]).trim())throw Error('TITLE_MISMATCH');
  const clipResponse=UrlFetchApp.fetch(API,{muteHttpExceptions:true});
  const clip=clipResponse.getResponseCode()===200?JSON.parse(clipResponse.getContentText()):null;
  const itunes=XmlService.getNamespace('http://www.itunes.com/dtds/podcast-1.0.dtd');
  const raw=item.getChildText('description')||'';
  const audio=item.getChild('enclosure')?.getAttribute('url')?.getValue()||'';
  const image=item.getChild('image',itunes)?.getAttribute('href')?.getValue()||'';
  const link=item.getChildText('link')||'';
  if(!raw||!audio)throw Error('RSS_SOURCE_FIELDS_MISSING');
  const durationText=item.getChildText('duration',itunes)||'';
  const duration=/^\d+$/.test(durationText)?Number(durationText):(/^\d+:\d+(?::\d+)?$/.test(durationText)?durationText.split(':').map(Number).reduce((a,b)=>a*60+b,0):null);
  const updated=old.slice(),changes=[];
  const put=(index,value,label)=>{if(value!==null&&value!==undefined&&String(value)!==''&& (old[index]===null||old[index]===undefined||String(old[index]).trim()==='')){updated[index]=value;changes.push({column:index+1,label});}};
  put(9,link,'official page J');put(13,image,'image N');put(14,audio,'audio O');put(15,duration,'duration P');put(21,raw,'original description V');
  put(51,ID,'official JSON UUID AZ');put(52,API,'official JSON URL BA');
  // Do not replace W or article URLs. RSS raw is authoritative even when previously cleaned summary is shorter.
  put(54,API,'official JSON source BC');
  if(changes.length===0)return {id:'EP-06632',status:'NO_MISSING_FIELDS',writes:0};
  // Write individual blanks only: never overwrite existing data or clobber adjacent columns.
  for(const change of changes){
   const i=change.column-1;
   const target=tab.getRange(rowNo,change.column);
   if(!target.isBlank()||target.getFormula())throw Error('CONCURRENT_CHANGE_'+change.column);
   target.setValue(updated[i]);
  }
  SpreadsheetApp.flush();
  const after=tab.getRange(rowNo,1,1,55).getValues()[0];
  for(const change of changes){const i=change.column-1;if(String(after[i])!==String(updated[i]))throw Error('READBACK_FAILED_'+change.column);}
  const stateSheet=book.getSheetByName('図書館V3・項目状態');
  const state=JSON.parse(String(stateSheet.getRange(rowNo,2).getValue()));
  state.officialSourceRepair={status:'RSS_VERIFIED_FILL_BLANKS',at:new Date().toISOString(),guid:ID,feed:FEED,jsonHttp:clipResponse.getResponseCode(),changes};
  // Keep PENDING_REVIEW until dedicated V3 hash/state validation.
  stateSheet.getRange(rowNo,2).setValue(JSON.stringify(state));
  const report={id:'EP-06632',status:'FILLED_BLANKS',changes,summaryPreserved:true,copyTriggersChanged:0,v3Finalized:false};
  console.log(JSON.stringify(report));return report;
 }finally{lock.releaseLock();}
}
