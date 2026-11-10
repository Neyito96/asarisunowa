/** 6サービスのエピソードURL管理状態(Phase26 × #281 platform-resolver)。純粋関数。
 * #281 の結果ステータス VERIFIED/PRESERVED/HOLD/NOT_FOUND/ERROR を、運用で見分けたい6状態へ写像する。
 *   取得済み / 取得待ち(猶予内) / 未発見 / サービス未提供(明示設定のみ) / 探索未対応(経路なし) / HOLD
 * 「サービス未提供」は設定(notProvided)で明示された時だけ。見つからないことだけでは決めない。 */
export const LINK_STATE = Object.freeze({FETCHED: '取得済み', WAITING: '取得待ち', NOT_FOUND: '未発見', NOT_PROVIDED: 'サービス未提供', NOT_IMPLEMENTED: '探索未対応', HOLD: 'HOLD'});
export function linkState({platform, show, existingUrl, resolution, ageHours, graceHours = 24, unsupported = [], notProvided = {}}) {
  if (existingUrl && String(existingUrl).trim()) return {state: LINK_STATE.FETCHED, reason: 'PRESENT'};
  if ((notProvided[platform] || []).includes(show)) return {state: LINK_STATE.NOT_PROVIDED, reason: 'CONFIGURED_NOT_PROVIDED'};
  if (unsupported.includes(platform)) return {state: LINK_STATE.NOT_IMPLEMENTED, reason: 'NO_VERIFIED_ROUTE'};
  const st = resolution?.status;
  if (st === 'VERIFIED' || st === 'PRESERVED') return {state: LINK_STATE.FETCHED, reason: st};
  if (st === 'HOLD') return {state: LINK_STATE.HOLD, reason: resolution.reason || 'HOLD'};
  if (st === 'ERROR') return {state: LINK_STATE.HOLD, reason: resolution.reason || 'ERROR_RETRY'};
  if (ageHours != null && ageHours < graceHours) return {state: LINK_STATE.WAITING, reason: `WITHIN_GRACE_${graceHours}H`};
  if (st === 'NOT_FOUND') return {state: LINK_STATE.NOT_FOUND, reason: 'NOT_FOUND_AFTER_GRACE'};
  return {state: LINK_STATE.HOLD, reason: 'NOT_CHECKED'};
}
export function summarizeLinks(items) { // items: linkState の戻り値配列 → 状態別件数
  const m = {}; for (const i of items) m[i.state] = (m[i.state] || 0) + 1; return m;
}
