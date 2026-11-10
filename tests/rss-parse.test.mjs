import test from 'node:test';import assert from 'node:assert/strict';
import {parseXml,parseFeedStrict,validPubDate,XmlError} from '../public/library/rss-parse.mjs';
const NOW=Date.parse('2026-11-10T00:00:00Z');
const wrap=(inner,title='朝リス番組')=>`<?xml version="1.0" encoding="UTF-8"?><!-- c --><rss xmlns:itunes="http://x" xmlns:content="http://y" version="2.0"><channel><title>${title}</title>${inner}</channel></rss>`;
const item=(o={})=>`<item><guid isPermaLink="false">${o.g??'g1'}</guid><title>${o.t??'題'}</title><pubDate>${o.d??'Mon, 09 Nov 2026 04:00:00 +0000'}</pubDate><link>${o.l??'https://omny.fm/a'}</link><enclosure url="${o.a??'https://traffic.omny.fm/a.mp3'}" type="audio/mpeg"/><itunes:duration>${o.du??'1200'}</itunes:duration></item>`;
const P=(x,o={})=>parseFeedStrict(x,{feedKey:'k',nowMs:NOW,...o});
test('namespaces, XML declaration, comments, CDATA, entities (named/numeric/hex) are decoded',()=>{
  const r=P(wrap(item({t:'A &amp; B &lt;tag&gt; &#12354; &#x3044; &quot;q&quot;'})+`<item><guid>g2</guid><title><![CDATA[生 <b>raw</b> & text]]></title><pubDate>Mon, 09 Nov 2026 05:00:00 GMT</pubDate></item>`));
  assert.equal(r.items[0].title,'A & B <tag> あ い "q"');assert.equal(r.items[1].title,'生 <b>raw</b> & text');assert.equal(r.items[0].duration,'1200');assert.equal(r.items[0].guid,'g1');
});
test('hostile or broken XML is rejected whole: DTD/ENTITY, unclosed, mismatched tag, stray text, non-feed',()=>{
  for(const [x,c] of [[`<!DOCTYPE r [<!ENTITY x "y">]><rss><channel></channel></rss>`,'DTD_FORBIDDEN'],[wrap(item()).replace('</channel>',''),'XML_TAG_MISMATCH'],[`<rss><channel><title>a</title>`,'XML_UNCLOSED'],[`<html><body/></html>`,'NOT_A_FEED'],[`<rss><channel><title>a</title></channel></rss><<`,'XML_MALFORMED']])
    assert.throws(()=>P(x),e=>e instanceof XmlError&&e.code===c,c);
  assert.throws(()=>parseXml('x'.repeat(21*1024*1024)),/XML_TOO_LARGE/);
});
test('bad items are quarantined with a reason (never silently dropped, never registered)',()=>{
  const r=P(wrap([item({g:'ok'}),item({g:'',t:'noguid'}),item({g:'bd',d:'not a date'}),item({g:'fut',d:'Mon, 09 Nov 2030 04:00:00 +0000'}),item({g:'old',d:'Mon, 01 Jan 2001 00:00:00 +0000'}),`<item><guid>nt</guid><title></title><pubDate>Mon, 09 Nov 2026 04:00:00 +0000</pubDate></item>`,item({g:'a'.repeat(400)})].join('')));
  assert.deepEqual(r.items.map(i=>i.guid),['ok']);assert.deepEqual(r.quarantined.map(q=>q.reason).sort(),['BAD_GUID','BAD_PUBDATE','BAD_PUBDATE','BAD_PUBDATE','NO_STRONG_ID','NO_TITLE'].sort());
  assert.equal(r.itemCount,7);
});
test('URLs: only https is kept; non-https audio/link are blanked',()=>{
  const r=P(wrap(item({a:'http://insecure/a.mp3',l:'javascript:alert(1)'})));assert.equal(r.items[0].audio,'');assert.equal(r.items[0].link,'');
});
test('duplicate GUID: identical collapsed, conflicting content quarantined',()=>{
  const r=P(wrap(item({g:'d'})+item({g:'d'})+item({g:'d',t:'別題'})));assert.equal(r.items.length,1);assert.deepEqual(r.quarantined.map(q=>q.reason),['DUPLICATE_GUID_CONFLICT']);
});
test('feed identity: expected show mismatch quarantines every item; feedKey is required and attached to items',()=>{
  const bad=P(wrap(item()),{expectedShow:'別の番組'});assert.equal(bad.ok,false);assert.equal(bad.items.length,0);assert.deepEqual(bad.problems,['SHOW_IDENTITY_MISMATCH']);
  assert.equal(P(wrap(item()),{expectedShow:'朝リス番組'}).items[0].feedKey,'k');
  assert.throws(()=>parseFeedStrict(wrap(item()),{}),/FEED_KEY_REQUIRED/);
});
test('date validation boundaries',()=>{
  assert.equal(validPubDate('Mon, 09 Nov 2026 04:00:00 +0900',NOW),'2026-11-08T19:00:00.000Z');assert.equal(validPubDate('2026-11-10T23:00:00Z',NOW),'2026-11-10T23:00:00.000Z');
  assert.equal(validPubDate('2026-11-12T00:00:00Z',NOW),'');assert.equal(validPubDate('',NOW),'');assert.equal(validPubDate(null,NOW),'');
});
test('large feed (2,672 items, the size measured in COPY) parses quickly',()=>{
  const items=Array.from({length:2672},(_,i)=>item({g:'g'+i,t:'t'+i})).join('');const t=Date.now();const r=P(wrap(items));assert.equal(r.items.length,2672);assert.ok(Date.now()-t<3000);
});
