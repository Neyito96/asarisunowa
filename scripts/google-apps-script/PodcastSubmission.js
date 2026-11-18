// Durable receipts double as the small new-submission priority list. No triggers installed.
const PODCAST_RECEIPT_PREFIX_V2_ = "PODCAST_RECEIPT_V2_";
const PODCAST_RECEIPT_TTL_V2_ = 3 * 86400000;

function podcastReceiptKey_(requestId) {
  const id = String(requestId || "").trim();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw new Error("投稿受付番号が正しくありません。ページを再読み込みしてください。");
  return PODCAST_RECEIPT_PREFIX_V2_ + id;
}
function readPodcastReceipt_(requestId) {
  const value = PropertiesService.getScriptProperties().getProperty(podcastReceiptKey_(requestId));
  if (!value) return null;
  try { const item = JSON.parse(value); return Date.now() - item.created <= PODCAST_RECEIPT_TTL_V2_ ? item : null; }
  catch (_) { return null; }
}
function beginPodcastReceipt_(requestId, kind, url, title) {
  const key = podcastReceiptKey_(requestId);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("投稿受付が混み合っています。再度お試しください。");
  try {
    const store = PropertiesService.getScriptProperties();
    const previous = readPodcastReceipt_(requestId);
    if (previous) {
      if (previous.kind !== kind || previous.url !== url || previous.title !== title) throw new Error("受付番号に対応する投稿内容が異なります。");
      return;
    }
    const records = Object.keys(store.getProperties()).filter(k => k.indexOf(PODCAST_RECEIPT_PREFIX_V2_) === 0)
      .map(k => { try { return { key: k, item: JSON.parse(store.getProperty(k)) }; } catch (_) { return { key: k, item: { created: 0 } }; } })
      .sort((a, b) => a.item.created - b.item.created);
    records.forEach((record, index) => {
      if (Date.now() - record.item.created > PODCAST_RECEIPT_TTL_V2_ || index < records.length - 99) store.deleteProperty(record.key);
    });
    // Persist identity BEFORE appending: even if completion fails, a read-only status
    // request can verify the committed row. Maximum 100 bounded receipts.
    podcastSetPropertySafeV2_(store, key, JSON.stringify({ kind: kind, url: url, title: title, created: Date.now(), status: "pending" }));
  } finally { lock.releaseLock(); }
}
function completePodcastReceipt_(requestId, added, duplicateReason) {
  const record = readPodcastReceipt_(requestId);
  if (!record || record.status === "saved") return; // Same request retains its original outcome.
  record.status = "saved"; record.added = added; record.duplicateReason = duplicateReason || "";
  podcastSetPropertySafeV2_(PropertiesService.getScriptProperties(), podcastReceiptKey_(requestId), JSON.stringify(record));
}
function findPodcastReceiptRow_(record) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const name = record.kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME;
  const sheet = getSheetLoose(ss, name);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  const index = rows.findIndex(row => normalizeUrl(row[0]) === normalizeUrl(record.url) || normalizeTitle(row[1]) === normalizeTitle(record.title));
  return index < 0 ? null : { row: index + 2, sourceUrl: String(rows[index][0]).trim(), title: String(rows[index][1]).trim() };
}
function handlePodcastRequestStatus_(e, callback) {
  try {
    const record = readPodcastReceipt_(e && e.parameter && e.parameter.requestId);
    if (!record) return apiResponse({ ok: true, accepted: false, status: "unknown" }, callback);
    const row = findPodcastReceiptRow_(record);
    if (!row) return apiResponse({ ok: true, accepted: false, status: "pending" }, callback);
    return apiResponse({ ok: true, accepted: true, status: "saved", kind: record.kind,
      added: record.status === "saved" ? record.added : null,
      duplicateReason: record.duplicateReason || "", sourceUrl: row.sourceUrl, title: row.title }, callback);
  } catch (_) { return apiResponse({ ok: false, accepted: false, status: "unavailable" }, callback); }
}
function newPodcastPriorityIdentities_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(properties).filter(k => k.indexOf(PODCAST_RECEIPT_PREFIX_V2_) === 0).map(k => {
    try { return JSON.parse(properties[k]); } catch (_) { return null; }
  }).filter(r => r && ((r.status === "saved" && r.added) || r.status === "pending") && Date.now() - r.created < PODCAST_RECEIPT_TTL_V2_)
    .filter(r => {
      // Read exactly the public API projection before prioritizing any saved job.
      try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = getSheetLoose(ss, r.kind === "podcast" ? PODCAST_SHEET_NAME : LISTENER_PODCAST_SHEET_NAME);
        const data = r.kind === "podcast" ? readPodcastSheet(sheet) : readListenerPodcastSheet(sheet);
        return data.ok && data.items.some(item => normalizeUrl(item.url) === normalizeUrl(r.url) && normalizeTitle(item.title) === normalizeTitle(r.title));
      } catch (_) { return false; }
    }).sort((a, b) => b.created - a.created);
}

// Read-only audit: never return names or values of secret properties.
function inspectPodcastPropertiesV2() {
  const values = PropertiesService.getScriptProperties().getProperties();
  const bytes = value => Utilities.newBlob(String(value)).getBytes().length;
  let used = 0, largest = 0, owned = 0;
  Object.keys(values).forEach(key => { const n = bytes(key) + bytes(values[key]); used += n; largest = Math.max(largest, bytes(values[key])); if (/^PODCAST_(RECEIPT|PIPELINE)_/.test(key)) owned += n; });
  return {readable: true, usedBytes: used, largestValueBytes: largest, podcastBytes: owned,
    limitBytes: 500 * 1024, reserveBytes: 64 * 1024, writablePermission: "not probed"};
}
function podcastSetPropertySafeV2_(store, key, value) {
  const audit = inspectPodcastPropertiesV2();
  const bytes = value => Utilities.newBlob(String(value)).getBytes().length;
  const old = store.getProperty(key);
  const projected = audit.usedBytes - (old === null ? 0 : bytes(key) + bytes(old)) + bytes(key) + bytes(value);
  if (bytes(value) > 9 * 1024 || projected > audit.limitBytes - audit.reserveBytes) throw new Error("Podcast Properties capacity reserve reached");
  store.setProperty(key, value);
}
