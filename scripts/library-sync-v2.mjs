#!/usr/bin/env node
// 蔵（public/library/data）を V2・公開台帳 に合わせて更新する（Issue #315）。
// 使い方: node scripts/library-sync-v2.mjs <V2・公開台帳の CSV（ファイル or https URL）> [--dest public/library/data] [--decisions-out docs/audits/library-v2-sync/decisions.json.gz] [--dry-run]
//
// 守ること（壊さない・漏らさない）:
//  - EP-ID は台帳の値そのまま（並び順から作らない）。重複・不正な ID は停止。
//  - すでに公開中の回は、記録（概要の清掃・原文・関連記事・出演者など手作業の成果）を変えない。配信先リンクだけ、V2 の検証済みの値を足す。
//  - 以前の掲載判定で「保留」「対象外」にした回は、V2 が「対象」でも公開しない（手動判断の復活を防ぐ）。
//  - V2・公開台帳から消えた公開中の回（重複の整理・除外）は非公開にする。ただし一度に20件を超えたら停止。
//  - 公開件数が前回より20件を超えて減る結果は書かない（fail-closed）。音声は再生確認済みのものしか出さない（V2 からは出さない）。
//  - 出力はステージングに書いてから入れ替える（library-publication-files.mjs）。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writePublicLibrarySnapshot } from './library-publication-files.mjs';
import { buildPublicationScope } from '../public/library/publication-scope.mjs';
import { publicEpisode, safeUrl } from '../lib/library-public.mjs';
import { tidyDescription } from '../public/library/description-tidy.mjs';

