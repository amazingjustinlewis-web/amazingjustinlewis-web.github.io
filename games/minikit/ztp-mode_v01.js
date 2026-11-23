/* ZTP content modes v0.1 (shared minikit). Levels, cleanest first: kid < family < mature.
   A person only has the levels they said YES to (anything not said yes to is a no). Guests / anonymous = family + kid.
   ZTP.sessionMode(players, shop) -> the cleanest mode allowed: min over every player's chosen mode (capped by their yes list) and the venue cap.
     players: [{ mode:'family', yes:['kid','family'] } | null (guest)], shop: { cap:'family' } | 'family' | null.  Mature only if EVERY player said yes AND the venue allows it.
   ZTP.me() -> this device's { mode, yes, known }   ZTP.setMine(mode, yes)   ZTP.venueCap() / ZTP.setVenueCap(m)   ZTP.MODES
   ZTP.session(players, shop) recompute + fire ZTP.onMode(fn(to, from)) listeners, with ZTP.modeTransition(from, to) on screen (no pause).
   ZTP.note(text) small non-blocking toast for gameplay-affecting changes.  Test: ?mode=adult|mature|family|kid sets this device's choice (and yes to it). */
(function (root) {
  'use strict';
  var Z = root.ZTP = root.ZTP || {}, MODES = Z.MODES = ['kid', 'family', 'mature'], rank = function (m) { var r = MODES.indexOf(m); return r < 0 ? 1 : r; };
  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  var qm = (/[?&]mode=(adult|mature|dark|family|kid)\b/.exec(location.search) || [])[1]; if (qm) qm = qm === 'adult' || qm === 'dark' ? 'mature' : qm;
  function known() { var ini = jget('ztp:initials', ''), A = root.Acct; return !!(ini || (A && A.user && A.user())); }
  Z.me = function () { var k = known(), s = jget('ztp:modes', null), yes = k && s && s.yes ? s.yes.filter(function (m) { return MODES.indexOf(m) >= 0; }) : ['kid', 'family'], mode = k && s && s.mode ? s.mode : 'family';
    if (qm) { mode = qm; if (yes.indexOf(qm) < 0) yes = yes.concat([qm]); }
    if (yes.indexOf(mode) < 0) mode = yes.reduce(function (a, m) { return rank(m) > rank(a) && rank(m) <= rank(mode) ? m : a; }, 'kid');
    return { mode: mode, yes: yes, known: k || !!qm }; };
  Z.setMine = function (mode, yes) { if (!known()) return false; yes = (yes || Z.me().yes).filter(function (m) { return MODES.indexOf(m) >= 0; }); if (yes.indexOf(mode) < 0) yes.push(mode); jset('ztp:modes', { mode: mode, yes: yes }); return true; };
  Z.venueCap = function () { return jget('ztp:venueCap', 'mature'); };
  Z.setVenueCap = function (m) { if (MODES.indexOf(m) >= 0) jset('ztp:venueCap', m); };
  function allowed(p) { if (!p) return 'family'; var yes = p.yes || ['kid', 'family'], m = p.mode || 'family', best = null;   // highest level he said yes to that is not above his choice
    MODES.forEach(function (x) { if (yes.indexOf(x) >= 0 && rank(x) <= rank(m)) best = x; }); return best || 'kid'; }
  Z.sessionMode = function (players, shop) { var cap = shop == null ? Z.venueCap() : typeof shop === 'string' ? shop : (shop.cap || 'mature'), r = rank(cap);
    (players && players.length ? players : [Z.me()]).forEach(function (p) { r = Math.min(r, rank(allowed(p))); }); return MODES[r]; };
  var cur = null, L = [];
  Z.mode = function () { return cur || Z.sessionMode(null, null); };
  Z.onMode = function (fn) { L.push(fn); };
  Z.session = function (players, shop) { var to = Z.sessionMode(players, shop), from = cur; cur = to; if (from && from !== to) { Z.modeTransition(from, to); L.forEach(function (f) { try { f(to, from); } catch (e) { console.warn(e); } }); } return to; };
  Z.note = function (t, ms) { var d = document.createElement('div'); d.textContent = t; d.style.cssText = 'position:fixed;left:50%;bottom:9vh;transform:translateX(-50%);z-index:60;background:#0b1020cc;color:#fff;font:600 14px Fredoka,system-ui,sans-serif;padding:7px 14px;border-radius:16px;border:1px solid #fff4;pointer-events:none;transition:opacity .5s;max-width:80vw;text-align:center';
    document.body.appendChild(d); setTimeout(function () { d.style.opacity = 0; }, ms || 2600); setTimeout(function () { d.remove(); }, (ms || 2600) + 600); return d; };
  // live transition overlay (never blocks input, never pauses the game)
  Z.modeTransition = function (from, to, opt) { opt = opt || {}; var T = opt.T || 2600, cv = document.createElement('canvas'), dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:55;pointer-events:none'; document.body.appendChild(cv); var cx = cv.getContext('2d'), w = innerWidth, h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; cx.scale(dpr, dpr);
    var kind = to === 'kid' ? 'candy' : rank(to) < rank(from) ? 'wind' : 'fade', t0 = performance.now(), P = [], i;
    if (kind === 'candy') for (i = 0; i < 26; i++) P.push({ k: i % 3, x: Math.random() * w, y: h + Math.random() * h * .6, s: 18 + Math.random() * 26, v: .12 + Math.random() * .14, ph: Math.random() * 6 });
    else for (i = 0; i < 160; i++) P.push({ y: Math.random() * h, x: -Math.random() * w * .6, v: .9 + Math.random() * .9, a: Math.random() * 6, s: 1 + Math.random() * 2.5 });
    function teddy(x, y, s) { cx.fillStyle = '#b07a4a'; [[-.55, -.55], [.55, -.55]].forEach(function (e) { cx.beginPath(); cx.arc(x + e[0] * s, y + e[1] * s, s * .32, 0, 7); cx.fill(); }); cx.beginPath(); cx.arc(x, y, s * .62, 0, 7); cx.fill(); cx.beginPath(); cx.arc(x, y + s * 1.05, s * .75, 0, 7); cx.fill();
      cx.fillStyle = '#e8c49a'; cx.beginPath(); cx.arc(x, y + s * .18, s * .26, 0, 7); cx.fill(); cx.fillStyle = '#222'; [[-.22, -.12], [.22, -.12]].forEach(function (e) { cx.beginPath(); cx.arc(x + e[0] * s, y + e[1] * s, s * .07, 0, 7); cx.fill(); }); }
    function candy(x, y, s) { cx.strokeStyle = '#d9b48a'; cx.lineWidth = s * .12; cx.beginPath(); cx.moveTo(x, y + s * .4); cx.lineTo(x, y + s * 1.6); cx.stroke(); cx.fillStyle = '#ffb3de'; [[0, 0, .6], [-.4, .15, .42], [.4, .15, .42], [0, -.35, .4]].forEach(function (e) { cx.beginPath(); cx.arc(x + e[0] * s, y + e[1] * s, s * e[2], 0, 7); cx.fill(); }); }
    function gum(x, y, s) { var g = cx.createRadialGradient(x - s * .3, y - s * .3, s * .1, x, y, s); g.addColorStop(0, '#ffe6f4'); g.addColorStop(1, 'rgba(255,105,180,.75)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, s, 0, 7); cx.fill(); }
    (function fr(now) { var u = (now - t0) / T; cx.clearRect(0, 0, w, h); if (u >= 1) { cv.remove(); return; }
      if (kind === 'candy') { cx.fillStyle = 'rgba(255,214,236,' + (Math.sin(u * Math.PI) * .22) + ')'; cx.fillRect(0, 0, w, h); P.forEach(function (p) { var y = p.y - u * (h * 1.7) * (p.v * 6), x = p.x + Math.sin(u * 6 + p.ph) * 24; (p.k === 0 ? teddy : p.k === 1 ? candy : gum)(x, y, p.s); }); }
      else { var wash = kind === 'wind' ? Math.max(0, Math.sin(Math.min(1, (u - .25) / .6) * Math.PI)) * .55 : Math.sin(u * Math.PI) * .25; cx.fillStyle = 'rgba(235,245,255,' + wash + ')'; cx.fillRect(0, 0, w, h);
        P.forEach(function (p) { var x = p.x + u * w * 1.9 * p.v, y = p.y + Math.sin(x / 90 + p.a) * 28; cx.fillStyle = 'rgba(255,' + (230 + (p.a * 4 | 0)) + ',180,' + (.85 * Math.sin(u * Math.PI)) + ')'; cx.beginPath(); cx.arc(x, y, p.s, 0, 7); cx.fill();
          if (p.s > 2.6) { cx.strokeStyle = 'rgba(255,255,255,' + (.35 * Math.sin(u * Math.PI)) + ')'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x - 40, y - Math.sin((x - 40) / 90 + p.a) * 6); cx.quadraticCurveTo(x - 20, y + 8, x, y); cx.stroke(); } }); }
      requestAnimationFrame(fr); })(t0);
    return cv; };
})(window);
