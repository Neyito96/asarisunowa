import test from 'node:test';
import assert from 'node:assert/strict';
import {previewFullEpisode} from '../scripts/library-v3-full-preview.mjs';
const handlers={
 clean:(raw)=>({text:raw.replace(/^共通お知らせ.*\n/gm,'').trim(),ruleVersion:'test-only-1',originalPreserved:true,removed:[{rule:'example'}],review:[],hold:false}),
 extractPeople:(i)=>({people:[{name:'記者A',role:'出演',source:'explicit'}],speakers:['記者A'],reviews:[]})
};
const base={show:'MEDIA TALK',episode:{guid:'g',rssUrl:'https://example.org/feed',descriptionRaw:'本文\n関連記事：[特集](https://example.org/article)\n共通お知らせ\n',title:'話題',published:'2026-10-18'},sourceHash:'hash',identityStatus:'EXACT'};
test('existing blank V/W candidates include raw, clean, people, related URLs',()=>{
 const o=previewFullEpisode({...base,ledger:{epId:'EP-1',descriptionRaw:'',clean:''}},handlers);
 assert.equal(o.route,'PAST');assert.equal(o.proposal.rawCandidate,base.episode.descriptionRaw);
 assert.equal(o.proposal.cleanCandidate.includes('共通お知らせ'),false);
 assert.equal(o.proposal.evidence.people[0].role,'出演');
 assert.equal(o.proposal.evidence.links[0].title,'特集');
 assert.equal(o.proposal.writes,0);
});
test('changed existing raw is preserved and new clean cannot be copied into W',()=>{
 const o=previewFullEpisode({...base,ledger:{epId:'EP-1',descriptionRaw:'old',clean:''}},handlers);
 assert.equal(o.proposal.cleanCandidate,null);assert.ok(o.proposal.holdReasons.includes('RAW_VERSION_MISMATCH_CLEAN_HELD'));
 assert.equal(o.proposal.existingVProtected,true);
});
test('existing W is protected and original raw not silently replaced',()=>{
 const o=previewFullEpisode({...base,ledger:{epId:'EP-1',descriptionRaw:base.episode.descriptionRaw,clean:'human-edited'}},handlers);
 assert.equal(o.proposal.cleanCandidate,null);assert.equal(o.proposal.rawCandidate,null);
});
test('verified new uses same extraction but never appends',()=>{
 const o=previewFullEpisode({...base,ledger:null,identityStatus:'VERIFIED_NEW'},handlers);
 assert.equal(o.route,'NEW');assert.equal(o.proposal.cleanCandidate.includes('本文'),true);
 assert.equal(o.proposal.requiresApproval,true);assert.equal(o.writes,0);
});
test('no-match and excluded are held before projection',()=>{
 assert.equal(previewFullEpisode({...base,ledger:null,identityStatus:'NO_MATCH'},handlers).proposal,null);
 assert.equal(previewFullEpisode({...base,excluded:true,ledger:{epId:'EP-1'}},handlers).proposal,null);
});
test('unproven cleaning function is rejected',()=>assert.throws(()=>previewFullEpisode({...base,ledger:null,identityStatus:'VERIFIED_NEW'},{...handlers,clean:()=>({text:'changed'})}),/UNSAFE_CLEAN_RESULT/));
