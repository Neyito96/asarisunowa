import { stampText } from './stamp.mjs';
import { publicationLabel } from './publication-scope.mjs';
import { tidyDescription, withoutAwardPlea, descriptionLines } from './description-tidy.mjs?v=tidy-lines-20261127';
import { qrSvg } from './qr.mjs';
import { filterEpisodes, safeUrl, normal, showSearchText } from './library-core.mjs?v=alias-20261119';
const $=id=>document.getElementById(id), cache=new Map();
let manifest, page=0, generation=0, activeResults=null, activeDetail=0;
import { SHELF_KEY, SHELF_LIMITS, readShelf, serializeShelf, toggleItem, moveItem, setMeta, encodeShare, decodeShare, cardLinks, listenLinks, liveLinks, isMovedLink, MOVED_LINK_NOTE } from './shelf-core.mjs';
// 自分の蔵書一覧（#315）: 利用者が選んだ回だけを、この端末のブラウザに保存する（会員登録・送信なし）。検索の言葉や閲覧の記録は保存しない
function loadShelf(){try{return readShelf(localStorage.getItem(SHELF_KEY));}catch{return readShelf(null);}}
function saveShelf(next){try{localStorage.setItem(SHELF_KEY,serializeShelf(next));return true;}catch{return false;}}
function shelfIds(){return loadShelf().ids;}
function shelfToggle(id){const before=loadShelf(),next=toggleItem(before,id);if(next.ids.length===before.ids.length&&!before.ids.includes(id))return null;if(!saveShelf(next))return null;refreshShelfButton();return next.ids.includes(id);}
// 蔵書を推薦として朝リスに届ける（#345）。本番GAS「朝リスの輪」の専用デプロイ（ポす神回と同じ）・type=shelfSubmit。保存先は本番スプレッドシートの「蔵書推薦・受付」（承認待ち）
const SHELF_SUBMIT_ENDPOINT='https://script.google.com/macros/s/AKfycbzwlb2aoRrCcs4zaBljBorMzWlMS3JM_6OLjrpHlY7NvMf4BLXNiNqRbhDTQVUHYqqB_A/exec',SHELF_SUBMIT_ENABLED=true;
function jsonp(url,params){return new Promise((resolve,reject)=>{const cb='shelfcb'+Date.now()+Math.floor(Math.random()*1e4),q=new URLSearchParams({...params,callback:cb}),sc=document.createElement('script');const done=()=>{delete window[cb];sc.remove();};const t=setTimeout(()=>{done();reject(Error('TIMEOUT'));},20000);window[cb]=d=>{clearTimeout(t);done();resolve(d);};sc.onerror=()=>{clearTimeout(t);done();reject(Error('NETWORK'));};sc.src=url+'?'+q.toString();document.head.append(sc);});}
const SHELF_ADD='📚 ＋ 蔵書に入れる',SHELF_IN='✓ 蔵書にあります（外す）';
function shelfControl(id){const saved=shelfIds().includes(id),b=node('button',saved?SHELF_IN:SHELF_ADD,'quiet shelf-save');b.type='button';b.setAttribute('aria-pressed',String(saved));b.addEventListener('click',()=>{const r=shelfToggle(id);if(r===null){b.textContent=loadShelf().ids.length>=SHELF_LIMITS.items?`いっぱいです（最大${SHELF_LIMITS.items}件）`:'保存できませんでした（ブラウザの設定をご確認ください）';return;}b.textContent=r?SHELF_IN:SHELF_ADD;b.setAttribute('aria-pressed',String(r));shelfToast(r?`蔵書に入れました（${loadShelf().ids.length}件）`:'蔵書から外しました');});return b;}
// 入れた・外したことが分かるように、画面の下に短く知らせる（「蔵書を開く」から一覧へ）
const toast=node('div',undefined,'shelf-toast');toast.setAttribute('role','status');toast.hidden=true;document.body.append(toast);let toastTimer=0;
function shelfToast(text){const open=node('button','蔵書を開く','quiet');open.type='button';open.addEventListener('click',()=>{toast.hidden=true;openShelf();});toast.replaceChildren(node('span',text),open);toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},5000);}

