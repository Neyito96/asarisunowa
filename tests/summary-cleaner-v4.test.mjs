// 概要欄清掃ロボV4の試験。合成した原文（正解を作り方から知っている独立の正解セット）120件で精度を測る。実在の本文は使わない。
// ＋ 配布GAS（gas/summary-cleaner/dist）を GAS 模擬環境で通しで動かす（模擬PASS ≠ 実機確認）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { cleanV4, judgeEpisode, sections, parseCastLine, castCell, relatedCell } from '../scripts/ledger-v2/summary-cleaner-v4.mjs';
import { buildCleanerGas } from '../scripts/ledger-v2/build-cleaner-gas.mjs';

// ---- 正解つき合成データの生成（決定的） ----
const HEADS = ['', '【番組内容】', '【番組説明】', '【内容】', '【概要】', '【今回のテーマ】', '［番組内容］', '■番組内容：'];
const REL_HEADS = ['【関連記事】', '【関連リンク】', '[関連記事]', '【まとめてわかる】'];
const STAFF_HEADS = ['【出演・スタッフ】', '【出演者】', '【出演】', '［出演・スタッフ］'];
const PROMOS = ['ご意見・感想・リクエスト https://bit.ly/x1', 'ほかにも多彩な番組を配信中！ http://t.asahi.com/w', 'See omnystudio.com/listener for privacy information.', 'Learn more about your ad choices. Visit megaphone.fm/adchoices', 'X（旧Twitter）はこちら https://x.com/asapoki_x', '番組へのおたよりフォーム https://bit.ly/form1', 'イベント参加者を募集しています https://t.asahi.com/ev'];
function gen(n) {
  const pick = (a, k) => a[(n * 7 + k * 3) % a.length], body = [`合成${n}番の本文です。記者が「話題${n}」を解説します。`];
  if (n % 3 === 0) body.push(`後半はXで話題になった投稿${n}について考えます。`);   // 本編としてのXの話題（消してはいけない）
  if (n % 4 === 0) body.push(`リスナーのおたよりも紹介します（第${n}回）。`);
  const arts = Array.from({ length: n % 4 }, (_, k) => ({ title: `合成記事${n}-${k}の見出し`, url: `https://www.asahi.com/articles/ASZ${String(n).padStart(4, '0')}${k}AAAA.html` }));
  const staff = n % 5 === 4 ? [] : [`合成${n}郎（記者）`, ...(n % 2 ? [`MC 合成${n}子`] : []), ...(n % 6 === 1 ? [`ゲスト${n}さん（作家） https://x.com/guest${n}`] : [])];
  const html = n % 2 === 0;
  const P = (lines) => (html ? '<p>' + lines.join('<br>') + '</p>' : lines.join('\n'));
  const parts = [P([pick(HEADS, 1) + body[0], ...body.slice(1)].filter(Boolean))];
  if (arts.length) parts.push(P([pick(REL_HEADS, 2), ...arts.flatMap((a) => (n % 3 === 1 ? [a.title + ' ' + a.url + '?iref=omny'] : [a.title, a.url + '?iref=omny']))]));
  if (staff.length) parts.push(P([pick(STAFF_HEADS, 3), ...staff]));
  parts.push(P([pick(PROMOS, 4), pick(PROMOS, 5)]));
  if (n % 7 === 0) parts.push(P(['【おねがい】', '番組継続のため、会員登録をお願いします！ http://t.asahi.com/x']));
  return { raw: (html ? '' : '') + parts.join(html ? ' ' : '\n'), body, arts, staff, promos: [pick(PROMOS, 4), pick(PROMOS, 5)] };
}
const CASES = Array.from({ length: 120 }, (_, i) => gen(i + 1));

test('独立の正解セット120件: 本文の取りこぼし0・宣伝の残り0・関連記事は見出し＋URLの組が完全一致・出演者（リンク含む）の取りこぼし0', () => {
  let bodyNeed = 0, bodyHit = 0, promoNeed = 0, promoLeft = 0, artNeed = 0, artExact = 0, artExtra = 0, castNeed = 0, castHit = 0, linkNeed = 0, linkHit = 0;
  for (const c of CASES) {
    const r = cleanV4(c.raw);
    for (const b of c.body) { bodyNeed++; if (r.text.includes(b)) bodyHit++; }
    for (const p of c.promos) { promoNeed++; const core = p.replace(/https?:\/\/\S+/g, '').trim().slice(0, 12); if (core && r.text.includes(core)) promoLeft++; }
    for (const a of c.arts) { artNeed++; if (r.related.some((x) => x.url === a.url && x.title === a.title)) artExact++; }
    artExtra += r.related.filter((x) => !c.arts.some((a) => a.url === x.url)).length;
    for (const s of c.staff) { castNeed++; const nm = s.replace(/https?:\/\/\S+/, '').replace(/[（(].*$/, '').replace(/^MC\s*/, '').trim(); if (r.cast.some((x) => x.name.includes(nm))) castHit++;
      const u = (s.match(/https?:\/\/\S+/) || [])[0]; if (u) { linkNeed++; if (r.cast.some((x) => x.links.includes(u))) linkHit++; } }
    assert.ok(!/https?:|<|&nbsp;|iref=/.test(r.text), 'URL・タグ残り ' + c.raw.slice(0, 40));
  }
  if (process.env.SC4_DEBUG) for (const c of CASES) { const r = cleanV4(c.raw); for (const s of c.staff) { const nm = s.replace(/https?:\/\/\S+/, '').replace(/[（(].*$/, '').replace(/^MC\s*/, '').trim(); if (!r.cast.some((x) => x.name.includes(nm))) console.log('MISS', nm, JSON.stringify(c.raw.slice(-260)), JSON.stringify(r.cast)); } }
  const m = { bodyRecall: bodyHit / bodyNeed, promoLeft, artPairRecall: artExact / artNeed, artExtra, castRecall: castHit / castNeed, castLinkRecall: linkHit / linkNeed, n: CASES.length };
  console.log('SC4 metrics', JSON.stringify(m));
  assert.equal(m.bodyRecall, 1); assert.equal(promoLeft, 0); assert.equal(m.artPairRecall, 1); assert.equal(artExtra, 0); assert.equal(m.castRecall, 1); assert.equal(m.castLinkRecall, 1);
});

test('見出しの揺れ（全半角・括弧・コロン）を境界として扱い、本文系の見出しは中身を残す', () => {
  for (const h of HEADS.filter(Boolean)) { const r = cleanV4(`${h}本文の一行目。\n【出演】\n合成太郎（記者）`); assert.equal(r.text, '本文の一行目。', h); assert.equal(r.cast[0].name, '合成太郎'); }
  assert.deepEqual(sections('前文\n【関連記事】\n見出し\nhttps://www.asahi.com/articles/A.html').map((s) => s.kind), ['body', 'related']);
});

test('出演者: 役割・氏名・所属・リンクを分ける。氏名は推定しない', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parseCastLine('MC・音源編集　山根久美子（大阪ネットワーク報道本部）https://t.asahi.com/wqun'))), { role: 'MC・音源編集', name: '山根久美子', note: '大阪ネットワーク報道本部', links: ['https://t.asahi.com/wqun'], raw: 'MC・音源編集　山根久美子（大阪ネットワーク報道本部）https://t.asahi.com/wqun' });
  assert.equal(parseCastLine('神田大介（MC、音源編集） https://bit.ly/4k4ZKwA').role, 'MC、音源編集');
  const r = cleanV4('本文。\n【出演・スタッフ】\n松本龍三郎（スポーツ部） https://x.com/asahi_b ／ https://buff.ly/l\nMC 堀江麻友');
  assert.deepEqual(r.cast[0].links, ['https://x.com/asahi_b', 'https://buff.ly/l']); assert.equal(castCell(r.cast).split('\n').length, 2);
});

test('本編としてのX・イベントの話題は残す／宣伝のリンク・応募フォームは除く／見出しのない記事URLは要確認', () => {
  const r = cleanV4('Xで炎上した投稿をめぐり、記者が経緯を解説します。\nイベント会場の混乱について取材しました。\n応募フォームはこちら https://forms.gle/abc\nフォローしてね https://x.com/acct');
  assert.ok(r.text.includes('Xで炎上した投稿')); assert.ok(r.text.includes('イベント会場の混乱')); assert.ok(!r.text.includes('応募フォーム')); assert.ok(!r.text.includes('フォロー'));
  const q = cleanV4('本文。\n【関連記事】\nhttps://www.asahi.com/articles/ONLYURL.html'); assert.ok(q.holds.includes('RELATED_URL_WITHOUT_TITLE')); assert.equal(judgeEpisode('本文。\n【関連記事】\nhttps://www.asahi.com/articles/ONLYURL.html', {}).verdict !== '自動検査合格・目視未確認', true);
});

