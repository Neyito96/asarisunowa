/**
 * RISU: podcast-description advertisement audit and CLEAN PREVIEW.
 * READ ONLY: Never writes a spreadsheet, properties or triggers.
 * Attach to the existing library GAS project; run RISU_auditAdContamination().
 * Audit full ledger, including MEDIA TALK; limit log samples for GAS runtime.
 */
const RISU_AD_AUDIT = Object.freeze({
  spreadsheetId:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',
  sheet:'エピソード台帳',
  maxSamples:30,
  focus:['EP-03365','EP-05247']
});
function RISU_adSections_(value) {
  const text=String(value||'')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi,'\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/\r/g,'');
  const lines=text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const kept=[],removed=[];
  let skip=false;
  for(const line of lines) {
    const start=/^(?:[【\[]\s*)?(?:お知らせ|イベント|告知|キャンペーン|おたより|お便り|応募|フォーム|朝ポキ情報|購読案内|会員登録|プレゼント)(?:\s*[】\]]|\s*[:：])/i.test(line) ||
      /(?:イベント|参加申し込み|参加申込|おたよりフォーム|お便りフォーム|応募フォーム|初月無料|チケット販売|キャンペーン).*https?:\/\//i.test(line);
    const section=/^(?:[【\[]\s*)?(?:関連記事|関連リンク|出演|出演者|スタッフ|エピソード|内容|今回のテーマ)(?:\s*[】\]]|\s*[:：])/i.test(line);
    if(section)skip=false;
    if(start)skip=true;
    if(skip)removed.push(line); else kept.push(line);
  }
  return {cleaned:kept.join('\n'),removed:removed.join('\n')};
}
function RISU_auditAdContamination() {
  const cfg=RISU_AD_AUDIT, sh=SpreadsheetApp.openById(cfg.spreadsheetId).getSheetByName(cfg.sheet);
  if(!sh)throw Error('台帳タブなし');
  const data=sh.getDataRange().getValues();
  const header=data.shift().map(String), col=x=>{const i=header.indexOf(x);if(i<0)throw Error('列なし '+x);return i;};
  const id=col('台帳ID'),show=col('番組名'),title=col('タイトル'),raw=col('概要原文'),clean=col('概要清掃済み');
  const names=['寺下真理加','太田匡彦','佐藤陽','高橋健一郎','斎藤健一郎'];
  const result={mode:'READ_ONLY',total:data.length,rawHits:0,cleanHits:0,proposedChanges:0,focus:[],samples:[],writes:0};
  data.forEach((row,i)=>{
    const before=String(row[clean]||row[raw]||'');
    const after=RISU_adSections_(before);
    const matched=names.filter(n=>before.includes(n));
    if(matched.length)result.cleanHits++;
    if(names.some(n=>String(row[raw]||'').includes(n)))result.rawHits++;
    if(after.removed && after.cleaned!==before){
      result.proposedChanges++;
      const entry={row:i+2,id:String(row[id]),show:String(row[show]),title:String(row[title]),names:matched,
        removedPreview:after.removed.slice(0,280),retainedLength:after.cleaned.length,
        retainedNames:names.filter(n=>after.cleaned.includes(n))};
      if(cfg.focus.includes(entry.id))result.focus.push(entry);
      else if(result.samples.length<cfg.maxSamples)result.samples.push(entry);
    }
  });
  console.log('RISU_AD_AUDIT '+JSON.stringify(result));
  return result;
}
function RISU_previewAdCleaning(episodeId) {
  const cfg=RISU_AD_AUDIT, sh=SpreadsheetApp.openById(cfg.spreadsheetId).getSheetByName(cfg.sheet);
  const rows=sh.getDataRange().getValues(),head=rows.shift().map(String);
  const id=head.indexOf('台帳ID'),clean=head.indexOf('概要清掃済み'),raw=head.indexOf('概要原文');
  const row=rows.find(r=>String(r[id])===String(episodeId));
  if(!row)throw Error('EP-ID not found: '+episodeId);
  const before=String(row[clean]||row[raw]||''),preview=RISU_adSections_(before);
  const out={mode:'READ_ONLY',id:episodeId,before:before.slice(0,1500),after:preview.cleaned.slice(0,1500),removed:preview.removed.slice(0,1500),writes:0};
  console.log(JSON.stringify(out));return out;
}
