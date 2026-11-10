import test from 'node:test';
import assert from 'node:assert/strict';
import {legacy1007Clean,legacy1007ArticleLinks,legacy1007Crosswalk} from '../scripts/library-v3-legacy1007-cleaner.mjs';
const media='藤田直央編集委員が解説。\\n\\n【関連記事】対中国で意識差（ https://www.asahi.com/articles/ASNB673J3NB6UTFK011.html ）▽官邸主導の外交（ https://www.asahi.com/articles/ASNB96CQVNB9UTFK00V.html ）\\n\\n朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/ ）では他にも様々な番組を配信しています。この番組は2020年10月9日に収録しました。';
test('1007 O format extracts paired article titles and URLs, not podcast landing',()=>{
 const x=legacy1007Clean(media);assert.equal(x.articleCandidates.length,2);
 assert.equal(x.articleCandidates[0].titleCandidate,'対中国で意識差');
 assert.equal(x.articleCandidates[1].titleCandidate,'官邸主導の外交');
 assert.equal(x.articleCandidates[0].titleVerified,false);
 assert.ok(!x.cleaned.includes('他にも様々な番組を配信'));
 assert.ok(x.cleaned.includes('2020年10月9日に収録'));
});
test('O historical cleaned text is not promoted to V raw',()=>{
 const x=legacy1007Crosswalk({legacyO:media,legacyK:'いーむ／ネジロボ（朝日新聞公式配信概要抽出・整理）',identityConfirmed:true,sourceUrl:'https://feeds.example/rss',sourceKind:'OFFICIAL_RSS',rssRaw:''});
 assert.equal(x.rawVProposal,null);assert.equal(x.cleanWProposal,null);
 assert.equal(x.legacy.K,'いーむ／ネジロボ（朝日新聞公式配信概要抽出・整理）');
});
test('RSS canonical raw can propose V/W only if existing V matches or blank',()=>{
 const x=legacy1007Crosswalk({legacyO:media,legacyK:'AI',rssRaw:'公式概要',sourceKind:'OFFICIAL_RSS',sourceUrl:'https://feeds.example/rss',identityConfirmed:true});
 assert.equal(x.rawVProposal,'公式概要');assert.equal(x.cleanWProposal,'公式概要');
 const y=legacy1007Crosswalk({legacyO:media,rssRaw:'新版',existingV:'旧版',sourceKind:'OFFICIAL_RSS',sourceUrl:'https://feeds.example/rss',identityConfirmed:true});
 assert.equal(y.rawVProposal,null);assert.equal(y.cleanWProposal,null);assert.equal(y.rawVersionConflict,true);
});
test('source fallback and uncertain identity are held',()=>{
 assert.equal(legacy1007Crosswalk({legacyO:media,sourceUrl:'https://apple.example/p',sourceKind:'APPLE',identityConfirmed:true}).status,'REVIEW_FALLBACK_ONLY');
 assert.equal(legacy1007Crosswalk({legacyO:media,sourceUrl:'https://example.org',identityConfirmed:false}).status,'HOLD_IDENTITY');
});
test('omny generic podcast links are not classified as related article',()=>assert.equal(legacy1007ArticleLinks('朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/ ）では他にも配信').length,0));
test('unique event notice and article citation remain reviewable, not deleted wholesale',()=>{
 const x=legacy1007Clean('※記者サロン募集は終了。\\n【関連記事】参考（ https://www.asahi.com/articles/ASNA.html ）');
 assert.ok(x.cleaned.includes('※記者サロン募集'));assert.equal(x.articleCandidates.length,1);
});
