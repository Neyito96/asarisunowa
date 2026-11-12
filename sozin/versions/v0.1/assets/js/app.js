(()=>{'use strict';
const P={pdf:{base:20000,perPage:5000},flip:{base:35000,extra2:8000},poster:{A2:{1:5500,10:16200,50:18300,100:20500},B2:{1:6500,10:23700,50:25900,100:28000},A1:{1:9500,10:38000}},banner:{standard:28000,slim:26000,posterStandard:15000,posterSlim:13000},setDigital:{fileOnly:2000,fileAndUrl:2500}};
const $=id=>document.getElementById(id), yen=n=>n.toLocaleString('ja-JP')+'円';
const names={program:'紙の発表会プログラム',pdf:'デジタルプログラム・PDF版',flip:'ページめくりデジタルブック',poster:'ポスター',banner:'バナースタンド',setDigital:'印刷物セット・デジタル納品',other:'チケット・チラシなど'};
const number=(id,label,min,max,val)=>'<label class="field-label" for="'+id+'">STEP 2 <span>'+label+'</span></label><input id="'+id+'" type="number" min="'+min+'" max="'+max+'" value="'+val+'" inputmode="numeric">';
const select=(id,label,opts)=>'<label class="field-label" for="'+id+'">STEP 2 <span>'+label+'</span></label><select id="'+id+'">'+opts.map(([a,b])=>'<option value="'+a+'">'+b+'</option>').join('')+'</select>';
const fields={
program:()=>'<div class="callout">紙のプログラムは仕様により個別見積もりとなります。正式料金はLINEでご相談ください。</div>'+number('pages','ページ数',4,200,16)+number('copies','印刷部数',1,100000,300),
pdf:()=>number('pages','総ページ数',1,300,2),
flip:()=>number('pages','総ページ数',4,300,4),
poster:()=>select('size','サイズ',[['A2','A2'],['B2','B2'],['A1','A1']])+select('copies','枚数',[[1,'1枚'],[10,'10枚'],[50,'50枚'],[100,'100枚']]),
banner:()=>select('variant','商品タイプ',[['standard','スタンダード（スタンド付き）'],['slim','スリム（スタンド付き）'],['posterStandard','交換用ポスター・スタンダード'],['posterSlim','交換用ポスター・スリム']]),
setDigital:()=>number('pages','総ページ数',1,300,8)+select('delivery','納品方法',[['fileOnly','データのみ'],['fileAndUrl','データ＋閲覧URL（1年間）']]),
other:()=>'<div class="callout">チケット・チラシ等は個別見積もりでご案内します。</div>'
};
let summary='';
function update(){const type=$('product').value,lines=[names[type]],notes=[];let total=null;
const val=id=>$(id)?.value,num=id=>Number(val(id)),valid=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
if(type==='pdf'){const n=num('pages');lines.push(n+'ページ');if(valid(n,1,300))total=P.pdf.base+Math.max(0,n-2)*P.pdf.perPage;}
if(type==='flip'){const n=num('pages');lines.push(n+'ページ');if(valid(n,4,300)){total=P.flip.base+Math.ceil(Math.max(0,n-4)/2)*P.flip.extra2;if((n-4)%2)notes.push('追加ページは2ページ単位で計算。');}}
if(type==='poster'){const s=val('size'),n=num('copies');lines.push(s+'・'+n+'枚');total=P.poster[s]?.[n]??null;notes.push('プログラムとセット・同デザイン利用の掲載料金。');}
if(type==='banner'){const v=val('variant');lines.push($('variant').selectedOptions[0].textContent);total=P.banner[v]??null;notes.push('プログラムとセット・同デザイン利用の掲載料金。');}
if(type==='setDigital'){const n=num('pages'),kind=val('delivery');lines.push(n+'ページ・'+$('delivery').selectedOptions[0].textContent);if(valid(n,1,300))total=n*P.setDigital[kind];notes.push('印刷物とのセット料金。印刷物の料金は含みません。');}
if(type==='program')lines.push(num('pages')+'ページ・'+num('copies')+'部');
if(total!==null)notes.push('税込参考価格。送料・特急料金・特殊仕様は別途。');else notes.push('こちらの仕様は個別にお見積もりいたします。');
$('details').textContent=lines.join(' ／ ');$('price').textContent=total===null?'要お見積もり':yen(total);$('price').classList.toggle('pending',total===null);$('note').textContent=notes.join(' ');
summary='SOZIN お見積もり相談（試作ページ）\n商品：'+lines.join(' ／ ')+'\n参考価格（税込）：'+(total===null?'要お見積もり':yen(total))+'\n※正式価格はSOZINにご確認ください。';
}
$('product').addEventListener('change',()=>{$('fields').innerHTML=fields[$('product').value]();update();});
$('fields').addEventListener('change',update);$('fields').addEventListener('input',update);
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(summary);$('copied').textContent='コピーしました。LINEに貼り付けてください。';}catch(e){$('copied').textContent='コピーできない場合は画面をスクリーンショットしてください。';}});
$('product').dispatchEvent(new Event('change'));
})();