/* RTS Flight Test - shared deterministic terrain (TV + phone). World is SIZE x SIZE metres centred on 0. */
(function (root) {
  'use strict';
  var T = { SIZE: 160, seed: 7, amp: 14 };
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7 + T.seed * 74.7) * 43758.5453; return n - Math.floor(n); }
  function noise(x, z) { var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  T.h = function (x, z) { var s = 0, f = 1 / 38, a = 1; for (var o = 0; o < 4; o++) { s += (noise(x * f + 11, z * f + 5) - .5) * a; f *= 2.1; a *= .45; }
    var r = Math.hypot(x, z) / (T.SIZE / 2), rim = Math.max(0, r - .78) * 30;   // gentle raised rim at the edge
    return s * T.amp * 2 + rim + 2; };
  T.col = function (y) {   // height tint shared by TV vertex colours and the phone minimap
    var st = [[-6, [70, 120, 160]], [-1, [196, 186, 140]], [1, [96, 160, 72]], [7, [62, 128, 58]], [12, [120, 112, 92]], [18, [235, 235, 240]]];
    if (y <= st[0][0]) return st[0][1]; for (var k = 1; k < st.length; k++) if (y < st[k][0]) { var a = st[k - 1], b = st[k], t = (y - a[0]) / (b[0] - a[0]); return [0, 1, 2].map(function (q) { return a[1][q] + (b[1][q] - a[1][q]) * t; }); } return st[st.length - 1][1]; };
  // props (deterministic): trees on grassy mid slopes, rocks higher up
  T.props = function () { var out = []; for (var k = 0; k < 420; k++) { var x = (hash(k, 1) - .5) * T.SIZE * .9, z = (hash(k, 2) - .5) * T.SIZE * .9, y = T.h(x, z); if (y > 1.5 && y < 9) out.push({ k: 'tree', x: x, z: z, y: y, s: .8 + hash(k, 3) * .7 }); else if (y >= 9 && y < 16 && hash(k, 4) < .5) out.push({ k: 'rock', x: x, z: z, y: y, s: .6 + hash(k, 5) * 1.4 }); } return out; };
  root.Terrain = T;
})(typeof window !== 'undefined' ? window : global);
