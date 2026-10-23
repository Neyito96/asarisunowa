// Local, compile-only audit. Never evaluates captured online code or calls GAS APIs.
// Usage: node scripts/audit-online-gas-compatibility.mjs /private/source-capture.json
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const capture=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const base='scripts/google-apps-script/';
const files=capture.files;
const installedV3=files.some(f=>f.name==='LibraryV3.gs');
assert.equal(files.length,installedV3?34:33);
assert.equal(new Set(files.map(f=>f.name)).size,files.length);
const code=files.filter(f=>f.name.endsWith('.gs'));
for(const f of code)new vm.Script(f.source,{filename:f.name});
new vm.Script(code.map(f=>f.source).join('\n;\n'),{filename:'online-combined.gs'});
const replacement=fs.readFileSync(base+'LibraryV2CheckpointEngine.js','utf8');
const v3=fs.readFileSync(base+'LibraryV3.js','utf8');
const autonomy=fs.readFileSync(base+'LibraryV3Autonomy.js','utf8');
const proposed=code.map(f=>f.name==='LibraryV2CheckpointEngine.gs'?replacement:f.name==='LibraryV3.gs'?v3:f.source).concat(installedV3?[]:[v3]).concat(autonomy);
new vm.Script(proposed.join('\n;\n'),{filename:'proposed-combined.gs'});
const declarations=t=>[...t.matchAll(/^function\s+(\w+)\s*\(/gm)].map(m=>m[1]);
const onlineNames=code.filter(f=>!['LibraryV2CheckpointEngine.gs','LibraryV3.gs'].includes(f.name)).flatMap(f=>declarations(f.source));
const v3Names=declarations(v3),extraNames=declarations(autonomy);
assert.equal(new Set([...v3Names,...extraNames]).size,v3Names.length+extraNames.length);
assert.deepEqual(extraNames.filter(n=>onlineNames.includes(n)),[]);
assert.equal(v3Names.length,30);
assert.equal(new Set(v3Names).size,v3Names.length);
assert.deepEqual(v3Names.filter(n=>onlineNames.includes(n)),[]);
assert.equal(code.filter(f=>/\b(?:const|let|var)\s+LIB_V2_SHEET_ID\s*=/.test(f.source)).length,1);
const baseline=installedV3?'b3f950f':'922f16e';
const old=execFileSync('git',['show',baseline+':scripts/google-apps-script/LibraryV2CheckpointEngine.js'],{encoding:'utf8'});
const canonical=t=>t.replace(/\r\n?/g,'\n').trim();
assert.equal(canonical(files.find(f=>f.name==='LibraryV2CheckpointEngine.gs').source),canonical(old));
assert.equal(canonical(files.find(f=>f.name==='runHoudanBackfillPreview.gs').source),canonical(files.find(f=>f.name==='OfficialRssLibraryPreview.gs').source));
assert.ok(!code.some(f=>declarations(f.source).some(n=>n==='doGet'||n==='doPost')));

console.log(JSON.stringify({onlineFiles:files.length,onlineGs:code.length,individualCompile:'PASS',combinedCompile:'PASS',proposedGs:proposed.length,proposedCompile:'PASS',newV3Functions:v3Names.length,newAutonomyFunctions:extraNames.length,v3NameCollisions:0,sheetIdDeclarations:1,onlineCheckpointEquals:baseline,codeExecuted:false,externalApiCalls:0,realSheetWrites:0},null,2));
