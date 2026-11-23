/* Tiny 3D throw kit for flick games (Swish Flick, Splash Clown). Metres, y up, z away from the thrower.
   T3.cam(W, H, eye) -> project(x, y, z) -> [sx, sy, scale]. T3.ball(...) step with gravity, spin, floor.
   T3.launch(flick): flick from Kit.flick -> velocity + spin, tuned so a medium flick reaches ~3.5 m at hoop height. */
(function (root) {
  var G = 9.8;
  function cam(W, H, eye) { var f = Math.min(W, H * 1.25) * (eye.f || 1.05), hy = H * (eye.hy || .52);
    return function (x, y, z) { var d = Math.max(.15, z - eye.z); return [W / 2 + (x - eye.x) * f / d, hy - (y - eye.y) * f / d, f / d]; }; }
  function launch(fl, o) {
    o = o || {}; var s = Math.max(0, -fl.dy / fl.h), k = o.k || 3.4, v = Math.max(2.5, Math.min(12, (o.v || 6.9) * Math.pow(s / k, o.exp || 1))), th = (o.angle || 55) * Math.PI / 180;
    return { v: [Math.max(-2.2, Math.min(2.2, fl.dx / fl.w * (o.side || 1.1))), v * Math.sin(th), v * Math.cos(th)], spin: v * 2.2, side: (fl.curve || 0) * 4 };
  }
  function Ball(p, r) { this.p = p.slice(); this.v = [0, 0, 0]; this.r = r || .12; this.rot = 0; this.spin = 0; this.side = 0; this.t = 0; this.live = false; this.touched = false; }
  Ball.prototype.step = function (dt) {
    var p = this.p, v = this.v; v[1] -= G * dt; v[0] += this.side * .25 * dt;
    var dr = 1 - .05 * dt; v[0] *= dr; v[1] *= dr; v[2] *= dr;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt; this.rot += this.spin * dt; this.t += dt;
    if (p[1] < this.r) { p[1] = this.r; if (v[1] < 0) v[1] = -v[1] * .55; v[0] *= .9; v[2] *= .85; this.spin *= .7; }
  };
  // bounce off a point (e.g. nearest rim point). backspin bleeds forward speed on contact (soft touch)
  Ball.prototype.hitPoint = function (q, rad, e) {
    var p = this.p, d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], L = Math.hypot(d[0], d[1], d[2]), m = this.r + (rad || 0);
    if (L >= m || L < 1e-6) return false; var n = [d[0] / L, d[1] / L, d[2] / L];
    p[0] = q[0] + n[0] * m; p[1] = q[1] + n[1] * m; p[2] = q[2] + n[2] * m;
    var v = this.v, vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; if (vn < 0) { var k = 1 + (e || .5); v[0] -= k * vn * n[0]; v[1] -= k * vn * n[1]; v[2] -= k * vn * n[2]; }
    var bs = Math.min(.35, this.spin * .012); v[2] *= 1 - bs; v[0] *= .9; this.spin *= .6; this.touched = true; return true;
  };
  // ring of radius R at centre c (horizontal): nearest point on the circle
  Ball.prototype.hitRing = function (c, R, tube, e) { var dx = this.p[0] - c[0], dz = this.p[2] - c[2], L = Math.hypot(dx, dz) || 1e-6; return this.hitPoint([c[0] + dx / L * R, c[1], c[2] + dz / L * R], tube, e); };
  // wall at z = zb facing the thrower, within x0..x1 / y0..y1
  Ball.prototype.hitWall = function (zb, x0, x1, y0, y1, e) { var p = this.p, v = this.v; if (p[2] + this.r > zb && p[2] < zb + .2 && p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1 && v[2] > 0) { p[2] = zb - this.r; v[2] = -v[2] * (e || .55); this.spin *= .5; this.touched = true; return true; } return false; };
  function drawBall(ctx, P, b, col, alpha) {
    var s = P(b.p[0], b.p[1], b.p[2]), r = b.r * s[2]; if (r < .5) return;
    var sh = P(b.p[0], 0, b.p[2]); ctx.globalAlpha = (alpha == null ? 1 : alpha) * .35; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], r, r * .3, 0, 0, 7); ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var g = ctx.createRadialGradient(s[0] - r * .35, s[1] - r * .35, r * .1, s[0], s[1], r); g.addColorStop(0, '#ffd7a8'); g.addColorStop(.3, col || '#f07a22'); g.addColorStop(1, '#6a2a06');
    ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 7); ctx.clip(); ctx.strokeStyle = '#2a1206'; ctx.lineWidth = Math.max(1, r * .08);
    var a = b.rot; ctx.beginPath(); ctx.moveTo(s[0] - r, s[1] + Math.sin(a) * r); ctx.lineTo(s[0] + r, s[1] + Math.sin(a) * r); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(s[0], s[1], r * .5, r, 0, 0, 7); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
  }
  root.T3 = { cam: cam, launch: launch, Ball: Ball, drawBall: drawBall, G: G };
})(window);
