/* ZOMBIE TILES - stylised dice, drawn in code (shared by TV and phones) */
(function (root) {
  'use strict';
  var C = root.ZT_CONFIG;
  var PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  var ZOMBIE = { id: 'zombie', name: 'Zombie', face: '#71815a', edge: '#3a4530', pip: '#d9ff9c' };
  function style(id) { if (id === 'zombie') return ZOMBIE; for (var i = 0; i < C.dice.length; i++) if (C.dice[i].id === id) return C.dice[i]; return C.dice[0]; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // draw one die centred at cx,cy with side s
  function draw(ctx, cx, cy, s, value, id, angle) {
    var st = style(id), h = s / 2, r = s * 0.2;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle || 0);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, -h + s * 0.06, -h + s * 0.1, s, s, r); ctx.fill();
    if (st.id === 'toxic' || st.id === 'midnight') { ctx.shadowColor = st.id === 'toxic' ? '#9dff5c' : '#5fd6ff'; ctx.shadowBlur = s * 0.35; }
    // body: edge then face
    ctx.fillStyle = st.edge; rr(ctx, -h, -h, s, s, r); ctx.fill();
    ctx.shadowBlur = 0;
    var gr = ctx.createLinearGradient(-h, -h, h, h);
    gr.addColorStop(0, lighten(st.face, 0.25)); gr.addColorStop(1, st.face);
    ctx.fillStyle = gr; rr(ctx, -h + s * 0.05, -h + s * 0.04, s * 0.9, s * 0.86, r * 0.85); ctx.fill();
    ctx.save(); rr(ctx, -h + s * 0.05, -h + s * 0.04, s * 0.9, s * 0.86, r * 0.85); ctx.clip();
    decorate(ctx, st, s, h);
    ctx.restore();
    // pips
    var p = PIPS[value] || PIPS[1], gap = s * 0.25, pr = s * 0.085;
    ctx.fillStyle = st.pip;
    if (st.id === 'midnight') { ctx.shadowColor = st.pip; ctx.shadowBlur = s * 0.15; }
    for (var i = 0; i < p.length; i++) {
      ctx.beginPath();
      if (st.id === 'blood' && value === 1) { heart(ctx, 0, -s * 0.02, s * 0.2); }
      else if (st.id === 'bone' && value === 1) { skull(ctx, 0, -s * 0.02, s * 0.3, st.pip); continue; }
      else if (st.id === 'sunshine' && value === 1) { sun(ctx, 0, -s * 0.02, s * 0.16, st.pip); continue; }
      else ctx.arc(p[i][0] * gap, p[i][1] * gap - s * 0.02, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function decorate(ctx, st, s, h) {
    ctx.lineWidth = Math.max(1, s * 0.025);
    if (st.id === 'bone') {          // hairline cracks
      ctx.strokeStyle = 'rgba(90,70,50,0.35)'; ctx.beginPath();
      ctx.moveTo(-h, -h * 0.3); ctx.lineTo(-h * 0.6, -h * 0.2); ctx.lineTo(-h * 0.45, -h * 0.45);
      ctx.moveTo(h, h * 0.4); ctx.lineTo(h * 0.65, h * 0.55); ctx.stroke();
    } else if (st.id === 'blood') {  // drips from the top edge
      ctx.fillStyle = 'rgba(60,0,8,0.55)';
      [[-0.55, 0.32], [-0.1, 0.18], [0.45, 0.42]].forEach(function (d) {
        ctx.beginPath(); ctx.ellipse(d[0] * h, -h + d[1] * h * 0.6, s * 0.035, d[1] * h * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(d[0] * h, -h + d[1] * h * 1.2, s * 0.045, 0, Math.PI * 2); ctx.fill();
      });
    } else if (st.id === 'toxic') {  // bubbles
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      [[-0.6, 0.55, 0.07], [0.62, -0.58, 0.05], [0.5, 0.7, 0.04]].forEach(function (b) { ctx.beginPath(); ctx.arc(b[0] * h, b[1] * h, b[2] * s, 0, 7); ctx.fill(); });
    } else if (st.id === 'midnight') { // stars
      ctx.fillStyle = 'rgba(200,230,255,0.7)';
      [[-0.7, -0.2], [0.3, -0.75], [0.75, 0.3], [-0.3, 0.75], [0.1, 0.45]].forEach(function (b) { ctx.fillRect(b[0] * h, b[1] * h, s * 0.03, s * 0.03); });
    } else if (st.id === 'candy') {  // stripes
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = s * 0.08;
      for (var k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * s * 0.3 - h, -h); ctx.lineTo(k * s * 0.3 + h, h); ctx.stroke(); }
    } else if (st.id === 'sunshine') { // glossy highlight
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-h * 0.35, -h * 0.55, s * 0.3, s * 0.12, -0.4, 0, 7); ctx.fill();
    }
  }
  function heart(ctx, x, y, r) {
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  }
  function skull(ctx, x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - s * 0.08, s * 0.42, 0, 7); ctx.fill();
    ctx.fillRect(x - s * 0.22, y + s * 0.15, s * 0.44, s * 0.25);
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath(); ctx.arc(x - s * 0.16, y - s * 0.08, s * 0.11, 0, 7); ctx.arc(x + s * 0.16, y - s * 0.08, s * 0.11, 0, 7); ctx.fill();
    ctx.fillStyle = col;
  }
  function sun(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = r * 0.35; ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4); ctx.lineTo(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.9); ctx.stroke(); }
  }
  function lighten(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // A tumbling roll animation on a canvas. values = final faces; dur in ms. Returns a stop function.
  function animate(canvas, values, id, dur, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), t0 = performance.now(), n = values.length, raf, seedA = Math.random() * 6;
    function frame(now) {
      var w = canvas.width, h = canvas.height, t = Math.min(1, (now - t0) / dur);
      ctx.clearRect(0, 0, w, h);
      var s = Math.min(h * 0.72, (w / n) * 0.62);
      for (var i = 0; i < n; i++) {
        var cx = w * (i + 0.5) / n, settle = 1 - Math.pow(1 - t, 3);
        var bounce = t < 1 ? Math.abs(Math.sin(t * Math.PI * 3 + i)) * (1 - t) * h * 0.18 : 0;
        var face = t < 1 ? 1 + Math.floor((now / 70 + i * 3 + seedA) % 6) : values[i];
        var ang = t < 1 ? (1 - settle) * (6 + i * 2) + (i ? -0.08 : 0.06) : (i ? -0.08 : 0.06);
        draw(ctx, cx, h / 2 - bounce, s * (t < 1 ? 0.92 + 0.08 * settle : 1), face, id, ang);
      }
      if (t < 1) raf = requestAnimationFrame(frame); else if (opts.done) opts.done();
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }
  function still(canvas, values, id) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, n = values.length;
    ctx.clearRect(0, 0, w, h);
    var s = Math.min(h * 0.72, (w / n) * 0.62);
    for (var i = 0; i < n; i++) draw(ctx, w * (i + 0.5) / n, h / 2, s, values[i], id, i ? -0.08 : 0.06);
  }
  root.ZTDice = { draw: draw, animate: animate, still: still, style: style };
})(typeof window !== 'undefined' ? window : globalThis);
