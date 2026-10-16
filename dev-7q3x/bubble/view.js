/* BUBBLE HOCKEY v0.1 - minimalist top-down table. view(team) puts that team's goal at the bottom of the screen. */
(function (root) {
  'use strict';
  var B = root.Bubble, COL = ['#ff5a6e', '#3aa8ff'];
  function View() { this.team = 0; this.s = 1; this.ox = 0; this.oy = 0; this.fit(innerWidth, innerHeight, 0); }
  View.prototype.fit = function (W, H, top, horiz, bot) { top = top || 0; this.horiz = !!horiz; if (horiz) { bot = bot || 0; this.s = Math.min(W * .9 / B.L, (H - top - bot) * .84); this.ox = W / 2 - this.s * B.L / 2; this.oy = top + (H - top - bot) / 2 - this.s / 2; return; } this.s = Math.min(W * .74, (H - top) * .84 / B.L); this.ox = W / 2 - this.s / 2; this.oy = top + (H - top) / 2 - this.s * B.L / 2; };
  View.prototype.w2s = function (x, y) { if (this.team) { x = 1 - x; y = B.L - y; } return this.horiz ? [this.ox + y * this.s, this.oy + x * this.s] : [this.ox + x * this.s, this.oy + y * this.s]; };
  View.prototype.s2w = function (X, Y) { var x = (X - this.ox) / this.s, y = (Y - this.oy) / this.s; if (this.horiz) { var tq = x; x = y; y = tq; } return this.team ? [1 - x, B.L - y] : [x, y]; };
  // v0.1.1: classic bubble hockey cabinet. Wood-ish cabinet, rink boards with yellow kickplate, metal-rimmed player slots,
  // rod knobs on the side rails, a glass dome over the whole rink, and a tiny metal serve slot at centre ice.
  View.prototype.draw = function (c, st, o) {
    o = o || {}; var me = this, s = this.s, L = B.L, P = function (x, y) { return me.w2s(x, y); }, now = performance.now() / 1000;
    var a = P(0, 0), b = P(1, L), x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]), HZ = this.horiz;
    // cabinet + side rails with rod knobs
    var cg = c.createLinearGradient(x0 - s * .12, 0, x0 + w + s * .12, 0); cg.addColorStop(0, '#1d2a52'); cg.addColorStop(.5, '#2c3d74'); cg.addColorStop(1, '#1d2a52');
    c.fillStyle = cg; rr(c, x0 - s * .1, y0 - s * .1, w + s * .2, h + s * .2, s * .16); c.fill();
    c.strokeStyle = '#ffffff22'; c.lineWidth = 2; rr(c, x0 - s * .1, y0 - s * .1, w + s * .2, h + s * .2, s * .16); c.stroke();
    for (var i = 0; i < 12; i++) { var tr = B.TR[i], mid = B.pos(tr, .5), Q = P(mid[0], mid[1]), left = (tr.t === 0) !== !!this.team; var kx = left ? x0 - s * .075 : x0 + w + s * .075;
      var kg = c.createLinearGradient(kx - s * .02, 0, kx + s * .02, 0); kg.addColorStop(0, '#8d97a6'); kg.addColorStop(.5, '#eef2f7'); kg.addColorStop(1, '#6f7886');
      if (HZ) { var ky = tr.t === 0 ? y0 + h + s * .075 : y0 - s * .075; c.fillStyle = '#c9d0d9'; c.fillRect(Q[0] - s * .012, ky - s * .022, s * .024, s * .044); c.fillStyle = COL[tr.t]; c.beginPath(); c.arc(Q[0], tr.t === 0 ? ky + s * .03 : ky - s * .03, s * .018, 0, 7); c.fill(); continue; }
      c.fillStyle = kg; c.fillRect(kx - s * .022, Q[1] - s * .012, s * .044, s * .024); c.fillStyle = COL[tr.t]; c.beginPath(); c.arc(left ? kx - s * .03 : kx + s * .03, Q[1], s * .018, 0, 7); c.fill(); }
    // boards: white with a yellow kickplate, then the ice
    c.fillStyle = '#f6f8fb'; rr(c, x0 - s * .035, y0 - s * .035, w + s * .07, h + s * .07, s * .15); c.fill();
    c.strokeStyle = '#f2c230'; c.lineWidth = s * .014; rr(c, x0 - s * .02, y0 - s * .02, w + s * .04, h + s * .04, s * .13); c.stroke();
    var ig = c.createLinearGradient(0, y0, 0, y0 + h); ig.addColorStop(0, '#e6eef8'); ig.addColorStop(.5, '#f4f8fc'); ig.addColorStop(1, '#e6eef8');
    c.fillStyle = ig; rr(c, x0, y0, w, h, s * .11); c.fill();
    c.save(); rr(c, x0, y0, w, h, s * .11); c.clip();
    // lines: red centre, blue lines, red goal lines, faceoff circles
    c.lineWidth = Math.max(3, s * .012); c.strokeStyle = '#d8344ccc'; line(c, P(0, L / 2), P(1, L / 2));
    c.lineWidth = Math.max(3, s * .016); c.strokeStyle = '#2f6fd1cc'; line(c, P(0, B.BL), P(1, B.BL)); line(c, P(0, L - B.BL), P(1, L - B.BL));
    c.lineWidth = Math.max(2, s * .005); c.strokeStyle = '#d8344c99'; line(c, P(0, B.GY), P(1, B.GY)); line(c, P(0, L - B.GY), P(1, L - B.GY));
    var m = P(.5, L / 2); c.strokeStyle = '#2f6fd1aa'; c.beginPath(); c.arc(m[0], m[1], s * .1, 0, 7); c.stroke();
    [[.25, .36], [.75, .36], [.25, L - .36], [.75, L - .36]].forEach(function (f) { var q = P(f[0], f[1]); c.strokeStyle = '#d8344c66'; c.beginPath(); c.arc(q[0], q[1], s * .075, 0, 7); c.stroke(); c.fillStyle = '#d8344c99'; c.beginPath(); c.arc(q[0], q[1], s * .008, 0, 7); c.fill(); });
    // creases + nets
    [[B.GY, 1], [L - B.GY, -1]].forEach(function (g) { var q = P(.5, g[0]); c.fillStyle = '#5aa0ff33'; c.beginPath(); c.arc(q[0], q[1], s * B.GW * 1.15, 0, 7); c.fill(); });
    [[B.GY, -1], [L - B.GY, 1]].forEach(function (g) { var p1 = P(.5 - B.GW, g[0]), p2 = P(.5 + B.GW, g[0] + g[1] * .05), X = Math.min(p1[0], p2[0]), Y = Math.min(p1[1], p2[1]), Wd = Math.abs(p2[0] - p1[0]), Hd = Math.abs(p2[1] - p1[1]);
      c.fillStyle = '#dfe6ee'; c.fillRect(X, Y, Wd, Hd); c.strokeStyle = '#9aa6b5'; c.lineWidth = 1; for (var k = 1; k < 8; k++) line(c, [X + Wd * k / 8, Y], [X + Wd * k / 8, Y + Hd]); c.strokeStyle = '#d8344c'; c.lineWidth = Math.max(2, s * .008); c.strokeRect(X, Y, Wd, Hd); });
    // player slots: metal rim + dark groove (the rods run underneath)
    c.lineCap = 'round'; c.lineJoin = 'round'; B.TR.forEach(function (tr) { function path() { c.beginPath(); tr.p.forEach(function (q, k) { var Q = P(q[0], q[1]); if (k) c.lineTo(Q[0], Q[1]); else c.moveTo(Q[0], Q[1]); }); c.stroke(); }
      c.strokeStyle = '#c3ccd666'; c.lineWidth = s * .017; path(); c.strokeStyle = '#4a556a55'; c.lineWidth = s * .007; path(); });
    // centre-ice serve slot (tiny metal rectangle). The puck blasts up out of it at every face-off.
    var sw = s * .075, sh = s * .022, mg = c.createLinearGradient(m[0] - sw / 2, m[1] - sh, m[0] + sw / 2, m[1] + sh); mg.addColorStop(0, '#f1f4f8'); mg.addColorStop(.5, '#8b95a3'); mg.addColorStop(1, '#d7dde5');
    c.fillStyle = mg; c.fillRect(m[0] - sw / 2 - 2, m[1] - sh / 2 - 2, sw + 4, sh + 4); c.fillStyle = '#05070c'; c.fillRect(m[0] - sw / 2 + 2, m[1] - sh / 2 + 2, sw - 4, sh - 4);
    // players: shadow, stick, jersey, helmet
    for (i = 0; i < 12; i++) { var tr2 = B.TR[i], q = B.pos(tr2, st.u[i]), q = st.o ? [q[0] + st.o[i][0], q[1] + st.o[i][1]] : q, Qp = P(q[0], q[1]), t = tr2.t, fy = (t ? 1 : -1) * (this.team ? -1 : 1), r = B.R * s;
      c.fillStyle = '#0003'; c.beginPath(); c.ellipse(Qp[0] + r * .18, Qp[1] + r * .25, r * 1.02, r * 1.02, 0, 0, 7); c.fill();
      var an = st.a ? st.a[i] : (t ? -1.57 : 1.57), Tw = [q[0] + Math.cos(an) * (B.R * .5 + tr2.sl * .25), q[1] + Math.sin(an) * (B.R * .5 + tr2.sl * .25)], Tq = P(Tw[0], Tw[1]), Bw = P(q[0] + Math.cos(an) * B.R * .4, q[1] + Math.sin(an) * B.R * .4);
      c.strokeStyle = '#0003'; c.lineWidth = r * .32; line(c, [Bw[0] + r * .15, Bw[1] + r * .2], [Tq[0] + r * .15, Tq[1] + r * .2]);
      c.strokeStyle = st.sw === i ? '#fff' : '#3b2a1a'; c.lineWidth = r * .3; line(c, Bw, Tq); c.fillStyle = '#111'; c.beginPath(); c.arc(Tq[0], Tq[1], r * .26, 0, 7); c.fill();
      var jg = c.createRadialGradient(Qp[0] - r * .3, Qp[1] - r * .3, r * .1, Qp[0], Qp[1], r); jg.addColorStop(0, '#fff8'); jg.addColorStop(.35, COL[t]); jg.addColorStop(1, t ? '#1d5fae' : '#b02a40'); c.fillStyle = jg; c.beginPath(); c.arc(Qp[0], Qp[1], r, 0, 7); c.fill();
      c.fillStyle = tr2.k === 'G' ? '#f6f8fb' : '#20242e'; c.beginPath(); c.arc(Qp[0], Qp[1], r * .42, 0, 7); c.fill(); var Hq = P(q[0] + Math.cos(an) * B.R * .55, q[1] + Math.sin(an) * B.R * .55); c.fillStyle = '#fff9'; c.beginPath(); c.arc(Hq[0], Hq[1], r * .14, 0, 7); c.fill();
      if (st.g && st.g[t] === i) { c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.beginPath(); c.arc(Qp[0], Qp[1], r * 1.35, 0, 7); c.stroke(); }
      if (st.c === i) { c.strokeStyle = COL[t]; c.globalAlpha = .45 + .25 * Math.sin(now * 8); c.lineWidth = 3; c.beginPath(); c.arc(Qp[0], Qp[1], r * 1.7, 0, 7); c.stroke(); c.globalAlpha = 1; } }
    // puck: during a face-off it waits in the slot, then blasts up and drops onto the ice
    var pk = P(st.p[0], st.p[1]), pz = st.pz || 0, POP = .55;
    if (pz > POP) { /* still in the slot */ }
    else { var hgt = 0; if (pz > 0) { var u = 1 - pz / POP; hgt = Math.sin(u * Math.PI) * (1 - u * .3); pk = [m[0], m[1]]; if (u < .25) { c.fillStyle = 'rgba(255,255,255,' + (1 - u * 4) * .8 + ')'; c.beginPath(); c.ellipse(m[0], m[1], sw * (.6 + u * 3), sh * (1 + u * 4), 0, 0, 7); c.fill(); } }
      var pr = B.PR * s * (1 + hgt * 1.3); c.fillStyle = 'rgba(0,0,0,' + (.3 - hgt * .15) + ')'; c.beginPath(); c.ellipse(pk[0] + hgt * s * .03, pk[1] + hgt * s * .05, B.PR * s, B.PR * s * .8, 0, 0, 7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(pk[0], pk[1] - hgt * s * .09, pr, 0, 7); c.fill(); c.strokeStyle = '#444'; c.lineWidth = 1; c.stroke();
      if (o.trail && !pz) { c.strokeStyle = '#11111133'; c.lineWidth = B.PR * s; o.trail.forEach(function (tp, k) { if (k) line(c, P(o.trail[k - 1][0], o.trail[k - 1][1]), P(tp[0], tp[1])); }); } }
    c.restore();
    // glass dome over the rink: tint, rim, and specular streaks
    var dg = c.createRadialGradient(x0 + w * .35, y0 + h * .3, s * .1, x0 + w / 2, y0 + h / 2, h * .62); dg.addColorStop(0, '#ffffff10'); dg.addColorStop(.8, '#bfe0ff12'); dg.addColorStop(1, '#bfe0ff40');
    c.fillStyle = dg; rr(c, x0 - s * .035, y0 - s * .035, w + s * .07, h + s * .07, s * .15); c.fill();
    c.strokeStyle = '#d8ecff66'; c.lineWidth = Math.max(2, s * .012); rr(c, x0 - s * .04, y0 - s * .04, w + s * .08, h + s * .08, s * .16); c.stroke();
    c.strokeStyle = '#ffffff40'; c.lineWidth = s * .025; c.beginPath(); c.ellipse(x0 + w * .5, y0 + h * .5, w * .46, h * .46, 0, Math.PI * 1.08, Math.PI * 1.32); c.stroke();
    c.strokeStyle = '#ffffff22'; c.lineWidth = s * .012; c.beginPath(); c.ellipse(x0 + w * .5, y0 + h * .5, w * .4, h * .4, 0, Math.PI * 1.12, Math.PI * 1.25); c.stroke();
    c.strokeStyle = '#ffffff18'; c.lineWidth = s * .03; c.beginPath(); c.ellipse(x0 + w * .5, y0 + h * .5, w * .44, h * .46, 0, Math.PI * .1, Math.PI * .22); c.stroke();
  };
  function line(c, a, b) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // touch -> intents. send(m) gets {t:'grab',i} {t:'drag',x,y} {t:'rel'} {t:'tap'} {t:'flick',dx,dy,sp} in rink coords
  function Gestures(el, V, getSt, send) {
    function pick(X, Y) { var w = V.pick && V.pick(X, Y); return w || V.s2w(X, Y); }
    var id = null, pts = [], t0 = 0, start = null, goalieT = null, gv = null, GSWIPE = 1.1;   // strip finger speed (rink widths/s) that triggers a goalie reach
    // goalie strip spans 2x the net, centred; finger travel maps 2:1 so the strip ends put the goalie a hair past each post
    function gmap(x) { var k = (B.GW + .006) / (2 * B.GW); return .5 + Math.max(-2 * B.GW, Math.min(2 * B.GW, x - .5)) * k; }
    el.addEventListener('pointerdown', function (e) { if (id !== null) { send({ t: 'tap' }); return; } id = e.pointerId; var w = pick(e.clientX, e.clientY), st = getSt(); t0 = performance.now(); start = w; pts = [[w[0], w[1], t0]];
      // goalie strip: touches behind your own goal line (the edge nearest you) slide your goalie; he never leaves his line
      var gl = V.team ? B.GY : B.L - B.GY, behind = (V.team ? w[1] < gl - .015 : w[1] > gl + .015) && Math.abs(w[0] - .5) < 2 * B.GW + .01, gi = V.team * 6;
      if (behind && !V.horiz && (!V.allow || V.allow.indexOf(gi) >= 0)) { var gq = B.pos(B.TR[gi], .5); goalieT = gq[1]; gv = { x: w[0], y: w[1], t: t0, rt: 0 }; send({ t: 'grab', i: gi }); send({ t: 'drag', x: gmap(w[0]), y: goalieT }); return; } goalieT = null;
      var best = -1, bd = .1; if (st) for (var i = V.team * 6; i < V.team * 6 + 6; i++) { if (V.allow && V.allow.indexOf(i) < 0) continue; var q = B.pos(B.TR[i], st.u[i]); if (st.o) q = [q[0] + st.o[i][0], q[1] + st.o[i][1]]; var d = Math.hypot(q[0] - w[0], q[1] - w[1]); if (d < bd) { bd = d; best = i; } }
      var snag = 0; if (st && (best < 0 || bd > .05) && (st.c < 0 || (st.c < 6 ? 0 : 1) !== V.team)) { var pk = st.p, tp = Math.hypot(pk[0] - w[0], pk[1] - w[1]), bs = 9;   // thumb snag: best thumb-player-puck triangulation
        for (i = V.team * 6; i < V.team * 6 + 6; i++) { if (V.allow && V.allow.indexOf(i) < 0) continue; var q2 = B.pos(B.TR[i], st.u[i]); if (st.o) q2 = [q2[0] + st.o[i][0], q2[1] + st.o[i][1]]; var dT = Math.hypot(q2[0] - w[0], q2[1] - w[1]), dP = Math.hypot(q2[0] - pk[0], q2[1] - pk[1]); if (dT > .45) continue;
          var sc = dT + dP, between = ((q2[0] - w[0]) * (pk[0] - w[0]) + (q2[1] - w[1]) * (pk[1] - w[1])) > 0 && dT < tp; if (between) sc -= .04; if (sc < bs) { bs = sc; best = i; } } snag = best >= 0 && bs < tp + .25 ? 1 : 0; }
      send({ t: 'grab', i: best, snag: snag }); send({ t: 'drag', x: w[0], y: w[1] }); });
    el.addEventListener('pointermove', function (e) { if (e.pointerId !== id) return; var w = pick(e.clientX, e.clientY), n = performance.now(); if (goalieT != null) { send({ t: 'drag', x: gmap(w[0]), y: goalieT + (w[1] - gv.y) }); var gdt = (n - gv.t) / 1000; if (gdt > .006) { var gvx = (w[0] - gv.x) / gdt; if (Math.abs(gvx) > GSWIPE && n - gv.rt > 400) { gv.rt = n; send({ t: 'reach', d: gvx }); } gv.x = w[0]; gv.t = n; } return; } pts.push([w[0], w[1], n]); if (pts.length > 30) pts.shift(); if (!this.lt || n - this.lt > 30) { this.lt = n; send({ t: 'drag', x: w[0], y: w[1] }); } });
    function up(e) { if (e.pointerId !== id) return; id = null; if (goalieT != null) { goalieT = null; send({ t: 'rel' }); return; } var n = performance.now(), rec = pts.filter(function (p) { return n - p[2] < 120; }); var w = pick(e.clientX, e.clientY), moved = Math.hypot(w[0] - start[0], w[1] - start[1]);
      send({ t: 'rel' });
      if (n - t0 < 260 && moved < .035) { send({ t: 'tap', x: start[0], y: start[1] }); return; }
      if (rec.length < 2) rec = pts.slice(-3); if (rec.length >= 2) { var a = rec[0], b = rec[rec.length - 1], dt = Math.max(.016, (b[2] - a[2]) / 1000), dx = (b[0] - a[0]) / dt, dy = (b[1] - a[1]) / dt, sp = Math.hypot(dx, dy); if (sp > .9) send({ t: 'flick', dx: dx, dy: dy, sp: Math.min(3.4, Math.max(.8, sp * .5)) }); } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  root.BubbleView = View; root.BubbleGestures = Gestures; root.BubbleCOL = COL;
})(window);
