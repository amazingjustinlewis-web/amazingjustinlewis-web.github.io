/* 0-Phi phone prototype helpers v01 (dev). Shared by Mini Golf, Golf and Derby Drive.
   Proto.menu(items) -> tucked-away ☰ panel. items: [{label, type:'toggle'|'button'|'select', get, set, options}]
   Proto.hud(html) top-centre status line.   Proto.toast(t)   Proto.finish(game, {score,label,title,sub})
   Uses Acct (ztp-account_v01.js) for the guest/initials chip + score posting, ZTP (ztp-mode_v01.js) for content mode. */
(function (root) {
  'use strict';
  var P = root.Proto = {};
  var css = '#pMenuB{position:fixed;right:10px;top:10px;z-index:58;width:42px;height:42px;border-radius:12px;border:1px solid #fff4;background:#0c1226cc;color:#fff;font:700 22px system-ui}' +
    '#pMenu{position:fixed;right:10px;top:58px;z-index:59;min-width:220px;max-width:80vw;background:#0c1226f2;color:#fff;border:1px solid #5ef2c8aa;border-radius:14px;padding:10px;font:15px system-ui,sans-serif;display:none}' +
    '#pMenu .r{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid #fff1}#pMenu button,#pMenu select{font:600 14px system-ui;border-radius:8px;border:1px solid #fff4;background:#ffffff1a;color:#fff;padding:6px 10px}' +
    '#pMenu button.on{background:#5ef2c8;color:#082}#pHud{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:57;background:#0008;color:#fff;border-radius:12px;padding:5px 12px;font:600 14px system-ui;pointer-events:none;white-space:nowrap}' +
    '#pToast{position:fixed;left:50%;top:22vh;transform:translateX(-50%);z-index:60;color:#fff;font:800 clamp(22px,6vw,44px) system-ui;text-shadow:0 3px 10px #000;pointer-events:none;transition:opacity .4s;opacity:0;text-align:center}';
  function el(t, id) { var e = document.createElement(t); if (id) e.id = id; document.body.appendChild(e); return e; }
  P.init = function () { var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    if (root.Acct) Acct.phoneChip({ top: 10, profile: '../profile_v01.html' });
    P.mode = root.ZTP ? ZTP.session(null, null) : 'family'; return P.mode; };
  P.menu = function (items) { var b = el('button', 'pMenuB'), m = el('div', 'pMenu'); b.textContent = '\u2630';
    b.onclick = function () { m.style.display = m.style.display === 'block' ? 'none' : 'block'; draw(); };
    function draw() { m.innerHTML = ''; items.forEach(function (it) { var r = document.createElement('div'); r.className = 'r'; r.innerHTML = '<span>' + it.label + '</span>'; var c;
      if (it.type === 'toggle') { c = document.createElement('button'); var v = it.get(); c.textContent = v ? 'On' : 'Off'; if (v) c.className = 'on'; c.onclick = function () { it.set(!it.get()); draw(); }; }
      else if (it.type === 'select') { c = document.createElement('select'); it.options.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; c.appendChild(op); }); c.value = it.get(); c.onchange = function () { it.set(c.value); }; }
      else { c = document.createElement('button'); c.textContent = it.btn || 'Go'; c.onclick = function () { m.style.display = 'none'; it.set(); }; }
      r.appendChild(c); m.appendChild(r); }); }
    return { close: function () { m.style.display = 'none'; } }; };
  var hud, toast, tt; P.hud = function (h) { if (!hud) hud = el('div', 'pHud'); hud.innerHTML = h; };
  P.toast = function (t, ms) { if (!toast) toast = el('div', 'pToast'); toast.innerHTML = t; toast.style.opacity = 1; clearTimeout(tt); tt = setTimeout(function () { toast.style.opacity = 0; }, ms || 1600); };
  P.finish = function (game, o) { if (!root.Acct) return; Acct.endPrompt({ title: o.title, sub: o.sub, wait: 25, post: function (name) { return Acct.submit(game, { score: o.score, label: o.label, name: name }); } }); };
  P.headless = /[?&]shot\b/.test(location.search);
})(window);
