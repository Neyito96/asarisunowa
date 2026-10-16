function debugLibraryV2OmnyClipExtraction() {
 const sh=SpreadsheetApp.openById(LIB_V2_SHEET_ID).getSheetByName('エピソード台帳');
 const rows=[343,1238,1239,1240],out=[];
 const uuidRe=/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i;
 for(const row of rows) {
  const r=sh.getRange(row,1,1,39).getValues()[0],s=String(r[8]||'');
  const domain=/https?:\/\/(?:omny\.fm|traffic\.omny\.fm|omnycontent\.com)\//i.test(s);
  const match=s.match(/\/shows\/[^/?#]+\/([0-9a-f-]{36})(?:\/|\?|#|$)/i);
  out.push({row,id:r[0],guid:String(r[6]||''),url:s,excluded:String(r[38]||''),domain,clipMatch:match?match[1]:null,validUuid:match?uuidRe.test(match[1]):false});
 }
 Logger.log(JSON.stringify({mode:'READ_ONLY_DIAGNOSTIC',rows:out,writes:0}));return out;
}
