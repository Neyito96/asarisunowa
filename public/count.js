// アクセスの数え方（全ページ共通・2026-11-28）。Cloudflare Web Analytics（Cookie なし・個人を特定しない）。
// ・管理人など「数えない端末」: その端末のブラウザで一度だけ ?nocount=1 を付けて開く（元に戻すのは ?nocount=0）。この端末にだけ印を残す
// ・自動で動くブラウザ（テスト用など navigator.webdriver）は数えない。AI や検索のロボットは、多くがページの中の仕組みを動かさないので、もともと数に入らない
(function () {
  var q = location.search, off = false;
  try {
    if (/[?&]nocount=1\b/.test(q)) { localStorage.setItem('asarisu-nocount', '1'); note('この端末は、アクセス数に数えません'); }
    if (/[?&]nocount=0\b/.test(q)) { localStorage.removeItem('asarisu-nocount'); note('この端末も、アクセス数に数えます'); }
    off = localStorage.getItem('asarisu-nocount') === '1';
  } catch (e) {}
  if (off || navigator.webdriver) return;
  var s = document.createElement('script');
  s.defer = true; s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', '{"token":"06c64615da3b42ceba758c2fa9a439c7"}');
  document.head.appendChild(s);
  function note(t) {
    var go = function () { var d = document.createElement('div'); d.textContent = t; d.setAttribute('role', 'status');
      d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2000;background:#3e4232;color:#fff;padding:10px 16px;border-radius:999px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
      document.body.appendChild(d); setTimeout(function () { d.remove(); }, 5000); };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
})();
