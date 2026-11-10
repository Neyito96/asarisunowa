/** Phase26: 台帳の空欄を列ごとに監査し、補完提案(根拠つき・非破壊)を作る。純粋関数・IOなし・推測で埋めない。
 * 既存の共通基盤を再利用し、取得ロボを増やさない: EP-ID/GUID/差分=daily-ingest(#288) / 6サービス探索=platform-resolver(#281, 注入) /
 * 列定義=base-ledger LEDGER_COL(#279)。ここは「空欄の分類」と「適用(上書き禁止)」と「優先度付き再試行」だけを持つ。 */
export const GAP = Object.freeze(['FILLED', 'FILLABLE_FROM_OFFICIAL', 'NOT_YET_PUBLISHED', 'NOT_APPLICABLE', 'HOLD']);
// 0始まり台帳列。tier: required=当日までに揃えたい / recommended
export const AUDIT_COLS = Object.freeze([
  {col: 3, key: 'datetime', label: '配信日時', tier: 'required', kind: 'feed'},
  {col: 6, key: 'guid', label: 'GUID', tier: 'required', kind: 'feed'},
  {col: 14, key: 'audio', label: '音声URL', tier: 'required', kind: 'feed'},
  {col: 21, key: 'descRaw', label: '概要原文', tier: 'required', kind: 'feed'},
  {col: 22, key: 'descClean', label: '清掃済み概要', tier: 'required', kind: 'derived'},
  {col: 45, key: 'cast1', label: '出演者1', tier: 'required', kind: 'cast'},
  {col: 46, key: 'cast2', label: '出演者2', tier: 'recommended', kind: 'cast'},
  {col: 47, key: 'cast3', label: '出演者3', tier: 'recommended', kind: 'cast'},
  {col: 48, key: 'cast4', label: '出演者4', tier: 'recommended', kind: 'cast'},
  {col: 49, key: 'cast5', label: '出演者5', tier: 'recommended', kind: 'cast'},
  {col: 28, key: 'related', label: '関連記事', tier: 'recommended', kind: 'related'},
  {col: 9, key: 'officialPage', label: '公式個別URL', tier: 'required', kind: 'platform', platform: 'asahi'},
  {col: 10, key: 'listen', label: 'LISTEN', tier: 'required', kind: 'platform', platform: 'listen'},
  {col: 11, key: 'spotify', label: 'Spotify', tier: 'required', kind: 'platform', platform: 'spotify'},
  {col: 12, key: 'apple', label: 'Apple Podcasts', tier: 'required', kind: 'platform', platform: 'apple'},
  {col: 40, key: 'amazon', label: 'Amazon Music', tier: 'recommended', kind: 'platform', platform: 'amazon'},
  {col: 41, key: 'pocketcasts', label: 'Pocket Casts', tier: 'recommended', kind: 'platform', platform: 'pocketcasts'},
  {col: 42, key: 'pody', label: 'Pody', tier: 'recommended', kind: 'platform', platform: 'pody'},
]);
const blank = v => v == null || String(v).replace(/[\s　]/g, '') === '';
const HOUR = 3600e3;

