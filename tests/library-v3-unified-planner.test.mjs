import test from 'node:test';
import assert from 'node:assert/strict';
import {planUnifiedEpisode} from '../scripts/library-v3-unified-planner.mjs';
const base={show:'ニュースの学校',episode:{guid:'g1',rssUrl:'https://example.org/feed',descriptionRaw:'説明\n関連記事：[記事](https://example.org/a)',title:'題',published:'2026-10-18'},sourceHash:'hash1'};
test('past row gives immutable archive proposal and protects existing V/W',()=>{
 const x=planUnifiedEpisode({...base,ledger:{epId:'EP-100',descriptionRaw:'old'},identityStatus:'EXACT'});
 assert.equal(x.route,'PAST');assert.equal(x.writes,0);assert.equal(x.archive.records[0].relation,'ALTERNATE_VERSION');
 assert.equal(x.links[0].title,'記事');assert.equal(x.existingCleanProtected,true);
});
test('new episode requires verification, never appends automatically',()=>{
 assert.equal(planUnifiedEpisode({...base,identityStatus:'NO_MATCH'}).status,'HOLD_UNMATCHED');
 const x=planUnifiedEpisode({...base,identityStatus:'VERIFIED_NEW'});
 assert.equal(x.status,'NEW_EPISODE_CANDIDATE');assert.equal(x.writes,0);assert.equal(x.requiresAppendApproval,true);
});
test('excluded/ambiguous/unsupported shows never pass',()=>{
 assert.equal(planUnifiedEpisode({...base,excluded:true,identityStatus:'EXACT',ledger:{epId:'EP-100'}}).status,'HOLD_PROTECTED');
 assert.equal(planUnifiedEpisode({...base,identityStatus:'AMBIGUOUS'}).status,'HOLD_PROTECTED');
 assert.equal(planUnifiedEpisode({...base,show:'AJW'}).status,'OUT_OF_SCOPE');
});
test('missing RSS original is held',()=>assert.equal(planUnifiedEpisode({...base,episode:{...base.episode,descriptionRaw:''},identityStatus:'VERIFIED_NEW'}).status,'HOLD_SOURCE_INCOMPLETE'));
test('existing row with uncertain identity stays held',()=>assert.equal(planUnifiedEpisode({...base,ledger:{epId:'EP-100'},identityStatus:'NO_MATCH'}).status,'HOLD_IDENTITY'));
