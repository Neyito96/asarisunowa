/** Phase26: 台帳の空欄を列ごとに監査し、補完提案(根拠つき・非破壊)を作る。純粋関数・IOなし・推測で埋めない。
 * 既存の共通基盤を再利用し、取得ロボを増やさない: EP-ID/GUID/差分=daily-ingest(#288) / 6サービス探索=platform-resolver(#281, 注入) /
 * 列定義=base-ledger LEDGER_COL(#279)。ここは「空欄の分類」と「適用(上書き禁止)」と「優先度付き再試行」だけを持つ。 */
export const GAP = Object.freeze(['FILLED', 'FILLABLE_FROM_OFFICIAL', 'NOT_YET_PUBLISHED', 'NOT_APPLICABLE', 'HOLD', 'UNMEASURED']);
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
import {editDescription} from './description-editor.mjs';
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
const NAME_RE = new RegExp(`(?<![${CJK}・])((?:[${HK}]{2,12}(?:・[${HK}]{1,12})?)(?:(?![${CJK}])|(?=さん|氏))|[${CJK}]{2,12}(?=さん|氏|\\s*[（(]))((?:さん|氏)?(?:\\s*[（(][^）)]*[）)])?(?:さん|氏)?)`, 'gu');
const NOT_NAMES = new Set(['ママ', '常連客', 'スタッフ', 'ゲスト', '出演', 'マスター']);
const TERMINATOR = /[★※◆■▼◎]|お便り|ご感想|アプリ|ぜひ|お待ち|募集|対象は/;
function roleOf(original, name) { // 同じ行内で氏名の直前(行頭〜)または直後(括弧内・隣接)にある役割語
  const i = original.indexOf(name); if (i < 0) return '';
  const ls = original.lastIndexOf('\n', i) + 1, le = original.indexOf('\n', i); const line = original.slice(ls, le < 0 ? undefined : le);
  const pos = i - ls, after = line.slice(pos + name.length, pos + name.length + 24), before = line.slice(Math.max(0, pos - 14), pos);
  const m = /(音源編集|MC|聞き手|司会|ゲスト)/.exec(after.split(/[）)]/)[0] + (/^\s*[（(]/.test(after) ? '' : '')) || /(音源編集|MC|聞き手|司会|ゲスト)[・\s]*$/.exec(before);
  return m ? m[1] : '';
}
export function extractCast(descRaw) {
  const ROLE = '(?:MC|音源編集|聞き手|司会|ゲスト)';
  let text = stripHtml(descRaw).replace(/https?:\/\/\S+/g, ' ');
  const m = /【出演[^】]*】([\s\S]*?)(?=【|$)/.exec(text);
  if (!m) return {names: [], people: [], notes: '', block: '', found: false, confidence: 'none'};
  let block = m[1], notes = '';
  const t = TERMINATOR.exec(block); if (t) { notes = block.slice(t.index).trim().slice(0, 120); block = block.slice(0, t.index); }
  const original = block;
  block = block.replace(new RegExp(`(?<![（(、,])${ROLE}(?:[・、,]${ROLE})*[・\\s]*`, 'g'), '\n').replace(/[ \t\u3000]+/g, ' ');
  const names = [], people = [], seen = new Set();
  const STANDALONE = new RegExp(`^[\\p{Script=Han}\\p{Script=Katakana}ー々]{1,4}[\\p{Script=Hiragana}]{1,4}$`, 'u'); // 「金澤ひかり」のようにひらがなを含む名は、その行に単独で書かれている時だけ採る
  const matches = [];
  let off = 0;
  for (const line of block.split('\n')) {
    const found = [...line.matchAll(NAME_RE)].map(mm => ({...mm, index: off + mm.index}));
    const bare = line.trim().replace(/^[・\s]+/, '');
    if (!found.length && STANDALONE.test(bare) && !NOT_NAMES.has(bare)) matches.push(Object.assign([bare, bare, ''], {index: off}));
    else matches.push(...found);
    off += line.length + 1;
  }
  for (const mm of matches) {
    let name = mm[1].replace(/^・/, ''), paren = mm[2].trim();
    if (NOT_NAMES.has(name)) continue;
    if (!paren && name.length > 6 && !name.includes('・')) continue; // 括弧なしの長い連続漢字は氏名とみなさない
    if (!paren && /(?:者|家|員|長|官|優|師|授|生|者さん)$/.test(name)) continue; // 肩書・職種語(俳優/認知科学者等)は氏名ではない
    paren = paren.replace(/(?:さん|氏)/g, '').trim();
    if (name.length < 2 || seen.has(name)) continue;
    seen.add(name); names.push(name + paren);
    people.push({name, affiliation: paren.replace(/^[（(]|[）)]$/g, ''), role: roleOf(original, name)});
  }
  // 役割ごとの信頼度: 音源編集=制作スタッフ(台帳側の記載方針が一定でない)→要確認。氏名以外の注記(★等)があったことも返す。
  const needsReview = people.some(x => x.role === '音源編集') || names.length > 5;
  return {names: names.slice(0, 5), people: people.slice(0, 8), notes, block: block.trim().slice(0, 200), found: true, confidence: needsReview ? 'review' : 'clean'};
}

/** ctx: {now(ms), pubDate(ms), official:{descRaw,audio,guid,pubDate}, resolutions:{platform:{status,url,evidence,reason}}, showCastBlankRate, showEpisodeCount,
 *       graceHours:{spotify:...}, unsupportedPlatforms:[...]} */
