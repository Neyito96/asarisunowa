#!/usr/bin/env node
/** PREPARE ONLY. Never calls clasp push or GAS API.
 * Usage: node scripts/gas-safe-stage.mjs --online-dir DIR --candidate FILE --out-dir DIR --script-id ID
 * INPUT: a complete isolated GAS 'clasp pull' directory, and the reviewed LibraryV3.js.
 * OUTPUT: a staged complete tree, immutable manifest and diff report.
 * Refuses unidentified projects, manifests mismatch, existing output, unexpected file sets.
 * The subsequent clasp push, if authorized, is a separate manually gated operation.
 */
import {readdir,readFile,mkdir,copyFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt={};
for(let i=0;i<args.length;i+=2){if(!/^--[\w-]+$/.test(args[i])||!args[i+1])throw Error('Invalid arguments');opt[args[i].slice(2)]=args[i+1];}
const required=['online-dir','candidate','out-dir','script-id'];
for(const k of required)if(!opt[k])throw Error('Missing --'+k);
const src=resolve(opt['online-dir']),dest=resolve(opt['out-dir']),candidate=resolve(opt.candidate),id=opt['script-id'];
if(!/^[A-Za-z0-9_-]{25,}$/.test(id))throw Error('Script ID format invalid');
if(candidate===dest||candidate===src||candidate.startsWith(dest+sep))throw Error('Candidate overlaps staging destination');
if(src===dest||dest.startsWith(src+sep)||src.startsWith(dest+sep))throw Error('Refuse overlapping directories');
const fileInfo=await stat(src);if(!fileInfo.isDirectory())throw Error('online-dir must exist');
try{await stat(dest);throw Error('Output directory already exists: refusing overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
async function files(dir,base=''){let list=[];for(const d of await readdir(join(dir,base),{withFileTypes:true})){
 const sub=join(base,d.name);if(d.isSymbolicLink())throw Error('Symlink forbidden: '+sub);
 if(d.isDirectory())list.push(...await files(dir,sub));
 else if(d.isFile())list.push(sub);
 else throw Error('Unsupported file: '+sub);
}return list.sort();}
const originalFiles=await files(src);
if(!originalFiles.includes('.clasp.json')||!originalFiles.includes('appsscript.json'))throw Error('Missing clasp metadata/manifest');
const cfg=JSON.parse(await readFile(join(src,'.clasp.json'),'utf8'));
if(cfg.scriptId!==id)throw Error('STOP: requested scriptId differs from pulled project');
const gasTargets=originalFiles.filter(f=>/^LibraryV3\.(gs|js)$/.test(f));
if(gasTargets.length!==1)throw Error('Expected exactly one LibraryV3 target, got '+gasTargets.length);
const candidateCode=await readFile(candidate,'utf8');
if(!candidateCode.includes('function previewLibraryV3MacHandoff()')||!candidateCode.includes('function libV3RelatedArticleCandidates_'))throw Error('Candidate lacks expected Phase6 READ_ONLY functions');
if(/^\s*(?:import|export)\s/m.test(candidateCode))throw Error('GAS candidate contains unsupported module syntax');
const target=gasTargets[0],oldCode=await readFile(join(src,target),'utf8');
const declared=(code)=>[...code.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m=>m[1]);
for(const [kind,code] of [['candidate',candidateCode],['online',oldCode]]){
 const all=declared(code),dupes=all.filter((n,i)=>all.indexOf(n)!==i);
 if(dupes.length)throw Error(kind+' duplicate function declarations: '+[...new Set(dupes)].join(','));
}
const sha=s=>createHash('sha256').update(s).digest('hex');
const originals={};for(const f of originalFiles)originals[f]=sha(await readFile(join(src,f)));
await mkdir(dest,{recursive:false});
for(const f of originalFiles){const targetPath=join(dest,f);await mkdir(dirname(targetPath),{recursive:true});await copyFile(join(src,f),targetPath);}
await writeFile(join(dest,target),candidateCode);
const staged=await files(dest);
if(JSON.stringify(staged)!==JSON.stringify(originalFiles))throw Error('Staged file set changed');
const after={};for(const f of staged)after[f]=sha(await readFile(join(dest,f)));
const changed=originalFiles.filter(f=>originals[f]!==after[f]);
if(JSON.stringify(changed)!==JSON.stringify([target]))throw Error('STOP unexpected changes: '+changed.join(','));
const report={status:'STAGED_NOT_DEPLOYED',scriptId:id,target,files:originalFiles.length,changed,
 onlineSha256:originals[target],candidateSha256:after[target],manifestUnchanged:originals['appsscript.json']===after['appsscript.json'],
 nonTargetUnchanged:true,requiresSeparateApproval:true,
 warning:'Do NOT run clasp push before matching online hashes again and approving exact content.'};
await writeFile(dest+'.stage-report.json',JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report,null,2)+'\n');
