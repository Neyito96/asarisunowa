// 非破壊: 既存の非公開プレビュー(SRC)の出演者だけを、管理人確認fixture(2026-11-10)で差分同期し OUT に書き出す。
// 出演者以外(説明/リンク/除外/公開範囲)は一切変更しない。fixtureに無いEP-IDは触らない。新着/訂正の自動確定には使わない。
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {refreshCastFromLedger} from '../public/library/cast-sync.mjs';
import {expandFixture} from './expand-cast-oracle-fixture.mjs';
import {writePublicLibrarySnapshot} from './library-publication-files.mjs';
export function sparseRows(fixture) { // EP-ID -> 台帳55列風の疎な行(X列=23のみ)
  const m = new Map();
  for (const r of expandFixture(fixture).rows) { const row = new Array(55).fill(''); row[0] = r.id; row[1] = r.show; row[23] = r.cast; m.set(r.id, row); }
  return m;
}
export async function loadDetails(dir) { const out = []; for (const f of await readdir(join(dir, 'details'))) out.push(...JSON.parse(await readFile(join(dir, 'details', f), 'utf8'))); return out; }
export async function resync(src, fixturePath, dest) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const existing = await loadDetails(src), scope = JSON.parse(await readFile(join(src, 'scope.json'), 'utf8')), manifest = JSON.parse(await readFile(join(src, 'manifest.json'), 'utf8'));
  const cr = refreshCastFromLedger(existing, sparseRows(fixture));
  await mkdir(dest, {recursive: true});
  await writePublicLibrarySnapshot({episodes: cr.episodes, counts: manifest.counts, publicationScope: scope, snapshotDate: manifest.snapshotDate, destination: dest});
  const mp = join(dest, 'manifest.json'), nm = JSON.parse(await readFile(mp, 'utf8')); if (manifest.preview) nm.preview = manifest.preview; await writeFile(mp, JSON.stringify(nm) + '\n');
  const ids = new Set(cr.episodes.map(e => e.id));
  return {total: existing.length, outTotal: cr.episodes.length, changed: cr.changes.length, added: cr.changes.filter(c => c.kind === 'CAST_ADDED').length, replaced: cr.changes.filter(c => c.kind === 'CAST_CHANGED').length, notInPreview: [...sparseRows(fixture).keys()].filter(i => !ids.has(i)), changes: cr.changes};
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, fx, dest] = process.argv.slice(2); const r = await resync(src, fx, dest);
  console.log(JSON.stringify({...r, changes: r.changes.slice(0, 3)}, null, 1));
}
