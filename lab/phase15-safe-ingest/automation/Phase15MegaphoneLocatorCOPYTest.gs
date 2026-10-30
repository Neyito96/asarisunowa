// COPY-only candidate. Do not deploy alongside the production Phase15 bundle.
// Pure helper; requires complete RSS identity to accept blank item.link.
function p15MegaphoneVerifiedLocator(x) {
  var show=String(x.show||''),source=String(x.source||''),link=String(x.link||'').trim(),audio=String(x.audio||'');
  var omny=/^https:\/\/(?:www\.)?omny\.fm\/shows\/[^/?#]+\/[^/?#]+(?:[?#].*)?$/.test(link)&&!/\/playlists\//.test(link);
  if(omny&&/^https:\/\/www\.omnycontent\.com\/d\/playlist\//.test(source))return {ok:true,mode:'OFFICIAL_PAGE',url:link};
  if(link)return {ok:false,reason:'OFFICIAL_EPISODE_URL_MISSING_OR_UNVERIFIED'};
  var feeds={'ニュースの学校':'https://feeds.megaphone.fm/TASC5851398719','報談':'https://feeds.megaphone.fm/TASC9421488254'};
  if(!Object.prototype.hasOwnProperty.call(feeds,show)||source!==feeds[show])return {ok:false,reason:'UNTRUSTED_MEGAPHONE_SOURCE'};
  if(!/^https:\/\/(?:pdst\.fm\/e\/)?traffic\.megaphone\.fm\/TASC[0-9]+\.mp3(?:\?[^#]*)?$/.test(audio))return {ok:false,reason:'MEGAPHONE_ENCLOSURE_UNVERIFIED'};
  if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(String(x.guid||''))||!String(x.title||'').trim()||!Number.isFinite(Date.parse(String(x.published||''))))return {ok:false,reason:'INVALID_SOURCE_IDENTITY'};
  return {ok:true,mode:'RSS_ENCLOSURE_ONLY',url:''};
}
function p15MegaphoneLocatorSmokeTest() {
  var x={show:'ニュースの学校',source:'https://feeds.megaphone.fm/TASC5851398719',guid:'4ea6480a-ccfd-11f1-b2de-17a1ce8dc9d8',title:'民主社会主義',published:'Wed, 28 Oct 2026 19:00:00 -0000',link:'',audio:'https://pdst.fm/e/traffic.megaphone.fm/TASC8521584315.mp3'};
  var checks=[
    ['realSchool',x,true],
    ['realSchool2',Object.assign({},x,{guid:'0db36344-8fce-11f1-b526-87dbf0a47201',title:'AI主権',audio:'https://pdst.fm/e/traffic.megaphone.fm/TASC1071094913.mp3'}),true],
    ['realHodan',Object.assign({},x,{show:'報談',source:'https://feeds.megaphone.fm/TASC9421488254',guid:'ca61c8a4-d36d-11f1-ae7a-97b9e64c5d86',title:'VIVANT、モンゴル火災、福田康夫氏死去',audio:'https://pdst.fm/e/traffic.megaphone.fm/TASC1085000418.mp3'}),true],
    ['wrongShow',Object.assign({},x,{show:'報談'}),false],
    ['wrongSource',Object.assign({},x,{source:'https://feeds.megaphone.fm/other'}),false],
    ['badAudio',Object.assign({},x,{audio:'https://example.com/a.mp3'}),false],
    ['missingAudio',Object.assign({},x,{audio:''}),false],
    ['untrustedLink',Object.assign({},x,{link:'https://example.com/episode'}),false],
    ['badGuid',Object.assign({},x,{guid:'bad'}),false],
    ['emptyTitle',Object.assign({},x,{title:''}),false],
    ['badDate',Object.assign({},x,{published:'invalid'}),false],
    ['omnyEpisode',Object.assign({},x,{show:'ニュースの現場から',source:'https://www.omnycontent.com/d/playlist/example',link:'https://omny.fm/shows/asahi/episode'}),true],
    ['omnyPlaylist',Object.assign({},x,{show:'ニュースの現場から',source:'https://www.omnycontent.com/d/playlist/example',link:'https://omny.fm/shows/asahi/playlists/podcast'}),false]
  ];
  return checks.map(function(q){var actual=p15MegaphoneVerifiedLocator(q[1]);return {test:q[0],passed:actual.ok===q[2],result:actual};});
}