test('既存値の保護: 旧自動清掃と同じ値・空欄だけ書換可。手で直した値は書かず要確認。同一なら書換なし', () => {
  const raw = '<p>本文です。合成の話。</p><p>ほかにも多彩な番組を配信中！ http://t.asahi.com/w</p><p>【出演・スタッフ】<br>合成太郎（記者）</p>';
  const blank = judgeEpisode(raw, {}); assert.ok(blank.writable.summary); assert.equal(blank.compare, '旧空欄');
  assert.equal(judgeEpisode(raw, { summary: '本文です。合成の話。\nほかにも多彩な番組を配信中！ http://t.asahi.com/w' }).writable.summary, true);   // 原文から取り出しただけの旧値（宣伝残り）は更新してよい
  const manual = judgeEpisode(raw, { summary: '人が手で整えた概要。' }); assert.equal(manual.writable.summary, false); assert.equal(manual.verdict, '要確認'); assert.match(manual.reason, /MANUAL_EDIT_PROTECTED/);
  const same = judgeEpisode(raw, { summary: blank.clean.text, cast: castCell(blank.clean.cast) }); assert.equal(same.compare, '同一'); assert.equal(same.writable.summary, false); assert.equal(same.writable.cast, false);
  assert.ok(judgeEpisode(raw, { cast: '神田大介' }).findings.length >= 0);
  assert.equal(judgeEpisode('', {}).verdict, 'HOLD'); assert.equal(relatedCell([{ url: 'a' }, { url: 'b' }]), 'a b');
});

// ---- 配布GASの模擬通し ----
const SRC = fs.readFileSync('gas/summary-cleaner/dist/SummaryCleaner.js', 'utf8'), COPY = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY', V2W = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
function mkSheet(rows) { const st = { rows: rows.map((r) => [...r]) }, get = (r, c) => String((st.rows[r - 1] || [])[c - 1] ?? ''), put = (r, c, x) => { while (st.rows.length < r) st.rows.push([]); st.rows[r - 1][c - 1] = typeof x === 'string' && x.charAt(0) === "'" ? x.slice(1) : x; };   // Sheets と同じく先頭の ' は文字列の印として消える
  const rng = (r, c, nr = 1, nc = 1) => { const o = ({ setFormulas: (v) => v.forEach((row, i) => row.forEach((x, j) => put(r + i, c + j, x))), getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))), getDisplayValue: () => get(r, c), setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => put(r + i, c + j, x))), setValue: (x) => put(r, c, x), setNumberFormat() { return o; }, clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (st.rows[r - 1 + i]) st.rows[r - 1 + i][c - 1 + j] = ''; trim(); }, getFormula: () => (st.formulas || {})[r + ':' + c] || '' }); return o; };
  const trim = () => { while (st.rows.length && st.rows[st.rows.length - 1].every((x) => x === '' || x == null)) st.rows.pop(); };
  st.protections = [];
  return { st, getLastRow: () => st.rows.length, getLastColumn: () => Math.max(1, ...st.rows.map((r) => r.length)), getRange: rng, setFrozenRows() {}, clear: () => { st.rows = []; }, clearContents: () => { st.rows = []; }, getProtections: () => st.protections, protect: () => { const p = { d: '', w: false, setDescription(x) { p.d = x; return p; }, getDescription: () => p.d, setWarningOnly(x) { p.w = x; return p; } }; st.protections.push(p); return p; } }; }
function env(feedXml) {
  const box = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), box); const H = [...box.module.exports.HEADERS];
  const row = (ep, g, n) => { const r = H.map(() => ''); r[0] = ep; r[H.indexOf('番組')] = 'ニュースの学校'; r[H.indexOf('公式GUID')] = g; r[H.indexOf('概要（清掃済）')] = n || ''; return r; };
  const G = (i) => 'cccccccc-0000-4000-8000-00000000000' + i;
  const mkBook = (id, name) => ({ id, name, sheets: { 'V2・統合台帳': mkSheet([H, row('EP-1', G(1)), row('EP-2', G(2), '人が直した概要'), row('EP-3', G(3))]) } });
  const books = { [COPY]: mkBook(COPY, '【COPY試験】X'), [V2W]: mkBook(V2W, 'V2作業用') }, props = {}, logs = [];
  const g = { Date, JSON, Math, Logger: { log: (s) => logs.push(s) },
    SpreadsheetApp: { openById: (id) => { const b = books[id]; if (!b) throw new Error('UNEXPECTED_OPEN ' + id); return { getId: () => id, getName: () => b.name, getSheetByName: (n) => b.sheets[n] || null, insertSheet: (n) => (b.sheets[n] = mkSheet([])) }; }, flush() {} },
    UrlFetchApp: { fetch: (u) => ({ getResponseCode: () => 200, getContentText: () => (/TASC5851398719/.test(u) ? feedXml(G) : '<rss><channel></channel></rss>') }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, ScriptApp: { getProjectTriggers: () => [] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
    Utilities: { sleep() {}, DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)) } };
  vm.runInNewContext(SRC, g); return { g, books, H, run: (f) => JSON.parse(JSON.stringify(vm.runInNewContext(f + '()', g))) };
}
const RAWX = (t) => `<p>${t}の本文です。</p><p>ほかにも多彩な番組を配信中！ http://t.asahi.com/w</p><p>【関連記事】<br>${t}の記事見出し<br>https://www.asahi.com/articles/AS${t === '一' ? 'X1' : 'X2'}.html?iref=omny</p>`;
const FEED = (G) => `<rss><channel><item><title>A</title><guid>${G(1)}</guid><pubDate>Tue, 10 Nov 2026 19:00:00 GMT</pubDate><description><![CDATA[${RAWX('一')}]]></description></item><item><title>B</title><guid>${G(2)}</guid><pubDate>Tue, 10 Nov 2026 19:00:00 GMT</pubDate><description><![CDATA[${RAWX('二')}]]></description></item></channel></rss>`;

