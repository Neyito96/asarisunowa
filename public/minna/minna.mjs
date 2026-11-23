// みんなで仕分け（2026-11-20）。朝ポキの宇宙で「保留」の回と、Claude が特に迷った回を、朝リスのみんなで仕分ける。
// 受付は本番GAS（type=bunruiSubmit・JSONP）。票の集計は ./votes.json（30分ごとに GitHub Actions が更新）。
import { tidyDescription, withoutAwardPlea } from '../library/description-tidy.mjs?v=tidy-501-20261124';
import { liveLinks } from '../library/shelf-core.mjs';
import { queueOrder, platformOf, shareText, topVotes } from './minna-core.mjs?v=456';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec';
const BOUNDARY = ['EP-06145', 'EP-03915', 'EP-05192', 'EP-04452', 'EP-03936', 'EP-05841', 'EP-05324', 'EP-02817', 'EP-01643', 'EP-00126', 'EP-02143', 'EP-06018', 'EP-06221', 'EP-06216', 'EP-06019', 'EP-00597', 'EP-00886', 'EP-04333', 'EP-04757'];
const $ = (s, el = document) => el.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('minna:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('minna:' + k, JSON.stringify(v)); } catch { /* 保存できない環境でも使える */ } },
};
const device = (() => { let d = store.get('device', ''); if (!/^[A-Za-z0-9_-]{8,64}$/.test(d)) { d = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20); store.set('device', d); } return d; })();
const done = new Set(store.get('done', []));
const skipped = new Set(store.get('skipped', []));

let D, M, votes = {}, VOTE_META = {}, queue = [], pos = 0, filterShow = -1, q = '';
const detailCache = new Map();

async function json(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'minnacb' + Date.now() + Math.floor(Math.random() * 1e4), s = document.createElement('script'), t = setTimeout(() => { cleanup(); reject(new Error('TIMEOUT')); }, 25000);
    function cleanup() { clearTimeout(t); delete window[cb]; s.remove(); }
    window[cb] = (res) => { cleanup(); resolve(res); };
    s.src = url + '&callback=' + cb; s.onerror = () => { cleanup(); reject(new Error('NETWORK')); };
    document.head.appendChild(s);
  });
}
async function detail(id) {
  const b = Math.floor(Number(id.slice(3)) / M.detailBucketSize);
  if (!detailCache.has(b)) detailCache.set(b, json(`../library/data/details/${b}.json?v=${M.version}`));
  return (await detailCache.get(b)).find((e) => e.id === id) || null;
}

const isHold = (i) => { const c = D.cls[i]; return !(c[0] >= 0 && 'apd'.includes(c[3])); };
const fmtDate = (n) => { const s = String(n); return `${s.slice(0, 4)}.${Number(s.slice(4, 6))}.${Number(s.slice(6, 8))}`; };
const fmtDur = (sec) => (sec > 0 ? `${Math.round(sec / 60)}分` : '');

function buildQueue() {
  const idx = new Map(D.eps.map((e, i) => [e[0], i]));
  const items = [];
  BOUNDARY.forEach((id) => { if (idx.has(id)) items.push({ i: idx.get(id), boundary: true }); });
  D.eps.forEach((e, i) => { if (isHold(i) && !BOUNDARY.includes(e[0])) items.push({ i, boundary: false }); });
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = items.filter((x) => (filterShow < 0 || D.eps[x.i][2] === filterShow) && words.every((w) => D.eps[x.i][1].toLowerCase().includes(w)));
  queue = queueOrder(filtered.map((x) => ({ ...x, id: D.eps[x.i][0], n: (votes[D.eps[x.i][0]] || {}).n || 0, mine: done.has(D.eps[x.i][0]), skipped: skipped.has(D.eps[x.i][0]) })), device);
  pos = 0;
}

function renderStats() {
  const total = BOUNDARY.length + D.cls.filter((_, i) => isHold(i)).length;
  const nameless = D.cls.filter((c, i) => isHold(i) && !(c[0] >= 0) && !((votes[D.eps[i][0]] || {}).n)).length;   // 宇宙の「名付け募集星群」（推定も見立てもない回）
  const voted = Object.keys(votes).length;
  $('#stats').innerHTML = `<span><b>${total.toLocaleString()}</b>回が見立て待ち（うち名付け募集星群 <b>${nameless.toLocaleString()}</b>回）</span><span>みんなの見立て <b>${voted.toLocaleString()}</b>回${VOTE_META.contributors ? `・<b>${VOTE_META.contributors}</b>人` : ''}</span><span>あなた <b>${done.size}</b>回</span>`;
}

function renderShowChips() {
  const el = $('#showChips'); el.innerHTML = '';
  const mk = (label, v) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = 'chip' + (filterShow === v ? ' on' : ''); b.onclick = () => { filterShow = v; renderShowChips(); buildQueue(); show(); }; el.appendChild(b); };
  mk('すべての番組', -1); D.shows.forEach((s, i) => mk(s, i));
}

