import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryV3Morning.js',import.meta.url),'utf8');
const cut=src.slice(src.indexOf('function previewLibraryV3CopyPilotCandidates('));
function run({items=[],copyRows=['A','B'],sourceRows=['A','B'],baseline={complete:true,offset:2},feedError=null,previews={}}={}){
 const feed={url:'https://example.org/official.rss',show:'ニュースの現場から'};
 const context={
  Logger:{log(){}},Date,Map,JSON,
  libV3CopyPilotId_:o=>{if(o.copySheetId!=='COPY_TEST_12345678901234567890')throw Error('bad copy');return o.copySheetId;},
  libV3Context_:(isCopy)=>({rows:isCopy?copyRows:sourceRows,feeds:[feed],index:{guid:new Map(),anchor:new Map()}}),
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(baseline)})},
  libV3Hash_:v=>JSON.stringify(v),
  libV2CpSnapshot_:()=>feedError?{status:feedError}:{items},
  libV2CpParse_:()=>{},libV3AutoCleanEvidence_:()=>({hold:false}),
  libV3NewDecision_:()=>({reasons:[]}),
  libV2CpMatches_:()=>[],
  previewLibraryV3CopyPilot:({guid})=>({status:'READY_FOR_COPY_APPROVAL',planHash:'hash-'+guid,sourceRows:2,copyRows:2}),
 };
 vm.createContext(context);vm.runInContext(cut,context);
 return context;
}
const opt={copySheetId:'COPY_TEST_12345678901234567890',feedUrl:'https://example.org/official.rss'};
const item=(guid)=>({guid,title:'new',published:'2026-10-17T10:00:00Z',description:'test',date:'2026-10-17'});
test('selects one eligible RSS GUID without writes',()=>{
 const c=run({items:[item('guid-1')]});const r=c.previewLibraryV3CopyPilotCandidates(opt);
 assert.equal(r.status,'CANDIDATES_FOUND');assert.equal(r.candidates[0].guid,'guid-1');assert.equal(r.writes,0);
});
test('duplicate GUID held and not offered',()=>{
 const c=run({items:[item('same'),item('same')]});const r=c.previewLibraryV3CopyPilotCandidates(opt);
 assert.equal(r.status,'NO_ELIGIBLE_CANDIDATES');assert.equal(r.holds.rss_guid_blank_or_duplicate,2);
});
test('source-copy divergence prevents candidate selection',()=>{
 const c=run({items:[item('guid-1')],copyRows:['A','DIFFERENT']});
 assert.throws(()=>c.previewLibraryV3CopyPilotCandidates(opt),/diverged/);
});
test('incomplete baseline prevents candidate selection',()=>{
 const c=run({items:[item('guid-1')],baseline:{complete:false,offset:1}});
 assert.throws(()=>c.previewLibraryV3CopyPilotCandidates(opt),/baseline/);
});
test('single-command preview returns plan hash but never writes',()=>{
 const c=run({items:[item('guid-1')]});const r=c.previewLibraryV3Phase6IsolatedCopy();
 assert.equal(r.status,'READY_FOR_COPY_APPROVAL');assert.equal(r.planHash,'hash-guid-1');assert.equal(r.writes,0);
});
test('RSS failure yields no approvable candidate',()=>{
 const c=run({feedError:'HTTP_503'});const r=c.previewLibraryV3Phase6IsolatedCopy();
 assert.equal(r.status,'NO_APPROVABLE_CANDIDATE');assert.equal(r.writes,0);
});
