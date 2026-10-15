/* HOP TOP - 15-hole triangle peg solitaire. Pure logic + canvas drawing, used by the screen and the pads. */
(function (root) {
  var H = []; for (var r = 0; r < 5; r++) for (var c = 0; c <= r; c++) H.push([r, c]);
  function idx(r, c) { return c < 0 || c > r || r > 4 || r < 0 ? -1 : r * (r + 1) / 2 + c; }
  var D = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]];
  function jumps(pegs, from) {
    var out = []; if (!pegs[from]) return out; var r = H[from][0], c = H[from][1];
    D.forEach(function (d) { var o = idx(r + d[0], c + d[1]), t = idx(r + 2 * d[0], c + 2 * d[1]); if (o >= 0 && t >= 0 && pegs[o] && !pegs[t]) out.push({ to: t, over: o }); });
    return out;
  }
  function anyMove(p) { for (var i = 0; i < 15; i++) if (jumps(p, i).length) return true; return false; }
  var RATE = [[1, 'PEG LEGEND!', 'One peg, right on top. Frame this.'], [1, 'Certified Genius', 'One peg left! Now finish on top for the bonus.'], [2, 'Pretty Sharp', 'Two left. So close.'], [3, 'Not Bad, Not Bad', 'Three pegs. Respectable.'], [99, 'Peg-norant', 'Four or more. The pegs win this time!']];
  function New() { var g = { pegs: [], phase: 'pick', sel: -1, hist: [], msg: 'Tap any peg to pull it out and start', rate: null }; for (var i = 0; i < 15; i++) g.pegs.push(true); return g; }
  function left(g) { return g.pegs.filter(Boolean).length; }
  function tap(g, i) {
    if (i < 0 || g.phase === 'done') return;
    if (g.phase === 'pick') { g.pegs[i] = false; g.phase = 'play'; g.msg = 'Jump a peg over another into an empty hole'; return 'pull'; }
    if (g.sel >= 0) { var j = jumps(g.pegs, g.sel).filter(function (m) { return m.to === i; })[0];
      if (j) { g.hist.push(g.pegs.slice()); g.pegs[g.sel] = false; g.pegs[j.over] = false; g.pegs[i] = true; g.sel = -1; check(g); return 'jump'; } }
    if (g.pegs[i] && jumps(g.pegs, i).length) { g.sel = i; g.msg = 'Now tap where it lands'; return 'sel'; }
    g.sel = -1; g.msg = g.pegs[i] ? 'That peg has no jump' : 'Pick a peg first'; return 'no';
  }
  function check(g) {
    if (anyMove(g.pegs)) { g.msg = left(g) + ' pegs left'; return; }
    var n = left(g), top = n === 1 && g.pegs[0], k = top ? 0 : RATE.findIndex(function (x, i) { return i > 0 && n <= x[0]; });
    g.phase = 'done'; g.rate = { n: n, title: RATE[k][1], sub: RATE[k][2], top: top }; g.msg = RATE[k][1];
  }
  function undo(g) { if (!g.hist.length) return; g.pegs = g.hist.pop(); g.phase = 'play'; g.rate = null; g.sel = -1; g.msg = left(g) + ' pegs left'; }
  function hint(g) { for (var i = 0; i < 15; i++) { var j = jumps(g.pegs, i); if (j.length) { g.sel = i; g.msg = 'Try this one'; return; } } }
  // ---- drawing: returns hole screen positions for hit testing
  function layout(w, h) { var s = Math.min(w / 6.2, h / 5.6), cx = w / 2, y0 = h / 2 - 2 * s * 0.87 - s * 0.1; return H.map(function (rc) { return [cx + (rc[1] - rc[0] / 2) * s, y0 + rc[0] * s * 0.87, s]; }); }
  function draw(ctx, w, h, g, t, color) {
    var P = layout(w, h), s = P[0][2];
    ctx.fillStyle = '#2b1d14'; ctx.fillRect(0, 0, w, h);
    var gr = ctx.createRadialGradient(w / 2, h * .45, 10, w / 2, h / 2, Math.max(w, h) * .7); gr.addColorStop(0, '#3d2a1c'); gr.addColorStop(1, '#1a110b'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    var a = P[0], b = P[10], c = P[14], m = s * 0.85;
    ctx.beginPath(); ctx.moveTo(a[0], a[1] - m * 1.15); ctx.lineTo(c[0] + m, c[1] + m * .6); ctx.lineTo(b[0] - m, b[1] + m * .6); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = s * .35; ctx.strokeStyle = '#b07a45'; ctx.stroke(); ctx.fillStyle = '#c98f55'; ctx.fill();
    ctx.strokeStyle = '#a8703c55'; ctx.lineWidth = 2; for (var k = -8; k < 8; k++) { ctx.beginPath(); ctx.moveTo(w / 2 + k * s * .5, a[1] - m); ctx.bezierCurveTo(w / 2 + k * s * .5 + 20, h / 2, w / 2 + k * s * .5 - 20, h / 2, w / 2 + k * s * .5 + 10, c[1] + m * .5); ctx.stroke(); }
    var tg = g.sel >= 0 ? jumps(g.pegs, g.sel).map(function (j) { return j.to; }) : [];
    P.forEach(function (p, i) {
      ctx.beginPath(); ctx.arc(p[0], p[1], s * .2, 0, 7); ctx.fillStyle = '#3a2412'; ctx.fill();
      if (tg.indexOf(i) >= 0) { ctx.beginPath(); ctx.arc(p[0], p[1], s * (.3 + .04 * Math.sin(t * 6)), 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]); }
      if (i === 0 && g.phase !== 'pick') { ctx.fillStyle = '#ffe7a088'; ctx.font = (s * .22) + 'px Fredoka,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('\u2605 top', p[0], p[1] - s * .52); }
      if (!g.pegs[i]) return;
      var lift = i === g.sel ? s * .12 + Math.sin(t * 8) * s * .02 : 0, col = color || ['#ff5a6e', '#3aa8ff', '#5fdc7a', '#ffc93f', '#c77dff'][i % 5];
      ctx.beginPath(); ctx.ellipse(p[0] + 3, p[1] + 4, s * .24, s * .13, 0, 0, 7); ctx.fillStyle = '#0005'; ctx.fill();
      ctx.beginPath(); ctx.arc(p[0], p[1] - s * .1 - lift, s * .24, 0, 7); var pg = ctx.createRadialGradient(p[0] - s * .08, p[1] - s * .2 - lift, 2, p[0], p[1] - s * .1 - lift, s * .26); pg.addColorStop(0, '#fff'); pg.addColorStop(.25, col); pg.addColorStop(1, '#0006'); ctx.fillStyle = pg; ctx.fill();
      if (i === g.sel) { ctx.strokeStyle = '#ffe7a0'; ctx.lineWidth = 4; ctx.stroke(); }
    });
    return P;
  }
  function hit(P, x, y) { var best = -1, bd = 1e9; P.forEach(function (p, i) { var d = Math.hypot(p[0] - x, p[1] - y); if (d < p[2] * .45 && d < bd) { bd = d; best = i; } }); return best; }
  root.HopTop = { New: New, tap: tap, undo: undo, hint: hint, draw: draw, hit: hit, left: left };
})(window);
