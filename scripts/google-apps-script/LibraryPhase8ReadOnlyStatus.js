/** Phase 8 diagnostic only. No Properties, trigger mutations, or sheet writes.
 * Run in the SAME project/account as ALIB_AUTO_tick; other owners' triggers
 * cannot be enumerated by ScriptApp.getProjectTriggers().
 */
function inspectPhase8LibraryTransferReadOnly() {
  function snapshot(id) {
    const sheet = SpreadsheetApp.openById(id).getSheetByName('エピソード台帳');
    if (!sheet) throw new Error('Missing ledger');
    const rows = sheet.getRange(1, 1, sheet.getLastRow(), 15).getValues();
    const header = rows.shift();
    if (header[0] !== '台帳ID' || header[14] !== '音声URL') throw new Error('Unexpected ledger headers');
    const map = new Map();
    rows.filter(r => r[0]).forEach(r => {
      if (map.has(String(r[0]))) throw new Error('Duplicate EP-ID');
      map.set(String(r[0]), String(r[14] || '').trim());
    });
    return map;
  }
  const source = snapshot('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  const copy = snapshot('19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc');
  let copyAudioMissingInSource = 0, audioDifferences = 0, idsAbsentInSource = 0;
  copy.forEach((audio, id) => {
    if (!source.has(id)) { idsAbsentInSource++; return; }
    if (audio && !source.get(id)) copyAudioMissingInSource++;
    if (audio !== source.get(id)) audioDifferences++;
  });
  const handlers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const result = {
    mode: 'READ_ONLY_PHASE8_TRANSFER_STATUS', checkedAt: new Date().toISOString(),
    sourceRows: source.size, copyRows: copy.size,
    sourceAudio: [...source.values()].filter(Boolean).length,
    copyAudio: [...copy.values()].filter(Boolean).length,
    copyAudioMissingInSource, audioDifferences, idsAbsentInSource,
    alibTickFunctionPresent: typeof ALIB_AUTO_tick === 'function',
    alibTriggersVisibleToCurrentAccount: handlers.filter(h => h === 'ALIB_AUTO_tick').length,
    legacyBackfillTriggersVisibleToCurrentAccount: handlers.filter(h => h === 'runLibraryV3AudioBackfillCopyBatchScheduled').length,
    writes: 0, propertyWrites: 0, triggerChanges: 0,
    note: 'Read-only counts; not a write-eligibility decision or proof of all owners trigger state. Inspect Apps Script Executions for success/failure history.'
  };
  console.log(JSON.stringify(result));
  return result;
}

/** Phase 12: extend the existing diagnostic, never call an engine/token helper.
 * Output is allowlisted metadata only. This file is NOT deployed by a git PR.
 * Run only in the actual project/account after source review; visibility is per owner.
 */
function inspectPhase12RuntimeReadOnly() {
  const props = PropertiesService.getScriptProperties();
  function object(key) { try { return JSON.parse(props.getProperty(key) || '{}'); } catch (_) { return {}; } }
  function flag(value) { return typeof value === 'boolean' ? value : null; }
  function count(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
  function instant(value) { return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
  const config = object('LIB_V3_CONFIG'), morning = object('LIB_V3_MORNING_CONFIG');
  const baseline = object('LIB_V3_BASELINE'), state = object('LIB_V3_MORNING_STATE');
  const allowedHandlers = ['ALIB_AUTO_tick','scheduledLibraryV3','scheduledLibraryV3BaselineOnly','scheduledLibraryV3Morning','continueLibraryV3Morning','runLibraryV3AudioBackfillCopyBatchScheduled','runAutoUpdateAutomationV1','runAutoUpdateAutomationSoonV1','runAutoUpdateBackfillHourlyV1'];
  const counts = {}; let otherTriggers = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) { const h=t.getHandlerFunction(); if(allowedHandlers.indexOf(h)>=0) counts[h]=(counts[h]||0)+1; else otherTriggers++; });
  const result = {
    mode:'READ_ONLY_RUNTIME_METADATA', checkedAt:new Date().toISOString(),
    functions:{alib:typeof ALIB_AUTO_tick==='function',v3:typeof libV3Run_==='function',morning:typeof scheduledLibraryV3Morning==='function'},
    triggerCountsVisibleToCurrentAccount:counts, otherTriggerCount:otherTriggers,
    duplicateHandlers:allowedHandlers.filter(function(h){return counts[h]>1;}),
    v3:{enabled:flag(config.enabled),autonomous:flag(config.autonomous),allowNew:flag(config.allowNew),allowEnrich:flag(config.allowEnrich)},
    baseline:{complete:flag(baseline.complete),offset:count(baseline.offset)},
    morning:{enabled:flag(morning.enabled),spotify:flag(morning.spotify),complete:flag(state.complete),lastAt:instant(state.last&&state.last.at),hasLease:!!state.lease,hasRetry:!!state.retry},
    credentialPresence:{clientId:!!props.getProperty('SPOTIFY_CLIENT_ID'),clientSecret:!!props.getProperty('SPOTIFY_CLIENT_SECRET'),refreshToken:!!props.getProperty('SPOTIFY_USER_REFRESH_TOKEN')},
    oauthValidity:'NOT_VERIFIED_NO_TOKEN_REFRESH_OR_API_CALL',executionHistory:'NOT_AVAILABLE_IN_THIS_DIAGNOSTIC',
    schedule:'Actual trigger times/owners require Apps Script dashboard; handler counts do not prove cadence.',
    writes:0,propertyWrites:0,triggerChanges:0,networkCalls:0
  };
  console.log(JSON.stringify(result)); return result;
}
