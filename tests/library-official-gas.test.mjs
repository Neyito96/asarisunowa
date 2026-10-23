import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
function engine(extra={}){const c=vm.createContext({Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,s,charset)=>[...crypto.createHash('sha256').update(charset==='utf8'?s:s.replace(/[^\x00-\x7f]/g,'?')).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')+'='},...extra});for(const f of ['LibraryOfficialParser.gs','LibraryOfficialRssEngine.gs'])vm.runInContext(fs.readFileSync(new URL('../scripts/google-apps-script/'+f,import.meta.url),'utf8'),c);return c;}
const guid='11111111-2222-4333-8444-555555555555';
const item={guid,title:'番組',pubDate:'2026-10-22T19:00:00Z',audio:`https://traffic.omny.fm/d/clips/org/show/${guid}/audio.mp3`,link:'https://omny.fm/shows/asahi/example',duration:'53:35',feedUrl:'https://www.omnycontent.com/feed.rss',description:'<p>本文全文です。</p><p>【関連記事】<br>記事<a href="https://www.asahi.com/articles/ABC.html?iref=omny">記事</a><br><a href="https://digital.asahi.com/articles/DEF.html">別記事</a></p><p>【出演】<br>記者一（編集委員）<br>MC 記者二</p><p>【朝ポキ情報】<br>宣伝情報</p>'};
const clip={Id:guid,Title:item.title,PublishedUtc:item.pubDate,PublishedUrl:item.link,AudioUrl:item.audio,DurationSeconds:3214.755,DescriptionHtml:item.description,EmbedUrl:item.link+'/embed'};
const cells=()=>Array.from({length:55},(_,i)=>({userEnteredValue:{stringValue:({0:'EP-00001',2:item.title,3:'2026/10/23 04:00:00',6:guid,38:'保留'})[i]||''}}));
test('GAS loads without Node, browser URL, fetch or structuredClone globals',()=>assert.ok(engine().LibraryOfficialEngine));
test('raw preserved, duration parsed, roles and separate related links retained',()=>{const e=engine().LibraryOfficialEngine,p=e.plan(cells(),item,clip,'https://api.omny.fm/example');assert.equal(p.changes.find(c=>c.col===21).next,item.description);assert.equal(p.changes.find(c=>c.col===15).next,3215);assert.equal(p.changes.find(c=>c.col===28).cell.textFormatRuns.filter(r=>r.format.link).length,2);assert.match(p.changes.find(c=>c.col===23).next,/MC 記者二/);assert.doesNotMatch(p.changes.find(c=>c.col===23).next,/宣伝/);assert.ok(!p.changes.some(c=>c.col===38));});
test('replay yields zero cell writes',()=>{const e=engine().LibraryOfficialEngine,c=cells();for(const ch of e.plan(c,item,clip,'api').changes)c[ch.col]=ch.cell;assert.equal(e.plan(c,item,clip,'api').changes.length,0);});
test('nonempty, formula, validation, chip protected',()=>{const e=engine().LibraryOfficialEngine,c=cells();c[15]={userEnteredValue:{numberValue:99}};c[21]={userEnteredValue:{formulaValue:'=""'}};c[22]={dataValidation:{}};c[23]={chipRuns:[{}]};const p=e.plan(c,item,clip,'api');for(const col of [15,21,22,23])assert.ok(!p.changes.some(x=>x.col===col));});
test('UUID/title/date conflict stops planning',()=>{const e=engine().LibraryOfficialEngine;for(const change of [{Id:'bad'},{Title:'other'},{PublishedUtc:'2020-01-01'}])assert.throws(()=>e.plan(cells(),item,{...clip,...change},'api'));});
test('official JSON fallback checks ledger date',()=>{const e=engine().LibraryOfficialEngine,r=cells().map(c=>c.userEnteredValue.stringValue);assert.equal(e.fromJson(r,clip,'api').description,item.description);r[3]='2020/01/01 00:00:00';assert.throws(()=>e.fromJson(r,clip,'api'));});
test('more than five staff retained in X',()=>{const e=engine().LibraryOfficialEngine,i={...item,description:'本文\n【出演・スタッフ】\n'+Array.from({length:7},(_,i)=>'記者'+i+'（役割）').join('\n')};const p=e.plan(cells(),i,clip,'api');assert.match(p.changes.find(c=>c.col===23).next,/記者6/);assert.equal(p.changes.filter(c=>c.col>=45&&c.col<=49).length,5);});
function decision(over={}){const e=engine().LibraryOfficialEngine;return ()=>e.newDecision({...item,pubDate:'2020-01-02T00:00:00Z'},over.rows||[],over.history||[],over.excluded||[],over.decisions||[],{allowNew:true,newAfter:'2020-01-01T00:00:00Z',...over.config},{complete:true,...over.baseline},over.counter||'6592');}
test('next ID reserves ledger, history and all decision IDs',()=>assert.equal(decision({decisions:[['EP-07000','保留']]})(),'EP-07001'));
test('EP-06592 already registered: next unique official GUID receives EP-06593',()=>{
 const prior=Array(55).fill('');prior[0]='EP-06592';prior[6]='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 assert.equal(decision({rows:[prior],counter:'6591'})(),'EP-06593');
});
test('EP-06592 duplicate GUID is rejected even when new publication decision is absent',()=>{
 const prior=Array(55).fill('');prior[0]='EP-06592';prior[6]=guid;
 assert.throws(decision({rows:[prior],counter:'6592'}),/SEEN_OR_EXCLUDED/);
});
test('interrupted EP-06593 reservation cannot be reassigned',()=>{
 assert.throws(decision({history:[[guid,'EP-06593','ニュースの現場から','','予約中']],counter:'6592'}),/SEEN_OR_EXCLUDED/);
});
test('GUID duplicate blocked regardless publication',()=>{const r=Array(55).fill('');r[0]='EP-00001';r[6]=guid;assert.throws(decision({rows:[r]}),/SEEN/);});
test('official UUID collision blocked',()=>{const r=Array(55).fill('');r[0]='EP-00001';r[51]=guid;assert.throws(decision({rows:[r]}),/SEEN/);});
test('history reservation blocks interrupted retry',()=>assert.throws(decision({history:[[guid,'EP-06593']]}),/SEEN/));
test('deleted GUID blocked',()=>assert.throws(decision({excluded:[[guid,'EP-00001']]}),/SEEN/));
test('incomplete baseline, cutoff, invalid counter stop',()=>{assert.throws(decision({baseline:{complete:false}}));assert.throws(decision({config:{newAfter:'2030-01-01'}}));assert.throws(decision({counter:'bad'}));});
test('disabled production entry never writes',()=>{let release=0;const c=engine({LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>release++})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify({sheetId:'copy',feeds:[{}]})})}});assert.throws(()=>c.scheduledLibraryOfficialBackfill(),/NOT_VALIDATED/);assert.equal(release,1);});
test('optional platform proof requires matching GUID and host',()=>{const e=engine().LibraryOfficialEngine;const proof={platform:'apple',guid,url:'https://podcasts.apple.com/jp/podcast/example/id1?i=2',verified:true};assert.equal(e.material({...item,platformEvidence:[proof]},clip,'api').values[12],proof.url);assert.equal(e.material({...item,platformEvidence:[{...proof,guid:'other'}]},clip,'api').values[12],undefined);});
test('Apple fetch failure does not block episode',()=>{const e=engine({UrlFetchApp:{fetch:()=>{throw Error('offline');}}}).LibraryOfficialEngine;assert.equal(e.platforms(item,{applePodcastId:'123'}).length,0);});
test('native V3 hash uses complete row and unmodified JSON serialization',()=>{
 const e=engine().LibraryOfficialEngine,row=Array(55).fill('');row[0]='EP-00141';row[3]=new Date('2026-10-10T02:00:23.000Z');row[31]=new Date('2026-10-10T02:19:00.410Z');row[54]='evidence';
 const expected=crypto.createHash('sha256').update(JSON.stringify(row)).digest('base64url')+'=';
 assert.equal(e.rowHash(row),expected);assert.notEqual(e.rowHash(row.slice(0,51)),expected);
});
test('REST serial dates cannot masquerade as native Date proof',()=>{
 const e=engine().LibraryOfficialEngine,a=['EP',new Date('2026-10-10T02:00:23Z')],b=['EP',46305.458599537036];
 assert.notEqual(e.rowHash(a),e.rowHash(b));assert.notEqual(e.rowHash(['',0,false]),e.rowHash([null,'0','false']));
});
test('baseline proof is immutable and mismatch fails closed',()=>{
 const e=engine().LibraryOfficialEngine,row=['EP-00141',''];const state={identity:['VERIFIED','guid',e.rowHash(row)]},saved=JSON.stringify(state);
 assert.equal(e.verifyRowProof(row,state),state.identity[2]);assert.equal(JSON.stringify(state),saved);
 assert.throws(()=>e.verifyRowProof(['EP-00141','changed'],state),/STATE_HASH_CONFLICT/);
});
test('transition receipt is bound to original baseline and full current hash',()=>{
 const e=engine().LibraryOfficialEngine,before=['EP-00141',''],after=['EP-00141','official'];const state={identity:['VERIFIED','guid',e.rowHash(before)],officialBackfill:['VERIFIED',guid,e.rowHash(before),'',e.rowHash(after),'official_blank_fill','now',JSON.stringify({schema:'official-native-row-v1',baselineHash:e.rowHash(before),afterHash:e.rowHash(after)})]};
 assert.equal(e.verifyRowProof(after,state),e.rowHash(after));state.officialBackfill[7]=JSON.stringify({schema:'official-native-row-v1',baselineHash:'other',afterHash:e.rowHash(after)});assert.throws(()=>e.verifyRowProof(after,state),/STATE_HASH_CONFLICT/);
});
test('writer does not assign to original identity hash',()=>{
 const source=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialRssEngine.gs',import.meta.url),'utf8');assert.doesNotMatch(source,/state\.identity\[2\]\s*=/);assert.match(source,/getLastColumn\(\)\)\.getValues\(\)\[0\]/);
});

