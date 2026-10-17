/* Foosball v0.1 view: 2D canvas top-down. TV: horizontal (table y -> screen x). Phone: vertical, your goal at the bottom. */
(function (root) {
  'use strict';
  var F = root.Foos, COL = ['#3fa8ff', '#ff5a4a'];
  function View() { this.team = 0; this.horiz = false; }
  View.prototype.fit = function (w, h, top, horiz, bot) { this.w = w; this.h = h; this.horiz = !!horiz; top = top || 0; bot = bot || 0; var aw = w * (horiz ? .96 : .86), ah = h - top - bot - 10, tw = this.horiz ? F.L : 1, th = this.horiz ? 1 : F.L;
    this.S = Math.min(aw / tw, ah / th); this.ox = (w - tw * this.S) / 2; this.oy = top + (ah - th * this.S) / 2 + 5; };
  // table (x,y) -> screen
  View.prototype.p = function (x, y) { if (this.horiz) return [this.ox + y * this.S, this.oy + x * this.S]; if (this.team === 1) { x = 1 - x; y = F.L - y; } return [this.ox + x * this.S, this.oy + y * this.S]; };
  View.prototype.inv = function (sx, sy) { var a = (sx - this.ox) / this.S, b = (sy - this.oy) / this.S; if (this.horiz) return [b, a]; if (this.team === 1) return [1 - a, F.L - b]; return [a, b]; };
  View.prototype.draw = function (ctx, st, opt) { opt = opt || {}; var S = this.S, me = this, L = F.L, hz = this.horiz;
    ctx.clearRect(0, 0, this.w, this.h);
    var a = this.p(0, 0), b = this.p(1, L), x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), W = Math.abs(b[0] - a[0]), H = Math.abs(b[1] - a[1]);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x0 - S * .04, y0 - S * .04, W + S * .08, H + S * .08);
    ctx.fillStyle = '#1f7a3a'; ctx.fillRect(x0, y0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, S * .004); ctx.strokeRect(x0, y0, W, H);
    var c = this.p(.5, L / 2); ctx.beginPath(); ctx.arc(c[0], c[1], S * .12, 0, 7); ctx.stroke();
    ctx.beginPath(); var m1 = this.p(0, L / 2), m2 = this.p(1, L / 2); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke();
    // goals
    [[0, 0], [L, 1]].forEach(function (g) { var g1 = me.p(.5 - F.GW, g[0]), g2 = me.p(.5 + F.GW, g[0]); ctx.strokeStyle = COL[g[1] ? 0 : 1]; ctx.lineWidth = S * .025; ctx.beginPath(); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.stroke(); });
    // rods + men
    var hr = st.hr || [];
    for (var r = 0; r < 8; r++) { var d = F.R[r], e1 = this.p(-.03, d.y), e2 = this.p(1.03, d.y), mine = opt.myRods && opt.myRods.indexOf(r) >= 0;
      ctx.strokeStyle = hr.indexOf(r) >= 0 ? '#fff' : mine ? '#dfe6ee' : '#9aa4ad'; ctx.lineWidth = S * (hr.indexOf(r) >= 0 ? .009 : .006); ctx.beginPath(); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(e1[0], e1[1], S * .014, 0, 7); ctx.arc(e2[0], e2[1], S * .014, 0, 7); ctx.fill();
      var ang = st.a ? st.a[r] : 0, fc = d.t ? 1 : -1, sn = Math.sin(ang) * fc, cs = Math.cos(ang), ys = [[0, -F.HY], [0, F.HY], [F.ROD.len, -F.HY], [F.ROD.len, F.HY]].map(function (q) { return d.y + q[0] * sn + q[1] * cs; }), y0m = Math.min.apply(null, ys), y1m = Math.max.apply(null, ys), toe = F.ROD.h - F.ROD.len * cs, lifted = toe > F.BR * 2;
      for (var j = 0; j < d.n; j++) { var mx = .5 + st.s[r] + (j - (d.n - 1) / 2) * d.sp, my = d.y, q1 = this.p(mx - F.HX, y0m), q2 = this.p(mx + F.HX, y1m);
        var rx = Math.min(q1[0], q2[0]), ry = Math.min(q1[1], q2[1]), rw = Math.abs(q2[0] - q1[0]), rh = Math.abs(q2[1] - q1[1]);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(rx + S * .006, ry + S * .006, rw, rh);
        ctx.globalAlpha = lifted ? .55 : 1; ctx.fillStyle = COL[d.t]; ctx.fillRect(rx, ry, rw, rh); var tq = this.p(mx, d.y + F.ROD.len * sn), tq2 = this.p(mx - F.HX, d.y + F.ROD.len * sn); ctx.fillStyle = 'rgba(0,0,0,.25)'; if (Math.abs(sn) > .05) { var ta2 = this.p(mx - F.HX, d.y + (F.ROD.len - .008) * sn), tb2 = this.p(mx + F.HX, d.y + F.ROD.len * sn); ctx.fillRect(Math.min(ta2[0], tb2[0]), Math.min(ta2[1], tb2[1]), Math.abs(tb2[0] - ta2[0]) || 2, Math.abs(tb2[1] - ta2[1]) || 2); } ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = S * .004; ctx.strokeRect(rx, ry, rw, rh);
        var dc = this.p(mx, my); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dc[0], dc[1], S * .004, 0, 7); ctx.fill(); } }
    var bp = this.p(st.b[0], st.b[1]); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(bp[0] + S * .005, bp[1] + S * .005, F.BR * S, 0, 7); ctx.fill();
    ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(bp[0], bp[1], F.BR * S, 0, 7); ctx.fill(); };
  // gestures -> sim messages in table coords
  function Gestures(cv, V, send) { var id = null, pts = [];
    function tp(e) { var r = cv.getBoundingClientRect(); return V.inv(e.clientX - r.left, e.clientY - r.top); }
    cv.addEventListener('pointerdown', function (e) { if (id !== null) return; id = e.pointerId; try { cv.setPointerCapture(id); } catch (_) {} var p = tp(e); pts = [[p[0], p[1], performance.now()]]; send({ t: 'grab', x: p[0], y: p[1] }); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (e.pointerId !== id) return; var p = tp(e); pts.push([p[0], p[1], performance.now()]); if (pts.length > 40) pts.shift(); send({ t: 'drag', x: p[0], y: p[1] }); });
    function up(e) { if (e.pointerId !== id) return; id = null; var now = performance.now(), last = pts[pts.length - 1], first = pts[0], k = pts.length - 1; while (k > 0 && now - pts[k][2] < 110) k--;
      var a = pts[k], dt = Math.max(.016, (now - a[2]) / 1000), dx = last[0] - a[0], dy = last[1] - a[1], sp = Math.hypot(dx, dy) / dt, tot = Math.hypot(last[0] - first[0], last[1] - first[1]);
      if (tot < .02 && now - first[2] < 300) send({ t: 'tap' });
      send({ t: 'rel' }); }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); }
  root.FoosView = View; root.FoosGestures = Gestures; root.FoosCOL = COL;
})(window);
