// #395: SDGS_ARCHIVE_LIST_READ_ONLY の実行ログ（Spotify 公式の回一覧）と蔵の SDGsを話そう の回を、題名＋配信日で突き合わせる。
// URL は作らない: Spotify が返した回の ID だけを使う。台帳には書かない（対応表を出すだけ）。
// 使い方: node scripts/library/sdgs-archive-map.mjs log.txt > /tmp/sdgs-map.json
import fs from 'node:fs';
const nz = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, '').replace(/[「」『』（）()【】・、。!?！？〜~…#＃]/g, '');
const log = fs.readFileSync(process.argv[2], 'utf8');
const arc = [];
for (const line of log.split(/\n/)) { const m = line.replace(/^.*SDGSARC\|/, ''); const [id, date, name] = m.split('\t'); if (/^[A-Za-z0-9]{22}$/.test(id || '')) arc.push({ id, date, name }); }
const dir = new URL('../../public/library/data/details/', import.meta.url);
const eps = fs.readdirSync(dir).flatMap((f) => JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'))).filter((e) => e.show === 'SDGsを話そう');
const byKey = new Map(); arc.forEach((a) => { const k = nz(a.name); (byKey.get(k) || byKey.set(k, []).get(k)).push(a); });
const out = { matched: [], ambiguous: [], missing: [] };
for (const e of eps) {
  const cands = (byKey.get(nz(e.title)) || []).filter((a) => !a.date || Math.abs(new Date(a.date) - new Date(e.date.slice(0, 10))) <= 2 * 864e5);
  const old = (e.links || []).find((u) => /open\.spotify\.com\/episode\//.test(u)) || '';
  if (cands.length === 1) out.matched.push({ ep: e.id, title: e.title, date: e.date.slice(0, 10), oldUrl: old, newUrl: 'https://open.spotify.com/episode/' + cands[0].id });
  else (cands.length ? out.ambiguous : out.missing).push({ ep: e.id, title: e.title, date: e.date.slice(0, 10), candidates: cands.map((a) => a.id) });
}
out.summary = { archive: arc.length, kura: eps.length, matched: out.matched.length, ambiguous: out.ambiguous.length, missing: out.missing.length };
process.stdout.write(JSON.stringify(out, null, 1));
console.error(JSON.stringify(out.summary));
