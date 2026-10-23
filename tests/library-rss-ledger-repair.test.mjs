import test from 'node:test';import assert from 'node:assert/strict';
import {planRssLedgerRepair} from '../scripts/library-rss-ledger-repair.mjs';
const guid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
function fixture(){const cells=Array.from({length:55},()=>({}));cells[1]={userEnteredValue:{stringValue:'ニュースの現場から'}};
 const item={guid,title:'新着',pubDate:'Thu, 22 Oct 2026 19:00:00 +0000',link:'https://omny.fm/shows/asahi/example',audio:'https://traffic.omny.fm/d/clips/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/'+guid+'/audio.mp3',image:'https://example.com/image',feedUrl:'https://www.omnycontent.com/example.rss',description:'【番組内容】\n原文全文です。\n【関連記事】\n記事 https://www.asahi.com/articles/EXAMPLE.html\n【出演・スタッフ】\nMC 山田太郎',duration:'53:35',language:'ja'};
 const clip={Id:guid,Title:item.title,PublishedUtc:'2026-10-22T19:00:00Z',PublishedUrl:item.link,HasPublishedTranscript:false,DurationSeconds:3214.755,ModifiedAtUtc:'2026-10-22T19:05:15Z',EmbedUrl:item.link+'/embed'};
 return {cells,item,clip,id:'EP-06592',checkedAt:'2026-10-23T03:00:00Z',apiUrl:'https://api.omny.fm/example',sheetId:1,rowIndex:6592};}
test('RSS raw, duration, metadata and rich links are preserved',()=>{const x=fixture(),p=planRssLedgerRepair(x);assert.equal(p.row[21],x.item.description);assert.equal(p.row[15],3215);assert.equal(p.row[3],'2026/10/23 04:00:00');assert.equal(p.row[45],'山田太郎');const link=p.requests.find(r=>r.updateCells.range.startColumnIndex===28);assert.equal(link.updateCells.rows[0].values[0].textFormatRuns.length,1);});
test('pre-existing exclusion requires explicit draft promotion; real IDs stay protected',()=>{const x=fixture();x.cells[38]={userEnteredValue:{stringValue:'保留'}};assert.throws(()=>planRssLedgerRepair(x));x.cells[39]={userEnteredValue:{stringValue:'仮登録・EP-ID未採番'}};assert.doesNotThrow(()=>planRssLedgerRepair({...x,promoteDraft:true}));x.cells[0]={userEnteredValue:{stringValue:x.id}};assert.throws(()=>planRssLedgerRepair({...x,promoteDraft:true}));});
test('mismatched UUID and existing GUID fail closed',()=>{const x=fixture();assert.throws(()=>planRssLedgerRepair({...x,clip:{...x.clip,Id:'different'}}));x.cells[6]={userEnteredValue:{stringValue:'different'}};assert.throws(()=>planRssLedgerRepair(x));});
test('formula cells are protected',()=>{const x=fixture();x.cells[15]={userEnteredValue:{formulaValue:'=1'}};assert.throws(()=>planRssLedgerRepair(x));});
test('more than five people remain complete in X and structured note',()=>{const x=fixture();x.item.description='【番組内容】\n本文\n【出演・スタッフ】\n'+Array.from({length:7},(_,i)=>'出演 人物'+i).join('\n');const p=planRssLedgerRepair(x);assert.equal(p.metadata.people.length,7);assert.ok(p.row[23].includes('人物6'));const c=p.requests.find(r=>r.updateCells.range.startColumnIndex===23).updateCells.rows[0].values[0];assert.equal(JSON.parse(c.note).people.length,7);});
test('unverified platforms remain blank; no constructed URLs',()=>{const p=planRssLedgerRepair(fixture());for(const col of [10,11,12,40,41,42])assert.equal(p.row[col],'');});

test('post-registration platform fill refreshes row hash and keeps registration evidence; replay zero',async()=>{
 const {planVerifiedPlatformFill}=await import('../scripts/library-rss-ledger-repair.mjs');const p=planRssLedgerRepair(fixture());
 const options={row:p.row,state:p.state,evidence:{episodeGuid:guid,url:'https://podcasts.apple.com/jp/podcast/example/id123?i=456',source:'official lookup'},platform:'apple',sheetId:1,rowIndex:6592,stateSheetId:2,stateRowIndex:6592,checkedAt:'2026-10-23T04:00:00Z'};
 const got=planVerifiedPlatformFill(options);assert.equal(got.requests.length,2);assert.notEqual(got.state.identity[2],p.state.identity[2]);assert.deepEqual(got.state.registrationEvidence,p.state.registrationEvidence);
 assert.equal(planVerifiedPlatformFill({...options,row:got.row,state:got.state}).requests.length,0);
 const {v3RegisteredRowHash}=await import('../scripts/library-new-admissions.mjs');assert.equal(got.state.identity[2].replace(/=+$/,''),v3RegisteredRowHash(got.row));
});
test('platform mismatch and concurrent row change cannot overwrite',async()=>{
 const {planVerifiedPlatformFill}=await import('../scripts/library-rss-ledger-repair.mjs');const p=planRssLedgerRepair(fixture());
 const x={row:p.row,state:p.state,evidence:{episodeGuid:'wrong',url:'https://listen.style/p/a/b'},platform:'listen'};assert.throws(()=>planVerifiedPlatformFill(x));x.evidence.episodeGuid=guid;x.row=[...p.row];x.row[2]='Changed';assert.throws(()=>planVerifiedPlatformFill(x),/Concurrent/);
});
