function auditSatoYoSiteRows(){
 const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
 const names=["作業台","サイト公開用"];
 const out={};
 names.forEach(function(name){const sh=getSheetLoose(ss,name);const values=sh.getDataRange().getDisplayValues();out[name]=values.map(function(r,i){return {row:i+1,values:r};}).filter(function(x){return x.values.join(" ").indexOf("73ppqrTcsjVgl1xwIZa4SY")>=0||x.values.join(" ").indexOf("佐藤陽")>=0;});});
 Logger.log(JSON.stringify(out,null,2));return out;
}
