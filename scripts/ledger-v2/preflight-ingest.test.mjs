import test from 'node:test';
import assert from 'node:assert/strict';
import {audit} from './preflight-ingest.mjs';
const row=(id,guid,url,title='Episode',show='MEDIA TALK')=>({id,guid,url,title,show,sourceRow:2});
test('safe new episode remains unreviewed',()=>{
 const r=audit([row('EP-1','guid-1','https://example.org/1','Old')],[row('EP-2','guid-2','https://example.org/2','New')]);
 assert.equal(r.counts.CANDIDATE_UNREVIEWED,1);
 assert.equal(r.mode,'READ_ONLY_NO_WRITES');
});
test('duplicate GUID blocks regardless of new EP-ID',()=>{
 const r=audit([row('EP-1','guid-1','https://example.org/1','Old')],[row('EP-2','guid-1','https://example.org/2','New')]);
 assert.equal(r.outcomes[0].decision,'BLOCK');
});
test('same show and title without identifier match goes to HOLD',()=>{
 const r=audit([row('EP-1','guid-1','https://example.org/1')],[row('EP-2','guid-2','https://example.org/2')]);
 assert.equal(r.outcomes[0].decision,'HOLD');
});
test('duplicate incoming ID blocks second candidate',()=>{
 const r=audit([], [row('EP-1','a','https://example.org/a','A'),row('EP-1','b','https://example.org/b','B')]);
 assert.equal(r.outcomes[1].decision,'BLOCK');
});
test('missing identifiers never auto-admitted',()=>{
 const r=audit([], [row('EP-2','','','New')]);
 assert.equal(r.outcomes[0].decision,'BLOCK');
});
test('same GUID in another show also blocks (cross-show repost)',()=>{
 const r=audit([row('EP-1','guid-1','https://example.org/1','Old','報談')],[row('EP-2','GUID-1','https://example.org/2','New')]);
 assert.equal(r.outcomes[0].decision,'BLOCK');
});
test('rerun mark （再） goes to HOLD, and matches original title',()=>{
 const r=audit([row('EP-1','g1','https://example.org/1','台風の話')],[row('EP-2','g2','https://example.org/2','（再）台風の話'),row('EP-3','g3','https://example.org/3','【再配信】別の話')]);
 assert.equal(r.outcomes[0].decision,'HOLD'); assert.ok(r.outcomes[0].reasons.includes('SAME_SHOW_TITLE_REVIEW'));
 assert.equal(r.outcomes[1].decision,'HOLD');
});
