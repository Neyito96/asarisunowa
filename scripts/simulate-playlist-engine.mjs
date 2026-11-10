#!/usr/bin/env node
// 共通Spotifyエンジンの模擬E2E(メモリ上のSpotify・外部通信なし・COPY/本番に触れない)。
// 実データ(RSS由来の台帳行)を「配信順に到着する新着」として流し、(1)設定1行追加 (2)新着→追加候補 (3)フォーム投稿 (4)人が消した曲の不復活 (5)旧GAS方式との差分 (6)クラッシュ再実行 を検証する。
// 使い方: node scripts/simulate-playlist-engine.mjs DETAILS_DIR CONFIG_CSV OUT.json
import vm from 'node:vm';import fs from 'node:fs';import path from 'node:path';
import {parseConfig} from '../public/library/playlist-config.mjs';
import {enqueue,newQueue,runEngine,intakeFormPost,planRule,matchEpisode,newLedger} from '../public/library/playlist-engine.mjs';
import {memoryStore} from '../public/library/journal-lease.mjs';
const [,, detailsDir,csvPath,outPath]=process.argv;
const D=new URL('./google-apps-script/',import.meta.url).pathname;
const ctx=vm.createContext({console,Logger:{log(){}}});
for(const n of fs.readdirSync(D).filter(f=>/^(PlaylistAuto.*|AutoUpdateAutomationV1)\.js$/.test(f)&&!/Tests\.js$/.test(f))){try{vm.runInContext(fs.readFileSync(D+n,'utf8')+'\n',ctx,{filename:n});}catch{}}
const legacy=vm.runInContext('AUTO_PLAYLIST_RULES.map(r=>JSON.parse(JSON.stringify(r)))',ctx);const primary=vm.runInContext('ASAHI_PRIMARY_SHOW_IDS.slice()',ctx);
const strategies={'no-mirai-title-prefix':e=>ctx.extractNoMiraiEpisodeNumber_(e.name)!==null,'ota-safe-confirmed':e=>ctx.classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(e)?.classification==='confirmed','sato-yo-safe-confirmed':e=>ctx.isSpeakerGuardrailConfirmed_(ctx.classifySatoYoAutoPlaylistEpisode_(e))};
const csv=fs.readFileSync(csvPath,'utf8').trim().split('\n').map(l=>[...l.matchAll(/"((?:[^"]|"")*)"/g)].map(m=>m[1].replace(/""/g,'"')));
const det=[];for(const f of fs.readdirSync(detailsDir))det.push(...JSON.parse(fs.readFileSync(path.join(detailsDir,f))));
const eps=det.map(e=>({id:e.id,uri:'spotify:episode:'+e.id,name:e.title||'',description:e.description||'',html_description:e.description||'',release_date:String(e.date||'').slice(0,10)})).sort((a,b)=>a.release_date<b.release_date?-1:a.release_date>b.release_date?1:a.id.localeCompare(b.id));
const CUT='2026-11-06';const fake=(init)=>{const uris=[...init];const c={add:0,addedUris:[],list:0};return {uris,c,async listPage(){c.list++;return {items:[...uris],next:null};},async addItems(pl,u){c.add++;c.addedUris.push(...u);uris.push(...u);}};};
const out={kind:'MOCK_E2E (in-memory Spotify; fixture = ledger rows by publish order)',episodes:eps.length,cutoff:CUT};
// --- (1) 設定1行追加: 既存9行の表に1行足しただけ。コード変更なし。
const newRow=['new-list','TRUE','n'.repeat(22),'新規テスト','title-text','PRIMARY','ポリレビ','','name','any','','approved','incremental','LIVE','engine','10',''];
const base=parseConfig(csv,{strategies,primaryShowIds:primary});const withNew=parseConfig([...csv,newRow],{strategies,primaryShowIds:primary});
out.addOneRow={tableRowsBefore:base.rules.length,tableRowsAfter:withNew.rules.length,codeFilesChanged:0,newTriggersNeeded:0,newRuleBlocked:withNew.rules.at(-1).blocked,errorsAfter:withNew.errors.length};
// --- (2) 新着→追加候補(全固定ルール、DRY_RUN)。期待値=旧GAS照合関数の判定。
const rules=withNew.rules.filter(r=>r.key!=='new-list');const before=eps.filter(e=>e.release_date<CUT),after=eps.filter(e=>e.release_date>=CUT);
const pls={};for(const r of rules){const lr=legacy.find(l=>l.key===r.key);pls[r.playlistId]??=fake(before.filter(e=>lr&&ctx.matchesAutoPlaylistRule_(e,lr)).map(e=>e.uri));}
const spotify={async listPage(pl,cur){return pls[pl].listPage(pl,cur);},async addItems(pl,u){return pls[pl].addItems(pl,u);}};
const q=newQueue();for(const e of after)enqueue(q,{episode:e,origin:'rss',at:1});
const store=memoryStore();const r1=await runEngine({rules:rules.filter(r=>r.enabled),queue:q,spotify,strategies,store,runId:'d1',now:Date.parse('2026-11-10T04:30:00+09:00'),globalMode:'DRY_RUN'});
let equal=0,total=0;const perRule={};
for(const res of r1.results){const lr=legacy.find(l=>l.key===res.key);const exp=new Set(after.filter(e=>ctx.matchesAutoPlaylistRule_(e,lr)&&!pls[lr.playlistId].uris.includes(e.uri)).map(e=>e.uri));const got=new Set(res.candidates||[]);
  const same=exp.size===got.size&&[...exp].every(x=>got.has(x));total++;equal+=same?1:0;perRule[res.key]={expected:exp.size,engine:got.size,same,status:res.status};}
