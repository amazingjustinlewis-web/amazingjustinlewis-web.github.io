/* Cave Cinema v01 - shared Cover Flow carousel (screen + phone).
   Flow.mount(el, { onIndex(i), onPick(i), small }) -> f: f.set(items), f.go(i, silent), f.i
   items: [{ id, t, y, poster }]. Center card crisp; neighbours tilt + fade 70/50/30% then drop off. */
(function (root) {
  'use strict';
  var FADE = [1, .7, .5, .3];          // opacity by distance from center; >3 = hidden
  function css() {
    if (document.getElementById('flowCss')) return;
    var s = document.createElement('style'); s.id = 'flowCss';
    s.textContent = '.flow{position:relative;perspective:1100px;overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none}' +
      '.flow .cd{position:absolute;left:50%;top:50%;aspect-ratio:2/3;border-radius:10px;background:#1a1830 center/cover no-repeat;box-shadow:0 18px 40px #000a;' +
      'transition:transform .55s cubic-bezier(.22,.9,.24,1),opacity .45s ease;will-change:transform,opacity;-webkit-box-reflect:below 4px linear-gradient(transparent 72%,#ffffff22)}' +
      '.flow .cd .nt{position:absolute;inset:auto 0 0 0;padding:10% 8% 8%;font:700 clamp(12px,2.2vh,22px) system-ui;color:#fff;text-align:center;background:linear-gradient(transparent,#000c);border-radius:0 0 10px 10px}' +
      '.flow .cd.hp .nt{display:none}';
    document.head.appendChild(s);
  }
  root.Flow = { mount: function (el, o) {
    css(); el.classList.add('flow'); o = o || {};
    var f = { i: 0, items: [], cards: [] }, H = o.h || '62%';
    function layout() {
      var w = el.clientWidth, ch = el.clientHeight * (parseFloat(H) / 100), cw = ch * 2 / 3, gap = Math.min(cw * .42, w * .11);
      f.cards.forEach(function (c, k) {
        var d = k - f.i, a = Math.abs(d), s = d < 0 ? -1 : 1, z = Math.min(a, 6);
        c.style.height = ch + 'px'; c.style.width = cw + 'px'; c.style.marginLeft = -cw / 2 + 'px'; c.style.marginTop = -ch / 2 + 'px';
        var x = d === 0 ? 0 : s * (cw * .62 + (z - 1) * gap), rot = d === 0 ? 0 : -s * 58, tz = d === 0 ? 120 : -60 - z * 30;
        c.style.transform = 'translateX(' + x + 'px) translateZ(' + tz + 'px) rotateY(' + rot + 'deg)';
        c.style.opacity = a < FADE.length ? FADE[a] : 0; c.style.zIndex = 100 - a; c.style.visibility = a > 5 ? 'hidden' : 'visible';
        c.style.filter = d === 0 ? 'none' : 'brightness(' + (1 - a * .12) + ')';
      });
    }
    f.set = function (items) {
      el.innerHTML = ''; f.items = items; f.cards = items.map(function (m, k) {
        var c = document.createElement('div'); c.className = 'cd' + (m.poster ? ' hp' : '');
        if (m.poster) c.style.backgroundImage = 'url("' + m.poster + '")';
        c.innerHTML = '<div class="nt"></div>'; c.firstChild.textContent = m.t + (m.y ? ' (' + m.y + ')' : '');
        c.onclick = function () { if (moved) return; if (k === f.i) { if (o.onPick) o.onPick(k); } else f.go(k); };
        el.appendChild(c); return c;
      });
      f.i = Math.max(0, Math.min(f.i, items.length - 1)); layout();
    };
    f.go = function (i, silent) { i = Math.max(0, Math.min(f.items.length - 1, i | 0)); if (i === f.i && f.cards.length) { layout(); return; } f.i = i; layout(); if (!silent && o.onIndex) o.onIndex(i); };
    // swipe: drag distance + flick velocity -> steps
    var x0 = null, t0 = 0, i0 = 0, moved = false;
    el.addEventListener('pointerdown', function (e) { x0 = e.clientX; t0 = performance.now(); i0 = f.i; moved = false; });
    el.addEventListener('pointermove', function (e) { if (x0 == null) return; if (Math.abs(x0 - e.clientX) > 10) moved = true; var step = (el.clientWidth * .12) || 80, n = Math.round((x0 - e.clientX) / step); if (i0 + n !== f.i) f.go(i0 + n); });
    function up(e) { if (x0 == null) return; var dx = x0 - e.clientX, dt = performance.now() - t0, v = dx / Math.max(dt, 1); if (dt < 250 && Math.abs(v) > .6) f.go(f.i + Math.round(v * 3)); x0 = null; }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', function () { x0 = null; });
    el.addEventListener('wheel', function (e) { e.preventDefault(); if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 8) f.go(f.i + ((e.deltaX || e.deltaY) > 0 ? 1 : -1)); }, { passive: false });
    addEventListener('resize', layout);
    return f;
  } };
})(window);
