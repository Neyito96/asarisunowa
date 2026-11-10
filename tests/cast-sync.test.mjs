import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {buildPreview} from '../scripts/build-universe-preview.mjs';
import {refreshCastFromLedger,ledgerCast,verifyCastConsistency,castCountsForShow,castNames} from '../public/library/cast-sync.mjs';
import {filterEpisodes} from '../lib/library-public.mjs';
const SHOW='ニュースの学校';
const row=(id,date,cast=[],x='')=>{const r=Array(55).fill('');r[0]=id;r[1]=SHOW;r[2]='題'+id;r[3]=date;r[21]='概要';r[38]='未指定';r[23]=x;cast.forEach((n,i)=>r[45+i]=n);return r;};
const ep=(id,cast='')=>({id,show:SHOW,title:'題'+id,date:'2025-01-01T04:00:00+09:00',cast,description:'概要',descriptionSource:'clean',duration:0,audio:'',audioAvailable:false,links:[],related:[],tags:[]});
const snap=ids=>({schema:1,source:{rawReadSHA256:'a'.repeat(64)},decisions:ids.map(id=>({id,show:SHOW,comparison:'対象',publication:'対象',classification:'通常',review:'確認済み',decidedAt:'2026-10-22T00:00:00+09:00'}))});
// 件数は固定せず、生成条件(総数・例外の番号集合)から期待値を導く
const make=(n,exceptions)=>{const ids=Array.from({length:n},(_,i)=>'EP-'+String(i+1).padStart(5,'0'));const ex=new Set(exceptions.map(i=>ids[i]));
  return {ids,ex,existing:ids.map(id=>ep(id)),rows:ids.map(id=>row(id,'2025/1/1 4:00',[ex.has(id)?'杢田光':'神田大介'],ex.has(id)?'杢田光,編集':'神田大介,MC'))};};

test('ledger cast (X + AT..AX) is merged without duplicates',()=>{
  assert.equal(ledgerCast(row('EP-1','2025/1/1',['神田大介'],'神田大介,MC')),'神田大介,MC');
  assert.equal(ledgerCast(row('EP-1','2025/1/1',['杢田光','神田大介'],'')),'杢田光 / 神田大介');
  assert.equal(ledgerCast(row('EP-1','2025/1/1',[],'')),'');
});
test('refresh adds/replaces from ledger, keeps value when ledger blank, never touches others, idempotent',()=>{
  const m=new Map([['EP-1',row('EP-1','d',['神田大介'])],['EP-2',row('EP-2','d',['杢田光'])],['EP-3',row('EP-3','d',[])]]);
  const existing=[ep('EP-1',''),ep('EP-2','神田大介'),ep('EP-3','既存の人'),ep('EP-9','対象外')];
  const a=refreshCastFromLedger(existing,m);
  assert.deepEqual(a.changes.map(c=>[c.id,c.kind]),[['EP-1','CAST_ADDED'],['EP-2','CAST_CHANGED']]);
  assert.equal(a.episodes.find(e=>e.id==='EP-3').cast,'既存の人');assert.equal(a.keptBlank,1);assert.equal(a.missingInLedger,1);assert.equal(existing[0].cast,''); // 入力不変
  const b=refreshCastFromLedger(a.episodes,m);assert.equal(b.changes.length,0); // 冪等
  // 追加訂正: 台帳の人物が別の人へ直されたら次の同期でそのまま反映
  m.set('EP-1',row('EP-1','d',['杢田光']));const c=refreshCastFromLedger(a.episodes,m);assert.deepEqual(c.changes.map(x=>[x.id,x.after[0]]),[['EP-1','杢田光']]);
});
test('suggestion values are never used: only the ledger decides (human-confirmed cast is not overwritten by guesses)',()=>{
  const r=row('EP-1','d',['杢田光']);r[21]='【出演】神田大介（MC）'; // 概要からの抽出なら神田になるが、台帳(人間確定)は杢田
  const out=refreshCastFromLedger([ep('EP-1','')],new Map([['EP-1',r]]));assert.equal(out.episodes[0].cast,'杢田光');
});
for(const [n,exs] of [[500,[0,7,100,250,311,400,499]],[40,[3]],[12,[]],[500,[1,2,3,4,5,6,7,8,9,10,11,12]]]){
  test(`news-school style sync end-to-end n=${n} exceptions=${exs.length}: detail/list/search agree and counts derive from the ledger (not hardcoded)`,async()=>{
    const {ids,ex,existing,rows}=make(n,exs);const dir=join(await mkdtemp(join(tmpdir(),'cs-')),'out');
    const {report}=await buildPreview({ledgerRows:rows,existingDetails:existing,decisionSnapshot:snap(ids),destination:dir,snapshotDate:'2026-11-10'});
    assert.equal(report.castRefresh.changed,n);assert.equal(report.castRefresh.byShow[SHOW],n);
    const man=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
    const load=async(sub,pick)=>{const out=[];for(const f of await readdir(join(dir,sub)))if(pick(f))out.push(...JSON.parse(await readFile(join(dir,sub,f),'utf8')));return out;};
    const details=await load('details',()=>true),pages=await load('pages',f=>f.startsWith('show-')),search=await load('search',()=>true);
    const cons=verifyCastConsistency({details,pages,search});assert.equal(cons.mismatches.length,0);assert.equal(cons.episodes,n);
    const counts=castCountsForShow(details,SHOW);assert.equal(counts['杢田光']||0,ex.size);assert.equal(counts['神田大介'],n-ex.size);
    const q=name=>filterEpisodes(search,{query:name,show:SHOW}).length;assert.equal(q('杢田光'),ex.size);assert.equal(q('神田大介'),n-ex.size);
    assert.equal(man.total,n);
    // 追加訂正(例外の入替)を再同期: 差分だけ反映、他は不変、冪等
    const moved=ids.find(id=>!ex.has(id)),rows2=rows.map(r=>r[0]===moved?row(moved,'2025/1/1 4:00',['杢田光'],'杢田光,編集'):r);
    const next=await buildPreview({ledgerRows:rows2,existingDetails:details,decisionSnapshot:snap(ids),destination:join(await mkdtemp(join(tmpdir(),'cs-')),'out'),snapshotDate:'2026-11-10'});
    assert.deepEqual(next.report.castRefresh.ids,[moved]);
    const again=await buildPreview({ledgerRows:rows2,existingDetails:next.result?details.map(d=>d.id===moved?{...d,cast:'杢田光,編集'}:d):details,decisionSnapshot:snap(ids),destination:join(await mkdtemp(join(tmpdir(),'cs-')),'out'),snapshotDate:'2026-11-10'});
    assert.equal(again.report.castRefresh.changed,0);
  });
}
test('unreviewed new arrivals stay provisional/unreviewed and are never in the published scope; cast sync does not change that',async()=>{
  const {ids,existing,rows}=make(5,[1]);const r6=row('EP-00006','2026/11/10 4:00',['神田大介'],'神田大介,MC');
  const dir=join(await mkdtemp(join(tmpdir(),'cs-')),'out');
  const {report}=await buildPreview({ledgerRows:[...rows,r6],existingDetails:existing,decisionSnapshot:snap(ids),destination:dir,snapshotDate:'2026-11-10'});
  assert.deepEqual(report.provisionalIds,['EP-00006']);const man=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  assert.equal(man.preview.provisional,true);assert.match(man.preview.note,/公開不可/);assert.equal(man.counts.provisionalUnreviewed,1);
});
test('castNames parses titles/separators',()=>{assert.deepEqual(castNames('神田大介,MC / 杢田光,編集'),['神田大介','杢田光']);});