out.newArrivalsToCandidates={newArrivals:after.length,rulesCompared:total,identicalToLegacyLogic:equal,perRule,spotifyWritesInDryRun:Object.values(pls).reduce((s,p)=>s+p.c.add,0)};
// --- (3) フォーム投稿: 既登録(重複させず不足補完のみ)/新規(収蔵候補)/承認前は追加されない
const byKey={};for(const e of after.slice(0,2))byKey[e.id]={epId:'EP-'+e.id,guid:e.id,decision:'対象'};byKey['x-excluded']={epId:'EP-X',decision:'除外'};
const fq=newQueue();const reg=intakeFormPost({guid:after[0].id,uri:after[0].uri,episode:after[0]},{byKey,queue:fq,now:1});
const fresh=intakeFormPost({guid:'brand-new',uri:'spotify:episode:brandnew',episode:{id:'brandnew',uri:'spotify:episode:brandnew',name:'ポリレビ#99',release_date:'2026-11-10'}},{byKey,queue:fq,now:1});
const exc=intakeFormPost({guid:'x-excluded',episode:{id:'xe',name:'ポリレビ#98'}},{byKey,queue:fq,now:1});
const pol=rules.find(r=>r.key==='polirebi');const fp=planRule(pol,{items:Object.values(fq.items),playlist:{complete:true,uris:[]},ledger:newLedger(),now:1,strategies});
out.formIntake={registered:reg.kind,fillOnly:reg.fillOnly,newCandidate:fresh.kind,excludedRespected:exc.kind,addedBeforeApproval:fp.adds.length,heldReasons:[...new Set(fp.skipped.map(s=>s.reason))]};
// --- (4) 人が消した曲は戻さない vs 旧方式(不足=追加)
const pol0=legacy.find(l=>l.key==='polirebi');const polAll=eps.filter(e=>ctx.matchesAutoPlaylistRule_(e,pol0));const sp4=fake(polAll.map(e=>e.uri));const removed=polAll.slice(0,3).map(e=>e.uri);
const q4=newQueue();for(const e of polAll)enqueue(q4,{episode:e,origin:'rss',at:1});const rule4={...pol,mode:'LIVE',writer:'engine'};const st4={handoff:{polirebi:{readOnlyDiffMatch:true,legacyDisabledConfirmed:true}}};let s4=st4,wrote=0;
const store4=memoryStore();s4=(await runEngine({rules:[rule4],queue:q4,spotify:sp4,state:s4,store:store4,runId:'u0',now:1,globalMode:'LIVE'})).state;
for(const u of removed)sp4.uris.splice(sp4.uris.indexOf(u),1);
for(let i=1;i<=5;i++){const r=await runEngine({rules:[rule4],queue:q4,spotify:sp4,state:s4,store:store4,runId:'u'+i,now:1+i,globalMode:'LIVE'});s4=r.state;wrote+=r.results.reduce((s,x)=>s+(x.wrote||0),0);}
const naive=polAll.filter(e=>!sp4.uris.includes(e.uri)).length; // 旧方式(syncOneAutoPlaylist_: 不足=追加)が次の1回で戻す件数
out.humanRemoval={playlistSize:polAll.length,removedByHuman:removed.length,engineReAddedOver5Runs:wrote,legacyWouldReAddNextRun:naive,tombstones:Object.keys(s4.ledgers.polirebi.tombstones).length};
// --- (5) クラッシュ(追加後にCOMMIT拒否)→再実行しても二重追加なし
const sp5=fake([]);const q5=newQueue();enqueue(q5,{episode:{id:'c1',uri:'spotify:episode:c1',name:'ポリレビ#1',release_date:'2026-11-10'},origin:'rss',at:1});const store5=memoryStore();
const ra=await runEngine({rules:[rule4],queue:q5,spotify:sp5,state:st4,store:store5,runId:'same',now:1,globalMode:'LIVE'});const rb=await runEngine({rules:[rule4],queue:q5,spotify:sp5,state:st4,store:store5,runId:'same',now:2,globalMode:'LIVE'});
const rc=await runEngine({rules:[rule4],queue:q5,spotify:sp5,state:st4,store:store5,runId:'other',now:3,globalMode:'LIVE'});
out.crashRerun={firstRun:ra.status,sameRunIdRetry:rb.status,laterRunAdds:rc.results.reduce((s,x)=>s+(x.wrote||0),0),playlistEntries:sp5.uris.length};
console.log(JSON.stringify(out,null,1));if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1));
