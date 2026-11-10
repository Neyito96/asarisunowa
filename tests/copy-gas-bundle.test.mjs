import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const ROOT=new URL('../',import.meta.url).pathname;
execFileSync('node',[ROOT+'scripts/build-copy-gas.mjs'],{stdio:'pipe'});
const bundle=fs.readFileSync(ROOT+'scripts/copy-gas-proposal/P26Bundle.gs','utf8'),entry=fs.readFileSync(ROOT+'scripts/copy-gas-proposal/P26Entry.gs','utf8');
const COPY_ID='16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R',COPY_SHEET='1lbfEq3Tdj6QaLGJOWZfez-xNkQ5yRHRILqmP1nLJtQw',PROD_SHEET='1lgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
function sheet(name){const g=[];const sh={name,g,getLastRow:()=>g.length,
  getRange:(r,c,nr=1,nc=1)=>({getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>g[r-1+i]?.[c-1+j]??'')),setValues:v=>{sh.writes++;v.forEach((row,i)=>{g[r-1+i]??=[];row.forEach((x,j)=>g[r-1+i][c-1+j]=x);});},clearContent:()=>{sh.writes++;for(let i=0;i<nr;i++)for(let j=0;j<nc;j++)if(g[r-1+i])g[r-1+i][c-1+j]='';}}),
  appendRow:row=>{sh.writes++;g.push([...row]);},writes:0};return sh;}
