'use strict';
/** Phase15 Lite: pure, independent READ_ONLY classifier. */
const LITE_SHOWS=Object.freeze(['ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ニュースの学校','ドーナツ','報談']);
const OMNY=/^https:\/\/www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\//;
const MEGA=/^https:\/\/feeds\.megaphone\.fm\/TASC[0-9]+(?:\?.*)?$/;
const validFeedUrl=u=>typeof u==='string'&&(OMNY.test(u)||MEGA.test(u));
const normGuid=v=>typeof v==='string'?v.trim().toLowerCase():'';
function liteScan({sources,ledgerGuids,fetchFeed,now=()=>new Date().toISOString()}){
 if(!Array.isArray(sources)||!Array.isArray(ledgerGuids)||typeof fetchFeed!=='function')throw Error('INVALID_INPUT');
 const byShow=new Map(),bad=new Set();
 for(const s of sources){if(!LITE_SHOWS.includes(s.show))continue;if(byShow.has(s.show)){bad.add(s.show);continue;}byShow.set(s.show,s);}
 const ledger=new Set(),ledgerDuplicates=[];for(const x of ledgerGuids){const g=normGuid(x);if(!g)continue;if(ledger.has(g))ledgerDuplicates.push(g);ledger.add(g);}
 const seen=new Set(),rows=[];
 for(const show of LITE_SHOWS){
  const source=byShow.get(show);const pending=(error)=>({show,url:source?.url||'',status:'SOURCE_PENDING',fetched:null,unregistered:null,existing:null,duplicates:null,invalid:null,candidates:[],errors:[error]});
  if(!source||!validFeedUrl(source.url)||bad.has(show)){rows.push(pending(!source?'MISSING_SOURCE':'INVALID_OR_DUPLICATE_SOURCE'));continue;}
  let items;try{items=fetchFeed(source);if(!Array.isArray(items))throw Error('RSS_NOT_ARRAY');}catch(e){rows.push(pending(String(e.message||e)));continue;}
  const r={show,url:source.url,status:'OK',fetched:items.length,unregistered:0,existing:0,duplicates:0,invalid:0,candidates:[],errors:[]};
  for(const x of items){const g=normGuid(x.guid);if(!g){r.invalid++;r.errors.push('ITEM_MISSING_GUID');continue;}if(seen.has(g)){r.duplicates++;continue;}seen.add(g);if(ledger.has(g)){r.existing++;continue;}r.unregistered++;r.candidates.push({guid:g,title:String(x.title||''),pubDate:String(x.pubDate||''),officialUrl:String(x.link||''),show});}
  if(r.invalid)r.status='SOURCE_PENDING';rows.push(r);
 }
 const pending=rows.some(r=>r.status!=='OK');
 return {mode:'PHASE15_NEW_INGEST_LITE_READ_ONLY',scannedAt:now(),sourceCompleteness:pending?'SOURCE_PENDING':'OBSERVED_RSS_ONLY',ledgerDuplicateCount:ledgerDuplicates.length,ledgerIntegrity:ledgerDuplicates.length?'STOP_DUPLICATE_LEDGER_GUID':'OK',rows,totals:{fetched:pending?null:rows.reduce((n,r)=>n+r.fetched,0),unregisteredObserved:rows.reduce((n,r)=>n+(r.unregistered||0),0),existingObserved:rows.reduce((n,r)=>n+(r.existing||0),0),duplicatesObserved:rows.reduce((n,r)=>n+(r.duplicates||0),0),sourcePending:rows.filter(r=>r.status!=='OK').length},authoritativeMissingTotal:false,productionWrites:0,allocationWrites:0,triggerWrites:0};
}
if(typeof module!=='undefined'&&module.exports)module.exports={LITE_SHOWS,validFeedUrl,normGuid,liteScan};
