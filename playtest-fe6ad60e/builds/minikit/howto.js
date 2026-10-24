/* minikit/howto.js - shared phone "How to play": a short cinematic with a ghost finger tapping/swiping on the real controls.
   Data-driven per game:
     HowTo.setup({ game:'bubble', root: el (default body; pass the counter-rotated wrapper if the pad has one), auto: true, ready: fn() (auto-play waits until true, e.g. join card gone),
                   steps: [ { say:'Caption', at: '#sel' | [fx,fy] | fn()->[x,y] (root px),   // where the finger starts
                              to: same forms (optional; makes it a swipe), act:'tap'|'drag'|'flick'|'hold', dur: ms,
                              ghost: {color:'#3fa8ff', icon:'', trail:true},   // optional result sprite that follows the finger
                              fly: {to: <point>, icon:'', ms}                 // optional result: something shoots off at the end (a shot)
                              onMove: function(p, t){}, onEnd: function(){} } ] })   // optional hooks to drive the REAL view (no network side effects!)
   Points: '#sel' = centre of that element, '#sel@0.5,0.2' = fraction inside it, [fx,fy] = fraction of the root, fn = root pixels.
   Skippable (Skip button / tap anywhere after a beat), replayable from a '?' button; auto-plays once per game (localStorage). */
