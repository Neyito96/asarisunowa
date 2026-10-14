/** 1007 snapshot -> isolated test ledger only. Never run against production. */
const I1007_SOURCE='1lJF11Xpx9cz9RLuuJsvl0zV9E5Fpg7I7XreB2R6wS7o';
const I1007_TEST='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const I1007_SHOWS=[['ニュースの現場から','ニュースの現場から'],['メディアトーク','MEDIA TALK'],['ドーナツ','ドーナツ'],['スポンジ','スポンジ'],['SDGs','こどもそうだんしつ'],['報談','報談'],['ニュースの学校','ニュースの学校']];
const I1007_BATCH=100;
function i1007Text(v){return String(v==null?'':v).trim();}
function i1007Url(v){return i1007Text(v).replace(/\/$/,'');}
function i1007Key(show,title){return show+'|'+i1007Text(title).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();}
function i1007Valid(url){return /^https:\/\/omny\.fm\/shows\/asahi\//i.test(url)||/^https:\/\/pdst\.fm\/e\/traffic\.megaphone\.fm\//i.test(url);}
function i1007SafeUrl(v,pattern){const s=i1007Text(v);return pattern.test(s)?s:'';}
function i1007Clean(v){return i1007Text(v).replace(/\\r\\n|\\n|\\r/g,' ').replace(/[\r\n]+/g,' ').replace(/[ \t]+/g,' ').trim();}\nfunction i1007Date(v){const d=new Date(v);return isNaN(d.getTime())?'':Utilities.formatDate(d,'Asia/Tokyo','yyyy/MM/dd HH:mm');}
function i1007Plan(){
  const source=SpreadsheetApp.openById(I1007_SOURCE), target=SpreadsheetApp.openById(I1007_TEST);
  const sheet=target.getSheetByName('エピソード台帳');
  if(!sheet)throw Error('Test ledger missing');
  const all=sheet.getDataRange().getValues(), header=all.shift().map(String);
  const ix=Object.fromEntries(header.map((x,i)=>[x,i]));
  const required=['台帳ID','番組名','タイトル','配信日時（JST）','取得元','元ページURL','公式個別URL','Spotify個別URL','Pocket Casts個別URL','概要原文','出演者・スタッフ','出演者1','出演者2','概要清掃済み','人間除外','保留・備考'];
  required.forEach(x=>{if(ix[x]===undefined)throw Error('Missing column '+x);});
  const byUrl=new Map(),bySpotify=new Map(),byTitle=new Map(),usedIds=new Set();
  let maxId=0;
  function add(map,k,i){if(!k)return;if(!map.has(k))map.set(k,[]);map.get(k).push(i);}
  all.forEach((r,i)=>{
    const show=i1007Text(r[ix['番組名']]),url=i1007Url(r[ix['元ページURL']]),sp=i1007Url(r[ix['Spotify個別URL']]);
    add(byUrl,url?show+'|'+url:'',i);add(bySpotify,sp?show+'|'+sp:'',i);
    add(byTitle,i1007Key(show,r[ix['タイトル']]),i);
    const id=i1007Text(r[ix['台帳ID']]);usedIds.add(id);
    const m=/^EP-(\d+)$/.exec(id);if(m)maxId=Math.max(maxId,Number(m[1]));
  });
  const excluded=target.getSheetByName('削除・除外履歴');
  const ex=excluded&&excluded.getLastRow()>1?excluded.getRange(2,1,excluded.getLastRow()-1,9).getValues():[];
  const blockedIds=new Set(ex.flatMap(r=>[i1007Text(r[0]),i1007Text(r[1])]).filter(Boolean));
  const plan=[], heldSamples=[], seenSource=new Set(), counts={matched:0,new:0,held:0,skipped:0,fill:0};
  I1007_SHOWS.forEach(([tab,show])=>{
    const sh=source.getSheetByName(tab);if(!sh)throw Error('Missing source tab '+tab);
    const data=sh.getDataRange().getValues().slice(1);
    const rich=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),1).getRichTextValues();
    data.forEach((r,i)=>{
      const url=i1007Url((rich[i]&&rich[i][0]&&rich[i][0].getLinkUrl())||r[0]),title=i1007Text(r[2]);
      if(!title||!i1007Valid(url)){counts.skipped++;return;}
      const spotify=i1007SafeUrl(r[11],/^https:\/\/open\.spotify\.com\/episode\/[a-z0-9]+/i);
      const asahi=i1007SafeUrl(r[12],/^https:\/\/(www\.)?asahi\.com\//i);
      const pocket=i1007SafeUrl(r[13],/^https:\/\/(pca\.st|pocketcasts\.com)\//i);
      const unique=show+'|'+url;
      if(seenSource.has(unique)){counts.held++;heldSamples.push({tab,row:i+2,reason:'DUPLICATE_SOURCE',title:title.slice(0,90)});return;}seenSource.add(unique);
      const urlMatches=byUrl.get(unique)||[],spMatches=spotify?(bySpotify.get(show+'|'+spotify)||[]):[],titleMatches=byTitle.get(i1007Key(show,title))||[];
      const candidates=[...new Set([...urlMatches,...spMatches,...titleMatches])];
      if(candidates.length>1){counts.held++;heldSamples.push({tab,row:i+2,reason:'AMBIGUOUS_MATCH',candidateIds:candidates.map(n=>i1007Text(all[n][ix['台帳ID']])),title:title.slice(0,90)});return;}
      const matched=candidates.length===1?candidates[0]:null;
      if(matched!==null){
        const old=all[matched];
        const oldUrl=i1007Url(old[ix['元ページURL']]);
        const oldSpotify=i1007Url(old[ix['Spotify個別URL']]);
        if((oldUrl&&oldUrl!==url)||(spotify&&oldSpotify&&oldSpotify!==spotify)){
          counts.held++;heldSamples.push({tab,row:i+2,reason:'CONFLICTING_EXISTING_URL',id:i1007Text(old[ix['台帳ID']]),title:title.slice(0,90)});return;
        }
        const flag=i1007Text(old[ix['人間除外']]).toLowerCase();
        if((flag&&!['未指定','false','0','なし'].includes(flag))||blockedIds.has(i1007Text(old[ix['台帳ID']]))){counts.held++;heldSamples.push({tab,row:i+2,reason:'HUMAN_EXCLUDED',id:i1007Text(old[ix['台帳ID']]),title:title.slice(0,90)});return;}
        for(const [col,val] of [['元ページURL',url],['公式個別URL',asahi],['Spotify個別URL',spotify],['Pocket Casts個別URL',pocket],['概要原文',i1007Text(r[14])],['概要清掃済み',i1007Clean(r[14])],['出演者・スタッフ',[r[5],r[6],r[7],r[8]].map(i1007Text).filter(Boolean).join(' / ')],['出演者1',i1007Text(r[5])],['出演者2',[r[6],r[7],r[8]].map(i1007Text).filter(Boolean).join(' / ')]]){if(val&&!i1007Text(old[ix[col]]))counts.fill++;}
        counts.matched++;
      }else{counts.new++;}
      plan.push({show,title,url,spotify,asahi,pocket,description:i1007Text(r[14]),date:i1007Date(r[1]),seconds:Number(r[3])||'',people:[r[5],r[6],r[7],r[8]].map(i1007Text).filter(Boolean).join(' / '),person1:i1007Text(r[5]),person2:[r[6],r[7],r[8]].map(i1007Text).filter(Boolean).join(' / '),matched});
    });
  });
  return {sheet,all,ix,header,plan,counts,heldSamples,maxId,usedIds};
}
/** PREVIEW: only returns concise counts. */
function previewImport1007SafeBatch(){const p=i1007Plan();const result={mode:'READ_ONLY',total:p.plan.length,counts:p.counts,heldSamples:p.heldSamples,batchSize:I1007_BATCH};Logger.log(JSON.stringify(result));return result;}
/** Explicit opt-in WRITE to isolated test ledger only. Run manually for each <=100-row batch. */
function runImport1007TestBatch(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw Error('Another import is running');
  try{
    const p=i1007Plan(),ss=p.sheet.getParent();
    if(ss.getId()!==I1007_TEST)throw Error('Refusing non-test sheet');
    const props=PropertiesService.getScriptProperties();
    const done=Number(props.getProperty('I1007_DONE')||0);
    // Always reconstruct plan against current ledger. Process first unseen/new or unfilled item;
    // no cursor is needed: each batch is idempotent, and existing values remain untouched.
    const updates=[],appends=[];let changed=0,scanned=0;
    const ix=p.ix,now=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd HH:mm');
    const lookup=new Map();
    p.all.forEach((r,i)=>{const k=i1007Text(r[ix['番組名']])+'|'+i1007Url(r[ix['元ページURL']]);if(!lookup.has(k))lookup.set(k,i);});
    let nextId=p.maxId;
    for(const item of p.plan){
      if(changed>=I1007_BATCH)break;
      const key=item.show+'|'+item.url;
      const at=lookup.has(key)?lookup.get(key):item.matched;
      if(at!==null&&at!==undefined){
        const row=p.all[at],mod=row.slice();let touched=false;
        const put=(col,val)=>{const j=ix[col];if(j!==undefined&&val&&!i1007Text(mod[j])){mod[j]=val;touched=true;}};
        put('元ページURL',item.url);put('公式個別URL',item.asahi);put('Spotify個別URL',item.spotify);
        put('Pocket Casts個別URL',item.pocket);put('概要原文',item.description);put('概要清掃済み',i1007Clean(item.description));put('出演者・スタッフ',item.people);put('出演者1',item.person1);put('出演者2',item.person2);
        if(touched){updates.push({row:at+2,values:mod});changed++;}
      }else{
        const row=Array(p.header.length).fill('');
        const put=(col,val)=>{if(ix[col]!==undefined)row[ix[col]]=val;};
        let id;do{id='EP-'+String(++nextId).padStart(5,'0');}while(p.usedIds.has(id));
        p.usedIds.add(id);
        put('台帳ID',id);put('番組名',item.show);put('タイトル',item.title);
        put('配信日時（JST）',item.date);put('媒体','音声');put('取得元','COPY_1007');
        put('元ページURL',item.url);put('公式個別URL',item.asahi);
        put('Spotify個別URL',item.spotify);put('Pocket Casts個別URL',item.pocket);
        put('概要原文',item.description);put('概要清掃済み',i1007Clean(item.description));put('出演者・スタッフ',item.people);put('出演者1',item.person1);put('出演者2',item.person2);
        put('再生時間（秒）',item.seconds);put('取得日時（JST）',now);
        put('人間除外','未指定');put('保留・備考','1007コピーから移行。音声未取得・未再生');
        appends.push(row);lookup.set(key,p.all.length+appends.length-1);changed++;
      }
      scanned++;
    }
    // Group appends in one request, and update only empty destination cells (not full rows).
    updates.forEach(u=>{
      const original=p.all[u.row-2];
      u.values.forEach((v,j)=>{
        if(v&&!i1007Text(original[j]))p.sheet.getRange(u.row,j+1).setValue(v);
      });
    });
    if(appends.length)p.sheet.getRange(p.sheet.getLastRow()+1,1,appends.length,p.header.length).setValues(appends);
    const out={mode:'TEST_WRITE',changed,updated:updates.length,appended:appends.length,scanned,remainingEstimate:Math.max(0,p.plan.length-done-changed),counts:p.counts};
    props.setProperty('I1007_DONE',String(done+changed));
    Logger.log(JSON.stringify(out));return out;
  }finally{lock.releaseLock();}
}
