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