async function show(id) {
  const app = $('#app'); app.innerHTML = '';
  let item = id ? { i: D.eps.findIndex((e) => e[0] === id), boundary: BOUNDARY.includes(id) } : queue[pos];
  if (!item || item.i < 0) { app.innerHTML = '<p class="empty">この条件の回は、すべて見立てを送りました。ありがとうございます！ 番組を変えてみてください。</p>'; return; }
  const e = D.eps[item.i], epId = e[0];
  history.replaceState(null, '', '#ep=' + epId);
  const node = $('#cardTpl').content.firstElementChild.cloneNode(true);
  $('.show', node).textContent = D.shows[e[2]] || '';
  $('.date', node).textContent = fmtDate(e[3]);
  $('.dur', node).textContent = fmtDur(e[7]);
  if (item.boundary) $('.badge', node).hidden = false;
  if (!isHold(item.i)) { const c = D.cls[item.i], b = $('.badge', node); b.hidden = false; b.classList.add('now'); b.textContent = `いまの分類：${D.cats[c[0]].name}（Claude）`; }
  $('.title', node).textContent = e[1];
  app.appendChild(node);
  const det = await detail(epId).catch(() => null);
  if (det) fillDetail(node, det);
  setupForm(node, epId, item.i);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function fillDetail(node, det) {
  if (det.cast) $('.cast', node).textContent = det.cast;
  const pref = store.get('platform', '');
  const ORDER = ['asahi', 'spotify', 'apple', 'amazon', 'pocketcasts', 'listen', 'pody', 'youtube'];   // 蔵と同じ並び。Omny は聴く場所のボタンに出さない（このページで聴くの再生には使う）
  const plats = liveLinks(det, det.links || []).map((u) => ({ u, p: platformOf(u) })).filter((x) => x.p && ORDER.includes(x.p.key)).filter((x, k, a) => a.findIndex((y) => y.p.key === x.p.key) === k);
  plats.sort((a, b) => (b.p.key === pref) - (a.p.key === pref) || ORDER.indexOf(a.p.key) - ORDER.indexOf(b.p.key));
  const box = $('.platforms', node);
  plats.forEach(({ u, p }) => {
    const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.className = 'plat ' + p.key + (p.key === pref ? ' pref' : ''); a.textContent = p.name;
    a.onclick = () => store.set('platform', p.key);
    box.appendChild(a);
  });
  if (!plats.length) box.innerHTML = '<span class="none">配信先リンクがありません</span>';
  const omny = (det.links || []).find((u) => /^https:\/\/omny\.fm\/shows\//.test(u));
  if (omny) {
    const btn = $('.inline-play', node); btn.hidden = false;
    btn.onclick = () => { const f = document.createElement('iframe'); f.src = omny.replace(/\/embed$/, '') + '/embed?style=cover'; f.loading = 'lazy'; f.allow = 'autoplay; clipboard-write'; f.title = 'このページで聴く'; $('.player', node).replaceChildren(f); btn.hidden = true; };
  }
  const t = tidyDescription(det.description || '');
  const body = (t.status === 'TIDY' || t.status === 'AS_IS') ? t.body : withoutAwardPlea(det.description);
  $('.desc-body', node).textContent = body || '（概要欄がありません）';
  const rel = (det.relatedArticles && det.relatedArticles.length ? det.relatedArticles : (t.related || []));
  $('.rel-n', node).textContent = rel.length ? `（${rel.length}件）` : '（なし）';
  const ul = $('.rel-list', node);
  rel.forEach((r) => { const li = document.createElement('li'), a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.title || r.url; li.appendChild(a); ul.appendChild(li); });
  if (rel.length) $('.related', node).open = true;
}

function setupForm(node, epId, i) {
  const form = $('.vote', node), state = { main: '', sub: '', theme: '' };
  const mainGrid = $('.main-grid', node), subGrid = $('.sub-grid', node), themeBox = $('.theme-chips', node);
  const chip = (label, hue, onPick, cls = 'cat') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; if (hue != null) b.style.setProperty('--h', hue); b.onclick = () => onPick(b); return b; };
  const renderSub = () => {
    subGrid.innerHTML = '';
    D.cats.forEach((c) => { if (c.name === state.main) return; subGrid.appendChild(chip(c.name, c.hue, (b) => { const on = !b.classList.contains('on'); subGrid.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.toggle('on', on); state.sub = on ? c.name : ''; })); });
  };
  const renderTheme = () => {
    themeBox.innerHTML = ''; const c = D.cats.find((x) => x.name === state.main); if (!c) return;
    c.subs.forEach((s) => themeBox.appendChild(chip(s, c.hue, (b) => { const on = !b.classList.contains('on'); themeBox.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.toggle('on', on); state.theme = on ? s : ''; $('.theme-free', node).value = ''; }, 'theme')));
  };
  [...D.cats.map((c) => ({ name: c.name, hue: c.hue })), { name: 'わからない', hue: null }].forEach((c) => {
    mainGrid.appendChild(chip(c.name, c.hue, (b) => {
      mainGrid.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      state.main = c.name; state.sub = ''; state.theme = '';
      const unsure = c.name === 'わからない';
      $('.q-sub', node).disabled = unsure; $('.q-theme', node).disabled = unsure;
      renderSub(); renderTheme(); $('.send', node).disabled = false;
    }, c.hue == null ? 'cat unsure' : 'cat'));
  });
  $('.theme-free', node).addEventListener('input', (ev) => { if (ev.target.value) { themeBox.querySelectorAll('button').forEach((x) => x.classList.remove('on')); state.theme = ''; } });
  $('.nick', node).value = store.get('nick', '');
  $('.skip', node).onclick = () => { skipped.add(epId); store.set('skipped', [...skipped]); next(); };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault(); if (!state.main) return;
    const send = $('.send', node), msg = $('.msg', node); send.disabled = true; msg.textContent = '送っています…'; msg.className = 'msg';
    const nick = $('.nick', node).value.trim(); store.set('nick', nick);
    const params = new URLSearchParams({ type: 'bunruiSubmit', ep: epId, main: state.main, sub: state.sub, theme: state.theme || $('.theme-free', node).value.trim(), note: $('.note', node).value.trim(), nick, listened: (form.querySelector('input[name=listened]:checked') || {}).value || '', device, website2: $('.hp', node).value });
    try {
      const res = await jsonp(ENDPOINT + '?' + params.toString());
      if (!res || res.ok !== true || !res.receiptId) throw new Error((res && res.message) || '受け付けられませんでした');
      done.add(epId); store.set('done', [...done]);
      votes[epId] = res.tally || votes[epId];
      if (res.tally && typeof res.tally.n === 'number') { const f = store.get('fresh', {}); f[epId] = { t: res.tally, at: Date.now() }; const keep = Object.entries(f).sort((a, b) => b[1].at - a[1].at).slice(0, 80); store.set('fresh', Object.fromEntries(keep)); }
      form.hidden = true; showResult(node, epId, i, state.main); renderStats();
    } catch (err) { msg.textContent = (err && err.message) === 'TIMEOUT' ? '時間がかかっています。少し待ってから、もう一度お試しください。' : String(err.message || err); msg.className = 'msg err'; send.disabled = false; }
  });
}

