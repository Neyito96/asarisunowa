import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
function context(){const c=vm.createContext({});vm.runInContext(fs.readFileSync('scripts/google-apps-script/P25CopyOwnership.js','utf8'),c);return c;}
test('COPY ownership self-test: daily/hourly/three standalone/theme/manual, paused, stale generation, lock scope',()=>{
  const result=context().P25_COPY_OWNERSHIP_SELF_TEST();
  assert.equal(result.mode,'MOCK_NO_EXTERNAL_IO');assert.equal(result.checks,30);assert.equal(result.writesSimulated,8);
});
test('unknown routes and non-COPY targets fail before acquiring lock or writing',()=>{
  const c=context();const io={environment:'COPY',allowed:()=>true,withLock:()=>assert.fail('must not acquire lock')};
  assert.throws(()=>c.p25CopyOwnershipDispatch_(io,'unknown','id',()=>{}),/UNKNOWN_COPY_ROUTE/);
  io.environment='PRODUCTION';assert.throws(()=>c.p25CopyOwnershipDispatch_(io,'P25_RUN_COPY','id',()=>{}),/COPY_TARGET_REQUIRED/);
  io.environment='COPY';io.allowed=()=>false;assert.throws(()=>c.p25CopyOwnershipDispatch_(io,'P25_RUN_COPY','id',()=>{}),/COPY_TARGET_REQUIRED/);
});
test('write errors release lock; retry must reconcile membership in caller, not blind replay here',()=>{
  const c=context();let locked=false,calls=0;
  const io={environment:'COPY',allowed:()=>true,readOwner:()=>({owner:'P25',generation:1}),
    withLock:fn=>{assert.equal(locked,false);locked=true;try{return fn();}finally{locked=false;}},
    write:()=>{calls++;throw new Error('POST_OUTCOME_UNKNOWN');}};
  assert.throws(()=>c.p25CopyOwnershipDispatch_(io,'P25_RUN_COPY','id',w=>w('one')),/POST_OUTCOME_UNKNOWN/);
  assert.equal(locked,false);assert.equal(calls,1);
});
