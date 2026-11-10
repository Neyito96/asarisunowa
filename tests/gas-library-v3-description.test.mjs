import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harness,item,guid} from './library-v3-harness.mjs';
const compare=(a,b)=>harness(0).ctx.libV3DescriptionCompare_(a,b);
for(const [name,a,b] of [
 ['newlines','a\\n\\nb','a\n b'],['space',' a　 b ','a b'],
 ['HTML','<p>本文</p><p>続き</p>','本文 続き'],['entities','A &amp; B&nbsp; C','A & B C'],
 ['anchor','<a href="https://a.test/x">資料</a>','資料 https://a.test/x']
])test(name+' is comparison-only format equivalent',()=>{const r=compare(a,b);assert.equal(r.kind,'FORMAT_EQUIVALENT');assert.equal(r.overwriteAllowed,false);});
for(const [name,a,b] of [
 ['URL removed','本文 https://a.test','本文'],['URL changed','本文 https://a.test','本文 https://b.test'],
 ['sentence omitted','成立した。条件がある。','成立した。'],['meaning changed','成立した','成立しなかった'],
 ['notice added','本文','本文 ご意見はこちら https://a.test']
])test(name+' must stay content difference',()=>assert.equal(compare(a,b).kind,'CONTENT_DIFFERENCE'));
test('unsupported HTML attributes, hidden content and images are never discarded as formatting',()=>{for(const a of ['<img alt="証拠">本文','<span hidden>秘密</span>本文','<script>secret</script>本文'])assert.equal(compare(a,'本文').kind,'UNSUPPORTED_FORMAT_REVIEW');});
test('47 live logged pairs classify 28 format and 19 content differences; no original mutation',()=>{const fixture=JSON.parse(fs.readFileSync('tests/fixtures/school-description-pairs-20261018.json'));const before=JSON.stringify(fixture);const h=harness(0),counts={};for(const p of fixture.pairs){const r=h.ctx.libV3DescriptionCompare_(p.existing,p.rss);counts[r.kind]=(counts[r.kind]||0)+1;}assert.deepEqual(counts,{FORMAT_EQUIVALENT:28,CONTENT_DIFFERENCE:19});assert.equal(JSON.stringify(fixture),before);});
function fixture(){const h=harness(1);h.sources[1][0]='ニュースの学校';h.rows[0][1]='ニュースの学校';h.rows[0][21]='本文\\n続き';h.rows[0][22]='人間が清掃した概要';h.items=[{...item(0),description:'本文\n続き'}];h.ctx.PropertiesService={getScriptProperties:()=>{throw Error('Properties forbidden');}};return h;}
test('preview reclassifies only description comparison, preserves original/clean/sheets/history',()=>{const h=fixture(),before=JSON.stringify(h.table);const r=h.ctx.previewLibraryV3SchoolCandidates(),f=r.episodes[0].fields.find(f=>f.field==='description');assert.equal(f.category,'FORMAT_EQUIVALENT');assert.equal(f.existing,'本文\\n続き');assert.equal(f.value,'本文\n続き');assert.ok(!r.candidates.flatMap(x=>x.fields).some(f=>['description','clean'].includes(f.field)));assert.equal(JSON.stringify(h.table),before);assert.equal(h.writes,0);assert.equal(h.cache.size,0);});
test('formula and human-changed state override format equivalence',()=>{for(const mode of ['formula','human']){const h=fixture();if(mode==='formula')h.formulas.set('エピソード台帳:2:22','=x');else {const base=h.ctx.libV3Context_;h.ctx.libV3Context_=(...args)=>{const c=base(...args);c.index.states.set('EP-00001|description',['EP-00001','description','RECHECK_REQUIRED','','','','changed','human_or_other_writer_changed_cell']);return c;};}const f=h.ctx.previewLibraryV3SchoolCandidates().episodes[0].fields.find(f=>f.field==='description');assert.equal(f.category,'PROTECTED');}});
test('exclusion, unmatched and duplicate identity cannot be released by equivalent description',()=>{for(const mode of ['excluded','unmatched','duplicate']){const h=fixture();if(mode==='excluded')h.ex.push([guid(0),'']);if(mode==='unmatched')h.rows[0][9]='';if(mode==='duplicate')h.items=[{...item(0),description:'本文\n続き'},{...item(0),description:'本文\n続き'}];const r=h.ctx.previewLibraryV3SchoolCandidates();assert.equal(r.candidates.length,0);assert.ok(r.holds.length);}});
