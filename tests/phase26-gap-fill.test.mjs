import test from 'node:test';import assert from 'node:assert/strict';
import {auditRow,proposals,applyProposals,extractCast,stripHtml} from '../public/library/gap-audit.mjs';
import {runCycle,ApiError,planQueue,retryDelayMs} from '../public/library/fill-queue.mjs';
const NOW=Date.parse('2026-11-10T09:00:00Z');
const row=(o={})=>{const r=new Array(55).fill('');Object.entries(o).forEach(([k,v])=>r[k]=v);return r;};
const find=(a,k)=>a.find(x=>x.key===k);
test('extractCast: HTML block, roles stripped, URLs dropped, empty block is found-but-empty, MC in a URL is not a marker',()=>{
  const h='【出演・スタッフ】<br>遠藤美波（大阪社会部）<a href="https://x.com/e">https://x.com/e</a><br>仙道洸（大阪社会部）<br>【おねがい】広告';
  assert.deepEqual(extractCast(h).names,['遠藤美波（大阪社会部）','仙道洸（大阪社会部）']);
  assert.deepEqual(extractCast('【出演・スタッフ】冨名腰隆&nbsp;https://bit.ly/x&nbsp;MC　杢田光&nbsp;https://buff.ly/y&nbsp;【朝ポキ情報】').names.map(s=>s.slice(0,3)),['冨名腰','杢田光']);
  const e=extractCast('【出演・スタッフ】');assert.equal(e.found,true);assert.equal(e.names.length,0);
  assert.equal(extractCast('https://www.asahi.com/articles/ASV9326CRV93UHMC003M.html').found,false);
});
test('audit classifies five ways and never proposes for filled cells',()=>{
  const r=row({0:'EP-1',21:'【出演】山田太郎（部）【おねがい】',11:'https://open.spotify.com/episode/abc'});
  const a=auditRow(r,{now:NOW,pubDate:NOW-2*3600e3,resolutions:{},showEpisodeCount:200,showCastBlankRate:0});
  assert.equal(find(a,'spotify').status,'FILLED');
  assert.equal(find(a,'cast1').status,'FILLABLE_FROM_OFFICIAL');assert.equal(find(a,'cast2').status,'NOT_APPLICABLE');assert.match(find(a,'cast2').reason,/^SOURCE_BLOCK_LISTS_ONLY_1$/);
  assert.equal(find(a,'apple').status,'NOT_YET_PUBLISHED');assert.equal(find(a,'descClean').status,'FILLABLE_FROM_OFFICIAL');
  assert.ok(!proposals('EP-1',r,a,{checkedAt:'t'}).some(p=>p.key==='spotify'));
});
test('old blank after grace with NOT_FOUND is HOLD (never guessed); past blank rate alone never makes cast NOT_APPLICABLE',()=>{
  const r=row({21:'本文のみ'});
  const a=auditRow(r,{now:NOW,pubDate:NOW-5*86400e3,resolutions:{spotify:{status:'NOT_FOUND'}},showEpisodeCount:499,showCastBlankRate:1});
  assert.equal(find(a,'spotify').status,'HOLD');assert.equal(find(a,'spotify').reason,'NOT_FOUND_AFTER_GRACE');assert.equal(find(a,'cast1').status,'HOLD');assert.equal(find(a,'cast1').reason,'UNKNOWN_UNDOCUMENTED');assert.equal(find(a,'cast1').needsReview,true);assert.ok(find(a,'cast1').historyHint);
  const ex=auditRow(r,{now:NOW,pubDate:NOW-5*86400e3,showEpisodeCount:499,showCastBlankRate:1,officialNoCast:true,officialNoCastEvidence:['番組概要: 出演者の記載なし(公式)']});assert.equal(find(ex,'cast1').status,'NOT_APPLICABLE');assert.equal(find(ex,'cast1').reason,'OFFICIAL_STATES_NO_CAST');
  assert.equal(find(auditRow(r,{now:NOW,pubDate:NOW-5*86400e3,unsupportedPlatforms:['pody']}),'pody').reason,'NO_VERIFIED_ROUTE');
});
test('apply fills only blanks, is idempotent, logs rollback, and never overwrites',()=>{
  const rows=new Map([['EP-1',row({21:'【出演】山田太郎（部）',11:'KEEP'})]]);
  const a=auditRow(rows.get('EP-1'),{now:NOW,pubDate:NOW-3600e3,resolutions:{spotify:{status:'VERIFIED',url:'https://open.spotify.com/episode/new',evidence:['guid']}}});
  const p=proposals('EP-1',rows.get('EP-1'),a,{checkedAt:'t'});
  const x=applyProposals(rows,p,{appliedAt:'t'});assert.equal(x.rows.get('EP-1')[11],'KEEP');assert.equal(x.rows.get('EP-1')[45],'');assert.ok(p.some(q=>q.key==='cast1'&&q.mode==='suggest-only'&&!q.autoApplicable));
  const y=applyProposals(x.rows,p,{appliedAt:'t2'});assert.equal(y.log.length,0);assert.ok(y.skipped.every(s=>['ALREADY_FILLED_NO_OVERWRITE','NOT_AUTO_APPLICABLE'].includes(s.reason)));
  assert.ok(x.log.every(l=>l.old===''&&l.rollback&&l.source));
  const forged=applyProposals(rows,[{epId:'EP-1',col:11,value:'X',autoApplicable:true,verified:true}],{appliedAt:'t'});assert.equal(forged.rows.get('EP-1')[11],'KEEP');
});
const T=(ep,pl,age)=>({key:ep+'|'+pl,epId:ep,platform:pl,pubDate:NOW-age,input:{}});
test('queue order: new arrivals first, then due retries, then capped backfill',()=>{
  const tasks=[T('OLD1','spotify',90*86400e3),T('NEW1','spotify',3600e3),T('RETRY','spotify',3*86400e3),T('OLD2','spotify',80*86400e3)];
  const st={tasks:{'RETRY|spotify':{lastStatus:'NOT_FOUND',nextTryAt:NOW-1}}};
  assert.deepEqual(planQueue(tasks,st,NOW,{backfillLimit:1}).map(t=>t.epId),['NEW1','RETRY','OLD2']);
});
test('429 sets shared cooldown, later tasks of that platform are not called; other platforms continue',async()=>{
  let sp=0,ap=0;const resolvers={spotify:async()=>{sp++;throw new ApiError('429',429,120);},apple:async()=>{ap++;return {status:'VERIFIED',url:'u'};}};
  const r=await runCycle({tasks:[T('A','spotify',1000),T('B','spotify',2000),T('A','apple',1000)],resolvers,now:NOW});
  assert.equal(sp,1);assert.equal(ap,1);assert.equal(r.skipped.some(s=>s.reason==='COOLDOWN'),true);assert.equal(r.state.cooldown.spotify,NOW+120000);
  const r2=await runCycle({tasks:[T('A','spotify',1000)],resolvers,now:NOW+60000,state:r.state});assert.equal(sp,1); // クールダウン中は呼ばない
});
test('5xx backs off exponentially; 3 consecutive trips a 1h cooldown; auth error needs action',async()=>{
  const resolvers={spotify:async()=>{throw new ApiError('5xx',503);}};
  const r=await runCycle({tasks:[1,2,3,4].map(i=>T('E'+i,'spotify',1000*i)),resolvers,now:NOW});
  assert.equal(r.calls,3);assert.ok(r.state.cooldown.spotify>NOW);assert.ok(retryDelayMs({status:'ERROR',attempts:3})>retryDelayMs({status:'ERROR',attempts:1}));
  const a=await runCycle({tasks:[T('A','apple',1000)],resolvers:{apple:async()=>{throw new ApiError('AUTH',401);}},now:NOW});assert.equal(a.results[0].reason,'AUTH_401');
});
test('budget stops safely with a resumable state; resume finishes without re-calling verified tasks (idempotent)',async()=>{
  const calls=[];const resolvers={spotify:async t=>{calls.push(1);return {status:'VERIFIED',url:'u'};}};
  const tasks=[1,2,3,4,5].map(i=>T('E'+i,'spotify',3600e3*i));
  const a=await runCycle({tasks,resolvers,now:NOW,budget:2});assert.equal(a.stopped,'BUDGET_EXHAUSTED');assert.equal(a.calls,2);
  const b=await runCycle({tasks,resolvers,now:NOW,budget:10,state:a.state});assert.equal(b.calls,3);assert.equal(calls.length,5);
  const c=await runCycle({tasks,resolvers,now:NOW,budget:10,state:b.state});assert.equal(c.calls,0);
});
test('new arrival NOT_FOUND is retried within the same day (2h), old ones back off',()=>{
  assert.equal(retryDelayMs({status:'NOT_FOUND',ageMs:3600e3}),2*3600e3);assert.equal(retryDelayMs({status:'NOT_FOUND',ageMs:3*86400e3}),86400e3);assert.equal(retryDelayMs({status:'NOT_FOUND',ageMs:90*86400e3}),7*86400e3);
});
test('extractCast: literal \\n sequences from the sheet export and combined role labels (MC・音源編集) are handled; role words are never names',()=>{
  const a=extractCast('【出演・スタッフ】\\n望月洋嗣（国際報道部次長） https://buff.ly/n \\n冨名腰隆（国際報道部次長） https://bit.ly/4 \\nMC・音源編集 神田大介 https://bit.ly/x \\n【朝ポキ情報】');
  assert.deepEqual(a.names.map(n=>n.slice(0,3)),['望月洋','冨名腰','神田大']);
  const b=extractCast('【出演・スタッフ】 大宮慎次朗（スポーツ部） https://b.ly/G MC・音源編集 岸上渉 https://b.ly/S 【おねがい】');
  assert.deepEqual(b.names,['大宮慎次朗（スポーツ部）','岸上渉']);
  assert.deepEqual(extractCast('【出演・スタッフ】 神田大介（MC、音源編集） https://b.ly/k 【朝ポキ情報】').names,['神田大介（MC、音源編集）']);
});

