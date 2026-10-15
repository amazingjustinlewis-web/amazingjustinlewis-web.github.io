/* BUBBLE HOCKEY v0.1 - minimalist top-down table. view(team) puts that team's goal at the bottom of the screen. */
(function (root) {
  'use strict';
  var B = root.Bubble, COL = ['#ff5a6e', '#3aa8ff'];
  function View() { this.team = 0; this.s = 1; this.ox = 0; this.oy = 0; this.fit(innerWidth, innerHeight, 0); }
  View.prototype.fit = function (W, H, top) { top = top || 0; this.s = Math.min(W * .94, (H - top) * .94 / B.L); this.ox = W / 2 - this.s / 2; this.oy = top + (H - top) / 2 - this.s * B.L / 2; };
  View.prototype.w2s = function (x, y) { if (this.team) { x = 1 - x; y = B.L - y; } return [this.ox + x * this.s, this.oy + y * this.s]; };
  View.prototype.s2w = function (X, Y) { var x = (X - this.ox) / this.s, y = (Y - this.oy) / this.s; return this.team ? [1 - x, B.L - y] : [x, y]; };
  View.prototype.draw = function (c, st, o) {
    o = o || {}; var me = this, s = this.s, L = B.L, P = function (x, y) { return me.w2s(x, y); };
    var a = P(0, 0), b = P(1, L), x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]);
    c.fillStyle = '#16203a'; rr(c, x0 - s * .03, y0 - s * .03, s * 1.06, s * (L + .06), s * .12); c.fill();
    c.fillStyle = '#eef4fb'; rr(c, x0, y0, s, s * L, s * .1); c.fill();
    c.lineWidth = Math.max(2, s * .006); c.strokeStyle = '#ff5a6e66'; line(c, P(0, L / 2), P(1, L / 2)); c.strokeStyle = '#3aa8ff55'; line(c, P(0, .62), P(1, .62)); line(c, P(0, L - .62), P(1, L - .62));
    c.strokeStyle = '#ff5a6e44'; line(c, P(0, B.GY), P(1, B.GY)); line(c, P(0, L - B.GY), P(1, L - B.GY));
    var m = P(.5, L / 2); c.beginPath(); c.arc(m[0], m[1], s * .1, 0, 7); c.stroke();
    // nets
    [[B.GY, -1], [L - B.GY, 1]].forEach(function (g) { var p1 = P(.5 - B.GW, g[0]), p2 = P(.5 + B.GW, g[0] + g[1] * .045); c.fillStyle = '#c9d4e3'; c.fillRect(Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1])); c.strokeStyle = '#ff5a6e'; c.strokeRect(Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1])); });
    // tracks (slots in the table)
    c.lineCap = 'round'; B.TR.forEach(function (tr) { c.strokeStyle = '#0b12241f'; c.lineWidth = s * .016; line(c, P(tr.a[0], tr.a[1]), P(tr.b[0], tr.b[1])); });
    // players
    for (var i = 0; i < 12; i++) { var tr = B.TR[i], q = B.pos(tr, st.u[i]), Q = P(q[0], q[1]), t = tr.t, fy = (t ? 1 : -1) * (this.team ? -1 : 1), r = B.R * s;
      c.fillStyle = '#0002'; c.beginPath(); c.ellipse(Q[0] + r * .15, Q[1] + r * .2, r, r, 0, 0, 7); c.fill();
      c.strokeStyle = '#2a2f3a'; c.lineWidth = r * .22; line(c, [Q[0] + r * .5, Q[1] + fy * r * .3], [Q[0] + r * .35, Q[1] + fy * r * 1.25]);
      c.fillStyle = COL[t]; c.beginPath(); c.arc(Q[0], Q[1], r, 0, 7); c.fill(); c.fillStyle = '#fff8'; c.beginPath(); c.arc(Q[0], Q[1] - r * .1, r * .45, 0, 7); c.fill();
      if (tr.k === 'G') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(Q[0], Q[1], r * .75, 0, 7); c.stroke(); }
      if (st.g && st.g[t] === i) { c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.beginPath(); c.arc(Q[0], Q[1], r * 1.35, 0, 7); c.stroke(); }
      if (st.c === i) { c.strokeStyle = COL[t]; c.globalAlpha = .45 + .25 * Math.sin(performance.now() / 120); c.lineWidth = 3; c.beginPath(); c.arc(Q[0], Q[1], r * 1.7, 0, 7); c.stroke(); c.globalAlpha = 1; } }
    // the bubble dome over centre ice
    c.strokeStyle = '#ffffff22'; c.lineWidth = s * .01; c.beginPath(); c.arc(m[0], m[1], s * .14, 0, 7); c.stroke();
    var pk = P(st.p[0], st.p[1]); c.fillStyle = '#111'; c.beginPath(); c.arc(pk[0], pk[1], B.PR * s, 0, 7); c.fill();
    if (o.trail) { c.strokeStyle = '#11111133'; c.lineWidth = B.PR * s; o.trail.forEach(function (tp, k) { if (k) line(c, P(o.trail[k - 1][0], o.trail[k - 1][1]), P(tp[0], tp[1])); }); }
  };
  function line(c, a, b) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // touch -> intents. send(m) gets {t:'grab',i} {t:'drag',x,y} {t:'rel'} {t:'tap'} {t:'flick',dx,dy,sp} in rink coords
  function Gestures(el, V, getSt, send) {
    var id = null, pts = [], t0 = 0, start = null;
    el.addEventListener('pointerdown', function (e) { if (id !== null) { send({ t: 'tap' }); return; } id = e.pointerId; var w = V.s2w(e.clientX, e.clientY), st = getSt(); t0 = performance.now(); start = w; pts = [[w[0], w[1], t0]];
      var best = -1, bd = .1; if (st) for (var i = V.team * 6; i < V.team * 6 + 6; i++) { var q = B.pos(B.TR[i], st.u[i]), d = Math.hypot(q[0] - w[0], q[1] - w[1]); if (d < bd) { bd = d; best = i; } }
      send({ t: 'grab', i: best }); send({ t: 'drag', x: w[0], y: w[1] }); });
    el.addEventListener('pointermove', function (e) { if (e.pointerId !== id) return; var w = V.s2w(e.clientX, e.clientY), n = performance.now(); pts.push([w[0], w[1], n]); if (pts.length > 30) pts.shift(); if (!this.lt || n - this.lt > 30) { this.lt = n; send({ t: 'drag', x: w[0], y: w[1] }); } });
    function up(e) { if (e.pointerId !== id) return; id = null; var n = performance.now(), rec = pts.filter(function (p) { return n - p[2] < 120; }); var w = V.s2w(e.clientX, e.clientY), moved = Math.hypot(w[0] - start[0], w[1] - start[1]);
      send({ t: 'rel' });
      if (n - t0 < 260 && moved < .035) { send({ t: 'tap' }); return; }
      if (rec.length < 2) rec = pts.slice(-3); if (rec.length >= 2) { var a = rec[0], b = rec[rec.length - 1], dt = Math.max(.016, (b[2] - a[2]) / 1000), dx = (b[0] - a[0]) / dt, dy = (b[1] - a[1]) / dt, sp = Math.hypot(dx, dy); if (sp > .9) send({ t: 'flick', dx: dx, dy: dy, sp: Math.min(3, Math.max(1.2, sp * .6)) }); } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  root.BubbleView = View; root.BubbleGestures = Gestures; root.BubbleCOL = COL;
})(window);
