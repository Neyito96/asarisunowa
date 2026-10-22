// Reported live settings are fixtures, never a claim of remote execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=process.env.LIBRARY_V3_ROOT;
async function fixture(){
 const absolute=resolve(root),{harness,item}=await import(pathToFileURL(join(absolute,'tests/library-v3-harness.mjs')));
 const cwd=process.cwd();let h;try{process.chdir(absolute);h=harness(1);}finally{process.chdir(cwd);}
 vm.runInContext(await readFile(join(absolute,'scripts/google-apps-script/LibraryV3Morning.js'),'utf8'),h.ctx);
 h.props.set('LIB_V3_CONFIG',JSON.stringify({enabled:false,autonomous:true,allowEnrich:false,allowNew:false,spotifyApi:false}));
 h.props.set('LIB_V3_BASELINE',JSON.stringify({offset:6591}));
 return {h,item};
}
test('reported disabled settings stop the existing writer without sheet or property mutations',{skip:!root},async()=>{
 const {h}=await fixture(),before=JSON.stringify(h.table),props=JSON.stringify([...h.props]);
 const r=h.ctx.libV3Run_(true);assert.equal(r.status,'DISABLED');assert.equal(JSON.stringify(h.table),before);assert.equal(JSON.stringify([...h.props]),props);
});
test('offset alone and allowNew false independently hold a new candidate',{skip:!root},async()=>{
 const {h,item}=await fixture(),it=item(1),c=h.ctx.libV3Context_(false),config=h.ctx.libV3Config_();
 const d=h.ctx.libV3NewDecision_(it,{show:'Show'},c,config,{offset:6591});
 assert.ok(d.reasons.includes('baseline_not_registered'));assert.ok(d.reasons.includes('new_registration_not_enabled'));assert.ok(d.reasons.includes('historical_or_invalid_publication'));
});
test('future cutover deliberately excludes existing backlog even after new registration is allowed',{skip:!root},async()=>{
 const {h,item}=await fixture(),it={...item(1),published:'2026-10-21T00:00:00Z'},c=h.ctx.libV3Context_(false);
 const d=h.ctx.libV3NewDecision_(it,{show:'Show'},c,{allowNew:true,newAfter:'2026-10-22T00:00:00Z'},{complete:true,offset:6591});
 assert.ok(d.reasons.includes('historical_or_invalid_publication'));assert.equal(d.eligible,false);
});
