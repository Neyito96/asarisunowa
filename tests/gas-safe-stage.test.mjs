import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/gas-safe-stage.mjs',import.meta.url).pathname;
const scriptId='1eLqB-k1XIQz5qqOxamvUlinqld7jwSDO6AkWLx9Zg0ePGsuU7pE4rec-';
async function fixture({badScriptId=false,duplicate=false}={}){
 const dir=await mkdtemp(join(tmpdir(),'phase6-stage-')),online=join(dir,'online'),out=join(dir,'staged'),candidate=join(dir,'candidate.js');
 await mkdir(online);
 await writeFile(join(online,'.clasp.json'),JSON.stringify({scriptId:badScriptId?'WRONG':scriptId,rootDir:'.'}));
 await writeFile(join(online,'appsscript.json'),JSON.stringify({timeZone:'Asia/Tokyo'}));
 await writeFile(join(online,'LibraryV3.gs'),'function existingLibraryV3(){}');
 await writeFile(join(online,'KeepExisting.gs'),'function existingOther(){}');
 await writeFile(candidate,"function previewLibraryV3MacHandoff(){}\nfunction libV3RelatedArticleCandidates_(){}\n"+(duplicate?'function previewLibraryV3MacHandoff(){}':''));
 return {dir,online,out,candidate};
}
function run(f){return spawnSync(process.execPath,[script,'--online-dir',f.online,'--candidate',f.candidate,'--out-dir',f.out,'--script-id',scriptId],{encoding:'utf8'});}
test('stage only one file without altering the pulled original',async()=>{
 const f=await fixture(),p=run(f);
 assert.equal(p.status,0,p.stderr);
 const result=JSON.parse(p.stdout);
 assert.equal(result.status,'STAGED_NOT_DEPLOYED');
 assert.deepEqual(result.changed,['LibraryV3.gs']);
 assert.equal(result.manifestUnchanged,true);
 assert.equal(await readFile(join(f.online,'LibraryV3.gs'),'utf8'),'function existingLibraryV3(){}');
 assert.equal(await readFile(join(f.out,'KeepExisting.gs'),'utf8'),'function existingOther(){}');
});
test('refuses wrong script ID',async()=>{const f=await fixture({badScriptId:true});assert.notEqual(run(f).status,0);});
test('refuses duplicate declarations',async()=>{const f=await fixture({duplicate:true});assert.notEqual(run(f).status,0);});
test('refuses pre-existing stage output and never overwrites',async()=>{
 const f=await fixture();await mkdir(f.out);await writeFile(join(f.out,'preserve'),'KEEP');
 assert.notEqual(run(f).status,0);assert.equal(await readFile(join(f.out,'preserve'),'utf8'),'KEEP');
});
