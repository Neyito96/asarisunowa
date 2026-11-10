// Read-only verifier for native Sheets CellData snapshots and official JSON captures.
// Usage: node scripts/phase14/verify-copy.mjs before.json after.json evidence.json
import fs from 'node:fs';import vm from 'node:vm';
const [beforePath,afterPath,evidencePath]=process.argv.slice(2);
if(!evidencePath)throw Error('Expected before, after and evidence JSON paths');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const ctx=vm.createContext({});for(const f of ['LibraryOfficialParser.gs','LibraryOfficialRssEngine.gs'])vm.runInContext(fs.readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8'),ctx);
const data=x=>x.sheets.find(s=>s.properties.title==='エピソード台帳').data[0].rowData;
const before=data(read(beforePath)),after=data(read(afterPath)),evidence=read(evidencePath),report={rows:after.length,changedCells:0,nonemptyOverwrites:0,replayChanges:0,rawExact:0,columns:{}};
for(let i=0;i<after.length;i++){
 const a=before[i].values,b=after[i].values,ev=evidence.find(x=>x.clip?.Id===b[6]?.userEnteredValue?.stringValue);if(!ev)throw Error('Missing evidence');
 const item=ctx.LibraryOfficialEngine.fromJson(ev.row,ev.clip,ev.apiUrl);
 const replay=ctx.LibraryOfficialEngine.plan(b,item,ev.clip,ev.apiUrl);report.replayChanges+=replay.changes.length;
 if(b[21].userEnteredValue.stringValue===item.description)report.rawExact++;
 for(let j=0;j<55;j++)if(JSON.stringify(a[j]?.userEnteredValue)!==JSON.stringify(b[j]?.userEnteredValue)){report.changedCells++;report.columns[j]=(report.columns[j]||0)+1;if(a[j]?.userEnteredValue)report.nonemptyOverwrites++;}
}
if(report.nonemptyOverwrites||report.replayChanges||report.rawExact!==report.rows)throw Error(JSON.stringify(report));
console.log(JSON.stringify(report,null,2));
