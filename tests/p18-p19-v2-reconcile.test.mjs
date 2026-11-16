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
import {v2RowsFromSheet,candidatesFromP15Sheet} from "../scripts/ledger-v2/p18-p19-v2-reconcile.mjs";
const H=["EP-ID","番組","タイトル","公式GUID","Spotify","Apple","Amazon","Pocket Casts","LISTEN","Pody"];
test("V2は見出し名で読み、候補は番組＋題名1件一致でGUIDを付ける。題名一致だけでは提案しない",()=>{
 const v2=v2RowsFromSheet([H,["EP-06730","ニュースの現場から","（ポリレビ #19）題名","g-30","","","","","",""],["EP-06731","MEDIA TALK","同じ題","g-31","","","","","",""],["EP-06732","MEDIA TALK","同じ題","g-32","","","","","",""]]);
 const {candidates,unmatched}=candidatesFromP15Sheet([["SHOW","SERVICE","LABEL","URL","DISCOVERY_URL"],["ニュースの現場から","Apple Podcasts","（ポリレビ　#19）題名","https://podcasts.apple.com/jp/podcast/x/id1?i=99",""],["MEDIA TALK","Spotify","同じ題","https://open.spotify.com/episode/ZZZ",""],["報談","Spotify","無い題","https://open.spotify.com/episode/YYY",""]],v2);
 assert.equal(candidates.length,1);assert.equal(candidates[0].guid,"g-30");assert.equal(candidates[0].service,"Apple");
 assert.deepEqual(unmatched.map(u=>u.reason),["TITLE_AMBIGUOUS","TITLE_NOT_IN_V2"]);
 const r=planV2UrlCandidates(v2,candidates);assert.equal(r.proposals.length,0);assert.equal(r.holds[0].reason,"IDENTITY_NOT_INDEPENDENTLY_VERIFIED");
 const ok=planV2UrlCandidates(v2,[{...candidates[0],identityVerified:true}]);assert.equal(ok.proposals[0].epId,"EP-06730");
});
test("V2の見出しが足りなければ止まる",()=>{assert.throws(()=>v2RowsFromSheet([["EP-ID","番組"]]),/V2_HEADER_MISSING/);});
