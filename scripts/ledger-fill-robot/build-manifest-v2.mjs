// 第50号(司令塔 2026-11-11): LISTEN K列 残件の固定マニフェスト生成 v2（読取専用・書込なし）。
// 方針:
//  - 行番号に依存しない。基本キー = EP-ID + GUID（台帳 J列 itemid / G列 外部ID）。書込時はロボットが EP-ID で行を再解決し GUID を再確認する。
//  - 有効EPのみ: 台帳 BD列「掲載判定」=対象 かつ 「図書館・宇宙 検索対象判定」E列=通常/日時差分 かつ 代表EP-ID=自分。
//  - SDGs1095 タブを SDGs番組の正本として優先（SDGs行は LISTEN 配信なし→補填対象外。GUIDが SDGs1095 と衝突する非SDGs行は HOLD）。
//  - 既存 LISTEN URL は上書きしない（K非空は除外、K既使用URLも除外）。
//  - LISTEN RSS(最新ダンプ) の guid 完全一致 + 番組一致 + 配信日(JST暦日)±1日 + 個別EP URL 形状。GUID は台帳内・RSS内とも一意であること。
// usage:
//   node build-manifest-v2.mjs --ledger AK.json --judge BDBE.json --scope 判定タブ.json --sdgs SDGs1095.json \
//        --rss lpa.json --out manifest.json --report report.json --run-id <id> [--issue 283] [--max 1000] [--hold EP-1,EP-2]
// 入力 JSON はいずれも Sheets values.get 形式 {values:[[...],...]}（rss は probe-listen-pody-amazon.mjs のダンプ {listen:{番組:{all:[[guid,url,date],...]}}}）。
import fs from 'node:fs';
import crypto from 'node:crypto';

export const DEFAULT_HOLD = ['EP-00418', 'EP-06591', 'EP-03857', 'EP-06595', 'EP-03858', 'EP-06596', 'EP-03861', 'EP-06597', 'EP-05110', 'EP-05109', 'EP-03157'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LISTEN_URL = /^https:\/\/listen\.style\/p\/[a-z0-9]{8}\/[a-z0-9]{8}$/;
const ELIGIBLE_SCOPE_E = new Set(['通常', '日時差分']);
const SDGS_SHOW = 'SDGsを話そう';

const s = (v) => (v === undefined || v === null ? '' : String(v)).trim();
const low = (v) => s(v).toLowerCase();
export function rowGuids(r) {
  const out = new Set();
  const m = s(r[9]).match(/itemid=([0-9a-f-]{36})/i); if (m) out.add(m[1].toLowerCase());
  const g = low(r[6]); if (UUID.test(g)) out.add(g);
  return out;
}
// 台帳 D列 "2026/10/10 04:00"(JST) → JST暦日の通日
function jstDay(d) {
  const m = s(d).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/); if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5;
}
// RSS pubDate(RFC822) → JST暦日の通日
function rssJstDay(p) {
  const t = Date.parse(p); if (Number.isNaN(t)) return null;
  return Math.floor((t + 9 * 3600e3) / 864e5);
}

