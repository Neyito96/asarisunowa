import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../scripts/google-apps-script/LibraryV3.js', import.meta.url),'utf8');
const sandbox={libV2CpHash_:x=>'testhash_'+String(x).length};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
test('1007 historical inline podcast promotion is removed, article and date remain',()=>{
 const raw='藤田直央編集委員が解説。\n【関連記事】記事名（ https://www.asahi.com/articles/ASNB673J3NB6UTFK011.html ）\n朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/ ）では他にも様々な番組を配信しています。この番組は2020年10月9日に収録しました。';
 const r=sandbox.libV3ContentClean_(raw,'MEDIA TALK');
 assert.ok(!r.text.includes('他にも様々な番組を配信'));
 assert.ok(r.text.includes('2020年10月9日に収録'));
 assert.ok(r.text.includes('ASNB673J3NB6UTFK011.html'));
 assert.equal(r.removed.filter(x=>x.rule==='legacy1007_cross_promo').length,1);
 const a=sandbox.libV3RelatedArticleCandidates_(raw);
 assert.equal(a.length,1);
 assert.equal(a[0].titleCandidate,'記事名');
 assert.equal(a[0].titleVerified,false);
});
test('▽ separates multiple references and excludes generic podcasts landing',()=>{
 const raw='【関連記事】記事A（ https://www.asahi.com/articles/AA.html ）▽記事B（ https://www.asahi.com/articles/BB.html ）\\n朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/ ）';
 const refs=sandbox.libV3RelatedArticleCandidates_(raw);
 assert.equal(refs.length,2);
 assert.deepEqual(Array.from(refs,x=>x.titleCandidate),['記事A','記事B']);
});
test('older RSS content clean preserves an unrelated episode event',()=>{
 const r=sandbox.libV3ContentClean_('イベントの内容を記者に聞きました。','ニュースの現場から');
 assert.ok(r.text.includes('イベントの内容'));
});
