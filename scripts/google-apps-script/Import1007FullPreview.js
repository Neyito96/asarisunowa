/** 1007 snapshot -> episode library. Read-only planning, NO sheet writes.
 * Source: user's private 1007 copy; target: isolated test ledger.
 * Never use this script against production or the shared community sheet.
 */
const IMPORT1007_SOURCE_ID = '1lJF11Xpx9cz9RLuuJsvl0zV9E5Fpg7I7XreB2R6wS7o';
const IMPORT1007_TEST_ID = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const IMPORT1007_SHOWS = [
  ['ニュースの現場から','ニュースの現場から'],
  ['メディアトーク','MEDIA TALK'],
  ['ドーナツ','ドーナツ'],
  ['スポンジ','スポンジ'],
  ['SDGs','こどもそうだんしつ'],
  ['報談','報談'],
  ['ニュースの学校','ニュースの学校']
];
function runImport1007FullPreview() {
  const src = SpreadsheetApp.openById(IMPORT1007_SOURCE_ID);
  const dst = SpreadsheetApp.openById(IMPORT1007_TEST_ID);
  const ledger = dst.getSheetByName('エピソード台帳');
  const exclusion = dst.getSheetByName('削除・除外履歴');
  if (!ledger || !exclusion) throw new Error('Missing test ledger or exclusions');
  const rows = ledger.getDataRange().getValues();
  const header = rows.shift().map(String);
  const index = Object.fromEntries(header.map((h,i)=>[h,i]));
  const byUrl = new Map(), bySpotify = new Map(), byShowTitle = new Map();
  function norm(v) { return String(v == null ? '' : v).trim(); }
  function key(show,title) { return show + '|' + norm(title).normalize('NFKC').replace(/\\s+/g,' ').toLowerCase(); }
  function urlKey(v) { return norm(v).replace(/\\/$/,''); }
  rows.forEach((r,i)=>{
    const show=norm(r[index['番組名']]), id=norm(r[index['台帳ID']]);
    const url=urlKey(r[index['元ページURL']]);
    const spotify=urlKey(r[index['Spotify個別URL']]);
    if(url) { const k=show+'|'+url; if(!byUrl.has(k))byUrl.set(k,[]); byUrl.get(k).push(i); }
    if(spotify) { if(!bySpotify.has(spotify))bySpotify.set(spotify,[]); bySpotify.get(spotify).push(i); }
    const k=key(show,r[index['タイトル']]); if(!byShowTitle.has(k))byShowTitle.set(k,[]); byShowTitle.get(k).push(i);
  });
  const excludedRows = exclusion.getLastRow()>1 ? exclusion.getRange(2,1,exclusion.getLastRow()-1,9).getValues() : [];
  const excludedUrls = new Set(excludedRows.map(r=>urlKey(r[1])).filter(Boolean));
  const summary={mode:'READ_ONLY',source:'COPY_1007',ledgerRows:rows.length,exclusionRows:excludedRows.length,shows:[],totals:{sourceRows:0,uniqueMatches:0,newCandidates:0,held:0,spotifyFilled:0,asahiFilled:0,pocketFilled:0,descriptionFilled:0}};
  IMPORT1007_SHOWS.forEach(([tab,show])=>{
    const sh=src.getSheetByName(tab); if(!sh)throw new Error('Missing source tab: '+tab);
    const data=sh.getDataRange().getValues().slice(1);
    const stat={sourceTab:tab,show,sourceRows:0,uniqueMatches:0,newCandidates:0,held:0,spotifyFilled:0,asahiFilled:0,pocketFilled:0,descriptionFilled:0,heldSamples:[]};
    data.forEach((r,ri)=>{
      const url=urlKey(r[0]),title=norm(r[2]);
      if(!/^https:\/\/(omny\\.fm|www\\.omnycontent\\.com)\//.test(url)||!title)return;
      stat.sourceRows++;
      const spotify=norm(r[11]),asahi=norm(r[12]),pocket=norm(r[13]),desc=norm(r[14]);
      if(spotify)stat.spotifyFilled++;
      if(asahi)stat.asahiFilled++;
      if(pocket)stat.pocketFilled++;
      if(desc)stat.descriptionFilled++;
      const matches=byUrl.get(show+'|'+url)||[];
      const spMatches=spotify?(bySpotify.get(spotify)||[]):[];
      const titleMatches=byShowTitle.get(key(show,title))||[];
      let chosen=null;
      if(matches.length===1)chosen=matches[0];
      else if(matches.length>1){stat.held++;if(stat.heldSamples.length<5)stat.heldSamples.push({row:ri+2,reason:'URL_MULTIPLE'});return;}
      else if(spMatches.length===1 && norm(rows[spMatches[0]][index['番組名']])===show)chosen=spMatches[0];
      else if(spMatches.length>1){stat.held++;if(stat.heldSamples.length<5)stat.heldSamples.push({row:ri+2,reason:'SPOTIFY_MULTIPLE'});return;}
      else if(titleMatches.length===1)chosen=titleMatches[0];
      else if(titleMatches.length>1){stat.held++;if(stat.heldSamples.length<5)stat.heldSamples.push({row:ri+2,reason:'TITLE_MULTIPLE'});return;}
      if(chosen===null){
        if(excludedUrls.has(url)){stat.held++;if(stat.heldSamples.length<5)stat.heldSamples.push({row:ri+2,reason:'EXCLUDED'});}
        else stat.newCandidates++;
      }else{
        const target=rows[chosen];
        if(norm(target[index['人間除外']]) && !['未指定','false','0','なし'].includes(norm(target[index['人間除外']]).toLowerCase())){stat.held++;return;}
        stat.uniqueMatches++;
      }
    });
    summary.shows.push(stat);
    for(const k of Object.keys(summary.totals))summary.totals[k]+=stat[k]||0;
  });
  Logger.log(JSON.stringify(summary));return summary;
}
