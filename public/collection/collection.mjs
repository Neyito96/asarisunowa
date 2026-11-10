import {filterEpisodes} from '../library/library-core.mjs';
import {SERVICES, SERVICE_LABEL, resolveLink, createCollection, addIds, removeId, move, encodeShare, decodeShare, toText, mailtoUrl, coverage} from './collection-core.mjs';
const $ = id => document.getElementById(id), DATA = '../library/data/', KEY = 'asarisu-collection-v1', LIMIT = 30;
let manifest, col = createCollection(), details = new Map(), searchSeq = 0; const cache = new Map();
const json = p => cache.get(p) || (cache.set(p, fetch(DATA + p + '?v=' + (manifest?.version || '')).then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); }).catch(e => { cache.delete(p); throw e; })), cache.get(p));
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(col)); } catch {} };
const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && Array.isArray(o.ids)) return addIds(createCollection(o.title, o.service), o.ids); } catch {} return null; };
const say = t => { $('msg').textContent = t; };
async function loadDetails(ids) { // 詳細(リンク)はバケット単位で必要分だけ
  const need = [...new Set(ids.filter(i => !details.has(i)).map(i => Math.floor(Number(i.slice(3)) / manifest.detailBucketSize)))];
  await Promise.all(need.map(async b => { try { for (const e of await json(`details/${b}.json`)) details.set(e.id, e); } catch {} }));
}
async function search() {
  const seq = ++searchSeq, q = $('q').value.trim(), show = $('show').value, shows = manifest.shows.filter(s => !show || s.name === show), hits = [];
  $('status').textContent = '検索中…'; $('results').replaceChildren();
  try { for (const s of shows) for (const f of s.search) { const rows = await json(f); if (seq !== searchSeq) return; hits.push(...filterEpisodes(rows, {query: q, show: show || '', order: 'newest'})); if (hits.length >= LIMIT && !show) break; }
  } catch { $('status').textContent = '検索データを読み込めませんでした。通信を確認してください。'; return; }
  hits.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('status').textContent = hits.length ? `${hits.length > LIMIT ? LIMIT + '件以上' : hits.length + '件'}(新しい順に${Math.min(hits.length, LIMIT)}件を表示)` : '該当するエピソードはありません。';
  for (const e of hits.slice(0, LIMIT)) { const li = el('li'), t = el('div', undefined, 't'), b = el('button', col.ids.includes(e.id) ? '追加済み' : '追加', 'small'); b.disabled = col.ids.includes(e.id); b.setAttribute('aria-label', `${e.title}を集に追加`);
    t.append(el('b', e.title), el('span', `${e.show} ・ ${String(e.date).slice(0, 10)}${e.cast ? ' ・ ' + e.cast : ''}`, 'm')); b.onclick = async () => { col = addIds(col, [e.id]); b.textContent = '追加済み'; b.disabled = true; save(); await render(); }; li.append(t, b); $('results').append(li); }
}
async function render() {
  await loadDetails(col.ids); const eps = col.ids.map(i => details.get(i)).filter(Boolean); $('count').textContent = `(${col.ids.length}件)`; $('items').replaceChildren();
  col.ids.forEach((id, i) => { const e = details.get(id), li = el('li'), t = el('div', undefined, 't'); const r = e ? resolveLink(e, col.service) : null;
    t.append(el('b', e ? e.title : id), el('span', e ? `${e.show} ・ ${String(e.date).slice(0, 10)}` : 'データ未取得', 'm'));
    if (r) { const lab = r.status === 'EXACT' ? '個別リンクあり' : r.status === 'SHOW_ONLY' ? '番組ページのみ(個別なし)' : r.fallback ? `未登録(代替:${SERVICE_LABEL[r.fallback.service]})` : '未登録'; t.append(el('span', lab, 'badge ' + (r.status === 'MISSING' && r.fallback ? 'fb' : r.status))); }
    const up = el('button', '↑', 'small'), dn = el('button', '↓', 'small'), rm = el('button', '✕', 'small'); up.setAttribute('aria-label', '上へ'); dn.setAttribute('aria-label', '下へ'); rm.setAttribute('aria-label', '削除');
    up.onclick = () => { col = move(col, id, -1); save(); render(); }; dn.onclick = () => { col = move(col, id, 1); save(); render(); }; rm.onclick = () => { col = removeId(col, id); save(); render(); };
    li.append(t, up, dn, rm); $('items').append(li); });
  const cv = coverage(eps).byService[col.service]; $('cov').textContent = eps.length ? `${SERVICE_LABEL[col.service]}の個別リンク: ${cv.exact}/${eps.length}件` : '検索して「追加」を押すと、ここに集まります。';
  $('preview').textContent = toText(col, eps, {siteUrl: location.origin + location.pathname}); $('mail').href = mailtoUrl(col, eps, {siteUrl: location.origin + location.pathname}); $('mail').setAttribute('aria-disabled', String(!col.ids.length));
}
async function copy(text, ok) { try { await navigator.clipboard.writeText(text); say(ok); } catch { say('コピーできませんでした。下のプレビューを長押ししてコピーしてください。'); $('preview').closest('details').open = true; } }
(async () => {
  try { manifest = await json('manifest.json'); } catch { $('status').textContent = 'データを読み込めませんでした。'; return; }
  for (const s of manifest.shows) { const o = el('option', s.label || s.name); o.value = s.name; $('show').append(o); }
  for (const s of SERVICES) { const o = el('option', SERVICE_LABEL[s]); o.value = s; $('service').append(o); }
  const p = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1)), shared = decodeShare(hash.get('c')); col = shared || load() || createCollection();
  if (p.get('add')) col = addIds(col, p.get('add').split(',')); // 図書館・宇宙からの「集に追加」導線
  $('title').value = col.title; $('service').value = col.service; save();
  $('title').oninput = () => { col = {...col, title: $('title').value.slice(0, 60)}; save(); render(); }; $('service').onchange = () => { col = {...col, service: $('service').value}; save(); render(); };
  $('go').onclick = search; $('q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  $('copy').onclick = () => copy($('preview').textContent, 'リンク集をコピーしました。'); $('share').onclick = () => copy(location.origin + location.pathname + '#c=' + encodeShare(col), '共有URLをコピーしました(リンクを開いた人は同じ集を見られます)。');
  $('clear').onclick = () => { col = {...col, ids: []}; save(); render(); }; $('mail').onclick = e => { if (!col.ids.length) e.preventDefault(); };
  await render();
})();
