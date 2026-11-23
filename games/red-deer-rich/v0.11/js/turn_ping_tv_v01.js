/* TV v0.7.6: replace the "It's X's turn" pop-up with a radar-ping arrow beside the side-panel
   player list, pointing at the current player. Oscillation, glow and particles follow how well
   they're doing (net worth / properties). Turn changes use a short anticipation, then a spring snap. */
(function (w) {
  'use strict';
  var cv, ctx, raf = 0;
  var st = { pid: null, y: 0, v: 0, target: 0, antic: 0, anticFrom: 0, gold: [] };

  function game() { return w.RDR && RDR.game; }

  function fortune(p, g) {
    if (!p || !g || typeof g.worthOf !== 'function') return 0.4;
    var alive = g.players.filter(function (q) { return !q.bankrupt; });
    if (!alive.length) return 0.4;
    var ws = alive.map(function (q) { return g.worthOf(q); });
    var lo = Math.min.apply(null, ws), hi = Math.max.apply(null, ws);
    var wth = g.worthOf(p);
    var rel = hi <= lo ? 0.5 : (wth - lo) / (hi - lo);
    /* properties boost a bit: a full set / lots of deeds reads as doing well */
    var deeds = 0, sets = 0;
    try {
      g.props.forEach(function (pr, i) {
        if (pr && pr.owner === g.oid(p)) { deeds++; }
      });
      if (typeof g.hasFullSet === 'function' && g.hasFullSet(p)) sets = 1;
    } catch (e) {}
    return Math.max(0, Math.min(1, rel * 0.85 + Math.min(0.15, deeds / 80) + sets * 0.08));
  }

  function cardY(pid) {
    var el = document.querySelector('#cards .pcard[data-pid="' + pid + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { mid: r.top + r.height / 2, left: r.left, top: r.top, h: r.height };
  }

  function scrubTurnText() {
    var el = document.getElementById('bWho');
    if (!el) return;
    var t = el.textContent || '';
    if (/^it'?s\s+.+'s\s+turn/i.test(t)) el.textContent = '';
  }

  function mount() {
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.id = 'turnPing';
    cv.width = 160; cv.height = 160;
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    return cv;
  }

  function hexRgb(h) {
    h = String(h || '#ffd23f').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16); if (isNaN(n)) return [242, 194, 48];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function step(now) {
    raf = requestAnimationFrame(step);
    mount(); scrubTurnText();
    var g = game();
    if (!g || g.phase !== 'play' || !g.turn) { cv.style.display = 'none'; st.pid = null; return; }
    var p = g.cur ? g.cur() : g.byId(g.turn.pid);
    if (!p || p.bankrupt) { cv.style.display = 'none'; return; }
    var pos = cardY(p.id);
    if (!pos) { cv.style.display = 'none'; return; }

    var ft = fortune(p, g);
    if (st.pid !== p.id) {
      st.antic = 1; st.anticFrom = st.y || pos.mid; st.v = 0;
      st.pid = p.id;
    }
    st.target = pos.mid;
    /* anticipation: pull slightly the wrong way, then spring to the new card */
    var dest = st.target;
    if (st.antic > 0) {
      var dir = st.target >= st.anticFrom ? -1 : 1;
      dest = st.anticFrom + dir * 18 * st.antic;
      st.antic = Math.max(0, st.antic - 0.08);
      if (st.antic <= 0.001) st.antic = 0;
    }
    var k = 0.18, d = dest - st.y, damp = 0.72;
    st.v = st.v * damp + d * k;
    st.y += st.v;
    if (!isFinite(st.y)) st.y = st.target;

    var vib = (2 + 10 * ft) * Math.sin(now / (90 - 50 * ft));
    var size = 118;
    var left = pos.left - size + 8;
    cv.style.display = 'block';
    cv.style.left = Math.max(0, left) + 'px';
    cv.style.top = (st.y - size / 2 + vib * (0.4 + 0.6 * ft)) + 'px';

    var c = ctx, W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    var cx = W * 0.62, cy = H / 2;
    var col = p.color || '#ffd23f', rgb = hexRgb(col);
    /* radar pings */
    var pingT = (now / (700 - 280 * ft)) % 1;
    for (var i = 0; i < 3; i++) {
      var u = (pingT + i / 3) % 1, rad = 16 + u * (36 + 20 * ft);
      c.beginPath(); c.arc(cx + 10, cy, rad, 0, 7);
      c.strokeStyle = 'rgba(' + rgb.join(',') + ',' + ((0.45 + 0.25 * ft) * (1 - u)).toFixed(3) + ')';
      c.lineWidth = (3.5 + 2 * ft) * (1 - u);
      c.stroke();
    }
    /* the arrow (same language as the danger waypoints: a fat triangle, tip toward the name) */
    var r = 22 + 6 * ft;
    c.save();
    c.translate(cx, cy);
    c.rotate(Math.PI / 2); /* tip points right, toward the list */
    /* glow */
    c.shadowColor = p.state === 'gold' || ft > 0.75 ? '#ffd23f' : col;
    c.shadowBlur = 10 + 22 * ft;
    c.beginPath(); c.moveTo(0, -r * 1.15); c.lineTo(r * 0.85, r * 0.8); c.lineTo(-r * 0.85, r * 0.8); c.closePath();
    c.fillStyle = p.state === 'gold' || ft > 0.8 ? '#ffd23f' : col;
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.stroke();
    c.restore();

    /* gold particles for the richest; calmer sparkles for everyone else */
    if (Math.random() < 0.12 + 0.55 * ft) {
      var gold = ft > 0.62 || p.state === 'gold';
      st.gold.push({
        x: cx + (Math.random() - 0.3) * 16, y: cy + (Math.random() - 0.5) * 20,
        vx: (0.4 + Math.random()) * (gold ? 2.2 : 0.7), vy: (Math.random() - 0.5) * (gold ? 2.4 : 0.8),
        life: 1, gold: gold, s: 1.5 + Math.random() * (gold ? 3 : 1.4)
      });
    }
    for (var k2 = st.gold.length - 1; k2 >= 0; k2--) {
      var pt = st.gold[k2];
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.04; pt.life -= goldLife(pt);
      if (pt.life <= 0) { st.gold.splice(k2, 1); continue; }
      c.globalAlpha = pt.life;
      c.fillStyle = pt.gold ? '#ffd23f' : 'rgba(' + rgb.join(',') + ',1)';
      c.beginPath(); c.arc(pt.x, pt.y, pt.s * pt.life, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  }
  function goldLife(pt) { return pt.gold ? 0.018 : 0.03; }

  function boot() {
    mount();
    if (!raf) raf = requestAnimationFrame(step);
  }

  w.RDRTurnPing = { boot: boot, fortune: fortune, state: st };
})(window);
