import test from 'node:test';import assert from 'node:assert/strict';
import {acquire,commit,release,memoryStore,maxToken,lastVersion} from '../public/library/journal-lease.mjs';
const H=3600e3;
test('acquire: first writer wins; a second writer is blocked until expiry; BUSY when the script lock cannot be taken',()=>{
  const s=memoryStore();const a=acquire(s,'A',0,H);assert.equal(a.ok,true);assert.equal(a.token,1);
  assert.equal(acquire(s,'B',1000,H).reason,'HELD_BY_OTHER');
  s.lockHeld=true;assert.equal(acquire(s,'C',2000,H).reason,'BUSY');s.lockHeld=false;
  const b=acquire(s,'B',H+1,H);assert.equal(b.ok,true);assert.equal(b.token,2);assert.equal(b.incompletePreviousRun,true); // Aは未COMMITのまま失効=途中失敗の可能性を通知
});
test('fencing: after takeover the stale writer cannot commit even with a valid-looking run; expired lease cannot commit',()=>{
  const s=memoryStore();const a=acquire(s,'A',0,H);const b=acquire(s,'B',H+1,H);
  assert.equal(commit(s,{owner:'A',token:a.token,runId:'rA',baseVersion:0},H+2).reason,'FENCED_STALE_TOKEN');
  assert.equal(commit(s,{owner:'B',token:b.token,runId:'rB',baseVersion:0},2*H+5).reason,'LEASE_EXPIRED');
  assert.deepEqual(commit(s,{owner:'B',token:b.token,runId:'rB',baseVersion:0},H+10),{ok:true,version:1});
});
test('double COMMIT is blocked: same token, same runId (re-run after a crash), and stale base version',()=>{
  const s=memoryStore();const a=acquire(s,'A',0,H);
  assert.equal(commit(s,{owner:'A',token:a.token,runId:'r1',baseVersion:0},10).ok,true);
  assert.equal(commit(s,{owner:'A',token:a.token,runId:'r2',baseVersion:1},20).reason,'DOUBLE_COMMIT_SAME_TOKEN');
  const a2=acquire(s,'A',30,H); // 同一ownerの再取得でも新token
  assert.equal(a2.token,2);assert.equal(commit(s,{owner:'A',token:a2.token,runId:'r1',baseVersion:1},40).reason,'DUPLICATE_RUN_ID'); // 再実行は同runIdを再COMMITできない
  assert.equal(commit(s,{owner:'A',token:a2.token,runId:'r3',baseVersion:0},40).reason,'STALE_BASE_VERSION');
  assert.equal(commit(s,{owner:'A',token:a2.token,runId:'r3',baseVersion:1},40).version,2);
});
test('interleaving without relying on the lock: two writers both believe they hold the lease; only the newest token commits',()=>{
  const s=memoryStore();const a=acquire(s,'A',0,H);
  s.append({type:'LEASE',owner:'B',token:maxToken(s.rows())+1,expiresAt:5*H,at:1}); // ロックが破れてBも書込んだ最悪ケース
  assert.equal(commit(s,{owner:'A',token:a.token,runId:'rA',baseVersion:0},2).reason,'FENCED_STALE_TOKEN');
  assert.equal(commit(s,{owner:'B',token:2,runId:'rB',baseVersion:0},3).ok,true);
});
test('commit under a held script lock reports BUSY and writes nothing; release lets another writer in immediately; resume sees last version',()=>{
  const s=memoryStore();const a=acquire(s,'A',0,H);s.lockHeld=true;assert.equal(commit(s,{owner:'A',token:a.token,runId:'r',baseVersion:0},1).reason,'BUSY');s.lockHeld=false;
  assert.equal(lastVersion(s.rows()),0);assert.equal(release(s,{owner:'A',token:a.token}).ok,true);
  const b=acquire(s,'B',2,H);assert.equal(b.ok,true);assert.equal(b.incompletePreviousRun,false);
  assert.equal(release(s,{owner:'A',token:a.token}).reason,'FENCED_STALE_TOKEN');
});
