import{readFile,writeFile}from'node:fs/promises';
import{libraryCandidate,latencyMetrics}from'../public/library/workflow-state.mjs';
import{publicEpisode,blocked}from'../lib/library-public.mjs';
const [privateDir]=process.argv.slice(2);if(!privateDir)throw Error('Private snapshots required');
const source=JSON.parse(await readFile(privateDir+'/preview-source.json','utf8'));
const tabs=JSON.parse(await readFile(privateDir+'/theme-rows.json','utf8'));
const rules=[{name:'中南米',keywords:['中南米','南米','キューバ','ブラジル','メキシコ','ベネズエラ','アルゼンチン','チリ','ペルー']},{name:'北欧',keywords:['北欧','スウェーデン','フィンランド','ノルウェー','デンマーク','アイスランド']}];
const result={mode:'LOCAL_DRAFT_PROTOTYPE',generatedAt:new Date().toISOString(),metrics:latencyMetrics([]),themes:[]};
for(const rule of rules){const history=tabs[rule.name].slice(1);const candidates=[];let excluded=0;
 for(const row of source.rows){if(blocked(row[38])||['アルキキ','AJW'].includes(row[1]))continue;
  const ep=publicEpisode(row),edit=source.descriptionEdits?.[ep.id];if(edit){ep.description=edit.description;ep.relatedArticles=edit.relatedArticles;}ep.spotifyUrl=row[11];
  const spotify=String(row[11]||'').match(/\/episode\/([A-Za-z0-9]{22})/)?.[1];
  const decisions=history.filter(h=>h[1]===spotify||String(h[4]).normalize('NFKC')===String(row[2]).normalize('NFKC')).map(h=>h[8]);
  // Conflicting/historical human exclusions always win in this proposal-only view.
  const human=decisions.includes('除外')?'除外':decisions.includes('保留')?'保留':decisions.includes('採用')?'採用':'';
  const proposal=libraryCandidate(ep,rule,human);if(proposal.reason==='HUMAN_DECISION'){excluded++;continue;}
  if(proposal.eligible)candidates.push({id:ep.id,title:ep.title,show:ep.show,date:ep.date,matched:proposal.matched,decision:human||'未確認',proposalOnly:true});
 }
 result.themes.push({name:rule.name,excludedByHuman:excluded,total:candidates.length,candidates:candidates.slice(0,40)});
}
await writeFile('public/library/editor-candidates.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.themes.map(t=>({name:t.name,total:t.total,excludedByHuman:t.excludedByHuman}))));
