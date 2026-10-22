// Offline-only comparison: never evaluates captured GAS or calls Google APIs.
// node scripts/check-library-release.mjs PRIVATE_CLASP_DIR V3_REPO REPORT.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const required=['LibraryV2CheckpointEngine','LibraryV3','LibraryV3Autonomy','LibraryV3Morning','AutoUpdateNotification'];
const sha=s=>createHash('sha256').update(s.replace(/\r\n?/g,'\n').trim()).digest('hex');
const names=s=>[...s.matchAll(/^function\s+(\w+)\s*\(/gm)].map(m=>m[1]);
export function compareLibraryRelease(captured,expected){
 const rows=required.map(name=>{const before=captured[name],after=expected[name];if(after==null)throw Error('Expected source missing: '+name);return {file:name,liveSha256:before==null?null:sha(before),targetSha256:sha(after),status:before==null?'MISSING':sha(before)===sha(after)?'SAME':'DIFFERENT',liveFunctions:before==null?[]:names(before),targetFunctions:names(after)};});
 const declarations=Object.entries(captured).filter(([n])=>n!=='appsscript').flatMap(([file,s])=>names(s).map(name=>({file,name})));
 const duplicates=[...new Set(declarations.map(x=>x.name))].filter(n=>declarations.filter(x=>x.name===n).length>1);
 let syntax='PASS';try{new vm.Script(required.map(n=>expected[n]).join('\n;\n'));}catch{syntax='FAIL';}
 const unmappedLiveFiles=Object.keys(captured).filter(n=>!(n in expected));
 const manifest={liveSha256:captured.appsscript==null?null:sha(captured.appsscript),targetSha256:expected.appsscript==null?null:sha(expected.appsscript),status:captured.appsscript==null?'MISSING':sha(captured.appsscript)===sha(expected.appsscript)?'SAME':'DIFFERENT'};
 // A differing release is reviewable, never silently approved by this checker.
 return {mode:'OFFLINE_SOURCE_COMPARISON',status:syntax==='FAIL'?'FAIL':rows.every(r=>r.status==='SAME')&&manifest.status==='SAME'&&!duplicates.length&&!unmappedLiveFiles.length?'MATCH':'HOLD',rows,manifest,unmappedLiveFiles,duplicateLiveFunctions:duplicates,targetSyntax:syntax,codeExecuted:false,googleWrites:0,propertiesWrites:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [dir,repo,out]=process.argv.slice(2);if(!out)throw Error('PRIVATE_CLASP_DIR V3_REPO REPORT.json');
 const captured={};for(const entry of fs.readdirSync(dir)){if(!/\.(?:gs|js)$/.test(entry)&&entry!=='appsscript.json')continue;captured[entry.replace(/\.(?:gs|js|json)$/,'')]=fs.readFileSync(path.join(dir,entry),'utf8');}
 const expected=Object.fromEntries(required.map(n=>[n,fs.readFileSync(path.join(repo,'scripts/google-apps-script',n+'.js'),'utf8')]));expected.appsscript=fs.readFileSync(path.join(repo,'scripts/google-apps-script/appsscript.json'),'utf8');
 const result=compareLibraryRelease(captured,expected);fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,files:result.rows.length,codeExecuted:false}));
}
