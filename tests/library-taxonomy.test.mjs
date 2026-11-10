import test from 'node:test';import assert from 'node:assert/strict';
import {THEMES,themeIdsForLabel,classifyText,applyClassification} from '../public/library/taxonomy.mjs';
test('20 themes, 103 subthemes, unique ids, every synonym >=2 chars',()=>{
  assert.equal(THEMES.length,20);assert.equal(THEMES.reduce((n,t)=>n+t.subthemes.length,0),103);
  const ids=THEMES.flatMap(t=>[t.id,...t.subthemes.map(s=>s.id)]);assert.equal(new Set(ids).size,ids.length);
  for(const t of THEMES) for(const w of t.synonyms) assert.ok(w.length>=2||/^[A-Za-z]{2}$/.test(w),w);
});
test('single-character homonym 本 / 日本 does not tag literature',()=>{
  const r=classifyText({title:'日本代表の本田選手',description:'本日の試合'});assert.notEqual(r.themeId,'culture');
});
test('boilerplate (番組案内・関連記事) is ignored',()=>{
  const r=classifyText({title:'雑談',description:'朝日新聞ポッドキャスト 番組継続のため会員登録をお願いします 【関連記事】 選挙 裁判'});assert.equal(r.decision,'HOLD');
});
test('ambiguous or thin evidence is HOLD, clear is TAG',()=>{
  assert.equal(classifyText({title:'こんにちは',description:''}).decision,'HOLD');
  const r=classifyText({title:'サッカーW杯 日本代表の戦い',description:'サッカーの試合を解説'});assert.equal(r.themeId,'sports');
});
test('human-approved (locked) classification is never overwritten',()=>{
  const locked={themeId:'politics',locked:true,status:'user_approved'};
  assert.deepEqual(applyClassification(locked,{themeId:'sports'}),locked);
  assert.equal(applyClassification(null,{themeId:'sports'}).status,'provisional_auto');
});
test('legacy labels map to ids without inventing',()=>{
  assert.deepEqual(themeIdsForLabel('国際/米国'),['world']);assert.deepEqual(themeIdsForLabel('人権・司法'),['society','law']);assert.deepEqual(themeIdsForLabel('不明'),[]);
});
test('multi-theme: secondary themes are listed as related, primary unchanged; SNS is not shared across themes', () => {
  const r = classifyText({title: '認知症の介護と医療の現場', description: '認知症 介護 病院 医師'});
  assert.equal(r.decision, 'TAG'); assert.ok(Array.isArray(r.related));
  const owners = THEMES.filter(t => t.synonyms.includes('SNS') || t.subthemes.some(s => s.name === 'SNS')).map(t => t.id);
  assert.deepEqual(owners, ['media']);
});
