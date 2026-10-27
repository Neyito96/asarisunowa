'use strict';
const assert=require('node:assert/strict'),{LabIngest}=require('./engine');
const opt={authority:true,writerExcluded:true,now:()=>0};
const item=i=>({guid:'g'+i,url:'https://official/'+i,audio:'https://audio/'+i});
const h=(i,state='COMPLETED')=>({id:'EP-06633',guid:'g'+i,url:'https://official/'+i,state});
const l=i=>({id:'EP-06633',guid:'g'+i,url:'https://official/'+i,audio:'https://audio/'+i});
const v=i=>({id:'EP-06633',proof:'synthetic:g'+i+':EP-06633'});
const run=(s,feeds=[{name:'A',items:[item(1)]}])=>new LabIngest(s,opt).run(feeds);
const cases=[
 ['ledger exists but V3 missing must STOP',()=>assert.throws(()=>run({ledger:[l(1)]}),/STOP_/)],
 ['COMPLETED history missing ledger must STOP',()=>assert.throws(()=>run({history:[h(1)]}),/STOP_/)],
 ['COMPLETED history missing V3 must STOP',()=>assert.throws(()=>run({ledger:[l(1)],history:[h(1)]}),/STOP_/)],
 ['reordered RSS must include new item',()=>{let e=new LabIngest({},opt);e.run([{name:'A',items:[item(1),item(2)]}]);e.run([{name:'A',items:[item(3),item(1),item(2)]}]);assert.equal(e.s.ledger.length,3)}],
 ['duplicate history ID must STOP',()=>assert.throws(()=>run({history:[h(1),{...h(2),id:'EP-06633'}]}),/STOP_/)],
 ['wrong V3 proof must STOP',()=>assert.throws(()=>run({ledger:[l(1)],history:[h(1)],v3:[{...v(1),proof:'wrong'}]}),/STOP_/)],
 ['changed history URL must STOP',()=>assert.throws(()=>run({history:[{...h(1),url:'https://wrong'}]}),/STOP_/)],
];
let failed=0;for(const [name,fn] of cases){try{fn();console.log('PASS',name)}catch(e){console.log('FAIL',name,e.message);failed++}}console.log(JSON.stringify({total:cases.length,failed}));if(failed)process.exitCode=1;
