/** SDGs official archive: READ-ONLY discovery and reconciliation. No Sheets writes. */
const SDGS_ARCHIVE_ID = '91b696fe-c723-4bd1-95ed-b4aa00909997';
const SDGS_ARCHIVE_BASE = 'https://www.asahi.com/special/podcasts/include/';
const SDGS_ITEM_BASE = 'https://www.asahi.com/special/podcasts/item/?itemid=';
const SDGS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sdgsOfficialUrl(uuid) {
  if (!SDGS_UUID.test(String(uuid || ''))) throw new Error('Invalid UUID: ' + uuid);
  return SDGS_ITEM_BASE + encodeURIComponent(uuid);
}
function sdgsExtractItemId(url) {
  const m = String(url || '').match(/[?&]itemid=([0-9a-f-]{36})(?:&|$)/i);
  return m && SDGS_UUID.test(m[1]) ? m[1].toLowerCase() : '';
}
function sdgsGetEntries(payload) {
  if (Array.isArray(payload)) return payload;
  // The archive JSON envelope must be verified against a real response.
  for (const key of ['items', 'episodes', 'list', 'data', 'results']) {
    if (payload && Array.isArray(payload[key])) return payload[key];
  }
  throw new Error('Unknown official JSON schema: inspect before proceeding');
}
function sdgsFetchPage(page, fetcher) {
  if (!Number.isInteger(page) || page < 1 || page > 100) throw new Error('Invalid page');
  const url = SDGS_ARCHIVE_BASE + SDGS_ARCHIVE_ID + '_' + page + '.json';
  const response = fetcher(url);
  if (response.status !== 200) return {page, url, status: response.status, entries: []};
  const entries = sdgsGetEntries(JSON.parse(response.body));
  return {page, url, status: 200, entries: entries.map(e => ({
    uuid: String(e.id || '').toLowerCase(),
    title: e.title || '',
    date: e.date || '',
    officialUrl: SDGS_UUID.test(e.id || '') ? sdgsOfficialUrl(e.id) : '',
    embedUrl: e.onsei || '',
    description: e.description || '',
    body: e.body || '',
    sourceJsonUrl: url,
    pageStatus: 'URL_GENERATED_NOT_HTTP_VERIFIED',
    playbackStatus: 'NOT_TESTED'
  }))};
}
function sdgsReconcile(existing, discovered) {
  const existingId = sdgsExtractItemId(existing.officialUrl);
  const incomingId = discovered.uuid;
  if (!SDGS_UUID.test(incomingId || '')) return {status:'HOLD_BAD_UUID'};
  if (existingId && existingId !== incomingId) return {status:'HOLD_CONFLICT',oldUrl:existing.officialUrl,newUrl:discovered.officialUrl};
  if (existingId === incomingId) return {status:'ALREADY_MATCHED',oldUrl:existing.officialUrl};
  if (existing.officialUrl) return {status:'HOLD_UNRECOGNIZED_EXISTING_URL',oldUrl:existing.officialUrl};
  return {status:'CANDIDATE_OFFICIAL_URL',newUrl:discovered.officialUrl,source:discovered.sourceJsonUrl};
}
// Explicitly no production writes, no API tokens, and no speculative mp3 URLs.
export {sdgsOfficialUrl,sdgsExtractItemId,sdgsGetEntries,sdgsFetchPage,sdgsReconcile};
