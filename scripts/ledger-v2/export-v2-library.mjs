// E1: V2 → 公開図書館データの CLI（中身は v2-library-core.mjs。GAS の予行 E1_V2公開データ_予行 も同じ中身を使う）。
// 既存の V1 用 export-library-public.mjs は残す（旧データへの復旧経路）。
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildV2Library as core, compareWithPublic, parseCsv } from './v2-library-core.mjs';
export { compareWithPublic, parseCsv };
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export function buildV2Library(args) { return core({ hash: sha256, ...args }); }

if (import.meta.url === `file://${process.argv[1]}`) {   // node scripts/ledger-v2/export-v2-library.mjs LEDGER.csv PERSONS.csv [RELATED.csv] [PUBLIC_DATA_DIR] [DEST]
  const [ledgerPath, personsPath, relatedPath, publicDir = 'public/library/data', dest] = process.argv.slice(2);
  const { readdir } = await import('node:fs/promises'); const prev = [];
  for (const f of (await readdir(publicDir + '/pages')).filter((x) => x.startsWith('all-'))) prev.push(...JSON.parse(await readFile(publicDir + '/pages/' + f, 'utf8')));
  const allow = process.env.E1_ALLOW_NEW ? new Set(process.env.E1_ALLOW_NEW.split(',')) : new Set();
  const res = buildV2Library({ newEpisodeAllowList: allow, ledger: parseCsv(await readFile(ledgerPath, 'utf8')), persons: personsPath ? parseCsv(await readFile(personsPath, 'utf8')) : [], related: relatedPath && relatedPath !== '-' ? parseCsv(await readFile(relatedPath, 'utf8')) : [], previousPublicIds: new Set(prev.map((e) => e.id)), decidedAt: new Date().toISOString() });
  const diff = compareWithPublic(res.episodes, prev);
  console.log(JSON.stringify({ adopted: res.scope.adopted, held: res.scope.held, excluded: res.scope.excluded, added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length, same: diff.same }, null, 2));
  if (dest) { const { writePublicLibrarySnapshot } = await import('../library-publication-files.mjs'); console.log(JSON.stringify(await writePublicLibrarySnapshot({ episodes: res.episodes, counts: { source: res.decisions.length }, publicationScope: res.scope, snapshotDate: new Date().toISOString().slice(0, 10), destination: dest }), null, 2)); }
}
