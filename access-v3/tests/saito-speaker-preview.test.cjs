const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {test}=require('node:test');

function ctx(){
  const c={console,Set,Map,JSON,Math,Number,String,Array,Object,RegExp,Error,
    ASAHI_PRIMARY_SHOW_IDS:['show-a','show-b']};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync('candidate/PlaylistAutoSpeakerSafeV2.js','utf8'),c);
  vm.runInContext(fs.readFileSync('access-v3/src/SpotifySpeakerV3Preview.js','utf8'),c);
  return c;
}

test('Saito speaker preview confirms explicit appearance context',()=>{
  const c=ctx();
  const out=c.previewSaitoSpeakerEpisodeV3_({
    id:'3Qhcx3wDl9anbIiGQsaCDk',
    name:'予測してみたい',
    description:'出演：斎藤健一郎記者。キナバルと富士山について話します。',
    html_description:''
  });
  assert.equal(out.spotifyWrite,false);
  assert.equal(out.playlistId,'7FBbaBPpGDSJUIXN4L2iYi');
  assert.equal(out.classification,'confirmed');
});

test('Saito speaker preview does not confirm title-only mention',()=>{
  const c=ctx();
  const out=c.previewSaitoSpeakerEpisodeV3_({
    id:'title-only',
    name:'斎藤健一郎記者に聞く',
    description:'出演者の記載はありません。',
    html_description:''
  });
  assert.notEqual(out.classification,'confirmed');
});

test('Saito write adapter remains fail-closed until human decision path is verified',()=>{
  const c=ctx();
  assert.throws(()=>c.sp3SaitoSpeakerWriteAdapterV3_(),/SP3_FATAL:SPEAKER_HUMAN_DECISION_PATH_UNVERIFIED/);
});
