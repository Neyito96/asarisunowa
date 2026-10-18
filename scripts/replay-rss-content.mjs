// Local-only replay of saved official RSS and ledger/log evidence. No network/GAS execution.
import fs from 'node:fs';
import {harness} from '../tests/library-v3-harness.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const c=harness(0).ctx,school=read('tests/fixtures/school-rss-first50-20261018.json');
const pairs=read('tests/fixtures/school-description-pairs-20261018.json').pairs;
const ledger=read('tests/fixtures/school-existing-clean-snapshot.json');
const rows=school.items.map(it=>{
 const p=pairs.find(p=>p.id===ledger.identities.find(x=>x.guid===it.guid)?.id),old=ledger.rows.find(r=>r.id===p?.id),clean=c.libV3ContentClean_(it.description,'ニュースの学校'),people=c.libV3CandidatePeople_(it);
 return {id:p?.id||'',guid:it.guid,title:it.title,rawLength:it.description.length,rawHash:clean.rawHash,rawPreserved:true,removed:clean.removed,review:clean.review,clean:clean.text,cleanHash:clean.cleanHash,ruleVersion:clean.ruleVersion,people:people.people,personReviews:people.reviews,speakers:people.speakers,existingW:old?.clean??null,existingWComparison:!old?'NO_SNAPSHOT_ROW':!old.clean?'BLANK':old.clean===clean.text?'EXACT_EQUAL':c.libV3DescriptionCompare_(old.clean,clean.text).kind};
});
const other=read('tests/fixtures/rss-content-seven-shows.json').samples.map(it=>{const p=c.libV3CandidatePeople_(it),clean=c.libV3ContentClean_(it.description,it.show);return {show:it.show,guid:it.guid,title:it.title,feed:it.feed,fetchedAt:it.fetchedAt,people:p.people,reviews:p.reviews,cleanReview:clean.review,removedLines:clean.removed.length,speakers:p.speakers};});
const count=(arr,key)=>arr.reduce((out,r)=>(out[r[key]]=(out[r[key]]||0)+1,out),{});
const summary={mode:'LOCAL_SAVED_FIXTURE_REPLAY',school:{inspected:rows.length,rawCollected:rows.filter(r=>r.rawLength).length,cleanGenerated:rows.filter(r=>r.clean).length,episodesWithNoticeRemoval:rows.filter(r=>r.removed.length).length,removedLines:rows.reduce((n,r)=>n+r.removed.length,0),speakerEpisodes:rows.filter(r=>r.speakers.length).length,personReviewEpisodes:rows.filter(r=>r.personReviews.length).length,cleanReviewEpisodes:rows.filter(r=>r.review.length).length,existingWComparison:count(rows,'existingWComparison')},other:other.reduce((a,r)=>{const v=a[r.show]??={episodes:0,speakerEpisodes:0,peopleRolePairs:0,reviewEpisodes:0,removedLines:0};v.episodes++;v.speakerEpisodes+=r.speakers.length>0;v.peopleRolePairs+=r.people.length;v.reviewEpisodes+=r.reviews.length>0;v.removedLines+=r.removedLines;return a;},{}),newRssCalls:0,gasRuns:0,sheetWrites:0,propertiesWrites:0,ledgerWSnapshotReadAt:ledger.readAt};
fs.writeFileSync('docs/audits/2026-10-18-v3-practical/rss-content-replay.json',JSON.stringify({summary,school:rows,other},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
