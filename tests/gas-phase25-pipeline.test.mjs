import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code=fs.readFileSync('scripts/google-apps-script/P25LibraryPipeline.js','utf8');
const ctx=vm.createContext({});vm.runInContext(code,ctx);
const clone=x=>JSON.parse(JSON.stringify(x));
const playlist='P'.repeat(22), episode='E'.repeat(22), second='F'.repeat(22);
const header=Array(39).fill('');Object.entries({0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',6:'外部ID',11:'Spotify個別URL',22:'概要清掃済み',23:'出演者・スタッフ',38:'人間除外'}).forEach(([i,v])=>header[i]=v);
function row(id='EP-00001',spotify=episode){const r=Array(39).fill('');Object.entries({0:id,1:'MEDIA TALK',2:'連載 #1',3:'2026/11/6 4:00',6:'guid-'+id,11:'https://open.spotify.com/episode/'+spotify,22:'キューバの話',23:'山田花子（出演）'}).forEach(([i,v])=>r[i]=v);return r;}
function fixture(type='series',keywords='連載'){
 const db={},f={rows:[[...header],row()],requests:[{url:'https://open.spotify.com/playlist/'+playlist,updateType:type,keywords}],members:[],posts:0,reads:0,scans:0,published:false,now:1000,exclusions:[['GUID','EP-ID']],db};
 f.io={now:()=>f.now,withLock:fn=>fn(),load:k=>db[k]?clone(db[k]):null,save:(k,v)=>{db[k]=clone(v);},readLedger:()=>{f.scans++;return f.rows;},readExclusions:()=>f.exclusions,readRequests:()=>f.requests,readSources:()=>({complete:true,items:[]}),readMembership:()=>{f.reads++;return [...f.members];},canWrite:()=>true,add:(_,ids)=>{f.posts++;f.members.push(...ids);},readPublished:()=>({visible:f.published,verified:f.published})};
 f.state=()=>db['playlist:'+playlist];f.run=(opts={})=>clone(ctx.p25Run_(f.io,opts));
 f.approve=()=>{f.run();const s=f.state();for(const c of s.plan.candidates)s.approvals[c.epId]={evidence:c.evidence,revision:s.rule.revision};};return f;
}
for(const [type,terms] of [['series','連載'],['speaker','山田花子'],['theme','キューバ']])test(type+' receipt -> review -> verified -> published -> rerun adds zero',()=>{
 const f=fixture(type,terms);f.run({write:true});assert.equal(f.posts,0);assert.equal(f.state().spotify,'HOLD');f.approve();f.run({write:true});assert.equal(f.posts,1);assert.equal(f.state().spotify,'VERIFIED');assert.equal(f.state().publication,'PENDING');f.published=true;f.run({write:true});assert.equal(f.state().publication,'PUBLISHED');assert.equal(f.posts,1);
});
test('one shared scan and membership per duplicate request',()=>{const f=fixture();f.requests.push({...f.requests[0]});f.run();assert.equal(f.scans,1);assert.equal(f.reads,1);});
test('conflicting rules for same playlist fail closed',()=>{const f=fixture();f.requests.push({...f.requests[0],keywords:'別'});f.run({write:true});assert.equal(f.reads,0);assert.equal(f.state().reason,'CONFLICTING_REQUESTS');});
test('duplicate identity quarantines ALL aliases, including first row',()=>{const f=fixture();f.rows.push(row('EP-00002'));f.run();assert.equal(f.state().plan.holds.length,2);assert.ok(f.state().plan.holds.every(x=>x.reason==='IDENTITY_CONFLICT'));});
test('missing URL becomes candidate after retrospective URL fill',()=>{const f=fixture();f.rows[1][11]='';f.run();assert.equal(f.state().plan.holds[0].reason,'SPOTIFY_URL_MISSING_OR_INVALID');f.rows[1][11]='https://open.spotify.com/episode/'+episode;f.approve();f.run({write:true});assert.equal(f.posts,1);});
test('approval invalidates on title or rule change',()=>{const f=fixture();f.approve();f.rows[1][2]+=' 訂正';f.run({write:true});assert.equal(f.posts,0);assert.equal(f.state().plan.holds[0].reason,'REVIEW_REQUIRED');});
test('manual removal creates durable tombstone',()=>{const f=fixture();f.approve();f.run({write:true});f.members=[];f.run({write:true});assert.equal(f.posts,1);assert.ok(f.state().excluded.includes(episode));});
test('timeout after successful POST recovers without duplicate',()=>{const f=fixture();f.approve();f.io.add=(_,ids)=>{f.posts++;f.members.push(...ids);throw Error('timeout SECRET');};f.run({write:true});assert.equal(f.state().pending.length,1);f.run({write:true});assert.equal(f.posts,1);assert.equal(f.state().spotify,'VERIFIED');assert.ok(!JSON.stringify(f.state()).includes('SECRET'));});
test('uncertain missing POST never retries automatically',()=>{const f=fixture();f.approve();f.io.add=()=>{f.posts++;throw Error('timeout');};f.run({write:true});f.run({write:true});assert.equal(f.posts,1);assert.equal(f.state().reason,'WRITE_OUTCOME_UNKNOWN');});
test('429 blocks entire next run until shared retry time',()=>{const f=fixture();f.io.readMembership=()=>{throw {status:429,retryAfterSeconds:120};};f.run();assert.equal(f.run().status,'WAIT');assert.equal(f.scans,1);f.now+=120001;assert.equal(f.run().status,'COMPLETE');});
for(const [status,reason] of [[404,'SPOTIFY_NOT_FOUND_OR_ACCESS'],[401,'SPOTIFY_AUTH_REQUIRED'],[403,'SPOTIFY_FORBIDDEN']])test('classifies HTTP '+status,()=>{const f=fixture();f.io.readMembership=()=>{throw {status};};f.run();assert.equal(f.state().reason,reason);assert.equal(f.posts,0);});
test('source gap and source unknown are separate from Spotify zero diff',()=>{const f=fixture();f.members=[episode];f.io.readSources=()=>({complete:true,items:[{guid:'late',show:'報談'}]});assert.equal(f.run().source.missing[0].reason,'SOURCE_MISSING');f.io.readSources=()=>({complete:false});assert.equal(f.run().source.status,'SOURCE_UNKNOWN');});
test('bounded batch resumes and late old-dated collection is found',()=>{const f=fixture();f.rows.push(row('EP-00002',second));f.rows[2][3]='2020/1/1 4:00';f.approve();f.run({write:true,maxAdditions:1});assert.equal(f.state().spotify,'READY');f.run({write:true,maxAdditions:1});assert.equal(f.state().spotify,'VERIFIED');assert.equal(f.posts,2);});
test('default dry-run and denied writer never POST',()=>{const f=fixture();f.approve();f.run();assert.equal(f.posts,0);f.io.canWrite=()=>false;f.run({write:true});assert.equal(f.posts,0);});
test('staff field is not treated as automatically approved speaker evidence',()=>{const f=fixture('speaker','山田花子');f.rows[1][23]='山田花子（編集のみ）';f.run({write:true});assert.equal(f.posts,0);assert.equal(f.state().plan.holds[0].reason,'REVIEW_REQUIRED');});
test('COPY adapter rejects production project and production destination',()=>{const c=vm.createContext({ScriptApp:{getScriptId:()=> 'copy'}});vm.runInContext(fs.readFileSync('scripts/google-apps-script/P25CopyAdapter.js','utf8'),c);assert.throws(()=>c.p25CopyIo_({environment:'COPY',copyScriptId:'copy',stateSheetId:'1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ',requestSheetId:'copy'}),/COPY_ISOLATION/);});
test('deployment readback requires rendered link, not JSON or successful build',()=>{const url='https://open.spotify.com/playlist/'+playlist;assert.equal(ctx.p25VerifyPublishedHtml_(200,JSON.stringify({url}),playlist,'preview',100).verified,false);assert.equal(ctx.p25VerifyPublishedHtml_(200,`<a href="${url}">Listen</a>`,playlist,'preview',100).verified,true);assert.equal(ctx.p25VerifyPublishedHtml_(503,`<a href="${url}">Listen</a>`,playlist,'preview',100).verified,false);});

test('saved state from an older version (no skipped / non-array skipped) does not throw',()=>{
 for(const bad of [undefined,null,'x',{}]){
  const f=fixture();f.run();const key='playlist:'+playlist;
  f.db[key].plan.skipped=bad;
  f.io.readMembership=()=>{throw {status:404};};
  const r=f.run();
  assert.equal(r.status,'COMPLETE');
  assert.equal(r.results[0].skippedCount,0);
 }
 const g=fixture();g.run();g.db['playlist:'+playlist].plan.skipped=[{epId:'EP-1',reason:'NOT_NEW'}];g.io.readMembership=()=>{throw {status:404};};
 assert.equal(g.run().results[0].skippedCount,1);
});
test('run stops (no POST, no membership read) when human exclusion data is missing',()=>{
 const stop=(mutate,reason)=>{const f=fixture();f.approve();f.reads=0;mutate(f);assert.throws(()=>f.run({write:true}),reason);assert.equal(f.posts,0);assert.equal(f.reads,0);};
 stop(f=>{delete f.io.readExclusions;},/EXCLUSION_SOURCE_REQUIRED/);
 stop(f=>{f.io.readExclusions=()=>{throw new Error('EXCLUSION_SHEET_MISSING');};},/EXCLUSION_SHEET_MISSING/);
 stop(f=>{f.rows=f.rows.map(r=>r.slice(0,24));},/LEDGER_SCHEMA_MISMATCH/);
 stop(f=>{f.rows[0][38]='メモ';},/LEDGER_SCHEMA_MISMATCH/);
});
test('human exclusion in AM or 削除・除外履歴 still wins when the data is present',()=>{
 const f=fixture();f.rows[1][38]='除外';f.approve();f.run({write:true});assert.equal(f.posts,0);
 const g=fixture();g.exclusions=[['GUID','EP-ID'],['','EP-00001']];g.approve();g.run({write:true});assert.equal(g.posts,0);
});
