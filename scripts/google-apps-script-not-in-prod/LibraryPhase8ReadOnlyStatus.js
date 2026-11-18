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
