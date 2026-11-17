// 自分の蔵書一覧（Issue #315）: 端末内保存と共有URLの純関数。画面に依存しない（Node のテストでも使う）
// 保存するのは利用者が選んだ回の EP-ID と、利用者が書いた一覧のタイトル・説明だけ。検索の言葉や閲覧の記録は保存しない。
export const SHELF_KEY = 'asarisunowa:library-shelf:v1';   // 既存の「自分の棚」と同じ保存場所（棚を二つ作らない）
export const SHELF_LIMITS = { items: 50, title: 60, description: 300 };
const ID = /^EP-\d{5}$/;

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '').slice(0, max);
// 保存データを読む。旧形式（EP-ID の配列）も読み、新形式 {v:2,title,description,ids} にそろえる
export function readShelf(raw) {
  let data = null;
  try { data = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw; } catch { data = null; }
  const ids = Array.isArray(data) ? data : Array.isArray(data?.ids) ? data.ids : [];
  const uniq = [...new Set(ids.filter((x) => ID.test(String(x))))].slice(0, SHELF_LIMITS.items);
  return { v: 2, title: clean(Array.isArray(data) ? '' : data?.title, SHELF_LIMITS.title), description: clean(Array.isArray(data) ? '' : data?.description, SHELF_LIMITS.description), ids: uniq };
}
export const serializeShelf = (shelf) => JSON.stringify(readShelf(shelf));
export function toggleItem(shelf, id) {
  const s = readShelf(shelf);
  if (!ID.test(id)) return s;
  if (s.ids.includes(id)) return { ...s, ids: s.ids.filter((x) => x !== id) };
  if (s.ids.length >= SHELF_LIMITS.items) return s;
  return { ...s, ids: [...s.ids, id] };
}
export function moveItem(shelf, id, delta) {
  const s = readShelf(shelf), i = s.ids.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= s.ids.length) return s;
  const ids = [...s.ids]; [ids[i], ids[j]] = [ids[j], ids[i]];
  return { ...s, ids };
}
export const setMeta = (shelf, { title, description }) => { const s = readShelf(shelf); return readShelf({ ...s, title: title ?? s.title, description: description ?? s.description }); };

// ===== 共有URL =====
// 形: <蔵のURL>#s=1.<base64url(JSON {t,d,i:[番号]})>。# 以降はサーバーへ送られない（GitHub Pages のアクセス記録にも残らない）。
// 入るのは「選んだ回の番号」「タイトル」「説明」だけ。名前・メール・検索の言葉・端末の識別子は入れない。サーバーに保存しないので、取り消し・失効はできない。
const b64url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (str) => { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
export function encodeShare({ title, description, ids }) {
  const s = readShelf({ title, description, ids });
  if (!s.ids.length) return '';
  const json = JSON.stringify({ t: s.title, d: s.description, i: s.ids.map((x) => Number(x.slice(3))) });
  return 's=1.' + b64url(new TextEncoder().encode(json));
}
export function decodeShare(hash) {
  const m = String(hash || '').replace(/^#/, '').match(/(?:^|&)s=1\.([A-Za-z0-9_-]{4,4000})(?:&|$)/);
  if (!m) return null;
  try {
    const o = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unb64url(m[1])));
    if (!o || !Array.isArray(o.i)) return null;
    const ids = [...new Set(o.i.filter((n) => Number.isInteger(n) && n > 0 && n < 100000).map((n) => 'EP-' + String(n).padStart(5, '0')))].slice(0, SHELF_LIMITS.items);
    if (!ids.length) return null;
    return { title: clean(o.t, SHELF_LIMITS.title), description: clean(o.d, SHELF_LIMITS.description), ids };
  } catch { return null; }
}
// 共有カードに出すリンクの名前（その回に実在し、台帳で確認済みのリンクだけが公開データに入っている）
export function platformLabel(url) {
  let h = '', proto = ''; try { ({ hostname: h, protocol: proto } = new URL(url)); } catch { return ''; }
  if (proto !== 'https:') return '';
  if (h === 'open.spotify.com') return 'Spotify';
  if (h === 'podcasts.apple.com') return 'Apple Podcasts';
  if (h === 'pca.st' || h.endsWith('pocketcasts.com')) return 'Pocket Casts';
  if (h === 'pody.jp') return 'Pody';
  if (h === 'listen.style') return 'LISTEN';
  if (h.startsWith('music.amazon.')) return 'Amazon Music';
  if (h === 'www.youtube.com' || h === 'youtube.com' || h === 'youtu.be') return 'YouTube';
  if (h === 'www.asahi.com' || h.endsWith('.asahi.com')) return '朝日新聞 公式ページ';
  if (h === 'omny.fm') return '公式配信ページ';
  return '';
}
// 公開データの回 → 共有カード用（音声ファイルの直リンクや未知のサイトは出さない）
export function cardLinks(links) {
  const seen = new Set(), out = [];
  for (const u of links || []) { const label = platformLabel(u); if (!label || /\.mp3(\?|$)/i.test(u) || seen.has(label)) continue; seen.add(label); out.push({ label, url: u }); }
  return out;
}
