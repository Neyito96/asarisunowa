/** 二重収蔵の候補検出(純粋関数・IOなし)。**自動で削除・統合・ID変更・公開追加はしない**。出力は「候補/HOLD」と証拠・統合案のみ。
 * 強ID = Spotifyエピソード/GUID/音声ID。ただしGUID欠損・日時表記差・漢字1字の誤表記でも落ちないよう、番組+日時(UTC分)・番組+正規化題名でも候補化する。
 * 人間の既存判断(保留/除外/確定)が最優先: 判断済みの行は変更を提案せず、衝突は HOLD_CONFLICT_NEEDS_HUMAN にする。曖昧なら必ずHOLD。 */
export const spotifyId = v => (String(v || '').match(/spotify\.com\/episode\/([A-Za-z0-9]{22})/) || String(v || '').match(/^([A-Za-z0-9]{22})$/) || [])[1] || '';
export const audioId = v => { const m = String(v || '').match(/\/([A-Za-z0-9_-]{8,})(?:\.[a-z0-9]{2,4})?(?:[?#].*)?$/); return m ? m[1].toLowerCase() : ''; };
export const titleKey = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s　"'“”‘’「」『』（）()【】\[\]・、。,.!?！？:：\-ー—~〜]/g, '');
/** 日時→UTC分。タイムゾーン付きISOはそのまま、"YYYY/M/D H:mm"(台帳表記)はJSTとみなす。解釈不能は null。 */
export function minuteUtc(v) {
  if (v == null || v === '') return null; if (v instanceof Date) return Math.floor(v.getTime() / 60000);
  const s = String(v).trim(); let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return null; const [, Y, Mo, D, h, mi, tz] = m; let off = 9 * 60; if (tz) { off = tz === 'Z' ? 0 : (tz[0] === '-' ? -1 : 1) * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(-2))); }
  return Math.floor(Date.UTC(+Y, +Mo - 1, +D, +h, +mi) / 60000) - off;
}
export function editDistance(a, b) {
  const x = [...a], y = [...b]; let prev = Array.from({length: y.length + 1}, (_, i) => i);
  for (let i = 1; i <= x.length; i++) { const cur = [i]; for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); prev = cur; }
  return prev[y.length];
}
const norm = r => ({...r, _sp: spotifyId(r.spotify || r.spotifyId || (r.links || []).find(l => spotifyId(l))), _guid: String(r.guid || '').trim(), _au: audioId(r.audio || (r.links || []).find(l => /\.(mp3|m4a)(\?|$)|traffic\.megaphone|pdst\.fm/.test(l))), _min: minuteUtc(r.date), _tk: titleKey(r.title)});
/** 2レコードの照合。戻り値: {verdict: CANDIDATE_DUPLICATE|HOLD_AMBIGUOUS|DISTINCT, evidence, reasons}。 */
export function comparePair(A, B) {
  const a = A._sp !== undefined ? A : norm(A), b = B._sp !== undefined ? B : norm(B);
  const ev = {sameShow: a.show === b.show, spotifyEqual: !!a._sp && a._sp === b._sp, guidEqual: !!a._guid && a._guid === b._guid, audioEqual: !!a._au && a._au === b._au,
    guidMissing: !a._guid || !b._guid, dateEqual: a._min != null && a._min === b._min, dateDiffMin: a._min != null && b._min != null ? Math.abs(a._min - b._min) : null,
    titleExact: !!a._tk && a._tk === b._tk, titleDistance: a._tk && b._tk ? editDistance(a._tk, b._tk) : null};
  ev.titleNear = ev.titleExact || (ev.titleDistance != null && ev.titleDistance <= Math.max(1, Math.floor(Math.min(a._tk.length, b._tk.length) * 0.1)));
  ev.tzSuspect = ev.dateDiffMin != null && ev.dateDiffMin > 0 && ev.dateDiffMin <= 24 * 60 && ev.dateDiffMin % 60 === 0; // 1時間単位のずれ=タイムゾーン表記差の疑い
  ev.strongId = ev.spotifyEqual || ev.guidEqual || ev.audioEqual;
  const reasons = [];
  if (ev.titleDistance === 1 && !ev.titleExact) reasons.push('TITLE_ONE_CHAR_DIFF');
  if (ev.guidMissing) reasons.push('GUID_MISSING');
  if (ev.tzSuspect) reasons.push('TZ_OFFSET_SUSPECT');
  let verdict = 'DISTINCT';
  if (ev.sameShow && ev.strongId && (ev.dateEqual || ev.titleNear)) verdict = 'CANDIDATE_DUPLICATE';
  else if (ev.sameShow && (ev.strongId || (ev.dateEqual && ev.titleNear) || (ev.tzSuspect && ev.titleNear))) verdict = 'HOLD_AMBIGUOUS'; // 強IDのみ/日時+題名のみ/TZ差+題名: 断定しない
  else if (!ev.sameShow && ev.strongId) { verdict = 'HOLD_AMBIGUOUS'; reasons.push('CROSS_SHOW_STRONG_ID'); }
  return {verdict, evidence: ev, reasons};
}
const richness = r => (r.guid ? 4 : 0) + (r.hasRawDesc ? 2 : 0) + (r.hasCleanDesc ? 2 : 0) + (r.decision === '対象' ? 3 : 0) + (r.audio ? 1 : 0);
/** records: [{id,show,title,date,guid,spotify|links,audio,hasRawDesc,hasCleanDesc,decision('対象'|'保留'|'対象外'|...)}]。decisions: {EP-ID: '確定'|'保留'|'除外'} 人間判断。 */
export function findDuplicateCandidates(records, {decisions = {}} = {}) {
  const rs = records.map(norm), blocks = new Map(), add = (k, i) => { if (k) (blocks.get(k) || blocks.set(k, []).get(k)).push(i); };
  rs.forEach((r, i) => { add(r._sp && 'sp:' + r._sp, i); add(r._guid && 'g:' + r._guid, i); add(r._au && 'au:' + r._au, i); add(r._min != null && r._tk && `d:${r.show}|${r._min}`, i); add(r._tk && `t:${r.show}|${r._tk}`, i); add(r._tk && r._min != null && `tz:${r.show}|${r._tk}|${Math.floor(r._min / 1440)}`, i); });
  const seen = new Set(), pairs = [];
  for (const idx of blocks.values()) for (let x = 0; x < idx.length; x++) for (let y = x + 1; y < idx.length; y++) {
    const i = idx[x], j = idx[y]; if (rs[i].id === rs[j].id) continue; const k = i < j ? i + '|' + j : j + '|' + i; if (seen.has(k)) continue; seen.add(k);
    const c = comparePair(rs[i], rs[j]); if (c.verdict === 'DISTINCT') continue;
    const [p, q] = rs[i].id < rs[j].id ? [rs[i], rs[j]] : [rs[j], rs[i]], dp = decisions[p.id], dq = decisions[q.id];
    const humanConfirmedBoth = dp === '確定' && dq === '確定';
    let verdict = c.verdict, note = '';
    if (humanConfirmedBoth) { verdict = 'HOLD_CONFLICT_NEEDS_HUMAN'; note = '両方が人間確定済み。何も変更しない'; }
    else if (verdict === 'CANDIDATE_DUPLICATE') { const canon = richness(p) >= richness(q) ? p : q, other = canon === p ? q : p;
      note = `正規レコード候補=${canon.id}(GUID/概要/公開判定が充実)。${other.id}は重複HOLD維持。削除・統合・ID変更・公開追加はしない(管理人の別承認)`;
      c.canonical = canon.id; c.duplicateHold = other.id; if (decisions[canon.id] === '保留' || decisions[canon.id] === '除外') note += '。ただし正規候補側に人間の保留/除外判断あり=その判断を優先し変更提案なし'; }
    pairs.push({a: p.id, b: q.id, show: p.show, verdict, reasons: c.reasons, evidence: c.evidence, canonical: c.canonical || null, duplicateHold: c.duplicateHold || null, note});
  }
  return {pairs: pairs.sort((u, v) => u.a.localeCompare(v.a) || u.b.localeCompare(v.b)), counts: pairs.reduce((m, p) => (m[p.verdict] = (m[p.verdict] || 0) + 1, m), {})};
}
/** 取り込み前ガード: 新着が既存と二重になりそうなら ADD せず HOLD。人間の判断済み既存行は変更しない。 */
export function checkIncoming(incoming, existing, {decisions = {}} = {}) {
  const hits = []; const inc = norm(incoming);
  for (const e of existing) { const c = comparePair(inc, norm(e)); if (c.verdict !== 'DISTINCT') hits.push({id: e.id, verdict: c.verdict, reasons: c.reasons, humanDecision: decisions[e.id] || null}); }
  return {action: hits.length ? 'HOLD_DUPLICATE_CANDIDATE' : 'ADD', matches: hits};
}
