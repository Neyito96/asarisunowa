import test from "node:test";
import assert from "node:assert/strict";
import {planV2UrlCandidates} from "../scripts/ledger-v2/p18-p19-v2-reconcile.mjs";
const base = {epId:"EP-06726",show:"MEDIA TALK",guid:"guid-1",urls:{Spotify:""}};
const c = {show:"MEDIA TALK",guid:"guid-1",service:"Spotify",url:"https://open.spotify.com/episode/ABC123",identityVerified:true};
test("valid GUID match yields one proposal",()=>{
 const r=planV2UrlCandidates([base],[c]);assert.equal(r.proposals.length,1);assert.equal(r.holds.length,0);
});
test("rerun with URL already present yields zero proposals",()=>{
 const r=planV2UrlCandidates([{...base,urls:{Spotify:c.url}}],[c]);assert.equal(r.proposals.length,0);
});
test("conflicting existing URL is protected",()=>{
 const r=planV2UrlCandidates([{...base,urls:{Spotify:"https://open.spotify.com/episode/OTHER"}}],[c]);assert.equal(r.holds[0].reason,"EXISTING_URL_CONFLICT");
});
test("old EP-ID collision does not override GUID matching",()=>{
 const r=planV2UrlCandidates([base,{epId:"EP-06703",show:"MEDIA TALK",guid:"guid-2",urls:{}}],[{...c,sourceEpId:"EP-06703"}]);
 assert.equal(r.proposals[0].epId,"EP-06726");
});
test("duplicate GUID across V2 rows is held",()=>{
 const r=planV2UrlCandidates([base,{...base,epId:"EP-06799"}],[c]);assert.equal(r.holds[0].reason,"AMBIGUOUS_GUID");
});
test("show homepage and unverifiable Amazon/Pody are held",()=>{
 for (const candidate of [{...c,url:"https://open.spotify.com/show/123"},{...c,service:"Amazon",url:"https://music.amazon.com/podcasts/abc"},{...c,service:"Pody",url:"https://pody.jp/abc"}]) {
  const r=planV2UrlCandidates([base],[candidate]);assert.equal(r.proposals.length,0);
 }
});
test("missing GUID is held",()=>{
 const r=planV2UrlCandidates([base],[{...c,guid:""}]);assert.equal(r.holds[0].reason,"MISSING_IDENTITY");
});
test("duplicate identical candidates yield one proposal",()=>{
 const r=planV2UrlCandidates([base],[c,c]);assert.equal(r.proposals.length,1);
});
test("input data is not mutated",()=>{
 const rows=[structuredClone(base)], candidates=[structuredClone(c)];
 planV2UrlCandidates(rows,candidates);assert.deepEqual(rows,[base]);assert.deepEqual(candidates,[c]);
});

test("independent verification required",()=>{
 const r=planV2UrlCandidates([base],[{...c,identityVerified:false}]);assert.equal(r.proposals.length,0);assert.equal(r.holds[0].reason,"IDENTITY_NOT_INDEPENDENTLY_VERIFIED");
});
test("conflicting new candidates invalidate earlier proposal",()=>{
 const r=planV2UrlCandidates([base],[c,{...c,url:"https://open.spotify.com/episode/OTHER"}]);assert.equal(r.proposals.length,0);assert.equal(r.holds.length,2);
});
test("lookalike domain rejected",()=>{
 const r=planV2UrlCandidates([base],[{...c,url:"https://open.spotify.com.evil.org/episode/ABC123"}]);assert.equal(r.proposals.length,0);
});