const sha = (t) => createHash('sha256').update(String(t || '')).digest('hex').slice(0, 16);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIMITS = { maxRemovals: 20, maxDecrease: 20 };
const POLICY_EXCLUDED_SHOWS = ['アルキキ', 'AJW'];
const V2_HEADERS = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '代表EP-ID', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube', '公式個別URL', '概要（清掃済）', '出演者', '関連記事URL', '再生時間 秒', '公式GUID', '音声URL', '旧元ページURL'];

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false; const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// V2・公開台帳の1行 → 蔵の公開レコード（library-core の publicEpisode を再利用）
export function episodeFromV2(rec) {
  const row = [];
  row[0] = rec['EP-ID']; row[1] = rec['番組']; row[2] = rec['タイトル']; row[3] = rec['配信日時 JST'];
  row[8] = rec['公式個別URL']; row[9] = rec['Spotify']; row[11] = rec['Apple']; row[14] = rec['音声URL']; row[15] = rec['再生時間 秒'];
  row[22] = rec['概要（清掃済）'];
  row[23] = castNames(rec['出演者']);
  const e = publicEpisode(row, {});
  e.links = platformLinks(rec);
  e.related = String(rec['関連記事URL'] || '').split(/\s+/).map((u) => safeUrl(u)).filter(Boolean);
  e.audio = '';   // 再生確認の記録が無い音声は出さない
  return e;
}
// 出演者の欄から URL を外して名前だけにする（表示用）
export function castNames(text) { return dedupeCast(String(text || '').split(/\n+/).map((l) => l.replace(/https?:\/\/\S+/g, '').trim()).filter(Boolean).join(' / ')); }
// 出演者の完全一致の重複だけを外す（並び順は最初の出現を保つ。名前の削除・書き換えはしない）
export function dedupeCast(cast) { const seen = new Set(), out = []; for (const x of String(cast || '').split(' / ').map((v) => v.trim()).filter(Boolean)) if (!seen.has(x)) { seen.add(x); out.push(x); } return out.join(' / '); }
// V2 の配信先列（検証済みの値だけが入る）→ リンクの並び
export function platformLinks(rec) { const official = String(rec['公式個別URL'] || '').trim() || (/^https:\/\/omny\.fm\/shows\/[^/]+\/[^/?#]+$/.test(String(rec['旧元ページURL'] || '').trim()) ? rec['旧元ページURL'] : '');   // 公式個別URLが空なら、Omny の回ページ（旧元ページURL）を公式ページとして使う
  return [...new Set([official, rec['Spotify'], rec['Apple'], rec['Amazon'], rec['Pocket Casts'], rec['LISTEN'], rec['Pody'], rec['YouTube']].map((u) => safeUrl(String(u || '').trim())).filter(Boolean))]; }

export function loadPublic(dir) {
  const out = new Map(), d = path.join(dir, 'details');
  for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) for (const e of JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) out.set(e.id, e);
  return out;
}
// 計画（純粋）: old = 現在の公開レコード、decisions = 前回の掲載判定、v2 = V2・公開台帳の行
// 概要の同期（#333）: V2「概要（清掃済）」を正本として、公開中の回の本文だけを置き換える。
// 置き換えない（保護）: V2概要が空・短い／タイトル不一致／手動修正（Phase11承認など）／表示整形で HOLD になる本文。それ以外の項目（リンク・関連記事・出演者・音声・再生時間）は触らない。
const normTitle = (t) => String(t || '').normalize('NFKC').replace(/\s+/g, '').trim();
export function planDescription(e, r, protect) {
  const nd = episodeFromV2(r).description;
  if (!nd || nd.length < 20) return { action: 'protect', reason: 'V2概要が空・短い' };
  if (normTitle(r['タイトル']) !== normTitle(e.title)) return { action: 'protect', reason: 'タイトル不一致' };
  if (protect && protect.has(e.id)) return { action: 'protect', reason: '手動修正（承認済み）' };
  if (tidyDescription(nd).status === 'HOLD' && String(e.description || '').trim()) return { action: 'protect', reason: 'V2概要が表示整形でHOLD' };   // 蔵が空欄なら HOLD でも V2 の文（要確認＝公式RSS原文・管理人承認 2026-11-18）で補う。既存の概要は上書きしない
  if (nd === e.description) return { action: 'same' };
  return { action: 'update', description: nd };
}
export function planSync({ old, decisions, v2, resolved = [], descProtect = null, syncDescriptions = true, manualCast = new Map() }) {
  const R = new Set(resolved);   // V2で同一性が解決済みの回（前回「同一性保留」）だけ。再配信・対象外は入れない
  const D = new Map(decisions.map((d) => [d.id, d])), V = new Map(), problems = [];
  for (const r of v2) {
    const id = r['EP-ID'];
    if (!id) continue;
    if (!/^EP-\d{5}$/.test(id)) problems.push('不正なEP-ID ' + id);
    if (V.has(id)) problems.push('EP-IDの重複 ' + id);
    if (r['掲載判定'] !== '対象') problems.push('公開台帳に対象以外の行 ' + id);
    V.set(id, r);
  }
  if (problems.length) return { ok: false, problems };
  const keep = [], add = [], protectedIds = [], removed = [], linkAdded = [], castFixed = [], castFilled = [], descUpdates = [], descProtected = {}; let descSame = 0;
  for (const [id, e] of old) {
    const r = V.get(id);
    if (!r) { removed.push(id); continue; }
    if (r['番組'] !== e.show) return { ok: false, problems: ['番組名が変わった ' + id + '（' + e.show + ' → ' + r['番組'] + '）'] };
    const links = [...new Set([...(e.links || []), ...platformLinks(r)])];
    if (links.length !== (e.links || []).length) linkAdded.push(id);
    let next = { ...e, links };
    if (!String(e.cast || '').trim() && (castNames(r['出演者']) || manualCast.get(id))) { castFilled.push(id); next = { ...next, cast: castNames(r['出演者']) || manualCast.get(id) }; }   // V2 が空なら管理人判断（cast-manual.json）   // 蔵の出演者が空の回だけ V2 の出演者で補う（既存の値は書き換えない）
    else if (typeof e.cast === 'string' && e.cast && dedupeCast(e.cast) !== e.cast) { castFixed.push(id); next = { ...next, cast: dedupeCast(e.cast) }; }   // 出演者の完全重複（同じ並びの2回くり返し等）
    if (syncDescriptions) {
      const d = planDescription(e, r, descProtect);
      if (d.action === 'update') { descUpdates.push({ id, oldSha: sha(e.description), newSha: sha(d.description), oldLen: (e.description || '').length, newLen: d.description.length }); next = { ...next, description: d.description, descriptionSource: 'V2-clean' }; }
      else if (d.action === 'same') descSame++;
      else (descProtected[d.reason] = descProtected[d.reason] || []).push(id);
    }
    keep.push(next);
  }
  for (const [id, r] of V) {
    if (old.has(id)) continue;
    const d = D.get(id);
    if (d && d.publication === '保留' && d.classification === '同一性保留' && R.has(id)) { /* V2で同一性解決済み → 回収 */ }
    else if (d && d.publication !== '対象') { protectedIds.push(id); continue; }   // 前回「保留」「対象外」→ 公開しない
    if (d && d.publication === '対象') { protectedIds.push(id); continue; }   // 判定は対象なのに前回出力に無い（要確認）→ 自動では出さない
    if (POLICY_EXCLUDED_SHOWS.includes(r['番組'])) continue;
    if (!r['番組'] || !r['タイトル'] || !r['配信日時 JST']) { protectedIds.push(id); continue; }
    const ne = episodeFromV2(r); if (!ne.cast && manualCast.get(id)) ne.cast = manualCast.get(id); add.push(ne);
  }
  if (removed.length > LIMITS.maxRemovals) return { ok: false, problems: [`非公開になる回が ${removed.length} 件（上限 ${LIMITS.maxRemovals}）。台帳の異常の可能性があるので停止`] };
  const total = keep.length + add.length;
  if (total < old.size - LIMITS.maxDecrease) return { ok: false, problems: [`公開件数が ${old.size} → ${total} に減る。停止`] };
  return { ok: true, keep, add, removed, protectedIds, linkAdded, castFixed, castFilled, total, descUpdates, descProtected, descSame };
}
// 掲載判定の更新: 前回の判定はそのまま、新しく公開する回だけ「対象」を足し、非公開にする回は「対象外」へ
export function nextDecisions(snapshot, plan, v2Hash, nowIso) {
  const removed = new Set(plan.removed), have = new Set(snapshot.decisions.map((d) => d.id));
  const decisions = snapshot.decisions.map((d) => removed.has(d.id) ? { ...d, publication: '対象外', comparison: d.comparison === '対象' ? '対象外' : d.comparison, review: '確認済み', decidedAt: nowIso, note: 'V2・公開台帳に無い（重複の整理・除外）' } : d);
  const addIds = new Set(plan.add.map((e) => e.id));
  for (let i = 0; i < decisions.length; i++) if (addIds.has(decisions[i].id) && decisions[i].publication !== '対象') decisions[i] = { ...decisions[i], publication: '対象', comparison: '対象', review: '確認済み', decidedAt: nowIso, note: 'V2で同一性解決済み（[NET-1]）→ 公開。旧: ' + decisions[i].classification };
  for (const e of plan.add) if (!have.has(e.id)) decisions.push({ id: e.id, show: e.show, comparison: '対象', publication: '対象', classification: '通常', review: '確認済み', decidedAt: nowIso, note: 'V2・公開台帳の掲載判定（対象・代表）' });
  decisions.sort((a, b) => (a.id < b.id ? -1 : 1));
  const raw = createHash('sha256').update(snapshot.source.rawReadSHA256 + ':' + v2Hash).digest('hex');
  return { schema: 1, source: { ...snapshot.source, v2PublicLedgerSHA256: v2Hash, mergedAt: nowIso, rawReadSHA256: raw }, decisions };
}

async function main() {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const src = a[0]; if (!src || src.startsWith('--')) { console.error('使い方: node scripts/library-sync-v2.mjs <V2・公開台帳.csv> [--dest DIR] [--dry-run]'); process.exit(2); }
  const dest = path.resolve(ROOT, arg('--dest', 'public/library/data'));
  const decisionsIn = path.resolve(ROOT, arg('--decisions', fs.existsSync(path.join(ROOT, 'docs/audits/library-v2-sync/decisions.json.gz')) ? 'docs/audits/library-v2-sync/decisions.json.gz' : 'docs/audits/2026-10-22-publication-scope/decisions.json.gz'));
  const decisionsOut = path.resolve(ROOT, arg('--decisions-out', 'docs/audits/library-v2-sync/decisions.json.gz'));
  const text = /^https:\/\//.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, 'utf8');
  const rows = parseCsv(text), h = rows[0] || [];
  for (const n of V2_HEADERS) if (!h.includes(n)) throw new Error('V2・公開台帳の見出しが足りない: ' + n);
  const v2 = rows.slice(1).filter((r) => r[0]).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
  const bytes = fs.readFileSync(decisionsIn), snapshot = JSON.parse((bytes[0] === 31 && bytes[1] === 139 ? zlib.gunzipSync(bytes) : bytes).toString('utf8'));
  const resolvedPath = path.join(ROOT, 'docs/audits/library-v2-sync/identity-resolved.json'), resolved = fs.existsSync(resolvedPath) ? JSON.parse(fs.readFileSync(resolvedPath, 'utf8')).ids : [];
  // 手動修正の保護: Phase11 で承認済みの概要（542件）は置き換えない
  const p11 = path.join(ROOT, 'docs/audits/2026-10-21-phase11/description-plan.json'), descProtect = new Set(fs.existsSync(p11) ? JSON.parse(fs.readFileSync(p11, 'utf8')).records.map((r) => r.id) : []);
  const mcPath = path.join(ROOT, 'docs/audits/library-v2-sync/cast-manual.json'), manualCast = new Map();
  if (fs.existsSync(mcPath)) for (const d of JSON.parse(fs.readFileSync(mcPath, 'utf8')).decisions) for (const id of d.ids) manualCast.set(id, d.cast);
  const old = loadPublic(dest), plan = planSync({ old, decisions: snapshot.decisions, v2, resolved, descProtect, syncDescriptions: !a.includes('--no-descriptions'), manualCast });
  if (!plan.ok) { console.error('停止: ' + plan.problems.slice(0, 10).join(' / ')); process.exit(1); }
  // 再発防止の監査: 「V2に出演者があるのに蔵では空欄」は毎回 0 でなければ止める（2026-11-17 ニュースの学校の欠落）
  const v2Cast = new Map(v2.map((r) => [r['EP-ID'], castNames(r['出演者'])]));
  const castGap = [...plan.keep, ...plan.add].filter((e) => !String(e.cast || '').trim() && v2Cast.get(e.id)).map((e) => e.id);
  if (castGap.length) { console.error('停止: V2に出演者があるのに蔵で空欄 ' + castGap.length + ' 件 ' + castGap.slice(0, 10).join(',')); process.exit(1); }
  const v2Hash = createHash('sha256').update(text).digest('hex'), now = new Date().toISOString();
  const descProtectedCount = Object.fromEntries(Object.entries(plan.descProtected).map(([k, v]) => [k, v.length]));
  const report = { v2Rows: v2.length, kept: plan.keep.length, added: plan.add.length, removed: plan.removed, protectedNotPublished: plan.protectedIds.length, linksAddedToExisting: plan.linkAdded.length, castDeduped: plan.castFixed.length, castFilled: plan.castFilled.length, castFilled: plan.castFilled.length, castGapAfterSync: castGap.length, total: plan.total, newest: plan.add.map((e) => e.id).sort().slice(-5), descriptions: { updated: plan.descUpdates.length, unchanged: plan.descSame, protected: descProtectedCount } };
  if (a.includes('--dry-run')) { console.log(JSON.stringify(report, null, 1)); return; }
  if (!plan.add.length && !plan.removed.length && !plan.linkAdded.length && !plan.descUpdates.length && !plan.castFixed.length && !plan.castFilled.length) { console.log(JSON.stringify({ ...report, note: '変化なし（書き込まない）' }, null, 1)); return; }
  const snap2 = nextDecisions(snapshot, plan, v2Hash, now), scope = buildPublicationScope(snap2);
  scope.version = createHash('sha256').update(JSON.stringify(snap2.decisions)).digest('hex');
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  const counts = { ...manifest.counts, source: snap2.decisions.length, scopeExcluded: scope.excluded, scopeHeld: scope.held };
  const snapshotDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const result = await writePublicLibrarySnapshot({ episodes: [...plan.keep, ...plan.add], counts, publicationScope: scope, snapshotDate, operations: { ...(manifest.operations || {}), source: 'V2・公開台帳', v2PublicLedgerSHA256: v2Hash, syncedAt: now, added: plan.add.length, removed: plan.removed, protectedNotPublished: plan.protectedIds.length, descriptionsUpdated: plan.descUpdates.length, castDeduped: plan.castFixed.length, descriptionsProtected: descProtectedCount }, destination: dest });
  fs.mkdirSync(path.dirname(decisionsOut), { recursive: true }); fs.writeFileSync(decisionsOut, zlib.gzipSync(JSON.stringify(snap2)));
  // 概要の差し替え記録（EP-ID・旧/新のハッシュと文字数・保護の理由）。旧本文そのものは git の履歴（この実行の直前のコミット）から復元できる
  if (plan.descUpdates.length || Object.keys(plan.descProtected).length) {
    const logPath = path.join(ROOT, 'docs/audits/library-v2-sync/description-sync-log.json.gz'), prev = fs.existsSync(logPath) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(logPath))) : { runs: [] };
    prev.runs.push({ at: now, v2PublicLedgerSHA256: v2Hash, updated: plan.descUpdates, protected: plan.descProtected, unchanged: plan.descSame });
    fs.writeFileSync(logPath, zlib.gzipSync(JSON.stringify(prev)));
  }
  console.log(JSON.stringify({ ...report, version: result.version }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(String(e.stack || e)); process.exit(1); });