export function auditRow(row, ctx) {
  const out = [], ageH = ctx.pubDate ? (ctx.now - ctx.pubDate) / HOUR : null;
  const grace = {asahi: 6, listen: 24, spotify: 24, apple: 24, amazon: 72, pocketcasts: 48, pody: 48, ...(ctx.graceHours || {})};
  const cast = extractCast(row[21] || ctx.official?.descRaw);
  for (const c of AUDIT_COLS) {
    const v = row[c.col], base = {col: c.col, key: c.key, label: c.label, tier: c.tier, kind: c.kind};
    if ((ctx.unmeasuredKeys || []).includes(c.key)) { out.push({...base, status: 'UNMEASURED', reason: 'COLUMN_NOT_IN_INPUT_DATA'}); continue; } // 入力に列が無い=判定していない(埋まっていない/不要のどちらでもない)
    if (!blank(v)) { out.push({...base, status: 'FILLED', reason: 'PRESENT'}); continue; }
    let r;
    if (c.kind === 'feed') {
      const o = {datetime: ctx.official?.pubDate, guid: ctx.official?.guid, audio: ctx.official?.audio, descRaw: ctx.official?.descRaw}[c.key];
      r = !blank(o) ? {status: 'FILLABLE_FROM_OFFICIAL', reason: 'OFFICIAL_FEED_HAS_VALUE', value: String(o), source: 'official-feed', evidence: ['guid-matched feed item']}
        : {status: 'HOLD', reason: 'FEED_VALUE_MISSING'};
    } else if (c.kind === 'derived') { // 清掃済み概要は原文からの派生。原文が埋まってから作る(推測で作らない)
      const raw = row[21] || ctx.official?.descRaw;
      if (blank(raw)) r = {status: 'HOLD', reason: 'RAW_DESCRIPTION_MISSING'};
      else { // 既存の description-editor(V3)で生成。原文は変更しない。保留事由(PUBLIC_RESIDUE等)があれば自動補完せず保留。
        const ed = editDescription(raw, {relatedUrls: String(row[28] || '').split(/[\s,;]+/).filter(Boolean)});
        r = ed.holds.length ? {status: 'HOLD', reason: 'DESCRIPTION_EDIT_HOLD:' + ed.holds.join('+'), needsReview: true, source: 'derived:description-editor'}
          : {status: 'FILLABLE_FROM_OFFICIAL', reason: 'DERIVED_BY_DESCRIPTION_EDITOR', value: ed.description, source: 'derived:description-editor@' + ed.version, evidence: [`removed ${ed.removed.length} blocks; raw untouched`]};
      }
    } else if (c.kind === 'cast') {
      const idx = Number(c.key.slice(-1)) - 1;
      const known = Math.max(cast.names.length, [45, 46, 47, 48, 49].filter(k => !blank(row[k])).length);
      const hint = ctx.showEpisodeCount >= 50 && ctx.showCastBlankRate >= 0.99 ? {historyHint: `過去${ctx.showEpisodeCount}件中${Math.round(ctx.showCastBlankRate * 100)}%が空欄(参考情報であり根拠ではない)`} : {};
      if (cast.names[idx]) r = {status: 'FILLABLE_FROM_OFFICIAL', reason: 'CAST_IN_OFFICIAL_DESCRIPTION', value: cast.names[idx], source: 'official-description', evidence: [cast.block], confidence: cast.confidence, role: cast.people[idx]?.role || ''};
      // 公式側の明示(番組情報で出演者を載せない旨/出演者なし)がある時だけ NOT_APPLICABLE。過去の空欄率だけでは決めない(要確認の保留)。
      else if (ctx.officialNoCast === true) r = {status: 'NOT_APPLICABLE', reason: 'OFFICIAL_STATES_NO_CAST', evidence: ctx.officialNoCastEvidence || ['official statement']};
      else if (idx > 0 && cast.names.length > 0 && cast.found) r = {status: 'NOT_APPLICABLE', reason: 'SOURCE_BLOCK_LISTS_ONLY_' + cast.names.length, evidence: [cast.block]};
      else if (idx > 0) r = {status: 'HOLD', reason: known ? 'ADDITIONAL_CAST_UNCONFIRMED' : 'CAST_UNDOCUMENTED_NEEDS_REVIEW', needsReview: true};
      else if (cast.found) r = {status: 'HOLD', reason: 'CAST_BLOCK_EMPTY_OR_UNPARSEABLE', evidence: [cast.block], needsReview: true}; // 空ブロックは公式側の未記入の可能性。再探索
      else r = {status: 'HOLD', reason: 'UNKNOWN_UNDOCUMENTED', needsReview: true, ...hint}; // 記載なし=「不要」の証明にならない。未記録・要確認のまま。
    } else if (c.kind === 'related') {
      r = /asahi\.com\/(?:articles|topics)\//.test(row[21] || ctx.official?.descRaw || '') ? {status: 'FILLABLE_FROM_OFFICIAL', reason: 'RELATED_ARTICLE_URLS_IN_DESCRIPTION', source: 'official-description'}
        : {status: 'HOLD', reason: 'NO_RELATED_IN_DESCRIPTION_UNCONFIRMED', needsReview: true}; // 概要に無い=関連記事が存在しない証明ではない
    } else { // platform
      const res = ctx.resolutions?.[c.platform];
      if (((ctx.notProvided || {})[c.platform] || []).includes(row[1])) r = {status: 'NOT_APPLICABLE', reason: 'CONFIGURED_NOT_PROVIDED', evidence: ['config.notProvided']};
      else if ((ctx.unsupportedPlatforms || []).includes(c.platform)) r = {status: 'HOLD', reason: 'NO_VERIFIED_ROUTE'};
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
    autoApplicable: blank(row[a.col]) && a.kind !== 'cast', confidence: a.confidence, mode: a.kind === 'cast' ? 'suggest-only' : 'fill-blank-only'}));
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
