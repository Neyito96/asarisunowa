// Offline replay only: input is a read-only Sheets snapshot and fetched RSS projections.
// Never uses live credentials or performs network, property, cache or sheet writes.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const [ledgerPath,rssPath,outputPath]=process.argv.slice(2);
if(!outputPath)throw Error('Usage: node scripts/audit-library-v2-snapshot.cjs ledger.json rss-projected.json output.json');
const d=JSON.parse(fs.readFileSync(ledgerPath)),feeds=JSON.parse(fs.readFileSync(rssPath));
const fail=()=>{throw Error('FORBIDDEN MUTATION');};
const sheet=rows=>({getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),getRange:(r,c,h=1,w=1)=>({getValues:()=>rows.slice(r-1,r-1+h).map(row=>row.slice(c-1,c-1+w))})});
const tabs={'エピソード台帳':sheet([d.headers,...d.rows.map(r=>Array.from({length:51},(_,i)=>r[i]??''))]),'取得元一覧':sheet(d.sources),'削除・除外履歴':sheet(d.exclusions),'自動補完・実行履歴':sheet(d.history)};
const ctx=vm.createContext({Date,console,LIB_V2_SHEET_ID:d.spreadsheetId,Logger:{log:()=>{}},SpreadsheetApp:{openById:()=>({getSheetByName:n=>tabs[n]}),flush:fail},ScriptApp:{getProjectTriggers:()=>[],newTrigger:fail},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty:fail})},CacheService:{getScriptCache:()=>({get:()=>null,put:fail})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10)},UrlFetchApp:{fetch:url=>{const f=feeds.find(f=>f.url===url);if(!f)throw Error('Missing captured RSS');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(f.items),getAllHeaders:()=>({})};}}});
for(const f of ['LibraryV2CheckpointEngine','LibraryV2FeedDiagnostic','LibraryV2LedgerGapInventory'])vm.runInContext(fs.readFileSync('scripts/google-apps-script/'+f+'.js','utf8'),ctx);
ctx.libV2CpParse_=JSON.parse;
const started=performance.now(),report={mode:'LOCAL_REPLAY_LIVE_SNAPSHOT',snapshotReadAt:d.readAt,ledger:ctx.diagnoseLibraryV2LedgerGaps(),feeds:feeds.map((_,i)=>ctx.diagnoseLibraryV2Feed_(i,1000)),mutations:0};
// Exhaustive candidate manifest uses the same pure matching/field helpers as GAS.
const rows=d.rows.map(r=>Array.from({length:51},(_,i)=>r[i]??''));
const byGuid=new Map(),byAnchor=new Map(),ids=new Map(),owners=new Map();
const add=(m,k,i)=>{if(k){if(!m.has(k))m.set(k,[]);if(!m.get(k).includes(i))m.get(k).push(i);}};
rows.forEach((r,i)=>{add(byGuid,ctx.libV2CpGuid_(r[6]),i);ctx.libV2CpRowAnchors_(r).forEach(g=>add(byAnchor,g,i));add(ids,r[0],i);add(owners,r[11],i);});
const tomb={gs:new Set(d.exclusions.slice(1).map(r=>ctx.libV2CpGuid_(r[0]))),is:new Set(d.exclusions.slice(1).map(r=>String(r[1]||'').trim()))};
report.candidates=[];report.classifications=[];
for(const feed of [...feeds].sort((a,b)=>a.url.localeCompare(b.url))){
 const counts=new Map();feed.items.forEach(it=>counts.set(it.guid,(counts.get(it.guid)||0)+1));
 for(const it of feed.items){
  const matches=ctx.libV2CpMatches_(it.guid,byGuid,byAnchor);
  let reasons=[];
  if(!it.guid||counts.get(it.guid)!==1)reasons=['blank_or_duplicate_rss_guid'];
  else if(matches.length!==1)reasons=[matches.length?'multiple_ledger_matches':'no_identity_match'];
  else reasons=Array.from(ctx.libV2CpRowReasons_(it,feed.show,rows[matches[0]],ids,tomb));
  if(reasons.length){report.classifications.push({show:feed.show,guid:it.guid,ids:matches.map(i=>rows[i][0]),reasons});continue;}
  const i=matches[0],r=rows[i],fields=Array.from(ctx.libV2CpFields_(it,r,owners));
  if(fields.length){report.candidates.push({id:r[0],row:i+2,show:r[1],guid:it.guid,feed:feed.url,columns:fields.map(f=>f[0]),fields:fields.map(f=>f[2]),proof:r[6]?'existing_guid':ctx.libV2CpOfficialItem_(r[9])?'official_itemid':'omny_clip'});fields.filter(f=>f[0]===12).forEach(f=>owners.set(f[1],[i]));}
 }
}
report.elapsedMs=Math.round(performance.now()-started);fs.writeFileSync(outputPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({elapsedMs:report.elapsedMs,candidateEpisodes:report.candidates.length,candidateCells:report.candidates.reduce((n,c)=>n+c.columns.length,0),byFeed:report.feeds.map(f=>({show:f.show,rssItems:f.rssItems,noMatch:f.noMatch,ambiguous:f.ambiguous,blocked:f.blockedOrConflicting,metadataMismatch:f.metadataMismatch,matchedNoSupportedFill:f.matchedNoSupportedFill,eligibleEpisodes:f.eligibleEpisodes,eligibleCells:f.eligibleCells}))},null,2));
