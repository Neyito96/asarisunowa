import test from 'node:test';import assert from 'node:assert/strict';
import {auditFeedCoverage} from '../scripts/library-v3-coverage-audit.mjs';
test('known and unmatched are distinguished without automatically creating new episodes',()=>{
 const r=auditFeedCoverage({show:'ニュースの学校',rssItems:[{guid:'a'},{guid:'b'}],ledgerRows:[{show:'ニュースの学校',guid:'a',epId:'EP-1'}]});
 assert.equal(r.counts.KNOWN_GUID,1);assert.equal(r.counts.REVIEW_UNMATCHED,1);assert.equal(r.newEntriesConfirmed,0);assert.equal(r.writes,0);
});
test('RSS collisions and ledger collisions are held',()=>{
 const r=auditFeedCoverage({show:'MEDIA TALK',rssItems:[{guid:'a'},{guid:'a'},{guid:'b'}],ledgerRows:[{show:'MEDIA TALK',guid:'b'},{show:'MEDIA TALK',guid:'b'}]});
 assert.equal(r.counts.HOLD_RSS_DUPLICATE,2);assert.equal(r.counts.HOLD_LEDGER_DUPLICATE,1);
});
test('unconfigured shows are excluded',()=>assert.equal(auditFeedCoverage({show:'AJW'}).status,'OUT_OF_SCOPE'));
test('empty RSS list reports zero without declaring updates healthy',()=>{
 const r=auditFeedCoverage({show:'報談',rssItems:[],ledgerRows:[]});
 assert.equal(r.feedItems,0);assert.equal(r.status,'READ_ONLY_COVERAGE');
});