function env({scriptId=COPY_ID,xml={},ledger=[],approval=null,feeds=[],config=null,snapshot=null}={}){
  const tabs={};const mk=(n,rows)=>{const s=sheet(n);rows.forEach(r=>s.g.push(r));s.writes=0;tabs[n]=s;return s;};
  mk('エピソード台帳',[['hdr'],...ledger]);if(feeds.length)mk('P26_FEEDS',[['k','u','s'],...feeds]);if(config)mk('P26_PLAYLIST_CONFIG',config);if(snapshot)mk('P26_PLAYLIST_SNAPSHOT',[['pl','uri'],...snapshot]);
  const props={};if(approval)props.P26_APPROVAL=JSON.stringify(approval);const calls={fetch:[],spreadsheetsOpened:[]};
  const ss={getId:()=>COPY_SHEET,getSheetByName:n=>tabs[n]||null,insertSheet:n=>{const s=sheet(n);tabs[n]=s;return s;}};
  const ctx=vm.createContext({console,Promise,Map,Set,JSON,Date,Math,Error,Array,Object,String,Number,Uint8Array,TextEncoder,RegExp,
    ScriptApp:{getScriptId:()=>scriptId},SpreadsheetApp:{openById:id=>{calls.spreadsheetsOpened.push(id);if(id!==COPY_SHEET)throw new Error('UNEXPECTED_SHEET');return ss;}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    UrlFetchApp:{fetch:u=>{calls.fetch.push(u);const x=xml[u];return {getResponseCode:()=>x?200:404,getContentText:()=>x||''};}},Utilities:{formatDate:()=>'20261110-120000'}});
  vm.runInContext(bundle+'\n'+entry,ctx);return {ctx,tabs,props,calls};
}
const approval={approvedBy:'admin',approvedAt:'2026-11-11',expiresOn:'2999-01-01',scope:['P25DailyReadOnly','P26PlaylistConfigDryRun']};
const item=(g,t,d)=>`<item><guid>${g}</guid><title>${t}</title><pubDate>${d}</pubDate><enclosure url="https://t.omny.fm/${g}.mp3"/><description>d</description></item>`;
const URL1='https://www.omnycontent.com/d/playlist/x.rss';
const RSS=`<rss><channel><title>ニュースの現場から</title>${item('g1','one','Mon, 09 Nov 2026 04:00:00 GMT')}${item('g2','two','Tue, 10 Nov 2026 04:00:00 GMT')}</channel></rss>`;
const flush=()=>new Promise(r=>setImmediate(r));
const ledgerRow=(id,guid,title,date,spUrl,desc='')=>{const r=Array(55).fill('');r[0]=id;r[1]='番組';r[2]=title;r[3]=date;r[6]=guid;r[11]=spUrl;r[21]=desc;return r;};

test('refuses without approval / wrong script / out of scope and writes nothing',()=>{
  let e=env({feeds:[['omny:news',URL1,'ニュースの現場から']]});assert.throws(()=>e.ctx.P25DailyReadOnly(),/NO_APPROVAL_RECORD/);assert.equal(e.calls.fetch.length,0);assert.ok(Object.values(e.tabs).every(t=>t.writes===0));
  e=env({scriptId:'OTHER',approval});assert.throws(()=>e.ctx.P25DailyReadOnly(),/NOT_COPY_SCRIPT/);
  e=env({approval:{...approval,scope:['P26PlaylistConfigDryRun']}});assert.throws(()=>e.ctx.P25DailyReadOnly(),/OUT_OF_SCOPE/);
  e=env({approval:{...approval,expiresOn:'2000-01-01'}});assert.throws(()=>e.ctx.P25DailyReadOnly(),/APPROVAL_EXPIRED/);
});
test('P25DailyReadOnly: read-only RSS, TMP ids (no EP minting), 1 run commit, readback, same-run rerun adds 0, second invocation stops',async()=>{
  const e=env({approval,feeds:[['omny:news',URL1,'ニュースの現場から']],xml:{[URL1]:RSS},ledger:[ledgerRow('EP-00010','g1','one','2026/11/9 4:00','')]});
  e.ctx.P25DailyReadOnly();await flush();await flush();await flush();
  const rep=e.tabs.P26_REPORT.g.at(-1);const s=JSON.parse(rep[2]);
  assert.equal(s.done,true);assert.equal(s.added,2);assert.equal(s.epIdsMinted,0);assert.equal(s.readbackOk,true);assert.equal(s.sameRunRerun,'NOT_COMMITTED');assert.equal(s.sameRunRerunAdded,0);
  const reg=e.tabs.P26_REGISTRY.g.slice(1).map(r=>JSON.parse(r[1]));assert.equal(reg.length,2);assert.ok(reg.some(x=>x.id==='EP-00010'&&x.guid==='g1')); // 台帳にあるGUIDは読取結果のEP-IDへ(採番しない)
  assert.ok(reg.some(x=>/^TMP-/.test(x.id)));assert.ok(reg.every(x=>!('description' in x)));assert.equal(e.tabs.P26_REGISTRY.g.length,3); // 再実行後も行数不変
  assert.equal(e.tabs.P26_JOURNAL.g.filter(r=>r[1]==='COMMIT').length,1);
  assert.ok(e.tabs['エピソード台帳'].writes===0);assert.deepEqual([...new Set(e.calls.spreadsheetsOpened)],[COPY_SHEET]);assert.deepEqual(e.calls.fetch,[URL1]);
  assert.throws(()=>e.ctx.P25DailyReadOnly(),/MAX_RUNS_REACHED/);
});
test('feed host allowlist: a non-allowed URL is not fetched',async()=>{
  const e=env({approval,feeds:[['k','https://evil.example.com/x.rss','s']],xml:{}});e.ctx.P25DailyReadOnly();await flush();await flush();await flush();assert.equal(e.calls.fetch.length,0);
});
const PL1='a'.repeat(22),PL2='b'.repeat(22);const H=['key','有効','プレイリストID','名称','方式','対象番組','キーワード','除外キーワード','照合範囲','照合モード','特別照合','承認状態','段階','実行モード','writer','1回の追加上限','レビュー済のみ'];
const cfgRow=(k,pl,kw)=>[k,'TRUE',pl,k,'title-text','S1',kw,'','name','any','','approved','incremental','DRY_RUN','legacy','10',''];
test('P26PlaylistConfigDryRun: switching only config rows switches targets; no Spotify access; snapshot-less lists report matches only',async()=>{
  const d=new Date(Date.now()-86400e3),ds=`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} 4:00`;const sp=n=>`https://open.spotify.com/episode/${String(n).padStart(22,'A')}`;
  const ledger=[ledgerRow('EP-1','g1','動画みた1',ds,sp(1)),ledgerRow('EP-2','g2','ポリレビ#2',ds,sp(2)),ledgerRow('EP-3','g3','動画みた3',ds,sp(3))];
  const e=env({approval,ledger,config:[H,cfgRow('kino',PL1,'動画みた'),cfgRow('poli',PL2,'ポリレビ')],snapshot:[[PL1,'spotify:episode:'+String(1).padStart(22,'A')]]});
  e.ctx.P26PlaylistConfigDryRun();await flush();await flush();await flush();
  const s=JSON.parse(e.tabs.P26_REPORT.g.at(-1)[2]);assert.equal(s.done,true);assert.equal(s.spotifyWrites,0);assert.deepEqual(s.matchedPerRule,{kino:2,poli:1});assert.equal(s.snapshotsAvailable,1);
  const rows=e.tabs.P26_PLAYLIST_DRYRUN.g.slice(1);assert.ok(rows.some(r=>r[1]==='kino'&&r[2].endsWith('A3')&&r[3]==='DRY_RUN_CANDIDATE'));assert.ok(rows.some(r=>r[1]==='kino'&&r[3]==='ALREADY_IN_PLAYLIST'));assert.ok(rows.some(r=>r[1]==='poli'&&r[3]==='NO_SNAPSHOT'));
  assert.equal(e.calls.fetch.length,0);assert.equal(e.tabs['エピソード台帳'].writes,0);
  // 設定の1行を差し替えるだけで別の対象になる(コード変更なし)
  const e2=env({approval,ledger,config:[H,cfgRow('other',PL2,'ポリレビ')],snapshot:[[PL2,'spotify:episode:x']]});e2.ctx.P26PlaylistConfigDryRun();await flush();await flush();await flush();
  assert.deepEqual(JSON.parse(e2.tabs.P26_REPORT.g.at(-1)[2]).matchedPerRule,{other:1});
});
test('static safety: no Spotify, no triggers, no Drive/Mail/sharing, no production sheet id, writes only to P26_ tabs, async drained by separate verifier',()=>{
  const all=bundle+entry;
  assert.ok(!/spotify\.com\/v1|api\.spotify|accounts\.spotify|Bearer|addItems\([^)]*\)\s*;?\s*\n.*UrlFetchApp/i.test(all.replace(/open\.spotify\.com\/\(\?:intl/g,'')));
  assert.ok(!/ScriptApp\.(newTrigger|deleteTrigger|getProjectTriggers)|DriveApp|MailApp|GmailApp|setSharing|addEditor|addViewer|createFile|SpreadsheetApp\.create\(/.test(all));
  assert.ok(!all.includes(PROD_SHEET));assert.equal((entry.match(/UrlFetchApp\.fetch/g)||[]).length,1);
  assert.ok(!/getSheetByName\(P26_LEDGER_TAB_\)[\s\S]{0,200}(setValues|appendRow|clearContent)/.test(entry));
  assert.ok(/function P26Verify/.test(entry));assert.ok(!/\bimport\b|\bexport\b/.test(bundle.replace(/\/\/.*$/gm,'').replace(/'[^']*'|`[^`]*`|"[^"]*"/g,'')));
});
