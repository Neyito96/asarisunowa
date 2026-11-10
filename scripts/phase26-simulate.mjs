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
const [,, mode, csv, reportPath, detailsDir, outPath]=process.argv;
const raw=parseCsv(fs.readFileSync(csv,'utf8')).slice(1);
const rep=JSON.parse(fs.readFileSync(reportPath));const ids=new Set(rep.provisionalIds);
const rows=new Map(raw.filter(r=>ids.has(r[0])).map(r=>[r[0],expandCompact(r)]));
const det=[];for(const f of fs.readdirSync(detailsDir))det.push(...JSON.parse(fs.readFileSync(path.join(detailsDir,f))));
const showStat={};for(const e of det){const s=showStat[e.show]||={n:0,b:0};s.n++;s.b+=!String(e.cast||'').trim()?1:0;}
const jst=s=>{const m=/(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/.exec(s||'');return m?Date.parse(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00+09:00`):null;};
const SKIP=new Set(['related','amazon','pocketcasts','pody']); // CSVに列が無い(40-42,28)ため判定しない
const NOW=Date.parse('2026-11-10T16:00:00+09:00');
const ctxFor=(id,r,now,res={})=>({now,pubDate:jst(r[3]),resolutions:res,showEpisodeCount:showStat[r[1]]?.n||0,showCastBlankRate:showStat[r[1]]?(showStat[r[1]].b/showStat[r[1]].n):0});
const auditOf=(id,r,now,res)=>auditRow(r,ctxFor(id,r,now,res)).filter(a=>!SKIP.has(a.key));
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
  const truth=new Map(rows);const work=new Map([...rows].map(([k,v])=>{const w=v.slice();[10,11,12,...castCols].forEach(c=>w[c]='');return [k,w];}));
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
      const au=auditRow(r,{...ctxFor(id,truth.get(id),now,resMap[id]||{}),official:{descRaw:truth.get(id)[21],audio:truth.get(id)[14]}}).filter(x=>!SKIP.has(x.key));
      const p=proposals(id,r,au,{checkedAt:new Date(now).toISOString()});const ap=applyProposals(rowsNow,p,{appliedAt:new Date(now).toISOString()});rowsNow=ap.rows;
      if(ap.log.length){epMeta.get(id).previewAt??=now;epMeta.get(id).filledAt=now;logs.push(...ap.log.map(l=>({ep:l.epId,col:l.col,at:now})));}
    }
  }
  const final=[...rowsNow.entries()].map(([id,r])=>{const m=epMeta.get(id);const au=auditRow(r,ctxFor(id,truth.get(id),tEnd,{spotify:{status:'NOT_FOUND'},apple:{status:'NOT_FOUND'},listen:{status:'NOT_FOUND'}})).filter(x=>!SKIP.has(x.key));
    return {id,pubDate:m.pub,collectedAt:m.collectedAt,filledAt:m.filledAt,previewAt:m.previewAt,review:'unreviewed',decision:null,approval:null,audit:au};});
  const dash=buildDashboard({episodes:final,runs:[{status:'OK',finishedAt:new Date(tEnd).toISOString()}],now:tEnd});
  const exact=[...rowsNow].every(([id,r])=>[10,11,12].every(c=>!String(r[c]).trim()||r[c]===truth.get(id)[c])); // 書いた値は真値と一致
  const nm=v=>String(v||'').split(/[（(]/)[0].replace(/\s+/g,'').replace(/さん$/,'');
  let castRows=0,cast1Match=0,castSetMatch=0;
  for(const [id,t] of truth){if(!String(t[45]).trim())continue;castRows++;const d=extractCast(t[21]).names.map(nm),l=[45,46,47,48,49].map(c=>nm(t[c])).filter(Boolean);
    if(d[0]===l[0])cast1Match++;if(d.length===l.length&&d.every((x,i)=>x===l[i]))castSetMatch++;}
  out={episodes:rows.size,patrols:sched.length,castAgainstExistingLedger:{rowsWithLedgerCast:castRows,cast1Match,fullSetMatch:castSetMatch},apiCalls:calls,rate429Injected:rate429,cellWrites:logs.length,writtenValuesMatchTruth:exact,
    unreviewedNeverPublishable:[...registry.episodes].every(e=>!isPublishable(e)),dashboard:dash};
}
console.log(JSON.stringify(out,null,1));if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1));
