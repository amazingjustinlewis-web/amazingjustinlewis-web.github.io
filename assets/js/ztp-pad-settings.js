/* 0-Phi shared controller settings: a subtle gear in a corner + a tiny panel (stick diagram, southpaw swap, invert look).
   Usage: var pad = ZTPPad.init({ game: 'derby', sticks: { L: 'Steer', R: 'Not used' }, invert: true, invertX: true, canOpen: fn, corner: 'br' });
   pad.read(gamepad) -> { L: [x, y], R: [x, y] }  (swap + inverts applied to the look stick R). pad.isOpen(). pad.opts = { swap, invY, invX }.
   Start/Menu (button 9) toggles the panel; D-pad up/down + A to change, B or Start to close. Saved in localStorage per game. */
(function (root) {
  'use strict';
  var CSS = '.ztpg{position:fixed;z-index:9000;width:34px;height:34px;border-radius:50%;border:0;background:#0006;color:#fff9;font-size:19px;line-height:34px;text-align:center;cursor:pointer;padding:0;opacity:.55;transition:opacity .2s}.ztpg:hover{opacity:1}' +
    '.ztpp{position:fixed;z-index:9001;background:#111a;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;border-radius:14px;padding:14px 16px;font:15px/1.4 Fredoka,system-ui,sans-serif;min-width:250px;box-shadow:0 6px 30px #0008;display:none}' +
    '.ztpp h4{margin:0 0 8px;font-size:15px;font-weight:600;opacity:.8}.ztpp .pd{display:flex;justify-content:space-between;gap:10px;margin:4px 0 10px;font-size:13px}.ztpp .pd div{flex:1;text-align:center;background:#fff1;border-radius:10px;padding:6px 4px}.ztpp .pd b{display:block;font-size:20px;line-height:1}' +
    '.ztpp label{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:8px;cursor:pointer}.ztpp label.f{background:#fff2}.ztpp input{width:18px;height:18px}.ztpp small{display:block;opacity:.55;margin-top:6px;font-size:11px}';
  function init(o) {
    o = o || {}; var key = 'ztp-pad-' + (o.game || 'x'), opts = { swap: false, invY: false, invX: false };
    try { Object.assign(opts, JSON.parse(localStorage.getItem(key) || '{}')); } catch (e) {}
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var c = o.corner || 'br', pos = (c[0] === 't' ? 'top:' : 'bottom:') + '12px;' + (c[1] === 'l' ? 'left:' : 'right:') + '12px;', ppos = (c[0] === 't' ? 'top:' : 'bottom:') + '54px;' + (c[1] === 'l' ? 'left:' : 'right:') + '12px;';
    var gear = document.createElement('button'); gear.className = 'ztpg'; gear.style.cssText = pos; gear.title = 'Controller settings'; gear.innerHTML = '&#9881;';
    var panel = document.createElement('div'); panel.className = 'ztpp'; panel.style.cssText = ppos;
    var rows = [['swap', 'Swap sticks (southpaw)']]; if (o.invert !== false) rows.push(['invY', 'Invert look up/down']); if (o.invertX) rows.push(['invX', 'Invert look left/right']);
    panel.innerHTML = '<h4>Controller</h4><div class="pd"><div><b>&#9673;</b><span data-s="L"></span></div><div><b>&#9673;</b><span data-s="R"></span></div></div>' +
      rows.map(function (r) { return '<label data-k="' + r[0] + '"><input type="checkbox"> ' + r[1] + '</label>'; }).join('') + '<small>Menu button opens this \u00b7 D-pad + A to change \u00b7 B closes</small>';
    document.body.appendChild(gear); document.body.appendChild(panel);
    var open = false, focus = 0, labels = panel.querySelectorAll('label');
    function render() { var L = o.sticks && o.sticks.L || 'Move', R = o.sticks && o.sticks.R || 'Look';
      panel.querySelector('[data-s="L"]').textContent = 'Left stick: ' + (opts.swap ? R : L); panel.querySelector('[data-s="R"]').textContent = 'Right stick: ' + (opts.swap ? L : R);
      labels.forEach(function (l, i) { l.firstChild.checked = !!opts[l.dataset.k]; l.classList.toggle('f', open && i === focus); }); }
    function save() { try { localStorage.setItem(key, JSON.stringify(opts)); } catch (e) {} render(); if (o.onChange) o.onChange(opts); }
    function setOpen(v) { open = v; panel.style.display = v ? 'block' : 'none'; render(); }
    gear.onclick = function () { setOpen(!open); };
    labels.forEach(function (l) { l.firstChild.onchange = function () { opts[l.dataset.k] = l.firstChild.checked; save(); }; });
    var prev = {};
    function poll() {
      var gp = navigator.getGamepads ? navigator.getGamepads() : [];
      for (var i = 0; i < (gp ? gp.length : 0); i++) { var g = gp[i]; if (!g || !g.connected) continue; var p = prev[i] || {}, now = {};
        [0, 1, 9, 12, 13].forEach(function (b) { now[b] = !!(g.buttons[b] && (g.buttons[b].pressed || g.buttons[b].value > 0.5)); });
        var dn = function (b) { return now[b] && !p[b]; };
        if (dn(9) && (!o.canOpen || o.canOpen() || open)) setOpen(!open);
        else if (open) { if (dn(1)) setOpen(false); if (dn(12)) { focus = (focus + labels.length - 1) % labels.length; render(); } if (dn(13)) { focus = (focus + 1) % labels.length; render(); }
          if (dn(0)) { var k = labels[focus].dataset.k; opts[k] = !opts[k]; save(); } }
        prev[i] = now; }
      requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll); render();
    return { opts: opts, isOpen: function () { return open; }, toggle: function () { setOpen(!open); },
      read: function (g) { var a = g.axes || [], L = [a[0] || 0, a[1] || 0], R = [a[2] || 0, a[3] || 0]; if (opts.swap) { var t = L; L = R; R = t; } R = [R[0] * (opts.invX ? -1 : 1), R[1] * (opts.invY ? -1 : 1)]; return { L: L, R: R }; } };
  }
  root.ZTPPad = { init: init };
})(window);
