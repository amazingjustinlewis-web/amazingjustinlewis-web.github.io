/* ZERO TO PHI CAFE - game rules + computer players (pure logic, shared by phone and TV). */
(function (root) {
  'use strict';
  // ------------------------------------------------ Battleship: 8x8, quick café-sized fleet
  var BS = { N: 8, FLEET: [{ n: 'Galleon', s: 4 }, { n: 'Barge', s: 3 }, { n: 'Sloop', s: 3 }, { n: 'Dinghy', s: 2 }, { n: 'Canoe', s: 2 }] };
  BS.place = function () {
    var N = BS.N, grid = [], ships = [];
    for (var i = 0; i < N * N; i++) grid.push(-1);
    BS.FLEET.forEach(function (f, si) {
      for (var t = 0; t < 500; t++) {
        var h = Math.random() < 0.5, x = Math.floor(Math.random() * (h ? N - f.s + 1 : N)), y = Math.floor(Math.random() * (h ? N : N - f.s + 1)), cells = [], ok = true;
        for (var k = 0; k < f.s; k++) { var c = (y + (h ? 0 : k)) * N + x + (h ? k : 0); if (grid[c] !== -1) { ok = false; break; } cells.push(c); }
        if (!ok) continue;
        // keep a one-cell gap so the fleet reads clearly
        if (cells.some(function (c) { var cx = c % N, cy = (c / N) | 0; for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) { var nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && grid[ny * N + nx] !== -1) return true; } return false; }) && t < 400) continue;
        cells.forEach(function (c) { grid[c] = si; }); ships.push({ n: f.n, s: f.s, cells: cells, hits: 0 }); return;
      }
    });
    return { grid: grid, ships: ships, shots: {} };
  };
  // returns {r:'miss'|'hit'|'sunk'|'again', ship, cells, over}
  BS.fire = function (b, c) {
    if (b.shots[c]) return { r: 'again' };
    var si = b.grid[c];
    if (si < 0) { b.shots[c] = 'm'; return { r: 'miss' }; }
    b.shots[c] = 'h'; var sh = b.ships[si]; sh.hits++;
    if (sh.hits === sh.s) { sh.cells.forEach(function (x) { b.shots[x] = 's'; }); return { r: 'sunk', ship: sh.n, cells: sh.cells, over: b.ships.every(function (s) { return s.hits === s.s; }) }; }
    return { r: 'hit' };
  };
  // AI keeps its own view of what it has learned about the opponent board
  BS.AI = function () { this.k = {}; this.queue = []; };
  BS.AI.prototype.pick = function () {
    var N = BS.N, k = this.k, self = this;
    var hits = Object.keys(k).filter(function (c) { return k[c] === 'h'; }).map(Number);
    if (hits.length) {
      var cand = [];
      hits.forEach(function (c) {
        var x = c % N, y = (c / N) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= N || ny >= N) return; var n = ny * N + nx; if (k[n]) return;
          var bx = x - d[0], by = y - d[1], inLine = bx >= 0 && by >= 0 && bx < N && by < N && k[by * N + bx] === 'h';
          cand.push({ c: n, w: inLine ? 3 : 1 });
        });
      });
      if (cand.length) { cand.sort(function (a, b) { return b.w - a.w; }); var top = cand.filter(function (q) { return q.w === cand[0].w; }); return top[Math.floor(Math.random() * top.length)].c; }
    }
    var free = []; for (var c = 0; c < N * N; c++) if (!k[c] && ((c % N) + ((c / N) | 0)) % 2 === 0) free.push(c);
    if (!free.length) for (c = 0; c < N * N; c++) if (!k[c]) free.push(c);
    return free[Math.floor(Math.random() * free.length)];
  };
  BS.AI.prototype.learn = function (c, res) { var k = this.k; if (res.r === 'miss') k[c] = 'm'; else if (res.r === 'hit') k[c] = 'h'; else if (res.r === 'sunk') res.cells.forEach(function (x) { k[x] = 's'; }); };

  // ------------------------------------------------ Connect Four: 7 columns x 6 rows, board[col][row] bottom-up
  var C4 = { W: 7, H: 6 };
  C4.make = function () { var b = []; for (var i = 0; i < C4.W; i++) b.push([]); return b; };
  C4.canDrop = function (b, col) { return col >= 0 && col < C4.W && b[col].length < C4.H; };
  C4.drop = function (b, col, p) { if (!C4.canDrop(b, col)) return -1; b[col].push(p); return b[col].length - 1; };
  C4.at = function (b, c, r) { return c >= 0 && c < C4.W && r >= 0 && r < C4.H ? b[c][r] || 0 : 0; };
  C4.winner = function (b) {   // -> {p, cells} | {p:0,draw:true} | null
    var D = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (var c = 0; c < C4.W; c++) for (var r = 0; r < C4.H; r++) { var p = C4.at(b, c, r); if (!p) continue;
      for (var d = 0; d < 4; d++) { var cells = [[c, r]], k; for (k = 1; k < 4; k++) { if (C4.at(b, c + D[d][0] * k, r + D[d][1] * k) !== p) break; cells.push([c + D[d][0] * k, r + D[d][1] * k]); } if (k === 4) return { p: p, cells: cells }; } }
    for (c = 0; c < C4.W; c++) if (b[c].length < C4.H) return null;
    return { p: 0, draw: true };
  };
  function score(b, me) {
    var s = 0, op = 3 - me, D = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (var r = 0; r < C4.H; r++) if (C4.at(b, 3, r) === me) s += 3;
    for (var c = 0; c < C4.W; c++) for (r = 0; r < C4.H; r++) for (var d = 0; d < 4; d++) {
      var ec = c + D[d][0] * 3, er = r + D[d][1] * 3; if (ec < 0 || ec >= C4.W || er < 0 || er >= C4.H) continue;
      var m = 0, o = 0; for (var k = 0; k < 4; k++) { var v = C4.at(b, c + D[d][0] * k, r + D[d][1] * k); if (v === me) m++; else if (v === op) o++; }
      if (m && o) continue; if (m === 3) s += 6; else if (m === 2) s += 2; if (o === 3) s -= 8; else if (o === 2) s -= 2;
    }
    return s;
  }
  function mm(b, depth, a, z, maxi, me) {
    var w = C4.winner(b); if (w) return w.draw ? 0 : (w.p === me ? 100000 + depth : -100000 - depth);
    if (!depth) return score(b, me);
    var order = [3, 2, 4, 1, 5, 0, 6], best = maxi ? -Infinity : Infinity;
    for (var i = 0; i < 7; i++) { var c = order[i]; if (!C4.canDrop(b, c)) continue; b[c].push(maxi ? me : 3 - me);
      var v = mm(b, depth - 1, a, z, !maxi, me); b[c].pop();
      if (maxi) { if (v > best) best = v; if (best > a) a = best; } else { if (v < best) best = v; if (best < z) z = best; } if (a >= z) break; }
    return best;
  }
  C4.ai = function (b, me, level) {   // level 1 easy .. 3 sharp
    var depth = level === 1 ? 2 : level === 2 ? 4 : 6, cols = [], best = -Infinity;
    for (var c = 0; c < C4.W; c++) { if (!C4.canDrop(b, c)) continue; b[c].push(me); var v = mm(b, depth - 1, -Infinity, Infinity, false, me); b[c].pop(); v += Math.random() * (level === 1 ? 40 : 2);
      if (v > best) { best = v; cols = [c]; } else if (v === best) cols.push(c); }
    return cols[Math.floor(Math.random() * cols.length)];
  };
  root.CafeGames = { BS: BS, C4: C4 };
})(typeof window !== 'undefined' ? window : globalThis);
