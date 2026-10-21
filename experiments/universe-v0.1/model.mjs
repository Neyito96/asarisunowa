// Sample navigation, never a canonical count or inferred performer database.
export const topics={社会:['社会','警察','裁判','事件','人権'],暮らし:['学校','英語','子ども','家族','暮らし'],世界:['世界','中国','米国','キューバ','戦争'],文化:['写真','映像','音楽','映画','本','文化'],科学:['科学','宇宙','気候','温暖化','AI'],仕事:['仕事','経済','企業','働','新聞']};
export function monthJst(value){
 const t=Date.parse(value);if(!Number.isFinite(t))return null;
 const month=new Date(t+9*3600000).toISOString().slice(0,7);
 return /^(202[0-6])-\d\d$/.test(month)?month:null;
}
export function topicEvidence(episode){
 // Title evidence only: descriptions and cast have unresolved ad/name quality.
 return Object.entries(topics).flatMap(([topic,words])=>words.filter(w=>episode.title.includes(w)).map(word=>({topic,word,field:'title',confidence:'candidate',sourceId:episode.id})));
}
export function validateSample(data){
 if(data.schema!=='universe-strata/0.1'||data.populationStatus!=='AUDIT_PENDING'||data.canonicalTotal!==null)throw Error('Unresolved population must not be presented as final');
 const ids=new Set();for(const e of data.episodes){if(!/^EP-\d{5}$/.test(e.id)||ids.has(e.id)||e.month!==monthJst(e.date))throw Error('Invalid episode identity/date');ids.add(e.id);}
 return data;
}
export function selectSamples(episodes){
 const chosen=[];
 for(let year=2020;year<=2026;year++){
  const rows=episodes.filter(e=>monthJst(e.date)?.startsWith(String(year))&&topicEvidence(e).length).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const byMonth=new Set();for(const e of rows){const month=monthJst(e.date);if(byMonth.has(month))continue;byMonth.add(month);chosen.push({id:e.id,title:e.title,show:e.show,date:e.date,month,topics:topicEvidence(e),peopleStatus:'UNVERIFIED_NOT_DERIVED',relatedStatus:'NOT_IMPORTED_IN_TITLE_SAMPLE'});if(byMonth.size>=4)break;}
 }
 return chosen;
}
export function browse(data,{month='',topic='',query=''}={}){
 return data.episodes.filter(e=>(!month||e.month===month)&&(!topic||e.topics.some(t=>t.topic===topic))&&(!query||e.title.normalize('NFKC').toLowerCase().includes(query.normalize('NFKC').toLowerCase())));
}
export function libraryLink(id){if(!/^EP-\d{5}$/.test(id))throw Error('Invalid EP-ID');return 'https://neyito96.github.io/asarisunowa/library/?ep='+id;}
