/* TV v0.7.6: under each runner, a little colour wheel of how their properties are doing;
   the current player's runner also gets a soft, thin throbbing underlight in their colour. */
(function (w) {
  'use strict';

  function game() { return w.RDR && RDR.game; }
  function W() { return w.RDRWalkers; }

  function slicesOf(p, g) {
    var B = w.RDR_BOARD, GROUPS = B && B.GROUPS, S = B && B.SPACES;
    if (!GROUPS || !S) return [];
    var by = {}, n = 0;
    g.props.forEach(function (pr, i) {
      if (!pr || pr.owner !== g.oid(p) || !S[i]) return;
      var gk = S[i].group; if (!gk) return;
      if (!by[gk]) by[gk] = { key: gk, color: (GROUPS[gk] && GROUPS[gk].color) || '#888', n: 0, hocked: 0, shops: 0, full: 0 };
      by[gk].n++; by[gk].shops += pr.shops || 0; if (pr.hocked) by[gk].hocked++;
      n++;
    });
    var out = [];
    Object.keys(by).forEach(function (k) {
      var s = by[k];
      try { if (typeof g.ownsGroup === 'function' && g.ownsGroup(g.oid(p), k)) s.full = 1; } catch (e) {}
      out.push(s);
    });
    return out;
  }

  function hexRgb(h) {
    h = String(h || '#888').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16); if (isNaN(n)) return [136, 136, 136];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function drawUnder(rnd, now) {
    var g = game(), WW = W(); if (!g || !WW || !rnd || g.phase === 'lobby') return;
    var c = rnd.ctx, h = WW.heightOf(rnd);
    var cur = g.cur && g.cur();
    g.players.forEach(function (p) {
      if (p.bankrupt) return;
      var v = WW.visOf(p); if (!v.shown || (v.scale != null && v.scale <= 0.02)) return;
      var x = v.x, y = v.y - (v.lift || 0);
      var active = cur && cur.id === p.id;
      if (active) drawUnderlight(c, x, y, h, p.color, now, rnd);
      drawWheel(c, x, y, h, slicesOf(p, g), now);
    });
  }

  function drawUnderlight(c, x, y, h, col, now, rnd) {
    var rgb = hexRgb(col);
    var throb = 0.55 + 0.45 * Math.sin(now / 420 * Math.PI * 2);
    /* thinner than the property highlight (~0.07 of a tile). A soft elliptical wash under the feet. */
    var tile = (rnd && rnd.w) || 24;
    var rw = Math.max(10, h * 0.42), rh = Math.max(4, h * 0.13);
    var line = Math.max(1.2, tile * 0.035);
    c.save();
    c.translate(x, y + 2);
    c.scale(1, 0.38);
    var grd = c.createRadialGradient(0, 0, 2, 0, 0, rw * (1.05 + 0.08 * throb));
    grd.addColorStop(0, 'rgba(' + rgb.join(',') + ',' + (0.38 + 0.22 * throb).toFixed(3) + ')');
    grd.addColorStop(0.55, 'rgba(' + rgb.join(',') + ',' + (0.16 + 0.1 * throb).toFixed(3) + ')');
    grd.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
    c.fillStyle = grd; c.beginPath(); c.arc(0, 0, rw * (1.05 + 0.08 * throb), 0, 7); c.fill();
    c.strokeStyle = 'rgba(' + rgb.join(',') + ',' + (0.45 + 0.25 * throb).toFixed(3) + ')';
    c.lineWidth = line;
    c.beginPath(); c.ellipse(0, 0, rw * 0.92, rw * 0.92, 0, 0, 7); c.stroke();
    c.restore();
  }

  function drawWheel(c, x, y, h, slices, now) {
    if (!slices || !slices.length) return;
    var total = 0; slices.forEach(function (s) { total += Math.max(1, s.n); });
    var r0 = h * 0.16, r1 = h * 0.28, a0 = -Math.PI / 2;
    c.save();
    c.translate(x, y + 3);
    c.globalAlpha = 0.9;
    slices.forEach(function (s) {
      var span = (Math.max(1, s.n) / total) * Math.PI * 2, a1 = a0 + span;
      c.beginPath(); c.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0 * 0.55);
      c.arc(0, 0, r1, a0, a1, false);
      c.arc(0, 0, r0, a1, a0, true);
      c.closePath();
      var rgb = hexRgb(s.color);
      var dim = s.hocked >= s.n ? 0.4 : (s.full ? 1 : 0.75);
      c.fillStyle = 'rgba(' + rgb.join(',') + ',' + dim + ')';
      c.fill();
      a0 = a1;
    });
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, r1, r1 * 0.55, 0, 0, 7); c.stroke();
    c.restore();
  }

  w.RDRRunnerFx = { drawUnder: drawUnder, slicesOf: slicesOf };
})(window);
