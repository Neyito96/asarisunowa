'use strict';
const assert=require('node:assert/strict'),{liteLatestThreeScan:scan}=require('./LiteLatestThree');
const names=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ニュースの学校','ドーナツ','報談'];
const src=names.map((show,i)=>({show,url:i===4||i===6?'https://feeds.megaphone.fm/TASC123':'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/abc'}));
const episode=(guid,d,link='https://episode/'+guid)=>({guid,pubDate:new Date(Date.UTC(2026,9,d)).toUTCString(),title:guid,link});
const go=(over={})=>scan({sources:src,ledgerRows:[],fetchFeed:()=>[],...over});let total=0;
function t(name,fn){fn();total++;console.log('PASS',name)}
t('max three of five reversed',()=>{let r=go({fetchFeed:()=>[1,5,2,4,3].map(d=>episode('g'+d,d))});assert.equal(r.totals.selected,21);assert.deepEqual(r.rows[0].candidates.map(x=>x.guid),['g5','g4','g3'])});
t('future newest not RSS index',()=>{let r=go({fetchFeed:()=>[episode('old',1),episode('new',9),episode('mid',5),episode('latest',12)]});assert.equal(r.rows[0].candidates[0].guid,'latest')});
t('invalid pubDate pending',()=>{let r=go({fetchFeed:()=>[episode('one',3),{guid:'invalid',pubDate:'bogus'}]});assert.equal(r.rows[0].status,'SOURCE_PENDING');assert.equal(r.rows[0].selected,1)});
t('registered id',()=>{let r=go({ledgerRows:[{guid:'known',id:'EP-06632'}],fetchFeed:s=>s.show===names[0]?[episode('known',5)]:[]});assert.equal(r.rows[0].candidates[0].existingEpId,'EP-06632')});
t('cross show duplicated GUID',()=>{let r=go({fetchFeed:()=>[episode('same',1)]});assert.equal(r.totals.duplicates,6);assert.equal(r.totals.unregisteredCandidates,1)});
t('url possible identity unknown',()=>{let r=go({ledgerRows:[{guid:'other',id:'EP-00111',url:'https://episode/x'}],fetchFeed:s=>s.show===names[0]?[episode('x',1)]:[]});assert.equal(r.rows[0].candidates[0].status,'UNKNOWN')});
t('missing GUID unknown',()=>{let r=go({fetchFeed:s=>s.show===names[0]?[episode('',1)]:[]});assert.equal(r.rows[0].unknown,1)});
t('failed feed pending not zero',()=>{let r=go({fetchFeed:s=>{if(s.show===names[0])throw Error('HTTP503');return []}});assert.equal(r.rows[0].fetched,null);assert.equal(r.totals.pendingFeeds,1)});
t('no writes or ID allocation',()=>{let r=go({fetchFeed:()=>[episode('a',1)]});assert.equal(r.productionWrites,0);assert.equal(r.rows[0].candidates[0].existingEpId,null)});
console.log(JSON.stringify({total,passed:total,failed:0}));
