/* v0.9.75: rink boards are half their previous height and half their thickness.
   Arena model (arena_classic.glb) and the procedural fallback are both resized.
   The inner face stays on the ice edge so playable area and sim walls (x 0..1, y .05..L-.05)
   still meet the visual inner face. Those walls have no height cap, so the puck cannot fly
   over the lower boards. Cabinet / table_top / glass are unchanged.
   Ads (JOSHUA TREE VENTURES and any future logos) are recentered on the shorter dashers
   and sized to the new board height so the text still reads. ?boards=0 disables. */
(function (root) {
  'use strict';
  if (/[?&]boards=0/.test(location.search)) return;
  var R3 = root.Bubble3D; if (!R3 || R3.__boards975) return; R3.__boards975 = 1;
  var proto = R3.prototype;
  var B = root.Bubble, L = B && B.L != null ? B.L : 2;
  // arena_classic.glb is modelled in metres, Y-up after glTF, ice at y=0. 1 game unit = 0.62 m.
  var UNIT = .62, INNER_X = .31, INNER_Z = .62, CORNER = .12 * UNIT;
  var BOARD_H = 0.06142416 / UNIT;          // ~0.099 game units before this shrink
  var NEW_H = BOARD_H * .5;                 // ~0.0495
  var AD_H = NEW_H * .88;                   // almost full dasher height, small pad
  var AD_Z = NEW_H * .5;
  var AD_W = .85;

  function shrinkXZ(x, z) {
    var ax = Math.abs(x), az = Math.abs(z);
    var sx = x < 0 ? -1 : 1, sz = z < 0 ? -1 : 1;
    var bx = INNER_X - CORNER, bz = INNER_Z - CORNER;
    var qx = ax - bx, qz = az - bz;
    var sdf, nx, nz;
    if (qx > 0 && qz > 0) {
      var len = Math.sqrt(qx * qx + qz * qz) || 1;
      sdf = len - CORNER;
      nx = sx * qx / len; nz = sz * qz / len;
    } else if (qx > qz) {
      sdf = qx - CORNER;
      nx = sx; nz = 0;
    } else {
      sdf = qz - CORNER;
      nx = 0; nz = sz;
    }
    if (!(sdf > 1e-8)) return [x, z];
    var d = sdf * .5;                       // half the outward thickness, inner face stays
    return [x - nx * d, z - nz * d];
  }

  function shrinkArenaBoards(A) {
    if (!A || A.userData.b975) return;
    A.userData.b975 = 1;
    A.traverse(function (o) {
      if (!o.isMesh || !/^boards/.test(o.name)) return;
      var g = o.geometry, pos = g && g.attributes && g.attributes.position; if (!pos) return;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        var xz = shrinkXZ(x, z);
        pos.setXYZ(i, xz[0], y * .5, xz[1]);
      }
      pos.needsUpdate = true;
      if (o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundingSphere();
    });
  }

  function rr(w, h, r, x, y) {
    var s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function ringGeo(pad, th, hgt) {
    var o = rr(L + 2 * (pad + th), 1 + 2 * (pad + th), .14 + pad + th, -pad - th, -pad - th);
    var hole = rr(L + 2 * pad, 1 + 2 * pad, .12 + pad, -pad, -pad); o.holes.push(hole);
    return new THREE.ExtrudeGeometry(o, { depth: hgt, bevelEnabled: false });
  }
  function shrinkProc(proc) {
    if (!proc || proc._b975) return;
    proc._b975 = 1;
    // proc[0] white dashers (was th .03 h .07), proc[1] yellow kickplate (was th .012 h .018)
    // inner hole (pad) unchanged so the inner face stays on the ice edge
    if (proc[0] && proc[0].geometry) {
      proc[0].geometry.dispose();
      proc[0].geometry = ringGeo(0, .015, .035);
      proc[0].position.y = .035;
      if (proc[0].userData.p0) proc[0].userData.p0.y = .035;
    }
    if (proc[1] && proc[1].geometry) {
      proc[1].geometry.dispose();
      proc[1].geometry = ringGeo(-.002, .006, .009);
      proc[1].position.y = .009;
      if (proc[1].userData.p0) proc[1].userData.p0.y = .009;
    }
  }

  var oLA = proto.loadArena;
  proto.loadArena = function (proc) {
    shrinkProc(proc);
    if (!oLA) return;
    oLA.call(this, proc);
    var self = this, n = 0;
    var t = setInterval(function () {
      n++;
      if (self.arena) { shrinkArenaBoards(self.arena); clearInterval(t); }
      else if (n > 200) clearInterval(t);
    }, 50);
  };

  var oAds = proto.buildAds;
  proto.buildAds = function () {
    if (oAds) oAds.call(this);
    var ads = this.ads; if (!ads) return;
    ads.forEach(function (m) {
      m.geometry.dispose();
      m.geometry = new THREE.PlaneGeometry(AD_W, AD_H);
      m.position.y = AD_Z;
    });
    // redraw the text canvas at an aspect that matches the shorter plane so the type stays readable
    var cv = document.createElement('canvas'); cv.width = 640; cv.height = 56;
    var x = cv.getContext('2d');
    x.fillStyle = '#0c1a2e'; x.fillRect(0, 0, 640, 56);
    x.fillStyle = '#e8ecf2';
    x.font = '600 32px system-ui,Segoe UI,Helvetica,Arial,sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('JOSHUA TREE VENTURES', 320, 30);
    var tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; tx.needsUpdate = true;
    if (ads[0] && ads[0].material) {
      if (ads[0].material.map) ads[0].material.map.dispose();
      ads[0].material.map = tx;
      ads[0].material.needsUpdate = true;
    }
  };
})(window);
