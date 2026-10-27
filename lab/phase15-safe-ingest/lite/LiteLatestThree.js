'use strict';
// LAB only: one read-only snapshot of seven RSS feeds, latest three by pubDate.
function liteLatestThreeScan({sources,ledgerRows,fetchFeed,now=()=>new Date().toISOString()}){
 const shows=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ニュースの学校','ドーナツ','報談'];
 const byShow=new Map(), seen=new Map(), ledgerGuid=new Map(), ledgerUrls=new Map();
 for(const s of sources)if(shows.includes(s.show)){if(byShow.has(s.show))byShow.get(s.show).collision=true;else byShow.set(s.show,{...s});}
 for(const row of ledgerRows){const g=String(row.guid||'').trim().toLowerCase();if(g){if(!ledgerGuid.has(g))ledgerGuid.set(g,[]);ledgerGuid.get(g).push(row);}
  for(const u of [row.url,row.officialUrl])if(u){if(!ledgerUrls.has(u))ledgerUrls.set(u,[]);ledgerUrls.get(u).push(row);}
 }
 const results=[];
 for(const show of shows){
  const s=byShow.get(show);const out={show,status:'OK',fetched:null,selected:0,existing:0,unregistered:0,duplicates:0,unknown:0,errors:[],candidates:[]};
  if(!s||s.collision||!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC)/.test(s.url||'')){
   out.status='SOURCE_PENDING';out.errors.push('SOURCE_INVALID_OR_MISSING');results.push(out);continue;
  }
  let items;try{items=fetchFeed(s);if(!Array.isArray(items))throw Error('NON_ARRAY_RSS');out.fetched=items.length;}
  catch(e){out.status='SOURCE_PENDING';out.errors.push('RSS_'+String(e.message||e));results.push(out);continue;}
  const valid=[];for(const item of items){const ms=Date.parse(String(item.pubDate||''));if(!Number.isFinite(ms)){out.unknown++;out.errors.push('INVALID_PUBDATE');continue;}valid.push({item,ms});}
  if(out.unknown)out.status='SOURCE_PENDING';
  valid.sort((a,b)=>b.ms-a.ms||String(a.item.guid||'').localeCompare(String(b.item.guid||'')));
  for(const {item,ms} of valid.slice(0,3)){
   const guid=String(item.guid||'').trim().toLowerCase(),url=String(item.link||''),matches=ledgerGuid.get(guid)||[],urlMatches=ledgerUrls.get(url)||[];
   let status='UNREGISTERED_CANDIDATE',id=null,reason='';
   if(!guid){status='UNKNOWN';reason='MISSING_GUID';}
   else if(seen.has(guid)){status='DUPLICATE';reason='CROSS_FEED_GUID';}
   else if(matches.length>1){status='UNKNOWN';reason='LEDGER_GUID_COLLISION';}
   else if(matches.length===1){status='REGISTERED';id=matches[0].id||null;}
   else if(url&&urlMatches.length){status='UNKNOWN';reason='URL_IDENTITY_POSSIBLE';}
   if(guid&&!seen.has(guid))seen.set(guid,show);
   if(status==='REGISTERED')out.existing++;else if(status==='UNREGISTERED_CANDIDATE')out.unregistered++;else if(status==='DUPLICATE')out.duplicates++;else out.unknown++;
   if(status==='UNKNOWN')out.status='SOURCE_PENDING';
   out.candidates.push({show,title:String(item.title||''),pubDate:new Date(ms).toISOString(),guid,officialUrl:url,status,existingEpId:id,reason});
  }
  out.selected=out.candidates.length;results.push(out);
 }
 return {mode:'PHASE15_LITE_LATEST3_READ_ONLY',observedAt:now(),limitPerShow:3,maxItems:21,rows:results,
 totals:{selected:results.reduce((a,x)=>a+x.selected,0),registered:results.reduce((a,x)=>a+x.existing,0),unregisteredCandidates:results.reduce((a,x)=>a+x.unregistered,0),duplicates:results.reduce((a,x)=>a+x.duplicates,0),unknown:results.reduce((a,x)=>a+x.unknown,0),pendingFeeds:results.filter(x=>x.status!=='OK').length},sourceCompleteness:results.some(x=>x.status!=='OK')?'SOURCE_PENDING':'OBSERVED_RSS_ONLY',authoritativeMissingTotal:false,productionWrites:0};
}
if(typeof module!=='undefined'&&module.exports)module.exports={liteLatestThreeScan};
