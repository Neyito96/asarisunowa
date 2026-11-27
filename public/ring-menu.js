// ring-menu.js — 朝リスの輪の ☰ メニュー（全ページ共通・2026-11-26 管理人案）。
// 田（Next.js）と同じ並び・名前で、蔵・宇宙・星読み・FAQ などの静的ページにも出す。
// 使い方: <script src="../ring-menu.js" defer></script> を置くだけ。
//   ページに [data-ring-menu-slot] があれば、そこに ☰ ボタンだけ入れる（宇宙のように独自の上部バーがあるページ）。
//   なければ、body の先頭に「☰ / 朝リスの輪 / 🔍」の細いバーを足す。
(function () {
  var script = document.currentScript;
  var root = new URL('./', script ? script.src : location.href).href;
  var here = location.href.split(/[?#]/)[0];
  var PAGES = [
    { path: '', mark: '田', label: '番組・プレイリスト' },
    { path: 'library/', mark: '蔵', label: '過去の回を探す' },
    { path: 'uchu/', mark: '宇宙', label: 'テーマでめぐる' },
    { path: 'minna/', mark: '星読み', label: '分類に投票' },
    { path: 'faq/', mark: 'FAQ', label: 'よくある質問' }
  ];
  var SUB = [
    { href: 'https://www.asahi.com/special/podcasts/', label: '朝日新聞ポッドキャスト 公式・全番組 ↗', ext: true },
    { path: 'status/', label: 'ロボットの様子' },
    { path: 'open/', label: '公開しているもの' },
    { path: 'privacy/', label: 'プライバシー' }
  ];
  function isHere(path) {
    var u = root + path;
    return here === u || here === u + 'index.html';
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  var bars = '<span class="rm-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
  function toggleButton() {
    return el('button', { type: 'button', class: 'rm-toggle', 'aria-expanded': 'false', 'aria-controls': 'rm-drawer', 'aria-label': 'メニューを開く' }, bars);
  }

  function build() {
    var slot = document.querySelector('[data-ring-menu-slot]');
    var toggle = toggleButton();
    if (slot) {
      slot.appendChild(toggle);
    } else {
      var bar = el('div', { class: 'rm-bar' });
      var title = el('a', { class: 'rm-title', href: root }, '朝リスの輪');
      var search = document.querySelector('input[type="search"]');
      var find = search
        ? el('button', { type: 'button', class: 'rm-find', 'aria-label': 'このページで探す', title: 'このページで探す' }, '<span aria-hidden="true">🔍</span>')
        : el('a', { class: 'rm-find', href: root + 'library/', target: '_blank', rel: 'noopener', 'aria-label': '蔵で過去の回を探す', title: '蔵で過去の回を探す' }, '<span aria-hidden="true">🔍</span>');
      if (search) find.addEventListener('click', function () { search.scrollIntoView({ block: 'center' }); search.focus(); });
      bar.appendChild(toggle); bar.appendChild(title); bar.appendChild(find);
      document.body.insertBefore(bar, document.body.firstChild);
    }

    var backdrop = el('div', { class: 'rm-backdrop', hidden: '' });
    var drawer = el('nav', { id: 'rm-drawer', class: 'rm-drawer', 'aria-label': 'メニュー', hidden: '' });
    var head = el('div', { class: 'rm-head' }, '<p class="rm-name">朝リスの輪</p>');
    var close = el('button', { type: 'button', class: 'rm-toggle', 'aria-label': 'メニューを閉じる' }, bars.replace('rm-bars', 'rm-bars open'));
    head.appendChild(close);
    drawer.appendChild(head);
    var ul = el('ul');
    PAGES.forEach(function (p) {
      var cur = isHere(p.path);
      var a = el('a', { href: root + p.path }, '<b>' + p.mark + '</b> ' + p.label);
      if (cur) a.setAttribute('aria-current', 'page'); else { a.target = '_blank'; a.rel = 'noopener'; }
      var li = el('li'); li.appendChild(a); ul.appendChild(li);
    });
    drawer.appendChild(ul);
    var sub = el('ul', { class: 'rm-sub' });
    SUB.forEach(function (p) {
      var href = p.href || root + p.path;
      var a = el('a', { href: href }, p.label);
      if (p.path != null && isHere(p.path)) a.setAttribute('aria-current', 'page');
      else { a.target = '_blank'; a.rel = p.ext ? 'noreferrer' : 'noopener'; }
      var li = el('li'); li.appendChild(a); sub.appendChild(li);
    });
    drawer.appendChild(sub);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    function setOpen(open) {
      drawer.hidden = !open; backdrop.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      if (open) close.focus(); else toggle.focus();
    }
    toggle.addEventListener('click', function () { setOpen(drawer.hidden); });
    close.addEventListener('click', function () { setOpen(false); });
    backdrop.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) setOpen(false); });
  }

  // アクセスの数え方（全ページ共通）
  var cnt = document.createElement('script'); cnt.defer = true; cnt.src = root + 'count.js?v=20261128'; document.head.appendChild(cnt);
  var css = el('link', { rel: 'stylesheet', href: root + 'ring-menu.css?v=20261126b' });
  document.head.appendChild(css);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
