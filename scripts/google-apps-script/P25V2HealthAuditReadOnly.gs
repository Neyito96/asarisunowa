/**
 * V2 daily health audit — standalone, read-only Google Apps Script.
 * No trigger, no setValues, no sheet mutation, no Spotify calls.
 * Run P25V2_HEALTH_AUDIT_READONLY() in a trusted GAS project after review.
 */
function P25V2_HEALTH_AUDIT_READONLY() {
  var spreadsheetId = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
  var sheetName = 'V2・統合台帳';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (!sheet) throw new Error('V2_SHEET_NOT_FOUND');
  var values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('V2_EMPTY');
  var headers = values[0].map(function(v) { return String(v || '').trim(); });
  var idx = {};
  headers.forEach(function(h, i) {
    if (!h) return;
    if (idx[h] !== undefined) throw new Error('DUPLICATE_HEADER: ' + h);
    idx[h] = i;
  });
  ['EP-ID','番組','タイトル','公式GUID','配信日時 JST','掲載判定'].forEach(function(h) {
    if (idx[h] === undefined) throw new Error('MISSING_HEADER: ' + h);
  });
  var epSeen = {}, guidSeen = {}, duplicateEp = [], duplicateGuid = [], missing = [], newest = [];
  var coverage = {}, services = ['Spotify','Apple','Amazon','Pocket Casts','LISTEN','Pody','YouTube'];
  services.forEach(function(s) { coverage[s] = {filled:0,missing:0,headerPresent:idx[s] !== undefined}; });
  function val(row, h) { return idx[h] === undefined ? '' : String(row[idx[h]] == null ? '' : row[idx[h]]).trim(); }
  for (var i=1; i<values.length; i++) {
    var row=values[i], ep=val(row,'EP-ID'), guid=val(row,'公式GUID'), show=val(row,'番組');
    if (!ep && !guid && !show && !val(row,'タイトル')) continue;
    if (!ep || !guid) missing.push({row:i+1,epId:ep,missingEpId:!ep,missingGuid:!guid});
    if (ep) { if (epSeen[ep]) duplicateEp.push({epId:ep,rows:[epSeen[ep],i+1]}); else epSeen[ep]=i+1; }
    if (guid) {
      var g=guid.toLowerCase();
      if (guidSeen[g]) duplicateGuid.push({guid:guid,rows:[guidSeen[g],i+1]}); else guidSeen[g]=i+1;
    }
    services.forEach(function(s) { if (!coverage[s].headerPresent) return; coverage[s][val(row,s)?'filled':'missing']++; });
    newest.push({row:i+1,epId:ep,show:show,date:val(row,'配信日時 JST'),status:val(row,'掲載判定')});
  }
  newest.sort(function(a,b) { return b.date.localeCompare(a.date); });
  var report = {
    auditTime:new Date().toISOString(), spreadsheetId:spreadsheetId, sheet:sheetName,
    rowCount:newest.length, duplicateEpCount:duplicateEp.length, duplicateGuidCount:duplicateGuid.length,
    missingIdentityCount:missing.length, duplicateEp:duplicateEp.slice(0,100),
    duplicateGuid:duplicateGuid.slice(0,100), missingIdentity:missing.slice(0,100),
    latestRows:newest.slice(0,25), urlCoverage:coverage,
    status:'READ_ONLY_NO_WRITE',
    note:'Daily trigger success cannot be inferred from ledger content alone; inspect Apps Script executions separately.'
  };
  Logger.log(JSON.stringify(report));
  return report;
}
