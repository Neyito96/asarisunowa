// 蔵の関連記事に見出しを付ける（#308）。入力: RX-1（GAS）の JSON（URL かファイル）。
// 公開中の各回の related（URL）と同じ記事（URLの正規化で一致）だけに見出しを付ける。URLは増やさない・作らない。見出しが無い記事は URL のまま。
// 使い方: node scripts/library-related/apply-related-titles.mjs <RX-1 の URL か JSON> [--dest public/library/data] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublic } from '../library-sync-v2.mjs';
import { writePublicLibrarySnapshot } from '../library-publication-files.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function normArticleUrl(u) {
  try { const x = new URL(String(u).trim().replace(/&amp;/g, '&')); return ('https://' + x.hostname.toLowerCase() + x.pathname.replace(/\/+$/, '')); } catch { return ''; }
}
// 1件の回に見出しを付けた relatedArticles を作る（純関数）
export function titledRelated(related, pairs) {
  const byUrl = new Map(); for (const [title, url] of pairs || []) { const k = normArticleUrl(url); if (k && title && !byUrl.has(k)) byUrl.set(k, String(title).replace(/\s+/g, ' ').trim()); }
  const seen = new Set(), out = [];
  for (const u of related || []) { const k = normArticleUrl(u); if (!k || seen.has(k)) continue; seen.add(k); out.push({ title: byUrl.get(k) || '', url: u }); }
  return out;
}
async function main() {
  const a = process.argv.slice(2), src = a.find((x) => !x.startsWith('--')), arg = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
  if (!src) throw new Error('使い方: apply-related-titles.mjs <RX-1 の URL か JSON>');
  const dest = path.resolve(ROOT, arg('--dest', 'public/library/data'));
  const text = /^https:\/\//.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, 'utf8'), j = JSON.parse(text);
  if (j.ok !== true || !j.related || j.pairs < 1000) throw new Error('停止: RX-1 の応答が不完全 ' + JSON.stringify({ ok: j.ok, pairs: j.pairs }));
  const eps = loadPublic(dest); let titled = 0, untitled = 0, epsWith = 0, changed = 0;
  for (const e of eps.values()) {
    if (!e.related?.length) continue;
    const ra = titledRelated(e.related, j.related[e.id]); const t = ra.filter((x) => x.title).length; titled += t; untitled += ra.length - t; if (t) epsWith++;
    const next = t ? ra : undefined, before = JSON.stringify(e.relatedArticles || null), after = JSON.stringify(next || null);
    if (before !== after) { changed++; if (next) e.relatedArticles = next; else delete e.relatedArticles; }
  }
  const report = { rx: { version: j.version, generatedAt: j.generatedAt, episodes: j.episodes, pairs: j.pairs }, episodesWithTitles: epsWith, titledLinks: titled, untitledLinks: untitled, changedEpisodes: changed };
  if (a.includes('--dry-run') || !changed) { console.log(JSON.stringify(report, null, 1)); return; }
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8')), scope = JSON.parse(fs.readFileSync(path.join(dest, 'scope.json'), 'utf8')); delete scope.libraryVersion;
  const result = await writePublicLibrarySnapshot({ episodes: [...eps.values()], counts: manifest.counts, publicationScope: scope, snapshotDate: manifest.snapshotDate, operations: { ...(manifest.operations || {}), relatedTitles: { source: 'V2・清掃詳細（SC4-18の見出し＋URL）', rxVersion: j.version, rxGeneratedAt: j.generatedAt, titledLinks: titled, untitledLinks: untitled } }, destination: dest });
  console.log(JSON.stringify({ ...report, version: result.version, total: result.total }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
