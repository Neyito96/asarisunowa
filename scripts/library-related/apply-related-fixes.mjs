// 蔵の関連記事の手直しを公開データに当てる（data/library/related-fixes.json）。
// 関連記事が決まっている回は、毎日の同期・見出し付けでも上書きされない（apply-related-titles.mjs は relatedArticles がある回を残す）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { loadPublic } from '../library-sync-v2.mjs';
import { writePublicLibrarySnapshot } from '../library-publication-files.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dest = path.join(ROOT, 'public/library/data');
const { fixes } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/library/related-fixes.json'), 'utf8'));
const eps = loadPublic(dest); const changed = [];
for (const [id, f] of Object.entries(fixes)) {
  const e = eps.get(id); if (!e) throw new Error('公開データに無い回: ' + id);
  const ra = f.relatedArticles.map((a) => ({ title: String(a.title), url: String(a.url) }));
  if (!ra.every((a) => /^https:\/\//.test(a.url))) throw new Error('URL が https でない: ' + id);
  if (JSON.stringify(e.relatedArticles || null) === JSON.stringify(ra)) continue;
  e.relatedArticles = ra; e.related = ra.map((a) => a.url); changed.push(id);
}
if (!changed.length) { console.log('変化なし'); process.exit(0); }
const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8')), scope = JSON.parse(fs.readFileSync(path.join(dest, 'scope.json'), 'utf8')); delete scope.libraryVersion;
const result = await writePublicLibrarySnapshot({ episodes: [...eps.values()], counts: manifest.counts, publicationScope: scope, snapshotDate: manifest.snapshotDate, operations: { ...(manifest.operations || {}), relatedFixes: changed }, destination: dest });
console.log(JSON.stringify({ changed, version: result.version, total: result.total }));
