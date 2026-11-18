// Spotify 新着（2026-11-18 管理人指示・#337 後続）: 7番組の Spotify 番組の「埋め込みページ」を読み、新しい回の
// エピソードURL・題名・配信日・長さを docs/spotify/latest.json に保存する。Spotify API の認証情報は使わない。
// 埋め込みページはサーバー側で回の一覧（__NEXT_DATA__）を返すので、ブラウザ描画は不要。1日2回・7ページだけ。
// V2 への書込はしない（清掃ロボGASの巡回が題名・日付で照合し、確定した回の空欄にだけ書く）。
import fs from 'node:fs';
export const SHOWS = {
  'ニュースの現場から': '392h0MYfvMTndEVzf2cOvC', 'ニュースの学校': '2uG9W6CnsaNi87AfSuGe8r', '報談': '5Dt1uyQaJpM6hPV8aEMP3R',
  'スポンジ': '7euH6hzudIdp61JRSi9E8w', 'MEDIA TALK': '0yhef9ORZkUZs9ZeotdCSY', 'こどもそうだんしつ': '1KExdSsjQnatS4TdseGoC0', 'ドーナツ': '0341I5UOUrJgm7KEvNGInZ',
};
// __NEXT_DATA__ の中から「エピソードの形」をしたものを全部拾う（構造が変わっても拾えるように再帰で探す）
export function extractEpisodes(nextData) {
  const out = new Map();
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const uri = typeof x.uri === 'string' ? x.uri : '';
    const m = uri.match(/^spotify:episode:([A-Za-z0-9]{22})$/);
    if (m) {
      const title = String(x.title || x.name || '').trim();
      const rd = x.releaseDate && (x.releaseDate.isoString || x.releaseDate) || x.release_date || '';
      const dur = Number(x.duration || x.duration_ms || (x.duration && x.duration.totalMilliseconds) || 0);
      const cur = out.get(m[1]) || {};
      out.set(m[1], { id: m[1], url: 'https://open.spotify.com/episode/' + m[1], title: cur.title || title, date: cur.date || String(rd || '').slice(0, 10), durationMs: cur.durationMs || (Number.isFinite(dur) ? dur : 0) });
    }
    Object.values(x).forEach(walk);
  };
  walk(nextData);
  return [...out.values()].filter((e) => e.title);
}
export function nextDataFromHtml(html) {
  const m = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}
async function main() {
  const out = { generatedAt: new Date().toISOString(), source: 'open.spotify.com/embed/show', shows: {} };
  const problems = [];
  for (const [show, id] of Object.entries(SHOWS)) {
    const res = await fetch(`https://open.spotify.com/embed/show/${id}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; asarisunowa-library/1.0)', 'accept-language': 'ja-JP' } });
    const html = await res.text();
    const nd = res.ok ? nextDataFromHtml(html) : null;
    const eps = nd ? extractEpisodes(nd) : [];
    out.shows[show] = { showId: id, count: eps.length, episodes: eps };
    console.log(`${show}: HTTP ${res.status} 回数 ${eps.length} 最新 ${eps[0] ? eps[0].date + ' ' + eps[0].title.slice(0, 30) : '-'}`);
    if (!eps.length) problems.push(`${show}: HTTP ${res.status}`);
  }
  if (Object.values(out.shows).every((s) => !s.count)) throw new Error('全番組で回が取れませんでした: ' + problems.join(' / '));
  fs.mkdirSync('docs/spotify', { recursive: true });
  fs.writeFileSync('docs/spotify/latest.json', JSON.stringify(out, null, 1) + '\n');
  if (problems.length) console.log('::warning::回が取れなかった番組: ' + problems.join(' / '));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
