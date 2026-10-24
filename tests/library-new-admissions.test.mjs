import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {admitNewEpisodes,decisionVersion,v3RegisteredRowHash} from '../scripts/library-new-admissions.mjs';
import {preparePublication} from '../scripts/prepare-library-publication.mjs';
import {buildPublicationScope} from '../public/library/publication-scope.mjs';
const base=JSON.parse(gunzipSync(readFileSync(new URL('../docs/audits/2026-10-22-publication-scope/decisions.json.gz',import.meta.url))));
function fixture(){
 const row=Array(55).fill('');Object.assign(row,{0:'EP-06592',1:'ニュースの学校',2:'合成試験用',3:'2026-10-23 06:35:00',6:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',21:'合成試験用の概要です。',22:'合成試験用の概要です。'});
 const at='2026-10-23T00:00:00.000Z',hash=v3RegisteredRowHash(row);
 const source={rows:[row],v3FieldStates:[[row[0],JSON.stringify({identity:['VERIFIED',row[6],hash,'','','RSS_registered',at]})]],exclusions:[]};
 const admissions={schema:1,baseDecisionVersion:decisionVersion(base.decisions),newAfter:'2026-10-23T00:00:00+09:00',entries:[{id:row[0],show:row[1],guid:row[6],rowHash:hash,registeredAt:at,review:'確認済み',publication:'対象',decidedAt:'2026-10-23T01:00:00Z'}]};
 return {source,admissions};
}
test('baseline 5848/377/366 is immutable; unpublished baseline rows are never new',()=>{
 const source={rows:base.decisions.map(d=>[d.id,d.show]),v3FieldStates:[]};
 const got=admitNewEpisodes(source,base);assert.deepEqual(got.snapshot.decisions,base.decisions);assert.equal(got.candidateIds.length,0);
 const scope=buildPublicationScope(got.snapshot);assert.deepEqual([scope.adopted,scope.excluded,scope.held],[5848,377,366]);
});
test('registration alone never grants publication',()=>{const {source}=fixture();const got=admitNewEpisodes(source,base);assert.deepEqual(got.candidateIds,['EP-06592']);assert.equal(buildPublicationScope(got.snapshot).adopted,5848);assert.deepEqual(got.unreviewedIds,['EP-06592']);});
test('one reviewed registration adds one, replay adds zero and preserves all old decisions',()=>{
 const {source,admissions}=fixture(),before=structuredClone(source);
 const first=admitNewEpisodes(source,base,admissions),second=admitNewEpisodes(source,base,admissions);
 assert.deepEqual(first.snapshot.decisions.slice(0,6591),base.decisions);assert.equal(buildPublicationScope(first.snapshot).adopted,5849);
 assert.equal(decisionVersion(first.snapshot.decisions),decisionVersion(second.snapshot.decisions));assert.deepEqual(source,before);
});
for(const [label,mutate] of [
 ['stale row hash',f=>f.source.rows[0][2]='changed'],
 ['missing registration',f=>f.source.v3FieldStates=[]],
 ['unreviewed',f=>f.admissions.entries[0].review='未確認'],
 ['wrong baseline',f=>f.admissions.baseDecisionVersion='0'.repeat(64)],
 ['old episode',f=>f.admissions.newAfter='2026-10-24T00:00:00Z'],
 ['duplicate admission',f=>f.admissions.entries.push(f.admissions.entries[0])],
 ['baseline held override',f=>f.admissions.entries[0].id=base.decisions.find(d=>d.publication==='保留').id],
 ['baseline excluded override',f=>f.admissions.entries[0].id=base.decisions.find(d=>d.publication==='対象外').id],
 ['tombstoned GUID',f=>f.source.exclusions=[['guid','id'],[f.source.rows[0][6],'']]],
 ['case insensitive GUID collision',f=>{const row=[...f.source.rows[0]];row[0]='EP-06593';row[6]=row[6].toUpperCase();f.source.rows.push(row);}],
 ['official clip UUID collision',f=>{const row=[...f.source.rows[0]];row[0]='EP-06593';row[6]='other-guid';row[51]=f.source.rows[0][6];f.source.rows.push(row);}]
])test('reject '+label,()=>{const f=fixture();mutate(f);assert.throws(()=>admitNewEpisodes(f.source,base,f.admissions));});
test('bridge ignores historical unpublished rows without V3 registration',()=>{
 const source={rows:base.decisions.map(d=>[d.id,d.show]),v3FieldStates:[]};
 const got=preparePublication(source,{baseDecisions:base,archivePlan:{records:[]},descriptionPlan:{records:[]}});
 assert.equal(got.report.managedRendered,0);assert.equal(got.report.registeredCandidates,0);assert.equal(buildPublicationScope(got.source.publicationDecisions).adopted,5848);
});
test('shared organisation and programme UUIDs are not duplicate episodes',()=>{
 const f=fixture(),row=[...f.source.rows[0]];row[0]='EP-06593';row[6]='ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee';
 const prefix='https://traffic.omny.fm/clips/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/';
 // URL is outside the V3 hash's first 51 columns here; identity hash remains valid.
 f.source.rows[0][54]=prefix+f.source.rows[0][6]+'/audio.mp3';row[54]=prefix+row[6]+'/audio.mp3';f.source.rows.push(row);
 assert.equal(admitNewEpisodes(f.source,base,f.admissions).admittedIds.length,1);
});
test('exporter integration: one addition, replay zero, exact scope/search/pages/details membership',async()=>{
 const {mkdtemp,readFile,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'phase13-'));
 try{
  const f=fixture();
  const baselineRows=base.decisions.map(d=>{const r=Array(55).fill('');Object.assign(r,{0:d.id,1:d.show,2:'synthetic baseline',3:'2026-10-01 06:35:00',6:'synthetic-'+d.id,21:'概要です。',22:'概要です。'});return r;});
  f.source.rows.unshift(...baselineRows);
  f.source.headers=Array(55).fill('');Object.assign(f.source.headers,{0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',14:'音声URL',21:'概要原文',22:'概要清掃済み',38:'人間除外'});
  const options={baseDecisions:base,admissions:f.admissions,archivePlan:{records:[]},descriptionPlan:{records:[]}};
  const run=async()=>{
   await writeFile(join(dir,'source.json'),JSON.stringify(preparePublication(f.source,options).source));
   execFileSync(process.execPath,['scripts/export-library-public.mjs',join(dir,'source.json'),join(dir,'out')]);
   const manifest=JSON.parse(await readFile(join(dir,'out/manifest.json'))),scope=JSON.parse(await readFile(join(dir,'out/scope.json')));
   const items=(await Promise.all(manifest.pages.map(async p=>JSON.parse(await readFile(join(dir,'out',p)))))).flat();
   assert.deepEqual(items.map(e=>e.id).sort(),scope.publishedIds);assert.equal(items.length,5849);
   const search=(await Promise.all(manifest.shows.flatMap(s=>s.search).map(async p=>JSON.parse(await readFile(join(dir,'out',p)))))).flat();
   const buckets=[...new Set(items.map(e=>Math.floor(Number(e.id.slice(3))/50)))];
   const details=(await Promise.all(buckets.map(async b=>JSON.parse(await readFile(join(dir,'out/details',b+'.json')))))).flat();
   assert.deepEqual(search.map(e=>e.id).sort(),scope.publishedIds);assert.deepEqual(details.map(e=>e.id).sort(),scope.publishedIds);
   const unadopted=new Set(base.decisions.filter(d=>d.publication!=='対象').map(d=>d.id));assert.equal(items.filter(e=>unadopted.has(e.id)).length,0);
   return {manifest,ids:items.map(e=>e.id)};
  };
  const first=await run(),second=await run();assert.equal(first.manifest.version,second.manifest.version);assert.equal(second.ids.filter(id=>!first.ids.includes(id)).length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