(function (root) {
  'use strict';
  var CSS = '.ht-q{position:fixed;top:8px;right:8px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 18px system-ui;z-index:60;cursor:pointer}' +
    '.ht-l{position:absolute;inset:0;z-index:70;pointer-events:auto;background:rgba(5,8,18,0);transition:background .5s}.ht-l.on{background:rgba(5,8,18,.45)}' +
    '.ht-cap{position:absolute;left:6%;right:6%;top:12%;text-align:center;color:#fff;font:600 22px/1.3 system-ui;text-shadow:0 2px 10px #000;opacity:0;transition:opacity .35s}' +
    '.ht-n{position:absolute;left:0;right:0;top:calc(12% - 22px);text-align:center;color:#9fb3d9;font:600 12px system-ui;letter-spacing:.2em}' +
    '.ht-f{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.85),rgba(255,255,255,.25) 60%,rgba(255,255,255,0) 72%);box-shadow:0 0 18px rgba(255,255,255,.5);transition:transform .12s;pointer-events:none}' +
    '.ht-f:after{content:"\\261D";position:absolute;left:14px;top:20px;font-size:34px;filter:drop-shadow(0 2px 3px #000)}.ht-f.dn{transform:scale(.78)}' +
    '.ht-r{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border:3px solid #fff;border-radius:50%;pointer-events:none;animation:htr .6s ease-out forwards}@keyframes htr{to{transform:scale(3.2);opacity:0}}' +
    '.ht-g{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;pointer-events:none;box-shadow:0 0 14px currentColor;border:5px solid currentColor;font-size:16px;line-height:20px;text-align:center}' +
    '.ht-t{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(255,255,255,.5);pointer-events:none;transition:opacity .6s}' +
    '.ht-s{position:absolute;right:12px;bottom:14px;z-index:2}.ht-s button{font:600 15px system-ui;border:0;border-radius:10px;padding:9px 16px;background:rgba(255,255,255,.18);color:#fff}';
  var G = null;
  function el(tag, cls, par) { var e = document.createElement(tag); if (cls) e.className = cls; if (par) par.appendChild(e); return e; }
  function off(e, rt) { var x = 0, y = 0; while (e && e !== rt) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; if (e && e !== rt && !rt.contains(e)) break; } return [x, y]; }
  function pt(spec, rt) { var W = rt.clientWidth || innerWidth, H = rt.clientHeight || innerHeight;
    if (typeof spec === 'function') return spec(W, H);
    if (Array.isArray(spec)) return [spec[0] * W, spec[1] * H];
    var p = String(spec).split('@'), e = rt.querySelector(p[0]) || document.querySelector(p[0]); if (!e || !e.offsetWidth) return [W / 2, H / 2];
    var o = off(e, rt), f = p[1] ? p[1].split(',').map(Number) : [.5, .5]; return [o[0] + e.offsetWidth * f[0], o[1] + e.offsetHeight * f[1]]; }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  var HowTo = {
    setup: function (cfg) { G = cfg; G.root = cfg.root || document.body; if (!document.getElementById('ht-css')) { var s = el('style'); s.id = 'ht-css'; s.textContent = CSS; document.head.appendChild(s); }
      if (getComputedStyle(G.root).position === 'static') G.root.style.position = 'relative';
      var q = el('button', 'ht-q', G.root); q.textContent = '?'; q.title = 'How to play'; q.setAttribute('aria-label', 'How to play'); q.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); HowTo.play(); }); G.q = q;
      if (cfg.auto !== false && !localStorage.getItem('ht-seen-' + cfg.game)) { var w = setInterval(function () { if (G.layer) return clearInterval(w); if (!cfg.ready || cfg.ready()) { clearInterval(w); setTimeout(function () { if (!G.layer && (!cfg.ready || cfg.ready())) HowTo.play(); }, cfg.delay || 900); } }, 400); }
      return HowTo; },
    playing: function () { return !!(G && G.layer); },
    play: function () { if (!G || G.layer) return; localStorage.setItem('ht-seen-' + G.game, '1');
      var rt = G.root, L = el('div', 'ht-l', rt), cap = el('div', 'ht-cap', L), num = el('div', 'ht-n', L), fg = el('div', 'ht-f', L), sk = el('div', 'ht-s', L), b = el('button', '', sk);
      b.textContent = 'Skip \u203a'; G.layer = L; G.t0 = performance.now(); fg.style.opacity = 0;
      L.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); if (e.target === b || performance.now() - G.t0 > 700) HowTo.stop(); });
      requestAnimationFrame(function () { L.classList.add('on'); });
      var steps = G.steps, i = -1, timers = G.timers = [], raf = null, me = this;
      function later(f, ms) { timers.push(setTimeout(f, ms)); }
      function next() { i++; if (i >= steps.length) { cap.style.opacity = 0; fg.style.opacity = 0; later(function () { HowTo.stop(); }, 500); return; }
        var s = steps[i], a = pt(s.at, rt), z = s.to ? pt(s.to, rt) : a, dur = s.dur || (s.act === 'flick' ? 260 : s.act === 'tap' ? 500 : 1300), ghost = null, trail = [];
        num.textContent = (i + 1) + ' / ' + steps.length; cap.textContent = s.say || ''; cap.style.opacity = 1;
        fg.style.transition = 'left .5s ease,top .5s ease,opacity .3s,transform .12s'; fg.style.left = a[0] + 'px'; fg.style.top = a[1] + 'px'; fg.style.opacity = 1;
        if (s.ghost) { ghost = el('div', 'ht-g', L); ghost.style.color = s.ghost.color || '#fff'; ghost.textContent = s.ghost.icon || ''; ghost.style.left = (s.ghost.from ? pt(s.ghost.from, rt) : a)[0] + 'px'; ghost.style.top = (s.ghost.from ? pt(s.ghost.from, rt) : a)[1] + 'px'; }
        later(function () { fg.style.transition = 'opacity .3s,transform .12s'; fg.classList.add('dn'); var rp = el('div', 'ht-r', L); rp.style.left = a[0] + 'px'; rp.style.top = a[1] + 'px'; later(function () { rp.remove(); }, 700);
          if (navigator.vibrate && G.buzz) navigator.vibrate(10); var t0 = performance.now(), gp = ghost ? [parseFloat(ghost.style.left), parseFloat(ghost.style.top)] : null;
          (function mv() { var t = Math.min(1, (performance.now() - t0) / dur), k = s.act === 'flick' ? t : ease(t), p = [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k];
            if (s.wiggle) p[0] += Math.sin(t * Math.PI * 2 * s.wiggle) * (s.wiggleAmp || 30) * Math.sin(t * Math.PI);
            fg.style.left = p[0] + 'px'; fg.style.top = p[1] + 'px';
            if (ghost) { gp[0] += (p[0] - gp[0]) * .18; gp[1] += (p[1] - gp[1]) * .18; ghost.style.left = gp[0] + 'px'; ghost.style.top = gp[1] + 'px'; }
            if (s.to && s.trail !== false && Math.random() < .6) { var tr = el('div', 'ht-t', L); tr.style.left = p[0] + 'px'; tr.style.top = p[1] + 'px'; trail.push(tr); later(function () { tr.style.opacity = 0; }, 30); later(function () { tr.remove(); }, 700); }
            if (s.onMove) try { s.onMove(p, t); } catch (_) {}
            if (t < 1) raf = G.raf = requestAnimationFrame(mv); else end(); })(); }, 650);
        function end() { fg.classList.remove('dn'); if (s.onEnd) try { s.onEnd(); } catch (_) {}
          if (s.fly) { var fl = el('div', 'ht-g', L), f0 = ghost ? [parseFloat(ghost.style.left), parseFloat(ghost.style.top)] : z, f1 = pt(s.fly.to, rt); fl.style.color = s.fly.color || '#fff'; fl.textContent = s.fly.icon || ''; fl.style.left = f0[0] + 'px'; fl.style.top = f0[1] + 'px'; fl.style.transition = 'left ' + (s.fly.ms || 450) + 'ms ease-out,top ' + (s.fly.ms || 450) + 'ms ease-out,opacity .4s'; requestAnimationFrame(function () { requestAnimationFrame(function () { fl.style.left = f1[0] + 'px'; fl.style.top = f1[1] + 'px'; }); }); later(function () { fl.style.opacity = 0; }, (s.fly.ms || 450) + 250); later(function () { fl.remove(); }, (s.fly.ms || 450) + 700); }
          later(function () { if (ghost) { ghost.style.transition = 'opacity .4s'; ghost.style.opacity = 0; later(function () { ghost.remove(); }, 450); } cap.style.opacity = 0; fg.style.opacity = 0; later(next, 380); }, s.hold || 900); } }
      later(next, 350); },
    stop: function () { if (!G || !G.layer) return; (G.timers || []).forEach(clearTimeout); cancelAnimationFrame(G.raf); var L = G.layer; G.layer = null; L.classList.remove('on'); L.style.pointerEvents = 'none'; L.style.transition = 'opacity .35s,background .35s'; L.style.opacity = 0; setTimeout(function () { L.remove(); }, 400);
      G.steps.forEach(function (s) { if (s.onEnd) try { s.onEnd(); } catch (_) {} }); if (G.onDone) G.onDone(); }
  };
  root.HowTo = HowTo;
})(window);
