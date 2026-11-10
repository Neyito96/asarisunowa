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
  assert.equal(find(a,'cast1').status,'FILLABLE_FROM_OFFICIAL');assert.equal(find(a,'cast2').status,'NOT_APPLICABLE');
  assert.equal(find(a,'apple').status,'NOT_YET_PUBLISHED');assert.equal(find(a,'descClean').status,'FILLABLE_FROM_OFFICIAL');
  assert.ok(!proposals('EP-1',r,a,{checkedAt:'t'}).some(p=>p.key==='spotify'));
});
test('old blank after grace with NOT_FOUND is HOLD (never guessed); show that never lists cast is NOT_APPLICABLE',()=>{
  const r=row({21:'本文のみ'});
  const a=auditRow(r,{now:NOW,pubDate:NOW-5*86400e3,resolutions:{spotify:{status:'NOT_FOUND'}},showEpisodeCount:499,showCastBlankRate:1});
  assert.equal(find(a,'spotify').status,'HOLD');assert.equal(find(a,'spotify').reason,'NOT_FOUND_AFTER_GRACE');assert.equal(find(a,'cast1').reason,'SHOW_NEVER_LISTS_CAST');
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
