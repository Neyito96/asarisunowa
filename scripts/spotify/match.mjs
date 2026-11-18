// Spotify 新着の照合（読むだけ）: docs/spotify/latest.json と V2・公開台帳（CSV）を突き合わせ、
// 「同じ回」と確定できた分だけを docs/spotify/matches.json に出す。台帳への書込は GAS（巡回 SPT）が行う。
// 確定（VERIFIED）の条件（緩めない）:
//   番組の Spotify 番組IDが台帳の番組と一致 / 題名が同じ（全角半角・空白だけ揃える）でその番組の行がちょうど1つ /
//   Spotify の配信日（UTCの日付）が台帳の配信時刻の −1日〜+1日 / 長さの差が5秒以内 / 1対1（同じURL・同じ行が2回出ない）。
//   例外（番組ごとの一定差）: 広告の差し込みで Spotify 版が毎回ほぼ同じ秒数だけ短い番組（ニュースの学校 約44秒・報談 約60秒）。
//   題名・日付が一致した回が5回以上あり、その差（台帳−Spotify）がすべて 0〜90秒・中央値から±8秒に収まる番組だけ、
//   中央値±8秒の回を確定とする（差がばらつく番組や大きく違う回は確定しない）。
// 台帳のSpotify欄に値がある行は対象外（上書きしない）。URLは Spotify が返したエピソードIDだけで作る（推測しない）。
import fs from 'node:fs';
import { parseCsv } from '../library-sync-v2.mjs';
import { SHOWS } from './scrape-new.mjs';
export const nz = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
export const SPOTIFY_EPISODE_URL = /^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})$/;
const jstMs = (s) => { const m = String(s || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5]) : NaN; };
const dayMs = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
// rows: [{ep, show, title, published, seconds, spotify}]、data: latest.json
export function spotifyMatch(rows, data, shows = SHOWS) {
  const out = [], byShowTitle = {};
  rows.forEach((r) => { const k = r.show + '\u0001' + nz(r.title); (byShowTitle[k] = byShowTitle[k] || []).push(r); });
  for (const [show, s] of Object.entries((data && data.shows) || {})) {
    if (!shows[show] || s.showId !== shows[show]) { (s.episodes || []).forEach((e) => out.push({ show, url: e.url, title: e.title, status: 'HOLD', reason: 'Spotify番組IDが台帳の番組と一致しない' })); continue; }
    for (const e of s.episodes || []) {
      const o = { show, url: e.url, title: e.title, spotifyDate: e.date, ep: '', status: '', reason: '' };
      if (!SPOTIFY_EPISODE_URL.test(e.url)) { out.push(Object.assign(o, { status: 'HOLD', reason: 'URLの形がSpotifyの回ではない' })); continue; }
      const cand = byShowTitle[show + '\u0001' + nz(e.title)] || [];
      if (!cand.length) { out.push(Object.assign(o, { status: 'NO_ROW', reason: '台帳に同じ題名の行がない（公開対象外・未収蔵・題名差）' })); continue; }
      if (cand.length > 1) { out.push(Object.assign(o, { status: 'HOLD', reason: '同じ番組に同じ題名の行が複数', ep: cand.map((r) => r.ep).join(' ') })); continue; }
      const r = cand[0]; o.ep = r.ep;
      const pub = jstMs(r.published), d = dayMs(e.date);
      const dayOk = isFinite(pub) && isFinite(d) && pub >= d - 86400000 && pub < d + 2 * 86400000;
      const sec = Number(r.seconds) || 0, durOk = sec > 0 && e.durationMs > 0 && Math.abs(sec - e.durationMs / 1000) <= 5;
      if (!dayOk) { out.push(Object.assign(o, { status: 'CANDIDATE', reason: '題名は一致・日付が離れている' })); continue; }
      o.same = !!r.spotify && r.spotify === e.url;
      o.gap = sec > 0 && e.durationMs > 0 ? sec - e.durationMs / 1000 : NaN;
      if (!durOk) { if (r.spotify && r.spotify !== e.url) o.conflict = true; out.push(Object.assign(o, { status: 'CANDIDATE', reason: sec ? '題名・日付は一致・長さが合わない' : '題名・日付は一致・台帳の再生時間が空' })); continue; }
      if (r.spotify && r.spotify !== e.url) { out.push(Object.assign(o, { status: 'HOLD', reason: '台帳に別のSpotify URLがある（上書きしない）' })); continue; }
      out.push(Object.assign(o, { status: r.spotify === e.url ? 'VERIFIED_SAME' : 'VERIFIED', reason: '番組ID・題名・日付・長さが一致' }));
    }
  }
  // 番組ごとの一定差（上の例外）。題名・日付が一致し長さだけ合わなかった回を見直す
  const gaps = {};
  out.forEach((x) => { if (x.status === 'CANDIDATE' && /長さが合わない/.test(x.reason) && isFinite(x.gap)) (gaps[x.show] = gaps[x.show] || []).push(x.gap); });
  out.forEach((x) => { if (/^VERIFIED/.test(x.status) && isFinite(x.gap)) (gaps[x.show] = gaps[x.show] || []).push(x.gap); });
  const offset = {};
  for (const [show, g] of Object.entries(gaps)) {
    const big = g.filter((v) => Math.abs(v) > 5); if (big.length < 5) continue;
    const sorted = [...big].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    const near = big.filter((v) => v >= 0 && v <= 90 && Math.abs(v - med) <= 8);
    if (med > 5 && med <= 90 && near.length >= 5 && near.length / big.length >= 0.8) offset[show] = med;
  }
  out.forEach((x) => {
    if (x.status !== 'CANDIDATE' || !/長さが合わない/.test(x.reason) || !(x.show in offset) || !isFinite(x.gap)) return;
    if (Math.abs(x.gap - offset[x.show]) <= 8 && !x.conflict) { x.status = x.same ? 'VERIFIED_SAME' : 'VERIFIED'; x.reason = `番組ID・題名・日付が一致・長さは番組ごとの一定差（Spotify版が約${Math.round(offset[x.show])}秒短い）`; }
    else x.reason += `（この番組の一定差 約${Math.round(offset[x.show])}秒とも違う）`;
  });
  const cu = {}, ce = {};
  out.forEach((x) => { if (/^VERIFIED/.test(x.status)) { cu[x.url] = (cu[x.url] || 0) + 1; ce[x.ep] = (ce[x.ep] || 0) + 1; } });
  out.forEach((x) => { if (/^VERIFIED/.test(x.status) && (cu[x.url] > 1 || ce[x.ep] > 1)) { x.status = 'HOLD'; x.reason = '重複（1対1にならない）'; } });
  return out;
}
export function rowsFromCsv(text) {
  const rows = parseCsv(text), h = rows[0] || [], I = (n) => { const i = h.indexOf(n); if (i < 0) throw new Error('列がない: ' + n); return i; };
  const c = { ep: I('EP-ID'), show: I('番組'), title: I('タイトル'), pub: I('配信日時 JST'), sec: I('再生時間 秒'), sp: I('Spotify') };
  return rows.slice(1).filter((r) => /^EP-\d{5}$/.test(r[c.ep] || '')).map((r) => ({ ep: r[c.ep], show: r[c.show], title: r[c.title], published: r[c.pub], seconds: r[c.sec], spotify: String(r[c.sp] || '').trim() }));
}
async function main() {
  const [csvPath, outPath = 'docs/spotify/matches.json'] = process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync('docs/spotify/latest.json', 'utf8'));
  const rows = rowsFromCsv(fs.readFileSync(csvPath, 'utf8'));
  const res = spotifyMatch(rows, data);
  const empty = rows.filter((r) => !r.spotify), verified = res.filter((x) => x.status === 'VERIFIED');
  const hit = new Set(res.map((x) => x.ep).filter(Boolean));
  const unmatchedEmpty = empty.filter((r) => !hit.has(r.ep)).map((r) => r.ep);
  const summary = { generatedAt: new Date().toISOString(), spotifyGeneratedAt: data.generatedAt, ledgerRows: rows.length, ledgerSpotifyEmpty: empty.length, verified: verified.length, counts: res.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {}), emptyNotInSpotifyList: unmatchedEmpty.length };
  // 台帳で Spotify 欄が空の行ごとに、照合でどうなったか（管理人の確認用・保留件数の定義を1つにするため）
  const byEp = {}; res.forEach((x) => { if (x.ep && !/ /.test(x.ep)) (byEp[x.ep] = byEp[x.ep] || []).push(x); });
  const emptyRows = empty.map((r) => { const xs = byEp[r.ep] || []; const x = xs.find((y) => /^VERIFIED/.test(y.status)) || xs[0]; return { ep: r.ep, show: r.show, title: r.title, published: r.published, status: x ? x.status : 'NOT_IN_SPOTIFY_LIST', reason: x ? x.reason : 'Spotify番組ページの取得範囲（新しい約50回）に同じ題名の回がない', spotifyUrl: x ? x.url : '' }; });
  fs.writeFileSync(outPath, JSON.stringify({ summary, verified: verified.map((x) => ({ ep: x.ep, url: x.url, show: x.show, title: x.title, spotifyDate: x.spotifyDate })), others: res.filter((x) => x.status !== 'VERIFIED' && x.status !== 'VERIFIED_SAME' && x.status !== 'NO_ROW'), emptyNotInSpotifyList: unmatchedEmpty, emptyRows }, null, 1) + '\n');
  console.log(JSON.stringify(summary));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
