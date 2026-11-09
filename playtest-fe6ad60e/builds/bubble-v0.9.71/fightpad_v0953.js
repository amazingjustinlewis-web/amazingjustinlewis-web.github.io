/* BUBBLE HOCKEY v0.9.53 radial fight pad (phone). Full-screen: the thumb's ANGLE from the screen centre picks the move (small dead zone in the middle).
   Opponent's side (half facing him): attack high / grab / attack low. Own side: dodge high / escape / dodge low. Wedges flip with getOpSide() (v0.9.47 logic).
   Thin straight-up / straight-down slices are reserved (inactive placeholders, RPAD.res). Defend wedges are held: {a, h:1} on press, {a:'up'} on release.
   Hit feedback: navigator.vibrate + wedge flash. BubbleFightPad(getSt, getTeam, send, getOpSide) -- same API as v0.9.47. */
(function (root) {
  'use strict';
  var RPAD = root.RPAD = { dead: .09, res: 12, slice: 50 };   // dead zone (fraction of min(w,h)), reserved half-width at top/bottom (deg), wedge span (deg)
  var W6 = [ // ang = deg from "toward opponent" (0), + = up
    { a: 'hi', ang: 34, op: 1, c: '224,67,61', t: 'ATTACK\nHIGH' }, { a: 'grab', ang: 0, op: 1, c: '217,138,31', t: 'GRAB' }, { a: 'lo', ang: -34, op: 1, c: '224,67,61', t: 'ATTACK\nLOW' },
    { a: 'dh', ang: 34, op: 0, c: '47,127,224', t: 'DODGE\nHIGH' }, { a: 'esc', ang: 0, op: 0, c: '63,176,106', t: 'ESCAPE' }, { a: 'dl', ang: -34, op: 0, c: '47,127,224', t: 'DODGE\nLOW' }];
  root.BubbleFightPad = function (getSt, getTeam, send, getOpSide) {
    var el = document.createElement('canvas'); el.id = 'ftpad'; el.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:12;display:none;touch-action:none';
    document.body.appendChild(el); var cx = el.getContext('2d'), sd = 1, flash = {}, held = {}, lastHit = '', labs = { esc: 'ESCAPE', grab: 'GRAB' };
    function wedgeAt(x, y) { var w = el.clientWidth, h = el.clientHeight, dx = x - w / 2, dy = h / 2 - y; if (Math.hypot(dx, dy) < RPAD.dead * Math.min(w, h)) return null;
      var deg = Math.atan2(dy, dx) * 180 / Math.PI; if (Math.abs(Math.abs(deg) - 90) < RPAD.res) return null;   // reserved up / down slices
      var op = (dx * sd) > 0, rel = op ? (sd > 0 ? deg : 180 - deg) : (sd > 0 ? 180 - deg : deg); rel = ((rel + 540) % 360) - 180; var r = rel > 17 ? 34 : rel < -17 ? -34 : 0;
      for (var i = 0; i < 6; i++) if (W6[i].op === (op ? 1 : 0) && W6[i].ang === r) return W6[i]; return null; }
    function draw() { var dpr = Math.min(2, root.devicePixelRatio || 1), w = el.clientWidth, h = el.clientHeight; if (el.width !== Math.round(w * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h); var X = w / 2, Y = h / 2, R = Math.hypot(w, h) / 2, now = performance.now();
      W6.forEach(function (q) { var dir = q.op ? sd : -sd, base = dir > 0 ? 0 : 180, mid = (dir > 0 ? q.ang : -q.ang) + base, lim = 90 - RPAD.res, a0 = mid - 17, a1 = mid + 17;
        // clip to keep the up/down reserved slices clear
        var f = flash[q.a] && now - flash[q.a] < 220 ? 1 - (now - flash[q.a]) / 220 : 0, hd = held[q.a] ? .25 : 0, al = .30 + f * .5 + hd;
        var g = cx.createRadialGradient(X, Y, RPAD.dead * Math.min(w, h), X, Y, R); g.addColorStop(0, 'rgba(' + q.c + ',0)'); g.addColorStop(.45, 'rgba(' + q.c + ',' + (al * .55) + ')'); g.addColorStop(1, 'rgba(' + q.c + ',' + al + ')');
        cx.beginPath(); cx.moveTo(X, Y); for (var d = a0; d <= a1 + .01; d += 2) { var dd = Math.max(-lim, Math.min(lim, ((d + 540) % 360) - 180 > 90 || ((d + 540) % 360) - 180 < -90 ? 0 : 0)); var rr = d * Math.PI / 180; cx.lineTo(X + Math.cos(rr) * R, Y - Math.sin(rr) * R); }
        cx.closePath(); cx.fillStyle = g; cx.fill(); cx.strokeStyle = 'rgba(255,255,255,.18)'; cx.lineWidth = 1; cx.stroke();
        var lr = Math.min(w, h) * .36, mr = mid * Math.PI / 180, lx = X + Math.cos(mr) * lr * (Math.abs(Math.cos(mr)) > .5 ? 1.05 : 1), ly = Y - Math.sin(mr) * lr * 1.25;
        cx.fillStyle = 'rgba(255,255,255,' + (.55 + f * .45) + ')'; cx.font = '700 ' + Math.round(Math.min(w, h) * .045) + 'px Fredoka,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 4;
        (labs[q.a] || q.t).split('\n').forEach(function (s, k, A) { cx.fillText(s, lx, ly + (k - (A.length - 1) / 2) * Math.min(w, h) * .05); }); cx.shadowBlur = 0; });
      [90, -90].forEach(function (d) { var r0 = (d - RPAD.res) * Math.PI / 180, r1 = (d + RPAD.res) * Math.PI / 180; cx.beginPath(); cx.moveTo(X, Y); cx.lineTo(X + Math.cos(r0) * R, Y - Math.sin(r0) * R); cx.lineTo(X + Math.cos(r1) * R, Y - Math.sin(r1) * R); cx.closePath(); cx.fillStyle = 'rgba(255,255,255,.04)'; cx.fill(); });
      cx.beginPath(); cx.arc(X, Y, RPAD.dead * Math.min(w, h), 0, 7); cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.stroke(); }
    var act = {};
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); var q = wedgeAt(e.clientX, e.clientY); if (!q) return; act[e.pointerId] = q; var hold = !q.op;
      send(hold ? { t: 'fight', a: q.a, h: 1 } : { t: 'fight', a: q.a }); if (hold) held[q.a] = 1; flash[q.a] = performance.now(); if (navigator.vibrate) navigator.vibrate(12); });
    function up(e) { var q = act[e.pointerId]; delete act[e.pointerId]; if (q && !q.op) { delete held[q.a]; send({ t: 'fight', a: 'up' }); } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    (function tick() { var st = getSt(), F = st && st.ft, tm = getTeam(), B = root.Bubble, mine = F && B && (B.TR[F.a].t === tm || B.TR[F.b].t === tm), on = !!(mine && F.ph !== 'end');
      el.style.display = on ? 'block' : 'none';
      if (on) { var s = B.TR[F.a].t === tm ? 0 : 1, me = s ? F.b : F.a, op = s ? F.a : F.b; labs.esc = F.gr === op ? 'PULL\nAWAY' : 'ESCAPE'; labs.grab = F.gr === me ? 'PUNCH' : 'GRAB';
        if (getOpSide) { var o = getOpSide(s); if (o) sd = o; }
        var hk = (F.res || '') + ':' + (F.rs != null ? F.rs : '') + ':' + (F.rn || 0); if (hk !== lastHit && F.res && /^hit|graze/.test(F.res)) { lastHit = hk; var mineHit = F.rs === s; flash[mineHit ? 'hi' : 'esc'] = performance.now(); if (navigator.vibrate) navigator.vibrate(mineHit ? [30, 20, 30] : 60); } else lastHit = hk;
        draw(); }
      requestAnimationFrame(tick); })();
    el.RPAD = RPAD; el.wedgeAt = wedgeAt; root.BH_PAD = { setSide: function (v) { getOpSide = function () { return v; }; }, wedgeAt: wedgeAt };
    return el; };
})(window);