function showResult(node, epId, i, mine) {
  const box = $('.result', node); box.hidden = false;
  const v = votes[epId] || { n: 0, main: {}, sub: {}, unsure: 0 };
  const rows = topVotes(v, 6), max = Math.max(1, ...rows.map((r) => r.count));
  const hueOf = (name) => (D.cats.find((c) => c.name === name) || {}).hue;
  $('.bars', box).innerHTML = rows.length ? rows.map((r) => `<div class="bar${r.name === mine ? ' mine' : ''}"><span class="lbl">${r.name}</span><span class="track"><span class="fill" style="width:${(r.count / max) * 100}%;--h:${hueOf(r.name) ?? 220}"></span></span><span class="cnt">${r.count}</span></div>`).join('') + `<p class="n">${v.n}人が見立て${v.unsure ? `（うち「わからない」${v.unsure}）` : ''}</p>` : '<p class="n">あなたが最初の仕分けです！</p>';
  const c = D.cls[i], name = (k) => (k >= 0 ? D.cats[k].name : '');
  $('.claude', box).textContent = !isHold(i) ? `参考：いま宇宙では Claude の分類「${name(c[0])}」${c[4] >= 0 ? `（副分類「${name(c[4])}」）` : ''}で並んでいます。みんなの見立ては宇宙のこの回に表れます。` : c[0] >= 0 ? `参考：Claude の推定は「${name(c[0])}」${c[4] >= 0 ? `（次点「${name(c[4])}」）` : ''}。確信が持てず保留にしていました。` : '参考：Claude は手がかりが少なく推定できませんでした。';
  $('.next', box).onclick = next;
  $('.share', box).onclick = async () => {
    const url = location.origin + location.pathname + '#ep=' + epId, text = shareText(D.eps[i][1], url);
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(text); $('.share', box).textContent = 'コピーしました'; } } catch { /* 取り消し */ }
  };
}

function next() { pos++; if (pos >= queue.length) buildQueue(); show(); }

async function main() {
  try {
    [D, M] = await Promise.all([json('../uchu/data/core.json'), json('../library/data/manifest.json')]);
    try { const v = await json('./votes.json'); votes = v.votes || {}; VOTE_META = v; } catch { votes = {}; }
  } catch (err) { $('#loading').textContent = '読み込めませんでした。時間をおいて開き直してください。'; return; }
  renderShowChips(); buildQueue(); renderStats();
  let t; $('#q').addEventListener('input', (ev) => { clearTimeout(t); t = setTimeout(() => { q = ev.target.value; buildQueue(); show(); }, 300); });
  const m = location.hash.match(/ep=(EP-\d{5})/);
  show(m ? m[1] : undefined);
}
main();
