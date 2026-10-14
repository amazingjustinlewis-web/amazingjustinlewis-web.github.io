/* IRON STRIDE - the world layout, shared by the TV (3D) and the phones (topographic map). Deterministic. No DOM. */
(function (root) {
  'use strict';
  var C = root.MECH_CONFIG, W = C.world;
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // ground height: gentle rolling city floor, hills rising past the city edge
  function height(x, z) {
    var e = Math.max(Math.abs(x), Math.abs(z));
    var roll = 1.4 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 - 0.4) + 0.6 * Math.sin((x + z) * 0.07);
    var hill = smooth(W.city - 6, W.half + 10, e) * (16 + 7 * Math.sin(x * 0.06) * Math.cos(z * 0.05));
    return roll + hill;
  }
  var roads = [-100, -60, -20, 20, 60, 100], roadW = 9;
  var R = rng(W.seed), buildings = [], barrels = [], trees = [];
  var bay = { x: 0, z: 40, w: 22, d: 22, open: 'south' };       // block x -20..20, z 20..60, open toward the start plaza (z-)
  for (var bi = 0; bi < roads.length - 1; bi++) for (var bj = 0; bj < roads.length - 1; bj++) {
    var x0 = roads[bi] + roadW / 2 + 2, x1 = roads[bi + 1] - roadW / 2 - 2, z0 = roads[bj] + roadW / 2 + 2, z1 = roads[bj + 1] - roadW / 2 - 2;
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (cx === 0 && cz === 0) { for (var p = 0; p < 4; p++) trees.push({ x: (p & 1 ? 1 : -1) * 13, z: (p & 2 ? 1 : -1) * 13, s: 1.2 }); continue; }   // start plaza
    if (cx === 0 && cz === 40) continue;                            // mech bay block
    var kind = R();
    if (kind < 0.18) {                                              // a park: trees + barrels
      for (var t = 0; t < 7; t++) trees.push({ x: x0 + 3 + R() * (x1 - x0 - 6), z: z0 + 3 + R() * (z1 - z0 - 6), s: 0.8 + R() * 0.7 });
      continue;
    }
    var split = R() < 0.3 ? 1 : 2, w = (x1 - x0) / split, d = (z1 - z0) / split;
    for (var a = 0; a < split; a++) for (var b = 0; b < split; b++) {
      if (split === 2 && R() < 0.22) continue;
      var bw = w * (0.7 + R() * 0.25), bd = d * (0.7 + R() * 0.25);
      var far = Math.max(Math.abs(cx), Math.abs(cz)) / 100;
      buildings.push({ x: x0 + w * (a + 0.5), z: z0 + d * (b + 0.5), w: bw, d: bd, h: 9 + R() * (14 + 22 * (1 - far)), hue: R() });
    }
  }
  // barrels: little clusters at road corners
  for (var i = 0; i < 16; i++) {
    var rx = roads[Math.floor(R() * roads.length)], rz = roads[Math.floor(R() * roads.length)];
    if (Math.abs(rx) < 25 && Math.abs(rz) < 25) continue;
    var ox = (R() < 0.5 ? -1 : 1) * (roadW / 2 + 1.5), oz = (R() < 0.5 ? -1 : 1) * (roadW / 2 + 1.5);
    var n = 2 + Math.floor(R() * 3);
    for (var k = 0; k < n; k++) barrels.push({ x: rx + ox + (k % 2) * 1.6 * Math.sign(ox), z: rz + oz + Math.floor(k / 2) * 1.6 * Math.sign(oz) });
  }
  barrels.push({ x: 6, z: -14 }, { x: 7.6, z: -14.5 }, { x: 6.8, z: -15.8 });   // a starter cluster in sight of the plaza
  for (var h = 0; h < 40; h++) { var ang = R() * Math.PI * 2, rr = W.city + 8 + R() * 25; trees.push({ x: Math.cos(ang) * rr, z: Math.sin(ang) * rr, s: 1 + R() }); }

  // segment / AABB helpers
  function insideBuilding(x, z, pad) {
    pad = pad || 0;
    for (var i = 0; i < buildings.length; i++) { var b = buildings[i]; if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return b; }
    return null;
  }
  root.MechWorld = { height: height, buildings: buildings, barrels: barrels, trees: trees, bay: bay, roads: roads, roadW: roadW, half: W.half, city: W.city, insideBuilding: insideBuilding, rng: rng };
})(typeof window !== 'undefined' ? window : globalThis);
