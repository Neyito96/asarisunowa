#!/usr/bin/env node
// Phase26 一連の模擬試験(READ_ONLY/COPY・外部通信なし)。入力は原本由来CSV(非コミット)、出力は件数・時間のみ。
// mode audit : 実データ97件の現状を5分類で監査(出演者空欄30件・Spotify未発見18件の原因)
// mode e2e   : 新着受領→GUID収蔵→空欄監査→補完キュー(429/遅延込み)→蔵への非破壊差分→非公開プレビュー反映を時間軸で再生
// 使い方: node scripts/phase26-simulate.mjs audit|e2e LEDGER.csv REPORT.json DETAILS_DIR [OUT.json]
import fs from 'node:fs';import path from 'node:path';
import {parseCsv,expandCompact} from './build-universe-preview.mjs';
import {ingest,isPublishable} from '../public/library/daily-ingest.mjs';
import {auditRow,proposals,applyProposals,extractCast} from '../public/library/gap-audit.mjs';
import {runCycle,ApiError} from '../public/library/fill-queue.mjs';
import {buildDashboard} from '../public/library/quality-dashboard.mjs';
import {publicEpisode,filterEpisodes} from '../public/library/library-core.mjs';
import {linkState,summarizeLinks} from '../public/library/link-state.mjs';
const [,, mode, csv, reportPath, detailsDir, outPath]=process.argv;
const raw=parseCsv(fs.readFileSync(csv,'utf8')).slice(1);
const rep=JSON.parse(fs.readFileSync(reportPath));const ids=new Set(rep.provisionalIds);
const rows=new Map(raw.filter(r=>ids.has(r[0])).map(r=>[r[0],expandCompact(r)]));
const det=[];for(const f of fs.readdirSync(detailsDir))det.push(...JSON.parse(fs.readFileSync(path.join(detailsDir,f))));
const showStat={};for(const e of det){const s=showStat[e.show]||={n:0,b:0};s.n++;s.b+=!String(e.cast||'').trim()?1:0;}
const jst=s=>{const m=/(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/.exec(s||'');return m?Date.parse(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00+09:00`):null;};
const SKIP=new Set(['related','amazon','pocketcasts','pody']); // CSVに列が無い(40-42,28)ため判定しない
const NOW=Date.parse('2026-11-10T16:00:00+09:00');
const ctxFor=(id,r,now,res={})=>({now,pubDate:jst(r[3]),resolutions:res,showEpisodeCount:showStat[r[1]]?.n||0,showCastBlankRate:showStat[r[1]]?(showStat[r[1]].b/showStat[r[1]].n):0,unmeasuredKeys:[...SKIP]});
const auditOf=(id,r,now,res)=>auditRow(r,ctxFor(id,r,now,res));
const tally=(list,f)=>list.reduce((m,x)=>{const k=f(x);m[k]=(m[k]||0)+1;return m;},{});
let out;
if(mode==='audit'){
  const castBlank=[],spBlank=[];
  for(const [id,r] of rows){const a=auditOf(id,r,NOW,{spotify:{status:'NOT_FOUND'},apple:{status:'NOT_FOUND'},listen:{status:'NOT_FOUND'}});
    if(a.find(x=>x.key==='cast1').status!=='FILLED')castBlank.push({id,show:r[1],...a.find(x=>x.key==='cast1')});
    if(a.find(x=>x.key==='spotify').status!=='FILLED')spBlank.push({id,show:r[1],pub:jst(r[3]),listen:!!r[10],audio:!!r[14],...a.find(x=>x.key==='spotify')});}
  const late=spBlank.filter(x=>x.pub>=Date.parse('2026-11-06T00:00:00+09:00'));const kodomo=spBlank.filter(x=>x.show==='こどもそうだんしつ');
  out={episodes:rows.size,cast1Blank:castBlank.length,castCauses:tally(castBlank,x=>x.status+':'+x.reason),castBlankByShow:tally(castBlank,x=>x.show),
    spotifyBlank:spBlank.length,spotifyGroups:{since1106:{n:late.length,causes:tally(late,x=>x.status+':'+x.reason),withAudioUrl:late.filter(x=>x.audio).length,withListenUrl:late.filter(x=>x.listen).length},
      kodomosoudanshitsu:{n:kodomo.length,causes:tally(kodomo,x=>x.status+':'+x.reason),withAudioUrl:kodomo.filter(x=>x.audio).length,withListenUrl:kodomo.filter(x=>x.listen).length}},
    requiredStatusAll:tally([...rows].flatMap(([id,r])=>auditOf(id,r,NOW,{spotify:{status:'NOT_FOUND'}}).filter(a=>a.tier==='required')),a=>a.status),
    note:'CSVに無い列(関連記事28/Amazon40/PocketCasts41/Pody42)は判定対象外'};
} else {
  // e2e: 真値=実データ。作業行は補完対象列だけを空にして再生。サービス公開遅延は決定的に生成。16件(11/06以降)と個別2件は真値が空=公開されない。
  const COLS={listen:10,spotify:11,apple:12};const castCols=[45,46,47,48,49];
  const truth=new Map(rows);const work=new Map([...rows].map(([k,v])=>{const w=v.slice();[10,11,12,22,...castCols].forEach(c=>w[c]='');return [k,w];}));
  const hash=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
  const publishDelayH=(id,pl)=>1+(hash(id+pl)%7); // 1〜7時間後に各サービスへ反映
  const days=[...new Set([...rows.values()].map(r=>new Date(jst(r[3])).toISOString().slice(0,10)))].sort();
  const feed=[...rows.entries()].map(([id,r])=>({guid:r[6],title:r[2],show:r[1],pubDate:new Date(jst(r[3])).toISOString(),audio:r[14],link:''}));
  let registry={episodes:[],runs:[]};const t0=Math.min(...[...rows.values()].map(r=>jst(r[3])));
  // 受領: 配信の5分後に収蔵(模擬)。各EPの時間軸で処理。
  const epMeta=new Map();let state={};let rowsNow=work;const logs=[];let calls=0,rate429=0,first429Done=false;
  const sched=[];const tEnd=Math.max(...[...rows.values()].map(r=>jst(r[3])))+36*3600e3;
  for(let t=t0;t<=tEnd;t+=2*3600e3)sched.push(t); // 2時間ごとの巡回
  const idByGuid=new Map([...rows.entries()].map(([id,r])=>[r[6],id]));
  for(const now of sched){
    const visible=feed.filter(f=>Date.parse(f.pubDate)+5*60e3<=now);
    const a=ingest(registry,visible.map(f=>({...f})),{now:new Date(now).toISOString()});registry=a.registry;
    for(const e of registry.episodes){if(!e.id.startsWith('X')){}}
    // registry のEP-IDは追記専用の新ID。実台帳IDとの対応を保持
    const tasks=[];
    for(const f of visible){const id=idByGuid.get(f.guid);if(!epMeta.has(id))epMeta.set(id,{pub:Date.parse(f.pubDate),collectedAt:now,filledAt:null,previewAt:null});
      const r=rowsNow.get(id);for(const [pl,c] of Object.entries(COLS))if(!String(r[c]).trim())tasks.push({key:id+'|'+pl,epId:id,platform:pl,pubDate:Date.parse(f.pubDate),input:{id,pl}});}
    const resolvers=Object.fromEntries(Object.keys(COLS).map(pl=>[pl,async({id})=>{
      calls++;if(pl==='apple'&&!first429Done&&now>t0+30*3600e3){first429Done=true;rate429++;throw new ApiError('429',429,3600);}
      const url=truth.get(id)[COLS[pl]];if(!String(url).trim())return {status:'NOT_FOUND',reason:'NO_MATCH'};
      if(now<epMeta.get(id).pub+publishDelayH(id,pl)*3600e3)return {status:'NOT_FOUND',reason:'NOT_YET_PUBLISHED_ON_SERVICE'};
      return {status:'VERIFIED',url,evidence:['mock-service-episode guid-match']};}]));
    const cyc=await runCycle({tasks,state,resolvers,now,budget:400});state=cyc.state;
    const resMap={};for(const r of cyc.results)(resMap[r.epId]||={})[r.platform]=r;
    for(const f of visible){const id=idByGuid.get(f.guid),r=rowsNow.get(id);
      const au=auditRow(r,{...ctxFor(id,truth.get(id),now,resMap[id]||{}),official:{descRaw:truth.get(id)[21],audio:truth.get(id)[14]}});
      const p=proposals(id,r,au,{checkedAt:new Date(now).toISOString()});const ap=applyProposals(rowsNow,p,{appliedAt:new Date(now).toISOString()});rowsNow=ap.rows;
      if(ap.log.length){epMeta.get(id).previewAt??=now;epMeta.get(id).filledAt=now;logs.push(...ap.log.map(l=>({ep:l.epId,col:l.col,at:now})));}
    }
  }
  const final=[...rowsNow.entries()].map(([id,r])=>{const m=epMeta.get(id);const au=auditRow(r,ctxFor(id,truth.get(id),tEnd,{spotify:{status:'NOT_FOUND'},apple:{status:'NOT_FOUND'},listen:{status:'NOT_FOUND'}}));
    return {id,pubDate:m.pub,collectedAt:m.collectedAt,filledAt:m.filledAt,previewAt:m.previewAt,review:'unreviewed',decision:null,approval:null,audit:au};});
  const dash=buildDashboard({episodes:final,runs:[{status:'OK',finishedAt:new Date(tEnd).toISOString()}],now:tEnd});
  const exact=[...rowsNow].every(([id,r])=>[10,11,12].every(c=>!String(r[c]).trim()||r[c]===truth.get(id)[c])); // 書いた値は真値と一致
  const nm=v=>String(v||'').split(/[（(]/)[0].replace(/\s+/g,'').replace(/さん$/,'');
  let castRows=0,cast1Match=0,castSetMatch=0;
  for(const [id,t] of truth){if(!String(t[45]).trim())continue;castRows++;const d=extractCast(t[21]).names.map(nm),l=[45,46,47,48,49].map(c=>nm(t[c])).filter(Boolean);
    if(d[0]===l[0])cast1Match++;if(d.length===l.length&&d.every((x,i)=>x===l[i]))castSetMatch++;}
  // --- 蔵→宇宙(非公開プレビュー)反映の検証: 検索索引/リンク/概要/出演者 ---
  const t1=Date.now();const items=[...rowsNow.values()].map(r=>publicEpisode(r));
  const withDesc=[...rowsNow.values()].filter(r=>String(r[22]).trim());
  let descSearchHit=0,descTried=0,linkVisible=0,linkTried=0,rawIntact=0;
  for(const [id,r] of rowsNow){ if(r[21]===truth.get(id)[21])rawIntact++;
    if(String(r[22]).trim()){const w=(items.find(x=>x.id===id).description.match(/[\p{Script=Han}\p{Script=Katakana}]{3,}/u)||[])[0];if(w){descTried++;if(filterEpisodes(items,{query:w}).some(x=>x.id===id))descSearchHit++;}}
    if(String(r[11]).trim()){linkTried++;if(items.find(x=>x.id===id).links.includes(r[11]))linkVisible++;}}
  const indexBuildMs=Date.now()-t1;
  // 出演者: 提案のみ(未反映)の時は検索に出ない。「人が承認した」を模した適用(清潔層のみ)後に出ることを確認
  const castBefore=[...rowsNow].filter(([id,r])=>String(r[45]).trim()).length;
  let sim=rowsNow,castSuggested=0,castCleanSug=0;
  for(const [id,r] of rowsNow){const au=auditRow(r,ctxFor(id,truth.get(id),tEnd,{}));const ps=proposals(id,r,au,{checkedAt:'t'}).filter(p=>p.kind!==undefined||true).filter(p=>p.mode==='suggest-only');
    castSuggested+=ps.length>0?1:0;const clean=ps.filter(p=>p.confidence==='clean').map(p=>({...p,autoApplicable:true}));castCleanSug+=clean.length>0?1:0;
    if(clean.length)sim=applyProposals(sim,clean,{appliedAt:'sim-human-approval'}).rows;}
  const items2=[...sim.values()].map(r=>publicEpisode(r));let castSearchHit=0,castTried=0;
  for(const [id,r] of sim){if(!String(r[45]).trim())continue;const nm0=String(r[45]).split(/[（(]/)[0];castTried++;if(filterEpisodes(items2,{query:nm0}).some(x=>x.id===id))castSearchHit++;}
  const linkStates=summarizeLinks([...rowsNow].flatMap(([id,r])=>['spotify','apple','listen'].map(pl=>linkState({platform:pl,show:r[1],existingUrl:r[COLS[pl]],resolution:{status:'NOT_FOUND'},ageHours:(tEnd-jst(r[3]))/3600e3}))));
  const reflect={castCellsWrittenBeforeApproval:castBefore,episodesWithCastSuggestion:castSuggested,episodesWithCleanTierSuggestion:castCleanSug,
    descCleanFilled:withDesc.length,descSearchable:{tried:descTried,hit:descSearchHit},linksVisibleInPreview:{tried:linkTried,visible:linkVisible},rawDescriptionUnchanged:{rows:rowsNow.size,intact:rawIntact},
    castSearchAfterSimulatedHumanApproval:{tried:castTried,hit:castSearchHit},indexRebuildMs:indexBuildMs,linkStatesAtEnd:linkStates};
  const lat=m=>{const a=[...epMeta.values()].map(x=>x[m]!=null?(x[m]-x.pub)/3600e3:null).filter(x=>x!=null).sort((p,q)=>p-q);return a.length?{p50h:+a[Math.floor(a.length/2)].toFixed(2),maxh:+a.at(-1).toFixed(2),n:a.length}:null;};
  reflect.simulatedLatencyFromPublish={collected:lat('collectedAt'),previewReflected:lat('previewAt'),note:'模擬: 巡回2時間周期・サービス側反映遅延1〜7時間は決定的に生成した仮定値。実測ではない。'};
  out={episodes:rows.size,patrols:sched.length,evaluationKind:'FIXTURE_REPLAY: 台帳の原本を真値(oracle)として再生。外部サービス取得の実測ではない。',reflect,castAgainstExistingLedger:{rowsWithLedgerCast:castRows,cast1Match,fullSetMatch:castSetMatch},apiCalls:calls,rate429Injected:rate429,cellWrites:logs.length,writtenValuesMatchTruth:exact,
    unreviewedNeverPublishable:[...registry.episodes].every(e=>!isPublishable(e)),dashboard:dash};
}
console.log(JSON.stringify(out,null,1));if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1));
