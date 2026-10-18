import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryV3OldNewsDiffAudit.js',import.meta.url),'utf8');
function run(rows){
 const logs=[];
 const ctx={
  libV3Context_:()=>({rows}),
  libV2CpDate_:v=>v,
  libV3Clean_:s=>String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),
  Logger:{log:s=>logs.push(JSON.parse(s))}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const result=ctx.previewLibraryV3OldNewsDiffAudit();
 return {result,logs};
}
const row=(id,raw,clean,date='2020-08-06',show='ニュースの現場から')=>{
 const r=Array(51).fill('');r[0]=id;r[1]=show;r[3]=date;r[21]=raw;r[22]=clean;return r;
};
test('classifies missing, matching, punctuation, links, summary and excludes other shows',()=>{
 const {result}=run([
  row('EP-1','','text'),row('EP-2','raw',''),row('EP-3','hello','hello'),
  row('EP-4','Hello, world!','Hello world'),
  row('EP-5','visit https://example.com','visit https://elsewhere.com'),
  row('EP-6','This is a rather long episode description with many words','Short'),
  row('EP-7','content','content', '2022-01-01'),
  row('EP-8','content','content','2020-01-01','MEDIA TALK')
 ]);
 console.log('COUNTS',JSON.stringify(result.counts));
 assert.equal(result.rows,6);assert.equal(result.writes,0);assert.equal(result.apiCalls,0);
 for(const reason of ['RAW_MISSING','CLEAN_MISSING','MECHANICAL_EQUAL','PUNCTUATION_OR_SPACING_ONLY','URL_DIFFERENCE_REVIEW','POSSIBLE_SUMMARY_OR_TRUNCATION_REVIEW'])assert.equal(result.counts[reason],1);
});
test('does not expose descriptions in logs or results',()=>{
 const secret='unpublished description secret';const {result,logs}=run([row('EP-X',secret,'short')]);
 assert.equal(JSON.stringify(result).includes(secret),false);
 assert.equal(JSON.stringify(logs).includes(secret),false);
});
