import { filterEpisodes, safeUrl } from './library-core.mjs';
const $=id=>document.getElementById(id), cache=new Map();
let manifest, page=0, generation=0, activeResults=null, activeDetail=0;
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
 for(const e of items){const article=node('article',undefined,'episode'),top=node('div',undefined,'episode-top');top.append(node('span',label(e.show)),node('time',e.date.slice(0,10)));const title=node('h2'),button=node('button',e.title,'episode-title');button.type='button';button.addEventListener('click',()=>openDetail(e.id));title.append(button);article.append(top,title);if(e.cast)article.append(node('p',e.cast));article.append(node('span',e.audio?'▶ 音声あり':'配信先リンク・詳細を見る','badge'));fragment.append(article);}
 if(!items.length)fragment.append(node('p','条件に合うエピソードが見つかりませんでした。言葉や日付を変えてお試しください。','empty'));
 $('results').replaceChildren(fragment);$('status').textContent=`${total.toLocaleString()}件${criteria().query?' の検索結果':''}`;
 $('prev').disabled=page===0;$('next').disabled=(page+1)*40>=total;$('page-label').textContent=total?`${page+1} / ${Math.ceil(total/40)}`:'0 / 0';
}
async function update(reset=true) {
 if(!manifest)return;
 if(reset)page=0;
 const run=++generation,c=criteria();saveFilters(c);$('error').hidden=true;$('results').setAttribute('aria-busy','true');$('status').textContent='探しています…';$('prev').disabled=true;$('next').disabled=true;
 for(const button of $('shows').children)button.setAttribute('aria-pressed',String(button.dataset.show===c.show));
 try {
  if(c.from&&c.to&&c.from>c.to)throw Error('DATE_RANGE');
  let items,total;
  if(c.query||c.from||c.to) {
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
function linkLabel(url){const host=new URL(url).hostname;if(host.includes('spotify'))return 'Spotifyで聴く ↗';if(host.includes('apple'))return 'Apple Podcasts ↗';if(host.includes('asahi'))return '朝日新聞 公式ページ ↗';if(host.includes('youtube'))return 'YouTube ↗';if(host.includes('listen.style'))return 'LISTEN ↗';return '公式配信ページ ↗';}
function addLinks(parent,urls){for(const raw of [...new Set(urls)]){const url=safeUrl(raw);if(!url)continue;const a=node('a',linkLabel(url));a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}}
async function openDetail(id,fromUrl=false) {
 if(!/^EP-\d{5}$/.test(id))return;
 const run=++activeDetail,body=$('detail-content');body.replaceChildren(node('h2','読み込んでいます…'));if(!$('detail').open)$('detail').showModal();
 try{const rows=await json(`details/${Math.floor(Number(id.slice(3))/manifest.detailBucketSize)}.json`),e=rows.find(x=>x.id===id);if(run!==activeDetail)return;if(!e)throw Error('missing');
 const h=node('h2',e.title);h.id='detail-title';body.replaceChildren(node('p',`${label(e.show)} / ${e.id}`,'detail-meta'),h,node('p',`${e.date.replace('T',' ').slice(0,16)}（日本時間）${e.duration?' · '+Math.round(e.duration/60)+'分':''}`,'detail-meta'));
 if(e.cast)body.append(node('p',e.cast,'detail-meta'));
 if(e.audio){const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.hidden=true;const play=node('button','▶ この回を聴く');play.type='button';play.addEventListener('click',()=>{audio.hidden=false;audio.src=e.audio;play.hidden=true;audio.play().catch(()=>{note.textContent='プレーヤーの再生ボタン、または配信先リンクからお聴きください。';});});const note=node('p','配信元の音声です。再生ボタンを押すと読み込みます。','audio-note');audio.addEventListener('error',()=>{note.textContent='音声を読み込めませんでした。配信先リンクからお聴きください。';});body.append(play,audio,note);}
 else body.append(node('p','この回は配信先リンクからお聴きください。','audio-note'));
 const links=node('div',undefined,'detail-links');addLinks(links,e.links);if(!links.children.length)addLinks(links,['https://www.asahi.com/special/podcasts/']);body.append(links,node('p',e.description || '概要欄は未収録です。公式ページをご確認ください。','description'));
 if(e.related.length){body.append(node('h3','関連記事'));const related=node('div',undefined,'detail-links');addLinks(related,e.related);body.append(related);}
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
async function init(){try{manifest=await json('manifest.json');$('snapshot').textContent=`収録 ${manifest.total.toLocaleString()}件 · ${manifest.snapshotDate}更新`;for(const s of manifest.shows){const option=node('option',s.label);option.value=s.name;$('show').append(option);const button=node('button',`${s.label} ${s.count.toLocaleString()}`);button.type='button';button.dataset.show=s.name;button.addEventListener('click',()=>{$('show').value=$('show').value===s.name?'':s.name;update();});$('shows').append(button);}const params=new URL(location.href).searchParams;for(const [id,param] of [['query','q'],['show','show'],['order','order'],['from','from'],['to','to']])if(params.get(param))$(id).value=params.get(param);if(!$('order').value)$('order').value='newest';await update();if(params.get('ep'))await openDetail(params.get('ep'),true);}catch{error('図書館を読み込めませんでした。時間をおいて再試行してください。');$('status').textContent='通信エラー';}}
init();
