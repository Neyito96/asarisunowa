import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRelatedLinks,planArchive} from '../scripts/library-v3-archive-core.mjs';
const input={epId:'EP-00083',guid:'guid-83',sourceHash:'rss-sha-83',sourceUrl:'https://feeds.example/rss',raw:'関連記事：[報道記事](https://example.org/story)\nhttps://example.org/reference',existingRaw:'old original',identityConfirmed:true};
test('markdown title and bare URL are retained separately',()=>{
 const links=parseRelatedLinks(input.raw);
 assert.equal(links.length,2);
 assert.equal(links[0].title,'報道記事');
 assert.equal(links[1].title,null);
 assert.equal(links[1].titleVerified,false);
});
test('HTML anchor text survives without guessing title',()=>{
 const links=parseRelatedLinks('<a href="https://example.org/story">取材記事</a>');
 assert.equal(links[0].title,'取材記事');
});
test('repeated URL deduplicated without mutating text',()=>assert.equal(parseRelatedLinks('https://example.org/x https://example.org/x').length,1));
test('difference creates immutable alternate proposal with no writes',()=>{
 const p=planArchive(input);
 assert.equal(p.status,'ARCHIVE_ALTERNATE_CANDIDATE');
 assert.equal(p.records[0].raw,input.raw);
 assert.equal(p.records[0].relation,'ALTERNATE_VERSION');
 assert.equal(p.writes,0);
 assert.equal(p.ledgerMutation,false);
});
test('equal V still produces separately identifiable snapshot candidate',()=>assert.equal(planArchive({...input,existingRaw:input.raw}).status,'ARCHIVE_SNAPSHOT_CANDIDATE'));
test('replay of same key is idempotent',()=>{
 const first=planArchive(input);
 assert.equal(planArchive({...input,existingVersionKeys:[first.records[0].key]}).status,'ALREADY_ARCHIVED');
});
test('never propose uncertain identities or excluded/ambiguous records',()=>{
 for(const patch of [{identityConfirmed:false},{excluded:true},{conflict:true},{guid:''}])
  assert.equal(planArchive({...input,...patch}).records.length,0);
});
test('missing original or source is held',()=>{
 assert.equal(planArchive({...input,raw:''}).records.length,0);
 assert.equal(planArchive({...input,sourceUrl:'http://insecure.example'}).records.length,0);
});

test('a generic 関連記事 label is not a verified article title',()=>{
 const l=parseRelatedLinks('関連記事：https://example.org/a');
 assert.equal(l.length,1);
 assert.equal(l[0].title,null);
 assert.equal(l[0].titleVerified,false);
});

test('two-line Asahi article heading and URL retain title as unverified candidate',()=>{
 const links=parseRelatedLinks('ビール大手4社が価格調整の疑い、公取委が家宅捜索\nhttps://www.asahi.com/articles/ASVB64JYCVB6UTIL024M.html?iref=omny');
 assert.equal(links.length,1);
 assert.equal(links[0].titleCandidate,'ビール大手4社が価格調整の疑い、公取委が家宅捜索');
 assert.equal(links[0].titleVerified,false);
});
