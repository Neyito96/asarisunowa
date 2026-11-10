// READ_ONLY: aggregate current ledger definitions; never infer additions/deletions.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {blocked,publicEpisode} from '../lib/library-public.mjs';
const [sourcePath,outPath]=process.argv.slice(2);
if(!sourcePath||!outPath)throw Error('Usage: PRIVATE_SOURCE.json REPORT.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
if(source.headers[0]!=='台帳ID'||source.headers[38]!=='人間除外')throw Error('Unexpected schema');
const excludedIds=new Set(),excludedGuids=new Set();
for(const r of (source.exclusions||[]).slice(1)){if(r[0])excludedGuids.add(String(r[0]).toLowerCase());if(r[1])excludedIds.add(r[1]);}
const groups=new Map(),guids=new Map();let policy=0,human=0,held=0,publishable=0;
for(const r of source.rows){
 const show=String(r[1]||'(missing)'),s=groups.get(show)||{show,rawRows:0,minDate:null,maxDate:null,repeatTitleMarkers:0,videoMediaOrUrl:0,missingExternalId:0,officialUuidPresent:0,publicEligible:0};
 s.rawRows++;
 const date=publicEpisode(r).date;
 if(date){s.minDate=!s.minDate||date<s.minDate?date:s.minDate;s.maxDate=!s.maxDate||date>s.maxDate?date:s.maxDate;}
 if(/再配信|再放送|アンコール|リピート/i.test(String(r[2]||'')))s.repeatTitleMarkers++;
 if(/動画|映像|youtube/i.test(String(r[4]||'')+' '+String(r[8]||'')+' '+String(r[43]||'')))s.videoMediaOrUrl++;
 if(r[51])s.officialUuidPresent++;
 const guid=String(r[6]||'').trim().toLowerCase();if(guid){const x=guids.get(guid)||[];x.push(show);guids.set(guid,x);}else s.missingExternalId++;
 if(['アルキキ','AJW'].includes(show))policy++;
 else if(blocked(r[38])||excludedIds.has(r[0])||excludedGuids.has(guid))human++;
 else if(!r[1]||!r[2]||!r[3]||!date)held++;
 else{s.publicEligible++;publishable++;}
 groups.set(show,s);
}
const repeated=[...guids.values()].filter(x=>x.length>1);
const report={mode:'READ_ONLY',measuredAt:new Date().toISOString(),sourceHash:createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),snapshotDate:source.snapshotDate,
 definitions:{rawRows:'Current ledger rows, including policy exclusions. Not a finalized canonical episode count.',publicEligible:'Current exporter policy (Alukiki/AJW excluded), human/tombstone exclusions, valid required metadata. No policy changes.',repeatTitleMarkers:'Title markers only; not a verified duplicate or rerun classification.',videoMediaOrUrl:'Media/URL marker only; not automatically excluded.',externalIdDuplicates:'Column 6 external ID only (not a complete GUID inventory); trimmed case-folded exact value; identity review required. No deduplication applied.'},
 ledger:{rawRows:source.rows.length,policyExcluded:policy,humanExcluded:human,held,publishable,externalIdRepeatedGroups:repeated.length,externalIdRepeatedRows:repeated.reduce((n,x)=>n+x.length,0),crossShowExternalIdGroups:repeated.filter(x=>new Set(x).size>1).length,shows:[...groups.values()].sort((a,b)=>a.show.localeCompare(b.show,'ja'))},
 external:{page:'https://yoshimotomasahir.github.io/asapoki_vis/speakers2.html?screen=0',script:'speakers3.js',dataEndpoint:'https://asapoki.yoshimoto.workers.dev/',state:'UNVERIFIED',httpStatus:403,errorCode:1010,currentRows:null,comparison:null,reason:'Actual page/script fetched; data request blocked. One normal Origin/Referer recovery also blocked. No bypass attempted. Need a permitted exported snapshot with its source date and scope.'},
 changes:{productionWrites:0,deletions:0,additions:0},unverified:['External current rows, scope, date range and completeness','Per-record matching against external tool','Results of parallel population audit','Whether title rerun markers denote identical content','YouTube/source cross-publication equivalence','Blank external ID does not mean no official UUID/GUID; V3 states and source namespaces require the parallel audit']};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rawRows:report.ledger.rawRows,publishable,external:report.external.state}));
