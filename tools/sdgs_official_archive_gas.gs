/**
 * SDGs official archive GAS adapter — READ ONLY.
 * Paste into an isolated Apps Script project; run SDGS_previewOfficialArchive().
 * No triggers, no SpreadsheetApp writes, no ScriptProperties writes.
 */
var SDGS_GAS_ARCHIVE_ID = '91b696fe-c723-4bd1-95ed-b4aa00909997';
var SDGS_GAS_JSON_ROOT = 'https://www.asahi.com/special/podcasts/include/';
var SDGS_GAS_ITEM_ROOT = 'https://www.asahi.com/special/podcasts/item/?itemid=';
var SDGS_GAS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SDGS_parseJsonEntries_(payload) {
  if (Array.isArray(payload)) return payload;
  ['items','episodes','list','data','results'].forEach(function(k) {
    if (payload && Array.isArray(payload[k])) payload = payload[k];
  });
  if (!Array.isArray(payload)) throw new Error('Unknown JSON schema; inspect source before changing parser');
  return payload;
}
function SDGS_fetchPageReadOnly_(page) {
  if (page !== Math.floor(page) || page < 1 || page > 100) throw new Error('Invalid page');
  var url = SDGS_GAS_JSON_ROOT + SDGS_GAS_ARCHIVE_ID + '_' + page + '.json';
  var response = UrlFetchApp.fetch(url, {muteHttpExceptions:true,followRedirects:true});
  var status = response.getResponseCode();
  if (status !== 200) return {page:page,source:url,httpStatus:status,records:[],stopReason:'HTTP_NON_200'};
  var rows = SDGS_parseJsonEntries_(JSON.parse(response.getContentText('UTF-8')));
  var records = rows.map(function(item) {
    var id = String(item.id || '').toLowerCase();
    return {uuid:id,title:String(item.title||''),date:String(item.date||''),
      officialUrl:SDGS_GAS_UUID.test(id) ? SDGS_GAS_ITEM_ROOT+encodeURIComponent(id) : '',
      omnyEmbedUrl:String(item.onsei||''),sourceJsonUrl:url,
      verification:'URL_GENERATED_NOT_HTTP_VERIFIED'};
  });
  return {page:page,source:url,httpStatus:status,records:records,stopReason:rows.length===0?'EMPTY_PAGE':''};
}
function SDGS_previewOfficialArchive() {
  // Deliberately capped at three pages to avoid quota/timeouts. No persistent state.
  var pageLimit = 3, pages=[], seen={}, duplicates=[], total=0;
  for (var page=1;page<=pageLimit;page++) {
    var result = SDGS_fetchPageReadOnly_(page);
    pages.push({page:page,httpStatus:result.httpStatus,count:result.records.length,stopReason:result.stopReason});
    if (result.httpStatus!==200 || result.records.length===0) break;
    result.records.forEach(function(r) {
      total++;
      if (!SDGS_GAS_UUID.test(r.uuid)) {duplicates.push({page:page,uuid:r.uuid,reason:'BAD_UUID'});return;}
      if (seen[r.uuid]) duplicates.push({page:page,uuid:r.uuid,reason:'DUPLICATE_UUID'});
      seen[r.uuid]=true;
    });
    Utilities.sleep(250);
  }
  var summary={mode:'READ_ONLY',source:'ASAHI_OFFICIAL_JSON',pageLimit:pageLimit,
    scanned:total,uniqueUuids:Object.keys(seen).length,issues:duplicates.slice(0,30),
    issueCount:duplicates.length,pages:pages,writes:0,triggersInstalled:0,
    note:'No HTTP verification of generated individual episode URLs'};
  Logger.log(JSON.stringify(summary));
  return summary;
}
function SDGS_compareOfficialUrlReadOnly(existingUrl, incomingUuid) {
  var uuid=String(incomingUuid||'').toLowerCase();
  if (!SDGS_GAS_UUID.test(uuid)) return {status:'HOLD_BAD_UUID'};
  var proposed=SDGS_GAS_ITEM_ROOT+uuid;
  if (!existingUrl) return {status:'CANDIDATE_OFFICIAL_URL',proposedUrl:proposed};
  var match=String(existingUrl).match(/[?&]itemid=([0-9a-f-]{36})(?:&|$)/i);
  if (!match) return {status:'HOLD_EXISTING_URL_UNRECOGNIZED'};
  return {status:match[1].toLowerCase()===uuid?'ALREADY_MATCHED':'HOLD_CONFLICT',
    proposedUrl:proposed,existingUrl:String(existingUrl)};
}

/**
 * Full archive audit in one READ-ONLY invocation. Max 20 pages (1200 items at 60/page).
 * Stops at empty page, non-200 response, schema error or page limit.
 * No persistent checkpoint, no Sheet writes, no trigger changes.
 */
