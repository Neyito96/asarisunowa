import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFile}from'node:fs/promises';
import{loadExistingAdParser,auditAdRows}from'../scripts/audit-description-ads.mjs';
import{createListenerInboxMock}from'../lib/listener-inbox-mock.mjs';
import{monthJst,topicEvidence,validateSample,browse,libraryLink,selectSamples}from'../experiments/universe-v0.1/model.mjs';
test('runtime diagnostic cannot refresh tokens, write properties, invoke engines or change triggers',async()=>{
 const code=await readFile(new URL('../scripts/google-apps-script/LibraryPhase8ReadOnlyStatus.js',import.meta.url),'utf8');
 const secret='NEVER_OUTPUT_THIS_SECRET',values={SPOTIFY_CLIENT_SECRET:secret,SPOTIFY_USER_REFRESH_TOKEN:secret,LIB_V3_CONFIG:JSON.stringify({enabled:true,autonomous:false,access_token:secret}),LIB_V3_MORNING_STATE:JSON.stringify({lease:{token:secret},last:{at:'2026-10-21T05:00:00Z',error:secret}})};
 const forbidden=()=>{throw Error('Mutation or token helper invoked');},logs=[];
 const ctx=vm.createContext({console:{log:x=>logs.push(x)},PropertiesService:{getScriptProperties:()=>({getProperty:k=>values[k]||null,setProperty:forbidden,getProperties:forbidden})},ScriptApp:{getProjectTriggers:()=>['ALIB_AUTO_tick','ALIB_AUTO_tick','private-handler-'+secret].map(h=>({getHandlerFunction:()=>h})),newTrigger:forbidden,deleteTrigger:forbidden},ALIB_AUTO_tick:forbidden,libV3Run_:forbidden,getSpotifyUserAccessToken:forbidden,UrlFetchApp:{fetch:forbidden}});
 vm.runInContext(code,ctx);const r=ctx.inspectPhase12RuntimeReadOnly();assert.equal(r.writes,0);assert.equal(r.networkCalls,0);assert.equal(r.v3.enabled,true);assert.equal(r.v3.allowNew,null);assert.equal(r.morning.hasLease,true);assert.equal(r.otherTriggerCount,1);assert.equal(r.duplicateHandlers[0],'ALIB_AUTO_tick');assert.equal(r.credentialPresence.refreshToken,true);assert.ok(!JSON.stringify(r).includes(secret));assert.ok(!logs.join('').includes(secret));assert.equal(r.oauthValidity,'NOT_VERIFIED_NO_TOKEN_REFRESH_OR_API_CALL');
});
test('existing V5 keeps actual event content and article links; overlap is counted',async()=>{
 const parse=await loadExistingAdParser();const event='イベント会場から、暮らしの変化を語ります。';assert.equal(parse(event).cleaned,event);
 const text='英語教育の現状を取材しました。おたよりフォーム\n【イベント告知】寺下真理加さん出演の別イベント\n【関連記事】学校の現状\nhttps://www.asahi.com/articles/ABC.html\n【出演・スタッフ】実出演者';
 const r=parse(text);assert.ok(r.cleaned.includes('英語教育'));assert.ok(!r.cleaned.includes('寺下真理加'));assert.ok(r.cleaned.includes('ABC.html'));assert.ok(r.cleaned.includes('実出演者'));assert.equal(r.held,true);
 const h=Array(23).fill('');h[0]='台帳ID';h[21]='概要原文';h[22]='概要清掃済み';const row=Array(23).fill('');row[0]='EP-03365';row[21]=text;row[22]=text;const input={headers:h,rows:[row]},saved=JSON.stringify(input),report=auditAdRows(input,parse).report;
 assert.equal(report.selectedCleanFallback.overlap,1);assert.equal(report.rawBoundaryDiagnostic.articleUrlLoss,0);assert.equal(JSON.stringify(input),saved);assert.equal(report.writes,0);
});
test('local inbox idempotency, ownership, moderation and human exclusion are independent of Spotify',()=>{
 const box=createListenerInboxMock(),actor={verified:true,id:'user1',role:'listener'},input={kind:'recommend',episodeId:'EP-01443',theme:'文化',reason:'話題に合う',key:'request_0001'};
 const r=box.receive(input,actor,'2026-10-21T00:00:00Z');assert.equal(r.externalEffects,0);assert.equal(box.receive(input,actor,'2026-10-22T00:00:00Z').received_at,r.received_at);assert.throws(()=>box.receive({...input,reason:'別内容'},actor,r.received_at),/Idempotency/);
 assert.throws(()=>box.review(input.key,actor.id,'accept',actor,'2026-10-21T00:01:00Z'),/role/);
 const admin={verified:true,id:'admin',role:'administrator'};assert.throws(()=>box.review(input.key,actor.id,'accept',admin,'2026-10-21T00:01:00Z','除外'),/human/);
 const held=box.review(input.key,actor.id,'hold',admin,'2026-10-21T00:01:00Z');assert.equal(held.moderation,'hold');assert.equal(box.own(actor)[0].label,'要確認');assert.equal(box.own({...actor,id:'other'}).length,0);assert.equal(box.metrics().medianMs,null);assert.equal(box.metrics().p90Ms,null);assert.throws(()=>box.receive(input,{verified:false},r.received_at),/Authenticated/);
});
test('universe uses JST months and title evidence, never ad names or final totals',()=>{
 assert.equal(monthJst('2020-01-31T16:00:00Z'),'2020-02');assert.equal(monthJst('2027-01-01'),null);assert.equal(monthJst('bad'),null);
 const ep={id:'EP-00001',title:'英語教育の今',date:'2020-01-31T16:00:00Z',show:'ニュース',description:'寺下真理加のイベント広告',cast:'未検証'};
 const samples=selectSamples([ep]);assert.equal(samples[0].peopleStatus,'UNVERIFIED_NOT_DERIVED');assert.ok(topicEvidence(ep).every(t=>t.field==='title'));assert.ok(!JSON.stringify(samples).includes('寺下真理加'));
 const data={schema:'universe-strata/0.1',populationStatus:'AUDIT_PENDING',canonicalTotal:null,episodes:samples};assert.equal(validateSample(data),data);assert.equal(browse(data,{month:'2020-02',topic:'暮らし',query:'英語'}).length,1);assert.equal(browse(data,{month:'2021-01'}).length,0);assert.throws(()=>validateSample({...data,canonicalTotal:6600}),/population/);assert.throws(()=>validateSample({...data,episodes:[...samples,...samples]}),/identity/);assert.equal(libraryLink('EP-00001'),'https://neyito96.github.io/asarisunowa/library/?ep=EP-00001');assert.throws(()=>libraryLink('javascript:bad'));
});
test('real sample is bounded and unresolved; experiment remains outside Pages public tree',async()=>{
 const data=validateSample(JSON.parse(await readFile(new URL('../experiments/universe-v0.1/sample.json',import.meta.url),'utf8')));assert.ok(data.episodes.length<=28);assert.equal(new Set(data.episodes.map(e=>e.month.slice(0,4))).size,7);assert.equal(data.canonicalTotal,null);
 const html=await readFile(new URL('../experiments/universe-v0.1/index.html',import.meta.url),'utf8');assert.ok(html.includes('母集団は監査中'));assert.ok(!html.includes('6591'));assert.ok(!html.includes('6466'));
});
