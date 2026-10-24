/* ztp-playbar v0.1 - shared Phone / Screen toggle + "?" info for every Zero to Phi game.
   Include once per page:  <script src="../js/ztp-playbar.js" data-here="screen|phone" data-screen="index.html" data-phone="pad.html"></script>
   data-phone=""  -> game has no phone page (Phone = play this page solo on the phone)
   data-pads="0"  -> game has no phone-controller join (Screen view says so, no QR)
   Screen QR: uses the game's live join link (minikit host padUrl, or window.ZTP_JOIN_URL) when available. ?bar=0 hides the bar. */
(function () {
  var me = document.currentScript, d = me ? me.dataset : {}, W = window, D = document;
  if (/[?&]bar=0/.test(location.search)) return;
  if ((d.here === 'phone') && /[?&]room=/.test(location.search)) return; // joined as a controller: stay out of the way
  var here = d.here || 'screen', scr = d.screen || 'index.html', ph = d.phone == null ? 'pad.html' : d.phone, pads = d.pads !== '0';
  var big = Math.min(screen.width, screen.height) >= 600 && !(matchMedia('(pointer:coarse)').matches && innerWidth < 900);
  var host = null;
  // catch the minikit host so Screen mode can show its real join link
  function hook() { var K = W.Kit; if (!K || !K.host || K.host.__pb) return; var o = K.host; K.host = function () { host = o.apply(this, arguments); return host; }; K.host.__pb = 1; }
  hook(); var hk = setInterval(hook, 50); setTimeout(function () { clearInterval(hk); }, 4000);
  function joinUrl() { if (W.ZTP_JOIN_URL) return W.ZTP_JOIN_URL; var h = host || (W.Kit && W.Kit.lastHost); if (h && h.code && h.padUrl) return h.padUrl(); return ''; }
  function qs(extra) { var q = location.search.replace(/[?&](tv|bar)=[^&]*/g, '').replace(/^&/, '?'); if (extra) q += (q ? '&' : '?') + extra; return q; }
  function go(m) {
    try { localStorage.setItem('ztp-playmode', m); } catch (e) {}
    if (m === here) { render(); return; }
    if (m === 'screen') location.href = scr + qs('tv=1');
    else if (ph) location.href = ph + qs();
    else { here = 'phone'; render(); }
  }
  var css = '#ztppb{position:fixed;z-index:2147483000;right:max(8px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));display:flex;gap:4px;font:600 12px/1 system-ui,sans-serif;opacity:.55;transition:opacity .2s}' +
    '#ztppb:hover,#ztppb.open{opacity:1}#ztppb button{border:1px solid rgba(255,210,63,.5);background:rgba(0,0,0,.6);color:#ffe9a8;border-radius:999px;padding:6px 9px;cursor:pointer;font:inherit}' +
    '#ztppb button.on{background:#ffd23f;color:#111}#ztppop{position:fixed;z-index:2147483001;right:8px;top:44px;width:min(280px,86vw);background:#111;color:#eee;border:1px solid #ffd23f;border-radius:12px;padding:12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 30px #000}' +
    '#ztppop .qr{background:#fff;padding:6px;border-radius:8px;margin:8px auto 4px;width:180px}#ztppop .qr svg{display:block;width:100%;height:auto}#ztppop small{color:#aaa;word-break:break-all}';
  var st = D.createElement('style'); st.textContent = css;
  var bar = D.createElement('div'); bar.id = 'ztppb';
  bar.innerHTML = '<button data-m="phone" title="Play on this phone">\uD83D\uDCF1 Phone</button><button data-m="screen" title="Show on a big screen, phones join as controllers">\uD83D\uDCFA Screen</button><button data-m="info" aria-label="How to play">?</button>';
  var pop = null;
  if (!W.qrcode) { var qj = D.createElement('script'); qj.src = me.src.replace(/ztp-playbar\.js.*$/, 'qrcode.js'); (D.head || D.documentElement).appendChild(qj); }
  function qrSvg(u) { if (!W.qrcode) return ''; var q = W.qrcode(0, 'M'); q.addData(u); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  function info() {
    if (pop) { pop.remove(); pop = null; bar.classList.remove('open'); return; }
    pop = D.createElement('div'); pop.id = 'ztppop'; bar.classList.add('open');
    var h = here === 'screen'
      ? '<b>\uD83D\uDCFA Screen mode</b><br>Put this on a TV, monitor or laptop (cast, HDMI, any browser).' +
        (pads ? (function () { var u = joinUrl(); return u ? ' Everyone scans to use their phone as the controller:<div class="qr">' + qrSvg(u) + '</div><small>' + u + '</small>' : ' Phones join with the code / QR the game shows on screen.'; })()
              : ' This game doesn\u2019t have phone controllers yet, so play it right here with mouse, touch or keyboard.')
      : '<b>\uD83D\uDCF1 Phone mode</b><br>Just you on this phone. Tap <b>Screen</b> to put it on a big screen and let friends join with their phones.';
    pop.innerHTML = h + '<div style="margin-top:8px;color:#aaa">The game picks a mode for your device; one tap switches.</div>';
    D.body.appendChild(pop);
  }
  function render() { [].forEach.call(bar.querySelectorAll('[data-m]'), function (b) { b.classList.toggle('on', b.dataset.m === here); }); }
  bar.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; e.stopPropagation(); if (b.dataset.m === 'info') info(); else go(b.dataset.m); });
  function mount() { D.head.appendChild(st); D.body.appendChild(bar); render(); }
  W.ZTPPlaybar = { mode: function () { return here; }, big: big, joinUrl: joinUrl };
  if (D.body) mount(); else D.addEventListener('DOMContentLoaded', mount);
})();
