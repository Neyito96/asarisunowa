// Phase25 playlist ownership: decides, per playlist, whether the legacy writers or the
// library-first (P25) writer may touch Spotify. Owner records live in Script Properties
// as P25_OWNER_<playlistId>. No record = LEGACY, so every existing playlist behaves as before.
// A corrupt record is treated as PAUSED (fail closed): nobody writes.
//
// Double-write protection is NOT just this flag. Every writer must run its Spotify call
// INSIDE p25WithOwnerGate_, which holds a User lock while it re-reads the owner and writes.
// The owner switch (P25_SET_OWNER) takes the same lock, so after a switch returns no
// writer of the previous owner can still be mid-write. A User lock is used on purpose:
// several legacy flows already hold the Script lock while they write, and nesting the same
// lock type is not safe in Apps Script.
const P25_OWNER_PREFIX_ = "P25_OWNER_";
const P25_OWNER_VALUES_ = ["LEGACY", "P25", "PAUSED"];
const P25_GATE_WAIT_MS_ = 30000;

function p25OwnerRead_(playlistId) {
  const id = String(playlistId || "").trim();
  const raw = PropertiesService.getScriptProperties().getProperty(P25_OWNER_PREFIX_ + id);
  if (!raw) return { playlistId: id, owner: "LEGACY", generation: 0 };
  try {
    const record = JSON.parse(raw);
    if (P25_OWNER_VALUES_.indexOf(record.owner) < 0 ||
        !Number.isSafeInteger(record.generation) || record.generation < 1) {
      throw new Error("invalid owner record");
    }
    record.playlistId = id;
    return record;
  } catch (_) {
    return { playlistId: id, owner: "PAUSED", generation: 0, corrupt: true };
  }
}

function p25OwnerOf_(playlistId) { return p25OwnerRead_(playlistId).owner; }
function p25IsP25Owned_(playlistId) { return p25OwnerOf_(playlistId) === "P25"; }
// True when legacy code must NOT write (P25-owned, paused, or unreadable record).
function p25LegacyBlocked_(playlistId) { return p25OwnerOf_(playlistId) !== "LEGACY"; }

// Runs work() only while the owner (and, if given, generation) still matches.
// The lock covers the owner re-check AND the write.
function p25WithOwnerGate_(playlistId, expectedOwner, expectedGeneration, work) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(P25_GATE_WAIT_MS_)) {
    const busy = new Error("P25_GATE_BUSY");
    busy.notSent = true;
    throw busy;
  }
  try {
    const record = p25OwnerRead_(playlistId);
    if (record.owner !== expectedOwner ||
        (expectedGeneration != null && record.generation !== expectedGeneration)) {
      return { allowed: false, owner: record.owner, generation: record.generation };
    }
    return { allowed: true, value: work() };
  } finally {
    lock.releaseLock();
  }
}

// Legacy Spotify write wrapper. Throws (never "succeeds") when the playlist is not LEGACY-owned,
// so callers cannot advance boundaries or report additions that did not happen.
function p25LegacyGatedFetch_(playlistId, send) {
  const gate = p25WithOwnerGate_(playlistId, "LEGACY", null, send);
  if (!gate.allowed) {
    const denied = new Error("P25_OWNED: " + gate.owner + " " + String(playlistId || ""));
    denied.notSent = true;
    throw denied;
  }
  return gate.value;
}

// Non-atomic check for manual one-shot admin writers (rebuild/reorder tools).
function p25AssertLegacyMayWrite_(playlistId) {
  if (p25LegacyBlocked_(playlistId)) {
    throw new Error("P25_OWNED: Phase25管理のプレイリストには旧処理から書き込めません: " + String(playlistId || ""));
  }
}

function p25LegacySkip_(playlistId) {
  return { skipped: "P25_OWNED", owner: p25OwnerOf_(playlistId), addedCount: 0, failedCount: 0, candidateCount: 0 };
}
