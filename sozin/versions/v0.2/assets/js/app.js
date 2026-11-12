(()=>{'use strict';
const P={pdf:{base:20000,perPage:5000},flip:{base:35000,extra2:8000},poster:{A2:{1:5500,10:16200,50:18300,100:20500},B2:{1:6500,10:23700,50:25900,100:28000},A1:{1:9500,10:38000}},banner:{standard:28000,slim:26000,posterStandard:15000,posterSlim:13000},setDigital:{fileOnly:2000,fileAndUrl:2500}};
const $=id=>document.getElementById(id), yen=n=>n.toLocaleString('ja-JP')+'円';
const names={program:'紙の発表会プログラム',pdf:'デジタルプログラム・PDF版',flip:'ページめくりデジタルブック',poster:'ポスター',banner:'バナースタンド',setDigital:'印刷物セット・デジタル納品',other:'チケット・チラシなど'};
const number=(id,label,min,max,val)=>'<label class="field-label" for="'+id+'">STEP 2 <span>'+label+'</span></label><input id="'+id+'" type="number" min="'+min+'" max="'+max+'" value="'+val+'" inputmode="numeric">';
const select=(id,label,opts)=>'<label class="field-label" for="'+id+'">STEP 2 <span>'+label+'</span></label><select id="'+id+'">'+opts.map(([a,b])=>'<option value="'+a+'">'+b+'</option>').join('')+'</select>';
const fields={
program:()=>'<div class="callout">紙のプログラムは仮単価で試算中です。金額は実際の料金表とは異なります。</div>'+number('pages','ページ数',4,200,16)+number('copies','印刷部数',1,100000,300),
pdf:()=>number('pages','総ページ数',1,300,2),
flip:()=>number('pages','総ページ数',4,300,4),
poster:()=>select('size','サイズ',[['A2','A2'],['B2','B2'],['A1','A1']])+select('copies','枚数',[[1,'1枚'],[10,'10枚'],[50,'50枚'],[100,'100枚']]),
banner:()=>select('variant','商品タイプ',[['standard','スタンダード（スタンド付き）'],['slim','スリム（スタンド付き）'],['posterStandard','交換用ポスター・スタンダード'],['posterSlim','交換用ポスター・スリム']]),
setDigital:()=>number('pages','総ページ数',1,300,8)+select('delivery','納品方法',[['fileOnly','データのみ'],['fileAndUrl','データ＋閲覧URL（1年間）']]),
other:()=>'<div class="callout">チケット・チラシ等は個別見積もりでご案内します。</div>'
};
let summary='',lastEstimate={total:null,lines:[],notes:[]};
function update(){const type=$('product').value,lines=[names[type]],notes=[];let total=null;
const val=id=>$(id)?.value,num=id=>Number(val(id)),valid=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
if(type==='pdf'){const n=num('pages');lines.push(n+'ページ');if(valid(n,1,300))total=P.pdf.base+Math.max(0,n-2)*P.pdf.perPage;}
if(type==='flip'){const n=num('pages');lines.push(n+'ページ');if(valid(n,4,300)){total=P.flip.base+Math.ceil(Math.max(0,n-4)/2)*P.flip.extra2;if((n-4)%2)notes.push('追加ページは2ページ単位で計算。');}}
if(type==='poster'){const s=val('size'),n=num('copies');lines.push(s+'・'+n+'枚');total=P.poster[s]?.[n]??null;notes.push('プログラムとセット・同デザイン利用の掲載料金。');}
if(type==='banner'){const v=val('variant');lines.push($('variant').selectedOptions[0].textContent);total=P.banner[v]??null;notes.push('プログラムとセット・同デザイン利用の掲載料金。');}
if(type==='setDigital'){const n=num('pages'),kind=val('delivery');lines.push(n+'ページ・'+$('delivery').selectedOptions[0].textContent);if(valid(n,1,300))total=n*P.setDigital[kind];notes.push('印刷物とのセット料金。印刷物の料金は含みません。');}
if(type==='program'){const p=num('pages'),c=num('copies');lines.push(p+'ページ・'+c+'部');if(valid(p,4,200)&&valid(c,1,100000))total=Math.round((30000+p*2500+c*100)*1.1);notes.push('【デモ用仮計算】基本料30,000円＋ページ数×2,500円＋部数×100円、税10％。実際の価格表とは無関係です。');}
if(total!==null)notes.push('正式な料金ではありません。送料・特急料金・特殊仕様は別途。');else notes.push('こちらの仕様は個別にお見積もりいたします。');
lastEstimate={total,lines:[...lines],notes:[...notes]};$('details').textContent=lines.join(' ／ ');$('price').textContent=total===null?'要お見積もり':yen(total);$('price').classList.toggle('pending',total===null);$('note').textContent=notes.join(' ');
summary='SOZIN お見積もり相談（試作ページ）\n商品：'+lines.join(' ／ ')+'\n参考価格（税込）：'+(total===null?'要お見積もり':yen(total))+'\n※正式価格はSOZINにご確認ください。';
}
$('product').addEventListener('change',()=>{$('fields').innerHTML=fields[$('product').value]();update();});
$('fields').addEventListener('change',update);$('fields').addEventListener('input',update);
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(summary);$('copied').textContent='コピーしました。LINEに貼り付けてください。';}catch(e){$('copied').textContent='コピーできない場合は画面をスクリーンショットしてください。';}});

