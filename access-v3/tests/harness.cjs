const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const ID='5OwJ6qphlx7kSlpdnk3AXJ',EP='aaaaaaaaaaaaaaaaaaaaaa';
class Sheet{
 constructor(name,rows=[]){this.name=name;this.rows=rows;}
 getName(){return this.name;} getMaxRows(){return 1000;}
 getLastRow(){let n=this.rows.length;while(n&&this.rows[n-1].every(x=>x===''||x==null))n--;return n;}
 setFrozenRows(){} appendRow(row){this.rows.push(row.slice());}
 getRange(row,col,n=1,w=1){const sh=this;return {
   getValues(){return Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>sh.rows[row+i-1]?.[col+j-1]??''));},
   getDisplayValues(){return this.getValues().map(r=>r.map(x=>String(x)));},
   getDisplayValue(){return String(this.getValues()[0][0]);},getValue(){return this.getValues()[0][0];},
   setValues(rows){rows.forEach((r,i)=>{sh.rows[row+i-1]??=[];r.forEach((v,j)=>sh.rows[row+i-1][col+j-1]=v);});return this;},
   setValue(v){return this.setValues([[v]]);},clearContent(){return this.setValues(Array.from({length:n},()=>Array(w).fill('')));},
   setDataValidation(){return this;},setFontWeight(){return this;},setBackground(){return this;}
 };}
}
function harness(){
 const props=new Map(),sheets=new Map(),requests=[],logs=[];
 const ss={getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet(n);sheets.set(n,s);return s;}};
 let time=1700000000000, runtime=[],fetcher=()=>({code:200,body:{}});
 class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const builder={requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return {};}};
 const c={Date:Clock,console,Set,Map,JSON,Math,Number,String,Array,Object,RegExp,Error,
 SPREADSHEET_ID:'test',ASAHI_PRIMARY_SHOW_IDS:['show'],AUTO_PLAYLIST_RULES:[],
 THEME_REVIEW_HEADERS_:['ルールキー','エピソードID','公開日','番組名','エピソード名','一致キーワード','概要抜粋','Spotify URL','判定','確認日時','追加日時','エラー'],
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},
 Utilities:{DigestAlgorithm:{SHA_256:'SHA256'},computeDigest:(_,v)=>Array.from(require('crypto').createHash('sha256').update(v).digest()),newBlob:x=>({getBytes:()=>Buffer.from(x)}),formatDate:()=>new Clock().toISOString().slice(0,10)},
 SpreadsheetApp:{openById:()=>ss,flush(){},newDataValidation:()=>builder},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Logger:{log:v=>logs.push(v)},
 getSpotifyUserAccessToken:()=> 'token',getSheetLoose:(ss,n)=>ss.getSheetByName(n),
 getAutoPlaylistRuleByKey_:k=>c.AUTO_PLAYLIST_RULES.find(r=>r.key===k),
 loadAutoUpdateRuntimeRulesV1_:()=>runtime,saveAutoUpdateRuntimeRuleV1_:r=>{runtime=runtime.filter(x=>x.playlistId!==r.playlistId).concat([r]);},
 setAutoUpdateRuleSheetStatusV1_(){},assertAutoPlaylistSheetLinkBeforeWrite_:()=>({row:2}),
 inspectAutoPlaylistSheetLink_:()=>({found:true,duplicate:false,match:{row:2}}),
 UrlFetchApp:{fetch:(url,options)=>{requests.push({url,options});const r=fetcher(url,options);return {
 getResponseCode:()=>r.code,getContentText:()=>JSON.stringify(r.body||{}),getAllHeaders:()=>r.headers||{}};}},
 AUTO_UPDATE_REQUEST_SHEET_NAME:'自動更新申請',extractAutoUpdateSpotifyPlaylistId_:u=>String(u).match(/playlist\/([A-Za-z0-9]+)/)?.[1],
 isInactiveAutoUpdateRequestStatus_:s=>['取消','重複申請'].includes(s),
 };
 vm.createContext(c);for(const file of ['SpotifyBudgetV2.js','ThemeRuntimeV2.js'])vm.runInContext(fs.readFileSync(file==='ThemeRuntimeV2.js'?'access-v3/src/'+file:'candidate/'+file,'utf8'),c);
 const rule=c.makeThemeRuleV2_({title:'北欧',keywords:'北欧\nスウェーデン  Sweden',ruleNote:''},ID,2,null);
 sheets.set('作業台',new Sheet('作業台',[[],['url','北欧','','','','','要確認','2026-10-03']]));
 sheets.set('自動更新申請',new Sheet('自動更新申請',[[],['','url','北欧','','invite','','','','']]));
 const pair=c.themePairV2_(rule,true);
 const corpus=c.themeCorpusV2_();
 const addEp=(id=EP,name='北欧の暮らし')=>corpus.appendRow(['show',id,'2026-10-03',name,'スウェーデンの社会','show',new Clock(),true]);
 for(const file of ['SpotifyAccessV3.js','SpotifyAccessV3Adapters.js','SpotifyNordicV3.js'])vm.runInContext(fs.readFileSync('access-v3/src/'+file,'utf8'),c);
 c.ScriptApp={getProjectTriggers:()=>[],newTrigger:()=>({timeBased(){return this;},everyMinutes(){return this;},create(){}})};
 runtime=[rule];
 return {c,props,sheets,requests,logs,rule,pair,corpus,addEp,ss,
 setFetch:f=>fetcher=f,setRuntime:r=>runtime=r,advance:ms=>time+=ms};
}
module.exports={harness,ID,EP,Sheet};
