import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {v3RegisteredRowHash} from '../scripts/library-new-admissions.mjs';
import {autoAdmitOfficialRss} from '../scripts/library-official-rss-auto-policy.mjs';
import {buildPublicationScope} from '../public/library/publication-scope.mjs';
const base=JSON.parse(gunzipSync(readFileSync(new URL('../docs/audits/2026-10-22-publication-scope/decisions.json.gz',import.meta.url))));
const feed='https://official.example.test/puerta.rss';
const at='2026-10-23T02:00:00Z';
function fixture(){
 const guid='5218b5c5-7f21-4089-a5c7-b4ea00cf1bd3';
 const audio='https://traffic.omny.fm/clips/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/'+guid+'/audio.mp3';
 const row=Array(55).fill('');Object.assign(row,{0:'EP-06592',1:'PUERTA',2:'PUERTA #25',3:'2026-10-23 06:35:00',6:guid,14:audio,21:'公式概要',22:'公式概要'});
 const state={identity:['VERIFIED',guid,v3RegisteredRowHash(row),'','','RSS_registered',at]};
 const source={rows:[row],v3FieldStates:[[row[0],JSON.stringify(state)]],exclusions:[]};
 const evidence=[{id:row[0],feedUrl:feed,guid,clipUuid:guid,title:row[2],publishedAt:'2026-10-22T21:35:00Z',audioUrl:audio,fetchedAt:'2026-10-23T02:30:00Z'}];
 const policy={id:'official-rss-v1',newAfter:'2026-10-22T00:00:00Z',allowedFeeds:[feed],observedAt:'2026-10-23T03:00:00Z'};
 return {source,evidence,policy};
}
test('one verified official RSS registration auto-admits; replay remains identical',()=>{
 const f=fixture(),before=structuredClone(f.source);
 const a=autoAdmitOfficialRss(f.source,base,f.evidence,f.policy);
 const b=autoAdmitOfficialRss(f.source,base,f.evidence,f.policy);
 assert.deepEqual(a.admittedIds,['EP-06592']);
 assert.deepEqual(a.exceptions,[]);
 assert.equal(buildPublicationScope(a.snapshot).adopted,5849);
 assert.deepEqual(a.snapshot,b.snapshot);
 assert.deepEqual(f.source,before);
 assert.deepEqual(a.snapshot.decisions.slice(0,base.decisions.length),base.decisions);
 assert.equal(a.snapshot.decisions.at(-1).verificationMethod,'AUTOMATIC_OFFICIAL_RSS_RULE');
});
test('unapproved feed is isolated, not published',()=>{
 const f=fixture();f.evidence[0].feedUrl='https://unknown.example/rss';
 const a=autoAdmitOfficialRss(f.source,base,f.evidence,f.policy);
 assert.deepEqual(a.admittedIds,[]);
 assert.equal(a.exceptions.length,1);
 assert.equal(buildPublicationScope(a.snapshot).adopted,5848);
});
test('missing official audio is isolated',()=>{
 const f=fixture();f.evidence[0].audioUrl='';
 const a=autoAdmitOfficialRss(f.source,base,f.evidence,f.policy);
 assert.deepEqual(a.admittedIds,[]);
 assert.equal(a.exceptions.length,1);
});
test('historical baseline episodes are never reclassified',()=>{
 const f=fixture();f.evidence[0].id=base.decisions[0].id;
 const a=autoAdmitOfficialRss(f.source,base,f.evidence,f.policy);
 assert.deepEqual(a.admittedIds,[]);
 assert.equal(a.exceptions.length,0);
});