test('配布GAS: 再生成と一致・実行一覧・収蔵の入口は出さない・トリガー作成は承認後のD8だけ', () => {
  assert.equal(SRC, buildCleanerGas()['SummaryCleaner.js']);
  const pub = [...SRC.matchAll(/^function ([^\s(]+)\(/gm)].map((m) => m[1]).filter((n) => /^[A-Z]/.test(n) && !/_$/.test(n));   // モジュール内部（即時関数の中）の関数は実行一覧に出ない
  assert.deepEqual(pub, ['S0_進捗', 'S1_点検', 'S2_清掃監査', 'S3A_COPYへ反映_試験10件', 'S3B_COPYへ反映_全件', 'S4_V2作業用へ反映', 'S9_直前の反映を取消', 'S8_診断', 'S7_抜き取り', 'S5A_V2詳細保全_試験10件', 'S5B_V2詳細保全_全件', 'S6A_V2新着_清掃監査', 'S6B_V2新着_反映', 'S10R_非公式S10の書換を取消', 'S4B_V2作業用へ反映_未合格分のみ', 'S9C_COPY反映の取消_20261112', 'P1_人物索引_予行', 'P2_人物索引_COPY作成', 'P0_承認_人物索引V2', 'P3_人物索引_V2作成', 'P9_人物索引_V2を空に戻す', 'C1_出演者_予行', 'C0_承認_出演者修正', 'C2_出演者_反映', 'C9_出演者修正の取消', 'P5_人物索引_予行', 'P5T_途中停止の試験_COPY', 'P5_人物索引_予行_COPY', 'P8_人物索引_直前に戻す', 'P6_人物索引_COPYとV2の突合', 'P5_人物索引_差分更新_COPY', 'P5_人物索引_差分更新', 'P4_承認_人物索引差分更新V2', 'X1_公開台帳_点検', 'X1_公開台帳_点検_COPY', 'X0_承認_公開台帳の修復', 'X2_公開台帳_塞ぎセル除去_COPY', 'X2_公開台帳_塞ぎセル除去', 'X3_公開台帳_警告保護_COPY', 'X3_公開台帳_警告保護', 'D2_清掃と人物_日次', 'D0_承認_清掃日次トリガー', 'D8_清掃日次トリガー設置', 'D9_清掃日次停止', 'D7_停止旗を外す', 'L1_台帳総合監査', 'U1_公式URL_確認', 'U1T_公式URL_確認_試験20件', 'U2_公式URL補完_COPY', 'U0_承認_公式URL補完V2', 'U2_公式URL補完_V2', 'U9_公式URL補完の取消', 'R4_関連記事索引_V2とCOPYの差', 'R1_関連記事索引_予行', 'R2_関連記事索引_COPY作成', 'R0_承認_関連記事索引V2', 'R3_関連記事索引_V2作成', 'R9_関連記事索引_直前に戻す', 'L2_全台帳_差分監査', 'L3_公式音声_確認', 'L4_採否_集計レポート', 'E1_V2公開データ_予行', 'K1_空欄棚卸し', 'LA0_監査一式_実行', 'LA9_監査一式_最初から']);
  assert.ok(!/DriveApp|MailApp/.test(SRC)); assert.ok(!/function\s+do(Get|Post)\b/.test(SRC));
  // トリガー作成は D8 だけ、しかも承認確認と「他のトリガーがあれば断る」の後。削除は D9 だけ
  const fnOf = (re) => [...SRC.matchAll(/function\s+([^\s(]+)\s*\([^)]*\)\s*\{/g)].map((m) => ({ name: m[1], at: m.index })).filter((f, i, a) => re.test(SRC.slice(f.at, (a[i + 1] || { at: SRC.length }).at))).map((f) => f.name);
  assert.deepEqual(fnOf(/newTrigger/), ['D8_清掃日次トリガー設置']); assert.deepEqual(fnOf(/deleteTrigger/), ['D9_清掃日次停止']);
  const d8 = SRC.slice(SRC.indexOf('function D8_清掃日次トリガー設置')); assert.ok(d8.indexOf("'APPROVE_CLEANER_DAILY_TRIGGER'") < d8.indexOf('REFUSED_OTHER_TRIGGERS')); assert.ok(d8.indexOf('REFUSED_OTHER_TRIGGERS') < d8.indexOf('newTrigger'));
});

test('配布GAS模擬: 点検→清掃監査（結果シート・進捗）→再実行は差分0→COPY反映（手動値は守る）→V2作業用は人の確認OKだけ→取消で元に戻る', () => {
  const e = env(FEED), copyL = e.books[COPY].sheets['V2・統合台帳'].st.rows, N = e.H.indexOf('概要（清掃済）'), P = e.H.indexOf('関連記事URL');
  assert.equal(e.run('S1_点検').status, 'CHECK_OK');
  const s2 = e.run('S2_清掃監査'); assert.equal(s2.done, true); assert.equal(s2.updated, 3);
  const res = e.books[COPY].sheets['清掃・結果'].st.rows, Hh = res[0];
  const r1 = res.find((r) => r[0] === 'EP-1'), r2 = res.find((r) => r[0] === 'EP-2'), r3 = res.find((r) => r[0] === 'EP-3');
  assert.equal(r1[Hh.indexOf('判定')], '自動検査合格・目視未確認'); assert.equal(r1[Hh.indexOf('新・概要')], '一の本文です。'); assert.deepEqual(JSON.parse(r1[Hh.indexOf('関連記事JSON(見出し+URL)')]).map((x) => [x.title, x.url]), [['一の記事見出し', 'https://www.asahi.com/articles/ASX1.html']]);
  assert.equal(r2[Hh.indexOf('判定')], '要確認'); assert.match(r2[Hh.indexOf('理由')], /MANUAL_EDIT_PROTECTED/); assert.equal(r3[Hh.indexOf('判定')], 'HOLD');
  const snap = JSON.stringify(res); const again = e.run('S2_清掃監査'); assert.equal(again.updated, 0); assert.equal(JSON.stringify(res), snap);   // 再実行で差分0
  copyL[1][N] = '一の本文です。';   // 前回の反映が途中で止まり、書けたのに履歴が無い状態を再現
  const a = e.run('S3A_COPYへ反映_試験10件'); assert.equal(a.status, 'OK'); assert.equal(a.recoveredHistory, 1); assert.equal(e.books[COPY].sheets['清掃・反映履歴'].st.rows.filter((r) => r[7] === 'OK(回収)').length, 1);
  assert.equal(copyL[1][N], '一の本文です。'); assert.equal(copyL[1][P], 'https://www.asahi.com/articles/ASX1.html'); assert.equal(copyL[2][N], '人が直した概要'); assert.equal(copyL[3][N], '');
  assert.equal(e.run('S3B_COPYへ反映_全件').status, 'OK_NO_CHANGE');
  const v2 = e.books[V2W].sheets['V2・統合台帳'].st.rows, v2snap = JSON.stringify(v2);
  e.g.SC_CONFIG.v2ApplyLevel = 'HUMAN_OK'; assert.equal(e.run('S4_V2作業用へ反映').cellsWritten, 0); assert.equal(JSON.stringify(v2), v2snap);   // 人の確認なし→書かない
  r1[Hh.indexOf('人の確認')] = 'OK'; const w = e.run('S4_V2作業用へ反映'); assert.equal(w.status, 'OK'); assert.equal(v2[1][N], '一の本文です。'); assert.equal(w.detailRows, 1);
  const det = e.books[V2W].sheets['V2・清掃詳細'].st.rows; assert.equal(det[1][0], 'EP-1'); assert.deepEqual(JSON.parse(det[1][2]).map((x) => x.title), ['一の記事見出し']);   // V2側にも見出し＋URLの組を保持
  const u = e.run('S9_直前の反映を取消'); assert.equal(u.undone, 2); assert.equal(v2[1][N], ''); assert.equal(v2[1][P], '');
  assert.equal(det[1][7], '自動検査合格・目視未確認'); assert.equal(det[1][9], '取得');
  e.g.SC_CONFIG.copyId = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'; assert.throws(() => e.run('S1_点検'), /PROTECTED_TARGET_REFUSED/);
});

test('配布GAS模擬: S5 は V2作業用の収蔵詳細に原文、清掃詳細に全EPの構造化データを保存（台帳34列・COPYだけの回は触らない・原文は上書きしない・再実行差分0）', () => {
  const e = env(FEED); e.run('S2_清掃監査');
  const v2b = e.books[V2W].sheets, v2snap = JSON.stringify(v2b['V2・統合台帳'].st.rows);
  e.books[COPY].sheets['V2・統合台帳'].st.rows.push(e.books[COPY].sheets['V2・統合台帳'].st.rows[1].map((x, i) => (i === 0 ? 'EP-9' : x)));   // COPYだけにある回
  e.g.SC_CONFIG.copyId = COPY;
  const a = e.run('S5A_V2詳細保全_試験10件'); assert.equal(a.status, 'OK'); assert.equal(a.raw.added, 3); assert.equal(a.raw.addedMissing, 1); assert.equal(a.detail.rows, 3);
  const raw = v2b['V2・収蔵詳細'].st.rows, det = v2b['V2・清掃詳細'].st.rows;
  assert.equal(raw[0].length, 17); assert.deepEqual(raw.slice(1).map((r) => r[0]), ['EP-1', 'EP-2', 'EP-3']);
  assert.equal(raw[1][4], RAWX('一')); assert.equal(raw[1][5], crypto.createHash('sha256').update(RAWX('一'), 'utf8').digest('hex')); assert.equal(raw[3][4], ''); assert.equal(raw[3][7], '原文なし（欠損）');
  assert.deepEqual(det.slice(1).map((r) => [r[0], r[7], r[9]]), [['EP-1', '自動検査合格・目視未確認', '取得'], ['EP-2', '要確認', '取得'], ['EP-3', 'HOLD', '欠損']]);   // 書き換えない回（要確認・HOLD）も残す
  assert.equal(JSON.stringify(v2b['V2・統合台帳'].st.rows), v2snap);   // 台帳は不変
  const snap = JSON.stringify([raw, det]); const b = e.run('S5B_V2詳細保全_全件'); assert.equal(b.status, 'OK_NO_CHANGE'); assert.equal(JSON.stringify([raw, det]), snap);   // 再実行差分0
  raw[1][4] = '人が残した原文'; raw[1][5] = 'abcd';   // 保全済み原文は RSS が変わっても上書きしない
  const c = e.run('S5B_V2詳細保全_全件'); assert.equal(c.raw.rssChangedLogged, 1); assert.equal(raw[1][4], '人が残した原文'); assert.equal(v2b['V2・原文変化履歴'].st.rows.length, 2);
  assert.equal(e.run('S5B_V2詳細保全_全件').raw.rssChangedLogged, 0);   // 同じ変化は二重に記録しない
});

// ---- Issue #308 品質改善（2026-11-12 実機で見つかった型）。合成原文のみ ----
const P = (...ps) => ps.map((x) => '<p>' + x.join('<br>') + '</p>').join(' ');
const STAFF = ['【出演・スタッフ】', '架空太郎（経済部）https://buff.ly/aaa', 'MC　仮名花子', '音源編集　試験次郎'];
const REL = ['【関連記事】', '架空の見出しその一', 'https://www.asahi.com/articles/ASX0001.html?iref=omny'];
const TAIL = ['【朝ポキ情報】', 'おたよりフォーム https://bit.ly/asapoki_otayori'];
test('型1 見出しの後に文が続くキャンペーン告知は本文に残らない（秋トク型）', () => {
  const raw = P(['【秋トクキャンペーン 11月18日まで】架空コースを初めて申し込む方限定！月額100円', 'https://digital.asahi.com/pr/cp/x/?ref=cp', '', '【番組内容】', '架空の園で忘れ物をした子に先生は宝探しを提案しました。', '※2026年9月17日に収録しました'], REL, STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/キャンペーン|月額100円/.test(j.clean.text)); assert.match(j.clean.text, /宝探し/);
  assert.equal(j.clean.related.length, 1); assert.equal(j.clean.related[0].title, '架空の見出しその一');
  assert.ok(!j.findings.some((f) => /OVER_DELETION|UNDER_DELETION/.test(f)), j.reason);
});
test('型2 番組内容の「お便りをいただきました」を宣伝と誤認しない／冒頭の★新番組告知は消す', () => {
  const raw = P(['★新番組「架空そうだんしつ」をはじめます！', 'そこで質問を募集します。', 'ぜひお寄せください。https://t.asahi.com/xxxx'], ['【番組内容】', 'メーカー勤務のリスナーさんから、原料不足に関するお便りをいただきました。政府の説明と食い違う理由をひもときました。', '※2026年6月10日に収録しました。'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.match(j.clean.text, /お便りをいただきました/); assert.ok(!/新番組|募集/.test(j.clean.text));
  assert.notEqual(j.verdict, '不合格', j.reason);
});
test('型3 イベント告知（見出しだけの行）を消しても監査が本文消失と誤判定しない', () => {
  const raw = P(['【祝・1億DL！　5/31（土）イベント】', '記念グッズを大放出。公開収録やクイズも！', '架空一郎、試験二郎に朝ポキメンバーも多数参加。', 'https://ciy.digital.asahi.com/ciy/0000'], ['【番組内容】', '1936年の架空事件について、当時の通信傍受の経緯を解説します。'], ['※2025年4月4日に収録しました。全3回の3本目です'], REL, STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/記念グッズ|架空一郎/.test(j.clean.text)); assert.match(j.clean.text, /通信傍受/);
  assert.ok(!j.findings.some((f) => /OVER_DELETION|LOST_PROPER_NOUN|PARTIAL_DELETION/.test(f)), j.reason);
});
test('型4 ★フォロー告知の氏名行は本文に入れず、出演者に無い人だけ出演者へ保全', () => {
  const raw = P(['★みなさまからの質問、お待ちしています https://bit.ly/asapoki_otayori'], ['【番組内容】', '架空の政策用語の定義について素朴な疑問をぶつけました。'], ['★朝日新聞アプリで2人をフォローしてください！', '架空太郎 https://bit.ly/aaa', '仮名三郎 https://bit.ly/bbb'], ['★Q&Aのご感想をお寄せください！', '次回以降の参考にします。', 'こちらのフォームからお願いします↓↓', 'https://forms.example.com/r/zz'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/架空太郎|仮名三郎|次回以降|フォーム/.test(j.clean.text), j.clean.text); assert.match(j.clean.text, /素朴な疑問/);
  const names = j.clean.cast.map((c) => c.name);
  assert.equal(names.filter((n) => n === '架空太郎').length, 1); assert.ok(names.includes('仮名三郎')); assert.ok(names.includes('仮名花子'));
  assert.ok(!j.findings.some((f) => /STAFF_IN_BODY|CAST_CONTAMINATED|OVER_DELETION/.test(f)), j.reason);
});
test('<p> の無い原文では★行だけを消し、後続の本文は消さない（段落が分からないときは保守的に）', () => {
  const j = cleanV4('★番組へのご感想をお寄せください\n本編の大事な説明です。続きもあります。');
  assert.match(j.text, /本編の大事な説明/);
});
test('型5 「過去回は下記から」の案内は本文から外す（同じ行の収録日は残す）', () => {
  const raw = P(['【番組内容】', '架空の首脳会談で伝えられた内容の法律的な立て付けを聞きました。'], ['※2026年4月8日に収録しました。「架空談」の過去回は下記からご確認ください', 'https://www.asahi.com/special/podcasts/?pgid=x'], ['「架空談」の過去回は下記からご確認ください', 'https://www.asahi.com/special/podcasts/?pgid=y'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/過去回/.test(j.clean.text), j.clean.text); assert.match(j.clean.text, /2026年4月8日に収録しました/);
  assert.ok(!j.findings.some((f) => /OVER_DELETION/.test(f)), j.reason);
});
test('型6 ★月額100円・読み放題などの購読キャンペーンは本文に残さない／「過去の回はこちら」も外す', () => {
  const raw = P(['★月100円で読み放題★（11/18まで）', '架空コース（月額1,980円）が2カ月間は月額100円！※初回限定', 'https://digital.asahi.com/pr/cp/x/'], ['架空大会の展望を担当記者が解説します。', '※2026年9月18日に収録しました。前後編の後編です。過去の回はこちら（ https://www.asahi.com/special/podcasts/?pgid=z ）。'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/読み放題|月額|初回限定|過去の回/.test(j.clean.text), j.clean.text); assert.match(j.clean.text, /展望を担当記者/); assert.match(j.clean.text, /収録しました/);
});

test('SC4-8: URL文字は固有名詞に数えず、実際の本文固有名詞は保持検査する', () => {
  const raw = '<p>架空の「重要な名前」を説明します。 https://example.org/UniqueToken</p>';
  const j = judgeEpisode(raw); assert.equal(j.verdict, '自動検査合格・目視未確認');
  assert.match(j.clean.text, /重要な名前/);
});
test('SC4-8: 独立した連絡先・SNSラベルを除去し、報道本文は消さない', () => {
  const raw = P(['フォームの運用を取材しました。'], ['ご意見・ご要望（フォーム） https://forms.gle/example ／メール podcast@asahi.com'], ['https://twitter.com/AsahiPodcast （朝ポキ）']);
  const j = judgeEpisode(raw); assert.equal(j.clean.text, 'フォームの運用を取材しました。'); assert.equal(j.verdict, '自動検査合格・目視未確認'); assert.ok(j.clean.socials.includes('https://twitter.com/AsahiPodcast'));
});
test('SC4-8: 他列の手動値を保護して概要のみ合格。手動概要・実際の消失は合格にしない', () => {
  const raw = P(['本文です。'], ['ご意見・ご要望（フォーム） https://forms.gle/example']);
  const j = judgeEpisode(raw, { summary: '本文です。ご意見・ご要望（フォーム） https://forms.gle/example', cast: '人が訂正した出演者' });
  assert.equal(j.verdict, '自動検査合格・目視未確認'); assert.equal(j.writable.summary, true); assert.equal(j.writable.cast, false); assert.match(j.reason, /MANUAL_EDIT_PROTECTED:cast/);
  assert.equal(judgeEpisode(raw, {summary:'人が訂正した概要',cast:'手動出演者'}).verdict, '要確認');
});
test('SC4-8: 同じ行の複数記事を個別の見出しURLペアとして保全', () => {
  const raw = P(['本編の本文。'], ['【関連記事】第一の記事（ https://www.asahi.com/articles/AS1.html ）▽第二の記事（ https://www.asahi.com/articles/AS2.html ）']);
  const j = judgeEpisode(raw); assert.deepEqual(j.clean.related.map(x=>[x.title,x.url]), [['第一の記事','https://www.asahi.com/articles/AS1.html'],['第二の記事','https://www.asahi.com/articles/AS2.html']]); assert.equal(j.verdict,'自動検査合格・目視未確認');
});
test('SC4-8: 宣伝を本文と区別できなければ要確認のまま止める', () => {
  assert.equal(judgeEpisode(P(['本編です。'],['12月にPODCAST MEETINGを開催します！'])).verdict,'要確認');
});
test('S4列単位: 監査後の手動関連記事を守り、概要を書き、再実行差分0', () => {
  const e=env(FEED);e.run('S2_清掃監査');e.g.SC_CONFIG.v2ApplyLevel='AUTO_PASS';
  const v=e.books[V2W].sheets['V2・統合台帳'].st.rows, n=e.H.indexOf('概要（清掃済）'),p=e.H.indexOf('関連記事URL');v[1][p]='人が追加した記事';
  const w=e.run('S4_V2作業用へ反映');assert.equal(w.cellsWritten,1);assert.equal(v[1][n],'一の本文です。');assert.equal(v[1][p],'人が追加した記事');assert.equal(e.run('S4_V2作業用へ反映').cellsWritten,0);
});
test('S4列単位: ロボ最終履歴一致は更新でき、人の別値は保護。GUID不一致は全列停止', () => {
  for(const mode of ['robot','human','guid']) {
    const e=env(FEED); e.run('S2_清掃監査');e.g.SC_CONFIG.v2ApplyLevel='AUTO_PASS';
    const v=e.books[V2W].sheets['V2・統合台帳'].st.rows, n=e.H.indexOf('概要（清掃済）');
    v[1][n]=mode==='robot'?'前回ロボの概要':'人の概要';
    e.books[COPY].sheets['清掃・反映履歴']=mkSheet([Array.from(e.g.SC_HIST_HEADERS_),['時刻','以前','V2作業用','EP-1','概要（清掃済）','','前回ロボの概要','OK']]);
    if(mode==='guid')v[1][e.H.indexOf('公式GUID')]='ffffffff-0000-4000-8000-000000000001';
    const w=e.run('S4_V2作業用へ反映');assert.equal(w.cellsWritten,mode==='robot'?2:mode==='human'?1:0);
    assert.equal(v[1][n],mode==='robot'?'一の本文です。':'人の概要');assert.equal(e.run('S4_V2作業用へ反映').cellsWritten,0);
  }
});

test('SC4-9: 明示された募集段落だけを除き、次の本文・収録日・出演者・記事を保持', () => {
 const raw=P(['【リアルで新聞をめくろう】','9月23日は「PODCAST MEETING 2024」！','入場無料で申し込めます。','https://ciy.digital.asahi.com/ciy/11014641'],['【番組内容】','今回の本編は選挙報道です。','※2024年8月26日に収録しました。'],STAFF,REL);
 const j=judgeEpisode(raw);assert.equal(j.verdict,'自動検査合格・目視未確認');assert.equal(j.clean.text,'今回の本編は選挙報道です。\n※2024年8月26日に収録しました。');assert.equal(j.clean.cast.length,3);assert.equal(j.clean.related.length,1);
});
test('SC4-9: 告知語だけでは段落削除しない。イベントの取材・振り返りは本文に保持',()=>{
 const body='9月に開催された「PODCAST MEETING 2024」を振り返ります。';const j=judgeEpisode(P([body]));assert.equal(j.clean.text,body);assert.equal(j.verdict,'自動検査合格・目視未確認');
 const ambiguous='【ご案内】\nPODCAST MEETINGを開催します。\n重要な本文。';assert.match(cleanV4(ambiguous).text,/重要な本文/);
});
test('SC4-9: 定型メルマガ・アーカイブ案内だけを除き、報道文は残す',()=>{
 const raw=P(['メールマガジンの購読について取材しました。'],['メールマガジン「朝ポキおたより」が、始まりました。ぜひご登録を。'],['朝ポキ7番組の更新情報・アーカイブはこちら！ https://www.asahi.com/special/podcasts/']);const j=judgeEpisode(raw);assert.equal(j.clean.text,'メールマガジンの購読について取材しました。');assert.equal(j.verdict,'自動検査合格・目視未確認');
});
test('SC4-9: 同一記事URLの重複に見出し欠落を誤報しない。未知URLは保留',()=>{
 const raw=P(['本編です。'],['【関連記事】','第一の見出し','https://www.asahi.com/articles/AS1.html?iref=omny','https://www.asahi.com/articles/AS1.html']);const j=judgeEpisode(raw);assert.equal(j.verdict,'自動検査合格・目視未確認');assert.equal(j.clean.related.length,1);assert.equal(judgeEpisode(raw+'<p>https://www.asahi.com/articles/AS2.html</p>').verdict,'要確認');
});
test('SC4-9: 短い見出し・ゼロ幅文字・自然な閉じ括弧を正確に保全',()=>{
 const j=judgeEpisode(P(['本文。'],['【関連記事】','第1問 https://www.asahi.com/articles/AS1.html','第二の見出し（補足）','\u2060https://www.asahi.com/articles/AS2.html']));assert.equal(j.verdict,'自動検査合格・目視未確認');assert.deepEqual(j.clean.related.map(x=>x.title),['第1問','第二の見出し（補足）']);
});

// ===== SC4-11 / SQA-10 回帰（2026-11-13 V2実データの手動保護1,675件の原因別。本文は合成）=====
import { derivedFromRaw } from '../scripts/ledger-v2/summary-cleaner-v4.mjs';
const RAW11 = '<p>今回は雨の日の過ごし方を話します。</p><p>【出演・スタッフ】<br>山田花子 MC 鈴木一郎</p><p>関連する記事<br>雨の日のコツ <a href="https://www.asahi.com/articles/ASX1.html?iref=omny">www.asahi.com/articles/ASX1.html</a></p><p>メール <a href="mailto:podcast@asahi.com">こちら</a>まで</p><p>イベントは視聴できます&darr;</p>';
test('SC4-11 旧清掃器の付けた節見出しだけの行は自動値（【関連記事】が原文に無くても）', () => {
  assert.equal(derivedFromRaw('今回は雨の日の過ごし方を話します。\n【関連記事】\n雨の日のコツ', RAW11), true);
});
test('SC4-11 URLを消した跡の空かっこ・矢印・mailto: は自動値', () => {
  assert.equal(derivedFromRaw('雨の日のコツ（ ）\nメール mailto:podcast@asahi.com こちらまで\nイベントは視聴できます↓', RAW11), true);
});
test('SC4-11 人が書き足した文は従来どおり保護', () => {
  assert.equal(derivedFromRaw('今回は雨の日の過ごし方を話します。\n傘の選び方も紹介しました。', RAW11), false);
  assert.equal(derivedFromRaw('【おすすめ】傘の選び方', RAW11), false);   // 節名でない見出しの中身は原文照合する
  assert.equal(derivedFromRaw('雨の日のコツ https://example.com/x', RAW11), false);   // 原文に無いURL
});
test('SQA-10 名前付き文字参照（&darr; 等）を清掃後の本文に残さない', () => {
  const c = cleanV4(RAW11); assert.ok(!/&[a-z]+;/i.test(c.text), c.text); assert.ok(c.text.includes('視聴できます↓') || !c.text.includes('視聴できます'));
});

// ---- 人物索引の差分更新・公開台帳の点検・日次入口（模擬） ----
test('P5差分更新（COPY）: 新しい話は追加・変わった話だけ作り直し・再実行は差分0・重複なし・人の出演者欄は直さず差異に記録・途中停止から再開', () => {
  const e = env(FEED); e.g.SpreadsheetApp.ProtectionType = { SHEET: 'SHEET' };
  const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  const DH = ['EP-ID', '公式GUID', '取得元', '取得日時', '概要原文', '概要原文SHA256'];
  const raw1 = '<p>本文。</p><p>【出演・スタッフ】<br>朝日太郎（記者）<br>日比花子（ナビゲーター）</p>', raw2 = '<p>人名のない本文。</p>';
  e.books[V2W].sheets['V2・収蔵詳細'] = mkSheet([DH, ['EP-1', 'g1', '', '', raw1, sha(raw1)], ['EP-2', 'g2', '', '', raw2, sha(raw2)]]);
  const L = e.books[COPY].sheets['V2・統合台帳'].st.rows, C = e.H.indexOf('出演者'); L[3][C] = '手入力一郎';   // EP-3: 原文なし・台帳だけに名前（未検証のまま残す）
  const sheetsBefore = Object.keys(e.books[COPY].sheets).join(), dr = e.run('P5_人物索引_予行_COPY'); assert.equal(dr.status, 'DRYRUN_OK'); assert.equal(dr.indexChangedEpisodes, 2); assert.equal(Object.keys(e.books[COPY].sheets).join(), sheetsBefore);   // 予行は何も作らない・書かない
  const a = e.run('P5_人物索引_差分更新_COPY'); assert.equal(a.status, 'OK'); assert.equal(e.books[COPY].sheets['人物索引_更新履歴'].st.rows.length, 3); assert.equal(a.changedEpisodes, 3); assert.equal(a.merge.duplicatePairs, 0);
  const ix = () => e.books[COPY].sheets['人物索引(試験)'].st.rows.slice(1).filter((r) => r[0]);
  assert.deepEqual(ix().map((r) => [r[0], r[1], r[6]]), [['EP-1', '朝日太郎', '原文で確認'], ['EP-1', '日比花子', '原文で確認'], ['EP-3', '手入力一郎', '原文に出典なし・未検証']]);
  const stRows = e.books[COPY].sheets['人物索引_状態'].st.rows.slice(1); assert.deepEqual(stRows.map((r) => [r[0], r[3]]), [['EP-1', '原文で確認'], ['EP-2', '原文に人名なし'], ['EP-3', '原文に出典なし・未検証']]);
  const diff = e.books[COPY].sheets['人物・差異'].st.rows.slice(1); assert.deepEqual(diff.map((r) => [r[0], r[1]]), [['EP-1', '出演者欄が空（原文には名前あり）'], ['EP-3', '台帳にだけ名前（原文に出典なし）']]);
  assert.equal(L[3][C], '手入力一郎'); assert.equal(L[1][C], '');   // 出演者欄は書かない
  const snap = JSON.stringify(ix()), b = e.run('P5_人物索引_差分更新_COPY'); assert.equal(b.status, 'OK_NO_CHANGE'); assert.equal(b.changedEpisodes, 0); assert.equal(JSON.stringify(ix()), snap);
  L[1][C] = '朝日太郎（記者）'; const c = e.run('P5_人物索引_差分更新_COPY'); assert.equal(c.changedEpisodes, 1); assert.equal(c.merge.replacedEpisodes, 0); assert.equal(JSON.stringify(ix()), snap);   // 出演者欄だけ変わった→索引は同じ
  assert.deepEqual(e.books[COPY].sheets['人物・差異'].st.rows.slice(1).map((r) => [r[0], r[1], r[4]]), [['EP-1', '名前が一部違う', '日比花子'], ['EP-3', '台帳にだけ名前（原文に出典なし）', '']]);
  // 新しい話（EP-4）を足す → 末尾に追加、既存行は動かない
  const r4 = e.H.map(() => ''); r4[0] = 'EP-4'; L.push(r4); const raw4 = '<p>本文。</p><p>【出演】<br>新顔次郎（記者）</p>'; e.books[V2W].sheets['V2・収蔵詳細'].st.rows.push(['EP-4', 'g4', '', '', raw4, sha(raw4)]);
  const d = e.run('P5_人物索引_差分更新_COPY'); assert.equal(d.changedEpisodes, 1); assert.deepEqual(ix().slice(-1).map((r) => [r[0], r[1]]), [['EP-4', '新顔次郎']]); assert.equal(JSON.stringify(ix().slice(0, 3)), snap);
  // 途中停止→再開: 予算0で1件も処理せず PARTIAL、指紋は保存されない → 予算を戻すと続きから
  const r5 = e.H.map(() => ''); r5[0] = 'EP-5'; r5[C] = '後藤五郎'; L.push(r5);
  vm.runInNewContext('PI_TIME_BUDGET_MS_ = -1', e.g); const p = e.run('P5_人物索引_差分更新_COPY'); assert.equal(p.status, 'PARTIAL_RESUME_NEEDED'); assert.equal(p.processed, 0);
  vm.runInNewContext('PI_TIME_BUDGET_MS_ = 240000', e.g); const q = e.run('P5_人物索引_差分更新_COPY'); assert.equal(q.status, 'OK'); assert.equal(q.processed, 1); assert.equal(e.run('P5_人物索引_差分更新_COPY').status, 'OK_NO_CHANGE');
  assert.equal(new Set(ix().map((r) => r[0] + '|' + r[1])).size, ix().length);
  assert.equal(e.run('P5_人物索引_差分更新').status, 'NOT_APPROVED');   // V2は承認ボタンの後だけ
});

test('X1公開台帳の点検（読むだけ）・X2は統合台帳と同じ値の塞ぎセルだけ空にする・X3は警告だけの保護・D2は異常で停止旗', () => {
  const e = env(FEED); e.g.SpreadsheetApp.ProtectionType = { SHEET: 'SHEET' };
  const L = e.books[COPY].sheets['V2・統合台帳'].st.rows, J = e.H.indexOf('掲載判定'), R = e.H.indexOf('代表EP-ID'), C = e.H.indexOf('出演者');
  [1, 2].forEach((i) => { L[i][J] = '対象'; L[i][R] = L[i][0]; }); L[1][C] = '朝日太郎';
  const PH = ['EP-ID', '出演者'], pub = mkSheet([PH, ['EP-1', '朝日太郎'], ['EP-2', '']]); pub.st.formulas = { '2:1': '=FILTER(V2・統合台帳!A2:AH,…)' }; e.books[COPY].sheets['V2・公開台帳'] = pub;
  const ok = e.run('X1_公開台帳_点検_COPY'); assert.equal(ok.status, 'PUBLIC_OK'); assert.equal(ok.rows, 2); assert.equal(ok.expected, 2); assert.equal(ok.castMismatch, 0);
  const before = JSON.stringify(pub.st.rows); e.run('X1_公開台帳_点検_COPY'); assert.equal(JSON.stringify(pub.st.rows), before);   // 読むだけ
  pub.st.rows = [PH, ['#REF!', ''], ['', ''], ['', '朝日太郎'], ['', '人が書いた何か']];   // 手入力セルが式の展開を塞いだ状態
  const bad = e.run('X1_公開台帳_点検_COPY'); assert.equal(bad.status, 'PUBLIC_ANOMALY'); assert.equal(bad.errors, 1); assert.equal(bad.blockers, 2);
  const fix = e.run('X2_公開台帳_塞ぎセル除去_COPY'); assert.equal(fix.status, 'PARTIAL_HELD'); assert.deepEqual(fix.cleared, ['4:2']); assert.equal(pub.st.rows[4][1], '人が書いた何か');   // 台帳と違う値は残して報告
  assert.equal(e.run('X2_公開台帳_塞ぎセル除去').status, 'NOT_APPROVED'); assert.equal(e.run('X3_公開台帳_警告保護').status, 'NOT_APPROVED');
  assert.equal(e.run('X3_公開台帳_警告保護_COPY').status, 'PROTECTED_WARNING_ONLY'); assert.equal(pub.st.protections[0].w, true); assert.equal(e.run('X3_公開台帳_警告保護_COPY').status, 'ALREADY_PROTECTED');
  assert.equal(e.run('D8_清掃日次トリガー設置').status, 'NOT_APPROVED');
  vm.runInNewContext("PropertiesService.getScriptProperties().setProperty('AUTORUN_STOP', 'x')", e.g); assert.equal(e.run('D2_清掃と人物_日次').status, 'STOPPED');
});

// ---- 台帳総合監査・公式個別URL・関連記事索引（模擬・小規模） ----
test('L1監査はV2を読むだけでCOPYに監査シート／U1は公式ページのcanonicalが一致した物だけ確認済み・U2(COPY)は空欄だけ書き再実行は差分0・U9で戻る／R2は見出し付きの1記事1行', () => {
  const e = env(FEED), V = e.books[V2W].sheets['V2・統合台帳'].st.rows, C = e.books[COPY].sheets['V2・統合台帳'].st.rows, H = e.H, J = H.indexOf('公式個別URL'), G = H.indexOf('公式GUID'), B = H.indexOf('番組'), JU = H.indexOf('掲載判定'), R = H.indexOf('代表EP-ID');
  const g = (i) => 'cccccccc-0000-4000-8000-00000000000' + i;
  [V, C].forEach((L) => { L[1][J] = 'https://www.asahi.com/special/podcasts/item/?itemid=' + g(1); L[2][J] = ''; L[3][J] = ''; L[3][G] = ''; L.forEach((r, i) => { if (i) { r[JU] = '対象'; r[R] = r[0]; } }); });
  const v2snap = JSON.stringify(V);
  const fetched = []; e.g.UrlFetchApp.fetchAll = (reqs) => reqs.map((q) => { fetched.push(q.url); const id = q.url.split('itemid=')[1]; return { getResponseCode: () => 200, getContentText: () => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '">' }; });
  const a = e.run('L1_台帳総合監査'); assert.equal(a.status, 'OK'); assert.equal(a.officialUrlEmpty, 2); assert.equal(JSON.stringify(V), v2snap);   // V2は読むだけ
  const miss = e.books[COPY].sheets['監査・公式URL欠落'].st.rows; assert.deepEqual(miss.slice(1).map((r) => [r[0], r[8]]), [['EP-2', '確認待ち（GUIDあり）'], ['EP-3', 'GUIDなし（補完不可）']]);
  assert.ok(e.books[COPY].sheets['監査・SDGs1092'].st.rows.length > 1000); assert.ok(e.books[COPY].sheets['監査・番組別件数'].st.rows.length >= 2);
  const u1 = e.run('U1_公式URL_確認'); assert.equal(u1.status, 'OK'); assert.equal(u1.result.VERIFIED, 1); assert.deepEqual(fetched, ['https://www.asahi.com/special/podcasts/item/?itemid=' + g(2)]);
  assert.equal(e.run('U1_公式URL_確認').checked, 0);   // 確認済みは取り直さない（途中停止→再開と同じ仕組み）
  const u2 = e.run('U2_公式URL補完_COPY'); assert.equal(u2.status, 'OK'); assert.equal(u2.written, 1); assert.equal(C[2][J], 'https://www.asahi.com/special/podcasts/item/?itemid=' + g(2)); assert.equal(C[3][J], '');
  assert.equal(e.run('U2_公式URL補完_COPY').status, 'OK_NO_CHANGE'); assert.equal(e.run('U2_公式URL補完_V2').status, 'NOT_APPROVED'); assert.equal(JSON.stringify(V), v2snap);
  const u9 = e.run('U9_公式URL補完の取消'); assert.equal(u9.restored, 1); assert.equal(C[2][J], '');
  // 公式ページの canonical が別の itemid なら書かない
  e.g.UrlFetchApp.fetchAll = (reqs) => reqs.map(() => ({ getResponseCode: () => 200, getContentText: () => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + g(9) + '">' }));
  V[3][G] = g(3); const u1b = e.run('U1_公式URL_確認'); assert.equal(u1b.result.HOLD, 1);
  const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex'), raw = RAWX('一');
  e.books[V2W].sheets['V2・収蔵詳細'] = mkSheet([['EP-ID', '公式GUID', '取得元', '取得日時', '概要原文', '概要原文SHA256'], ['EP-1', g(1), '', '', raw, sha(raw)]]);
  V[2][H.indexOf('関連記事URL')] = 'https://www.asahi.com/articles/OLD1.html';   // 材料は V2 の台帳（COPY の台帳は古いので使わない）
  const r2 = e.run('R2_関連記事索引_COPY作成'); assert.equal(r2.status, 'OK'); const ri = e.books[COPY].sheets['関連記事索引(試験)'].st.rows;
  assert.deepEqual(ri.slice(1).map((r) => [r[0], r[2], r[3]]), [['EP-1', '一の記事見出し', 'https://www.asahi.com/articles/ASX1.html'], ['EP-2', '未取得', 'https://www.asahi.com/articles/OLD1.html']]);
  assert.match(ri[1][4], /^=HYPERLINK\("https:\/\/www\.asahi\.com\/articles\/ASX1\.html","一の記事見出し"\)$/);
  assert.equal(e.run('R2_関連記事索引_COPY作成').status, 'OK_NO_CHANGE'); assert.equal(e.run('R3_関連記事索引_V2作成').status, 'NOT_APPROVED');
});

test('U1 例外対応: まとめて取得が例外でも1件ずつ取り直し、通信例外はそのEPだけERROR（NOT_FOUNDにしない）・他所への転送はHOLD・10件ごとに保存・ERRORは次回再確認し3回でHOLD', () => {
  const e = env(FEED), V = e.books[V2W].sheets['V2・統合台帳'].st.rows, H = e.H, J = H.indexOf('公式個別URL'), G = H.indexOf('公式GUID');
  const id = (i) => 'dddddddd-0000-4000-8000-00000000000' + i; V[1][G] = id(1); V[2][G] = id(2); V[3][G] = id(3); [1, 2, 3].forEach((i) => { V[i][J] = ''; });
  const page = (u) => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + u.split('itemid=')[1] + '">';
  const resp = (code, html, loc) => ({ getResponseCode: () => code, getContentText: () => html, getHeaders: () => (loc ? { Location: loc } : {}) });
  const one = (u) => { if (u.endsWith(id(1))) throw new Error('使用できないアドレス: ' + u); if (u.endsWith(id(2))) return resp(302, '', 'https://example.com/elsewhere'); return resp(200, page(u)); };
  e.g.UrlFetchApp.fetchAll = (reqs) => { assert.ok(reqs.every((q) => q.followRedirects === false)); if (reqs.some((q) => q.url.endsWith(id(1)))) throw new Error('使用できないアドレス'); return reqs.map((q) => one(q.url)); };
  e.g.UrlFetchApp.fetch = (u, o) => { assert.equal(o.followRedirects, false); return one(u); };
  const a = e.run('U1_公式URL_確認'); assert.equal(a.status, 'OK'); assert.deepEqual(a.result, { VERIFIED: 1, NOT_FOUND: 0, HOLD: 1, ERROR: 1 });
  const st = () => e.books[COPY].sheets['公式URL確認'].st.rows.slice(1).map((r) => [r[0], r[3], r[4].split(' ')[0]]);
  assert.deepEqual(st(), [['EP-1', 'ERROR', 'FETCH_EXCEPTION'], ['EP-2', 'HOLD', 'REDIRECT'], ['EP-3', 'VERIFIED', 'CANONICAL_ITEMID_MATCH']]);
  const b = e.run('U1_公式URL_確認'); assert.equal(b.candidates, 1); assert.equal(b.result.ERROR, 1);   // ERRORだけ再確認（確認済みは取り直さない）
  const c = e.run('U1_公式URL_確認'); assert.equal(c.result.HOLD, 1); assert.equal(st().slice(-1)[0][2], 'REPEATED_FETCH_ERROR');
  assert.equal(e.run('U1_公式URL_確認').candidates, 0);
  e.g.UrlFetchApp.fetch = (u) => (u.endsWith(id(9)) ? resp(200, page(u)) : resp(301, '', 'https://www.asahi.com/special/podcasts/item/?itemid=' + id(9)));   // 朝日の中の転送は追うが、別の itemid なら HOLD
  V[1][G] = id(4); e.g.UrlFetchApp.fetchAll = (reqs) => reqs.map((q) => resp(301, '', 'https://www.asahi.com/special/podcasts/item/?itemid=' + id(9)));
  const d = e.run('U1_公式URL_確認'); assert.equal(d.result.HOLD, 1); assert.match(st().slice(-1)[0].join(' '), /HOLD CANONICAL_MISMATCH/);
  const C = e.books[COPY].sheets['V2・統合台帳'].st.rows; C[3][G] = id(3); C[3][J] = ''; C[1][G] = id(1); C[1][J] = '';
  const u2 = e.run('U2_公式URL補完_COPY'); assert.equal(u2.written, 1); assert.equal(C[1][J], '');   // 書くのは VERIFIED（GUID一致）の1件だけ。ERROR→HOLDの EP-1 は書かない
});

test('関連記事索引: 先頭がアポストロフィの見出しも再実行で差分0（OK_NO_CHANGE）・台帳の ?iref=omny 付きURLは原文の同じ記事と1行にまとめ元URL欄に残す・R4はEP-ID×記事URLで差を出す', () => {
  const e = env(FEED), sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex'), H = e.H, P = H.indexOf('関連記事URL');
  const raw = "<p>本文。</p><p>【関連記事】<br>'ケヅレー一家'でビブリオバトル<br><a href=\"https://www.asahi.com/articles/ASX9.html?iref=omny\">https://www.asahi.com/articles/ASX9.html?iref=omny</a></p>";
  e.books[V2W].sheets['V2・収蔵詳細'] = mkSheet([['EP-ID', '公式GUID', '取得元', '取得日時', '概要原文', '概要原文SHA256'], ['EP-1', 'g', '', '', raw, sha(raw)]]);
  const C = e.books[COPY].sheets['V2・統合台帳'].st.rows, V = e.books[V2W].sheets['V2・統合台帳'].st.rows;
  V[1][P] = 'https://www.asahi.com/articles/ASX9.html?iref=omny'; C[1][P] = 'https://www.asahi.com/articles/ASX9.html'; C[2][P] = 'https://www.asahi.com/articles/ONLYCOPY.html';   // R2 の材料は V2 台帳、R4 は COPY 台帳との差を出す
  const a = e.run('R2_関連記事索引_COPY作成'); assert.equal(a.status, 'OK'); const ri = e.books[COPY].sheets['関連記事索引(試験)'].st.rows.slice(1);
  assert.equal(ri[0][2], "'ケヅレー一家'でビブリオバトル"); assert.equal(ri.length, 1); assert.equal(a.headlineNotFetched, 0);   // 台帳の ?iref=omny 付きと原文の記事を二重に数えない（COPY 台帳だけの EP-2 は材料にしない）
  const b = e.run('R2_関連記事索引_COPY作成'); assert.equal(b.status, 'OK_NO_CHANGE'); assert.equal(b.changed, false);
  const r4 = e.run('R4_関連記事索引_V2とCOPYの差'); assert.equal(r4.diffRows, 1); assert.deepEqual(r4.episodesOnlyCopy, ['EP-2']); assert.match(r4.examples[0], /COPYだけ EP-2 https:\/\/www\.asahi\.com\/articles\/ONLYCOPY\.html/);
});

test('K1 空欄棚卸し（V2は読むだけ）: 項目ごとに理由と埋める方法・公開候補の空欄だけ個票／429・5xx は待って取り直す', () => {
  const e = env(FEED), V = e.books[V2W].sheets['V2・統合台帳'].st.rows, H = e.H, JU = H.indexOf('掲載判定'), R = H.indexOf('代表EP-ID');
  V.forEach((r, i) => { if (i) { r[JU] = '対象'; r[R] = r[0]; } }); V[1][H.indexOf('Spotify')] = 'https://open.spotify.com/show/2rNtRw2rNtRw2rNtRw2rNt';
  const snap = JSON.stringify(V), k = e.run('K1_空欄棚卸し'); assert.equal(k.status, 'OK'); assert.equal(JSON.stringify(V), snap);
  const S = e.books[COPY].sheets['監査・空欄棚卸し'].st.rows.slice(1).map((r) => r.slice(0, 3).join('｜'));
  assert.ok(S.includes('Spotify｜要確認｜番組トップURL（個別EPではない）')); assert.ok(S.some((x) => x.startsWith('Amazon｜空欄｜公開の取得経路が未確認'))); assert.ok(S.some((x) => x.startsWith('テーマ・二重分類・地理｜列なし')));
  assert.ok(e.books[COPY].sheets['監査・空欄個票'].st.rows.length > 1);
  let n = 0; const sleeps = []; e.g.Utilities.sleep = (ms) => sleeps.push(ms);
  e.g.UrlFetchApp.fetch = () => { n++; return { getResponseCode: () => (n < 3 ? (n === 1 ? 429 : 503) : 200), getHeaders: () => (n === 1 ? { 'Retry-After': '2' } : {}), getContentText: () => '' }; };
  assert.equal(vm.runInNewContext('laFetchRetry_("https://x", {}).getResponseCode()', e.g), 200); assert.equal(n, 3); assert.deepEqual(sleeps, [2000, 3000]);
});

test('Megaphone対応: GUIDがUUIDでなくても音声URLの配信ID(TASC…)を itemid として照合し、タイトルが公式ページに無ければ HOLD', () => {
  const e = env(FEED), V = e.books[V2W].sheets['V2・統合台帳'].st.rows, H = e.H, J = H.indexOf('公式個別URL'), G = H.indexOf('公式GUID'), A = H.indexOf('音声URL'), T = H.indexOf('タイトル');
  [1, 2, 3].forEach((i) => { V[i][J] = ''; V[i][G] = 'not-a-uuid-' + i; V[i][T] = '合成の回その' + i; });
  V[1][A] = 'https://traffic.megaphone.fm/TASC1234567890.mp3?updated=1'; V[2][A] = 'https://traffic.megaphone.fm/TASC2222222222.mp3'; V[3][A] = '';
  const page = (id, t) => ({ getResponseCode: () => 200, getHeaders: () => ({}), getContentText: () => '<link rel="canonical" href="https://www.asahi.com/special/podcasts/item/?itemid=' + id + '"><h1>' + t + '</h1>' });
  const one = (u) => (u.endsWith('TASC1234567890') ? page('TASC1234567890', '合成の回その1') : page('TASC2222222222', '別の回'));
  e.g.UrlFetchApp.fetchAll = (reqs) => reqs.map((q) => one(q.url)); e.g.UrlFetchApp.fetch = (u) => one(u);
  const a = e.run('U1_公式URL_確認'); assert.equal(a.candidates, 2);   // EP-3 は音声URLもUUIDも無いので候補にしない（推測URLを作らない）
  const st = e.books[COPY].sheets['公式URL確認'].st.rows.slice(1);
  assert.deepEqual(st.map((r) => [r[0], r[1], r[3]]), [['EP-1', 'TASC1234567890', 'VERIFIED'], ['EP-2', 'TASC2222222222', 'HOLD']]);
  assert.match(st[0][4], /Megaphone配信ID/); assert.match(st[1][4], /TITLE_NOT_ON_PAGE/);
});

test('L3対象の拡大: L2追加・V2保留・未判定・対象外（重複）・おんさのみをEP-IDで重複なく集める／おんさ共有台帳は読むだけ', () => {
  const e = env(FEED), V = e.books[V2W].sheets['V2・統合台帳'].st.rows, H = e.H, K = H.indexOf('掲載判定'), R = H.indexOf('代表EP-ID');
  V[1][K] = '保留'; V[2][K] = '対象外'; V[2][R] = 'EP-3'; V[3][K] = '対象'; V[3][R] = 'EP-3';
  const C = e.books[COPY]; C.sheets['監査・全台帳差分'] = mkSheet([['h'], ['EP-1', 'V2にあり旧公開にない'], ['EP-3', 'V2にあり旧公開にない（再配信候補）']]);
  C.sheets['監査・おんさ照合'] = mkSheet([['h'], ['', 'おんさにあり台帳に無い', '', 'スポンジ', '12', 'おんさだけの回', '2024/1/1', '600', 'https://www.asahi.com/special/podcasts/item/?itemid=TASC9999999999']]);
  const L = e.g.LedgerAudit; e.g.__C = C; const out = JSON.parse(JSON.stringify(vm.runInNewContext("la3Candidates_({ ss: { getSheetByName: function (n) { return __C.sheets[n] || null; } } }, laRead_(scOpen_(SC_CONFIG.v2WorkingId, '').sh)).list", e.g)));
  assert.ok(L); assert.deepEqual(out.map((x) => [x.ep, x.labels.join('・'), x.other]), [['EP-1', 'V2にあり旧公開にない・V2保留', ''], ['EP-2', 'V2対象外（10/22の重複判定）', 'EP-3'], ['EP-3', 'V2にあり旧公開にない（再配信候補）', ''], ['ONSA:スポンジ:12', 'おんさにあり台帳に無い', '']]);
  const src = fs.readFileSync('gas/summary-cleaner/src/CleanerMain.js', 'utf8'), body = src.slice(src.indexOf('function laOnsaReadOnly_'), src.indexOf('function laOnsaAsahiByEp_'));
  assert.ok(body.includes('getDisplayValues')); assert.ok(!/setValue|setValues|insertSheet|clear|deleteRow|appendRow|setFormula/.test(body));   // おんさ原本へは書かない
});
