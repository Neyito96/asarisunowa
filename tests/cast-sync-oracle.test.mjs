import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {buildPreview} from '../scripts/build-universe-preview.mjs';
import {readOracle,compareToPreview} from '../scripts/verify-cast-oracle.mjs';
const SHOW='ニュースの学校';
const row=(id,cast,x)=>{const r=Array(55).fill('');r[0]=id;r[1]=SHOW;r[2]='題'+id;r[3]='2025/1/1 4:00';r[21]='概要';r[38]='未指定';r[23]=x??cast.map(c=>c+',MC').join(' / ');cast.forEach((n,i)=>r[45+i]=n);return r;};
const ep=(id,cast='')=>({id,show:SHOW,title:'題'+id,date:'2025-01-01T04:00:00+09:00',cast,description:'概要',descriptionSource:'clean',duration:0,audio:'',audioAvailable:false,links:[],related:[],tags:[]});
const snap=ids=>({schema:1,source:{rawReadSHA256:'a'.repeat(64)},decisions:ids.map(id=>({id,show:SHOW,comparison:'対象',publication:'対象',classification:'通常',review:'確認済み',decidedAt:'2026-10-22T00:00:00+09:00'}))});
const csv=(rows)=>'﻿EP-ID,番組名,出演者1,情報区分,日付\n'+rows.map(([id,c])=>`${id},${SHOW},${c},管理人指定,2025-01-01`).join('\n')+'\n';
const load=async(dir,sub,pick=()=>true)=>{const out=[];for(const f of await readdir(join(dir,sub)))if(pick(f))out.push(...JSON.parse(await readFile(join(dir,sub,f),'utf8')));return out;};
const run=async(ledger,existing,ids)=>{const dir=join(await mkdtemp(join(tmpdir(),'or-')),'out');const r=await buildPreview({ledgerRows:ledger,existingDetails:existing,decisionSnapshot:snap(ids),destination:dir,snapshotDate:'2026-11-10'});return {dir,r,stores:{details:await load(dir,'details'),pages:await load(dir,'pages',f=>f.startsWith('show-')),search:await load(dir,'search')}};};
const N=500,ids=Array.from({length:N},(_,i)=>'EP-'+String(800+i).padStart(5,'0'));
test('oracle CSV (司令塔の最小形式) drives the expectation; preview matches per EP-ID; counts are derived, not hardcoded',async()=>{
  const moku=new Set([0,31,44,65,74,75,86,96].map(i=>ids[i])); // 件数は集合の大きさから導出(8でも別の数でもよい)
  const ledger=ids.map(id=>row(id,[moku.has(id)?'杢田光':'神田大介']));
  const old=ids.map(id=>ep(id,['EP-00858'].includes(id)?'':'神田大介,MC')); // 旧スナップショット(別の古い値/空欄混在)
  const {stores}=await run(ledger,old,ids);
  const oracle=readOracle(csv(ledger.map(r=>[r[0],r[45]])));assert.equal(oracle.length,N);
  const rep=compareToPreview(oracle,stores);assert.equal(rep.pass,true,JSON.stringify(rep).slice(0,300));
  assert.equal(rep.expectedPerPerson['杢田光'],moku.size);assert.equal(rep.expectedPerPerson['神田大介'],N-moku.size);assert.equal(rep.searchHits['杢田光'],moku.size);
});
test('oracle comparison detects a wrong preview, a missing EP-ID and an inconsistent store',async()=>{
  const ledger=ids.slice(0,10).map(id=>row(id,['神田大介']));const {stores}=await run(ledger,ids.slice(0,10).map(id=>ep(id,'神田大介,MC')),ids.slice(0,10));
  const oracle=readOracle(csv([...ledger.map(r=>[r[0],r[45]]),['EP-09999','神田大介']]));oracle[0].names=['杢田光'];
  const rep=compareToPreview(oracle,stores);assert.equal(rep.pass,false);assert.deepEqual(rep.missingInPreview,['EP-09999']);assert.equal(rep.wrong[0].id,ids[0]);
  const bad={...stores,search:stores.search.map((e,i)=>i===0?{...e,cast:'別人'}:e)};assert.ok(compareToPreview(readOracle(csv(ledger.map(r=>[r[0],r[45]]))),bad).consistency.mismatches>0);
  assert.throws(()=>readOracle('a,b\n1,2\n'),/ORACLE_COLUMNS_MISSING/);
});
test('追加訂正(2025-01-31のような後日訂正)は差分だけ反映、再実行は変更0、X/AT重複除去、台帳空欄は既存を保持',async()=>{
  const ledger=ids.map(id=>row(id,['神田大介']));const first=await run(ledger,ids.map(id=>ep(id)),ids);
  assert.equal(first.r.report.castRefresh.changed,N);
  const target=ids[200],ledger2=ledger.map(r=>r[0]===target?row(target,['杢田光']):r);
  const second=await run(ledger2,first.stores.details,ids);assert.deepEqual(second.r.report.castRefresh.ids,[target]);
  const third=await run(ledger2,second.stores.details,ids);assert.equal(third.r.report.castRefresh.changed,0);
  const dup=row(ids[1],['神田大介','神田大介'],'神田大介,MC / 神田大介');const d=await run([dup],[ep(ids[1])],[ids[1]]);assert.equal(d.stores.details.find(e=>e.id===ids[1]).cast,'神田大介,MC');
  const blank=row(ids[2],[],'');const b=await run([blank],[ep(ids[2],'既存の指定')],[ids[2]]);assert.equal(b.stores.details.find(e=>e.id===ids[2]).cast,'既存の指定');assert.equal(b.r.report.castRefresh.keptBlank,1);
});
