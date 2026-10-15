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
    var W = this.cv.clientWidth, H = this.cv.clientHeight, F = this.frame(st, seat), sOut = Math.min(W / 1.06, H / 2.12), sIn = Math.max(sOut, Math.min(H / 1.1, W / .62)), k = 1 - Math.exp(-dt * 5);
    var home = F.pv[1] < -.05 || F.p[1] < 1, ts, tcx, tcy;
    if (this.mode === 'radar') { ts = W / 1.06; tcx = .5; tcy = H / 2 / ts - .03; }   // own goal line just above the bottom edge
    else if (this.mode === 'auto') { var z = home ? 1 : 0; this.zoom += (z - this.zoom) * (1 - Math.exp(-dt * (home ? 4 : 2))); ts = sOut + (sIn - sOut) * this.zoom; tcy = (1 - this.zoom) * 1 + this.zoom * (H / 2 / ts - .02); tcx = .5 + (F.p[0] - .5) * this.zoom * .6; }
    else { ts = sIn; var hv = H / 2 / ts, homeCy = hv - .02; tcx = F.p[0]; tcy = home ? homeCy : Math.max(homeCy, F.p[1]); var sk = home ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 3);
      this.s = ts; this.cy += (tcy - this.cy) * sk; if (home) this.cy = Math.min(this.cy, homeCy + Math.max(0, F.p[1] - .8)); this.cx += (tcx - this.cx) * (1 - Math.exp(-dt * 6)); this.clampX(W); this.F = F; return; }
    this.s = this.s ? this.s + (ts - this.s) * k : ts; this.cx += (tcx - this.cx) * k; this.cy += (tcy - this.cy) * k; this.clampX(W); this.F = F;
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
    function disc(x, y, r, col, ring) { var q = S(x, y); ctx.beginPath(); ctx.arc(q[0], q[1] + r * s * .12, r * s, 0, 7); ctx.fillStyle = '#0003'; ctx.fill(); ctx.beginPath(); ctx.arc(q[0], q[1], r * s, 0, 7); ctx.fillStyle = col; ctx.fill(); if (ring) { ctx.beginPath(); ctx.arc(q[0], q[1], r * s * .45, 0, 7); ctx.fillStyle = '#fff6'; ctx.fill(); } }
    if (!radar || F.them[1] < 1) disc(F.them[0], F.them[1], C.MR, colors[1 - seat] || '#888', true);
    disc(F.me[0], F.me[1], C.MR, colors[seat] || '#fc3', true);
    if (!radar || F.p[1] < 1 + C.PR) disc(F.p[0], F.p[1], C.PR, '#1b1b2a');
    if (radar) {   // the ping
      ctx.fillStyle = '#0c1226'; ctx.fillRect(0, 0, W, c[1] - 1); ctx.strokeStyle = '#5fdc7a33'; ctx.lineWidth = 1; for (var i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(W / 2, c[1], i * (c[1] / 4), Math.PI, 2 * Math.PI); ctx.stroke(); }
      if (F.p[1] > 1) { var far = Math.min(1, (F.p[1] - 1) / 1), x = S(F.p[0], 1)[0], r = (1 - far) * .085 * s + .02 * s, y = c[1] - (far * .85 + .08) * (c[1] - 20);
        var pul = (t * 1.6) % 1; ctx.beginPath(); ctx.arc(x, y, r * (1 + pul), 0, 7); ctx.strokeStyle = 'rgba(95,220,122,' + (1 - pul) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = F.pv[1] < 0 ? '#ff5a6e' : '#5fdc7a'; ctx.fill(); }
    }
  };
  root.PuckView = View;
})(window);
