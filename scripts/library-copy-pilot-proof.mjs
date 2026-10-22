// Execute the existing V3 copy pilot locally against native snapshot data.
// This file never calls Google or deploys GAS. An explicitly authorized caller
// may materialize the bounded outbox through Sheets, then run it on readback.
import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';import {pathToFileURL}from'node:url';import path from'node:path';
const [privateDir,v3Root,copyId,phase='plan']=process.argv.slice(2);
if(!privateDir||!v3Root||!copyId)throw Error('PRIVATE_DIR V3_ROOT COPY_ID [plan|replay|failure]');
const sourceId='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';if(copyId===sourceId)throw Error('Production forbidden');
const read=name=>JSON.parse(fs.readFileSync(path.join(privateDir,name),'utf8'));
const {harness}=await import(pathToFileURL(path.join(v3Root,'tests/library-v3-harness.mjs')));
const originalCwd=process.cwd();let h,copy;try{process.chdir(v3Root);h=harness(0);copy=harness(0);}finally{process.chdir(originalCwd);}
const revive=x=>{if(x&&typeof x==='object'&&!Array.isArray(x)&&x.$date)return new h.ctx.Date(x.$date);if(Array.isArray(x))return x.map(revive);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,revive(v)]));return x;};
const source=revive(read('source-tables.json')),target=revive(read(phase==='plan'?'copy-tables.json':'copy-readback-tables.json'));
const load=(box,tables)=>{const ss=box.ctx.SpreadsheetApp.openById();for(const [name,rows]of Object.entries(tables)){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);box.table[name].splice(0,box.table[name].length,...rows);}return ss;};
const sourceSs=load(h,source),copySs=load(copy,target),outbox=[];
const protect=(ss,writable)=>({getSheetByName:name=>{const sh=ss.getSheetByName(name);if(!sh)return null;return {...sh,getRange:(r,c,n=1,m=1)=>{const cell=sh.getRange(r,c,n,m);return {...cell,setValue:v=>{if(!writable)throw Error('SOURCE_WRITE_FORBIDDEN');outbox.push({sheet:name,row:r,column:c,values:[[v]]});return cell.setValue(v);},setValues:values=>{if(!writable)throw Error('SOURCE_WRITE_FORBIDDEN');outbox.push({sheet:name,row:r,column:c,values});return cell.setValues(values);}};},appendRow:values=>{if(!writable)throw Error('SOURCE_WRITE_FORBIDDEN');outbox.push({sheet:name,row:sh.getLastRow()+1,column:1,values:[values]});return sh.appendRow(values);}};}});
h.ctx.LIB_V2_SHEET_ID=sourceId;h.ctx.SpreadsheetApp.openById=id=>{if(id===sourceId)return protect(sourceSs,false);if(id===copyId)return protect(copySs,true);throw Error('UNEXPECTED_SPREADSHEET');};
for(const name of ['LibraryV2CheckpointEngine','LibraryV3','LibraryV3Autonomy','LibraryV3Morning'])vm.runInContext(fs.readFileSync(path.join(v3Root,'scripts/google-apps-script',name+'.js'),'utf8'),h.ctx);
const element=x=>({getName:()=>x.name,getNamespace:()=>({getURI:()=>x.uri}),getText:()=>x.text,getAttribute:k=>x.attrs[k]==null?null:{getValue:()=>x.attrs[k]},getChildren:(name)=>x.children.filter(c=>!name||c.name===name).map(element),getChild:name=>{const v=x.children.find(c=>c.name===name&&!c.uri);return v?element(v):null;},getChildText:name=>{const v=x.children.find(c=>c.name===name&&!c.uri);return v?v.text:null;}});
const tree=read('rss-tree.json'),xml=fs.readFileSync(path.join(privateDir,'news.rss'),'utf8');
h.ctx.XmlService={parse:text=>{if(text!==xml)throw Error('Unexpected RSS bytes');return{getRootElement:()=>element(tree)};}};
h.ctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getAllHeaders:()=>({}),getContentText:()=>xml});
h.ctx.CacheService.getScriptCache=()=>({get:()=>null,put:()=>{throw Error('CACHE_WRITE_FORBIDDEN');}});
const baseline={complete:true,offset:source['エピソード台帳'].length-1,hash:h.ctx.libV3Hash_(source['エピソード台帳'].slice(1).map(r=>r.slice(0,51)))};
// Local baseline proof only: never assert these are live ScriptProperties.
h.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>k==='LIB_V3_BASELINE'?JSON.stringify(baseline):null,setProperty:()=>{throw Error('PROPERTIES_WRITE_FORBIDDEN');}});
h.ctx.ScriptApp.newTrigger=()=>{throw Error('TRIGGER_WRITE_FORBIDDEN');};
const feed=read('rss-source.json'),items=h.ctx.libV2CpParse_(xml,true),c=h.ctx.libV3Context_(false),previous=JSON.parse(fs.readFileSync(path.join(originalCwd,'docs/audits/2026-10-22-ingest/rss-delta.json'))).newCandidates;
const decisions=previous.map(prior=>{const hits=items.filter(x=>x.guid===prior.guid);if(hits.length!==1)return {...prior,status:'HOLD',reason:'RSS_MISSING_OR_DUPLICATED'};const it=hits[0],matches=h.ctx.libV2CpMatches_(it.guid,c.index.guid,c.index.anchor),d=h.ctx.libV3NewDecision_(it,{show:'ニュースの現場から',url:feed.url},c,{allowNew:true,newAfter:new Date(Date.parse(it.published)-1).toISOString()},baseline),clean=h.ctx.libV3AutoCleanEvidence_(it.description);return {guid:it.guid,title:it.title,publishedAt:it.published,priorTitle:prior.title,priorPublishedAt:prior.publishedAt,rssMetadataChanged:it.title!==h.ctx.libV2CpNorm_(prior.title)||Date.parse(it.published)!==Date.parse(prior.publishedAt),existingIds:Array.from(matches,i=>c.rows[i][0]),duplicateOrReissue:d.reasons.filter(x=>/seen|reissue|ledger_id/.test(x)),status:!matches.length&&d.eligible&&!clean.hold?'ELIGIBLE_FOR_COPY':'HOLD',reasons:[...d.reasons,...(matches.length?['EXISTING_ID']:[]),...(clean.hold?[clean.reason]:[])],cleaningHold:clean.hold};});
fs.writeFileSync(path.join(privateDir,'decisions.json'),JSON.stringify({at:new Date().toISOString(),feed,items:items.length,sourceRows:c.rows.length,liveBaselineVerified:false,decisions},null,2));
const selected=phase==='plan'?decisions.filter(x=>x.status==='ELIGIBLE_FOR_COPY').sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt))[0]:read('selected.json');
if(!selected){console.log(JSON.stringify({status:'NO_ELIGIBLE_COPY_CANDIDATE',decisions},null,2));process.exit(2);}
const options={copySheetId:copyId,guid:selected.guid,feedUrl:feed.url};
if(phase==='failure'){
 let error='';try{h.ctx.previewLibraryV3CopyPilot(options);}catch(e){error=String(e.message);}
 if(!/reserved|diverged|review/i.test(error)||outbox.length)throw Error('Reserved partial state did not fail closed');
 fs.writeFileSync(path.join(privateDir,'failure-blocked.json'),JSON.stringify({status:'BLOCKED_AFTER_RESERVATION',error,writes:outbox.length,at:new Date().toISOString()},null,2));console.log('Partial reservation blocks replay without writes');process.exit(0);
}
const before=JSON.stringify(source),preview=h.ctx.previewLibraryV3CopyPilot(options);
const receipt=h.ctx.saveLibraryV3CopyPilotAfterApproval({...options,approvedPlanHash:preview.planHash});
if(JSON.stringify(source)!==before)throw Error('Source changed');
const expected=phase==='plan'?1:0;if(receipt.writtenRows!==expected)throw Error('Unexpected row count');
if(phase==='plan'){
 fs.writeFileSync(path.join(privateDir,'selected.json'),JSON.stringify(selected,null,2));fs.writeFileSync(path.join(privateDir,'outbox.json'),JSON.stringify(outbox,null,2));
 fs.writeFileSync(path.join(privateDir,'expected-copy-tables.json'),JSON.stringify(copy.table));
}
const proof={at:new Date().toISOString(),mode:'LOCAL_EXISTING_V3_WITH_NATIVE_SHEET_SNAPSHOTS',phase,sourceId,copyId,baselineScope:'LOCAL_ONLY_NOT_LIVE_PROPERTIES',v3Root,preview,receipt,outbox:outbox.map(x=>({sheet:x.sheet,row:x.row,column:x.column,rows:x.values.length,columns:x.values[0].length})),sourceChanged:false,googleWritesFromRunner:0,gasDeployment:false};
fs.writeFileSync(path.join(privateDir,phase+'-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
