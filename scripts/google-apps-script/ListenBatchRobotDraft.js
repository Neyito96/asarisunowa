/**
 * LISTEN manifest writer — DRAFT, NOT DEPLOYED.
 * Apps Script standalone. Requires ScriptProperties:
 *   LISTEN_SPREADSHEET_ID, LISTEN_MANIFEST_FILE_ID, LISTEN_APPROVED_RUN_ID
 * Manifest Drive JSON: {runId, items:[{epId,column:"K",url,basis}]}.
 * No triggers are installed by this file. Never use until separately approved.
 * Security: approval must pin a reviewed immutable manifest; changing Drive
 * content after approval is NOT safe. Prefer a hash-pinned snapshot.
 */
const LR = {
  sheet: 'エピソード台帳',
  cursorKey: 'LISTEN_ROBOT_CURSOR',
  runKey: 'LISTEN_ROBOT_RUN',
  urlPattern: /^https:\/\/listen\.style\/p\/[a-z0-9]+\/[a-z0-9]+$/i,
  maxPerInvocation: 20,
  maxRuntimeMs: 180000
};
function listenRobotDryRun() { return listenRobotExecute_('DRY_RUN'); }
function listenRobotWrite() { return listenRobotExecute_('WRITE'); }
function listenRobotExecute_(mode) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw Error('LOCKED: another run active');
  const start = Date.now();
  try {
    const p = PropertiesService.getScriptProperties();
    const sid = p.getProperty('LISTEN_SPREADSHEET_ID');
    const mid = p.getProperty('LISTEN_MANIFEST_FILE_ID');
    if (!sid || !mid) throw Error('Missing spreadsheet/manifest configuration');
    const raw = DriveApp.getFileById(mid).getBlob().getDataAsString('UTF-8');
    const manifest = JSON.parse(raw);
    if (!manifest.runId || !Array.isArray(manifest.items)) throw Error('Bad manifest');
    if (mode === 'WRITE' && manifest.runId !== p.getProperty('LISTEN_APPROVED_RUN_ID'))
      throw Error('Run ID not explicitly approved');
    const sheet = SpreadsheetApp.openById(sid).getSheetByName(LR.sheet);
    if (!sheet) throw Error('Sheet not found');
    const n = sheet.getLastRow();
    const epIds = sheet.getRange(2, 1, n - 1, 1).getValues().flat().map(String);
    const seen = new Map();
    epIds.forEach((id, i) => { if (seen.has(id)) seen.set(id, -1); else seen.set(id, i + 2); });
    const uniqueUrls = new Set(), uniqueEp = new Set();
    for (const item of manifest.items) {
      if (!/^EP-\d{5}$/.test(item.epId) || item.column !== 'K' ||
          !LR.urlPattern.test(item.url) || !/guid/i.test(item.basis || ''))
        throw Error('Manifest validation failed: ' + item.epId);
      if (uniqueUrls.has(item.url) || uniqueEp.has(item.epId))
        throw Error('Duplicate manifest candidate: ' + item.epId);
      uniqueUrls.add(item.url); uniqueEp.add(item.epId);
    }
    const previousRun = p.getProperty(LR.runKey);
    if (mode === 'WRITE' && previousRun && previousRun !== manifest.runId)
      throw Error('Different run already checkpointed; explicit reset required');
    let cursor = mode === 'WRITE' ? Number(p.getProperty(LR.cursorKey) || 0) : 0;
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > manifest.items.length)
      throw Error('Invalid cursor');
    const log = [];
    const max = mode === 'WRITE' ? LR.maxPerInvocation : manifest.items.length;
    let done = 0;
    while (cursor < manifest.items.length && done < max && Date.now() - start < LR.maxRuntimeMs) {
      const item = manifest.items[cursor];
      const row = seen.get(item.epId);
      if (!row || row < 0) throw Error('Missing or duplicate EP-ID: ' + item.epId);
      const cell = sheet.getRange(row, 11);
      const old = String(cell.getValue() || '').trim();
      if (old && old !== item.url) throw Error('Existing value conflict: ' + item.epId);
      if (mode === 'WRITE' && !old) {
        // Re-read immediately before write. This is not an atomic compare-and-set;
        // only one authorized writer may operate on K during this run.
        if (String(cell.getValue() || '').trim()) throw Error('Concurrent modification');
        cell.setValue(item.url);
        SpreadsheetApp.flush();
        if (String(cell.getValue()).trim() !== item.url)
          throw Error('Read-back mismatch: ' + item.epId);
      }
      log.push({epId:item.epId,row,action:old?'ALREADY_PRESENT':mode,status:'OK'});
      cursor++; done++;
      if (mode === 'WRITE') {
        p.setProperties({[LR.runKey]:manifest.runId,[LR.cursorKey]:String(cursor)});
      }
      if (mode === 'WRITE') Utilities.sleep(350);
    }
    const result = {runId:manifest.runId,mode,cursor,total:manifest.items.length,done,complete:cursor===manifest.items.length,log};
    console.log(JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}
