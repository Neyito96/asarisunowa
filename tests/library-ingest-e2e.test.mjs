// Uses the existing, pinned PR #243 V3 code in a separate checkout. All GAS services
// are the existing in-memory harness. Never invokes a real Google/Spotify writer.
import test from'node:test';import assert from'node:assert/strict';
import{readFile,writeFile,mkdtemp,rm}from'node:fs/promises';import{resolve,join}from'node:path';import{pathToFileURL}from'node:url';import{tmpdir}from'node:os';import{execFile}from'node:child_process';import{promisify}from'node:util';
import{preparePublication}from'../scripts/prepare-library-publication.mjs';
import{verifyPublicSnapshot,verifyPublishedEpisodes}from'../scripts/verify-library-publication.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),v3=process.env.LIBRARY_V3_ROOT;
test('existing V3 RSS → stable ID → ledger readback → clean export → public proof → replay', {skip:!v3?'Set LIBRARY_V3_ROOT to pinned PR243 checkout':false},async()=>{
 const {harness,item,guid,headers}=await import(pathToFileURL(join(v3,'tests/library-v3-harness.mjs')));const cwd=process.cwd();let h;
 try{process.chdir(v3);h=harness(1);}finally{process.chdir(cwd);}
 h.setup();h.enable({allowNew:true});h.ctx.registerLibraryV3BaselineAfterApproval();
 const fresh=item(1);fresh.description='<p>新着の本編説明です。</p>\n【関連記事】\n記事の見出し\nhttps://www.asahi.com/articles/test.html\n【出演・スタッフ】\n実出演者';h.items=[fresh];
 assert.equal(h.run(true).status,'SNAPSHOT_READY');const registered=h.run(true);assert.deepEqual(Array.from(registered.newIds),['EP-00002']);assert.equal(h.data.length,3);
 const row=h.data[2],beforeId=row[0];assert.equal(row[6],fresh.guid);assert.equal(row[14],fresh.audio);assert.equal(row[21],fresh.description);
 const identity=JSON.parse(h.table['図書館V3・項目状態'].find(r=>r[0]===beforeId)[1]).identity;assert.equal(identity[0],'VERIFIED');assert.equal(identity[5],'RSS_registered');
 h.run(true);assert.equal(h.data.length,3);assert.equal(h.data[2][0],beforeId);
 const rows=JSON.parse(JSON.stringify(h.data.slice(1)));const previousIds=new Set(['EP-00001']);
 for(let n=3;n<=6001;n++){const r=Array(55).fill('');Object.assign(r,{0:'EP-'+String(n).padStart(5,'0'),1:'Show',2:'Fixture '+n,3:'2026-10-01 06:00',6:guid(n+100000),21:'内容',22:'内容'});rows.push(r);previousIds.add(r[0]);}
 const source={headers,rows,exclusions:h.ex,v3FieldStates:JSON.parse(JSON.stringify(h.table['図書館V3・項目状態'].slice(1)))},plans={archivePlan:{records:[],archivePending:{},invalidUrls:[]},descriptionPlan:{records:[]},previousIds};
 const a=preparePublication(source,{...plans,checkedAt:'2026-10-22T00:00:00Z'});assert.deepEqual(a.report.newIds,['EP-00002']);assert.equal(a.source.descriptionEdits[beforeId].description,'新着の本編説明です。');assert.equal(a.source.descriptionEdits[beforeId].relatedArticles[0].title,'記事の見出し');
 const dir=await mkdtemp(join(tmpdir(),'v3-public-e2e-'));
 try{
  const exportTo=async(prepared,name)=>{await writeFile(join(dir,name+'.json'),JSON.stringify(prepared.source));await promisify(execFile)(process.execPath,[join(root,'scripts/export-library-public.mjs'),join(dir,name+'.json'),join(dir,name)]);return JSON.parse(await readFile(join(dir,name,'manifest.json'),'utf8'));};
  const manifest=await exportTo(a,'first'),episodes=JSON.parse(await readFile(join(dir,'first/details/0.json'),'utf8')),episode=episodes.find(e=>e.id===beforeId);
  assert.equal(verifyPublicSnapshot(manifest,manifest).status,'SUCCESS');
  const read=async p=>JSON.parse(await readFile(join(dir,'first',p),'utf8'));
  assert.equal((await verifyPublishedEpisodes(manifest,[episode],read)).episodesVerified,1);
  await assert.rejects(verifyPublishedEpisodes(manifest,[episode],async p=>{const r=await read(p);return p.startsWith('details/')?r.filter(e=>e.id!==beforeId):r;}),/DETAIL/);
  await assert.rejects(verifyPublishedEpisodes(manifest,[episode],async p=>{const r=await read(p);return p.startsWith('search/')?r.filter(e=>e.id!==beforeId):r;}),/SEARCH/);
  const b=preparePublication(source,{...plans,previousIds:new Set([...previousIds,beforeId]),checkedAt:'2026-10-23T00:00:00Z'});assert.equal(b.report.newLedgerRowsObserved,0);assert.deepEqual(b.source.descriptionEdits[beforeId],a.source.descriptionEdits[beforeId]);const replay=await exportTo(b,'replay');assert.equal(replay.version,manifest.version);
  const changed=structuredClone(source);changed.rows[1][21]+='他の編集';assert.throws(()=>preparePublication(changed,{...plans,previousIds:new Set([...previousIds,beforeId])}),/readback/);
  console.log(JSON.stringify({mode:'LOCAL_EXISTING_V3_IN_MEMORY_ONLY',stages:['RSS_FETCH','NEW_DETECTION','GUID_CHECK','ID_ALLOCATE','LEDGER_APPEND','READBACK','CLEAN','JSON_EXPORT','PUBLIC_DATA_PROOF','IDEMPOTENT_REPLAY'],newIds:Array.from(registered.newIds),at:new Date().toISOString(),publicVersion:manifest.version,productionWrites:0,realPagesDeployment:false}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
