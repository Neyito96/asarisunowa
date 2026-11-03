// Run: node --test tests/p16-lite-daily.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../scripts/google-apps-script/P16LiteRecovery20261103.gs'),'utf8');
function setup({count=7,partial=false,gap=false,added=1,pending=false}={}){
  let intakeCalls=0,logs=[],vals={P15_INGEST_SINCE:'2026-10-01T00:00:00Z'};
  const properties={getProperty:k=>vals[k],setProperty:(k,v)=>{vals[k]=v;},deleteProperty:k=>{delete vals[k];}};
  const fakeSS={getSheetByName:name=>{
    if(name==='P15_RUNS')return {appendRow:r=>logs.push(r)};
    if(name==='P15I_AUDIT')return {getLastRow:()=>pending?2:1,getRange:()=>({getDisplayValues:()=>[['PENDING']]})};
    if(name==='P15_INTAKE')return {getLastRow:()=>1};
    return null;
  }};
  const lock={tryLock:()=>true,releaseLock:()=>{},waitLock:()=>true};
  const context={
    SpreadsheetApp:{openById:()=>fakeSS},
    PropertiesService:{getScriptProperties:()=>properties},
    LockService:{getScriptLock:()=>lock},
    Logger:{log:()=>{}},
    Date,Math,JSON,Number,Array,Object,String,Set,RegExp,Error,isFinite
  };
  vm.createContext(context);vm.runInContext(source,context);
  const time=Date.now(), prior=time-86400000;
  vals.P16_LAST_COMPLETE_SCAN_UTC=new Date(prior).toISOString();
  const feeds=Array.from({length:count},(_,i)=>({
    show:'show'+i,status:(partial&&i===0)?'ERROR':'OK',
    fetched:gap?50:5,inspected:gap?10:5
  }));
  const sourceObjects={byGuid:{},expected:count,log:feeds};
  for(let i=0;i<count;i++){
    sourceObjects.byGuid['guid'+i]={guid:'guid'+i,show:'show'+i,published:new Date(gap?time-1000:time-2*86400000).toISOString()};
  }
  context.P16_recoverySources_=()=>sourceObjects;
  context.P15_AUTO={
    assertOwner:()=>{},
    intake:()=>{intakeCalls++;return {added,held:0};},
    enrich:()=>({cells:0})
  };
  return {context,vals,logs,get intakeCalls(){return intakeCalls}};
}
test('daily path records OK and saves checkpoint after seven feeds',()=>{
  const s=setup(),result=s.context.P16_DAILY_TICK();
  assert.equal(result.status,'OK');assert.equal(result.rss,7);
  assert.equal(s.intakeCalls,1);assert.ok(s.vals.P16_LAST_COMPLETE_SCAN_UTC);
  assert.equal(s.logs[0][1],'OK');
});
test('partial feed fails closed, without intake or checkpoint advance',()=>{
  const s=setup({partial:true}),before=s.vals.P16_LAST_COMPLETE_SCAN_UTC;
  const result=s.context.P16_DAILY_TICK();
  assert.equal(result.status,'PARTIAL');assert.equal(s.intakeCalls,0);
  assert.equal(s.vals.P16_LAST_COMPLETE_SCAN_UTC,before);
});
test('history gap beyond scanned entries fails closed',()=>{
  const s=setup({gap:true}),before=s.vals.P16_LAST_COMPLETE_SCAN_UTC;
  const result=s.context.P16_DAILY_TICK();
  assert.equal(result.status,'PARTIAL');assert.equal(s.intakeCalls,0);
  assert.equal(s.vals.P16_LAST_COMPLETE_SCAN_UTC,before);
});
test('ten additions hold checkpoint for next run',()=>{
  const s=setup({added:10}),before=s.vals.P16_LAST_COMPLETE_SCAN_UTC;
  const result=s.context.P16_DAILY_TICK();
  assert.equal(result.status,'PARTIAL');assert.equal(s.intakeCalls,1);
  assert.equal(s.vals.P16_LAST_COMPLETE_SCAN_UTC,before);
});
test('pending write prevents new intake',()=>{
  const s=setup({pending:true}),result=s.context.P16_DAILY_TICK();
  assert.equal(result.status,'HALTED');assert.equal(s.intakeCalls,0);
});
test('RSS clipping retains exactly ten items and preserves closing XML',()=>{
  const s=setup();
  const xml='<?xml version="1.0"?><rss><channel>'+Array.from({length:12},(_,i)=>'<item><guid>'+i+'</guid></item>').join('')+'</channel></rss>';
  const r=s.context.P16_clipXml_(xml,10);
  assert.equal(r.total,12);
  assert.equal((r.xml.match(/<item>/g)||[]).length,10);
  assert.ok(r.xml.endsWith('</channel></rss>'));
});
