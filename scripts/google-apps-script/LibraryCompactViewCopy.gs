/** Optional presentation-only formatting. Never invoked by a timer.
 * Operates on the approved copy workbook only; does not change cell values.
 * Use after reviewing the copy and before requesting separate production approval.
 */
function previewLibraryCompactRowsCopyOnly(){
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const ss=SpreadsheetApp.openById(COPY),sh=ss.getSheetByName('エピソード台帳');
 if(!sh)throw Error('COPY_LEDGER_MISSING');
 const n=sh.getLastRow()-1;
 return {mode:'READ_ONLY_PREVIEW',target:COPY,sheet:sh.getName(),rows:n,columns:['V','W','X','AC'],heightPx:44,writes:0};
}
function applyLibraryCompactRowsCopyOnly(){
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const ss=SpreadsheetApp.openById(COPY),sh=ss.getSheetByName('エピソード台帳');
 if(!sh||sh.getRange(1,1).getValue()!=='台帳ID')throw Error('COPY_LEDGER_SCHEMA_MISMATCH');
 const n=sh.getLastRow()-1;if(n<1)return {rows:0,cellWrites:0};
 // CLIP keeps all embedded newlines and URLs in the underlying cell.
 for(const col of [22,23,24,29])sh.getRange(2,col,n,1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
 sh.setRowHeights(2,n,44);
 return {mode:'COPY_PRESENTATION_ONLY',rows:n,columns:['V','W','X','AC'],heightPx:44,cellWrites:0,triggerChanges:0};
}
