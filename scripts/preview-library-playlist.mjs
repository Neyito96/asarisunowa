/** node scripts/preview-library-playlist.mjs PRIVATE_INPUT.json PRIVATE_PREVIEW.json */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {planLibraryPlaylist,searchPlaylistLibrary,decisionsFromSheet} from './library-v3-playlist-workbench.mjs';
export function previewLibraryPlaylist(input){
 const decisions=input.decisionValues?decisionsFromSheet(input.decisionValues):input.decisions||[];
 return {search:searchPlaylistLibrary({...input,decisions}),plan:planLibraryPlaylist({...input,decisions}),writes:0,spotifyApiCalls:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [, ,src,dst]=process.argv;if(!src||!dst)throw Error('INPUT_AND_NEW_OUTPUT_REQUIRED');
 const output=previewLibraryPlaylist(JSON.parse(await readFile(src,'utf8')));await writeFile(dst,JSON.stringify(output,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({matches:output.search.total,ready:output.plan.ready.length,holds:output.plan.holds.length,writes:0,spotifyApiCalls:0}));
}