import {buildDashboard} from '../public/library/quality-dashboard.mjs';
import {linkState,LINK_STATE} from '../public/library/link-state.mjs';
test('N/A does not shrink the denominator; unmeasured columns are never given a rate',()=>{
  const r=row({21:'本文のみ'});const au=auditRow(r,{now:NOW,pubDate:NOW-5*86400e3,showEpisodeCount:499,showCastBlankRate:1,unmeasuredKeys:['related','amazon','pocketcasts','pody']});
  assert.equal(find(au,'amazon').status,'UNMEASURED');
  const d=buildDashboard({episodes:[{id:'a',pubDate:NOW,collectedAt:NOW,review:'unreviewed',audit:au}],now:NOW});
  const cast1=d.columns.find(c=>c.key==='cast1');assert.equal(cast1.HOLD,1);assert.equal(cast1.needsReview,1);
  for(const k of ['related','amazon','pocketcasts','pody']){const c=d.columns.find(x=>x.key===k);assert.equal(c.coverage,'未測定');assert.equal(c.fillRate,null);}
  assert.equal(d.fillRateRequired.total,au.filter(a=>a.tier==='required'&&a.status!=='UNMEASURED').length);
  assert.match(d.scopeNote,/全55列/);
});
test('descClean comes from description-editor and never changes raw; edit holds block auto-fill',()=>{
  const raw='本編です。\\n【出演】山田太郎（部）\\nご意見は xx@asahi.com';const r=row({21:raw});const before=r[21];
  const a=find(auditRow(r,{now:NOW,pubDate:NOW-5*86400e3}),'descClean');assert.equal(r[21],before);
  assert.ok(['FILLABLE_FROM_OFFICIAL','HOLD'].includes(a.status));if(a.status==='FILLABLE_FROM_OFFICIAL')assert.match(a.source,/description-editor/);
});
test('link state maps resolver results to six operational states',()=>{
  const b={platform:'spotify',show:'S',ageHours:100};
  assert.equal(linkState({...b,existingUrl:'u'}).state,LINK_STATE.FETCHED);
  assert.equal(linkState({...b,resolution:{status:'VERIFIED'}}).state,LINK_STATE.FETCHED);
  assert.equal(linkState({...b,resolution:{status:'NOT_FOUND'}}).state,LINK_STATE.NOT_FOUND);
  assert.equal(linkState({...b,ageHours:2,resolution:{status:'NOT_FOUND'}}).state,LINK_STATE.WAITING);
  assert.equal(linkState({...b,resolution:{status:'HOLD',reason:'AMBIGUOUS'}}).state,LINK_STATE.HOLD);
  assert.equal(linkState({...b,unsupported:['spotify']}).state,LINK_STATE.NOT_IMPLEMENTED);
  assert.equal(linkState({...b,notProvided:{spotify:['S']}}).state,LINK_STATE.NOT_PROVIDED);
  assert.equal(linkState({...b,resolution:{status:'NOT_FOUND'},notProvided:{spotify:['other']}}).state,LINK_STATE.NOT_FOUND);
});
test('cast extraction: roles, standalone hiragana names, notes, separators, confidence tier',()=>{
  const x=extractCast('【出演・スタッフ】\n高億翔（スポーツ部）\n水野梓\n音源編集・金澤ひかり\n★イベントのお知らせ');
  assert.deepEqual(x.people.map(p=>p.name),['高億翔','水野梓','金澤ひかり']);
  assert.equal(x.people.find(p=>p.name==='金澤ひかり').role,'音源編集');assert.equal(x.confidence,'review');assert.match(x.notes,/イベント/);
  const y=extractCast('【出演】山田太郎（部）、鈴木一郎（局）');assert.deepEqual(y.people.map(p=>p.name),['山田太郎','鈴木一郎']);assert.equal(y.confidence,'clean');
  assert.equal(extractCast('【出演】淀川テクニック・柴田英昭さん（現代美術家）').names.length,1);
  assert.deepEqual(extractCast('【出演】\nお便りはこちら').names,[]);
});
test('cast proposals stay suggest-only and carry confidence',()=>{
  const r=row({21:'【出演】山田太郎（部）'});const a=auditRow(r,{now:NOW,pubDate:NOW-86400e3*3});const p=proposals('E',r,a,{checkedAt:'t'}).find(q=>q.key==='cast1');
  assert.equal(p.autoApplicable,false);assert.equal(p.mode,'suggest-only');assert.equal(p.confidence,'clean');
});
test('show fixed host: unconfirmed or exceptions-unidentified never becomes a candidate; confirmed+identified excludes exception episodes',()=>{
  const r=row({0:'EP-9',21:'本文のみ'});const base={now:NOW,pubDate:NOW-5*86400e3,showEpisodeCount:499,showCastBlankRate:1};
  const host={name:'神田大介',status:'CONFIRMED_OFFICIAL',evidence:['公式番組情報']};
  assert.equal(find(auditRow(r,{...base,showFixedHost:{...host,status:'ADMIN_STATEMENT_UNVERIFIED'},exceptionsIdentified:true}),'cast1').status,'HOLD');
  const un=find(auditRow(r,{...base,showFixedHost:host,exceptionsIdentified:false}),'cast1');assert.equal(un.status,'HOLD');assert.match(un.hostHint,/一律補完しない/);
  const ok=find(auditRow(r,{...base,showFixedHost:host,exceptionsIdentified:true}),'cast1');assert.equal(ok.status,'FILLABLE_FROM_OFFICIAL');assert.equal(ok.source,'official-show-info');
  const ex=find(auditRow(r,{...base,showFixedHost:host,exceptionsIdentified:true,exceptionEpisodeIds:['EP-9']}),'cast1');assert.equal(ex.status,'HOLD');
  assert.equal(proposals('EP-9',r,[ok],{checkedAt:'t'})[0].autoApplicable,false);
});
