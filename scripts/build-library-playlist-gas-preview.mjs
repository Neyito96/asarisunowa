/** Bundle the SAME pure search implementation for a READ_ONLY GAS entry point. */
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,base),'utf8');
const index=(await read('scripts/library-v3-search-index.mjs')).replace(/export \{buildLibrarySearchIndex,searchLibrary\};?/, 'return {buildLibrarySearchIndex,searchLibrary};');
const core=(await read('scripts/library-v3-playlist-workbench.mjs')).replace(/^import .*;\n/m,'').replace(/export function /g,'function ');
const adapter=`
/** No install, configure, Spotify, mail or sheet writes. Deployment requires approval. */
function previewLibraryPlaylistSelection(options){
 const o=options||{},c=libV3Context_(false),tab=c.ss.getSheetByName('図書館・宇宙 検索対象判定');
 if(!tab)throw Error('Search decision tab missing');
 const values=tab.getRange(1,1,Math.min(tab.getLastRow(),6600),10).getValues();
 const decisions=LibraryPlaylistPreviewCore.decisionsFromSheet(values);
 const episodes=c.rows.map(r=>({epId:String(r[0]),show:String(r[1]),title:String(r[2]),
  publishedAt:r[3] instanceof Date?r[3].toISOString():String(r[3]||''),guid:String(r[6]||''),
  sourceUrl:String(r[32]||r[8]||''),cleanDescription:String(r[22]||''),spotifyUrl:String(r[11]||''),
  humanExcluded:libV2CpBlocked_(r[38]),people:[],identityStatus:'UNVERIFIED',spotifyEvidenceStatus:'UNVERIFIED'}));
 // Nonempty cast/Spotify cells are not upgraded to proof. Exact verification is a separate gate.
 const result=LibraryPlaylistPreviewCore.searchPlaylistLibrary({episodes,decisions,query:o.query||{}});
 const plan=LibraryPlaylistPreviewCore.planLibraryPlaylist({episodes,decisions,query:o.query||{},selectedEpIds:o.selectedEpIds||[],excludedEpIds:o.excludedEpIds||[],playlistId:o.playlistId||'',newPlaylistName:o.newPlaylistName||''});
 Logger.log(JSON.stringify({mode:'READ_ONLY_LIBRARY_PLAYLIST',sourceRows:episodes.length,decisionRows:decisions.length,matches:result.total,ready:plan.ready.length,holds:plan.holds,writes:0,spotifyApiCalls:0}));
 return {search:result,plan,writes:0,spotifyApiCalls:0};
}
`;
await writeFile(new URL('scripts/google-apps-script/LibraryPlaylistPreview.js',base),'// GENERATED: node scripts/build-library-playlist-gas-preview.mjs\nvar LibraryPlaylistPreviewCore=(function(){\nconst {buildLibrarySearchIndex}=(function(){\n'+index+'\n})();\n'+core+'\nreturn {searchPlaylistLibrary,planLibraryPlaylist,decisionsFromSheet};\n})();\n'+adapter);
