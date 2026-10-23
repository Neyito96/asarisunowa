import assert from 'node:assert/strict';
import {planPerformerPlaylistBatch} from '../scripts/library-v3-performer-playlist-batch.mjs';
const id='3dcdCnYyyDuWxSCgNuCKmd';
const episode=(epId,url,personName='小林友花')=>({
 epId,identityStatus:'EXACT',publishedAt:'2026-10-12T04:00:00+09:00',
 people:[{name:personName,role:'出演',evidenceStatus:'VERIFIED',source:'OFFICIAL_RSS'}],
 spotifyUrl:url,spotifyEvidenceStatus:'VERIFIED',
 artworkUrl:'https://example.org/art.jpg',artworkEvidenceStatus:'VERIFIED'
});
const e1=episode('EP-00001','https://open.spotify.com/episode/1234567890123456789012');
const e2=episode('EP-00002','https://open.spotify.com/episode/ABCDEFGHIJABCDEFGHIJKL');
const input={subscriptions:[{personName:'小林友花',playlistId:id,enabled:true,showOnSite:true}],
 episodes:[e1,e2],playlistSnapshots:{[id]:{status:'COMPLETE_VERIFIED',episodeUrls:[e1.spotifyUrl]}},now:'2026-10-18T00:00:00Z'};
const result=planPerformerPlaylistBatch(input);
assert.equal(result.writes,0);
assert.equal(result.plans[0].add.length,1);
assert.equal(result.plans[0].add[0].epId,'EP-00002');
assert.equal(result.plans[0].matchedEpisodeCount,2);
assert.equal(result.plans[0].newRice,true);
assert.equal(result.plans[0].newBadge,true);
assert.equal(result.plans[0].artworkUrl,'https://example.org/art.jpg');
const unavailable=planPerformerPlaylistBatch({...input,playlistSnapshots:{}});
assert.equal(unavailable.plans.length,0);
assert.equal(unavailable.holds[0].reason,'PLAYLIST_SNAPSHOT_UNAVAILABLE');
const missing=planPerformerPlaylistBatch({...input,episodes:[{...e1,spotifyUrl:'',spotifyEvidenceStatus:'UNKNOWN'}],playlistSnapshots:{[id]:{status:'COMPLETE_VERIFIED',episodeUrls:[]}}});
assert.equal(missing.plans[0].add.length,0);
assert.equal(missing.plans[0].holds[0].reason,'SPOTIFY_EPISODE_UNVERIFIED');
const excluded=planPerformerPlaylistBatch({...input,episodes:[{...e1,excluded:true}],playlistSnapshots:{[id]:{status:'COMPLETE_VERIFIED',episodeUrls:[]}}});
assert.equal(excluded.plans[0].add.length,0);
const other=planPerformerPlaylistBatch({...input,subscriptions:[...input.subscriptions,{personName:'神田大介',playlistId:'45Z3QPexcZ9vAF2sausEPg',enabled:true}],playlistSnapshots:{...input.playlistSnapshots,'45Z3QPexcZ9vAF2sausEPg':{status:'COMPLETE_VERIFIED',episodeUrls:[]}}});
assert.equal(other.plans.length,2);
console.log('PASS: read-only performer playlist batch smoke checks');
