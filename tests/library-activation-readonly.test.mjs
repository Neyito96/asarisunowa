// Reported live settings are fixtures, never a claim of remote execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=process.env.LIBRARY_V3_ROOT;
async function fixture(){
 const absolute=resolve(root),{harness,item}=await import(pathToFileURL(join(absolute,'tests/library-v3-harness.mjs')));
 const cwd=process.cwd();let h;try{process.chdir(absolute);h=harness(1);}finally{process.chdir(cwd);}
 vm.runInContext(await readFile(join(absolute,'scripts/google-apps-script/LibraryV3Morning.js'),'utf8'),h.ctx);
 h.props.set('LIB_V3_CONFIG',JSON.stringify({enabled:false,autonomous:true,allowEnrich:false,allowNew:false,spotifyApi:false}));
 h.props.set('LIB_V3_BASELINE',JSON.stringify({offset:6591}));
 vm.runInContext(await readFile(join(absolute,'scripts/google-apps-script/LibraryV3Autonomy.js'),'utf8'),h.ctx);
 return {h,item};
}
test('reported disabled settings stop the existing writer without sheet or property mutations',{skip:!root},async()=>{
 const {h}=await fixture(),before=JSON.stringify(h.table),props=JSON.stringify([...h.props]);
 const r=h.ctx.libV3Run_(true);assert.equal(r.status,'DISABLED');assert.equal(JSON.stringify(h.table),before);assert.equal(JSON.stringify([...h.props]),props);
});
test('offset alone and allowNew false independently hold a new candidate',{skip:!root},async()=>{
 const {h,item}=await fixture(),it=item(1),c=h.ctx.libV3Context_(false),config=h.ctx.libV3Config_();
 const d=h.ctx.libV3NewDecision_(it,{show:'Show'},c,config,{offset:6591});
 assert.ok(d.reasons.includes('baseline_not_registered'));assert.ok(d.reasons.includes('new_registration_not_enabled'));assert.ok(d.reasons.includes('historical_or_invalid_publication'));
});
test('future cutover deliberately excludes existing backlog even after new registration is allowed',{skip:!root},async()=>{
 const {h,item}=await fixture(),it={...item(1),published:'2026-10-21T00:00:00Z'},c=h.ctx.libV3Context_(false);
 const d=h.ctx.libV3NewDecision_(it,{show:'Show'},c,{allowNew:true,newAfter:'2026-10-22T00:00:00Z'},{complete:true,offset:6591});
 assert.ok(d.reasons.includes('historical_or_invalid_publication'));assert.equal(d.eligible,false);
});

test('empty cursor history still reports configured RSS and read-only preview has no mutations',{skip:!root},async()=>{
 const {h}=await fixture(),before=JSON.stringify(h.table),props=JSON.stringify([...h.props]),calls=h.calls;
 const r=h.ctx.previewLibraryV3Autonomy();assert.equal(r.feeds.length,0);assert.equal(r.configuredFeedCount,1);assert.equal(r.configuredFeeds[0].url,'https://rss.test/feed');
 assert.equal(JSON.stringify(h.table),before);assert.equal(JSON.stringify([...h.props]),props);assert.equal(h.calls,calls);
});
test('missing six Spotify helpers do not prevent core RSS registration and replay',{skip:!root},async()=>{
 const {h,item}=await fixture();h.setup();h.ctx.registerLibraryV3BaselineAfterApproval();
 for(const n of ['getAutoPlaylistRuleByKey_','getAutoPlaylistShowIds_','matchesAutoPlaylistRule_','getSpotifyUserAccessToken','assertAutoPlaylistSheetLinkBeforeWrite_','isAutoUpdatePlaylistHumanDeletedV1_'])assert.equal(typeof h.ctx[n],'undefined');
 h.enable({allowNew:true});h.items=[item(1)];assert.equal(h.run(true).status,'SNAPSHOT_READY');const r=h.run(true);assert.equal(r.newIds.length,1);assert.equal(h.data.length,3);h.run(true);assert.equal(h.data.length,3);
});
test('Morning activation without Spotify is blocked by notification, not six Spotify helpers',{skip:!root},async()=>{
 const {h}=await fixture(),before=JSON.stringify([...h.props]);
 assert.throws(()=>h.ctx.configureLibraryV3MorningAfterApproval({enabled:true,spotify:false,ruleKeys:[],since:new Date(Date.now()+60000).toISOString()}),/notification dependency missing/);assert.equal(JSON.stringify([...h.props]),before);
});