test('legacy 51-column baseline remains immutable after AZ:BC schema extension',()=>{
 const e=engine().LibraryOfficialEngine,row=Array(55).fill('');row[0]='EP-00141';row[2]='日本語';row[3]=new Date('2026-10-10T02:00:23Z');
 const state={identity:['VERIFIED',guid,e.v3RowHash(row.slice(0,51)),'','','baseline','now','']},saved=JSON.stringify(state);
 assert.equal(e.verifyRowProof(row,state),e.rowHash(row));assert.equal(JSON.stringify(state),saved);
 row[21]='unreceipted edit';assert.throws(()=>e.verifyRowProof(row,state),/STATE_HASH_CONFLICT/);
});

test('legacy V3 default ASCII differs from explicit UTF-8 for Japanese',()=>{
 const e=engine().LibraryOfficialEngine,row=['日本語'];
 const legacy=crypto.createHash('sha256').update('["???"]').digest('base64url')+'=';
 assert.equal(e.v3RowHash(row),legacy);assert.notEqual(e.rowHash(row),legacy);
});

function native(extra={}){const c=engine(extra);vm.runInContext(fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialNative.gs',import.meta.url),'utf8'),c);return c;}
test('native sweep retries failed row without skipping it',()=>{
 const n=native().LibraryOfficialNative;let cp=0,calls=0,held=0;const seen=[],failedOnce=new Set();
 while(calls++<300){
  const r=n.sweep(6592,cp,50,100,()=>0,i=>{
   seen.push(i);
   if(i%100===0&&!failedOnce.has(i)){failedOnce.add(i);throw Error('transient');}
   return 0;
  },e=>{if(e.offset!==undefined)cp=e.offset;});
  held+=r.held;if(r.complete)break;
 }
 assert.equal(cp,6592);
 assert.equal(new Set(seen).size,6592);
 assert.equal(seen.length,6592+66);
 assert.equal(held,66);
 assert.ok(calls<300);
});
test('native sweep never skips a permanently failing row',()=>{
 const n=native().LibraryOfficialNative;let cp=0,failures=0;
 for(let run=0;run<3;run++){
  const r=n.sweep(100,cp,50,100,()=>0,i=>{if(i===4)throw Error('permanent');},e=>{if(e.offset!==undefined)cp=e.offset;else failures++;});
  assert.equal(cp,4);assert.equal(r.complete,false);assert.equal(r.held,1);
 }
 assert.equal(failures,3);
});
test('deadline checkpoint stops before visiting another row',()=>{let time=0,saved=0;const r=native().LibraryOfficialNative.sweep(100,0,50,3,()=>time++,()=>1,e=>saved=e.offset);assert.equal(r.scanned,3);assert.equal(saved,3);assert.equal(r.remaining,97);});
test('native protected targets reject formulas validations merges notes and nonempty',()=>{const n=native().LibraryOfficialNative,base={isBlank:()=>true,getFormula:()=>'',getDataValidation:()=>null,isPartOfMerge:()=>false,getNote:()=>''};for(const [key,val]of [['isBlank',false],['getFormula','=""'],['getDataValidation',{}],['isPartOfMerge',true],['getNote','keep']])assert.throws(()=>n.guardedCell({...base,[key]:()=>val}));});
test('native production target rejected before openById',()=>{let opened=0;const c=native({LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify({sheetId:'production',enabled:true})})},SpreadsheetApp:{openById:()=>opened++}});assert.throws(()=>c.scheduledLibraryOfficialNativeBackfill(),/COPY_ONLY/);assert.equal(opened,0);});
test('native source never invokes REST or mutates baseline; new registration blocked',()=>{const s=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialNative.gs',import.meta.url),'utf8');assert.doesNotMatch(s,/\.api\(|identity\[2\]\s*=|sheets.googleapis.com/);assert.match(s,/REGISTRATION_BLOCKED_NONATOMIC/);});
test('native cell journal recovers an interrupted write and retains immutable proof',()=>{
 const c=native({SpreadsheetApp:{flush:()=>{}}}),E=c.LibraryOfficialEngine,N=c.LibraryOfficialNative;
 const before=Array(55).fill('');before[0]='EP-00001';before[6]=guid;const after=before.slice();after[21]='official';
 const state={identity:['VERIFIED',guid,E.rowHash(before)],nativePending:{schema:'native-cell-v1',id:before[0],row:2,col:21,beforeHash:E.rowHash(before),afterHash:E.rowHash(after),next:'official',cell:{note:'proof'},baseline:E.rowHash(before)}};
 let note='',writes=0;const sheet={getRange:(r,col,w,h)=>w?{getValues:()=>[after]}:{getFormula:()=>'',getDataValidation:()=>null,setNote:v=>note=v}};
 N.recover(sheet,{getRange:()=>({setValue:()=>writes++})},2,2,state);assert.equal(note,'proof');assert.equal(writes,1);assert.equal(state.nativePending,undefined);assert.equal(state.identity[2],E.rowHash(before));assert.equal(E.verifyRowProof(after,state),E.rowHash(after));
});
test('native fill writes only blank, produces receipt and replay has zero writes',()=>{
 let writes=0,notes='',stateWrites=0;const row=Array(55).fill('');row[0]='EP-00001';row[6]=guid;
 const c=native({SpreadsheetApp:{flush:()=>{}}}),E=c.LibraryOfficialEngine,N=c.LibraryOfficialNative;
 const state={identity:['VERIFIED',guid,E.rowHash(row)]},baseline=state.identity[2];
 const sheet={getRange:(r,col,w,h)=>w?{getValues:()=>[row.slice()]}:{isBlank:()=>row[col-1]==='',getFormula:()=>'',getDataValidation:()=>null,isPartOfMerge:()=>false,getNote:()=>notes,setValue:v=>{row[col-1]=v;writes++;},setNote:v=>notes=v}};
 const st={getRange:()=>({setValue:()=>stateWrites++})},plan={id:row[0],guid,changes:[{col:21,next:'raw official',cell:{note:'evidence'}}]};
 assert.equal(N.fill(sheet,st,2,2,state,plan),1);assert.equal(writes,1);assert.equal(stateWrites,2);assert.equal(state.identity[2],baseline);assert.equal(E.verifyRowProof(row,state),E.rowHash(row));
 assert.equal(N.fill(sheet,st,2,2,state,{...plan,changes:[]}),0);assert.equal(writes,1);
 assert.throws(()=>N.fill(sheet,st,2,2,state,plan),/PROTECTED/);
});
test('native recovery rejects unrelated edits without changing cells or proof',()=>{
 const c=native(),E=c.LibraryOfficialEngine,N=c.LibraryOfficialNative,row=Array(55).fill('');row[0]='EP-00001';
 const state={identity:['VERIFIED',guid,'original'],nativePending:{schema:'native-cell-v1',id:row[0],row:2,baseline:'original',beforeHash:'before',afterHash:'after'}};
 assert.throws(()=>N.recover({getRange:()=>({getValues:()=>[row]})},{},2,2,state),/PARTIAL_WRITE_CONFLICT/);assert.equal(state.identity[2],'original');
});

test('frozen publication scope is not extended to EP-06592 during archival sweep',()=>{
 const src=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialNative.gs',import.meta.url),'utf8');
 assert.match(src,/if\(seen\.size<6591\)must\(scope\.has\(id\)/);
 assert.match(src,/else must\(!scope\.has\(id\)/);
 assert.match(src,/scopeNewUnclassified/);
 assert.match(src,/const total=sh\.getLastRow\(\)-1/);
});
test('read-only progress cannot skip a future write-mode sweep',()=>{
 const src=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialNative.gs',import.meta.url),'utf8');
 assert.match(src,/\(write\?'_WRITE':'_READ_ONLY'\)/);
});

test('new-episode path reuses official atomic registration, not native non-atomic writer',()=>{
 const official=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialRssEngine.gs',import.meta.url),'utf8');
 const native=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialNative.gs',import.meta.url),'utf8');
 const start=official.indexOf('function scheduledLibraryOfficialNew()');
 const end=official.indexOf('function installLibraryOfficialTriggersAfterValidation()',start);
 assert.ok(start>=0&&end>start);
 const registration=official.slice(start,end);
 for(const required of ['E.newDecision(', 'E.material(', 'E.api(c,\':batchUpdate\',{requests})', 'REGISTRATION_READBACK_FAILED', 'LockService.getScriptLock()', 'E.context(c)'])
  assert.ok(registration.includes(required),required);
 assert.match(registration,/engineValidation!=='P14_RUNTIME_VERIFIED'/);
 assert.match(registration,/otherWritersPaused!==true/);
 assert.match(native,/REGISTRATION_BLOCKED_NONATOMIC/);
});

test('related article URLs retain newline boundaries without link bleed',()=>{
 const e=engine().LibraryOfficialEngine;
 const urls=['https://www.asahi.com/articles/ABC','https://digital.asahi.com/articles/DEF'];
 const runs=e.articleLinkRuns(urls);
 assert.equal(runs.length,4);
 assert.equal(runs[0].startIndex,0);
 assert.equal(runs[1].startIndex,urls[0].length);
 assert.deepEqual(JSON.parse(JSON.stringify(runs[1].format)),{});
 assert.equal(runs[2].startIndex,urls[0].length+1);
 assert.equal(runs[3].startIndex,urls[0].length+1+urls[1].length);
 assert.equal(runs[0].format.link.uri,urls[0]);
 assert.equal(runs[2].format.link.uri,urls[1]);
});
test('native link writer accepts formatting reset runs between URLs',()=>{
 const src=fs.readFileSync(new URL('../scripts/google-apps-script/LibraryOfficialNative.gs',import.meta.url),'utf8');
 assert.match(src,/if\(!uri\)continue/);
});
