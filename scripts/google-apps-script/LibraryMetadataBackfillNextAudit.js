/**
 * LibraryMetadataBackfill V3 — READ ONLY inventory and RSS coverage audit.
 * No writes, no triggers, no Spotify API calls.
 * Run auditLibraryMetadataBackfillNext() in the Phase2 GAS project.
 */
function auditLibraryMetadataBackfillNext() {
  const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  const sh=ss.getSheetByName('エピソード台帳');
  const sources=ss.getSheetByName('取得元一覧');
  if(!sh||!sources)throw Error('Required sheet missing');
  const all=sh.getDataRange().getValues();
  const h=all.shift();
  const cols={id:0,show:1,title:2,guid:6,spotify:11,image:13,audio:14,duration:15,description:21,clean:22,people:23,excluded:38};
  const expected={0:'台帳ID',1:'番組名',2:'タイトル',6:'外部ID',11:'Spotify個別URL',14:'音声URL',21:'概要原文',23:'出演者・スタッフ'};
  Object.keys(expected).forEach(k=>{if(h[Number(k)]!==expected[k])throw Error('Header mismatch '+k);});
  const blank=v=>String(v===null||v===undefined?'':v).trim()==='';
  const guid=v=>{const s=String(v||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return(m?m[1]:s).toLowerCase();};
  const excluded=v=>{const s=String(v||'').trim().toLowerCase();return s!==''&&!['未指定','なし','false','0','no'].includes(s);};
  const summary={mode:'READ_ONLY_LIBRARY_BACKFILL_NEXT',ledgerRows:0,missing:{people:0,spotify:0,description:0,image:0,audio:0,duration:0},byShow:{},rss:{feeds:0,items:0,matchedUnique:0,unregisteredGuidUnique:0,missingDescriptionCandidates:0,missingAudioCandidates:0,missingImageCandidates:0,missingDurationCandidates:0,titleMismatch:0,duplicateGuid:0,excluded:0,feedErrors:[],newSamples:[],descriptionSamples:[]},writes:0};
  const byGuid=new Map();
  all.forEach((r,i)=>{
    if(!String(r[0]||'').startsWith('EP-'))return;
    summary.ledgerRows++;
    const name=String(r[cols.show]||'未分類');
    const s=summary.byShow[name]||(summary.byShow[name]={total:0,missingPeople:0,missingSpotify:0,missingDescription:0,missingAudio:0});
    s.total++;
    [['people',cols.people],['spotify',cols.spotify],['description',cols.description],['image',cols.image],['audio',cols.audio],['duration',cols.duration]].forEach(([k,c])=>{
      if(blank(r[c])){summary.missing[k]++;const label={people:'missingPeople',spotify:'missingSpotify',description:'missingDescription',audio:'missingAudio'}[k];if(label)s[label]++;}
    });
    const key=guid(r[cols.guid]);
    if(key){if(!byGuid.has(key))byGuid.set(key,[]);byGuid.get(key).push({row:i+2,data:r});}
  });
  const feedRows=sources.getDataRange().getValues().slice(1).filter(r=>String(r[7]||'').startsWith('https://')&&!/youtube\.com|youtu\.be/i.test(String(r[7])));
  const unique=new Map();
  feedRows.forEach(r=>unique.set(String(r[7]).trim(),String(r[0]||'')));
  const urls=[...unique.keys()];
  summary.rss.feeds=urls.length;
  const responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true})));
  const seen=new Set(),unregistered=new Set();
  responses.forEach((res,i)=>{
    const feed=unique.get(urls[i]);
    if(res.getResponseCode()!==200){summary.rss.feedErrors.push({feed,http:res.getResponseCode()});return;}
    try{
      const channel=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');
      if(!channel)throw Error('No RSS channel');
      channel.getChildren('item').forEach(item=>{
        summary.rss.items++;
        const key=guid(item.getChildText('guid'));
        if(!key)return;
        const matches=byGuid.get(key)||[];
        if(matches.length===0){
          if(!unregistered.has(key)){
            unregistered.add(key);summary.rss.unregisteredGuidUnique++;
            if(summary.rss.newSamples.length<15)summary.rss.newSamples.push({feed,guid:key,title:String(item.getChildText('title')||'').slice(0,120)});
          }
          return;
        }
        if(matches.length>1){summary.rss.duplicateGuid++;return;}
        const e=matches[0],r=e.data;
        if(seen.has(key))return;
        seen.add(key);summary.rss.matchedUnique++;
        if(excluded(r[cols.excluded])){summary.rss.excluded++;return;}
        const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
        if(norm(r[cols.title])!==norm(item.getChildText('title')))summary.rss.titleMismatch++;
        const description=String(item.getChildText('description')||'').trim();
        if(blank(r[cols.description])&&description){
          summary.rss.missingDescriptionCandidates++;
          if(summary.rss.descriptionSamples.length<15)summary.rss.descriptionSamples.push({id:r[0],row:e.row,feed,chars:description.length});
        }
        if(blank(r[cols.audio])&&item.getChild('enclosure')?.getAttribute('url'))summary.rss.missingAudioCandidates++;
        const image=item.getChildren().find(n=>n.getName()==='image'&&n.getNamespace().getPrefix()==='itunes');
        if(blank(r[cols.image])&&image?.getAttribute('href'))summary.rss.missingImageCandidates++;
        const duration=item.getChildren().find(n=>n.getName()==='duration'&&n.getNamespace().getPrefix()==='itunes');
        if(blank(r[cols.duration])&&duration?.getText())summary.rss.missingDurationCandidates++;
      });
    }catch(e){summary.rss.feedErrors.push({feed,error:String(e)});}
  });
  Logger.log(JSON.stringify(summary));
  return summary;
}