export function stripHtml(s) {
  return String(s || '').replace(/\\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
/** 公式概要の【出演…】ブロックから氏名候補を取り出す。URL/役割語/広告・注意書きは除外し、確信できない語は採らない(取りこぼしは許容、誤補完は不可)。 */
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー々';
const HK = '\\p{Script=Han}\\p{Script=Katakana}ー々';
// 氏名: ①漢字/カタカナのみ(後ろが日本語文字でない) ②ひらがなを含む名はその直後に「さん/氏/（所属）」がある場合だけ採る(文章の断片を拾わない)
const NAME_RE = new RegExp(`(?<![${CJK}・])((?:[${HK}]{2,12}(?:・[${HK}]{1,12})?)(?![${CJK}])|[${CJK}]{2,12}(?=さん|氏|\\s*[（(]))((?:さん|氏)?(?:\\s*[（(][^）)]*[）)])?(?:さん|氏)?)`, 'gu');
const NOT_NAMES = new Set(['ママ', '常連客', 'スタッフ', 'ゲスト', '出演', 'マスター']);
const TERMINATOR = /[★※◆■▼◎]|お便り|ご感想|アプリ|ぜひ|お待ち|募集|対象は/;
export function extractCast(descRaw) {
  const ROLE = '(?:MC|音源編集|聞き手|司会|ゲスト)';
  let text = stripHtml(descRaw).replace(/https?:\/\/\S+/g, ' ');
  const m = /【出演[^】]*】([\s\S]*?)(?=【|$)/.exec(text);
  if (!m) return {names: [], block: '', found: false};
  let block = m[1];
  const t = TERMINATOR.exec(block); if (t) block = block.slice(0, t.index);
  block = block.replace(new RegExp(`(?<![（(、,])${ROLE}(?:[・、,]${ROLE})*[・\\s]*`, 'g'), '\n').replace(/[ \t\u3000]+/g, ' ');
  const names = [], seen = new Set();
  for (const mm of block.matchAll(NAME_RE)) {
    let name = mm[1].replace(/^・/, ''), paren = mm[2].trim();
    if (NOT_NAMES.has(name)) continue;
    if (!paren && name.length > 6 && !name.includes('・')) continue; // 括弧なしの長い連続漢字は氏名とみなさない
    if (!paren && /(?:者|家|員|長|官|優|師|授|生|者さん)$/.test(name)) continue; // 肩書・職種語(俳優/認知科学者等)は氏名ではない
    paren = paren.replace(/(?:さん|氏)/g, '').trim();
    if (name.length < 2 || seen.has(name)) continue;
    seen.add(name); names.push(name + paren);
  }
  return {names: names.slice(0, 5), block: block.trim().slice(0, 200), found: true};
}

/** ctx: {now(ms), pubDate(ms), official:{descRaw,audio,guid,pubDate}, resolutions:{platform:{status,url,evidence,reason}}, showCastBlankRate, showEpisodeCount,
 *       graceHours:{spotify:...}, unsupportedPlatforms:[...]} */
export function auditRow(row, ctx) {
  const out = [], ageH = ctx.pubDate ? (ctx.now - ctx.pubDate) / HOUR : null;
  const grace = {asahi: 6, listen: 24, spotify: 24, apple: 24, amazon: 72, pocketcasts: 48, pody: 48, ...(ctx.graceHours || {})};
  const cast = extractCast(row[21] || ctx.official?.descRaw);
  for (const c of AUDIT_COLS) {
    const v = row[c.col], base = {col: c.col, key: c.key, label: c.label, tier: c.tier, kind: c.kind};
    if (!blank(v)) { out.push({...base, status: 'FILLED', reason: 'PRESENT'}); continue; }
    let r;
    if (c.kind === 'feed') {
      const o = {datetime: ctx.official?.pubDate, guid: ctx.official?.guid, audio: ctx.official?.audio, descRaw: ctx.official?.descRaw}[c.key];
      r = !blank(o) ? {status: 'FILLABLE_FROM_OFFICIAL', reason: 'OFFICIAL_FEED_HAS_VALUE', value: String(o), source: 'official-feed', evidence: ['guid-matched feed item']}
        : {status: 'HOLD', reason: 'FEED_VALUE_MISSING'};
    } else if (c.kind === 'derived') { // 清掃済み概要は原文からの派生。原文が埋まってから作る(推測で作らない)
      r = !blank(row[21] || ctx.official?.descRaw) ? {status: 'FILLABLE_FROM_OFFICIAL', reason: 'DERIVE_FROM_RAW_DESCRIPTION', source: 'derived:descRaw'} : {status: 'HOLD', reason: 'RAW_DESCRIPTION_MISSING'};
    } else if (c.kind === 'cast') {
      const idx = Number(c.key.slice(-1)) - 1;
      if (cast.names[idx]) r = {status: 'FILLABLE_FROM_OFFICIAL', reason: 'CAST_IN_OFFICIAL_DESCRIPTION', value: cast.names[idx], source: 'official-description', evidence: [cast.block]};
      else if (idx > 0) r = {status: 'NOT_APPLICABLE', reason: 'NO_ADDITIONAL_PERSON_IN_SOURCE'};
      else if (ctx.showEpisodeCount >= 50 && ctx.showCastBlankRate >= 0.99) r = {status: 'NOT_APPLICABLE', reason: 'SHOW_NEVER_LISTS_CAST', evidence: [`show history: ${Math.round(ctx.showCastBlankRate * 100)}% blank over ${ctx.showEpisodeCount} episodes`]};
      else if (cast.found) r = {status: 'HOLD', reason: 'CAST_BLOCK_EMPTY_OR_UNPARSEABLE', evidence: [cast.block]}; // 空ブロックは公式側の未記入の可能性。再探索
      else r = {status: 'HOLD', reason: 'NO_CAST_BLOCK_IN_DESCRIPTION'};
    } else if (c.kind === 'related') {
      r = /asahi\.com\/(?:articles|topics)\//.test(row[21] || ctx.official?.descRaw || '') ? {status: 'FILLABLE_FROM_OFFICIAL', reason: 'RELATED_ARTICLE_URLS_IN_DESCRIPTION', source: 'official-description'}
        : {status: 'NOT_APPLICABLE', reason: 'NO_RELATED_ARTICLE_IN_SOURCE'};
    } else { // platform
      const res = ctx.resolutions?.[c.platform];
      if ((ctx.unsupportedPlatforms || []).includes(c.platform)) r = {status: 'HOLD', reason: 'NO_VERIFIED_ROUTE'};
      else if (res?.status === 'VERIFIED') r = {status: 'FILLABLE_FROM_OFFICIAL', reason: 'PLATFORM_EPISODE_VERIFIED', value: res.url, source: 'platform:' + c.platform, evidence: res.evidence || []};
      else if (res && ['HOLD', 'ERROR'].includes(res.status)) r = {status: 'HOLD', reason: res.reason || res.status};
      else if (ageH != null && ageH < grace[c.platform]) r = {status: 'NOT_YET_PUBLISHED', reason: `WITHIN_GRACE_${grace[c.platform]}H`, retry: true};
      else if (res?.status === 'NOT_FOUND') r = {status: 'HOLD', reason: 'NOT_FOUND_AFTER_GRACE'}; // サービス側未公開か探索失敗か断定できない=HOLD
      else r = {status: 'HOLD', reason: 'NOT_CHECKED'};
    }
    out.push({...base, ...r});
  }
  return out;
}

/** 提案。確認済みの空欄補完のみ autoApplicable。既存値は決して提案に含めない(上書き禁止)。 */
export function proposals(epId, row, audit, {checkedAt}) {
  return audit.filter(a => a.status === 'FILLABLE_FROM_OFFICIAL' && a.value != null && a.value !== '').map(a => ({
    epId, col: a.col, key: a.key, value: a.value, source: a.source, evidence: a.evidence || [], checkedAt, verified: true,
    // 氏名は概要文からの抽出で実測94%(cast1)。『確実』とは言えないため提案止まり(人間の抜取確認後に適用)。URL/公式フィード値はGUID等の強照合のみ自動可。
    autoApplicable: blank(row[a.col]) && a.kind !== 'cast', mode: a.kind === 'cast' ? 'suggest-only' : 'fill-blank-only'}));
}
/** 適用: 空欄だけを書く。冪等。変更ログ(rollback用の旧値=空)を返す。入力rowsは変更しない。 */
export function applyProposals(rows, props, {appliedAt}) {
  const out = new Map([...rows].map(([k, v]) => [k, v.slice()])), log = [], skipped = [];
  for (const p of props) {
    const r = out.get(p.epId);
    if (!r || !p.autoApplicable || !p.verified) { skipped.push({epId: p.epId, col: p.col, reason: 'NOT_AUTO_APPLICABLE'}); continue; }
    if (!blank(r[p.col])) { skipped.push({epId: p.epId, col: p.col, reason: 'ALREADY_FILLED_NO_OVERWRITE'}); continue; }
    r[p.col] = p.value; log.push({epId: p.epId, col: p.col, old: '', new: p.value, source: p.source, evidence: p.evidence, appliedAt, rollback: {col: p.col, restore: ''}});
  }
  return {rows: out, log, skipped};
}
