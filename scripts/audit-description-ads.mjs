// READ_ONLY host harness for the existing GAS V5 parser, not a second cleaner/writer.
import vm from 'node:vm';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {editDescription} from '../public/library/description-editor.mjs';
export async function loadExistingAdParser(){
 const source=await readFile(new URL('./google-apps-script-library-ad-cleaning-audit.gs',import.meta.url),'utf8');
 const context=vm.createContext({});vm.runInContext(source,context);
 return text=>context.RISU_adSections_(text);
}
const names=['寺下真理加','太田匡彦','佐藤陽','高橋健一郎','斎藤健一郎'];
const urls=text=>new Set([...String(text).matchAll(/https?:\/\/[^\s<>「」『』（）()"']+/g)].map(m=>m[0]));
export function auditAdRows(source,parse,publicEpisodes=[]){
 for(const [i,h]of [[0,'台帳ID'],[21,'概要原文'],[22,'概要清掃済み']])if(source.headers[i]!==h)throw Error('Unexpected header '+h);
 const selected={proposed:0,held:0,overlap:0,rawNameHits:0,cleanNameHits:0},raw={proposed:0,held:0,overlap:0,articleUrlLoss:0};
 const focus=[],privatePreviews=[];const publicById=new Map(publicEpisodes.map(e=>[e.id,e]));
 for(const row of source.rows){
  const before=String(row[22]||row[21]||''),original=String(row[21]||'');
  const v5=parse(before),fromRaw=parse(original),change=!!v5.removed&&v5.cleaned!==before,rawChange=!!fromRaw.removed&&fromRaw.cleaned!==original;
  selected.proposed+=+change;selected.held+=+v5.held;selected.overlap+=+(change&&v5.held);
  selected.rawNameHits+=+names.some(n=>original.includes(n));selected.cleanNameHits+=+names.some(n=>before.includes(n));
  raw.proposed+=+rawChange;raw.held+=+fromRaw.held;raw.overlap+=+(rawChange&&fromRaw.held);
  const relatedUrls=fromRaw.related.flatMap(s=>[...urls(s)]),lost=relatedUrls.filter(u=>!fromRaw.cleaned.includes(u));raw.articleUrlLoss+=lost.length;
  const sectioned=editDescription(fromRaw.cleaned,{relatedUrls});
  if(change||rawChange)privatePreviews.push({id:row[0],before,original,selected:v5,raw:fromRaw,sectioned,reviewRequired:true});
  if(['EP-03365','EP-05247','EP-00036','EP-00068'].includes(row[0])){
   const pub=publicById.get(row[0]);focus.push({id:row[0],title:row[2],selected:{proposed:change,held:v5.held},raw:{proposed:rawChange,held:fromRaw.held,relatedUrlCount:relatedUrls.length,lostRelatedUrls:lost.length,bodyNonempty:!!sectioned.description,sectionHolds:sectioned.holds},public:pub?{descriptionNames:names.filter(n=>pub.description.includes(n)),castNames:names.filter(n=>pub.cast.includes(n)),titleNames:names.filter(n=>pub.title.includes(n))}:null});
  }
 }
 return {report:{mode:'READ_ONLY_EXISTING_V5_REAUDIT',observedRows:source.rows.length,selectedCleanFallback:selected,rawBoundaryDiagnostic:raw,focus,sourceHash:createHash('sha256').update(JSON.stringify(source.rows)).digest('hex'),interpretation:'Proposed and held overlap. Raw diagnostics are not approved replacements. Counts describe this snapshot, not a canonical population.',writes:0},privatePreviews};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [sourcePath,outputDir,privatePath]=process.argv.slice(2);if(!sourcePath||!privatePath)throw Error('Usage: PRIVATE_SOURCE OUTPUT_DIR PRIVATE_PREVIEWS');
 const root=resolve(new URL('..',import.meta.url).pathname);if(resolve(privatePath).startsWith(root+'/'))throw Error('Raw previews must stay outside repository');
 const source=JSON.parse(await readFile(sourcePath,'utf8')),manifest=JSON.parse(await readFile('public/library/data/manifest.json','utf8'));
 const episodes=[];for(const n of [0,1,67,104])episodes.push(...JSON.parse(await readFile(`public/library/data/details/${n}.json`,'utf8')));
 const {report,privatePreviews}=auditAdRows(source,await loadExistingAdParser(),episodes);report.publicVersion=manifest.version;
 await mkdir(outputDir,{recursive:true});await writeFile(outputDir+'/ad-reaudit.json',JSON.stringify(report,null,2)+'\n');await writeFile(privatePath,JSON.stringify(privatePreviews));console.log(JSON.stringify(report));
}
