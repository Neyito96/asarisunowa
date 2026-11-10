// Expand tests/fixtures/news-school-cast-2026-11-10.json into an oracle CSV (EP-ID,番組名,出演者1). Local/private use; output not committed.
import fs from 'node:fs';
export function expandFixture(j) {
  const ids = [];
  for (const [a, b] of j.idRangesInclusive) {
    for (let n = Number(a.slice(3)); n <= Number(b.slice(3)); n++) ids.push('EP-' + String(n).padStart(5, '0'));
  }
  ids.push(...j.additionalIds);
  const exc = new Set(j.exceptionEpisodeIds);
  const rows = ids.map(id => ({ id, show: j.show, cast: exc.has(id) ? j.exceptionCast : j.defaultCast }));
  const dup = ids.length - new Set(ids).size;
  const perPerson = {};
  for (const r of rows) perPerson[r.cast] = (perPerson[r.cast] || 0) + 1;
  const missingExc = [...exc].filter(i => !ids.includes(i));
  return { rows, total: rows.length, duplicates: dup, perPerson, exceptionsNotInSet: missingExc };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [fx, out] = process.argv.slice(2);
  const r = expandFixture(JSON.parse(fs.readFileSync(fx, 'utf8')));
  console.log(JSON.stringify({ total: r.total, duplicates: r.duplicates, perPerson: r.perPerson, exceptionsNotInSet: r.exceptionsNotInSet }));
  if (out) fs.writeFileSync(out, '﻿EP-ID,番組名,出演者1\n' + r.rows.map(x => `${x.id},${x.show},${x.cast}`).join('\n') + '\n');
}
