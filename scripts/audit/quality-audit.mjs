#!/usr/bin/env node
// 朝リスの田 品質監査ロボ（最小版・読み取り専用）— 全件品質監査ロボ開発指令（2026-11-20）／Issue は docs/design/2026-11-20-quality-audit-robot.md を参照
// 蔵の公開データ（public/library/data）を独立した視点で検査し、EP-ID 単位の判定とレポートを出す。台帳・GAS・公開データは一切書き換えない。
// 判定: PASS（確かめて正常）/ FAIL（確かめて異常）/ REVIEW（人の確認が要る）/ UNVERIFIED（まだ確かめていない）/ BLOCKED（この方法では確かめられない）
// 使い方:
//   node scripts/audit/quality-audit.mjs                      … 内部整合性だけ（外部へはアクセスしない）
//   node scripts/audit/quality-audit.mjs --probe 15           … 各サービスから日替わりで15件ずつ、リンク先を開いて題名まで照合
//   出力: docs/audits/quality/latest.json（要約＋PASS 以外の項目）, latest.md（管理人向け）, probes/<日付>.json（疎通の記録）
import { tidyDescription } from '../../public/library/description-tidy.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'docs/audits/quality');
const nz = (s) => String(s || '').normalize('NFKC');
const tkey = (s) => nz(s).replace(/#\s*[\d-]+|＃\s*[\d-]+/g, '').replace(/[\s「」『』（）()【】・、。!?！？〜~…"'“”]/g, '').slice(0, 24);

// サービスの見分けと、URL の形（ドメイン・個別回の形）の検査
export const SERVICES = [
  { key: 'asahi', name: '朝日新聞公式', host: /(^|\.)asahi\.com$/, episode: /\/special\/podcasts\/item\/\?itemid=([0-9a-f-]{36}|TASC\d+)/ },
  { key: 'omny', name: 'Omny', host: /(^|\.)omny\.fm$/, episode: /\/shows\/[^/]+\/[^/]+(\/embed)?$/ },
  { key: 'spotify', name: 'Spotify', host: /^open\.spotify\.com$/, episode: /^\/episode\/[A-Za-z0-9]{22}$/ },
  { key: 'apple', name: 'Apple Podcasts', host: /^podcasts\.apple\.com$/, episode: /[?&]i=\d+/ },
  { key: 'amazon', name: 'Amazon Music', host: /^music\.amazon\./, episode: /\/podcasts\/[0-9a-f-]{36}\/episodes\/[0-9a-f-]{36}/ },
  { key: 'pocketcasts', name: 'Pocket Casts', host: /^(pca\.st|pocketcasts\.com)$/, episode: /\/episode\/[0-9a-f-]{36}/ },
  { key: 'youtube', name: 'YouTube', host: /(^|\.)(youtube\.com|youtu\.be)$/, episode: /(v=|youtu\.be\/)[\w-]{11}/ },
  { key: 'listen', name: 'LISTEN', host: /^listen\.style$/, episode: /^\/p\/[^/]+\/[^/]+/ },
  { key: 'pody', name: 'Pody', host: /^pody\.jp$/, episode: /\/(player|episode)\/[\w-]+\/[\w-]+/ },
  { key: 'standfm', name: 'stand.fm', host: /^stand\.fm$/, episode: /\/episodes\// },
];
export function serviceOf(url) {
  let u; try { u = new URL(url); } catch (e) { return { key: 'invalid', ok: false }; }
  const s = SERVICES.find((x) => x.host.test(u.hostname));
  if (!s) return { key: 'other', host: u.hostname, ok: true };
  return { key: s.key, ok: u.protocol === 'https:' && s.episode.test(u.pathname + u.search) };
}

// 既に確かめた事実（人と Claude が一次情報で確認したもの）。ここに無いものを推定で異常・正常にしない
export const KNOWN = [
  { id: 'sdgs-spotify-moved', service: 'spotify', match: (e) => e.show === 'SDGsを話そう' && e.id !== 'EP-06577', status: 'FAIL', kind: '配信先の移転', evidence: '#395: Spotify 公開埋め込みページで 898/899 回「見つかりません」（2026-11-20）。番組は「SDGsを話そう アーカイブ」（show 7vuSolzvNiNwu7UR4lVIwU）へ移転', fix: '新旧対応表（PR #399）で新しい URL に置き換え' },
];

export function loadLibrary(root = ROOT) {
  const dir = path.join(root, 'public/library/data/details');
  const eps = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/library/data/manifest.json'), 'utf8'));
  let uchu = null; try { uchu = JSON.parse(fs.readFileSync(path.join(root, 'public/uchu/data/manifest.json'), 'utf8')); } catch (e) { /* 宇宙が無い環境 */ }
  return { eps, manifest, uchu };
}

// 内部整合性の監査（外部アクセスなし）
export function auditInternal({ eps, manifest, uchu }) {
  const items = [];   // { ep, area, check, status, kind, evidence, method, fix }
  const add = (ep, area, check, status, kind, evidence, method, fix = '') => items.push({ ep, area, check, status, kind, evidence, method, fix });
  const reg = {}; SERVICES.forEach((s) => (reg[s.key] = { registered: 0, badForm: 0 }));
  const urlOwner = new Map(), idSeen = new Map(), titleSeen = new Map();
  for (const e of eps) {
    // EP-ID・同題同日の重複
    if (idSeen.has(e.id)) add(e.id, '収蔵', 'EP-ID 重複', 'FAIL', 'EP-ID重複', `同じ EP-ID が2回`, '公開データの全件照合'); idSeen.set(e.id, 1);
    const tk = e.show + '|' + (e.date || '').slice(0, 10) + '|' + tkey(e.title);
    if (titleSeen.has(tk)) add(e.id, '収蔵', '同じ番組・同じ日・同じ題名', 'REVIEW', '重複の疑い', `${titleSeen.get(tk)} と同じ`, '番組＋配信日＋題名の照合'); else titleSeen.set(tk, e.id);
    // URL の登録と形
    const seenSvc = new Set();
    for (const url of e.links || []) {
      const s = serviceOf(url);
      if (s.key === 'invalid') { add(e.id, 'URL', 'URL の形', 'FAIL', 'URL不正', url, 'URL の構文解析'); continue; }
      if (!reg[s.key]) continue;
      if (!seenSvc.has(s.key)) { reg[s.key].registered++; seenSvc.add(s.key); }
      if (!s.ok) { reg[s.key].badForm++; add(e.id, 'URL', `${s.key} の形`, 'REVIEW', '個別回の形ではない', url, 'ドメインと個別回の URL 形式'); }
      const k = url.replace(/[?#].*$/, '').replace(/\/embed$/, '');
      if (s.key !== 'asahi' || /itemid=/.test(url)) { const key = s.key === 'asahi' ? url : k; if (urlOwner.has(key) && urlOwner.get(key) !== e.id) add(e.id, 'URL', `${s.key} の重複`, 'FAIL', '別の回と同じ URL', `${urlOwner.get(key)} と同じ: ${url}`, '全件の URL 照合', 'どちらの回の URL かを一次情報で確認'); else urlOwner.set(key, e.id); }
    }
    for (const k of KNOWN) if (k.match(e) && (e.links || []).some((u) => serviceOf(u).key === k.service)) add(e.id, 'URL', `${k.service} の到達`, k.status, k.kind, k.evidence, '一次情報での確認（記録済み）', k.fix);
    // 概要欄・出演者・再生時間（P2 #403: 利用者に見える文面で判定する。蔵は表示時に整形し、整形できない回は元の文面を出す）
    const d = nz(e.description).trim();
    const tidy = tidyDescription(e.description || ''), shownTidy = tidy.status === 'TIDY' || tidy.status === 'AS_IS';
    const shown = shownTidy ? String(tidy.body || '') : d;
    if (!d) add(e.id, '概要欄', '概要欄の有無', 'REVIEW', '概要欄が空', `descriptionSource=${e.descriptionSource || ''}`, '公開データ');
    else if (d.length < 40) add(e.id, '概要欄', '概要欄の長さ', 'REVIEW', '概要欄が極端に短い', d.slice(0, 40), '公開データ');
    if (d && /配信中です|ご意見.*お寄せ|フォーム|※初めてお申し込み/.test(d) && d.replace(/[^。]/g, '').length <= 1) add(e.id, '概要欄', '告知文だけ', 'REVIEW', '告知文・定型文の残留', d.slice(0, 50), '定型文の言い回し');
    if (!shownTidy && /【朝ポキ情報】|See omnystudio|ad ?choices|会員登録|購読料で配信|キャンペーン|初回限定|お申し込み|【出演・スタッフ】/i.test(shown)) add(e.id, '概要欄', '表示に告知・定型文', 'REVIEW', '表示される概要欄に告知・定型文が残る', `整形=${tidy.status}: ${(shown.match(/【朝ポキ情報】|See omnystudio|ad ?choices|会員登録|購読料で配信|キャンペーン|初回限定|お申し込み|【出演・スタッフ】/i) || [''])[0]}`, '表示整形（description-tidy）後の文面', '整形の規則を足すか、台帳の概要を清掃');
    if (/&(?:[a-z]{2,8}|#\d{2,5});/i.test(shown)) add(e.id, '概要欄', '表示に HTML の記号', 'REVIEW', '表示される概要欄に HTML の記号（&…;）', (shown.match(/&(?:[a-z]{2,8}|#\d{2,5});/i) || [''])[0], '表示整形後の文面', '表示整形で文字に戻す');
    if (d && shownTidy && !shown.trim()) add(e.id, '概要欄', '整形後の本文', 'REVIEW', '整形すると本文が空（関連記事だけ）', `関連記事 ${tidy.related.length}件`, '表示整形後の文面');
    const cast = nz(e.cast).trim();
    if (!cast) add(e.id, '出演者', '出演者の有無', 'REVIEW', '出演者が空', '概要欄に名前があるかは未照合', '公開データ');
    if (/https?:\/\//.test(cast)) add(e.id, '出演者', '出演者欄の URL', 'REVIEW', '出演者欄に URL', cast.match(/https?:\/\/\S+/)[0], '公開データ');
    const notName = cast.split(' / ').find((x) => /【|】|過去の番組一覧|はこちら/.test(x) || x.length > 60);
    if (notName) add(e.id, '出演者', '出演者欄に名前以外の文', 'REVIEW', '出演者欄に見出し・説明文が混入', notName.slice(0, 50), '公開データ（区切りごとの長さ・見出し記号）', '清掃ロボの出演者抽出を確認');
    if (cast && !cast.includes(' / ') && (cast.match(/[、,]/g) || []).length >= 2 && !/[（(]/.test(cast.split(/[、,]/)[1] || '')) add(e.id, '出演者', '出演者の区切り', 'REVIEW', '読点・カンマ区切り（1人ずつに分かれていない可能性）', cast.slice(0, 50), '公開データ', '人物検索で1人ずつ当たるか確認');
    if (!(Number(e.duration) > 0)) add(e.id, '収蔵', '再生時間', 'REVIEW', '再生時間が0または空', String(e.duration), '公開データ');
  }
  // 同じ概要（80字以上）なのに題名が違う回（概要の取り違えの疑い）
  const byDesc = new Map();
  for (const e of eps) { const d = nz(e.description).trim(); if (d.length >= 80) { if (!byDesc.has(d)) byDesc.set(d, []); byDesc.get(d).push(e); } }
  for (const g of byDesc.values()) if (g.length > 1 && new Set(g.map((e) => tkey(e.title))).size > 1) for (const e of g) add(e.id, '概要欄', '同じ概要・別の題名', 'REVIEW', '別の回と概要が同じ（取り違えの疑い）', g.map((x) => x.id).filter((x) => x !== e.id).join(',') + ' と同じ', '概要全文の照合', '公式ページで各回の概要を確認');
  // 全体の整合性
  const global = [];
  if (manifest.total !== eps.length) global.push({ check: '公開件数', status: 'FAIL', evidence: `manifest ${manifest.total} ≠ 詳細 ${eps.length}` });
  else global.push({ check: '公開件数', status: 'PASS', evidence: `${eps.length}件で一致` });
  if (uchu) global.push(uchu.libraryVersion === manifest.version ? { check: '宇宙と蔵の版', status: 'PASS', evidence: `どちらも ${manifest.version}` } : { check: '宇宙と蔵の版', status: 'FAIL', evidence: `蔵 ${manifest.version}／宇宙 ${uchu.libraryVersion}` });
  return { items, reg, global };
}

// ---- リンク先を開いて確かめる（日替わりの抜き取り。全件を一度に開かない）
const UA = { 'user-agent': 'asarisunowa-quality-audit/1 (+https://github.com/Neyito96/asarisunowa)' };
async function get(url, ms = 15000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { headers: UA, redirect: 'follow', signal: ac.signal }); const text = await r.text(); return { status: r.status, url: r.url, text }; }
  finally { clearTimeout(t); }
}
// 題名をページから読む（og:title を優先）。自動の巡回を断られた（403・429）ときは「確かめられない」にする（初回実行で Pocket Casts が 403 を返した）
const pageTitle = (t) => { const m = t.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/) || t.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/) || t.match(/<title[^>]*>([^<]+)<\/title>/); return m ? m[1] : ''; };
const viaPage = async (url) => { const r = await get(url); if (r.status === 403 || r.status === 429) return { status: 'BLOCKED', note: `自動の巡回を断られた（HTTP ${r.status}）` }; if (r.status === 404 || r.status === 410) return { status: 'FAIL', kind: 'リンク切れ', note: `HTTP ${r.status}` }; const t = pageTitle(r.text); if (!t || /^(Error|Page not found)/i.test(t)) return { status: 'UNVERIFIED', note: `HTTP ${r.status}・題名を取れない` }; return { title: t }; };
const PROBES = {
  // 公開の埋め込みページ。消えた回は「Page not found」。題名がページに入る
  spotify: async (url) => { const id = new URL(url).pathname.split('/').pop(); const r = await get(`https://open.spotify.com/embed/episode/${id}`); if (r.status === 403 || r.status === 429) return { status: 'BLOCKED', note: `HTTP ${r.status}` }; if (/find the page/i.test(r.text)) return { status: 'FAIL', kind: 'リンク切れ', note: 'Spotify「Page not found」' }; const m = r.text.match(/"title":"([^"]+)"/); return m ? { title: m[1] } : { status: 'UNVERIFIED', note: '題名を取れない' }; },
  pocketcasts: viaPage,
  omny: (url) => viaPage(url.replace(/\/embed$/, '')),
  apple: viaPage,
  listen: viaPage,
  // ブラウザ描画が要る・アクセス制限があるため、このロボでは確かめない
  amazon: async () => ({ status: 'BLOCKED', note: 'ブラウザでの描画が必要' }),
  asahi: async () => ({ status: 'BLOCKED', note: '朝日新聞の公式ページは描画が必要（題名をHTMLから取れない）' }),
  pody: async () => ({ status: 'BLOCKED', note: '未対応' }),
};
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
// 題名の照合: 回の題名の主要部分（番号・記号を除いた先頭24字）が、リンク先の題名に含まれるか
export function titleMatches(epTitle, pageTitle) { const a = tkey(epTitle), b = tkey(decode(pageTitle)); if (!a || !b) return false; return b.includes(a.slice(0, 12)) || a.includes(b.slice(0, 12)); }

export async function probe(eps, perService, dateKey) {
  const out = [];
  for (const [key, fn] of Object.entries(PROBES)) {
    const pool = eps.flatMap((e) => (e.links || []).filter((u) => serviceOf(u).key === key).map((u) => ({ e, u })));
    if (!pool.length) continue;
    // 日替わりで別の回を見る（日付から開始位置を決める。全件を少しずつ巡回）
    const start = (Number(dateKey.replace(/-/g, '')) * 7919) % pool.length;
    const pick = Array.from({ length: Math.min(perService, pool.length) }, (_, k) => pool[(start + k * Math.max(1, Math.floor(pool.length / perService))) % pool.length]);
    for (const { e, u } of pick) {
      let r; try { r = await fn(u); } catch (x) { r = { status: 'UNVERIFIED', note: '取得失敗: ' + String(x && x.name || x) }; }
      if (r.title !== undefined) r = titleMatches(e.title, r.title) ? { status: 'PASS', note: '題名一致' } : { status: 'REVIEW', kind: '別の回の疑い', note: `リンク先の題名「${decode(r.title).slice(0, 50)}」` };
      out.push({ ep: e.id, service: key, url: u, ...r });
      await new Promise((ok) => setTimeout(ok, 400));
    }
  }
  return out;
}

export function summarize({ eps, manifest }, internal, probes, prev) {
  const n = eps.length, by = (f) => internal.items.filter(f).length;
  const regRows = SERVICES.map((s) => ({ service: s.name, key: s.key, registered: internal.reg[s.key].registered, rate: +(internal.reg[s.key].registered / n * 100).toFixed(1), badForm: internal.reg[s.key].badForm }));
  const pr = {}; for (const p of probes) { const o = pr[p.service] || (pr[p.service] = { checked: 0, PASS: 0, FAIL: 0, REVIEW: 0, UNVERIFIED: 0, BLOCKED: 0 }); o.checked++; o[p.status]++; }
  const s = {
    publicEpisodes: n, snapshot: manifest.snapshotDate, libraryVersion: manifest.version,
    urlRegistration: regRows, probe: pr,
    brokenLinks: by((x) => x.area === 'URL' && x.status === 'FAIL' && /リンク切れ|移転/.test(x.kind)) + probes.filter((p) => p.status === 'FAIL').length,
    wrongEpisodeLinks: by((x) => x.kind === '別の回と同じ URL') + probes.filter((p) => p.kind === '別の回の疑い').length,
    descriptionIssues: by((x) => x.area === '概要欄'), castReview: by((x) => x.area === '出演者'),
    ingestIssues: by((x) => x.area === '収蔵'),
    global: internal.global,
  };
  if (prev && prev.summary) s.change = { brokenLinks: s.brokenLinks - prev.summary.brokenLinks, descriptionIssues: s.descriptionIssues - prev.summary.descriptionIssues, castReview: s.castReview - prev.summary.castReview, publicEpisodes: n - prev.summary.publicEpisodes };
  return s;
}

export function reportMarkdown(s, items, probes, at) {
  const L = [`# 品質監査レポート（${at}）`, '', `蔵の公開データ ${s.publicEpisodes}件（snapshot ${s.snapshot}・版 ${s.libraryVersion}）を、読み取りだけで監査。**未検証（UNVERIFIED）・確かめられない（BLOCKED）は正常として数えていない。**`, '',
    '## サービス別の URL 登録', '', '| サービス | 登録 | 登録率 | 個別回の形でない |', '|---|---|---|---|',
    ...s.urlRegistration.map((r) => `| ${r.service} | ${r.registered} / ${s.publicEpisodes} | ${r.rate}% | ${r.badForm} |`), '',
    '## リンク先の疎通（今回の抜き取り）', '', '| サービス | 確認数 | 正常（題名一致） | 異常 | 要確認（別の回の疑い） | 未検証 | 確かめられない |', '|---|---|---|---|---|---|---|',
    ...Object.entries(s.probe).map(([k, o]) => `| ${k} | ${o.checked} | ${o.PASS} | ${o.FAIL} | ${o.REVIEW} | ${o.UNVERIFIED} | ${o.BLOCKED} |`), Object.keys(s.probe).length ? '' : '（今回は疎通の抜き取りをしていない）', '',
    '## 件数', '', `- リンク切れ（確認済み）: ${s.brokenLinks}`, `- 誤った回へのリンクの疑い: ${s.wrongEpisodeLinks}`, `- 概要欄の要確認: ${s.descriptionIssues}`, `- 出演者の要確認: ${s.castReview}`, `- 収蔵の要確認（重複・再生時間など）: ${s.ingestIssues}`,
    ...s.global.map((g) => `- ${g.check}: ${g.status}（${g.evidence}）`), '',
  ];
  if (s.change) L.push('## 前回からの変化', '', ...Object.entries(s.change).map(([k, v]) => `- ${k}: ${v > 0 ? '+' : ''}${v}`), '');
  const top = [...items.filter((x) => x.status === 'FAIL' && x.kind !== '配信先の移転'), ...probes.filter((p) => p.status === 'REVIEW' || p.status === 'FAIL'), ...items.filter((x) => x.status === 'REVIEW' && x.area !== '出演者')].slice(0, 15);
  L.push('## 人の確認が要る上位案件', '', ...top.map((x) => `- ${x.ep}｜${x.area || x.service}｜${x.kind || x.status}｜${x.evidence || x.note || ''}`.slice(0, 160)), '');
  const kinds = {}; items.forEach((x) => { const k = `${x.area}｜${x.kind}｜${x.status}`; kinds[k] = (kinds[k] || 0) + 1; });
  L.push('## 問題の種類別', '', '| 領域｜種類｜判定 | 件数 |', '|---|---|', ...Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`), '');
  return L.join('\n');
}

async function main() {
  const args = process.argv.slice(2); const pi = args.indexOf('--probe'); const per = pi >= 0 ? Number(args[pi + 1] || 10) : 0;
  const now = new Date(); const at = now.toISOString(); const day = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const lib = loadLibrary(); const internal = auditInternal(lib);
  const probes = per > 0 ? await probe(lib.eps, per, day) : [];
  let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(OUT, 'latest.json'), 'utf8')); } catch (e) { /* 初回 */ }
  const summary = summarize(lib, internal, probes, prev);
  fs.mkdirSync(path.join(OUT, 'probes'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify({ v: 1, auditedAt: at, method: 'scripts/audit/quality-audit.mjs（読み取り専用）', summary, items: internal.items, probes }, null, 1));
  fs.writeFileSync(path.join(OUT, 'latest.md'), reportMarkdown(summary, internal.items, probes, at));
  if (probes.length) fs.writeFileSync(path.join(OUT, 'probes', `${day}.json`), JSON.stringify({ auditedAt: at, probes }, null, 1));
  console.log(JSON.stringify({ publicEpisodes: summary.publicEpisodes, items: internal.items.length, probes: probes.length, brokenLinks: summary.brokenLinks }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
