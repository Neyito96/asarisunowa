#!/usr/bin/env node
// READ_ONLY/COPY 模擬: 実GUIDの時系列を日ごとに再生し、日次増分(冪等・件数増加・状態分離・異常検知)を検証する。
// 使い方: node scripts/simulate-daily-ingest.mjs LEDGER.csv SEED_BEFORE_DATE(例 2026-10-31) [OUT.json]
// 入力CSVは原本由来のためコミットしない。出力は件数のみ(タイトル等を含まない)。書込先は OUT だけ。
import fs from 'node:fs';
import {parseCsv} from './build-universe-preview.mjs';
import {ingest,runRecord,isPublishable} from '../public/library/daily-ingest.mjs';
const [,, csv, seedBefore, outPath]=process.argv;
const rows=parseCsv(fs.readFileSync(csv,'utf8')).slice(1).filter(r=>/^EP-\d{5}$/.test(r[0]));
const iso=s=>{const m=/(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/.exec(s);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00+09:00`:'';};
const items=rows.map(r=>({id:r[0],guid:r[4],show:r[1],title:r[2],pubDate:iso(r[3]),spotify:r[8],audio:r[10],link:r[6]})).filter(i=>i.guid&&i.pubDate);
const day=i=>i.pubDate.slice(0,10);
const days=[...new Set(items.map(day))].sort();
const seedItems=items.filter(i=>day(i)<seedBefore);
let registry={runs:[],episodes:seedItems.map((i,k)=>({id:i.id,guid:i.guid,show:i.show,title:i.title,pubDate:new Date(i.pubDate).toISOString(),spotify:i.spotify,custody:'collected',review:'reviewed',decision:'対象',approval:'approved',publication:'published'}))};
const log=[];let prev=null;
for(const d of days.filter(d=>d>=seedBefore)){
  const feed=items.filter(i=>day(i)<=d).map(i=>({guid:i.guid,title:i.title,show:i.show,pubDate:i.pubDate,audio:i.audio,link:i.link}));
  const now=d+'T23:00:00+09:00';
  const a=ingest(registry,feed,{now});registry=a.registry;
  const rec=runRecord({registry,result:a.result,now,runId:'sim-'+d,prev});
  const b=ingest(registry,feed,{now}); // 同日再実行
  if(b.result.added!==0||b.registry.episodes.length!==registry.episodes.length)throw Error('NOT_IDEMPOTENT '+d);
  prev=rec;log.push({day:d,fetched:rec.fetched,added:rec.added,total:rec.total,unreviewed:rec.unreviewed,published:rec.published,status:rec.status,anomalies:rec.anomalies});
}
const ids=registry.episodes.map(e=>e.id),guids=registry.episodes.map(e=>e.guid);
const out={seeded:seedItems.length,finalTotal:registry.episodes.length,uniqueIds:new Set(ids).size===ids.length,uniqueGuids:new Set(guids).size===guids.length,
  publishedUnchanged:registry.episodes.filter(isPublishable).length===seedItems.length,newAreUnreviewed:registry.episodes.filter(e=>e.review==='unreviewed').length===registry.episodes.length-seedItems.length,days:log};
console.log(JSON.stringify(out,null,1));if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1));
