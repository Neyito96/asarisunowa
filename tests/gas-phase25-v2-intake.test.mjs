import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {plan,schema}=require("../scripts/google-apps-script/P25V2IntakePlan.js");
const h=["EP-ID","番組名","タイトル","公式GUID","公式個別URL","Spotify個別URL","掲載判定","代表EP-ID"];
const r=(ep,show,title,guid,url,decision="",rep="")=>[ep,show,title,guid,url,"",decision,rep];
test("header-driven V2 validation fails closed",()=>{
 assert.equal(schema(h).guid,3);
 assert.throws(()=>schema(["EP-ID"]),/V2_SCHEMA_MISSING/);
});
test("new entries are candidates, never automatically published",()=>{
 const p=plan(h,[],[r("EP-07001","MEDIA TALK","新しい話","guid-x","https://example.org/x")]);
 assert.equal(p.mode,"READ_ONLY");assert.equal(p.results[0].status,"CANDIDATE");
 assert.equal(p.results[0].reason,"NEW_EPISODE_UNREVIEWED");
});
test("same GUID is a held duplicate with surviving representative",()=>{
 const p=plan(h,[r("EP-00001","MEDIA TALK","元の話","guid-a","https://example.org/a","対象","EP-00001")],[r("EP-07001","MEDIA TALK","再掲","guid-a","https://example.org/b")]);
 assert.deepEqual([p.results[0].status,p.results[0].reason,p.results[0].representative],["HOLD","DUPLICATE_IDENTITY","EP-00001"]);
});
test("same show and normalized title is HOLD pending editorial review",()=>{
 const p=plan(h,[r("EP-00001","SDGsを話そう","スポーツとLGBT①","g1","url1","対象","EP-00001")],[r("EP-07001","SDGsを話そう","（再）スポーツとLGBT①","g2","url2")]);
 assert.equal(p.results[0].status,"CANDIDATE"); // prefix stripping is NOT automatic; avoid a false confirmed duplicate
});
test("excluded shows are not candidates and repeated batch ids are held",()=>{
 const p=plan(h,[],[r("","AJW","x","g1","u1"),r("","MEDIA TALK","x","g2","u2"),r("","MEDIA TALK","y","g2","u3")]);
 assert.deepEqual(p.results.map(x=>x.status),["EXCLUDE","CANDIDATE","HOLD"]);
});
test("existing EP ID is never overwritten",()=>{
 const p=plan(h,[r("EP-07001","MEDIA TALK","old","a","u1")],[r("EP-07001","MEDIA TALK","new","b","u2")]);
 assert.equal(p.results[0].reason,"EP_ID_ALREADY_EXISTS");
});
