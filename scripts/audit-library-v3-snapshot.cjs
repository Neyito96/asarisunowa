// Offline read-only replay. No credentials, network, GAS calls or writes to source.
// Inputs: normalized ledger snapshot and RSS projections (see V3 runbook).
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const [ledgerFile,rssFile,outFile]=process.argv.slice(2);if(!outFile)throw Error('Usage: node scripts/audit-library-v3-snapshot.cjs ledger.json rss.json report.json');
const d=JSON.parse(fs.readFileSync(ledgerFile)),feeds=JSON.parse(fs.readFileSync(rssFile));
const ctx=vm.createContext({Date,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10)}});
for(const f of ['LibraryV2CheckpointEngine','LibraryV3'])vm.runInContext(fs.readFileSync('scripts/google-apps-script/'+f+'.js','utf8'),ctx);
ctx.libV3CheckHeaders_(d.headers);const started=performance.now(),rows=d.rows.map(r=>Array.from({length:51},(_,i)=>r[i]??'')),idx=ctx.libV3Index_(rows,d.exclusions.slice(1),[]);
const report={mode:'OFFLINE_LIVE_SNAPSHOT_REPLAY',readAt:d.readAt,rows:rows.length,missing:{},byShow:[],feeds:[],candidates:[],holds:[],states:{},oldNews:[],pilot:[],writes:0,apiCalls:0};
for(const show of [...new Set(rows.map(r=>r[1]))]){const selected=rows.filter(r=>r[1]===show),missing={};for(let c=0;c<51;c++)missing[d.headers[c]]=selected.filter(r=>!String(r[c]??'').trim()).length;report.byShow.push({show,rows:selected.length,missing});}
for(let c=0;c<51;c++)report.missing[d.headers[c]]=rows.filter(r=>!String(r[c]??'').trim()).length;
const plansById=new Map(),rssByGuid=new Map();
for(const feed of [...feeds].sort((a,b)=>a.url.localeCompare(b.url))){
 const counts=new Map();feed.items.forEach(it=>{counts.set(it.guid,(counts.get(it.guid)||0)+1);if(!rssByGuid.has(it.guid))rssByGuid.set(it.guid,[]);rssByGuid.get(it.guid).push({show:feed.show,it});});
 const f={show:feed.show,items:feed.items.length,matched:0,held:0,unmatched:0,candidateEpisodes:0,candidateCells:0,noSupportedFill:0};
 for(const it of feed.items){const p=ctx.libV3Plan_(it,feed,rows,idx);
  if(!it.guid||counts.get(it.guid)!==1)p.reasons.push('blank_or_duplicate_rss_guid');
  if(p.reasons.length){report.holds.push({show:feed.show,guid:it.guid,ids:p.matches.map(i=>rows[i][0]),reasons:Array.from(p.reasons)});p.matches.length?f.held++:f.unmatched++;continue;}
  f.matched++;plansById.set(p.id,p);
  const fields=p.fields.filter(f=>f.candidate);p.fields.forEach(f=>{report.states[f.name]??={};report.states[f.name][f.state]=(report.states[f.name][f.state]||0)+1;});
  if(fields.length){f.candidateEpisodes++;f.candidateCells+=fields.length;report.candidates.push({id:p.id,row:p.i+2,show:feed.show,guid:it.guid,fields:fields.map(f=>f.name),columns:fields.map(f=>f.col)});fields.filter(f=>f.name==='spotify').forEach(f=>idx.spotify.set(f.value,[p.i]));}else f.noSupportedFill++;
 }
 report.feeds.push(f);
}
// Old-news population: all ledger episodes before 2022, including 2020 separately.
rows.forEach((r,i)=>{if(r[1]!=='ニュースの現場から'||!ctx.libV2CpDate_(r[3])||ctx.libV2CpDate_(r[3])>='2022-01-01')return;
 const anchors=ctx.libV3Identity_(r),rss=[...new Map(anchors.flatMap(g=>rssByGuid.get(g)||[]).map(h=>[h.show+'|'+h.it.guid,h])).values()];
 const p=plansById.get(r[0]),clean=ctx.libV3Clean_(r[21]),raw=String(r[21]||''),stored=String(r[22]||'');
 const evidence={id:r[0],row:i+2,date:ctx.libV2CpDate_(r[3]),guidPresent:!!r[6],anchors,rssOccurrences:rss.length,rssShows:[...new Set(rss.map(h=>h.show))],rssAudioPresent:rss.some(h=>!!h.it.audio),ledgerAudioPresent:!!r[14],rawPresent:!!raw,cleanPresent:!!stored,rawEqualsClean:raw===stored,mechanicalCleanEqualsStored:clean===stored,rawContainsMarkup:/<[^>]+>|\\n/.test(raw),candidateFields:p?p.fields.filter(f=>f.candidate).map(f=>f.name):[],holdReasons:report.holds.filter(h=>h.ids.includes(r[0])).flatMap(h=>h.reasons)};
 report.oldNews.push(evidence);
});
for(let id=5576;id<=5585;id++){const r=rows.find(r=>r[0]==='EP-'+String(id).padStart(5,'0')),p=r&&plansById.get(r[0]);report.pilot.push({id:r?.[0],show:r?.[1],guidPresent:!!r?.[6],audioPresent:!!r?.[14],guidAudioCandidates:p?p.fields.filter(f=>f.candidate&&['guid','audio'].includes(f.name)).length:null,held:!p});}
report.candidateEpisodes=report.candidates.length;report.candidateCells=report.candidates.reduce((n,c)=>n+c.fields.length,0);report.candidateFields={};report.candidates.forEach(c=>c.fields.forEach(f=>report.candidateFields[f]=(report.candidateFields[f]||0)+1));
report.heldUniqueEpIds=[...new Set(report.holds.flatMap(h=>h.ids))];report.unmatchedRssOccurrences=report.holds.filter(h=>h.ids.length===0).length;report.elapsedMs=Math.round(performance.now()-started);
fs.writeFileSync(outFile,JSON.stringify(report,null,2));console.log(JSON.stringify({rows:report.rows,candidateEpisodes:report.candidateEpisodes,candidateCells:report.candidateCells,candidateFields:report.candidateFields,heldUniqueEpisodes:report.heldUniqueEpIds.length,unmatchedRssOccurrences:report.unmatchedRssOccurrences,oldNews:report.oldNews.length,pilot:report.pilot,elapsedMs:report.elapsedMs},null,2));