function createPdf(){
 const {total,lines,notes}=lastEstimate,can=document.createElement('canvas');can.width=1240;can.height=1754;
 const ctx=can.getContext('2d');if(!ctx)throw new Error('canvas unavailable');
 const W=1240,H=1754;ctx.fillStyle='#fffdfc';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#29232b';ctx.fillRect(0,0,W,28);ctx.fillStyle='#ad7a91';ctx.fillRect(0,28,W,8);
 ctx.fillStyle='#29232b';ctx.font='bold 64px Georgia,serif';ctx.fillText('SOZIN',104,148);
 ctx.fillStyle='#a8798e';ctx.font='30px Georgia,serif';ctx.fillText("Ballet de' Arte",106,195);
 ctx.fillStyle='#29232b';ctx.font='600 52px "Noto Sans JP","Hiragino Kaku Gothic ProN",sans-serif';ctx.fillText('概算お見積書',104,305);
 ctx.fillStyle='#a9758c';ctx.font='bold 25px "Noto Sans JP",sans-serif';ctx.fillText('試算版・正式見積もりではありません',105,360);
 ctx.strokeStyle='#e7dfe3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(105,405);ctx.lineTo(1135,405);ctx.stroke();
 ctx.fillStyle='#746971';ctx.font='26px "Noto Sans JP",sans-serif';ctx.fillText('発行日：'+new Date().toLocaleDateString('ja-JP'),105,462);
 ctx.fillText('対象商品',105,548);
 ctx.fillStyle='#29232b';ctx.font='600 32px "Noto Sans JP",sans-serif';
 let y=607;for(const line of lines){ctx.fillText(line,105,y,1020);y+=52;}
 ctx.fillStyle='#f5e6ed';ctx.fillRect(100,810,1040,260);
 ctx.fillStyle='#775967';ctx.font='26px "Noto Sans JP",sans-serif';ctx.fillText('概算金額（税込）',146,885);
 ctx.fillStyle='#8d4f6b';ctx.font='bold 76px "Noto Sans JP",sans-serif';ctx.fillText(total===null?'要お見積もり':total.toLocaleString('ja-JP')+' 円',146,995,930);
 ctx.fillStyle='#29232b';ctx.font='600 27px "Noto Sans JP",sans-serif';ctx.fillText('計算条件・ご注意',105,1170);
 ctx.fillStyle='#746971';ctx.font='24px "Noto Sans JP",sans-serif';
 let yy=1225;const all=['本PDFは概算シミュレーターで作成された確認用データです。',...notes,'この金額での受注・納期・仕様を保証するものではありません。','正式なお見積もりはSOZINへお問い合わせください。'];
 function wrapText(t,maxChars){let out=[];while(t.length>maxChars){out.push(t.slice(0,maxChars));t=t.slice(maxChars);}out.push(t);return out;}
 for(const n of all){for(const line of wrapText(n,37)){if(yy<1560)ctx.fillText(line,105,yy);yy+=40;}yy+=9;}
 ctx.strokeStyle='#e7dfe3';ctx.beginPath();ctx.moveTo(105,1640);ctx.lineTo(1135,1640);ctx.stroke();
 ctx.fillStyle='#746971';ctx.font='22px "Noto Sans JP",sans-serif';ctx.fillText('創人デザインシステム株式会社  |  www.sozindesign.com',105,1694);
 return can;
}
function imagePdf(canvas){
 // Image-only PDF: Japanese text is rendered locally using device fonts.
 const base64=canvas.toDataURL('image/jpeg',.94).split(',')[1];
 const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 const encoder=new TextEncoder(),chunks=[],offsets=[0];let pos=0;
 const push=t=>{let b=typeof t==='string'?encoder.encode(t):t;chunks.push(b);pos+=b.length};
 push('%PDF-1.4\n');
 function obj(id,body){offsets[id]=pos;push(id+' 0 obj\n'+body+'\nendobj\n');}
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=pos;push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n');push(bytes);push('\nendstream\nendobj\n');
 const cmd='q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n';obj(5,'<< /Length '+encoder.encode(cmd).length+' >>\nstream\n'+cmd+'endstream');
 const xref=pos;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return new Blob(chunks,{type:'application/pdf'});
}
$('downloadPdf').addEventListener('click',()=>{
 try{const blob=imagePdf(createPdf()),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SOZIN_概算見積書_'+new Date().toISOString().slice(0,10)+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('copied').textContent='PDFを作成しました。iPhoneでは「ファイル」アプリのダウンロード先をご確認ください。';}
 catch(e){$('copied').textContent='PDFを生成できませんでした。「印刷・PDFとして保存」をお試しください。';}
});
$('printPdf').addEventListener('click',()=>{
 const c=createPdf(),w=window.open('','_blank');if(!w){$('copied').textContent='ポップアップがブロックされました。Safariで開き直してください。';return;}
 w.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>SOZIN 概算お見積書</title><style>body{margin:0}img{display:block;width:100%;max-width:794px;margin:auto}@page{size:A4;margin:0}</style></head><body><img id="sheet" src="'+c.toDataURL('image/png')+'"></body></html>');w.document.close();
 const img=w.document.getElementById('sheet');img.onload=()=>{w.focus();w.print();};if(img.complete){w.focus();w.print();}
});

$('product').dispatchEvent(new Event('change'));
})();