function SDGS_auditAllPagesReadOnly() {
  var maxPages = 20, seen = {}, issues = [], pages = [], scanned = 0;
  var stopReason = 'PAGE_LIMIT_REACHED';
  for (var page = 1; page <= maxPages; page++) {
    var result;
    try { result = SDGS_fetchPageReadOnly_(page); }
    catch (error) {
      stopReason = 'FETCH_OR_PARSE_ERROR';
      pages.push({page:page,error:String(error)});
      break;
    }
    pages.push({page:page,status:result.httpStatus,count:result.records.length});
    if (result.httpStatus !== 200) {
      stopReason = 'HTTP_' + result.httpStatus;
      break;
    }
    if (result.records.length === 0) {
      stopReason = 'EMPTY_PAGE';
      break;
    }
    result.records.forEach(function(r) {
      scanned++;
      if (!SDGS_GAS_UUID.test(r.uuid)) {
        issues.push({page:page,uuid:r.uuid,reason:'INVALID_UUID'});
      } else if (seen[r.uuid]) {
        issues.push({page:page,uuid:r.uuid,reason:'DUPLICATE_UUID',firstPage:seen[r.uuid]});
      } else seen[r.uuid] = page;
    });
    // Last page can contain fewer than 60; still check next page rather than assuming termination.
    Utilities.sleep(250);
  }
  var summary = {mode:'READ_ONLY',scanned:scanned,uniqueUuids:Object.keys(seen).length,
    issuesCount:issues.length,issueSamples:issues.slice(0,20),pages:pages,
    stopReason:stopReason,writes:0,individualPageHttpVerified:false};
  Logger.log(JSON.stringify(summary));
  return summary;
}

/**
 * Read-only comparison against the user's 1007 COPY, not the original shared sheet.
 * Matches only explicit trailing episode numbers (#123) in the sheet's C column
 * against official JSON titles. Ambiguous or missing numbers are HELD.
 * A:R (and all other cells) remain unchanged.
 */
function SDGS_auditAgainst1007CopyReadOnly() {
  var copyId = '1lJF11Xpx9cz9RLuuJsvl0zV9E5Fpg7I7XreB2R6wS7o';
  var sheet = SpreadsheetApp.openById(copyId).getSheetByName('SDGs');
  if (!sheet) throw new Error('1007 copy SDGs tab missing');
  var values = sheet.getRange(3,1,sheet.getLastRow()-2,19).getDisplayValues();
  var byEpisode = {}, ambiguous = [];
  values.forEach(function(row,i) {
    var title = row[2], match = title.match(/#([0-9]+)\s*$/);
    if (!match) { if (title) ambiguous.push({row:i+3,reason:'NO_TRAILING_NUMBER'}); return; }
    var number = Number(match[1]);
    if (!byEpisode[number]) byEpisode[number]=[];
    byEpisode[number].push({row:i+3,title:title,existingUrl:row[12],pilotUuid:row[18]});
  });
  var results = [], uuidSeen = {}, counts = {};
  function add(status,info) {counts[status]=(counts[status]||0)+1;results.push(Object.assign({status:status},info));}
  for (var page=1;page<=20;page++) {
    var source = SDGS_fetchPageReadOnly_(page);
    if (source.httpStatus!==200) {
      if (page===1) throw new Error('First page failed: '+source.httpStatus);
      break;
    }
    if (!source.records.length) break;
    source.records.forEach(function(record) {
      var numberMatch = record.title.match(/#([0-9]+)\s*$/);
      if (!SDGS_GAS_UUID.test(record.uuid)) {add('BAD_JSON_UUID',{page:page,title:record.title});return;}
      if (uuidSeen[record.uuid]) {add('DUPLICATE_JSON_UUID',{page:page,uuid:record.uuid});return;}
      uuidSeen[record.uuid]=true;
      if (!numberMatch) {add('HOLD_JSON_TITLE_NO_NUMBER',{page:page,title:record.title,uuid:record.uuid});return;}
      var number=Number(numberMatch[1]), rows=byEpisode[number]||[];
      if (rows.length!==1) {add(rows.length?'HOLD_MULTIPLE_SHEET_ROWS':'HOLD_NO_SHEET_ROW',{episode:number,page:page,rows:rows.map(function(r){return r.row;})});return;}
      var row=rows[0], oldId=String(row.existingUrl||'').match(/[?&]itemid=([0-9a-f-]{36})(?:&|$)/i);
      var status;
      if (!row.existingUrl) status='CANDIDATE_EMPTY_OFFICIAL_URL';
      else if (!oldId) status='HOLD_UNRECOGNIZED_EXISTING_URL';
      else if (oldId[1].toLowerCase()===record.uuid) status='MATCHED_UUID';
      else status='HOLD_UUID_CHANGED';
      // Compare title after removing #N; mismatch is always a hold, never an overwrite.
      var normalized=function(s){return String(s||'').replace(/\s*#[0-9]+\s*$/,'').replace(/\s+/g,' ').trim();};
      if (normalized(row.title)!==normalized(record.title)) status='HOLD_TITLE_DIFFERENCE';
      add(status,{episode:number,sheetRow:row.row,page:page,
        oldUrl:row.existingUrl,newUrl:record.officialUrl,
        sheetTitle:row.title,jsonTitle:record.title});
    });
    Utilities.sleep(250);
  }
  var summary={mode:'READ_ONLY',target:'1007_COPY_SDGS',jsonUnique:Object.keys(uuidSeen).length,
    statuses:counts,ambiguousSheetRows:ambiguous.length,
    examples:results.filter(function(r){return r.status!=='MATCHED_UUID';}).slice(0,30),
    totalCompared:results.length,writes:0,
    warning:'Episode-number/title comparison only. No automated overwrite authorized.'};
  Logger.log(JSON.stringify(summary));
  return summary;
}
