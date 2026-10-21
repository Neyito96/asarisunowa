import{topics,browse,libraryLink,validateSample}from'./model.mjs';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};let selected='';
async function init(){
 const response=await fetch('./sample.json');if(!response.ok)throw Error('sample');const data=validateSample(await response.json());
 for(const topic of Object.keys(topics)){const o=node('option',topic);o.value=topic;$('topic').append(o);}
 function render(){
  const filter={month:selected,topic:$('topic').value,query:$('query').value};$('strata').replaceChildren();
  for(let year=2020;year<=2026;year++){
   const row=node('div');row.className='stratum';row.append(node('h3',String(year)));const months=node('div');months.className='months';
   for(let month=1;month<=12;month++){
    const key=year+'-'+String(month).padStart(2,'0'),matches=browse(data,{...filter,month:key}),b=node('button',month+'月');b.type='button';b.className=matches.length?'month has-sample':'month';b.setAttribute('aria-label',key+(matches.length?' サンプルあり':' サンプルなし'));b.setAttribute('aria-pressed',String(selected===key));b.addEventListener('click',()=>{selected=selected===key?'':key;render();});months.append(b);
   }row.append(months);$('strata').append(row);
  }
  $('selection').textContent=(selected||'全期間')+' / '+(filter.topic||'すべての話題')+' / サンプルのみ';$('results').replaceChildren();
  const found=browse(data,filter);
  for(const e of found){const card=node('article'),meta=node('p',e.month+' · '+e.show);meta.className='meta';const heading=node('h3'),link=node('a',e.title);link.href=libraryLink(e.id);heading.append(link);card.append(meta,heading,node('p',[...new Set(e.topics.map(t=>t.topic))].join(' / ')),node('small',e.id+' · 話題判定はタイトル由来の候補'));$('results').append(card);}
  if(!found.length)$('results').append(node('p','この条件のサンプルはありません。実際の配信・収蔵の有無は示しません。'));
 }
 $('topic').addEventListener('change',render);$('query').addEventListener('input',render);$('clear').addEventListener('click',()=>{selected='';$('topic').value='';$('query').value='';render();});render();
}
init().catch(()=>{$('error').textContent='試作データを読み込めませんでした。ローカルHTTPサーバー経由で開いてください。';});
