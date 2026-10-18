import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness,guid} from './library-v3-harness.mjs';
test('quality audit reports all columns and old news without modifying values or properties',()=>{
 const h=harness(3);h.rows[0][1]='ニュースの現場から';h.rows[0][3]='2020/08/06';h.rows[0][21]='<p>Original https://example.test</p>';h.rows[0][22]='Human summary';
 h.rows[1][1]='ニュースの現場から';h.rows[1][3]='2021/01/01';h.rows[2][3]='invalid';h.rows[0][18]='再生可能';
 h.props.set('LIB_V3_BASELINE','{"offset":6591,"complete":true}');
 const before=JSON.stringify(h.table),props=[...h.props];const deny=()=>{throw Error('Forbidden side effect');};
 h.ctx.PropertiesService={getScriptProperties:deny};h.ctx.UrlFetchApp={fetch:deny};h.ctx.CacheService={getScriptCache:deny};h.ctx.ScriptApp={newTrigger:deny};
 const r=h.ctx.previewLibraryV3QualityAudit();assert.equal(r.rows,3);assert.equal(r.byShowField.length,102);assert.equal(r.oldNews.length,2);
 assert.equal(r.oldNews[0].cleanRelation,'DIFFERENT_REVIEW_NOT_OVERWRITE');assert.equal(r.oldNews[1].cleanRelation,'RAW_MISSING');
 assert.equal(r.audio.playbackLabelPresent,1);assert.equal(r.audio.httpEvidenceCurrent,0);assert.equal(r.playbackVerifiedByThisAudit,false);
 assert.equal(JSON.stringify(h.table),before);assert.deepEqual([...h.props],props);assert.equal(h.calls,0);assert.equal(h.cache.size,0);
});
test('duplicate GUID, tombstone and stale HTTP evidence remain distinct',()=>{
 const h=harness(2);h.setup();h.rows.forEach(r=>r[6]=guid(9));h.rows[0][14]='https://audio.test/new';h.ex.push([guid(9),'']);
 h.ctx.libV3StatePut_(h.ctx.libV3Context_(true),['EP-00001','audioHttp','VERIFIED',guid(9),'','',h.ctx.libV3Hash_('https://audio.test/old'),'external_probe_not_playback','2026-10-17','{}']);
 const r=h.ctx.previewLibraryV3QualityAudit();assert.equal(r.duplicateGuids.length,1);assert.equal(r.missing.excluded,2);assert.equal(r.exclusionHistoryRows,1);assert.equal(r.audio.httpEvidenceStale,1);assert.equal(r.audio.httpEvidenceCurrent,0);
});
test('issue 227 observed no-mirai #9 matches existing title rule; root cause must not be presumed',()=>{
 const h=harness(1);vm.runInContext(fs.readFileSync('scripts/google-apps-script/PlaylistAutoRules.js','utf8'),h.ctx);
 const rule=h.ctx.getAutoPlaylistRuleByKey_('no-mirai');assert.ok(rule);
 assert.equal(h.ctx.matchesAutoPlaylistRule_({id:'13zpJygdFNMMi6WtHbkocV',name:'（ノーミライ #9）ひとりでやっとるチキンレースにライバル登場？というお話'},rule),true);
 assert.equal(h.calls,0);
});
