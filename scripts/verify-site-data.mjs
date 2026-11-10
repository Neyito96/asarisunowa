#!/usr/bin/env node
// READ_ONLY: 公開データ(details/pages/search/scope)を「台帳→サイト」の観点で横断検証する。固定件数なし。
// 使い方: node scripts/verify-site-data.mjs DATA_DIR [REPORT.json]
import {readFile,readdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {findDuplicateCandidates,spotifyId} from '../public/library/duplicate-detect.mjs';
const [,,dir,out]=process.argv;if(!dir)throw Error('Usage: node scripts/verify-site-data.mjs DATA_DIR [REPORT.json]');
const load=async(sub,pick=()=>true)=>{const o=[];for(const f of await readdir(join(dir,sub)))if(pick(f))o.push(...JSON.parse(await readFile(join(dir,sub,f),'utf8')));return o;};
const details=await load('details'),pages=await load('pages',f=>f.startsWith('show-')),search=await load('search'),scope=JSON.parse(await readFile(join(dir,'scope.json'),'utf8'));
const by=m=>new Map(m.map(e=>[e.id,e])),D=by(details),P=by(pages),S=by(search),r={counts:{details:details.length,pages:pages.length,search:search.length,scopePublished:scope.publishedIds.length}};
const set=new Set(scope.publishedIds);
r.idSets={detailsNotInScope:details.filter(e=>!set.has(e.id)).length,scopeNotInDetails:scope.publishedIds.filter(i=>!D.has(i)).length,detailsDuplicateIds:details.length-D.size,pagesMissing:details.filter(e=>!P.has(e.id)).length,searchMissing:details.filter(e=>!S.has(e.id)).length};
const mism={title:[],date:[],cast:[],descSearch:[]};
for(const e of details){const p=P.get(e.id),s=S.get(e.id);for(const [n,x] of [['page',p],['search',s]]){if(!x)continue;if(x.title!==e.title)mism.title.push(e.id+':'+n);if(x.date!==e.date)mism.date.push(e.id+':'+n);if((x.cast||'')!==(e.cast||''))mism.cast.push(e.id+':'+n);}
  if(s&&e.description&&!String(s.keywords||'').startsWith(e.description))mism.descSearch.push(e.id);}
r.crossStore=Object.fromEntries(Object.entries(mism).map(([k,v])=>[k,{n:v.length,sample:v.slice(0,3)}]));
const bad={noTitle:0,badDate:0,noDesc:0,rawDesc:0,castBlank:0,badLink:[],dupUrl:[]};const svc={spotify:/open\.spotify\.com\/episode\//,apple:/podcasts\.apple\.com/,amazon:/music\.amazon|amazon\./,pocketcasts:/pca\.st|pocketcasts/,listen:/listen\.style/,pody:/pody\.|podcast-to-youtube|youtube\.com|youtu\.be/,asahi:/asahi\.com/,omny:/omny\.fm/};
const cov={},byUrl=new Map();
for(const e of details){if(!e.title)bad.noTitle++;if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+09:00$/.test(e.date||''))bad.badDate++;if(!e.description)bad.noDesc++;if(e.descriptionSource==='raw-rendered')bad.rawDesc++;if(!e.cast)bad.castBlank++;
  const sh=cov[e.show]||(cov[e.show]={n:0});sh.n++;const seen=new Set();
  for(const l of e.links||[]){if(!/^https:\/\/[^\s]+$/.test(l))bad.badLink.push(e.id);for(const [k,re] of Object.entries(svc))if(re.test(l)&&!seen.has(k)){seen.add(k);sh[k]=(sh[k]||0)+1;}
    if(/open\.spotify\.com\/episode\/|podcasts\.apple\.com\/.+i=/.test(l)){const key=e.show+'|'+l;(byUrl.get(key)||byUrl.set(key,[]).get(key)).push(e.id);}}}
bad.dupUrl=[...byUrl.values()].filter(v=>v.length>1);r.fieldQuality={...bad,badLink:bad.badLink.length,dupUrl:bad.dupUrl.length,dupUrlSample:bad.dupUrl.slice(0,5)};r.serviceCoverage=cov;
const kanji={'智子':0,'知子':0};for(const e of details){if(/赤根智子/.test(e.title+e.description))kanji['智子']++;if(/赤根知子/.test(e.title+e.description))kanji['知子']++;}r.icc=kanji;
const dd=findDuplicateCandidates(details.map(e=>({id:e.id,show:e.show,title:e.title,date:e.date,links:e.links,audio:e.audio})),{});r.duplicateCandidates={counts:dd.counts,pairs:dd.pairs.slice(0,10).map(p=>({a:p.a,b:p.b,v:p.verdict,reasons:p.reasons}))};
const issues=[r.idSets.detailsNotInScope,r.idSets.scopeNotInDetails,r.idSets.detailsDuplicateIds,r.idSets.pagesMissing,r.idSets.searchMissing,...Object.values(r.crossStore).map(x=>x.n),bad.noTitle,bad.badDate,r.fieldQuality.badLink,r.fieldQuality.dupUrl];
r.structuralPass=issues.every(x=>x===0);console.log(JSON.stringify(r,null,1));if(out)await writeFile(out,JSON.stringify(r,null,1));
