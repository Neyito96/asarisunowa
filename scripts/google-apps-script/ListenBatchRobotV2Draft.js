/**
 * 朝リスの田 LISTEN補完 v2 (DRAFT / NOT DEPLOYED).
 * Input manifest JSON in Drive:
 * {runId, spreadsheetId, sheet:"エピソード台帳", items:[
 *   {epId:"EP-00001", guid:"...", date:"2026-10-10",
 *    url:"https://listen.style/p/.../...", column:"K"}]}
 * Script Properties: LISTEN_MANIFEST_FILE_ID, LISTEN_MANIFEST_SHA256,
 * LISTEN_APPROVED_RUN_ID, LISTEN_WRITE_ENABLED ("true" only when approved).
 * NO TRIGGERS; manually call listenRobotDryRunV2 first.
 * Full-row audit is a separate mandatory release gate after each batch.
 */
const LISTEN_V2 = Object.freeze({
  tab: 'エピソード台帳', maxPerRun: 20, maxMillis: 180000,
  url: /^https:\/\/listen\.style\/p\/[a-z0-9]+\/[a-z0-9]+$/i
});
function listenRobotDryRunV2() { return listenRobotV2_('DRY_RUN'); }
function listenRobotWriteV2() { return listenRobotV2_('WRITE'); }
function listenRobotV2_(mode) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw Error('LOCKED');
  try {
    const props = PropertiesService.getScriptProperties();
    const mid = props.getProperty('LISTEN_MANIFEST_FILE_ID');
    const approvedHash = props.getProperty('LISTEN_MANIFEST_SHA256');
    if (!mid || !approvedHash) throw Error('Manifest and SHA256 required');
    const blob = DriveApp.getFileById(mid).getBlob().getBytes();
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob)
      .map(x => ('0' + (x & 255).toString(16)).slice(-2)).join('');
    if (digest !== approvedHash.toLowerCase()) throw Error('MANIFEST_CHANGED');
    const m = JSON.parse(Utilities.newBlob(blob).getDataAsString('UTF-8'));
    if (!m.runId || !m.spreadsheetId || m.sheet !== LISTEN_V2.tab ||
        !Array.isArray(m.items)) throw Error('Invalid manifest');
    if (mode === 'WRITE' && (props.getProperty('LISTEN_WRITE_ENABLED') !== 'true' ||
        props.getProperty('LISTEN_APPROVED_RUN_ID') !== m.runId))
      throw Error('WRITE_NOT_APPROVED');
    const checkpointKey = 'LISTEN_V2_CURSOR_' + m.runId;
    const cursor = mode === 'WRITE' ? Number(props.getProperty(checkpointKey) || 0) : 0;
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > m.items.length)
      throw Error('BAD_CHECKPOINT');
    const sheet = SpreadsheetApp.openById(m.spreadsheetId).getSheetByName(m.sheet);
    if (!sheet || sheet.getLastRow() < 2) throw Error('MISSING_SHEET');
    const values = sheet.getRange(2, 1, sheet.getLastRow()-1, 11).getValues();
    const byEp = new Map(), duplicateIds = new Set();
    values.forEach((r,i) => {
      const id = String(r[0]).trim();
      if (byEp.has(id)) duplicateIds.add(id);
      else byEp.set(id, {row:i+2, guid:String(r[6]).trim().toLowerCase(),
        date:normalDate_(r[3]), url:String(r[10] || '').trim()});
    });
    const ids = new Set(), urls = new Set();
    for (const x of m.items) {
      if (!/^EP-\d{5}$/.test(x.epId) || !x.guid || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) ||
          x.column !== 'K' || !LISTEN_V2.url.test(x.url) ||
          ids.has(x.epId) || urls.has(x.url))
        throw Error('BAD_ITEM_' + x.epId);
      ids.add(x.epId); urls.add(x.url);
    }
    let index = cursor, processed = 0;
    const audit = [];
    while (index < m.items.length && processed < LISTEN_V2.maxPerRun) {
      const x = m.items[index], found = byEp.get(x.epId);
      if (!found || duplicateIds.has(x.epId)) throw Error('EP_ID_CONFLICT_' + x.epId);
      if (found.guid !== String(x.guid).trim().toLowerCase()) throw Error('GUID_MISMATCH_' + x.epId);
      if (Math.abs(Date.parse(found.date+'T00:00:00Z')-Date.parse(x.date+'T00:00:00Z'))>86400000)
        throw Error('DATE_MISMATCH_' + x.epId);
      const cell = sheet.getRange(found.row, 11);
      const current = String(cell.getValue() || '').trim();
      if (current && current !== x.url) throw Error('NONEMPTY_CONFLICT_' + x.epId);
      let action = current ? 'ALREADY_PRESENT' : 'WOULD_WRITE';
      if (mode === 'WRITE' && !current) {
        // One authorized writer only; Apps Script does not provide atomic CAS.
        cell.setValue(x.url);
        SpreadsheetApp.flush();
        if (String(cell.getValue() || '').trim() !== x.url) throw Error('READBACK_FAILED_' + x.epId);
        action = 'WRITTEN';
      }
      audit.push({epId:x.epId,row:found.row,action});
      index++; processed++;
      if (mode === 'WRITE') {
        props.setProperty(checkpointKey,String(index));
        Utilities.sleep(500);
      }
    }
    const out = {runId:m.runId,mode,from:cursor,to:index,total:m.items.length,
      complete:index===m.items.length,audit};
    console.log(JSON.stringify(out));
    return out;
  } finally { lock.releaseLock(); }
}
function normalDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v,'Asia/Tokyo','yyyy-MM-dd');
  const s=String(v || '');
  const m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  return m ? m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0') : '';
}
