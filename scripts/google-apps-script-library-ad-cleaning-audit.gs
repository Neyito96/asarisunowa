/**
 * RISU: podcast-description advertisement audit and CLEAN PREVIEW.
 * READ ONLY: Never writes a spreadsheet, properties or triggers.
 * Attach to the existing library GAS project; run RISU_auditAdContamination().
 * Audit full ledger, including MEDIA TALK; limit log samples for GAS runtime.
 */
const RISU_AD_AUDIT = Object.freeze({
  spreadsheetId:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',
  sheet:'エピソード台帳',
  maxSamples:5,
  version:'SAFE_PREVIEW_V5_20261021',
  focus:['EP-03365','EP-05247']
});
function RISU_adSections_(value) {
  // V4: parse section boundaries from original multiline text. Fail closed.
  // Literal "\\n" occurs in some ledger cells; normalize it first.
  const text=String(value||'').replace(/\\n/g,'\n')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi,'\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/\r/g,'');
  const marker=/【[^】]{1,90}】/g;
  const marks=[];let m;
  while((m=marker.exec(text))!==null) marks.push({at:m.index,end:marker.lastIndex,name:m[0]});
  const chunks=[];let pos=0;
  for(let i=0;i<marks.length;i++){
    const k=marks[i];
    if(k.at>pos)chunks.push({header:'',body:text.slice(pos,k.at)});
    const end=i+1<marks.length?marks[i+1].at:text.length;
    chunks.push({header:k.name,body:text.slice(k.end,end)});
    pos=end;
  }
  if(pos<text.length)chunks.push({header:'',body:text.slice(pos)});
  const isAd=h=>/朝ポキ情報|イベント|上映会|お知らせ|キャンペーン|プレゼント|広告|おたより|お便り|募集|応募|フォーム|記者サロン|スマホ撮影のコツを動画で紹介|会員登録|メルマガ|番組検索ツール/.test(h);
  const isProtected=h=>/関連記事|関連リンク|関連動画|出演|スタッフ|エピソード|内容|今回のテーマ/.test(h);
  const kept=[],removed=[],related=[],held=[];
  for(const part of chunks){
    const section=(part.header+part.body).trim();
    if(!section)continue;
    if(part.header && isAd(part.header)){
      removed.push(section);
    }else if(part.header && isProtected(part.header)){
      kept.push(section);
      if(/関連記事|関連リンク/.test(part.header))related.push(section);
    }else{
      // Inline promotions in otherwise unmarked text require review.
      if(/(?:おたよりフォーム|お便りフォーム|応募フォーム|朝日ID会員の登録)/.test(part.body)){
        held.push(part.header||'unmarked');
      }
      kept.push(section);
    }
  }
  const cleaned=kept.join('\n\n').trim();
  if(!cleaned || cleaned.length<Math.min(35,Math.floor(text.length*0.08))){
    return {cleaned:text,removed:'',related:[],held:true,reason:'would_erase_content'};
  }
  return {cleaned:cleaned,removed:removed.join('\n\n'),related:related,held:held.length>0,reason:held.length?'inline_promotion_needs_review':''};
}
function RISU_auditAdContamination() {
  const cfg=RISU_AD_AUDIT, sh=SpreadsheetApp.openById(cfg.spreadsheetId).getSheetByName(cfg.sheet);
  if(!sh)throw Error('台帳タブなし');
  const data=sh.getDataRange().getValues();
  const header=data.shift().map(String), col=x=>{const i=header.indexOf(x);if(i<0)throw Error('列なし '+x);return i;};
  const id=col('台帳ID'),show=col('番組名'),title=col('タイトル'),raw=col('概要原文'),clean=col('概要清掃済み');
  const names=['寺下真理加','太田匡彦','佐藤陽','高橋健一郎','斎藤健一郎'];
  const result={mode:'READ_ONLY',version:cfg.version,total:data.length,rawHits:0,cleanHits:0,proposedChanges:0,held:0,focus:[],samples:[],writes:0};
  data.forEach((row,i)=>{
    const before=String(row[clean]||row[raw]||'');
    const after=RISU_adSections_(before);
    const matched=names.filter(n=>before.includes(n));
    if(after.held)result.held++;
    if(matched.length)result.cleanHits++;
    if(names.some(n=>String(row[raw]||'').includes(n)))result.rawHits++;
    if(after.removed && after.cleaned!==before){
      result.proposedChanges++;
      const entry={row:i+2,id:String(row[id]),show:String(row[show]),title:String(row[title]),names:matched,
        removedPreview:after.removed.slice(0,160),retainedLength:after.cleaned.length,
        retainedNames:names.filter(n=>after.cleaned.includes(n)),relatedSections:after.related.length,held:after.held};
      if(cfg.focus.includes(entry.id))result.focus.push(entry);
      else if(result.samples.length<cfg.maxSamples)result.samples.push(entry);
    }
  });
  console.log('RISU_AD_AUDIT '+JSON.stringify({mode:result.mode,version:result.version,total:result.total,rawHits:result.rawHits,cleanHits:result.cleanHits,proposedChanges:result.proposedChanges,held:result.held,focus:result.focus,samples:result.samples.map(x=>({id:x.id,retainedLength:x.retainedLength,removedPreview:x.removedPreview.slice(0,70)})),writes:0}));
  return result;
}
function RISU_previewAdCleaning(episodeId) {
  const cfg=RISU_AD_AUDIT, sh=SpreadsheetApp.openById(cfg.spreadsheetId).getSheetByName(cfg.sheet);
  const rows=sh.getDataRange().getValues(),head=rows.shift().map(String);
  const id=head.indexOf('台帳ID'),clean=head.indexOf('概要清掃済み'),raw=head.indexOf('概要原文');
  const row=rows.find(r=>String(r[id])===String(episodeId));
  if(!row)throw Error('EP-ID not found: '+episodeId);
  const before=String(row[clean]||row[raw]||''),preview=RISU_adSections_(before);
  const out={mode:'READ_ONLY',version:cfg.version,held:preview.held,reason:preview.reason,relatedSections:preview.related.length,id:episodeId,before:before.slice(0,1500),after:preview.cleaned.slice(0,1500),removed:preview.removed.slice(0,1500),writes:0};
  console.log(JSON.stringify(out));return out;
}
