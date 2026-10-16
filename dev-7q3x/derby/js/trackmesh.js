/* DEMOLITION DERBY v0.4.2 - race track meshes, shared by the TV and the phone's own race view. */
(function (root) {
  'use strict';
  root.DDTrackMesh = { build: function (R3, opt) {
    opt = opt || {}; var trackG;
    var TR = window.DDTrack, g = trackG = new R3.Group();
    var cols = [-13, -11, -9, -7, -5, -4, -3.95, -2, 0, 2, 3.95, 4, 5, 7, 9, 11, 13], NC = cols.length, pos = [], colr = [], idx = [], c = new R3.Color();
    for (var i = 0; i <= TR.N; i++) { var sv = (i % TR.N) * TR.STEP, bump = TR.isBumpy(sv), la = TR.ledgeAt(sv);
      for (var j = 0; j < NC; j++) { var u = cols[j], w = TR.at(sv, u), h = TR.height(sv, u); pos.push(w.x, h, w.y);
        var onL = la && la.g.side * u >= TR.HALF - la.g.w, ramp = TR.ramps.some(function (r) { var d = TR.dS(sv, r.s); return d < r.len && (r.u0 == null || (u >= r.u0 && u <= r.u1)); });
        if (i < 2) c.setHex(((j + i) % 2) ? 0xffffff : 0x111111);
        else if (ramp) c.setHex((i % 2) ? 0xe8b830 : 0x2a2a2a);
        else if (onL) c.setHex(Math.abs(u) > 12 || Math.abs(Math.abs(u) - 4) < 0.1 ? 0xd8c070 : 0x9a7a52);
        else if (bump) c.setHex(0x8a7a62 + (((i * 7 + j * 3) % 5) * 0x030303));
        else c.setHex(Math.abs(u) > 12.5 ? ((i >> 1) % 2 ? 0xd03028 : 0xeeeeee) : Math.abs(u) < 0.3 && (i >> 2) % 2 ? 0xbcb8a8 : 0x4e4a46 + ((i * 13 + j * 7) % 3) * 0x020202);
        colr.push(c.r, c.g, c.b); } }
    for (i = 0; i < TR.N; i++) for (j = 0; j < NC - 1; j++) { var a = i * NC + j, b = a + 1, d = a + NC, e = d + 1; idx.push(a, d, b, b, d, e); }
    var geo = new R3.BufferGeometry(); geo.setAttribute('position', new R3.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new R3.Float32BufferAttribute(colr, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new R3.Mesh(geo, new R3.MeshLambertMaterial({ vertexColors: true, side: 2 })));
    // edge walls (red/white barriers)
    var wp = [], wc = [], wi = [], k = 0;
    [-1, 1].forEach(function (sg) { for (var i = 0; i <= TR.N; i++) { var sv = (i % TR.N) * TR.STEP, w = TR.at(sv, sg * (TR.HALF + 0.3)), h = TR.height(sv, sg * TR.HALF); wp.push(w.x, h - 0.2, w.y, w.x, h + TR.wallH, w.y); var cc = (i >> 1) % 2 ? [0.85, 0.2, 0.15] : [0.92, 0.92, 0.92]; wc.push.apply(wc, cc.concat(cc));
      if (i < TR.N) { var b0 = k + i * 2; wi.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3); } } k = wp.length / 3; });
    var wg = new R3.BufferGeometry(); wg.setAttribute('position', new R3.Float32BufferAttribute(wp, 3)); wg.setAttribute('color', new R3.Float32BufferAttribute(wc, 3)); wg.setIndex(wi); wg.computeVertexNormals();
    g.add(new R3.Mesh(wg, new R3.MeshLambertMaterial({ vertexColors: true, side: 2 })));
    var gr = new R3.Mesh(new R3.PlaneGeometry(1200, 1200), new R3.MeshLambertMaterial({ color: 0x4a6a34 })); gr.rotation.x = -Math.PI / 2; gr.position.y = -1.6; g.add(gr);
    var tyre = new R3.MeshLambertMaterial({ color: 0x1c1c1c }), conc = new R3.MeshLambertMaterial({ color: 0xc8c0a8 }), stripe = new R3.MeshLambertMaterial({ color: 0xe8b830 });
    TR.obstacles.forEach(function (o) { var y0 = TR.height(o.s, o.u);
      if (o.kind === 'tyres') for (var t = 0; t < 3; t++) { var m = new R3.Mesh(new R3.CylinderGeometry(o.r, o.r, 0.45, 14), t === 1 ? stripe : tyre); m.position.set(o.x, y0 + 0.25 + t * 0.47, o.y); g.add(m); }
      else { var bl = new R3.Mesh(new R3.CylinderGeometry(o.r * 0.9, o.r, o.h, 8), conc); bl.position.set(o.x, y0 + o.h / 2, o.y); g.add(bl); var st = new R3.Mesh(new R3.CylinderGeometry(o.r * 0.92, o.r * 0.95, 0.3, 8), stripe); st.position.set(o.x, y0 + o.h * 0.7, o.y); g.add(st); } });
    var pm = new R3.MeshLambertMaterial({ color: 0x3a78c8, transparent: true, opacity: 0.7, depthWrite: false });
    TR.puddles.forEach(function (q) { var m = new R3.Mesh(new R3.CircleGeometry(q.r, 22), pm); m.rotation.x = -Math.PI / 2; m.scale.set(1, 0.75 + (q.r % 1) * 0.3, 1); m.position.set(q.x, TR.height(q.s, q.u) + 0.06, q.y); m.renderOrder = 1; g.add(m); });
    // start gantry
    var s0 = TR.at(0, 0), ga = Math.atan2(s0.tx, s0.ty), gm = new R3.MeshLambertMaterial({ color: 0x333840 });
    [-1, 1].forEach(function (sg) { var w = TR.at(0, sg * (TR.HALF + 1)), post = new R3.Mesh(new R3.BoxGeometry(0.8, 9, 0.8), gm); post.position.set(w.x, 4.5 + TR.height(0, 0), w.y); g.add(post); });
    var ban = new R3.Mesh(new R3.BoxGeometry(TR.W + 2, 1.6, 0.4), new R3.MeshLambertMaterial({ color: 0xffd23f })); ban.position.set(s0.x, 8.6 + TR.height(0, 0), s0.y); ban.rotation.y = ga + Math.PI / 2; g.add(ban);
    // a few scattered stands + trees off the track for scale
    var tm = new R3.MeshLambertMaterial({ color: 0x2e5a2a }), tc = new R3.ConeGeometry(2.2, 7, 7);
    for (i = 0; i < (opt.trees == null ? 160 : opt.trees); i++) { var sv2 = Math.random() * TR.L, side = Math.random() < 0.5 ? -1 : 1, w2 = TR.at(sv2, side * (TR.HALF + 6 + Math.random() * 40)), l2 = TR.locate(w2.x, w2.y, -1); if (Math.abs(l2.u) < TR.HALF + 4) continue; var tr = new R3.Mesh(tc, tm); tr.position.set(w2.x, 2, w2.y); g.add(tr); }
  
    return trackG; } };
})(window);