const criteria=()=>({query:$('query').value.trim(),show:$('show').value,order:$('order').value,from:$('from').value,to:$('to').value});
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
async function json(path) {
 const key=`${path}?v=${manifest?.version || ''}`;
 if(!cache.has(key)) cache.set(key,fetch(`./data/${key}`,path==='manifest.json'?{cache:'no-store'}:{}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}).catch(e=>{cache.delete(key);throw e;}));
 return cache.get(key);
}
function error(message){$('error').hidden=false;$('error').querySelector('p').textContent=message;}
function saveFilters(c){const u=new URL(location.href);for(const [k,v] of Object.entries({q:c.query,show:c.show,order:c.order==='newest'?'':c.order,from:c.from,to:c.to})){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);}history.replaceState({},'',u);}
function label(show){return manifest.shows.find(x=>x.name===show)?.label || show;}
function renderList(items,total) {
 const fragment=document.createDocumentFragment();
 for(const e of items){const article=node('article',undefined,'episode'),top=node('div',undefined,'episode-top');top.append(node('span',label(e.show)),node('time',e.date.slice(0,10)));const title=node('h2'),button=node('button',e.title,'episode-title');button.type='button';button.addEventListener('click',()=>openDetail(e.id));title.append(button);article.append(top,title);if(e.cast)article.append(node('p',e.cast));const actions=node('div',undefined,'episode-actions'),more=node('button',e.audio?'▶ 聴く・詳細':'配信先・詳細を見る','quiet episode-more');more.type='button';more.addEventListener('click',()=>openDetail(e.id));actions.append(more,shelfControl(e.id));article.append(actions);fragment.append(article);}
 if(!items.length)fragment.append(node('p','条件に合うエピソードが見つかりませんでした。言葉や日付を変えてお試しください。','empty'));
 $('results').replaceChildren(fragment);$('status').textContent=`${total.toLocaleString()}件${criteria().query?' の検索結果':''}`;
 $('prev').disabled=page===0;$('next').disabled=(page+1)*40>=total;$('page-label').textContent=total?`${page+1} / ${Math.ceil(total/40)}`:'0 / 0';
}
// 速い検索（#350）: lite（題名・出演者・番組・日付）で即座に結果を出し、概要・関連記事の見出し（text）は並列で後から足して結果を更新する
let lite=null;const textHay=new Map(),textLoaded=new Set();
async function loadLite(){if(lite)return lite;const si=manifest.searchIndex,rows=await json(si.lite);lite=rows.map(([id,si2,date,title,cast,audio])=>{const show=si.shows[si2];return {id,show,date,title,cast,audio:!!audio,hay:normal(`${showSearchText(show)} ${title} ${cast} ${id}`)};});return lite;}
function loadText(file){if(textLoaded.has(file))return Promise.resolve();return json(file).then(rows=>{for(const [id,t] of rows)textHay.set(id,normal(t));textLoaded.add(file);});}
function fastFilter(c){const terms=normal(c.query).split(' ').filter(Boolean),dir=c.order==='oldest'?1:-1;
 return lite.filter(x=>(!c.show||x.show===c.show)&&(!c.from||x.date.slice(0,10)>=c.from)&&(!c.to||x.date.slice(0,10)<=c.to)&&terms.every(t=>x.hay.includes(t)||(textHay.get(x.id)||'').includes(t))).sort((a,b)=>dir*a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
async function update(reset=true) {
 if(!manifest)return;
 if(reset)page=0;
 const run=++generation,c=criteria();saveFilters(c);$('error').hidden=true;$('results').setAttribute('aria-busy','true');$('status').textContent='探しています…';$('prev').disabled=true;$('next').disabled=true;
 for(const button of $('shows').children)button.setAttribute('aria-pressed',String(button.dataset.show===c.show));
 try {
  if(c.from&&c.to&&c.from>c.to)throw Error('DATE_RANGE');
  let items,total;
  if((c.query||c.from||c.to)&&manifest.searchIndex) {
   await loadLite();if(run!==generation)return;
   const show=()=>{activeResults=fastFilter(c);const t=activeResults.length;renderList(activeResults.slice(page*40,page*40+40),t);};
   show();
   const files=manifest.searchIndex.text.filter(f=>!textLoaded.has(f));
   if(c.query&&files.length){$('status').textContent+='（概要・関連記事の見出しも確認中…）';
    let i=0;const worker=async()=>{while(i<files.length){const f=files[i++];await loadText(f);if(run!==generation)return;show();if(textLoaded.size<manifest.searchIndex.text.length)$('status').textContent+='（概要・関連記事の見出しも確認中…）';}};
    await Promise.all([worker(),worker(),worker(),worker()]);if(run!==generation)return;show();}
   $('results').setAttribute('aria-busy','false');return;
  } else if(c.query||c.from||c.to) {
   const paths=manifest.shows.filter(s=>!c.show||s.name===c.show).flatMap(s=>s.search),rows=[];
   // Bounded concurrency: don't launch all programme downloads at once.
   for(let i=0;i<paths.length;i+=2){const chunks=await Promise.all(paths.slice(i,i+2).map(json));if(run!==generation)return;rows.push(...chunks.flat());}
   activeResults=filterEpisodes(rows,c);total=activeResults.length;items=activeResults.slice(page*40,page*40+40);
  } else {
   activeResults=null;const group=manifest.shows.find(s=>s.name===c.show),paths=group?.pages || manifest.pages;total=group?.count ?? manifest.total;
   const index=c.order==='oldest'?paths.length-1-page:page;
   // For oldest order, the last chunk can be shorter; fill a 40-item viewport
   // from two adjacent chunks and slice by absolute offsets.
   if(c.order==='oldest'){
    const start=Math.max(0,total-(page+1)*40),end=total-page*40,first=Math.floor(start/40),last=Math.floor((end-1)/40);
    const chunks=await Promise.all(paths.slice(first,last+1).map(json));items=chunks.flat().slice(start-first*40,end-first*40).reverse();
   }else items=await json(paths[index]);
  }
  if(run!==generation)return;renderList(items,total);
 }catch(e){if(run===generation){$('status').textContent='読み込みを完了できませんでした';error(e.message==='DATE_RANGE'?'配信日の開始日を終了日以前にしてください。':'通信に失敗しました。条件を変えずに再試行できます。');}}
 finally{if(run===generation)$('results').setAttribute('aria-busy','false');}
}
function linkLabel(url){const host=new URL(url).hostname;if(host.includes('spotify'))return 'Spotify ↗';if(host.includes('apple'))return 'Apple Podcasts ↗';if(host==='pca.st')return 'Pocket Casts ↗';if(host==='pody.jp')return 'Pody ↗';if(host.startsWith('music.amazon.'))return 'Amazon Music ↗';if(host.includes('asahi'))return '朝日新聞 公式ページ ↗';if(host.includes('youtube'))return 'YouTube ↗';if(host.includes('listen.style'))return 'LISTEN ↗';if(host==='omny.fm'&&new URL(url).pathname.endsWith('/embed'))return 'Omny ↗';return '公式配信ページ ↗';}
function addLinks(parent,urls){for(const raw of [...new Set(urls)]){const url=safeUrl(raw);if(!url)continue;const a=node('a',linkLabel(url));a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}}
async function openDetail(id,fromUrl=false) {
 if(!/^EP-\d{5}$/.test(id))return;
 const run=++activeDetail,body=$('detail-content');body.replaceChildren(node('h2','読み込んでいます…'));if(!$('detail').open)$('detail').showModal();
 try{const rows=await json(`details/${Math.floor(Number(id.slice(3))/manifest.detailBucketSize)}.json`),e=rows.find(x=>x.id===id);if(run!==activeDetail)return;if(!e)throw Error('missing');
 const h=node('h2',e.title);h.id='detail-title';body.replaceChildren(node('p',`${label(e.show)} / ${e.id}`,'detail-meta'),h,node('p',`${e.date.replace('T',' ').slice(0,16)}（日本時間）${e.duration?' · '+Math.round(e.duration/60)+'分':''}`,'detail-meta'));
 if(e.archiveWarning)body.append(node('p',e.archiveWarning,'audio-note'));
 if(e.cast)body.append(node('p',e.cast,'detail-meta'));
 if(e.audio){const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.hidden=true;const play=node('button','▶ この回を聴く');play.type='button';play.addEventListener('click',()=>{audio.hidden=false;audio.src=e.audio;play.hidden=true;audio.play().catch(()=>{note.textContent='プレーヤーの再生ボタン、または配信先リンクからお聴きください。';});});const note=node('p','配信元の音声です。再生ボタンを押すと読み込みます。','audio-note');audio.addEventListener('error',()=>{note.textContent='音声を読み込めませんでした。配信先リンクからお聴きください。';});body.append(play,audio,note);}
 else body.append(node('p','この回は配信先リンクからお聴きください。','audio-note'));
 const links=node('div',undefined,'detail-links');addLinks(links,listenLinks(liveLinks(e,e.links)).map(l=>l.url));if(!links.children.length)addLinks(links,['https://www.asahi.com/special/podcasts/']);if((e.links||[]).some(u=>isMovedLink(e,u)))links.append(node('p',MOVED_LINK_NOTE,'moved-note'));const tidy=tidyDescription(e.description),useTidy=tidy.status==='TIDY'||tidy.status==='AS_IS';body.append(links,node('p',tidy.status==='PROMO_ONLY'?'公式の概要欄は番組の告知だけで、この回の内容の説明はありません。':(descriptionLines(useTidy?tidy.body:withoutAwardPlea(e.description)) || '概要欄は未収録です。公式ページをご確認ください。'),'description'));
 {const u=document.createElement('a');u.textContent='✦ 朝リスの宇宙でこの回を見る ↗';u.href=`../uchu/#e=${encodeURIComponent(e.id)}`;u.target='_blank';u.rel='noopener';const p=node('p',undefined,'detail-meta to-uchu');p.append(u);body.append(p);}   // 蔵→宇宙（どの分類のあたりの星か、近い回）
 if(useTidy&&tidy.recordedAt&&!e.recording?.length)body.append(node('p',`${tidy.recordedAt}に収録`,'detail-meta'));
 // 概要の【関連記事】を1件ずつリンクに（概要にあったURLだけ。データ側の関連記事があればそちらを優先）
 if(useTidy&&tidy.related.length&&!e.related.length){body.append(node('h3','関連記事'));const list=node('ul',undefined,'related-list');for(const r of tidy.related){const url=safeUrl(r.url);if(!url)continue;const li=node('li'),a=node('a',r.title||url);a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);}body.append(list);}
 if(e.staffDetails?.length){body.append(node('h3','出演・スタッフ'));for(const line of e.staffDetails)body.append(node('p',line));}
 if(e.recording?.length)body.append(node('p',e.recording.join(' '),'detail-meta'));
 // 関連記事（#308）: 見出し（SC4-18が原文から取った物）をリンクにし、URLも表示。パソコンでは押すとQRコードを出す（外部に送らずブラウザ内で作る）
 if(e.related.length){body.append(node('h3','関連記事'));const list=node('ul',undefined,'related-list');
  const items=e.relatedArticles?.length?e.relatedArticles:[...new Set(e.related)].map(u=>({title:'',url:u}));
  const pc=!!window.matchMedia?.('(min-width: 900px) and (pointer: fine)').matches;
  for(const art of items){const url=safeUrl(art.url);if(!url)continue;const li=node('li',undefined,'related-article');
   const a=node('a',(art.title||'記事（見出し未確認）')+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);
   const u=new URL(url),shown=(u.hostname+u.pathname).replace(/\/$/,'');li.append(node('small',shown.length>70?shown.slice(0,69)+'…':shown,'related-url'));
   if(pc){const b=node('button','QRコード','quiet related-qr-btn');b.type='button';b.setAttribute('aria-expanded','false');b.addEventListener('click',()=>{let box=li.querySelector('.related-qr');if(box){box.remove();b.setAttribute('aria-expanded','false');return;}box=node('div',undefined,'related-qr');box.innerHTML=qrSvg(url,{label:(art.title||'関連記事')+'のQRコード'});box.append(node('small','スマホのカメラで読み取ると記事が開きます'));li.append(box);b.setAttribute('aria-expanded','true');});li.append(b);}
   list.append(li);}
  body.append(list);}
 body.append(shelfControl(id));
 const share=node('button','この回のリンクをコピー','quiet');share.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);share.textContent='コピーしました';}catch{share.textContent='アドレス欄からリンクをコピーできます';}});body.append(share);
 if(!fromUrl){const url=new URL(location.href);url.searchParams.set('ep',id);history.replaceState({},'',url);}
 }catch{if(run===activeDetail)body.replaceChildren(node('h2','詳細を読み込めませんでした'),node('p','一覧に戻り、もう一度お試しください。'));}
}
$('close-detail').addEventListener('click',()=>$('detail').close());
$('detail').addEventListener('close',()=>{activeDetail++;const audio=$('detail').querySelector('audio');if(audio){audio.pause();audio.removeAttribute('src');audio.load();}const u=new URL(location.href);u.searchParams.delete('ep');history.replaceState({},'',u);});
$('search-form').addEventListener('submit',e=>{e.preventDefault();update();});
for(const id of ['show','order','from','to'])$(id).addEventListener('change',()=>update());
$('clear-filters').addEventListener('click',()=>{$('search-form').reset();update();});
$('prev').addEventListener('click',()=>{if(page>0){page--;update(false);}});$('next').addEventListener('click',()=>{page++;update(false);});
$('retry').addEventListener('click',()=>manifest?update(false):init());
// ===== 自分の蔵書一覧（並べ替え・タイトル・説明・共有の準備）=====
const shelfBar=node('div',undefined,'shelf-toolbar');const shelfButton=node('button','','quiet');shelfButton.type='button';shelfBar.append(shelfButton,node('small','気になる回を「＋ 蔵書に入れる」で集めて、あとで聴く・URLで人に渡す。保存はこのブラウザだけ（会員登録不要・検索の記録は残しません）。'));$('results').before(shelfBar);
function refreshShelfButton(){shelfButton.textContent=`📚 わたしの蔵書（${loadShelf().ids.length}）`;}
const shelfDialog=node('dialog',undefined,'shelf-dialog');shelfDialog.setAttribute('aria-labelledby','shelf-title');document.body.append(shelfDialog);
async function episodeById(id){const rows=await json(`details/${Math.floor(Number(id.slice(3))/manifest.detailBucketSize)}.json`).catch(()=>[]);return rows.find(x=>x.id===id)||null;}
async function openShelf(){shelfDialog.replaceChildren(node('p','読み込んでいます…'));if(!shelfDialog.open)shelfDialog.showModal();await renderShelf();}
async function renderShelf(){
 const s=loadShelf(),body=document.createDocumentFragment(),close=node('button','×','close');close.type='button';close.setAttribute('aria-label','蔵書を閉じる');close.addEventListener('click',()=>shelfDialog.close());
 const h=node('h2','📚 わたしの蔵書');h.id='shelf-title';body.append(close,h,node('p','このブラウザだけに保存されています。別の端末とは同期しません。閲覧履歴を消すと一覧も消えることがあります。','detail-meta'));
 const t=node('input');t.type='text';t.maxLength=SHELF_LIMITS.title;t.value=s.title;t.placeholder='蔵書の名前（例：通勤で聴きたい回）※URLで渡すと表示されます';t.addEventListener('change',()=>saveShelf(setMeta(loadShelf(),{title:t.value})));
 const d=node('textarea');d.maxLength=SHELF_LIMITS.description;d.rows=2;d.value=s.description;d.placeholder='説明（任意）';d.addEventListener('change',()=>saveShelf(setMeta(loadShelf(),{description:d.value})));
 const lt=node('label','タイトル');lt.append(t);const ld=node('label','説明');ld.append(d);body.append(lt,ld);
 if(!s.ids.length){body.append(node('p','まだ何も入っていません。検索結果や各回の詳細で「＋ 蔵書に入れる」を押すと、ここに並びます。聴きたい回を集めたり、おすすめの回をまとめてURLで人に渡したりできます。','empty'));shelfDialog.replaceChildren(body);return;}
 const list=node('ol',undefined,'shelf-list');
 const eps=await Promise.all(s.ids.map(episodeById));
 s.ids.forEach((id,i)=>{const e=eps[i],li=node('li');const name=node('button',e?e.title:`${id}（現在は公開されていない回です）`,'episode-title');name.type='button';if(e)name.addEventListener('click',()=>{shelfDialog.close();openDetail(id);});
  li.append(node('small',e?`${label(e.show)} · ${e.date.slice(0,10)}`:id),name);
  if(e){const ls=cardLinks(liveLinks(e,e.links));if(ls.length){const lk=node('div',undefined,'detail-links shelf-listen');lk.append(node('span','聴く：'));for(const l of ls){const a=node('a',l.label+' ↗');a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';lk.append(a);}li.append(lk);}}
  const ctl=node('span',undefined,'shelf-controls');for(const [txt,fn,lab] of [['↑',()=>saveShelf(moveItem(loadShelf(),id,-1)),'上へ'],['↓',()=>saveShelf(moveItem(loadShelf(),id,1)),'下へ'],['外す',()=>saveShelf(toggleItem(loadShelf(),id)),'一覧から外す']]){const b=node('button',txt,'quiet');b.type='button';b.setAttribute('aria-label',`${e?e.title:id}を${lab}`);b.addEventListener('click',async()=>{fn();refreshShelfButton();await renderShelf();});ctl.append(b);}
  li.append(ctl);list.append(li);});
 body.append(list);
 const prep=node('button','🔗 URLで人に渡す');prep.type='button';prep.addEventListener('click',()=>renderSharePreview(eps.filter(Boolean)));
 const send=node('button','📮 朝リスに推薦する','quiet');send.type='button';send.hidden=!SHELF_SUBMIT_ENABLED;send.addEventListener('click',()=>renderRecommend(eps.filter(Boolean)));
 const wipe=node('button','この端末から一覧を消す','quiet');wipe.type='button';let armed=false;wipe.addEventListener('click',async()=>{if(!armed){armed=true;wipe.textContent='本当に消す（もう一度押す）';return;}try{localStorage.removeItem(SHELF_KEY);}catch{}refreshShelfButton();await renderShelf();});
 body.append(node('div',undefined,'shelf-actions'));body.lastChild.append(prep,send,wipe);shelfDialog.replaceChildren(body);
}
function renderRecommend(eps){
 shelfDialog.querySelector('.recommend-box')?.remove();
 const s=loadShelf(),box=node('section',undefined,'share-preview recommend-box');
 box.append(node('h3','📮 朝リスに推薦する'),node('p',`この蔵書（${eps.length}回）を、テーマ選びやプレイリストの参考として管理人に届けます。送るのは回番号・蔵書名・説明と、下のひとこと・ニックネーム（どちらも任意）だけです。管理人が確認してから使います。`));
 const note=node('textarea');note.maxLength=300;note.rows=2;note.placeholder='ひとこと（任意）例：雨の日に聴きたい回を集めました';
 const nick=node('input');nick.type='text';nick.maxLength=30;nick.placeholder='ニックネーム（任意）';
 const hp=node('input');hp.type='text';hp.name='website2';hp.tabIndex=-1;hp.autocomplete='off';hp.className='hp';hp.setAttribute('aria-hidden','true');
 const spw=node('label',undefined,'spotify-wish'),sp=node('input');sp.type='checkbox';spw.append(sp,document.createTextNode(' 🎧 Spotifyプレイリストにしてほしい（管理人が確認してから、Spotifyにある回だけを入れます）'));
 const go=node('button','この内容で送る'),out=node('p');out.setAttribute('role','status');go.type='button';
 go.addEventListener('click',async()=>{if(!eps.length){out.textContent='蔵書に回が入っていません。';return;}go.disabled=true;out.textContent='送っています…';
  try{const r=await jsonp(SHELF_SUBMIT_ENDPOINT,{type:'shelfSubmit',ids:eps.map(e=>e.id).join(','),title:s.title||'',description:s.description||'',note:note.value,nick:nick.value,spotify:sp.checked?'1':'',website2:hp.value});out.textContent=r&&r.ok?`${r.message}（受付番号 ${r.receiptId}）`:((r&&r.message)||'送れませんでした。');if(!(r&&r.ok))go.disabled=false;}
  catch{out.textContent='送れませんでした。通信状態を確かめて、もう一度お試しください。';go.disabled=false;}});
 box.append(note,nick,spw,hp,go,out);shelfDialog.append(box);box.scrollIntoView({block:'start'});
}
function renderSharePreview(eps){
 const s=loadShelf(),box=node('section',undefined,'share-preview');box.append(node('h3','URLで人に渡す'),node('p','共有URLに入るのは、下でチェックした回の番号と、一覧のタイトル・説明だけです。お名前・メールアドレス・検索の言葉・端末の情報は入りません。URLを知っている人は誰でも見られます。サーバーに保存しないので、発行したURLは取り消せません（渡す相手を選んでください）。','detail-meta'));
 const picks=new Map();const ul=node('ul',undefined,'share-picks');for(const e of eps){const li=node('li'),l=node('label'),c=node('input');c.type='checkbox';c.checked=true;picks.set(e.id,c);l.append(c,document.createTextNode(` ${e.title}（${label(e.show)}）`));li.append(l);ul.append(li);}
 box.append(node('p',`タイトル：${s.title||'（なし）'}`),node('p',`説明：${s.description||'（なし）'}`),ul);
 const make=node('button','共有URLを作る');make.type='button';const out=node('div',undefined,'share-out');
 make.addEventListener('click',()=>{const ids=s.ids.filter(id=>picks.get(id)?.checked);const frag=encodeShare({title:s.title,description:s.description,ids});if(!frag){out.replaceChildren(node('p','共有する回を1つ以上選んでください。'));return;}
  const url=new URL(location.href);url.search='';url.hash=frag;const field=node('input');field.type='url';field.readOnly=true;field.value=url.href;const copy=node('button','コピー','quiet');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(field.value);copy.textContent='コピーしました';}catch{field.select();copy.textContent='選択しました。手動でコピーしてください';}});
  const open=node('a','共有された画面を確かめる ↗');open.href=url.href;open.target='_blank';open.rel='noopener noreferrer';out.replaceChildren(field,copy,open);});
 box.append(make,out);shelfDialog.append(box);box.scrollIntoView({block:'start'});
}
shelfButton.addEventListener('click',openShelf);refreshShelfButton();
// ===== 共有URLで開いたとき: 共有された蔵書カードを出す（アカウント不要。この端末には保存しない）=====
async function renderShared(){
 const data=decodeShare(location.hash);const old=$('shared');if(old)old.remove();if(!data)return;
 const sec=node('section',undefined,'shared-shelf');sec.id='shared';sec.setAttribute('aria-label','共有された蔵書');
 sec.append(node('p','共有された蔵書','eyebrow'),node('h2',data.title||'蔵書'));if(data.description)sec.append(node('p',data.description,'shared-desc'));
 const eps=await Promise.all(data.ids.map(episodeById)),grid=node('div',undefined,'shared-cards');
 data.ids.forEach((id,i)=>{const e=eps[i],card=node('article',undefined,'shared-card');
  if(!e){card.append(node('p','この回は現在、蔵で公開されていません。','empty'));grid.append(card);return;}
  card.append(node('small',`${label(e.show)} · ${e.date.slice(0,10)}`),node('h3',e.title));
  const links=node('div',undefined,'detail-links');const detail=node('a','蔵で詳しく見る');detail.href=`?ep=${e.id}`;detail.addEventListener('click',ev=>{ev.preventDefault();openDetail(e.id);});links.append(detail);
  for(const l of cardLinks(liveLinks(e,e.links))){const a=node('a',l.label+' ↗');a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
  card.append(links);grid.append(card);});
 const take=node('button','この蔵書をわたしの蔵書に入れる','quiet');take.type='button';take.addEventListener('click',()=>{let s=loadShelf();for(const id of data.ids)if(eps[data.ids.indexOf(id)]&&!s.ids.includes(id))s=toggleItem(s,id);if(saveShelf(s)){take.textContent='入れました（このブラウザに保存）';refreshShelfButton();}});
 sec.append(grid,take,node('p','共有した人の名前や、ほかに保存している回は表示されません。','detail-meta'));
 $('search-form').before(sec);
}
window.addEventListener('hashchange',()=>{if(manifest)renderShared();});
async function showStamp(){try{const u=await fetch('../uchu/data/manifest.json',{cache:'no-store'}).then(r=>r.ok?r.json():{});const t=stampText({generatedAt:manifest.generatedAt||u.generatedAt,newest:u.newest,app:u.apps?.library});if(t){const p=document.createElement('span');p.className='stamp';p.textContent=t;$('snapshot').append(document.createElement('br'),p);}}catch{}}   // データ更新とアプリ版（#430）
async function init(){try{manifest=await json('manifest.json');$('snapshot').textContent=publicationLabel(manifest);showStamp();for(const s of manifest.shows){const option=node('option',s.label);option.value=s.name;$('show').append(option);const button=node('button',`${s.label} ${s.count.toLocaleString()}`);button.type='button';button.dataset.show=s.name;button.addEventListener('click',()=>{$('show').value=$('show').value===s.name?'':s.name;update();});$('shows').append(button);}const params=new URL(location.href).searchParams;for(const [id,param] of [['query','q'],['show','show'],['order','order'],['from','from'],['to','to']])if(params.get(param))$(id).value=params.get(param);if(!$('order').value)$('order').value='newest';await update();await renderShared();if(params.get('ep'))await openDetail(params.get('ep'),true);}catch{error('図書館を読み込めませんでした。時間をおいて再試行してください。');$('status').textContent='通信エラー';}}
init();
