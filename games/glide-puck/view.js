/* GLIDE PUCK phone view: draws the table in this seat's own frame with three camera styles.
   radar: your half fills the screen width at the bottom; above it a ping shows the puck on their side (grows as it comes).
   auto: zooms out to the whole table while the puck is on their side, back in to your half as it heads home.
   follow: zoomed in, soft-scrolls with the puck; when it heads home a spring brings the camera back so your half is
   fully in view before the puck is 20% into your side. */
(function (root) {
  var C = root.Puck.C;
  function View(cv) { this.cv = cv; this.mode = localStorage.getItem('gp-cam') || 'auto'; this.cx = .5; this.cy = .54; this.s = 0; this.zoom = 1; }
  View.prototype.frame = function (st, seat) { // to own frame
    var f = function (x, y) { return seat === 1 ? [1 - x, 2 - y] : [x, y]; }, p = f(st.p[0], st.p[1]);
    return { p: p, pv: seat === 1 ? [-st.p[2], -st.p[3]] : [st.p[2], st.p[3]], me: f(st.m[seat][0], st.m[seat][1]), them: f(st.m[1 - seat][0], st.m[1 - seat][1]) };
  };
  View.prototype.update = function (st, seat, dt) {
    var W = this.cv.clientWidth, H = this.cv.clientHeight, F = this.frame(st, seat), Z = 1 / 1.15, sOut = Math.min(W / 1.06, H / 2.12) * Z, sIn = Math.max(sOut, Math.min(H / 1.1, W / .62) * Z), k = 1 - Math.exp(-dt * 5);
    var home = F.pv[1] < -.05 || F.p[1] < 1, ts, tcx, tcy;
    // goal celebration: fly in to the goal that was scored on, then hard-cut back
    if (st.cel > 0) { var gy = (st.cw === seat) ? 2 : 0, cs = Math.min(W / .7, H / .9), kk = 1 - Math.exp(-dt * 4); this.celOn = true; this.s += (cs - this.s) * kk; this.cx += (.5 - this.cx) * kk; this.cy += (gy + (gy ? -.25 : .25) - this.cy) * kk; this.F = F; return; }
    var cut = this.celOn; this.celOn = false;
    if (this.mode === 'radar') { ts = W / 1.06 * Z; tcx = .5; tcy = H / 2 / ts - .03; }   // own goal line just above the bottom edge
    else if (this.mode === 'auto') {
      // 1) precise framing. In: your half (bottom just below your goal). Out: far top edge of the board in view, reached
      //    half by zooming out and half by shifting up.
      var vIn = H / sIn, bIn = -.02, need = Math.max(0, 2.03 - (bIn + vIn)) / 2, vOut = vIn + need, bOut = bIn + need;
      // 2) openness = how far the puck is into their half; leaky integrator: fills gently, drains faster, settles at equilibrium
      var o = Math.max(0, Math.min(1, (F.p[1] - .85) / .4)); if (F.pv[1] < -.4) o *= .4;
      this.lvl = this.lvl == null ? o : this.lvl; this.lvl += (o - this.lvl) * (o > this.lvl ? 1.4 : 4) * dt;
      var v = vIn + (vOut - vIn) * this.lvl, b = bIn + (bOut - bIn) * this.lvl;
      // average puck + paddle sideways so the frame never jerks
      this.ax = this.ax == null ? .5 : this.ax + ((F.p[0] + F.me[0]) / 2 - this.ax) * (1 - Math.exp(-dt * 2.5));
      ts = H / v; tcy = b + v / 2; tcx = this.ax;
      // 3) soft critically damped spring on top
      var K = 30, D = 2 * Math.sqrt(K), sp = this.sp || (this.sp = { s: [ts, 0], x: [tcx, 0], y: [tcy, 0] }); if (cut) { sp.s = [ts, 0]; sp.x = [tcx, 0]; sp.y = [tcy, 0]; }
      [['s', ts], ['x', tcx], ['y', tcy]].forEach(function (q) { var a = sp[q[0]]; a[1] += (K * (q[1] - a[0]) - D * a[1]) * dt; a[0] += a[1] * dt; });
      this.s = sp.s[0]; this.cx = sp.x[0]; this.cy = sp.y[0]; this.clampX(W); this.F = F; return;
    }
    else { ts = sIn; var hv = H / 2 / ts, homeCy = hv - .02; tcx = F.p[0]; tcy = home ? homeCy : Math.max(homeCy, F.p[1]); var sk = home ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 3);
      if (cut) this.cy = tcy; this.s = ts; this.cy += (tcy - this.cy) * sk; if (home) this.cy = Math.min(this.cy, homeCy + Math.max(0, F.p[1] - .8)); this.cx += (tcx - this.cx) * (1 - Math.exp(-dt * 6)); this.clampX(W); this.F = F; return; }
    this.s = this.s && !cut ? this.s + (ts - this.s) * k : ts; this.cx += (tcx - this.cx) * k; this.cy += (tcy - this.cy) * k; this.clampX(W); this.F = F;
  };
  View.prototype.clampX = function (W) { var hw = W / 2 / this.s; if (hw >= .53) this.cx = .5; else this.cx = Math.max(hw - .03, Math.min(1.03 - hw, this.cx)); };
  View.prototype.toScr = function (x, y) { var W = this.cv.clientWidth, H = this.cv.clientHeight; return [W / 2 + (x - this.cx) * this.s, H / 2 - (y - this.cy) * this.s]; };
  View.prototype.toTable = function (sx, sy) { var W = this.cv.clientWidth, H = this.cv.clientHeight; return [(sx - W / 2) / this.s + this.cx, (H / 2 - sy) / this.s + this.cy]; };
  View.prototype.draw = function (ctx, st, seat, colors, t) {
    var W = this.cv.clientWidth, H = this.cv.clientHeight, F = this.F, self = this, S = function (x, y) { return self.toScr(x, y); }, s = this.s;
    ctx.fillStyle = '#0c1226'; ctx.fillRect(0, 0, W, H);
    var radar = this.mode === 'radar', top = radar ? 1 : 2, a = S(0, top), b = S(1, 0);
    ctx.fillStyle = '#2b3a6e'; ctx.fillRect(a[0] - .03 * s, a[1] - (radar ? 0 : .03 * s), b[0] - a[0] + .06 * s, b[1] - a[1] + .03 * s + (radar ? 0 : .03 * s));
    ctx.fillStyle = '#e8f2ff'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    ctx.strokeStyle = '#ff5a6e88'; ctx.lineWidth = Math.max(2, s * .008); var c = S(.5, 1); ctx.beginPath(); ctx.moveTo(a[0], c[1]); ctx.lineTo(b[0], c[1]); ctx.stroke();
    ctx.beginPath(); ctx.arc(c[0], c[1], .16 * s, radar ? Math.PI : 0, radar ? 2 * Math.PI : 7); ctx.stroke();
    ctx.strokeStyle = '#3aa8ff66'; [0, 2].forEach(function (y) { if (radar && y === 2) return; var g = S(.5, y); ctx.beginPath(); ctx.arc(g[0], g[1], .2 * s, y ? 0 : Math.PI, y ? Math.PI : 2 * Math.PI); ctx.stroke(); });
    ctx.fillStyle = '#111'; [0, 2].forEach(function (y) { if (radar && y === 2) return; var g0 = S(.5 - C.GOAL / 2, y), g1 = S(.5 + C.GOAL / 2, y); ctx.fillRect(g0[0], g0[1] - (y ? .025 * s : 0), g1[0] - g0[0], .025 * s); });
    function disc(x, y, r, col, ring, hop) { var q = S(x, y); if (hop) { ctx.beginPath(); ctx.ellipse(q[0], q[1], r * s * (1 - hop * .3), r * s * (1 - hop * .3) * .6, 0, 0, 7); ctx.fillStyle = '#0003'; ctx.fill(); q = [q[0], q[1] - hop * r * s * 1.6]; } ctx.beginPath(); ctx.arc(q[0], q[1] + r * s * .12, r * s, 0, 7); ctx.fillStyle = '#0003'; ctx.fill(); ctx.beginPath(); ctx.arc(q[0], q[1], r * s, 0, 7); ctx.fillStyle = col; ctx.fill(); if (ring) { ctx.beginPath(); ctx.arc(q[0], q[1], r * s * .45, 0, 7); ctx.fillStyle = '#fff6'; ctx.fill(); } }
    var me = F.me, them = F.them, hp = null;
    if (st.cel > 0) { hp = celPos(st, t); var o = seat === 1 ? [1 - hp[0], 2 - hp[1]] : [hp[0], hp[1]]; if (st.cw === seat) me = o; else them = o; }   // scorer hops by the goal it beat
    if (!radar || them[1] < 1 || hp) disc(them[0], them[1], C.MR, colors[1 - seat] || '#888', true, hp && st.cw !== seat ? hp[2] : 0);
    disc(me[0], me[1], C.MR, colors[seat] || '#fc3', true, hp && st.cw === seat ? hp[2] : 0);
    if (!hp && (!radar || F.p[1] < 1 + C.PR)) { if (st.drop > 0) dropDisc(F.p[0], F.p[1]); else disc(F.p[0], F.p[1], C.PR, '#1b1b2a'); }
    function dropDisc(x, y) { var q = S(x, y), k = st.drop / .7, r = C.PR * s * (1 + k * 2.2); ctx.beginPath(); ctx.arc(q[0], q[1], C.PR * s * (1 - k * .4), 0, 7); ctx.fillStyle = 'rgba(0,0,0,' + (.35 * (1 - k)) + ')'; ctx.fill(); ctx.globalAlpha = 1 - k * .5; ctx.beginPath(); ctx.arc(q[0], q[1] - k * k * .25 * s, r, 0, 7); ctx.fillStyle = '#1b1b2a'; ctx.fill(); ctx.globalAlpha = 1; }
    if (radar) {   // the ping
      ctx.fillStyle = '#0c1226'; ctx.fillRect(0, 0, W, c[1] - 1); ctx.strokeStyle = '#5fdc7a33'; ctx.lineWidth = 1; for (var i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(W / 2, c[1], i * (c[1] / 4), Math.PI, 2 * Math.PI); ctx.stroke(); }
      if (F.p[1] > 1) { var far = Math.min(1, (F.p[1] - 1) / 1), x = S(F.p[0], 1)[0], r = (1 - far) * .085 * s + .02 * s, y = c[1] - (far * .85 + .08) * (c[1] - 20);
        var pul = (t * 1.6) % 1; ctx.beginPath(); ctx.arc(x, y, r * (1 + pul), 0, 7); ctx.strokeStyle = 'rgba(95,220,122,' + (1 - pul) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = F.pv[1] < 0 ? '#ff5a6e' : '#5fdc7a'; ctx.fill(); }
    }
  };
  // celebrating paddle: world coords (seat-0 frame) circling in front of the beaten goal, plus hop 0..1
  function celPos(st, t) { var a = t * 3.2, x = .5 + Math.sin(a) * .22, d = .24 + Math.cos(a * .5) * .06, gy = st.cw === 0 ? 2 : 0; return [x, gy ? 2 - d : d, Math.abs(Math.sin(t * 9))]; }
  root.PuckCel = celPos;
  // effects: subtle hit ring, flames when ahead by 3 (fully on fire at 6), fireworks on goals. map(x, y) -> screen in table coords
  function FX() { this.parts = []; this.hits = null; this.sc = null; this.banner = 0; this.who = -1; }
  FX.prototype.run = function (ctx, st, map, s, W, H, colors, dt) {
    var P = this.parts, self = this;
    if (this.hits != null && st.hits > this.hits) { var q = map(st.p[0], st.p[1]); P.push({ ring: 1, x: q[0], y: q[1], r: s * .05, l: 1 }); }
    this.hits = st.hits;
    if (this.sc && (st.sc[0] > this.sc[0] || st.sc[1] > this.sc[1])) { this.who = st.sc[0] > this.sc[0] ? 0 : 1; this.banner = 2.2;
      for (var b = 0; b < 5; b++) { var cx = W * (.15 + Math.random() * .7), cy = H * (.15 + Math.random() * .5), col = b % 2 ? '#ffe7a0' : colors[this.who]; for (var i = 0; i < 40; i++) { var a = Math.random() * 7, v = 80 + Math.random() * 260; P.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1 + Math.random() * .6, c: col, d: b * .18 }); } } }
    this.sc = st.sc.slice();
    var lead = st.sc[0] - st.sc[1];
    [0, 1].forEach(function (i) { var up = i === 0 ? lead : -lead; if (up < 3) return; var full = up >= 6, q = map(st.m[i][0], st.m[i][1]), r = .07 * s;
      for (var k = 0; k < (full ? 6 : 2); k++) { var a = Math.random() * 7; P.push({ fl: 1, x: q[0] + Math.cos(a) * r * (full ? 1 : .8), y: q[1] + Math.sin(a) * r * (full ? 1 : .8), vx: (Math.random() - .5) * 30, vy: -40 - Math.random() * (full ? 120 : 50), l: full ? .7 : .45, sz: r * (full ? .5 : .28) }); }
      if (full) { var g = ctx.createRadialGradient(q[0], q[1], r * .5, q[0], q[1], r * 2.2); g.addColorStop(0, '#ff8a0088'); g.addColorStop(1, '#ff8a0000'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], r * 2.2, 0, 7); ctx.fill(); } });
    this.parts = P.filter(function (p) {
      if (p.d > 0) { p.d -= dt; return true; } p.l -= dt * (p.ring ? 3 : p.fl ? 1.6 : .7); if (p.l <= 0) return false;
      if (p.ring) { ctx.strokeStyle = 'rgba(255,255,255,' + (p.l * .5) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - p.l), 0, 7); ctx.stroke(); return true; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (!p.fl) p.vy += 120 * dt;
      if (p.fl) { ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.l > .3 ? '#ffd23f' : '#ff5a1a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (.5 + p.l), 0, 7); ctx.fill(); }
      else { ctx.globalAlpha = Math.min(1, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 4); }
      ctx.globalAlpha = 1; return true; });
    if (this.banner > 0) { this.banner -= dt; var k = Math.min(1, this.banner), z = 1 + Math.max(0, this.banner - 1.8) * 2; ctx.globalAlpha = k; ctx.font = '700 ' + Math.round(Math.min(W, H) * .16 * z) + 'px Fredoka,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = '#000a'; ctx.strokeText('GOAL!', W / 2, H * .42); ctx.fillStyle = colors[this.who]; ctx.fillText('GOAL!', W / 2, H * .42); ctx.globalAlpha = 1; ctx.textAlign = 'left'; }
  };
  root.PuckFX = FX;
  root.PuckView = View;
})(window);
