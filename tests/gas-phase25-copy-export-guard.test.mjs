import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const c=vm.createContext({console:{log(){}}});
for(const f of ['P25CopyExportGuarded','P25CopyPlaylistCheck'])vm.runInContext(fs.readFileSync(`scripts/google-apps-script/${f}.js`,'utf8'),c);
const n=o=>JSON.parse(JSON.stringify(o));
const row=(id)=>{const r=new Array(55).fill('');r[0]=id;r[1]='S';r[2]='T';return r;};
const H=['台帳ID','番組名','タイトル'].concat(new Array(52).fill('h'));
const grid=(...ids)=>[H,...ids.map(row)];
test('old unbounded exporter is gone; guarded one never writes the ledger',()=>{
  const old=fs.readFileSync('scripts/google-apps-script/P25CopyPlaylistCheck.js','utf8');assert.ok(!old.includes('EXPORT_NEW_ROWS'));
  const g=fs.readFileSync('scripts/google-apps-script/P25CopyExportGuarded.js','utf8');
  assert.ok(!/ledger[^;]*\.(setValue|setValues|appendRow|deleteRow|clear|insertRow)/i.test(g));assert.ok(!/setSharing|addEditor|addViewer|UrlFetchApp|DriveApp/.test(g));
});
test('plan selects only new + fixed refresh ids, 22 allowlisted columns',()=>{
  const p=n(c.p25ExportPlan_(grid('EP-00001','EP-06591','EP-06592','EP-06593'),{minExclusive:'EP-06591',refresh:['EP-00001']}));
  assert.deepEqual(p.problems,[]);assert.equal(p.rows.length,3);assert.equal(p.rows[0].length,22);
});
test('stops: header mismatch, duplicate, missing refresh id, row cap, none',()=>{
  const bad=grid('EP-06592');bad[0]=['x'].concat(H.slice(1));
  assert.match(n(c.p25ExportPlan_(bad,{minExclusive:'EP-06591'})).problems.join(),/HEADER/);
  assert.match(n(c.p25ExportPlan_(grid('EP-06592','EP-06592'),{minExclusive:'EP-06591'})).problems.join(),/DUPLICATE/);
  assert.match(n(c.p25ExportPlan_(grid('EP-06592'),{minExclusive:'EP-06591',refresh:['EP-00005']})).problems.join(),/REFRESH_ID_MISSING/);
  assert.match(n(c.p25ExportPlan_(grid('EP-06592','EP-06593','EP-06594'),{minExclusive:'EP-06591',maxRows:2})).problems.join(),/ROW_CAP/);
  assert.match(n(c.p25ExportPlan_(grid('EP-00001'),{minExclusive:'EP-06591'})).problems.join(),/NO_ROWS/);
});
test('gate: no approval / incomplete / expired / already exported all block; valid allows once',()=>{
  const now=Date.parse('2026-11-12');
  assert.equal(c.p25ExportMayRun_(null,now).reason,'NO_APPROVAL_RECORD');
  assert.equal(c.p25ExportMayRun_({approvedBy:'a'},now).reason,'APPROVAL_INCOMPLETE');
  assert.equal(c.p25ExportMayRun_({approvedBy:'a',expiresOn:'2026-11-01'},now).reason,'APPROVAL_EXPIRED');
  assert.equal(c.p25ExportMayRun_({approvedBy:'a',expiresOn:'2026-11-24',sheetId:'x'},now).reason,'ALREADY_EXPORTED');
  assert.equal(c.p25ExportMayRun_({approvedBy:'a',expiresOn:'2026-11-24',creating:true},now).reason,'PREVIOUS_RUN_INCOMPLETE');
  assert.equal(c.p25ExportMayRun_({approvedBy:'a',expiresOn:'2026-11-24'},now).ok,true);
});
