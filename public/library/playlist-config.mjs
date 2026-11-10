/** Spotifyプレイリスト自動更新の「設定表」(Sheetの1行=1プレイリスト)。純粋関数・IOなし。
 * 新規プレイリストの追加 = この表に1行足すだけ(専用GAS・専用トリガーは作らない)。
 * 不正な行は表全体を壊さず、その行だけ無効化(blocked)して理由を返す。同じプレイリストを2行が指す場合は両方止める(二重書込防止)。 */
export const CONFIG_HEADERS = Object.freeze(['key', '有効', 'プレイリストID', '名称', '方式', '対象番組', 'キーワード', '除外キーワード', '照合範囲', '照合モード', '特別照合', '承認状態', '段階', '実行モード', 'writer', '1回の追加上限', 'レビュー済のみ']);
export const RULE_TYPES = Object.freeze(['title-text', 'speaker', 'theme']);
export const APPROVALS = Object.freeze(['requested', 'waiting_invite', 'review', 'approved', 'paused', 'human_deleted']);
export const STAGES = Object.freeze(['bootstrap', 'incremental']);
export const WRITERS = Object.freeze(['legacy', 'engine']);
const truthy = v => /^(true|1|yes|はい|有効|y)$/i.test(String(v ?? '').trim());
const list = v => String(v ?? '').split(/[,、\n]/).map(s => s.trim()).filter(Boolean);
const PLAYLIST_ID = /^[A-Za-z0-9]{22}$/;
export function parseConfig(rows, {strategies = {}, primaryShowIds = []} = {}) {
  const rules = [], errors = [];
  const body = rows.length && String(rows[0][0]).trim() === 'key' ? rows.slice(1) : rows;
  body.forEach((r, i) => {
    if (r.every(c => String(c ?? '').trim() === '')) return;
    const rowNo = i + 2, e = [];
    const rule = {
      row: rowNo, key: String(r[0] ?? '').trim(), enabled: truthy(r[1]), playlistId: String(r[2] ?? '').trim(), name: String(r[3] ?? '').trim(),
      ruleType: String(r[4] ?? '').trim() || 'title-text', showIds: /^primary$/i.test(String(r[5] ?? '').trim()) ? [...primaryShowIds] : list(r[5]),
      keywords: list(r[6]), excludeKeywords: list(r[7]), fields: /description|概要/.test(String(r[8] ?? '')) ? ['name', 'description', 'html_description'] : ['name'],
      matchMode: /^all$/i.test(String(r[9] ?? '').trim()) ? 'all' : 'any', strategy: String(r[10] ?? '').trim(), approval: String(r[11] ?? '').trim() || 'requested',
      stage: String(r[12] ?? '').trim() || 'bootstrap', mode: /^LIVE$/i.test(String(r[13] ?? '').trim()) ? 'LIVE' : 'DRY_RUN', writer: String(r[14] ?? '').trim() || 'legacy',
      maxAdd: Number(r[15]) > 0 ? Math.min(Number(r[15]), 50) : 10, requireReviewedEpisodes: String(r[16] ?? '').trim() === '' ? String(r[4] ?? '').trim() === 'theme' : truthy(r[16]),
    };
    if (!rule.key) e.push('KEY_MISSING');
    if (!PLAYLIST_ID.test(rule.playlistId)) e.push('PLAYLIST_ID_INVALID');
    if (!RULE_TYPES.includes(rule.ruleType)) e.push('RULE_TYPE_UNSUPPORTED');
    if (!APPROVALS.includes(rule.approval)) e.push('APPROVAL_UNKNOWN');
    if (!STAGES.includes(rule.stage)) e.push('STAGE_UNKNOWN');
    if (!WRITERS.includes(rule.writer)) e.push('WRITER_UNKNOWN');
    if (!rule.showIds.length) e.push('SHOW_SCOPE_EMPTY');
    if (!rule.keywords.length && !rule.strategy) e.push('NO_MATCH_CONDITION'); // 条件なしは全件一致になるため拒否
    if (rule.strategy && !/^series-code:.+/.test(rule.strategy) && !strategies[rule.strategy]) e.push('STRATEGY_UNKNOWN');
    if (rule.ruleType === 'theme' && !rule.requireReviewedEpisodes) e.push('THEME_REQUIRES_REVIEW');
    rule.blocked = e; rules.push(rule);
  });
  const keys = {}, pls = {};
  for (const r of rules) { (keys[r.key] ||= []).push(r); (pls[r.playlistId] ||= []).push(r); }
  for (const g of Object.values(keys)) if (g.length > 1) g.forEach(r => r.blocked.push('KEY_DUPLICATE'));
  for (const g of Object.values(pls)) if (g.length > 1 && g.filter(r => r.enabled).length > 1) g.forEach(r => r.blocked.push('PLAYLIST_DUPLICATE_ENABLED')); // 同じリストへ2系統の書込を許さない
  for (const r of rules) if (r.blocked.length) errors.push({row: r.row, key: r.key, reasons: r.blocked});
  return {rules, errors};
}
/** そのルールが今回「Spotifyへ書いてよい」か。すべて満たす時だけ LIVE。理由は常に返す(止まった理由が見える)。 */
export function writePermission(rule, {globalMode = 'LIVE', handoff = {}} = {}) {
  const why = [];
  if (rule.blocked?.length) why.push('RULE_BLOCKED');
  if (!rule.enabled) why.push('DISABLED');
  if (rule.approval !== 'approved') why.push('NOT_APPROVED');
  if (rule.mode !== 'LIVE') why.push('ROW_DRY_RUN');
  if (globalMode !== 'LIVE') why.push('GLOBAL_DRY_RUN');
  if (rule.writer !== 'engine') why.push('WRITER_IS_LEGACY'); // 旧GAS方式が担当の間、新エンジンは書かない(二重書込防止)
  else if (!(handoff[rule.key]?.readOnlyDiffMatch === true && handoff[rule.key]?.legacyDisabledConfirmed === true)) why.push('HANDOFF_NOT_CONFIRMED');
  return {allowed: why.length === 0, why};
}