export function buildManifest({ ledger, judge, scope, sdgs, rss, runId, issue = '283', max = 1000, hold = DEFAULT_HOLD }) {
  // 台帳V2で列順が変わったら誤読せず停止する（列は見出し名で確認。行番号は使わない）
  const need = (t, i, name, tab) => { if (!s((t[0] || [])[i]).startsWith(name)) throw new Error(`HEADER_MISMATCH ${tab}[${i}] expected "${name}" got "${s((t[0] || [])[i])}"`); };
  [[0, '台帳ID'], [1, '番組名'], [3, '配信日時'], [6, '外部ID'], [9, '公式個別URL'], [10, 'LISTEN URL']].forEach(([i, n]) => need(ledger, i, n, 'エピソード台帳'));
  need(judge, 0, '掲載判定', 'エピソード台帳!BD');
  if (scope) [[0, 'EP-ID'], [4, '判定区分'], [6, '代表EP-ID']].forEach(([i, n]) => need(scope, i, n, '検索対象判定'));
  if (sdgs) [[12, 'Asahi.com URL'], [18, '公式JSON UUID']].forEach(([i, n]) => need(sdgs, i, n, 'SDGs1095'));
  const L = ledger.slice(1), J = judge.slice(1);
  if (L.length !== J.length) throw new Error(`LEDGER_JUDGE_LENGTH_MISMATCH ${L.length}!=${J.length}`);
  const excl = {}, exIds = {};
  const ex = (why, ep) => { excl[why] = (excl[why] || 0) + 1; (exIds[why] = exIds[why] || []).push(ep); };

  // 台帳: EP-ID一意性・GUID一意性・K既使用URL
  const epCount = {}, guidCount = {}, guidRows = {}, usedK = new Set(), review = [];
  L.forEach((r, i) => {
    epCount[s(r[0])] = (epCount[s(r[0])] || 0) + 1;
    rowGuids(r).forEach((g) => { guidCount[g] = (guidCount[g] || 0) + 1; (guidRows[g] = guidRows[g] || []).push(i); });
    if (s(r[10])) usedK.add(s(r[10]));
  });
  // 掲載判定タブ（EP-IDで引く。行番号は使わない）
  const scopeBy = new Map();
  (scope || []).slice(1).forEach((r) => { if (s(r[0])) scopeBy.set(s(r[0]), r); });
  // SDGs1095（正本）: S列 公式JSON UUID と M列 asahi itemid
  const sdgsGuid = new Set();
  (sdgs || []).slice(1).forEach((r) => {
    const u = low(r[18]); if (UUID.test(u)) sdgsGuid.add(u);
    const m = s(r[12]).match(/itemid=([0-9a-f-]{36})/i); if (m) sdgsGuid.add(m[1].toLowerCase());
  });
  // RSS: guid→{show,url,date}。guid重複・URL重複は HOLD 扱い
  const rssBy = new Map(), rssDupGuid = new Set(), rssUrlCount = {};
  for (const [show, v] of Object.entries(rss.listen || {})) {
    for (const [g0, url, date] of v.all || []) {
      const g = low(g0); if (!g) continue;
      rssUrlCount[url] = (rssUrlCount[url] || 0) + 1;
      if (rssBy.has(g)) rssDupGuid.add(g); else rssBy.set(g, { show, url: s(url), date });
    }
  }

  const holdSet = new Set(hold);
  const cells = [], seenUrl = new Set();
  const sdgsCheck = { ledgerSdgsRows: 0, inSdgs1095: 0, notInSdgs1095: [], sdgs1095Guids: sdgsGuid.size };
  let eligibleKEmpty = 0;
  L.forEach((r, i) => {
    const ep = s(r[0]), show = s(r[1]);
    if (!ep) return ex('NO_EPID', `row${i + 2}`);
    const guids = rowGuids(r);
    if (show === SDGS_SHOW) {
      sdgsCheck.ledgerSdgsRows++;
      if ([...guids].some((g) => sdgsGuid.has(g))) sdgsCheck.inSdgs1095++; else sdgsCheck.notInSdgs1095.push(ep);
      return ex('SDGS_NO_LISTEN_FEED', ep);
    }
    if (s(r[10])) return ex('K_NON_EMPTY_KEEP', ep);           // 既存URLは上書きしない
    const bd = s(J[i][0]);
    if (bd !== '対象') return ex('NOT_ELIGIBLE_' + (bd || '空欄'), ep);
    const sc = scopeBy.get(ep);
    if (!sc) return ex('SCOPE_ROW_MISSING', ep);
    if (!ELIGIBLE_SCOPE_E.has(s(sc[4]))) return ex('SCOPE_NOT_NORMAL', ep);
    if (s(sc[6]) && s(sc[6]) !== ep) return ex('SCOPE_REPRESENTATIVE_OTHER', ep);
    eligibleKEmpty++;
    if (holdSet.has(ep)) return ex('HOLD_LIST', ep);
    if (epCount[ep] > 1) return ex('EPID_DUP', ep);
    if (guids.size === 0) return ex('NO_GUID', ep);
    if (guids.size > 1) return ex('GUID_CONFLICT_J_G', ep);
    const g = [...guids][0];
    if (sdgsGuid.has(g)) return ex('GUID_IN_SDGS1095', ep);
    const x = rssBy.get(g);
    const why = (() => {
      if (!x) return 'NO_RSS_MATCH';
      if (rssDupGuid.has(g)) return 'RSS_GUID_DUP';
      if (x.show !== show) return 'SHOW_MISMATCH';
      const dl = jstDay(r[3]), dr = rssJstDay(x.date);
      if (dl === null || dr === null) return 'DATE_UNPARSEABLE';
      if (Math.abs(dl - dr) > 1) return 'DATE_OVER_1DAY';
      if (!LISTEN_URL.test(x.url)) return 'BAD_URL_SHAPE';
      if (rssUrlCount[x.url] > 1) return 'RSS_URL_DUP';
      if (usedK.has(x.url)) return 'URL_ALREADY_IN_K';
      if (seenUrl.has(x.url)) return 'URL_DUP_IN_MANIFEST';
      return '';
    })();
    if (guidCount[g] > 1) {
      // 同一GUIDが他行にもある（番組横断の再掲など）。厳格版では除外し、別承認用レビュー一覧にだけ載せる。
      const others = guidRows[g].filter((j) => j !== i);
      const othersNonEligible = others.every((j) => s(J[j][0]) !== '対象' && !s(L[j][10]));
      if (!why && othersNonEligible) review.push({ epId: ep, guid: g, url: x.url, show, sharedWith: others.map((j) => ({ epId: s(L[j][0]), show: s(L[j][1]), judge: s(J[j][0]) })) });
      return ex('GUID_DUP_IN_LEDGER', ep);
    }
    if (why) return ex(why, ep);
    const dl = jstDay(r[3]), dr = rssJstDay(x.date);
    seenUrl.add(x.url);
    cells.push({ epId: ep, guid: g, column: 'K', expectedOld: '', url: x.url, show, rssPubDate: x.date, dateDiffDays: dl - dr, basis: 'LISTEN RSS guid==台帳GUID(J itemid/G) + 番組一致 + JST暦日±1日 + 掲載判定=対象' });
  });

  const total = cells.length;
  const batches = [];
  for (let b = 0; b * max < total; b++) {
    const part = cells.slice(b * max, (b + 1) * max);
    const m = { runId: `${runId}-b${b + 1}`, urlShape: 'listen', keyPolicy: 'EPID+GUID', guidCheck: { columns: ['G', 'J'] }, holdEpIds: hold, approval: { issue, columns: ['K'], maxCells: max, sheet: 'エピソード台帳' }, cells: part };
    m.sha256 = crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex');
    batches.push(m);
  }
  const report = {
    generatedBy: 'build-manifest-v2.mjs', runId, ledgerRows: L.length, kNonEmpty: usedK.size, eligibleKEmpty, manifestCells: total,
    batches: batches.map((m) => ({ runId: m.runId, cells: m.cells.length, sha256: m.sha256 })),
    byShow: cells.reduce((a, c) => ((a[c.show] = (a[c.show] || 0) + 1), a), {}),
    excluded: excl, excludedEpIdsSample: Object.fromEntries(Object.entries(exIds).filter(([k]) => !/K_NON_EMPTY|SDGS_NO_LISTEN|NOT_ELIGIBLE/.test(k)).map(([k, v]) => [k, v.slice(0, 300)])),
    sdgsCheck: { ...sdgsCheck, notInSdgs1095: sdgsCheck.notInSdgs1095.slice(0, 50), notInSdgs1095Count: sdgsCheck.notInSdgs1095.length },
  };
  report.reviewSharedGuid = { cells: review.length, note: '別承認用。厳格マニフェストには含めない。同一GUIDの他行は全て非対象かつK空欄。' };
  return { batches, report, review };
}

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const vals = (f) => (f ? rd(f).values : null);
  const hold = arg('hold') ? arg('hold').split(',') : DEFAULT_HOLD;
  const { batches, report, review } = buildManifest({ ledger: vals(arg('ledger')), judge: vals(arg('judge')), scope: vals(arg('scope')), sdgs: vals(arg('sdgs')), rss: rd(arg('rss')), runId: arg('run-id', 'listen-k-v2'), issue: arg('issue', '283'), max: +arg('max', 1000), hold });
  const out = arg('out', 'manifest.json');
  batches.forEach((m, i) => fs.writeFileSync(out.replace(/\.json$/, `-b${i + 1}.json`), JSON.stringify(m, null, 1)));
  fs.writeFileSync(arg('report', 'manifest-report.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(out.replace(/\.json$/, '-review-shared-guid.json'), JSON.stringify({ status: 'REVIEW_ONLY_NOT_APPROVED', cells: review }, null, 1));
  console.log(JSON.stringify({ cells: report.manifestCells, eligibleKEmpty: report.eligibleKEmpty, batches: report.batches, excluded: report.excluded, reviewSharedGuid: review.length, sdgs: { rows: report.sdgsCheck.ledgerSdgsRows, in1095: report.sdgsCheck.inSdgs1095, notIn: report.sdgsCheck.notInSdgs1095Count } }));
}
