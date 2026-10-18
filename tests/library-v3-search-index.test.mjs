import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLibrarySearchIndex,searchLibrary} from '../scripts/library-v3-search-index.mjs';
const source={
 episodes:[
  {epId:'EP-00001',show:'MEDIA TALK',title:'報道とAI',cleanDescription:'新聞を考える',cast:['神田大介'],seriesIds:['S-1'],published:'2026-10-17',identityStatus:'EXACT',spotifyUrl:'https://open.spotify.com/episode/demo',audioUrl:'https://example.org/audio.mp3'},
  {epId:'EP-00002',show:'ニュースの学校',title:'気候の授業',cast:['記者B'],seriesIds:['S-2'],published:'2026-10-18',identityStatus:'EXACT'},
  {epId:'EP-00003',show:'ニュースの学校',title:'未確定',cast:['神田大介'],identityStatus:'HELD'},
  {epId:'EP-00004',show:'MEDIA TALK',title:'削除済み',cast:['神田大介'],identityStatus:'EXACT',deleted:true}
 ],
 series:[{seriesId:'S-1',title:'メディアとAI'},{seriesId:'S-2',title:'授業シリーズ'}],
 themes:[{themeId:'T-1',label:'AIと社会',active:true}],
 episodeThemes:[{epId:'EP-00001',themeId:'T-1',status:'EDITOR_APPROVED'},{epId:'EP-00002',themeId:'T-1',status:'SUGGESTED'}]
};
test('cast searches only exact identity and preserves Spotify as a link, not a search dependency',()=>{
 const idx=buildLibrarySearchIndex(source),res=searchLibrary(idx,{mode:'cast',query:'神田大介'});
 assert.equal(res.total,1);assert.equal(res.results[0].epId,'EP-00001');
 assert.equal(res.spotifyApiCalls,0);assert.equal(res.results[0].audioReachability,'UNVERIFIED');
});
test('theme tab relation requires approval',()=>{
 const res=searchLibrary(buildLibrarySearchIndex(source),{mode:'theme',query:'AIと社会'});
 assert.equal(res.total,1);assert.equal(res.results[0].epId,'EP-00001');
});
test('series and theme search work independently',()=>{
 const idx=buildLibrarySearchIndex(source);
 assert.equal(searchLibrary(idx,{mode:'series',query:'授業'}).results[0].epId,'EP-00002');
 assert.equal(searchLibrary(idx,{mode:'all',query:'AIと社会'}).total,1);
});
test('invalid theme relationship is held, not written',()=>{
 const idx=buildLibrarySearchIndex({...source,episodeThemes:[{epId:'EP-99',themeId:'T-1',status:'VERIFIED'}]});
 assert.equal(idx.holds.length,1);assert.equal(idx.writes,0);
});
test('duplicate EP-ID is held',()=>{
 const idx=buildLibrarySearchIndex({...source,episodes:[source.episodes[0],source.episodes[0]]});
 assert.equal(idx.holds.length,1);
});
