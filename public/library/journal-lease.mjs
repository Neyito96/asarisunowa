/** 追記専用ジャーナル上の fencing token 付き単一writerリース＋COMMIT。純粋ロジック(IOは store で注入)。
 * store = {rows(): 既存行配列のスナップショット, append(row), withLock(fn): {ok:false}|fn()の結果}。
 * GAS実機では withLock = LockService.getScriptLock().tryLock、rows/append = COPYジャーナル(P25_STATE と同型)の読み書き。
 * **原子性はLockServiceの保証に依存し、実機では未検証**。本モジュールは(1)ロック内で読み取り→検査→追記を完結させ
 * (2)ロックが破れても fencing token と baseVersion と runId 一意性で二重COMMITを拒否する多重防御。 */
const latest = (rows, type) => [...rows].reverse().find(r => r.type === type);
export const maxToken = rows => rows.reduce((m, r) => (r.type === 'LEASE' ? Math.max(m, r.token) : m), 0);
export const lastVersion = rows => (latest(rows, 'COMMIT')?.version ?? 0);
export function acquire(store, owner, nowMs, ttlMs = 15 * 60e3) {
  const r = store.withLock(() => {
    const rows = store.rows(), cur = latest(rows, 'LEASE');
    const released = cur && rows.some(x => x.type === 'RELEASE' && x.token === cur.token);
    if (cur && !released && cur.owner !== owner && cur.expiresAt > nowMs) return {ok: false, reason: 'HELD_BY_OTHER', heldUntil: cur.expiresAt};
    const token = maxToken(rows) + 1; // 同一ownerの再取得でも必ず新tokenにする(古い実行を無効化)
    store.append({type: 'LEASE', owner, token, expiresAt: nowMs + ttlMs, at: nowMs});
    return {ok: true, token, baseVersion: lastVersion(rows), expiresAt: nowMs + ttlMs, incompletePreviousRun: !!cur && !released && !rows.some(x => x.type === 'COMMIT' && x.token === cur.token) && cur.expiresAt <= nowMs};
  });
  return r && r.ok !== undefined ? r : {ok: false, reason: 'BUSY'};
}
export function commit(store, {owner, token, runId, baseVersion, payloadHash}, nowMs) {
  const r = store.withLock(() => {
    const rows = store.rows(), cur = latest(rows, 'LEASE');
    if (!cur || cur.token !== token || cur.owner !== owner) return {ok: false, reason: 'FENCED_STALE_TOKEN'};
    if (cur.expiresAt <= nowMs) return {ok: false, reason: 'LEASE_EXPIRED'};
    if (rows.some(x => x.type === 'COMMIT' && x.runId === runId)) return {ok: false, reason: 'DUPLICATE_RUN_ID'};
    if (rows.some(x => x.type === 'COMMIT' && x.token === token)) return {ok: false, reason: 'DOUBLE_COMMIT_SAME_TOKEN'};
    if (lastVersion(rows) !== baseVersion) return {ok: false, reason: 'STALE_BASE_VERSION'};
    const version = baseVersion + 1;
    store.append({type: 'COMMIT', owner, token, runId, version, payloadHash, at: nowMs});
    return {ok: true, version};
  });
  return r && r.ok !== undefined ? r : {ok: false, reason: 'BUSY'};
}
export function release(store, {owner, token}) {
  return store.withLock(() => { const cur = latest(store.rows(), 'LEASE'); if (!cur || cur.token !== token || cur.owner !== owner) return {ok: false, reason: 'FENCED_STALE_TOKEN'}; store.append({type: 'RELEASE', owner, token}); return {ok: true}; }) ?? {ok: false, reason: 'BUSY'};
}
/** テスト/COPY試験用のメモリstore。lockHeld=true で他者がロック保持中を再現。 */
export function memoryStore() {
  const rows = []; const s = {lockHeld: false, rows: () => rows.map(r => ({...r})), append: r => rows.push({seq: rows.length + 1, ...r}), withLock: fn => (s.lockHeld ? undefined : fn())};
  return s;
}
