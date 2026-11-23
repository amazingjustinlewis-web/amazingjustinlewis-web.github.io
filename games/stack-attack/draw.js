/* STACK ATTACK 3D-ish view (physics stays a 2D slab in matter.js; blocks are drawn extruded with a real perspective camera).
   World: matter x, y (y down). 3D: X = x, Y = GY - y (up), Z = depth (blocks are D deep, centred on Z = 0).
   Cam: { tx, ty, yaw, pitch, dist }. project / unproject (screen -> point on the Z = 0 plane) for dragging. */
(function (root) {
  var GY = 1000, D = 110, FLOOR = -260;
  function basis(c) { var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    var cam = [c.tx + c.dist * sy * cp, c.ty + c.dist * sp, -c.dist * cy * cp], f = [-sy * cp, -sp, cy * cp], r = [cy, 0, sy], u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    return { cam: cam, f: f, r: r, u: u }; }
  function Proj(c, W, H) { var B = basis(c), F = H * 1.1, cx = W / 2, cy = H * .56;
    this.B = B; this.F = F; this.cx = cx; this.cy = cy; }
  Proj.prototype.p = function (X, Y, Z) { var B = this.B, d = [X - B.cam[0], Y - B.cam[1], Z - B.cam[2]], z = d[0] * B.f[0] + d[1] * B.f[1] + d[2] * B.f[2]; if (z < 10) z = 10;
    return [this.cx + (d[0] * B.r[0] + d[1] * B.r[1] + d[2] * B.r[2]) * this.F / z, this.cy - (d[0] * B.u[0] + d[1] * B.u[1] + d[2] * B.u[2]) * this.F / z, z]; };
  Proj.prototype.un = function (sx, sy) { var B = this.B, a = (sx - this.cx) / this.F, b = (this.cy - sy) / this.F, dir = [B.f[0] + B.r[0] * a + B.u[0] * b, B.f[1] + B.r[1] * a + B.u[1] * b, B.f[2] + B.r[2] * a + B.u[2] * b];
    var t = -B.cam[2] / (dir[2] || 1e-6); return [B.cam[0] + dir[0] * t, GY - (B.cam[1] + dir[1] * t)]; };
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; k = Math.max(.35, Math.min(1.25, k)); return 'rgb(' + Math.min(255, r * k | 0) + ',' + Math.min(255, g * k | 0) + ',' + Math.min(255, b * k | 0) + ')'; }
  // prism faces of a 2D polygon (matter verts) extruded to depth d, culled + shaded
  function prism(P, verts, d, col, out, alpha, outline) {
    var B = P.B, z0 = -d / 2, z1 = d / 2, faces = [], n = verts.length, cxy = [0, 0]; verts.forEach(function (v) { cxy[0] += v[0] / n; cxy[1] += v[1] / n; });
    function face(pts3, nrm) { var c = [0, 0, 0]; pts3.forEach(function (q) { c[0] += q[0] / pts3.length; c[1] += q[1] / pts3.length; c[2] += q[2] / pts3.length; });
      var toCam = [B.cam[0] - c[0], B.cam[1] - c[1], B.cam[2] - c[2]]; if (nrm[0] * toCam[0] + nrm[1] * toCam[1] + nrm[2] * toCam[2] <= 0) return;
      var light = .75 + .35 * (nrm[1] * .8 - nrm[2] * .5 + nrm[0] * .2); faces.push({ pts: pts3.map(function (q) { return P.p(q[0], q[1], q[2]); }), col: shade(col, light) }); }
    var V = verts.map(function (v) { return [v[0], GY - v[1]]; });
    face(V.map(function (v) { return [v[0], v[1], z0]; }), [0, 0, -1]); face(V.map(function (v) { return [v[0], v[1], z1]; }).reverse(), [0, 0, 1]);
    for (var i = 0; i < n; i++) { var a = V[i], b = V[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1, nx = ey / L, ny = -ex / L;
      var mx = (a[0] + b[0]) / 2 - cxy[0], my = (a[1] + b[1]) / 2 - (GY - cxy[1]); if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [nx, ny, 0]); }
    var c3 = P.p(cxy[0], GY - cxy[1], 0); out.push({ z: c3[2], faces: faces, alpha: alpha, outline: outline });
  }
  function paint(ctx, item) { if (item.alpha != null) ctx.globalAlpha = item.alpha;
    item.faces.forEach(function (f) { ctx.beginPath(); f.pts.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fillStyle = f.col; ctx.fill(); ctx.strokeStyle = item.outline || '#0004'; ctx.lineWidth = item.outline ? 2.5 : 1; ctx.stroke(); });
    ctx.globalAlpha = 1; }
  function rectV(x, y, w, h) { return [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]]; }
  function draw(ctx, W, H, S, cam, t) {
    var P = new Proj(cam, W, H), storm = S.phase === 'disaster', dz = S.dz;
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, storm ? (dz === 'tornado' ? '#4a4a5a' : dz === 'monster' ? '#5a2a3a' : '#6a5030') : '#7ec8f0'); sky.addColorStop(1, storm ? '#2a2a33' : '#d8f0ff'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    var sh = S.shake ? Math.sin(t * 50) * S.shake * 6 : 0; ctx.save(); ctx.translate(sh, 0);
    // floor
    var fl = [[-9000, FLOOR, -3000], [10000, FLOOR, -3000], [10000, FLOOR, 9000], [-9000, FLOOR, 9000]].map(function (q) { return P.p(q[0], q[1], q[2]); });
    ctx.fillStyle = '#6aa84a'; ctx.beginPath(); fl.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.fill();
    for (var gx = -3000; gx <= 4000; gx += 250) { var a = P.p(gx, FLOOR, -1500), b = P.p(gx, FLOOR, 2500); ctx.strokeStyle = '#0001'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    var items = [];
    (S.g || []).forEach(function (g, i) { prism(P, rectV(g[0], GY, 450, 40), 220, '#9a9aa8', items); prism(P, rectV(g[0], GY + 20 + (1260 - GY - 20) / 2, 400, 1260 - GY - 20), 200, '#7a7a88', items);
      if (S.best && i === 0) { var by = (1150 - S.best * 100), q0 = P.p(g[0] - 280, GY - by - 150 + 150, 0); } });
    var held = [];
    (S.b || []).forEach(function (b) { if (b[3]) held.push(b); else prism(P, b[0], D, b[1], items); });
    if (S.mz) { var m = S.mz; prism(P, rectV(m[0] + 230, 1050, 360, 420), 260, '#4caf50', items); prism(P, rectV(m[0] + 110, m[1], 230, 160), 200, '#4caf50', items); }
    items.sort(function (a, b) { return b.z - a.z; }).forEach(function (it) { paint(ctx, it); });
    if (S.mz) { var e = P.p(S.mz[0] + 60, GY - S.mz[1] + 30, -102); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e[0], e[1], 4000 / e[2] * 6, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e[0] - 2, e[1], 4000 / e[2] * 3, 0, 7); ctx.fill(); }
    if (S.tw != null) { for (var i2 = 0; i2 < 18; i2++) { var yy = FLOOR + i2 * 70, w = 40 + i2 * 16; ctx.strokeStyle = 'rgba(230,230,240,' + (.55 - i2 * .02) + ')'; ctx.lineWidth = 3; ctx.beginPath();
      for (var k = 0; k <= 16; k++) { var an = k / 16 * 7 + t * 6, q = P.p(S.tw + Math.sin(t * 5 + i2 * .6) * (10 + i2 * 3) + Math.cos(an) * w, yy, Math.sin(an) * w); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); } }
    // held blocks: x-ray through everything so you can shuffle one underneath
    held.forEach(function (b) { var it = []; prism(P, b[0], D, b[1], it, .55, '#fff'); paint(ctx, it[0]); });
    if (S.best) { var g0 = (S.g || [[500]])[0][0], yb = GY - (GY - 20 - S.best * 100), l = P.p(g0 - 300, yb, 0), r = P.p(g0 + 300, yb, 0); ctx.strokeStyle = '#ffe7a0'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffe7a0'; ctx.font = '14px Fredoka,sans-serif'; ctx.fillText('best ' + S.best.toFixed(1) + 'm', r[0] + 4, r[1] + 4); }
    (S.labels || []).forEach(function (L) { var q = P.p(L[0], FLOOR + 30, -260); ctx.font = '600 ' + Math.max(11, Math.min(26, 9000 / q[2])) + 'px Fredoka,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#0008'; ctx.fillText(L[1], q[0] + 1, q[1] + 1); ctx.fillStyle = '#fff'; ctx.fillText(L[1], q[0], q[1]); ctx.textAlign = 'left'; });
    ctx.restore(); return P;
  }
  function iconSvg(k) { var w = k[1], h = k[2], s = 40 / Math.max(w, h), W = w * s, Hh = h * s; return '<svg viewBox="-24 -24 48 48" width="48" height="48">' + (k[0] === 'tri' ? '<polygon points="' + (-W / 2) + ',' + (Hh / 2) + ' ' + (W / 2) + ',' + (Hh / 2) + ' 0,' + (-Hh / 2) + '" fill="' + k[3] + '" stroke="#0006" stroke-width="2"/>' : '<rect x="' + (-W / 2) + '" y="' + (-Hh / 2) + '" width="' + W + '" height="' + Hh + '" rx="3" fill="' + k[3] + '" stroke="#0006" stroke-width="2"/>') + '</svg>'; }
  // camera helper shared by screen and pads: build view on your tower, zoomed out during the disaster
  function Cam() { this.c = { tx: 500, ty: 300, yaw: 0, pitch: .21, dist: 1350 }; this.uyaw = 0; this.upitch = .21; }
  Cam.prototype.update = function (S, dt, W, H) { var asp = W && H ? W / H : 16 / 9; var wide = S.phase === 'disaster' || S.phase === 'settle' || S.phase === 'score', k = 1 - Math.exp(-dt * (wide ? 1.6 : 2.5)), c = this.c;
    var tdist = wide ? Math.max(2300, 1900 * 1.1 / asp) : 1350, tty = wide ? 350 : 300 + Math.max(0, (S.top || 0) - 250) * .6;
    c.dist += (tdist - c.dist) * k; c.ty += (tty - c.ty) * k; c.tx += (500 - c.tx) * k; c.yaw += (this.uyaw - c.yaw) * (1 - Math.exp(-dt * 8)); c.pitch += (this.upitch - c.pitch) * (1 - Math.exp(-dt * 8)); };
  Cam.prototype.orbit = function (dx, dy) { this.uyaw = Math.max(-1, Math.min(1, this.uyaw + dx * .003)); this.upitch = Math.max(.04, Math.min(.6, this.upitch + dy * .002)); };
  root.StackDraw = { draw: draw, Proj: Proj, Cam: Cam, iconSvg: iconSvg, GY: GY, D: D };
})(window);
