/* IRON STRIDE open world (dev v0.5): wide mountains and hills with scattered scraps of cities, abandoned bases and outposts.
   Same interface as the city world (height, buildings, barrels, trees, bay, roads, insideBuilding), plus sites. Deterministic. No DOM. */
(function (root) {
  'use strict';
  var C = root.MECH_CONFIG, W = C.world, HALF = W.half;
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function hash(i, j) { var h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + W.seed * 1013; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) { var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function raw(x, z) {
    var hills = 0, amp = 1, f = 1 / 160; for (var o = 0; o < 4; o++) { hills += (vnoise(x * f, z * f) - 0.5) * amp; amp *= 0.5; f *= 2.1; }
    var r = 1 - Math.abs(vnoise(x / 230 + 7.3, z / 230 - 2.1) * 2 - 1), ridge = Math.pow(r, 3.2) * 85;            // mountain ridges
    var mask = smooth(0.42, 0.75, vnoise(x / 420 + 3, z / 420 + 9));                                            // mountains in some regions only
    var rim = smooth(HALF - 70, HALF + 20, Math.max(Math.abs(x), Math.abs(z))) * 90;                           // a mountain wall at the edge
    return hills * 26 + ridge * mask + rim;
  }
  // sites: flat pads with buildings
  var R = rng(W.seed), sites = [{ x: 0, z: 20, r: 75, kind: 'home' }];
  var kinds = ['city', 'base', 'outpost', 'city', 'outpost', 'base', 'outpost', 'city', 'outpost', 'base', 'outpost', 'outpost'];
  for (var tries = 0; tries < 400 && sites.length < kinds.length + 1; tries++) {
    var k = kinds[sites.length - 1], rr = k === 'city' ? 70 : k === 'base' ? 50 : 26, x = (R() * 2 - 1) * (HALF - 110), z = (R() * 2 - 1) * (HALF - 110);
    if (sites.some(function (s) { return Math.hypot(s.x - x, s.z - z) < s.r + rr + 70; })) continue;
    sites.push({ x: x, z: z, r: rr, kind: k });
  }
  sites.forEach(function (s) { s.h = raw(s.x, s.z) * 0.6; });
  function height(x, z) {
    var h = raw(x, z);
    for (var i = 0; i < sites.length; i++) { var s = sites[i], d = Math.hypot(x - s.x, z - s.z); if (d < s.r + 40) { var w = 1 - smooth(s.r * 0.85, s.r + 40, d); h = h + (s.h + 0.6 * Math.sin(x * 0.05) * Math.cos(z * 0.05) - h) * w; } }
    return h;
  }
  var buildings = [], barrels = [], trees = [], bay = { x: 0, z: 40, w: 22, d: 22, open: 'south' };
  function bld(x, z, w, d, h) { if (Math.hypot(x - bay.x, z - bay.z) < 22 || Math.hypot(x, z) < 16) return; buildings.push({ x: x, z: z, w: w, d: d, h: h, hue: R() }); }
  sites.forEach(function (s) {
    if (s.kind === 'home') { for (var t = 0; t < 6; t++) { var a = R() * 6.28; bld(s.x + Math.cos(a) * 52, s.z + Math.sin(a) * 52, 8 + R() * 6, 8 + R() * 6, 8 + R() * 10); } }
    if (s.kind === 'city') {   // a scrap of a city: a ruined block grid, some towers broken short
      var n = 3 + Math.floor(R() * 2), cell = s.r * 1.6 / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { if (R() < 0.25) continue; var bx = s.x - s.r * 0.8 + (i + 0.5) * cell, bz = s.z - s.r * 0.8 + (j + 0.5) * cell;
        bld(bx, bz, cell * (0.45 + R() * 0.3), cell * (0.45 + R() * 0.3), R() < 0.35 ? 4 + R() * 6 : 12 + R() * 30); }
    }
    if (s.kind === 'base') {   // abandoned base: broken perimeter wall, hangars, a tower
      var L = s.r * 0.85; for (var e = 0; e < 4; e++) for (var q = -2; q <= 2; q++) { if (R() < 0.3) continue; var along = q * L / 2.5, hor = e < 2;
        bld(s.x + (hor ? along : (e === 2 ? -L : L)), s.z + (hor ? (e === 0 ? -L : L) : along), hor ? L / 2.8 : 2, hor ? 2 : L / 2.8, 4 + R() * 2); }
      for (var hgr = 0; hgr < 2 + Math.floor(R() * 2); hgr++) bld(s.x + (R() - 0.5) * L, s.z + (R() - 0.5) * L, 14 + R() * 8, 10 + R() * 6, 7 + R() * 4);
      bld(s.x + (R() - 0.5) * L, s.z + (R() - 0.5) * L, 4, 4, 22 + R() * 8);
    }
    if (s.kind === 'outpost') { for (var o = 0; o < 2 + Math.floor(R() * 3); o++) { var oa = R() * 6.28, od = 6 + R() * 12; bld(s.x + Math.cos(oa) * od, s.z + Math.sin(oa) * od, 4 + R() * 3, 4 + R() * 3, 6 + R() * 14); }
      bld(s.x, s.z, 9, 6, 4); }
    var nb = s.kind === 'home' ? 3 : 4 + Math.floor(R() * 4);
    for (var b = 0; b < nb; b++) { var ba = R() * 6.28, bd = s.r * (0.3 + R() * 0.6); barrels.push({ x: s.x + Math.cos(ba) * bd, z: s.z + Math.sin(ba) * bd }); }
  });
  barrels.push({ x: 6, z: -14 }, { x: 7.6, z: -14.5 }, { x: 6.8, z: -15.8 });
  for (var tr = 0; tr < 420; tr++) { var tx = (R() * 2 - 1) * (HALF - 20), tz = (R() * 2 - 1) * (HALF - 20), th = height(tx, tz);
    if (th > 55 || sites.some(function (s) { return Math.hypot(s.x - tx, s.z - tz) < s.r * 0.9; })) continue; trees.push({ x: tx, z: tz, s: 0.9 + R() * 0.9 }); }
  function insideBuilding(x, z, pad) { pad = pad || 0; for (var i = 0; i < buildings.length; i++) { var b = buildings[i]; if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return b; } return null; }
  function siteAt(x, z) { for (var i = 0; i < sites.length; i++) if (Math.hypot(x - sites[i].x, z - sites[i].z) < sites[i].r) return sites[i]; return null; }
  root.MechWorld = { height: height, buildings: buildings, barrels: barrels, trees: trees, bay: bay, roads: [], roadW: 9, half: HALF, city: 0, insideBuilding: insideBuilding, rng: rng, sites: sites, siteAt: siteAt, open: true };
})(typeof window !== 'undefined' ? window : globalThis);
