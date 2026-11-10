import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryV3.js',import.meta.url),'utf8');
const sandbox={libV2CpHash_:s=>'test-'+String(s).length};
vm.createContext(sandbox);
vm.runInContext(code,sandbox);
function ep({existingV='',existingW='',id='EP-00083',confidence='EXACT_IDENTITY_METADATA_VALIDATED'}={}){
 return {id,guid:'guid83',show:'ニュースの学校',feed:'https://feeds.example/rss',sourceHash:'hash83',descriptionRaw:'関連記事：https://example.org/story',content:{ruleVersion:'V3-rss-content-1',text:'関連記事：https://example.org/story'},people:[],match:{confidence},fields:[{field:'description',category:existingV?'CONFLICT':'CANDIDATE',existing:existingV},{field:'clean',existing:existingW}]};
}
test('blank V/W suggests one review-only candidate and never writes',()=>{
 const p=sandbox.libV3MacHandoffPlan_({status:'READ_ONLY',inspected:50,episodes:[ep()]});
 assert.equal(p.selected.originalRelation,'BLANK');
 assert.equal(p.selected.cleanCandidateSafe,true);
 assert.equal(p.writes,0);assert.equal(p.propertyWrites,0);
});
test('changed V cannot be paired with W candidate',()=>{
 const p=sandbox.libV3MacHandoffPlan_({status:'READ_ONLY',episodes:[ep({existingV:'Human original'})]});
 assert.equal(p.selected.originalRelation,'ALTERNATE_VERSION_REVIEW');
 assert.equal(p.selected.cleanCandidateSafe,false);
});
test('existing W and unsafe identity are protected',()=>{
 assert.equal(sandbox.libV3MacHandoffPlan_({status:'READ_ONLY',episodes:[ep({existingW:'Human edit'})]}).selected.cleanCandidateSafe,false);
 assert.equal(sandbox.libV3MacHandoffPlan_({status:'READ_ONLY',episodes:[ep({id:'',confidence:'HELD'})]}).selected,null);
});
test('failed preview yields no pilot candidate',()=>{
 const p=sandbox.libV3MacHandoffPlan_({status:'FAILED',episodes:[ep()]});
 assert.equal(p.selected,null);
});
